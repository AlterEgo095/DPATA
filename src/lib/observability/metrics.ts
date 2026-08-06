// src/lib/observability/metrics.ts — P3-C + P4-C UPDATED: in-memory metrics collector
//
// Prometheus-inspired metrics library (NO external dependencies).
// Used by /api/v1/metrics endpoint to expose operational telemetry for
// PlagiatIA (Next.js 16 standalone, JSON store, Z.ai GLM-4.5-flash, TF-IDF).
//
// Tracked standard metrics (auto-registered on first use):
//   - http_requests_total{method,path,status}        counter
//   - http_request_duration_ms{method,path,status}   histogram (5ms..10s,+Inf)
//   - process_uptime_seconds                         gauge
//   - process_memory_heap_used_bytes                 gauge
//   - process_memory_heap_total_bytes                gauge
//   - process_memory_rss_bytes                       gauge
//
// P4-C additions (5 new metrics):
//   - active_users_gauge                             gauge (unique users in last 5 min)
//   - zai_tokens_used_total{model,type}              counter (prompt/completion)
//   - ocr_documents_processed_total                  counter
//   - errors_total{type}                             counter (5xx, 4xx, uncaught)
//   - rbac_denies_total{required_role}               counter
//
// Usage:
//   import { metrics } from '@/lib/observability/metrics'
//   metrics.recordRequest('GET', '/api/health', 200, 12)
//   metrics.touchUser('user-abc')
//   metrics.recordZaiTokens('glm-4.5-flash', 'completion', 250)
//   const promText = metrics.getPrometheusFormat()
//
// All metrics are in-memory; they reset on process restart (PM2 reload).
// Suitable for single-instance Node.js (PM2 fork mode). For multi-instance,
// a Prometheus aggregator (push gateway or scrape each instance) is required.
//
// Type-safety: no `any` types; uses discriminated unions + type guards.

// ============================================================
// Types
// ============================================================

export type MetricType = 'counter' | 'gauge' | 'histogram'

export type Labels = Record<string, string>

interface BaseMetric {
  type: MetricType
  help: string
}

interface CounterSample {
  labels: Labels
  value: number
}

interface CounterMetric extends BaseMetric {
  type: 'counter'
  // Map key: serialized labels (e.g. 'method="GET",path="/api/health"')
  values: Map<string, CounterSample>
}

interface GaugeMetric extends BaseMetric {
  type: 'gauge'
  values: Map<string, CounterSample>
}

interface HistogramSample {
  labels: Labels
  // Cumulative bucket counts (parallel to `buckets`, last entry = +Inf)
  bucketCounts: number[]
  count: number
  sum: number
}

interface HistogramMetric extends BaseMetric {
  type: 'histogram'
  buckets: number[] // Upper bounds (inclusive, in ms). +Inf is implicit.
  values: Map<string, HistogramSample>
}

type MetricEntry = CounterMetric | GaugeMetric | HistogramMetric

// Default histogram bucket boundaries (milliseconds), Prometheus-style.
// Covers 5ms -> 10s, plus +Inf as the final overflow bucket.
const DEFAULT_HISTOGRAM_BUCKETS_MS: readonly number[] = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
]

