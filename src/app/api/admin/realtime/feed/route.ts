// app/api/admin/realtime/feed/route.ts — P4-C NEW: real-time supervision feed
//
// GET /api/admin/realtime/feed
//   SUPER_ADMIN only
//   Returns the last 100 audit-log events + live system stats for the admin
//   real-time supervision cockpit.
//
// Response shape:
//   {
//     "events": [
//       { "id","type","timestamp","actor","target","ip","details" }, ...
//     ],
//     "stats": {
//       "activeUsers": 3,
//       "requestsLastMin": 142,
//       "errorsLastHour": 2,
//       "queueDepth": 0
//     }
//   }
//
// Cache-Control: no-store (always fresh).
//
// Implementation notes:
//   - Events sourced from db.auditLogs (reverse chronological, capped at 100).
//   - activeUsers from metrics.getActiveUserCount() (last 5 min window).
//   - requestsLastMin approximated as total http_requests_total / uptime_min.
//     A true per-minute counter would require time-bucketed storage which
//     the current in-memory metrics library does not support. The
//     approximation is reasonable for steady-state traffic and avoids
//     adding a new bucketed data structure.
//   - errorsLastHour: count of audit log entries whose action ends with
//     `.error` or `.fail` in the last 60 minutes. Falls back to 0 if no
//     such entries exist (the current codebase doesn't audit errors to
//     db.auditLogs, so this is a forward-compatible counter).
//   - queueDepth: count of db.batchJobs with status 'pending' or 'running'.
//
// Audit: not audited (read-only endpoint, would create noise).

import { NextResponse } from 'next/server';
import { loadDB, type AuditLog } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { metrics } from '@/lib/observability/metrics';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

interface FeedEvent {
  id: string;
  type: string;
  timestamp: string;
  actor: string;
  target: string;
  ip: string;
  details: string;
}

interface FeedStats {
  activeUsers: number;
  requestsLastMin: number;
  errorsLastHour: number;
  queueDepth: number;
}

interface FeedResponse {
  events: FeedEvent[];
  stats: FeedStats;
  generatedAt: string;
}

/**
 * Map an AuditLog entry to the FeedEvent shape expected by the admin UI.
 * Falls back to empty strings for missing fields so the UI never crashes.
 */
function toFeedEvent(log: AuditLog): FeedEvent {
  return {
    id: log.id,
    type: log.action || 'UNKNOWN',
    timestamp: log.createdAt,
    actor: log.userName || log.userId || 'system',
    target: log.entityId ? `${log.entity || 'unknown'}:${log.entityId}` : (log.entity || ''),
    ip: log.ipAddress || '',
    details: log.details || '',
  };
}

/**
 * Approximate the per-minute request rate from cumulative counters.
 *
 * The metrics library only stores cumulative counters (no time buckets), so
 * we compute `total_requests / uptime_minutes` as a steady-state estimate.
 * This is accurate for stable traffic and avoids the memory overhead of
 * bucketed storage.
 */
function approximateRequestsLastMin(): number {
  try {
    const totalRequests = metrics.getCounterTotal('http_requests_total');
    const uptimeSeconds = typeof process.uptime === 'function' ? process.uptime() : 0;
    if (uptimeSeconds < 60) {
      // Process just started — return the raw count to avoid divide-by-zero.
      return totalRequests;
    }
    const uptimeMinutes = uptimeSeconds / 60;
    return Math.round(totalRequests / uptimeMinutes);
  } catch {
    return 0;
  }
}

/**
 * Count errors in the last hour from the audit log.
 *
 * Looks for audit entries whose action ends with `.error`, `.fail`,
 * `_FAILURE`, or `_ERROR`. The current codebase doesn't audit these
 * (errors are written to pm2-error.log only), so this is a forward-
 * compatible counter that will start working as soon as error-auditing
 * is added in a future task.
 */
function countErrorsLastHour(auditLogs: AuditLog[]): number {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let count = 0;
  for (const log of auditLogs) {
    try {
      const ts = new Date(log.createdAt).getTime();
      if (ts < oneHourAgo) continue; // outside window
      const action = (log.action || '').toUpperCase();
      if (
        action.endsWith('.ERROR') ||
        action.endsWith('.FAIL') ||
        action.endsWith('_FAILURE') ||
        action.endsWith('_ERROR')
      ) {
        count++;
      }
    } catch {
      // skip malformed timestamps
    }
  }
  return count;
}

/**
 * Count pending/running batch jobs as the queue-depth proxy.
 */
function countQueueDepth(batchJobs: { status: string }[] | undefined): number {
  if (!Array.isArray(batchJobs)) return 0;
  return batchJobs.filter(j => j.status === 'pending' || j.status === 'running').length;
}

export async function GET() {
  try {
    // RBAC: SUPER_ADMIN only.
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    const db = await loadDB();
    const auditLogs = db.auditLogs || [];

    // Last 100 events (audit logs are stored unshift-ed, so the most recent
    // entries are at the front of the array).
    const recentLogs = auditLogs.slice(0, 100);
    const events = recentLogs.map(toFeedEvent);

    // Compute live stats.
    const stats: FeedStats = {
      activeUsers: metrics.getActiveUserCount(),
      requestsLastMin: approximateRequestsLastMin(),
      errorsLastHour: countErrorsLastHour(auditLogs),
      queueDepth: countQueueDepth(db.batchJobs),
    };

    const response: FeedResponse = {
      events,
      stats,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...getSecurityHeaders(),
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

/**
 * OPTIONS /api/admin/realtime/feed — CORS preflight.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
  });
}
