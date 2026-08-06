// API v1 Analysis Result Endpoint
// Get analysis results by analysis ID
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// - `db.analysis.findUnique` (with `include: { document, matches, report }}`)
//     -> `db.analyses.find(...)` + `db.documents.find(...)` + `db.matches.filter(...)`
// - `db.apiAccessLog.create` -> push to `db.apiAccessLogs` (auto-trim at 5000)
// Note: The original Prisma schema had a `report` relation on Analysis; the JSON
// store has no equivalent, so `hasReport` is always `false` and `reportSummary`
// is `null`. This is the only behavioral delta; all other fields are preserved.
// Dates in the JSON store are ISO strings (not Date objects), so durationMs is
// computed via `new Date(...).getTime()` arithmetic.

import { NextRequest } from 'next/server';
import {
  loadDB,
  saveDB,
  genId,
  now,
  type Analysis,
  type Match,
  type Document,
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
  params: Promise<{ id: string; analysisId: string }>;
}

// ============================================================
// Response shape helpers
// ============================================================

interface MatchProjection {
  id: string;
  segmentIndex: number;
  segmentText: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  semanticScore: number;
  lexicalScore: number;
  matchType: Match['matchType'];
}

interface AnalysisResultResponse {
  id: string;
  documentId: string;
  documentTitle: string;
  status: Analysis['status'];
  // Scores (only if completed)
  globalScore?: number;
  plagiarismPercentage?: number;
  matchedSegments?: number;
  totalSegments?: number;
  // Configuration
  threshold: number;
  scope: string;
  // Timing
  startedAt?: string;
  completedAt?: string;
  durationMs: number | null;
  // Error info (if failed)
  error?: string;
  // Top matches (if completed)
  matches?: MatchProjection[];
  totalMatches?: number;
  // Report data (if available) — always absent in JSON store (no report relation)
  hasReport?: boolean;
  reportSummary?: unknown;
  createdAt: string;
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
    const db = await loadDB();

    // Fetch analysis record
    const analysis = db.analyses.find((a) => a.id === analysisId);

    if (!analysis) {
      return jsonNotFound('Analyse', analysisId);
    }

    // Verify analysis belongs to specified document
    if (analysis.documentId !== documentId) {
      return jsonError(ErrorCodes.NOT_FOUND, 'Cette analyse n\'appartient pas au document spécifié.');
    }

    // Manual join: document
    const document: Document | undefined = db.documents.find((d) => d.id === analysis.documentId);
    const documentTitle = document ? document.title : '';

    // Manual join: matches (top 100 by semanticScore desc)
    const matches = db.matches
      .filter((m) => m.analysisId === analysis.id)
      .sort((a, b) => b.semanticScore - a.semanticScore)
      .slice(0, 100);

    // Total matches count (replaces `analysis._count.matches`)
    const totalMatches = db.matches.filter((m) => m.analysisId === analysis.id).length;

    // Compute durationMs (JSON store keeps ISO strings, not Date objects)
    let durationMs: number | null = null;
    if (analysis.startedAt && analysis.completedAt) {
      const start = new Date(analysis.startedAt).getTime();
      const end = new Date(analysis.completedAt).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        durationMs = end - start;
      }
    }

    // Build response object — same shape as the original Prisma-backed response
    const result: AnalysisResultResponse = {
      id: analysis.id,
      documentId: analysis.documentId,
      documentTitle,
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
      durationMs,

      // Error info (if failed)
      ...(analysis.status === 'FAILED' && {
        error: analysis.error,
      }),

      // Top matches (if completed)
      ...(analysis.status === 'COMPLETED' && {
        matches: matches.map<MatchProjection>((match) => {
          const sourceDoc = db.documents.find((d) => d.id === match.sourceDocumentId);
          const segmentText = match.querySegmentText || '';
          const truncatedSegmentText =
            segmentText.substring(0, 200) + (segmentText.length > 200 ? '...' : '');
          return {
            id: match.id,
            segmentIndex: match.querySegmentIndex,
            segmentText: truncatedSegmentText,
            sourceDocumentId: match.sourceDocumentId,
            sourceDocumentTitle: sourceDoc ? sourceDoc.title : '',
            semanticScore: match.semanticScore,
            lexicalScore: match.lexicalScore,
            matchType: match.matchType,
          };
        }),
        totalMatches,
      }),

      // Report data — JSON store has no `report` relation, so always absent.
      // (Original behavior: `hasReport: true` + `reportSummary` from JSON parse.
      // We omit these fields entirely when no report exists, matching the
      // original spread conditional `...(analysis.report && { ... })`.)

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