// Built-in metric metadata: name -> { type, help }
const STANDARD_METRICS: Record<string, { type: MetricType; help: string }> = {
  http_requests_total: {
    type: 'counter',
    help: 'Total HTTP requests',
  },
  http_request_duration_ms: {
    type: 'histogram',
    help: 'HTTP request duration in ms',
  },
  process_uptime_seconds: {
    type: 'gauge',
    help: 'Process uptime in seconds',
  },
  process_memory_heap_used_bytes: {
    type: 'gauge',
    help: 'Process heap used bytes (Node.js V8)',
  },
  process_memory_heap_total_bytes: {
    type: 'gauge',
    help: 'Process heap total bytes (Node.js V8)',
  },
  process_memory_rss_bytes: {
    type: 'gauge',
    help: 'Process resident set size bytes',
  },
  // === P4-C: 5 new metrics ===
  active_users_gauge: {
    type: 'gauge',
    help: 'Number of unique authenticated users active in the last 5 minutes',
  },
  zai_tokens_used_total: {
    type: 'counter',
    help: 'Total ZAI (LLM) tokens consumed, by model and type (prompt/completion)',
  },
  ocr_documents_processed_total: {
    type: 'counter',
    help: 'Total OCR documents successfully processed',
  },
  errors_total: {
    type: 'counter',
    help: 'Total application errors, by type (5xx, 4xx, uncaught)',
  },
  rbac_denies_total: {
    type: 'counter',
    help: 'Total RBAC access denials, by required_role',
  },
}

// ============================================================
// Helpers
// ============================================================

/** Escape a label value per Prometheus exposition format spec. */
function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')
}

/**
 * Serialize labels to a stable, sorted key string.
 * Returns 'method="GET",path="/api/health"' or '' when no labels.
 * Sorted by key for deterministic output.
 */
function serializeLabels(labels?: Labels): string {
  if (!labels) return ''
  const keys = Object.keys(labels).sort()
  if (keys.length === 0) return ''
  return keys.map((k) => `${k}="${escapeLabelValue(labels[k])}"`).join(',')
}

/** Wrap a serialized label string in `{...}` braces, or return '' if empty. */
function formatLabels(labelStr: string): string {
  return labelStr ? `{${labelStr}}` : ''
}

// ============================================================
// MetricsRegistry (singleton)
// ============================================================

// Active-users tracking window (5 min, in milliseconds).
const ACTIVE_USER_WINDOW_MS = 5 * 60 * 1000
// Pruning interval (60 s) — runs as a single setInterval per process.
const ACTIVE_USER_PRUNE_INTERVAL_MS = 60 * 1000

class MetricsRegistry {
  private metrics: Map<string, MetricEntry> = new Map()

  /**
   * Ensure a metric exists; auto-create from STANDARD_METRICS if known,
   * otherwise default to counter type with a generic help string.
   */
  private ensureMetric(name: string): MetricEntry {
    const existing = this.metrics.get(name)
    if (existing) return existing

    const meta = STANDARD_METRICS[name]
    let entry: MetricEntry
    if (meta) {
      if (meta.type === 'counter') {
        entry = { type: 'counter', help: meta.help, values: new Map() }
      } else if (meta.type === 'gauge') {
        entry = { type: 'gauge', help: meta.help, values: new Map() }
      } else {
        entry = {
          type: 'histogram',
          help: meta.help,
          buckets: [...DEFAULT_HISTOGRAM_BUCKETS_MS],
          values: new Map(),
        }
      }
    } else {
      // Unknown metric name — default to counter.
      entry = { type: 'counter', help: name, values: new Map() }
    }
    this.metrics.set(name, entry)
    return entry
  }

