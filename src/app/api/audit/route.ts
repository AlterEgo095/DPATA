// GET /api/audit — Journal d'audit
// PHASE 2: Robustesse Backend - Pagination + Filtres Avancés

import { NextRequest, NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getPaginationParams,
  createPaginatedResponse,
  filterBySearchTerm,
  sortArray,
} from '@/lib/pagination';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';

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
    const searchTerm = searchParams.get('search');
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Sort
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    let logs = [...(db.auditLogs || [])];

    // Apply filters
    if (searchTerm) {
      logs = filterBySearchTerm(logs, searchTerm, ['userName', 'action', 'entity', 'entityId']);
    }
    
    if (action) {
      logs = logs.filter(log => log.action === action.toUpperCase());
    }
    
    if (entity) {
      logs = logs.filter(log => log.entity?.toLowerCase() === entity.toLowerCase());
    }
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    
    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      logs = logs.filter(log => new Date(log.createdAt) >= from);
    }
    
    if (dateTo) {
      const to = new Date(dateTo);
      logs = logs.filter(log => new Date(log.createdAt) <= to);
    }

    // Get total before pagination
    const totalItems = logs.length;

    // Sort
    logs = sortArray(logs, sortBy, sortOrder);

    // Create paginated response
    const result = createPaginatedResponse(logs, pagination, totalItems);

    // Add available filters metadata
    const actions = [...new Set(db.auditLogs?.map(l => l.action))].sort();
    const entities = [...new Set(db.auditLogs?.map(l => l.entity).filter(Boolean))] as string[];

    return NextResponse.json({
      ...result,
      meta: {
        availableActions: actions,
        availableEntities: entities,
        totalLogs: db.auditLogs?.length || 0,
      },
      filters: { action, entity, userId, dateFrom, dateTo },
    }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
