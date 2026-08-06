// app/api/v1/health/live/route.ts — P3-C NEW: Kubernetes liveness probe
//
// GET /api/v1/health/live
//   Returns 200 {"status":"alive","timestamp":"..."} if the Node.js process
//   is responsive enough to handle this request.
//
// This is the SIMPLEST possible check — confirms only that the event loop
// is processing requests. NO database calls, NO external API calls, NO disk
// I/O. Must return in < 5ms (typical: < 1ms).
//
// Used by PM2 / load balancer / Kubernetes to know if the process should be
// restarted. If this endpoint times out or returns non-200, the process is
// considered dead-locked and should be killed.
//
// Contrast with /api/v1/health/ready which checks if the app is ready to
// serve traffic (DB loadable, uptime > 5s).
//
// Cache-Control: no-store (do not cache liveness probes).
//
// Additive endpoint — zero risk to existing routes.

import { NextResponse } from 'next/server'

/**
 * GET /api/v1/health/live — liveness probe.
 *
 * If this function executes and returns, the process is alive.
 * No try/catch needed — there is nothing that can throw.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

/**
 * OPTIONS /api/v1/health/live — CORS preflight.
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
