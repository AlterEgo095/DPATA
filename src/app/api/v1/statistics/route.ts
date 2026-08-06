// API v1 Statistics Endpoint
// Read-only statistics endpoints for overview, trends, and faculty-specific stats
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// All Prisma calls translated to in-memory ops:
//   - `db.document.count`            -> `db.documents.filter(...).length`
//   - `db.document.groupBy`          -> group + count loop
//   - `db.analysis.count`            -> `db.analyses.filter(...).length`
//   - `db.analysis.groupBy`          -> group + count loop
//   - `db.analysis.aggregate`        -> filter + reduce
//   - `db.user.count` / `groupBy`    -> same patterns on `db.users`
//   - `db.faculty.count`             -> `db.faculties.filter(...).length`
//   - `db.department.count`          -> `db.departments.filter(...).length`
//   - `db.document.findMany`         -> filter + sort + slice + map (select)
//   - `db.apiAccessLog.create`       -> push to `db.apiAccessLogs` (auto-trim)
// API request/response shapes are unchanged; only the data access layer changed.

import { NextRequest } from 'next/server';
import {
  loadDB,
  saveDB,
  genId,
  now,
  type Document,
  type Analysis,
  type User,
} from '@/lib/store/db';
import {
  apiKeyAuth,
  extractApiKeyFromHeaders,
  extractIpAddress
} from '@/lib/api/auth/api-key-auth';
import { rateLimiter, addRateLimitHeaders, createRateLimitResponse } from '@/lib/api/middleware/rate-limiter';
import {
  toNextResponse,
  apiSuccess,
  apiError,
  ErrorCodes,
  HttpStatus,
  jsonError,
  jsonNotFound
} from '@/lib/api/response/api-response';
import { parseQueryParams, statisticsOverviewSchema, statisticsTrendsSchema } from '@/lib/api/validation/request-validator';

// ============================================================
// Response shape helpers
// ============================================================

interface RecentActivityItem {
  id: string;
  title: string;
  status: Document['status'];
  uploadedBy: string; // formatted "firstName lastName"
  createdAt: string;
}

