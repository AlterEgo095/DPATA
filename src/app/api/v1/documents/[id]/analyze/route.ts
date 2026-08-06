// API v1 Analyze Endpoint
// Trigger plagiarism analysis for a document
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// - `db.document.findUnique` -> `db.documents.find(...)`
// - `db.analysis.findFirst`  -> `db.analyses.find(...)`
// - `db.analysis.create`     -> `db.analyses.push(...)` + `saveDB(db)`
// - `db.analysis.findMany`   -> `db.analyses.filter(...).sort(...).slice(...)`
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
  apiCreated,
  ErrorCodes,
  HttpStatus,
  jsonError,
  jsonNotFound
} from '@/lib/api/response/api-response';
import { parseJsonBody, createAnalysisSchema } from '@/lib/api/validation/request-validator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================
// Response shape helpers
// ============================================================

interface CreatedAnalysisProjection {
  id: string;
  documentId: string;
  status: Analysis['status'];
  threshold: number;
  scope: string;
  createdAt: string;
}

interface AnalysisListItem {
  id: string;
  status: Analysis['status'];
  globalScore?: number;
  matchedSegments?: number;
  totalSegments?: number;
  threshold: number;
  scope: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
  _count: { matches: number };
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
    const db = await loadDB();

    // Check if document exists
    const document = db.documents.find((d) => d.id === documentId);
    if (!document) {
      return jsonNotFound('Document', documentId);
    }

    // Parse and validate body
    const bodyResult = await parseJsonBody(createAnalysisSchema, request);
    if (!bodyResult.success) {
      return toNextResponse({ response: bodyResult.error, status: HttpStatus.BAD_REQUEST });
    }

    const config = bodyResult.data;

    // Check if there's already a running analysis
    const runningAnalysis = db.analyses.find(
      (a) => a.documentId === documentId && (a.status === 'PENDING' || a.status === 'RUNNING')
    );

    if (runningAnalysis) {
      return jsonError(ErrorCodes.CONFLICT, 'Une analyse est déjà en cours pour ce document.', {
        details: {
          analysisId: runningAnalysis.id,
          status: runningAnalysis.status,
        },
      });
    }

    // Create analysis record (push + save)
    const newAnalysis: Analysis = {
      id: genId('anl'),
      documentId,
      triggeredById: authResult.apiKey.createdBy, // Use API key creator as triggerer
      status: 'PENDING',
      threshold: config.threshold,
      scope: config.scope,
      createdAt: now(),
    };

    db.analyses.push(newAnalysis);
    await saveDB(db);

    // Build response projection (matches original Prisma `select`)
    const analysis: CreatedAnalysisProjection = {
      id: newAnalysis.id,
      documentId: newAnalysis.documentId,
      status: newAnalysis.status,
      threshold: newAnalysis.threshold,
      scope: newAnalysis.scope,
      createdAt: newAnalysis.createdAt,
    };

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
    const db = await loadDB();

    // Verify document exists
    const document = db.documents.find((d) => d.id === documentId);
    if (!document) {
      return jsonNotFound('Document', documentId);
    }

    // Get all analyses for this document (last 50, by createdAt desc)
    const analyses: AnalysisListItem[] = db.analyses
      .filter((a) => a.documentId === documentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
      .map<AnalysisListItem>((a) => {
        const matchCount = db.matches.filter((m) => m.analysisId === a.id).length;
        return {
          id: a.id,
          status: a.status,
          globalScore: a.globalScore,
          matchedSegments: a.matchedSegments,
          totalSegments: a.totalSegments,
          threshold: a.threshold,
          scope: a.scope,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          error: a.error,
          createdAt: a.createdAt,
          _count: { matches: matchCount },
        };
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
// P2-A: Migrated from `db.apiAccessLog.create()` (Prisma) to JSON store push.
// `error` and `requestId` fields from original Prisma call are dropped because
// the ApiAccessLogRecord schema in the JSON store does not include them.
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
