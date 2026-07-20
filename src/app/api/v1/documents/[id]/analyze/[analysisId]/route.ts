// API v1 Analysis Result Endpoint
// Get analysis results by analysis ID

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
  params: Promise<{ id: string; analysisId: string }>;
}

/**
 * GET /api/v1/documents/[id]/analyze/[analysisId] - Get analysis result
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

  // Check key-specific rate limit
  const keyRateLimit = rateLimiter.checkApiKey(authResult.apiKey.id, authResult.apiKey.rateLimit);
  if (!keyRateLimit.allowed) {
    return createRateLimitResponse(keyRateLimit);
  }

  const { id: documentId, analysisId } = await params;

  try {
    // Fetch analysis with details
    const analysis = await db.analysis.findUnique({
      where: { id: analysisId },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        matches: {
          orderBy: { semanticScore: 'desc' },
          take: 100,
          select: {
            id: true,
            querySegmentIndex: true,
            querySegmentText: true,
            sourceDocumentId: true,
            semanticScore: true,
            lexicalScore: true,
            matchType: true,
            sourceDocument: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        report: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    if (!analysis) {
      return jsonNotFound('Analyse', analysisId);
    }

    // Verify analysis belongs to specified document
    if (analysis.documentId !== documentId) {
      return jsonError(ErrorCodes.NOT_FOUND, 'Cette analyse n\'appartient pas au document spécifié.');
    }

    // Build response object
    const result = {
      id: analysis.id,
      documentId: analysis.documentId,
      documentTitle: analysis.document.title,
      status: analysis.status,
      
      // Scores (only if completed)
      ...(analysis.status === 'COMPLETED' && {
        globalScore: analysis.globalScore,
        plagiarismPercentage: Math.round((analysis.globalScore || 0) * 100),
        matchedSegments: analysis.matchedSegments,
        totalSegments: analysis.totalSegments,
      }),
      
      // Configuration
      threshold: analysis.threshold,
      scope: analysis.scope,
      
      // Timing
      startedAt: analysis.startedAt,
      completedAt: analysis.completedAt,
      durationMs: analysis.startedAt && analysis.completedAt 
        ? analysis.completedAt.getTime() - analysis.startedAt.getTime()
        : null,
      
      // Error info (if failed)
      ...(analysis.status === 'FAILED' && {
        error: analysis.error,
      }),
      
      // Top matches (if completed)
      ...(analysis.status === 'COMPLETED' && {
        matches: analysis.matches.map(match => ({
          id: match.id,
          segmentIndex: match.querySegmentIndex,
          segmentText: match.querySegmentText?.substring(0, 200) + (match.querySegmentText && match.querySegmentText.length > 200 ? '...' : ''),
          sourceDocumentId: match.sourceDocumentId,
          sourceDocumentTitle: match.sourceDocument.title,
          semanticScore: match.semanticScore,
          lexicalScore: match.lexicalScore,
          matchType: match.matchType,
        })),
        totalMatches: analysis._count?.matches || analysis.matches.length,
      }),
      
      // Report data (if available)
      ...(analysis.report && {
        hasReport: true,
        reportSummary: typeof analysis.report.content === 'string' 
          ? JSON.parse(analysis.report.content).summary || null
          : null,
      }),
      
      createdAt: analysis.createdAt,
    };

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    // Log API access
    await logApiAccess(authResult.apiKey.id, 'GET', `/v1/documents/${documentId}/analyze/${analysisId}`, 200, Date.now() - startTime, ipAddress);

    const response = toNextResponse(apiSuccess(result));
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error fetching analysis result:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération du résultat d\'analyse.');
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
