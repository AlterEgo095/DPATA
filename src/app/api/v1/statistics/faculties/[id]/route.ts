// API v1 Faculty Statistics Endpoint
// Get statistics for a specific faculty

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
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
    // Verify faculty exists
    const faculty = await db.faculty.findUnique({
      where: { id: facultyId },
      include: {
        departments: {
          select: { id: true, name: true },
        },
      },
    });

    if (!faculty) {
      return jsonNotFound('Faculté', facultyId);
    }

    // Fetch all statistics for this faculty in parallel
    const [
      totalDocuments,
      documentsByStatus,
      documentsByType,
      totalAnalyses,
      completedAnalyses,
      avgPlagiarismScore,
      totalUsers,
      usersByRole,
      departmentStats,
      recentAnalyses,
    ] = await Promise.all([
      // Total documents
      db.document.count({ where: { facultyId } }),
      
      // Documents by status
      db.document.groupBy({
        by: ['status'],
        where: { facultyId },
        _count: { status: true },
      }),
      
      // Documents by type
      db.document.groupBy({
        by: ['type'],
        where: { facultyId },
        _count: { type: true },
      }),
      
      // Total analyses (via documents)
      db.analysis.count({
        where: { document: { facultyId } },
      }),
      
      // Completed analyses with scores
      db.analysis.count({
        where: {
          document: { facultyId },
          status: 'COMPLETED',
          globalScore: { not: null },
        },
      }),
      
      // Average plagiarism score
      db.analysis.aggregate({
        where: {
          document: { facultyId },
          status: 'COMPLETED',
          globalScore: { not: null },
        },
        _avg: { globalScore: true },
      }),
      
      // Users in this faculty
      db.user.count({ where: { facultyId, isActive: true } }),
      
      // Users by role
      db.user.groupBy({
        by: ['role'],
        where: { facultyId, isActive: true },
        _count: { role: true },
      }),
      
      // Department-level stats
      Promise.all(
        faculty.departments.map(async (dept) => {
          const [docCount, analysisCount] = await Promise.all([
            db.document.count({ where: { facultyId, departmentId: dept.id } }),
            db.analysis.count({ where: { document: { facultyId, departmentId: dept.id }, status: 'COMPLETED' } }),
          ]);
          return {
            id: dept.id,
            name: dept.name,
            documents: docCount,
            analyses: analysisCount,
          };
        })
      ),
      
      // Recent analyses (last 10)
      db.analysis.findMany({
        where: { document: { facultyId } },
        orderBy: { completedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          globalScore: true,
          status: true,
          completedAt: true,
          document: { select: { id: true, title: true } },
        },
      }),
    ]);

    // Build response object
    const facultyStats = {
      faculty: {
        id: faculty.id,
        name: faculty.name,
        code: faculty.code,
      },
      
      generatedAt: new Date().toISOString(),
      
      // Document statistics
      documents: {
        total: totalDocuments,
        byStatus: documentsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
        byType: documentsByType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {} as Record<string, number>),
      },
      
      // Analysis statistics
      analyses: {
        total: totalAnalyses,
        completed: completedAnalyses,
        averagePlagiarismScore: avgPlagiarismScore._avg.globalScore
          ? Math.round(avgPlagiarismScore._avg.globalScore * 10000) / 100
          : null,
      },
      
      // User statistics
      users: {
        total: totalUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = item._count.role;
          return acc;
        }, {} as Record<string, number>),
      },
      
      // Department breakdown
      departments: departmentStats,
      
      // Recent activity
      recentAnalyses: recentAnalyses.map(analysis => ({
        id: analysis.id,
        documentTitle: analysis.document.title,
        score: analysis.globalScore ? Math.round(analysis.globalScore * 10000) / 100 : null,
        status: analysis.status,
        completedAt: analysis.completedAt,
      })),
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
async function logApiAccess(
  apiKeyId: string,
  method: string,
  path: string,
  statusCode: number,
  responseTimeMs: number,
  ipAddress?: string,
  error?: string
) {
  try {
    await db.apiAccessLog.create({
      data: {
        apiKeyId,
        method,
        path,
        statusCode,
        responseTimeMs,
        ipAddress,
        requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`,
        error,
      },
    });
  } catch (e) {
    console.error('Failed to log API access:', e);
  }
}
