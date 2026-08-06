// =============================================================================
// P4-D D3: GET /api/audit/export — Export the full audit log as CSV or JSON.
// =============================================================================
//
// SUPER_ADMIN only.
//
// Query params:
//   format     csv | json (default: json)
//   action     filter by action (case-insensitive)
//   entity     filter by entity type
//   userId     filter by actor
//   entityId   filter by entity ID
//   dateFrom   ISO date string (inclusive)
//   dateTo     ISO date string (inclusive)
//   search     free-text search across userName/action/entity/details/ip
//   limit      default 10000, max 50000
//   sortBy     createdAt (default) | userName | action
//   sortOrder  desc (default) | asc
//
// Response:
//   - JSON: Content-Type: application/json, Content-Disposition: attachment
//   - CSV:  Content-Type: text/csv, Content-Disposition: attachment
//
// Streaming: for results > 1000 entries, we use a ReadableStream so the
// response is sent progressively (avoiding a single 50MB JSON.stringify).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';
import { readAuditLogs } from '@/lib/audit-log';
import { getRequestMeta } from '@/lib/request-meta';
import { audit, loadDB } from '@/lib/store/db';

type ExportFormat = 'csv' | 'json';

const CSV_COLUMNS: (keyof import('@/lib/store/db').AuditLog)[] = [
  'createdAt',
  'userId',
  'userName',
  'action',
  'entity',
  'entityId',
  'ipAddress',
  'userAgent',
  'method',
  'path',
  'details',
  'before',
  'after',
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (typeof value === 'string') {
    s = value;
  } else {
    try { s = JSON.stringify(value); } catch { s = String(value); }
  }
  // Escape embedded double-quotes by doubling them, then wrap in quotes.
  return `"${s.replace(/"/g, '""')}"`;
}

function buildCsv(entries: import('@/lib/store/db').AuditLog[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = entries.map(e =>
    CSV_COLUMNS.map(col => csvEscape((e as any)[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

function buildJson(entries: import('@/lib/store/db').AuditLog[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  }, null, 2);
}

function getFilename(format: ExportFormat): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `audit-${ts}.${format}`;
}

export async function GET(req: NextRequest) {
  let user: import('@/lib/auth/jwt').JWTPayload | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

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

  try {
    const { searchParams } = new URL(req.url);

    const format: ExportFormat =
      (searchParams.get('format') || 'json').toLowerCase() === 'csv' ? 'csv' : 'json';

    const action = searchParams.get('action') || undefined;
    const entity = searchParams.get('entity') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const entityId = searchParams.get('entityId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const search = searchParams.get('search') || undefined;

    const rawLimit = parseInt(searchParams.get('limit') || '10000', 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 10000 : rawLimit, 50000));

    const rawSortBy = searchParams.get('sortBy') || 'createdAt';
    const sortBy: 'createdAt' | 'userName' | 'action' =
      rawSortBy === 'userName' ? 'userName' :
      rawSortBy === 'action' ? 'action' : 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const { entries, total } = await readAuditLogs({
      limit,
      offset: 0,
      action,
      entity,
      userId,
      entityId,
      dateFrom,
      dateTo,
      search,
      sortBy,
      sortOrder,
    });

    const filename = getFilename(format);
    const securityHeaders = getSecurityHeaders();

    // P4-D D6: audit the export itself (paradox fix from AUDIT-4 §6.5).
    const { ip, userAgent } = getRequestMeta(req);
    const db = await loadDB();
    const retentionDays =
      parseInt((db.settings as any)?.auditLogRetentionDays as string, 10) || 90;
    try {
      await audit(
        user.sub,
        `${user.firstName} ${user.lastName}`,
        'AUDIT_EXPORT',
        'AuditLog',
        undefined,
        { format, count: entries.length, totalAvailable: total, filters: { action, entity, userId, entityId, dateFrom, dateTo } },
        ip,
        { userAgent, method: 'GET', path: '/api/audit/export' }
      );
    } catch {
      // audit failure must not block the export
    }

    if (format === 'csv') {
      const csv = buildCsv(entries);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          ...securityHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // JSON — for large exports, stream the response.
    if (entries.length > 1000) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Header
          controller.enqueue(encoder.encode('{\n'));
          controller.enqueue(
            encoder.encode(`  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n`)
          );
          controller.enqueue(encoder.encode(`  "count": ${entries.length},\n`));
          controller.enqueue(encoder.encode(`  "retentionDays": ${retentionDays},\n`));
          controller.enqueue(encoder.encode('  "entries": [\n'));
          for (let i = 0; i < entries.length; i++) {
            const prefix = i === entries.length - 1 ? '' : ',';
            controller.enqueue(
              encoder.encode('    ' + JSON.stringify(entries[i]) + prefix + '\n')
            );
          }
          controller.enqueue(encoder.encode('  ]\n}\n'));
          controller.close();
        },
      });
      return new NextResponse(stream, {
        status: 200,
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const json = buildJson(entries);
    return new NextResponse(json, {
      status: 200,
      headers: {
        ...securityHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

// CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
