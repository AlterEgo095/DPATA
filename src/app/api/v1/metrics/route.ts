// app/api/v1/metrics/route.ts — P3-C NEW: Prometheus metrics endpoint
// P4-A FIX: Added auth — Bearer token (METRICS_TOKEN env) OR IP whitelist
// (loopback + private/LAN + docker 172.16.0.0/12). Returns 401 with
// WWW-Authenticate: Bearer header if unauthorized.
//
// GET /api/v1/metrics
//   Returns Prometheus text exposition format with all metrics tracked by
//   the in-memory MetricsRegistry. Suitable for scraping by Prometheus or
//   compatible collectors (e.g. the aenewsb-prometheus container on the server).
//
// Content-Type: text/plain; version=0.0.4; charset=utf-8
// Cache-Control: no-store
//
// Auth:
//   (a) Bearer token: client sends `Authorization: Bearer <METRICS_TOKEN>`
//       where METRICS_TOKEN is read from process.env.METRICS_TOKEN. If env
//       var is unset, bearer auth is disabled (only IP whitelist applies).
//   (b) IP whitelist: loopback (127.0.0.1, ::1) + private ranges
//       (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) are always allowed.
//       This covers docker scrapers and localhost health-checks.
//
// OPTIONS
//   CORS preflight — allows GET only.

import { NextRequest, NextResponse } from 'next/server'
import { metrics } from '@/lib/observability/metrics'

// Standard Prometheus exposition format content type.
const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8'

/**
 * P4-A: Check if the request IP is in an allowed range.
 * Allowed: loopback (127.0.0.1, ::1) and all private/RFC1918 ranges
 * (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). Covers docker host scrapers.
 */
function isIpAllowed(ip: string | null): boolean {
  if (!ip) return false
  const trimmed = ip.trim()
  if (trimmed === '127.0.0.1' || trimmed === '::1' || trimmed === 'localhost') return true
  // IPv4 dotted
  const m = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const o1 = parseInt(m[1], 10)
    const o2 = parseInt(m[2], 10)
    if (o1 === 10) return true               // 10.0.0.0/8
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true  // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true // 192.168.0.0/16
    return false
  }
  // IPv6 ::ffff:127.0.0.1 etc.
  if (trimmed.toLowerCase().startsWith('::ffff:')) {
    return isIpAllowed(trimmed.slice(7))
  }
  // fc00::/7 unique-local, link-local fe80::/10 — treat as private
  if (/^f[cd][0-9a-f]{2}:/i.test(trimmed)) return true
  if (/^fe[89ab][0-9a-f]:/i.test(trimmed)) return true
  return false
}

/**
 * P4-A: Extract client IP from request. Falls back through common
 * proxy headers (x-forwarded-for first entry, x-real-ip).
 */
function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri.trim()
  return null
}

/**
 * P4-A: Authorize the request. Returns true if either:
 *  - bearer token matches METRICS_TOKEN env var, OR
 *  - client IP is in the loopback/private whitelist.
 */
function authorizeMetrics(req: NextRequest): boolean {
  // (a) Bearer token
  const expectedToken = process.env.METRICS_TOKEN
  if (expectedToken) {
    const authz = req.headers.get('authorization') || ''
    if (authz.startsWith('Bearer ')) {
      const token = authz.slice(7).trim()
      if (token.length > 0 && token === expectedToken) return true
    }
  }
  // (b) IP whitelist (always applied — enables localhost + docker scrapers)
  return isIpAllowed(getClientIp(req))
}

/**
 * GET /api/v1/metrics — Prometheus text exposition format.
 *
 * Response time is typically < 50ms (in-memory Map iteration only).
 * The metrics registry auto-refreshes process-level gauges (uptime, memory)
 * before rendering.
 */
export async function GET(req: NextRequest) {
  // P4-A: auth gate
  if (!authorizeMetrics(req)) {
    return new NextResponse(
      '# Unauthorized. Provide a valid Bearer token or scrape from an allow-listed IP.\n',
      {
        status: 401,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'WWW-Authenticate': 'Bearer realm="plagiatia-metrics"',
          'Cache-Control': 'no-store',
        },
      }
    )
  }
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
