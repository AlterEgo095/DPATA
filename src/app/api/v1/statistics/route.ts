// API v1 Statistics Endpoint
// Read-only statistics endpoints for overview, trends, and faculty-specific stats

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
import { parseQueryParams, statisticsOverviewSchema, statisticsTrendsSchema } from '@/lib/api/validation/request-validator';

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
    return toNextResponse(queryParams.error as any);
  }

  const { period, facultyId } = queryParams.data;

  try {
    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Build base where clause
    const baseWhere: Record<string, any> = { createdAt: { gte: startDate } };
    if (facultyId) baseWhere.facultyId = facultyId;

    // Fetch all statistics in parallel
    const [
      totalDocuments,
      documentsByStatus,
      totalAnalyses,
      analysesByStatus,
      avgPlagiarismScore,
      totalUsers,
      usersByRole,
      totalFaculties,
      totalDepartments,
      recentDocuments,
    ] = await Promise.all([
      // Total documents count
      db.document.count({ where: baseWhere }),
      
      // Documents by status
      db.document.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { status: true },
      }),
      
      // Total analyses count
      db.analysis.count({ 
        where: { createdAt: { gte: startDate }, ...(facultyId ? { document: { facultyId } } : {}) }
      }),
      
      // Analyses by status
      db.analysis.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate } },
        _count: { status: true },
      }),
      
      // Average plagiarism score (from completed analyses)
      db.analysis.aggregate({
        where: { 
          status: 'COMPLETED', 
          globalScore: { not: null },
          createdAt: { gte: startDate }
        },
        _avg: { globalScore: true },
        _count: true,
      }),
      
      // Total users
      db.user.count({ where: { isActive: true } }),
      
      // Users by role
      db.user.groupBy({
        by: ['role'],
        where: { isActive: true },
        _count: { role: true },
      }),
      
      // Total faculties
      db.faculty.count({ where: { isActive: true } }),
      
      // Total departments
      db.department.count({ where: { isActive: true } }),
      
      // Recent documents (last 10)
      db.document.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          uploadedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    // Build response object
    const overview = {
      period,
      generatedAt: new Date().toISOString(),
      
      // Document statistics
      documents: {
        total: totalDocuments,
        byStatus: documentsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
      },
      
      // Analysis statistics
      analyses: {
        total: totalAnalyses,
        byStatus: analysesByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
        averagePlagiarismScore: avgPlagiarismScore._avg.globalScore 
          ? Math.round(avgPlagiarismScore._avg.globalScore * 10000) / 100 
          : null,
        sampleSize: avgPlagiarismScore._count,
      },
      
      // User statistics
      users: {
        total: totalUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = item._count.role;
          return acc;
        }, {} as Record<string, number>),
      },
      
      // Organization statistics
      organization: {
        faculties: totalFaculties,
        departments: totalDepartments,
      },
      
      // Recent activity
      recentActivity: recentDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        status: doc.status,
        uploadedBy: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
        createdAt: doc.createdAt,
      })),
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
