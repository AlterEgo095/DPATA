// app/api/v1/metrics/route.ts — P3-C NEW: Prometheus metrics endpoint
//
// GET /api/v1/metrics
//   Returns Prometheus text exposition format with all metrics tracked by
//   the in-memory MetricsRegistry. Suitable for scraping by Prometheus or
//   compatible collectors (e.g. the aenewsb-prometheus container on the server).
//
// Content-Type: text/plain; version=0.0.4; charset=utf-8
// Cache-Control: no-store
//
// SECURITY NOTE — TODO for production hardening:
//   This endpoint is currently PUBLIC (no auth), matching /api/v1/status.
//   Metrics include process uptime, memory usage, and HTTP request counts
//   broken down by method/path/status — useful for ops but can leak internal
//   route structure to attackers. Before exposing on the public internet,
//   consider one of:
//     (a) IP-whitelist (e.g. only allow 95.111.226.63 + monitoring host)
//     (b) Bearer token auth (check `Authorization: Bearer <token>` header)
//     (c) Reverse-proxy basic auth at the nginx/Cloudflare layer
//   For now, the endpoint is safe to expose internally (LAN/VPN) and is
//   already filtered by the existing middleware for public internet traffic.
//
// OPTIONS
//   CORS preflight — allows GET only.
//
// Additive endpoint — zero risk to existing routes.

import { NextResponse } from 'next/server'
import { metrics } from '@/lib/observability/metrics'

// Standard Prometheus exposition format content type.
// `version=0.0.4` is the latest stable text format spec.
const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8'

/**
 * GET /api/v1/metrics — Prometheus text exposition format.
 *
 * Response time is typically < 50ms (in-memory Map iteration only).
 * The metrics registry auto-refreshes process-level gauges (uptime, memory)
 * before rendering.
 */
export async function GET() {
  const startedAt = Date.now()
  try {
    const body = metrics.getPrometheusFormat()
    const responseTimeMs = Date.now() - startedAt

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': PROMETHEUS_CONTENT_TYPE,
        'Cache-Control': 'no-store',
        'X-Response-Time': `${responseTimeMs}ms`,
      },
    })
  } catch (e: unknown) {
    // Fall back to a minimal error response in Prometheus comment format.
    // Returning HTTP 500 would mark the target as down in Prometheus; we
    // prefer returning 200 with an error comment so scraping continues.
    const errorMsg = e instanceof Error ? e.message : String(e)
    const errorBody = `# PlagiatIA metrics\n# ERROR: failed to render metrics: ${errorMsg}\n`
    return new NextResponse(errorBody, {
      status: 200,
      headers: {
        'Content-Type': PROMETHEUS_CONTENT_TYPE,
        'Cache-Control': 'no-store',
      },
    })
  }
}

/**
 * OPTIONS /api/v1/metrics — CORS preflight.
 * Allows GET only. No other methods are supported.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
  })
}