  /** Refresh process-level gauges (uptime, memory) from Node.js runtime. */
  private refreshStandardMetrics(): void {
    const uptime = typeof process.uptime === 'function' ? process.uptime() : 0
    this.setGauge('process_uptime_seconds', Math.round(uptime))
    if (typeof process.memoryUsage === 'function') {
      const mem = process.memoryUsage()
      this.setGauge('process_memory_heap_used_bytes', mem.heapUsed)
      this.setGauge('process_memory_heap_total_bytes', mem.heapTotal)
      this.setGauge('process_memory_rss_bytes', mem.rss)
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Increment a counter metric by `value` (default 1).
   * Auto-registers the metric if it doesn't exist (defaults to counter type).
   * Silently ignores type mismatches (e.g., calling on a gauge) to avoid
   * crashing the request path.
   */
  incrementCounter(name: string, labels?: Labels, value: number = 1): void {
    const entry = this.ensureMetric(name)
    if (entry.type !== 'counter') return
    const key = serializeLabels(labels)
    const existing = entry.values.get(key)
    if (existing) {
      existing.value += value
    } else {
      // Defensive copy of labels to prevent external mutation
      entry.values.set(key, { labels: { ...(labels || {}) }, value })
    }
  }

  /**
   * Set a gauge metric to `value`.
   * Auto-registers the metric if it doesn't exist.
   * For STANDARD_METRICS gauges (process_*), the type is set correctly.
   * Silently ignores type mismatches (e.g., calling on a counter).
   */
  setGauge(name: string, value: number, labels?: Labels): void {
    const existing = this.metrics.get(name)
    if (existing && existing.type !== 'gauge') {
      // Don't override an existing typed metric (counter/histogram)
      return
    }

    let entry: GaugeMetric
    if (existing) {
      // P4-C: cast to GaugeMetric — we already returned early if type !== 'gauge',
      // so the existing entry is guaranteed to be a GaugeMetric. The cast is
      // required because TS cannot narrow the union type via the runtime check
      // above without an explicit type guard.
      entry = existing as GaugeMetric
    } else {
      const meta = STANDARD_METRICS[name]
      if (meta && meta.type === 'gauge') {
        entry = { type: 'gauge', help: meta.help, values: new Map() }
      } else if (!meta) {
        // Ad-hoc gauge
        entry = { type: 'gauge', help: name, values: new Map() }
      } else {
        // Standard metric declares non-gauge type — bail out
        return
      }
      this.metrics.set(name, entry)
    }
    const key = serializeLabels(labels)
    entry.values.set(key, { labels: { ...(labels || {}) }, value })
  }

  /**
   * Observe a value for a histogram metric.
   * Auto-registers the metric with DEFAULT_HISTOGRAM_BUCKETS_MS if missing.
   * Silently ignores type mismatches.
   */
  observeHistogram(name: string, value: number, labels?: Labels): void {
    const entry = this.ensureMetric(name)
    if (entry.type !== 'histogram') return
    const key = serializeLabels(labels)
    let sample = entry.values.get(key)
    if (!sample) {
      sample = {
        labels: { ...(labels || {}) },
        bucketCounts: new Array(entry.buckets.length + 1).fill(0), // +1 for +Inf
        count: 0,
        sum: 0,
      }
      entry.values.set(key, sample)
    }
    // Cumulative: every bucket with le >= value increments
    for (let i = 0; i < entry.buckets.length; i++) {
      if (value <= entry.buckets[i]) {
        sample.bucketCounts[i]++
      }
    }
    // +Inf bucket always increments
    sample.bucketCounts[entry.buckets.length]++
    sample.count++
    sample.sum += value
  }

  /**
   * Convenience: record an HTTP request.
   * Increments http_requests_total{method,path,status} and observes
   * http_request_duration_ms{method,path,status}.
   *
   * `path` should be a NORMALIZED route (e.g. "/api/v1/documents/[id]")
   * to avoid high-cardinality explosion on parameterized routes.
   * Middleware (P3-A's job) is expected to normalize before calling this.
   */
  recordRequest(method: string, path: string, status: number, durationMs: number): void {
    const labels: Labels = {
      method: method.toUpperCase(),
      path,
      status: String(status),
    }
    this.incrementCounter('http_requests_total', labels)
    this.observeHistogram('http_request_duration_ms', durationMs, labels)
  }

  // ============================================================
  // P4-C: Active-user tracking
  // ============================================================

  /** Map of userId -> lastSeenTimestamp (ms since epoch). */
  private activeUsers: Map<string, number> = new Map()
  /** Whether the prune interval has been registered yet. */
  private activeUserPruneRegistered: boolean = false

  /**
   * P4-C: Record that a user is currently active.
   * Call from getCurrentUser() (jwt.ts) — every authenticated request.
   * Updates the user's lastSeen timestamp; a background setInterval (60s)
   * prunes entries older than 5 min and updates the active_users_gauge.
   *
   * Safe to call from any runtime; if setInterval is unavailable (Edge
   * runtime sandbox), the gauge is updated lazily on next getPrometheusFormat().
   */
  touchUser(userId: string): void {
    if (!userId) return
    this.activeUsers.set(userId, Date.now())
    // Register prune interval once.
    if (!this.activeUserPruneRegistered) {
      this.activeUserPruneRegistered = true
      try {
        if (typeof setInterval === 'function') {
          setInterval(() => this.pruneActiveUsers(), ACTIVE_USER_PRUNE_INTERVAL_MS)
          // Run once immediately to populate the gauge.
          this.pruneActiveUsers()
        }
      } catch {
        // setInterval unavailable — gauge will be refreshed lazily.
      }
    }
  }

  /** Prune stale entries (older than 5 min) and update active_users_gauge. */
  private pruneActiveUsers(): void {
    const cutoff = Date.now() - ACTIVE_USER_WINDOW_MS
    let active = 0
    for (const [userId, ts] of this.activeUsers.entries()) {
      if (ts < cutoff) {
        this.activeUsers.delete(userId)
      } else {
        active++
      }
    }
    this.setGauge('active_users_gauge', active)
  }

  /**
   * P4-C: Get the current value of a gauge metric (sum of all label series).
   * Used by /api/admin/realtime/feed to surface live stats.
   * Returns 0 if the metric doesn't exist or has no samples.
   */
  getGaugeValue(name: string): number {
    const entry = this.metrics.get(name)
    if (!entry || entry.type !== 'gauge') return 0
    let total = 0
    for (const sample of entry.values.values()) {
      total += sample.value
    }
    return total
  }

  /**
   * P4-C: Get the total value of a counter metric (sum of all label series).
   * Used by /api/admin/realtime/feed for requestsLastMin approximation.
   */
  getCounterTotal(name: string): number {
    const entry = this.metrics.get(name)
    if (!entry || entry.type !== 'counter') return 0
    let total = 0
    for (const sample of entry.values.values()) {
      total += sample.value
    }
    return total
  }

  // ============================================================
  // P4-C: ZAI token tracking
  // ============================================================

  /**
   * P4-C: Record ZAI (LLM) token usage.
   * Increments zai_tokens_used_total{model,type}.
   *
   * @param model  ZAI model name (e.g. 'glm-4.5-flash')
   * @param type   'prompt' (input) or 'completion' (output)
   * @param count  Number of tokens consumed
   */
  recordZaiTokens(model: string, type: 'prompt' | 'completion', count: number): void {
    if (!model || count <= 0) return
    const labels: Labels = {
      model,
      type,
    }
    this.incrementCounter('zai_tokens_used_total', labels, count)
  }

  // ============================================================
  // P4-C: Convenience accessors for active user count (used by feed)
  // ============================================================

  /**
   * P4-C: Get the count of currently-active users (last 5 min).
   * Forces a prune before returning so the count is fresh.
   */
  getActiveUserCount(): number {
    this.pruneActiveUsers()
    return this.activeUsers.size
  }

  /**
   * Render all metrics in Prometheus text exposition format.
   * Refreshes process-level gauges before rendering.
   *
   * Spec: https://prometheus.io/docs/instrumenting/exposition_formats/
   */
  getPrometheusFormat(): string {
    this.refreshStandardMetrics()
    // P4-C: also refresh active_users_gauge before rendering so the value
    // is current even if the setInterval hasn't fired recently.
    this.pruneActiveUsers()

    const lines: string[] = []
    // Header comment block
    lines.push('# PlagiatIA metrics')
    lines.push(`# Generated at ${new Date().toISOString()}`)
    lines.push('')

    // Sort metric names for deterministic output
    const names = Array.from(this.metrics.keys()).sort()
    for (const name of names) {
      const entry = this.metrics.get(name)
      if (!entry) continue

      lines.push(`# HELP ${name} ${entry.help}`)
      lines.push(`# TYPE ${name} ${entry.type}`)

      if (entry.type === 'counter' || entry.type === 'gauge') {
        const keys = Array.from(entry.values.keys()).sort()
        if (keys.length === 0) {
          // Emit a zero-valued sample so Prometheus doesn't complain about
          // a metric with no series (helpful for newly-registered metrics).
          lines.push(`${name} 0`)
        } else {
          for (const k of keys) {
            const sample = entry.values.get(k)!
            lines.push(`${name}${formatLabels(k)} ${sample.value}`)
          }
        }
      } else {
        // histogram
        const keys = Array.from(entry.values.keys()).sort()
        for (const k of keys) {
          const sample = entry.values.get(k)!
          // Bucket lines include the `le` label
          const labelPrefix = k ? `${k},` : ''
          for (let i = 0; i < entry.buckets.length; i++) {
            const le = entry.buckets[i]
            lines.push(`${name}_bucket{${labelPrefix}le="${le}"} ${sample.bucketCounts[i]}`)
          }
          // +Inf bucket
          lines.push(
            `${name}_bucket{${labelPrefix}le="+Inf"} ${sample.bucketCounts[entry.buckets.length]}`
          )
          // Sum and count: labels only (no le)
          lines.push(`${name}_sum${formatLabels(k)} ${sample.sum}`)
          lines.push(`${name}_count${formatLabels(k)} ${sample.count}`)
        }
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Render a JSON summary of all metrics. Useful for ad-hoc inspection
   * or non-Prometheus consumers. Refreshes process-level gauges first.
   */
  getJsonFormat(): Record<string, unknown> {
    this.refreshStandardMetrics()
    this.pruneActiveUsers()

    const metricsObj: Record<string, unknown> = {}
    const names = Array.from(this.metrics.keys()).sort()
    for (const name of names) {
      const entry = this.metrics.get(name)
      if (!entry) continue

      if (entry.type === 'counter' || entry.type === 'gauge') {
        const samples: Array<{ labels: Labels; value: number }> = []
        const keys = Array.from(entry.values.keys()).sort()
        for (const k of keys) {
          const sample = entry.values.get(k)!
          samples.push({ labels: sample.labels, value: sample.value })
        }
        metricsObj[name] = {
          type: entry.type,
          help: entry.help,
          samples,
        }
      } else {
        const samples: Array<{
          labels: Labels
          buckets: Array<{ le: number | string; count: number }>
          count: number
          sum: number
        }> = []
        const keys = Array.from(entry.values.keys()).sort()
        for (const k of keys) {
          const sample = entry.values.get(k)!
          // Explicit type needed: `le` can be a number (finite bucket) or '+Inf'
          const buckets: Array<{ le: number | string; count: number }> = entry.buckets.map(
            (le, i) => ({ le, count: sample.bucketCounts[i] })
          )
          buckets.push({ le: '+Inf', count: sample.bucketCounts[entry.buckets.length] })
          samples.push({
            labels: sample.labels,
            buckets,
            count: sample.count,
            sum: sample.sum,
          })
        }
        metricsObj[name] = {
          type: entry.type,
          help: entry.help,
          buckets: entry.buckets,
          samples,
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      metrics: metricsObj,
    }
  }

  /**
   * Clear all metrics. Intended for tests; in production, metrics persist
   * for the lifetime of the process and reset on PM2 reload.
   */
  reset(): void {
    this.metrics.clear()
    this.activeUsers.clear()
  }
}

// ============================================================
// Singleton export
// ============================================================

/**
 * Singleton metrics registry. Import this and call methods directly.
 * Safe to call from any route/middleware; all operations are synchronous
 * and O(n) where n = number of distinct label combinations per metric.
 */
export const metrics = new MetricsRegistry()

// Export the class for testing (allows constructing isolated instances).
export { MetricsRegistry }
