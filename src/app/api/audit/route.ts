// GET /api/audit — Journal d'audit
// PHASE 2: Robustesse Backend - Pagination + Filtres Avancés
//
// P4-D D4: Enhanced to read from the append-only file (data/audit.log)
// via readAuditLogs(). Backward compat preserved:
//   - Same query params as before (search, action, entity, userId, dateFrom,
//     dateTo, sortBy, sortOrder, page, limit)
//   - Response shape extended (added `logs`, `total`, `limit`, `offset`,
//     `filters`) but the old `data` + `pagination` shape is preserved for
//     the dashboard stats caller.
//
// The endpoint falls back to db.auditLogs (recent cache) if the file is
// missing or empty — that way, the route still works immediately after
// deploy even before any new audit events are written.

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, type AuditLog } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getPaginationParams,
  createPaginatedResponse,
  filterBySearchTerm,
  sortArray,
} from '@/lib/pagination';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';
import { readAuditLogs, countAuditLogs, getAuditLogFileSize } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  try {
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
    const { searchParams } = new URL(req.url);
    
    // Pagination
    const pagination = getPaginationParams(searchParams);
    
    // Filters
    const searchTerm = searchParams.get('search') || undefined;
    const action = searchParams.get('action') || undefined;
    const entity = searchParams.get('entity') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const entityId = searchParams.get('entityId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    
    // Sort — default to createdAt desc.
    // NOTE: the existing dashboard caller passes sortBy=createdAt (matches
    // the AuditLog field name). We translate to the internal alias used by
    // readAuditLogs so both `createdAt` and `timestamp` work.
    const rawSortBy = searchParams.get('sortBy') || 'createdAt';
    const sortBy: 'createdAt' | 'userName' | 'action' =
      rawSortBy === 'userName' ? 'userName' :
      rawSortBy === 'action' ? 'action' : 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    // ---------------------------------------------------------------------
    // Source of truth: read from the append-only file (D1).
    // ---------------------------------------------------------------------
    const fileResult = await readAuditLogs({
      limit: pagination.limit,
      offset: pagination.offset,
      action,
      entity,
      userId,
      entityId,
      dateFrom,
      dateTo,
      search: searchTerm,
      sortBy,
      sortOrder,
    });

    let logs: AuditLog[] = fileResult.entries;
    let totalItems: number = fileResult.total;

    // ---------------------------------------------------------------------
    // Fallback: if the file is empty (e.g. fresh deploy with no events yet
    // since D1), use db.auditLogs as the source so the dashboard doesn't
    // show an empty list right after deploy.
    // ---------------------------------------------------------------------
    if (logs.length === 0 && (db.auditLogs?.length || 0) > 0) {
      let cached: AuditLog[] = [...(db.auditLogs || [])];

      if (searchTerm) {
        cached = filterBySearchTerm(
          cached as unknown as Record<string, unknown>[],
          searchTerm,
          ['userName', 'action', 'entity', 'entityId']
        ) as unknown as AuditLog[];
      }
      if (action) {
        // Match either uppercase ("LOGIN") or dotted ("auth.login").
        const actLower = action.toLowerCase();
        cached = cached.filter(log => (log.action || '').toLowerCase() === actLower);
      }
      if (entity) {
        const entLower = entity.toLowerCase();
        cached = cached.filter(log => (log.entity || '').toLowerCase() === entLower);
      }
      if (userId) {
        cached = cached.filter(log => log.userId === userId);
      }
      if (entityId) {
        cached = cached.filter(log => log.entityId === entityId);
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        cached = cached.filter(log => new Date(log.createdAt) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        cached = cached.filter(log => new Date(log.createdAt) <= to);
      }

      totalItems = cached.length;
      cached = sortArray(cached, sortBy === 'createdAt' ? 'createdAt' : sortBy, sortOrder);
      logs = cached.slice(pagination.offset, pagination.offset + pagination.limit);
    }

    // Create paginated response (preserves the `data` + `pagination` shape
    // expected by the dashboard).
    const result = createPaginatedResponse(logs, pagination, totalItems);

    // Add available filters metadata (from db.auditLogs cache — cheap).
    const actions = [...new Set(db.auditLogs?.map(l => l.action))].sort();
    const entities = [...new Set(db.auditLogs?.map(l => l.entity).filter(Boolean))] as string[];

    // File-based metrics (D1+D5).
    const fileTotal = await countAuditLogs();
    const fileSize = await getAuditLogFileSize();

    return NextResponse.json({
      ...result,
      // P4-D D4: new fields (additive — dashboard ignores unknown fields).
      logs,
      total: totalItems,
      limit: pagination.limit,
      offset: pagination.offset,
      filters: { action, entity, userId, entityId, dateFrom, dateTo, search: searchTerm },
      meta: {
        availableActions: actions,
        availableEntities: entities,
        totalLogs: db.auditLogs?.length || 0,
        // D1+D5 metrics
        fileTotalEntries: fileTotal,
        fileSizeBytes: fileSize,
        source: logs.length > 0 && fileResult.entries.length > 0 ? 'file' : 'cache',
      },
    }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
