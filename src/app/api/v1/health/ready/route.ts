// app/api/v1/health/ready/route.ts — P3-C NEW: Kubernetes readiness probe
//
// GET /api/v1/health/ready
//   Returns 200 if the app is READY to serve traffic (DB loadable + uptime > 5s).
//   Returns 503 if the app is running but NOT ready (e.g. just started, DB corrupted).
//
// Checks performed:
//   1. JSON store can be loaded (calls loadDB() — if it throws, NOT ready).
//      This is the primary check because the app uses data/db.json at runtime.
//   2. Prisma status (informational only — does NOT affect readiness, since
//      JSON store is primary and Prisma has graceful fallback via Proxy stub).
//   3. Process uptime > 5 seconds (avoid routing to a freshly-started process
//      that may not have fully warmed caches / JIT-compiled hot paths).
//
// Response body (200):
//   {
//     "status": "ready",
//     "checks": { "jsonStore": "ok", "prisma": "ok|degraded", "uptime": "ok" },
//     "uptimeSeconds": 123,
//     "timestamp": "..."
//   }
//
// Response body (503):
//   {
//     "status": "not_ready",
//     "checks": { ... },
//     "reason": "json store load failed: <error>",
//     "timestamp": "..."
//   }
//
// Cache-Control: no-store.
// Response time should be < 100ms (loadDB is cached after first call).
//
// Additive endpoint — zero risk to existing routes.

import { NextResponse } from 'next/server'
import { loadDB } from '@/lib/store/db'
import { getPrismaStatus } from '@/lib/db'

// Avoid routing to a process that just started and may not be fully ready
// (cache warmup, JIT compilation, etc.). 5 seconds is the Kubernetes default
// `initialDelaySeconds` for readiness probes.
const MIN_READY_UPTIME_SECONDS = 5

interface ReadinessCheck {
  jsonStore: 'ok' | 'fail'
  prisma: 'ok' | 'degraded'
  uptime: 'ok' | 'not_ready'
}

interface ReadinessResponse {
  status: 'ready' | 'not_ready'
  checks: ReadinessCheck
  uptimeSeconds?: number
  reason?: string
  timestamp: string
}

/**
 * GET /api/v1/health/ready — readiness probe.
 */
export async function GET() {
  const startedAt = Date.now()
  const uptimeSeconds = Math.round(
    typeof process.uptime === 'function' ? process.uptime() : 0
  )

  // --- Check 1: JSON store loadable ---
  let jsonStoreStatus: 'ok' | 'fail' = 'ok'
  let jsonStoreError: string | null = null
  try {
    await loadDB()
  } catch (e: unknown) {
    jsonStoreStatus = 'fail'
    jsonStoreError = e instanceof Error ? e.message : String(e)
  }

  // --- Check 2: Prisma status (informational only) ---
  const prismaStatus = getPrismaStatus()
  const prismaCheck: 'ok' | 'degraded' = prismaStatus.available ? 'ok' : 'degraded'

  // --- Check 3: Uptime > 5s ---
  const uptimeCheck: 'ok' | 'not_ready' =
    uptimeSeconds >= MIN_READY_UPTIME_SECONDS ? 'ok' : 'not_ready'

  const checks: ReadinessCheck = {
    jsonStore: jsonStoreStatus,
    prisma: prismaCheck,
    uptime: uptimeCheck,
  }

  const responseTimeMs = Date.now() - startedAt

  // Readiness logic: JSON store MUST load. Uptime is a soft signal but
  // recommended (Kubernetes pattern). Prisma is informational only.
  if (jsonStoreStatus === 'ok' && uptimeCheck === 'ok') {
    const body: ReadinessResponse = {
      status: 'ready',
      checks,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
    }
    return NextResponse.json(body, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Response-Time': `${responseTimeMs}ms`,
      },
    })
  }

  // Not ready — compose a descriptive reason
  const reasons: string[] = []
  if (jsonStoreStatus === 'fail') {
    reasons.push(`json store load failed: ${jsonStoreError || 'unknown error'}`)
  }
  if (uptimeCheck === 'not_ready') {
    reasons.push(
      `process uptime ${uptimeSeconds}s < ${MIN_READY_UPTIME_SECONDS}s threshold`
    )
  }
  const reason = reasons.join('; ') || 'unknown readiness failure'

  const body: ReadinessResponse = {
    status: 'not_ready',
    checks,
    uptimeSeconds,
    reason,
    timestamp: new Date().toISOString(),
  }
  return NextResponse.json(body, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'X-Response-Time': `${responseTimeMs}ms`,
    },
  })
}

/**
 * OPTIONS /api/v1/health/ready — CORS preflight.
 * Allows GET only.
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
