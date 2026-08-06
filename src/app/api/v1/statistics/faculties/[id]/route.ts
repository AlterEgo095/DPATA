// API v1 Faculty Statistics Endpoint
// Get statistics for a specific faculty
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// - `db.faculty.findUnique` (with `include: { departments }`) -> `db.faculties.find(...)` + `db.departments.filter(...)`
// - `db.document.count` / `groupBy` -> in-memory filter + group-by loops
// - `db.analysis.count` / `aggregate` (with `document: { facultyId }`) -> join via documents array
// - `db.user.count` / `groupBy` -> in-memory filter + group-by loops
// - `db.analysis.findMany` (with `document: { facultyId }`) -> join via documents array
// - `db.apiAccessLog.create` -> push to `db.apiAccessLogs` (auto-trim at 5000)
// API request/response shapes are unchanged; only the data access layer changed.

import { NextRequest } from 'next/server';
import {
  loadDB,
  saveDB,
  genId,
  now,
  type Analysis,
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
  jsonError,
  jsonNotFound
} from '@/lib/api/response/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================
// Response shape helpers
// ============================================================

interface DepartmentStat {
  id: string;
  name: string;
  documents: number;
  analyses: number;
}

interface RecentAnalysisItem {
  id: string;
  documentTitle: string;
  score: number | null;
  status: Analysis['status'];
  completedAt?: string;
}

interface FacultyStatsResponse {
  faculty: { id: string; name: string; code: string };
  generatedAt: string;
  documents: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  analyses: {
    total: number;
    completed: number;
    averagePlagiarismScore: number | null;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  departments: DepartmentStat[];
  recentAnalyses: RecentAnalysisItem[];
}

/**
 * GET /api/v1/statistics/faculties/[id] - Get faculty-specific statistics
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

  // Check read permission
  if (!authResult.apiKey.permissions.includes('read') && !authResult.apiKey.permissions.includes('admin')) {
    return jsonError(ErrorCodes.FORBIDDEN, 'Permissions insuffisantes. La permission "read" est requise.');
  }

  // Check key-specific rate limit
  const keyRateLimit = rateLimiter.checkApiKey(authResult.apiKey.id, authResult.apiKey.rateLimit);
  if (!keyRateLimit.allowed) {
    return createRateLimitResponse(keyRateLimit);
  }

  const { id: facultyId } = await params;

  try {
    const db = await loadDB();

    // Verify faculty exists
    const faculty = db.faculties.find((f) => f.id === facultyId);

    if (!faculty) {
      return jsonNotFound('Faculté', facultyId);
    }

    // Faculty's departments
    const facultyDepartments = db.departments.filter((d) => d.facultyId === facultyId);

    // All documents in this faculty
    const facultyDocs = db.documents.filter((d) => d.facultyId === facultyId);

    // Documents by status
    const documentsByStatus: Record<string, number> = {};
    for (const doc of facultyDocs) {
      documentsByStatus[doc.status] = (documentsByStatus[doc.status] || 0) + 1;
    }

    // Documents by type
    const documentsByType: Record<string, number> = {};
    for (const doc of facultyDocs) {
      documentsByType[doc.type] = (documentsByType[doc.type] || 0) + 1;
    }

    // All analyses whose document is in this faculty (manual join)
    const facultyDocIds = new Set(facultyDocs.map((d) => d.id));
    const facultyAnalyses: Analysis[] = db.analyses.filter((a) => facultyDocIds.has(a.documentId));

    const totalAnalyses = facultyAnalyses.length;

    // Completed analyses with non-null globalScore
    const completedAnalysesList = facultyAnalyses.filter(
      (a) => a.status === 'COMPLETED' && a.globalScore !== null && a.globalScore !== undefined
    );
    const completedAnalyses = completedAnalysesList.length;

    // Average plagiarism score
    const avgScore =
      completedAnalyses > 0
        ? completedAnalysesList.reduce((sum, a) => sum + (a.globalScore || 0), 0) / completedAnalyses
        : null;
    const averagePlagiarismScore = avgScore !== null ? Math.round(avgScore * 10000) / 100 : null;

    // Users in this faculty (active)
    const facultyUsers = db.users.filter((u) => u.facultyId === facultyId && u.isActive);
    const totalUsers = facultyUsers.length;
    const usersByRole: Record<string, number> = {};
    for (const u of facultyUsers) {
      usersByRole[u.role] = (usersByRole[u.role] || 0) + 1;
    }

    // Department-level stats
    const departmentStats: DepartmentStat[] = facultyDepartments.map((dept) => {
      const deptDocIds = new Set(
        db.documents.filter((d) => d.facultyId === facultyId && d.departmentId === dept.id).map((d) => d.id)
      );
      const docCount = deptDocIds.size;
      const analysisCount = db.analyses.filter(
        (a) => deptDocIds.has(a.documentId) && a.status === 'COMPLETED'
      ).length;
      return {
        id: dept.id,
        name: dept.name,
        documents: docCount,
        analyses: analysisCount,
      };
    });

    // Recent analyses (last 10, by completedAt desc — fall back to createdAt if null)
    const recentAnalyses: RecentAnalysisItem[] = facultyAnalyses
      .slice()
      .sort((a, b) => {
        const aT = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bT = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bT - aT;
      })
      .slice(0, 10)
      .map<RecentAnalysisItem>((a) => {
        const doc = db.documents.find((d) => d.id === a.documentId);
        return {
          id: a.id,
          documentTitle: doc ? doc.title : '',
          score: a.globalScore !== null && a.globalScore !== undefined
            ? Math.round(a.globalScore * 10000) / 100
            : null,
          status: a.status,
          completedAt: a.completedAt,
        };
      });

    // Build response object
    const facultyStats: FacultyStatsResponse = {
      faculty: {
        id: faculty.id,
        name: faculty.name,
        code: faculty.code,
      },

      generatedAt: new Date().toISOString(),

      documents: {
        total: facultyDocs.length,
        byStatus: documentsByStatus,
        byType: documentsByType,
      },

      analyses: {
        total: totalAnalyses,
        completed: completedAnalyses,
        averagePlagiarismScore,
      },

      users: {
        total: totalUsers,
        byRole: usersByRole,
      },

      departments: departmentStats,

      recentAnalyses,
    };

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    // Log API access
    await logApiAccess(authResult.apiKey.id, 'GET', `/v1/statistics/faculties/${facultyId}`, 200, Date.now() - startTime, ipAddress);

    const response = toNextResponse(apiSuccess(facultyStats));
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error fetching faculty statistics:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération des statistiques de la faculté.');
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
