// =============================================================================
// P4-D D2: Request metadata extraction helper.
// =============================================================================
//
// Used by mutation routes to capture IP + User-Agent for audit log entries.
// Reads `x-forwarded-for` (Nginx), `x-real-ip` (alt), or `remoteAddr` as
// fallback. Reads `user-agent` for UA. Returns plain strings — never throws.
//
// Usage in a route:
//   import { getRequestMeta } from '@/lib/request-meta';
//   const { ip, userAgent } = getRequestMeta(req);
//   await audit(user.sub, name, 'ACTION', 'Entity', id, details, ip, {
//     userAgent,
//     before: oldRecord,
//     after: newRecord,
//     method: 'PUT',
//     path: '/api/foo',
//   });
// =============================================================================

import type { NextRequest } from 'next/server';

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

/**
 * Extract IP address and User-Agent from a Next.js Request.
 *
 * IP resolution order:
 *   1. `x-forwarded-for` (first IP, comma-separated list — Nginx standard)
 *   2. `x-real-ip` (alternative set by some proxies)
 *   3. `cf-connecting-ip` (Cloudflare)
 *   4. literal string 'unknown' if none match
 *
 * UA resolution: reads `user-agent` header, defaults to 'unknown' if missing.
 */
export function getRequestMeta(req: Request | NextRequest): RequestMeta {
  const headers = req.headers;

  let ip: string =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('cf-connecting-ip')?.trim() ||
    'unknown';

  // Sanity-check IPv4/IPv6/host format — if it contains weird control chars,
  // fall back to 'unknown'. (We keep it simple — no full validation.)
  if (ip.length > 100 || /[\r\n\t]/.test(ip)) {
    ip = 'unknown';
  }

  const userAgent: string = headers.get('user-agent')?.slice(0, 512) || 'unknown';

  return { ip, userAgent };
}

/**
 * Get the audit log retention setting (in days) from db.settings.
 *
 * Defaults to 90 days if not configured. Reads `auditLogRetentionDays` from
 * the settings object (set by /api/admin/settings PUT). Returns 90 if the
 * setting is missing or unparseable.
 *
 * NOTE: This function is intentionally NOT exported via the store/db.ts
 * module to avoid a circular import (audit-log.ts -> store/db.ts -> ...).
 * Routes that need the retention value (e.g. instrumentation hook) should
 * import it from here, OR read it directly from db.settings.
 */
export const DEFAULT_AUDIT_RETENTION_DAYS = 90;
