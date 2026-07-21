// API v1 Analyze Endpoint
// Trigger plagiarism analysis for a document

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
  apiCreated,
  ErrorCodes,
  jsonError,
  jsonNotFound
} from '@/lib/api/response/api-response';
import { parseJsonBody, createAnalysisSchema } from '@/lib/api/validation/request-validator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/documents/[id]/analyze - Trigger analysis
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  // Check write permission
  if (!authResult.apiKey.permissions.includes('write') && !authResult.apiKey.permissions.includes('admin')) {
    return jsonError(ErrorCodes.FORBIDDEN, 'Permissions insuffisantes. La permission "write" est requise.');
  }

  // Check stricter rate limit for analyze endpoint
  const keyRateLimit = rateLimiter.checkApiKey(authResult.apiKey.id, Math.min(authResult.apiKey.rateLimit, 50));
  if (!keyRateLimit.allowed) {
    return createRateLimitResponse(keyRateLimit);
  }

  // Get document ID from params
  const { id: documentId } = await params;

  try {
    // Check if document exists
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, status: true, textExtract: true },
    });

    if (!document) {
      return jsonNotFound('Document', documentId);
    }

    // Parse and validate body
    const bodyResult = await parseJsonBody(createAnalysisSchema, request);
    if (!bodyResult.success) {
      return toNextResponse(bodyResult.error as any);
    }

    const config = bodyResult.data;

    // Check if there's already a running analysis
    const runningAnalysis = await db.analysis.findFirst({
      where: {
        documentId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (runningAnalysis) {
      return jsonError(ErrorCodes.CONFLICT, 'Une analyse est déjà en cours pour ce document.', {
        analysisId: runningAnalysis.id,
        status: runningAnalysis.status,
      });
    }

    // Create analysis record
    const analysis = await db.analysis.create({
      data: {
        documentId,
        triggeredById: authResult.apiKey.createdBy, // Use API key creator as triggerer
        status: 'PENDING',
        threshold: config.threshold,
        scope: config.scope,
      },
      select: {
        id: true,
        documentId: true,
        status: true,
        threshold: true,
        scope: true,
        createdAt: true,
      },
    });

    // TODO: Trigger actual analysis job (queue it for background processing)
    // This would typically involve adding to a job queue or triggering a background service

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    // Log API access
    await logApiAccess(authResult.apiKey.id, 'POST', `/v1/documents/${documentId}/analyze`, 201, Date.now() - startTime, ipAddress);

    const response = toNextResponse(apiCreated({
      ...analysis,
      message: 'Analyse mise en file d\'attente. Utilisez l\'endpoint GET /v1/documents/{id}/analyze/{analysisId} pour suivre le progrès.',
      estimatedTime: '2-5 minutes',
    }));
    
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error creating analysis:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors du lancement de l\'analyse.');
  }
}

/**
 * GET /api/v1/documents/[id]/analyze - List analyses for a document
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

  const { id: documentId } = await params;

  try {
    // Verify document exists
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true },
    });

    if (!document) {
      return jsonNotFound('Document', documentId);
    }

    // Get all analyses for this document
    const analyses = await db.analysis.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        globalScore: true,
        matchedSegments: true,
        totalSegments: true,
        threshold: true,
        scope: true,
        startedAt: true,
        completedAt: true,
        error: true,
        createdAt: true,
        _count: {
          select: { matches: true },
        },
      },
    });

    // Increment usage
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    const response = toNextResponse(apiSuccess(analyses));
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error fetching analyses:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération des analyses.');
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
