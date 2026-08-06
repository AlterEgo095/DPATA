// app/api/admin/sessions/route.ts — P4-C NEW: active-sessions listing
//
// GET /api/admin/sessions
//   SUPER_ADMIN only
//   Returns an approximation of active user sessions, derived from the
//   audit log. The current PlagiatIA auth model is stateless JWT — there
//   is no `sessions` table. Until P4-A adds a real sessions table with
//   tokenId tracking, we approximate "active session" as:
//     "user has audited activity in the last 30 minutes"
//
// Response shape:
//   {
//     "sessions": [
//       {
//         "userId": "...",
//         "userName": "...",
//         "userRole": "...",
//         "lastActivity": "2025-01-XX HH:MM:SS",
//         "ip": "...",
//         "userAgent": "",
//         "active": true
//       }
//     ],
//     "total": N
//   }
//
// Implementation notes:
//   - Source: db.auditLogs (last 24h).
//   - Group by userId, take most recent entry per user.
//   - active = lastActivity within last 30 min.
//   - IP extracted from audit log entry if present.
//   - userAgent: audit log doesn't currently store this (P4-D may add it);
//     we return empty string as a placeholder.
//   - Role: looked up from db.users (audit log only stores userName).
//
// Cache-Control: no-store.

import { NextResponse } from 'next/server';
import { loadDB, type AuditLog, type User } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

interface SessionEntry {
  userId: string;
  userName: string;
  userRole: string;
  lastActivity: string;
  ip: string;
  userAgent: string;
  active: boolean;
}

interface SessionsResponse {
  sessions: SessionEntry[];
  total: number;
  generatedAt: string;
}

const ACTIVE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const LOOKBACK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Format an ISO timestamp as "YYYY-MM-DD HH:MM:SS" for display.
 * Falls back to the raw ISO string if parsing fails.
 */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
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
    const users = db.users || [];

    // Build a quick lookup map: userId -> User
    const userMap = new Map<string, User>();
    for (const u of users) userMap.set(u.id, u);

    // Group audit logs by userId, keeping the most recent entry per user
    // (audit logs are stored unshift-ed so the most recent are first).
    const cutoff = Date.now() - LOOKBACK_WINDOW_MS;
    const latestByUser = new Map<string, AuditLog>();

    for (const log of auditLogs) {
      if (!log.userId) continue;
      try {
        const ts = new Date(log.createdAt).getTime();
        if (ts < cutoff) continue; // outside 24h window
      } catch {
        continue;
      }
      // First encounter is the most recent (array is reverse-chronological).
      if (!latestByUser.has(log.userId)) {
        latestByUser.set(log.userId, log);
      }
    }

    // Build session entries.
    const now = Date.now();
    const sessions: SessionEntry[] = [];
    for (const [userId, log] of latestByUser.entries()) {
      const userRecord = userMap.get(userId);
      let active = false;
      try {
        const ts = new Date(log.createdAt).getTime();
        active = (now - ts) < ACTIVE_WINDOW_MS;
      } catch {
        active = false;
      }
      sessions.push({
        userId,
        userName: log.userName || userRecord?.email || 'unknown',
        userRole: userRecord?.role || 'UNKNOWN',
        lastActivity: formatTimestamp(log.createdAt),
        ip: log.ipAddress || '',
        userAgent: '', // P4-D may add this to audit log entries
        active,
      });
    }

    // Sort: active first, then by most recent activity.
    sessions.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    const response: SessionsResponse = {
      sessions,
      total: sessions.length,
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
 * OPTIONS /api/admin/sessions — CORS preflight.
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
