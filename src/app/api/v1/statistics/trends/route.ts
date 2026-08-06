// API v1 Statistics Trends Endpoint
// Get trend data for various metrics over time
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// All Prisma `count`/`aggregate` calls inside the per-bucket loops are replaced
// with in-memory `filter(...).length` and `reduce` ops against `db.documents`,
// `db.analyses`, `db.users`. The bucketing algorithm and summary calculation
// are unchanged. API request/response shapes are unchanged; only the data
// access layer changed.

import { NextRequest } from 'next/server';
import {
  loadDB,
  saveDB,
  genId,
  now,
  type DB,
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
  jsonError
} from '@/lib/api/response/api-response';
import { parseQueryParams, statisticsTrendsSchema } from '@/lib/api/validation/request-validator';

/**
 * GET /api/v1/statistics/trends - Trend data over time
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

  // Check read permission
  if (!authResult.apiKey.permissions.includes('read') && !authResult.apiKey.permissions.includes('admin')) {
    return jsonError(ErrorCodes.FORBIDDEN, 'Permissions insuffisantes. La permission "read" est requise.');
  }

  // Check key-specific rate limit
  const keyRateLimit = rateLimiter.checkApiKey(authResult.apiKey.id, authResult.apiKey.rateLimit);
  if (!keyRateLimit.allowed) {
    return createRateLimitResponse(keyRateLimit);
  }

  // Parse query parameters
  const queryParams = parseQueryParams(statisticsTrendsSchema, request.nextUrl.searchParams);
  if (!queryParams.success) {
    return toNextResponse({ response: queryParams.error, status: HttpStatus.BAD_REQUEST });
  }

  const { period, metric, granularity } = queryParams.data;

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

    // Generate time buckets based on granularity
    const timeBuckets = generateTimeBuckets(startDate, nowDate, granularity);

    // Load DB once — all per-bucket queries reuse the same in-memory snapshot
    const db = await loadDB();

    // Fetch data based on metric type
    let trendData: Array<{ date: string; value: number; label?: string }> = [];

    switch (metric) {
      case 'documents':
        trendData = getDocumentTrends(db, timeBuckets);
        break;
      case 'analyses':
        trendData = getAnalysisTrends(db, timeBuckets);
        break;
      case 'plagiarism_rate':
        trendData = getPlagiarismRateTrends(db, timeBuckets);
        break;
      case 'users':
        trendData = getUserTrends(db, timeBuckets);
        break;
      default:
        trendData = getDocumentTrends(db, timeBuckets);
    }

    const response = {
      period,
      metric,
      granularity,
      generatedAt: new Date().toISOString(),
      data: trendData,
      summary: calculateTrendSummary(trendData),
    };

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    // Log API access
    await logApiAccess(authResult.apiKey.id, 'GET', '/v1/statistics/trends', 200, Date.now() - startTime, ipAddress);

    const httpResponse = toNextResponse(apiSuccess(response));
    return addRateLimitHeaders(httpResponse, keyRateLimit);
  } catch (error) {
    console.error('Error fetching trends:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération des tendances.');
  }
}

// Helper functions for generating time buckets
function generateTimeBuckets(start: Date, end: Date, granularity: string): Array<{ start: Date; end: Date; label: string }> {
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  const current = new Date(start);

  while (current < end) {
    const bucketStart = new Date(current);
    const bucketEnd = new Date(current);
    let label = '';

    switch (granularity) {
      case 'day':
        bucketEnd.setDate(bucketEnd.getDate() + 1);
        label = bucketStart.toISOString().split('T')[0];
        break;
      case 'week':
        bucketEnd.setDate(bucketEnd.getDate() + 7);
        label = `S${Math.ceil((bucketStart.getTime() - new Date(bucketStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
        break;
      case 'month':
        bucketEnd.setMonth(bucketEnd.getMonth() + 1);
        label = bucketStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        break;
      default:
        bucketEnd.setDate(bucketEnd.getDate() + 1);
        label = bucketStart.toISOString().split('T')[0];
    }

    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      label,
    });

    current.setTime(bucketEnd.getTime());
  }

  return buckets;
}

// Fetch document trends
// P2-A: Replaces per-bucket `db.document.count({ where: { createdAt: { gte, lt } } })`
// with a single filter on the in-memory array.
function getDocumentTrends(
  db: DB,
  buckets: Array<{ start: Date; end: Date; label: string }>
): Array<{ date: string; value: number }> {
  const results: Array<{ date: string; value: number }> = [];

  for (const bucket of buckets) {
    const startMs = bucket.start.getTime();
    const endMs = bucket.end.getTime();
    const count = db.documents.filter((doc) => {
      const t = new Date(doc.createdAt).getTime();
      return t >= startMs && t < endMs;
    }).length;
    results.push({ date: bucket.label, value: count });
  }

  return results;
}

// Fetch analysis trends
function getAnalysisTrends(
  db: DB,
  buckets: Array<{ start: Date; end: Date; label: string }>
): Array<{ date: string; value: number }> {
  const results: Array<{ date: string; value: number }> = [];

  for (const bucket of buckets) {
    const startMs = bucket.start.getTime();
    const endMs = bucket.end.getTime();
    const count = db.analyses.filter((anl) => {
      const t = new Date(anl.createdAt).getTime();
      return t >= startMs && t < endMs;
    }).length;
    results.push({ date: bucket.label, value: count });
  }

  return results;
}

// Fetch plagiarism rate trends
// P2-A: Replaces `db.analysis.aggregate({ _avg: { globalScore: true } })` with
// in-memory filter + reduce.
function getPlagiarismRateTrends(
  db: DB,
  buckets: Array<{ start: Date; end: Date; label: string }>
): Array<{ date: string; value: number }> {
  const results: Array<{ date: string; value: number }> = [];

  for (const bucket of buckets) {
    const startMs = bucket.start.getTime();
    const endMs = bucket.end.getTime();
    const inBucket = db.analyses.filter((anl) => {
      if (anl.status !== 'COMPLETED') return false;
      if (anl.globalScore === null || anl.globalScore === undefined) return false;
      if (!anl.completedAt) return false;
      const t = new Date(anl.completedAt).getTime();
      return t >= startMs && t < endMs;
    });

    const avg = inBucket.length > 0
      ? inBucket.reduce((sum, anl) => sum + (anl.globalScore || 0), 0) / inBucket.length
      : 0;

    results.push({
      date: bucket.label,
      value: avg ? Math.round(avg * 10000) / 100 : 0,
    });
  }

  return results;
}

// Fetch user registration trends
function getUserTrends(
  db: DB,
  buckets: Array<{ start: Date; end: Date; label: string }>
): Array<{ date: string; value: number }> {
  const results: Array<{ date: string; value: number }> = [];

  for (const bucket of buckets) {
    const startMs = bucket.start.getTime();
    const endMs = bucket.end.getTime();
    const count = db.users.filter((u) => {
      if (!u.isActive) return false;
      const t = new Date(u.createdAt).getTime();
      return t >= startMs && t < endMs;
    }).length;
    results.push({ date: bucket.label, value: count });
  }

  return results;
}

// Calculate summary statistics for trends
function calculateTrendSummary(data: Array<{ date: string; value: number }>) {
  if (data.length === 0) {
    return { total: 0, average: 0, min: 0, max: 0, trend: 'stable' as string };
  }

  const values = data.map(d => d.value);
  const total = values.reduce((a, b) => a + b, 0);
  const average = Math.round((total / values.length) * 100) / 100;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Simple trend detection (compare first half vs second half)
  const midPoint = Math.floor(values.length / 2);
  const firstHalfAvg = values.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint || 0;
  const secondHalfAvg = values.slice(midPoint).reduce((a, b) => a + b, 0) / (values.length - midPoint) || 0;

  let trend = 'stable';
  if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'increasing';
  else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'decreasing';

  return { total, average, min, max, trend };
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