interface OverviewResponse {
  period: string;
  generatedAt: string;
  documents: {
    total: number;
    byStatus: Record<string, number>;
  };
  analyses: {
    total: number;
    byStatus: Record<string, number>;
    averagePlagiarismScore: number | null;
    sampleSize: number;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  organization: {
    faculties: number;
    departments: number;
  };
  recentActivity: RecentActivityItem[];
}

/**
 * GET /api/v1/statistics/overview - Platform overview statistics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = extractIpAddress(request.headers);

  // Check IP-based rate limit
  const ipRateLimit = rateLimiter.checkIp(ipAddress);
  if (!ipRateLimit.allowed) {
    return createRateLimitResponse(ipRateLimit);
  }

  // Extract and validate API key
  const apiKey = extractApiKeyFromHeaders(request.headers);
  if (!apiKey) {
    return jsonError(ErrorCodes.MISSING_API_KEY, 'Clé API manquante.');
  }

  const authResult = await apiKeyAuth.validate(apiKey, ipAddress);
  if (!authResult.valid || !authResult.apiKey) {
    return jsonError(
      authResult.error?.code || ErrorCodes.INVALID_API_KEY,
      authResult.error?.message || 'Clé invalide'
    );
  }

  // Check read permission (statistics are read-only)
  if (!authResult.apiKey.permissions.includes('read') && !authResult.apiKey.permissions.includes('admin')) {
    return jsonError(ErrorCodes.FORBIDDEN, 'Permissions insuffisantes. La permission "read" est requise.');
  }

  // Check key-specific rate limit
  const keyRateLimit = rateLimiter.checkApiKey(authResult.apiKey.id, authResult.apiKey.rateLimit);
  if (!keyRateLimit.allowed) {
    return createRateLimitResponse(keyRateLimit);
  }

  // Parse query parameters
  const queryParams = parseQueryParams(statisticsOverviewSchema, request.nextUrl.searchParams);
  if (!queryParams.success) {
    return toNextResponse({ response: queryParams.error, status: HttpStatus.BAD_REQUEST });
  }

  const { period, facultyId } = queryParams.data;

  try {
    // Calculate date range based on period
    const nowDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(nowDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(nowDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(nowDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(nowDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(nowDate.getDate() - 30);
    }

    const startMs = startDate.getTime();

    const db = await loadDB();

    // ============================================================
    // Documents (filtered by createdAt >= startDate AND optional facultyId)
    // ============================================================
    const filteredDocs = db.documents.filter((doc) => {
      if (new Date(doc.createdAt).getTime() < startMs) return false;
      if (facultyId && doc.facultyId !== facultyId) return false;
      return true;
    });

    const totalDocuments = filteredDocs.length;

    // Group by status
    const documentsByStatus: Record<string, number> = {};
    for (const doc of filteredDocs) {
      documentsByStatus[doc.status] = (documentsByStatus[doc.status] || 0) + 1;
    }

    // ============================================================
    // Analyses (filtered by createdAt >= startDate; if facultyId set,
    // joined via the analysis's document's facultyId)
    // ============================================================
    const filteredAnalyses: Analysis[] = db.analyses.filter((anl) => {
      if (new Date(anl.createdAt).getTime() < startMs) return false;
      if (facultyId) {
        const doc = db.documents.find((d) => d.id === anl.documentId);
        if (!doc || doc.facultyId !== facultyId) return false;
      }
      return true;
    });

    const totalAnalyses = filteredAnalyses.length;

    const analysesByStatus: Record<string, number> = {};
    for (const anl of filteredAnalyses) {
      analysesByStatus[anl.status] = (analysesByStatus[anl.status] || 0) + 1;
    }

    // Average plagiarism score (from COMPLETED analyses with non-null globalScore)
    const scoredAnalyses = filteredAnalyses.filter(
      (anl) => anl.status === 'COMPLETED' && typeof anl.globalScore === 'number' && anl.globalScore !== null
    );
    const sampleSize = scoredAnalyses.length;
    const avgScore =
      sampleSize > 0
        ? scoredAnalyses.reduce((sum, anl) => sum + (anl.globalScore || 0), 0) / sampleSize
        : null;
    const averagePlagiarismScore =
      avgScore !== null ? Math.round(avgScore * 10000) / 100 : null;

    // ============================================================
    // Users (active only)
    // ============================================================
    const activeUsers = db.users.filter((u) => u.isActive);
    const totalUsers = activeUsers.length;
    const usersByRole: Record<string, number> = {};
    for (const u of activeUsers) {
      usersByRole[u.role] = (usersByRole[u.role] || 0) + 1;
    }

    // ============================================================
    // Organization counts
    // ============================================================
    const totalFaculties = db.faculties.filter((f) => f.isActive).length;
    const totalDepartments = db.departments.filter((d) => d.isActive).length;

    // ============================================================
    // Recent documents (last 10)
    // ============================================================
    const recentDocs = filteredDocs
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const recentActivity: RecentActivityItem[] = recentDocs.map((doc) => {
      const uploader = db.users.find((u) => u.id === doc.uploadedById);
      const uploadedBy = uploader ? `${uploader.firstName} ${uploader.lastName}` : '—';
      return {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        uploadedBy,
        createdAt: doc.createdAt,
      };
    });

    // ============================================================
    // Build response
    // ============================================================
    const overview: OverviewResponse = {
      period,
      generatedAt: new Date().toISOString(),

      documents: {
        total: totalDocuments,
        byStatus: documentsByStatus,
      },

      analyses: {
        total: totalAnalyses,
        byStatus: analysesByStatus,
        averagePlagiarismScore,
        sampleSize,
      },

      users: {
        total: totalUsers,
        byRole: usersByRole,
      },

      organization: {
        faculties: totalFaculties,
        departments: totalDepartments,
      },

      recentActivity,
    };

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    // Log API access
    await logApiAccess(authResult.apiKey.id, 'GET', '/v1/statistics/overview', 200, Date.now() - startTime, ipAddress);

    const response = toNextResponse(apiSuccess(overview));
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération des statistiques.');
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Helper function to log API access
// P2-A: Migrated from `db.apiAccessLog.create()` (Prisma) to JSON store push.
async function logApiAccess(
  apiKeyId: string,
  method: string,
  path: string,
  statusCode: number,
  responseTimeMs: number,
  ipAddress?: string,
  _error?: string
) {
  try {
    const db = await loadDB();
    if (!Array.isArray(db.apiAccessLogs)) {
      db.apiAccessLogs = [];
    }
    db.apiAccessLogs.push({
      id: genId('alog'),
      apiKeyId,
      method,
      path,
      statusCode,
      responseTimeMs,
      ipAddress: ipAddress || 'unknown',
      createdAt: now(),
    });
    if (db.apiAccessLogs.length > 5000) {
      db.apiAccessLogs = db.apiAccessLogs.slice(0, 5000);
    }
    await saveDB(db);
  } catch (e) {
    console.error('Failed to log API access:', e);
  }
}
