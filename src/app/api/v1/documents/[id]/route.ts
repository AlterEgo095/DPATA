// API v1 Document Detail Endpoint
// Get document details by ID

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
 * GET /api/v1/documents/[id] - Get document details
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

  // Get document ID from params
  const { id } = await params;

  try {
    // Fetch document with relations
    const document = await db.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        subject: true,
        abstract: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        status: true,
        academicYear: true,
        keywords: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        supervisedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        faculty: {
          select: { id: true, name: true, code: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        promotion: {
          select: { id: true, name: true, level: true },
        },
        analyses: {
          select: {
            id: true,
            status: true,
            globalScore: true,
            threshold: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { analyses: true, matches: true },
        },
      },
    });

    if (!document) {
      return jsonNotFound('Document', id);
    }

    // Parse JSON fields
    const responseDocument = {
      ...document,
      keywords: document.keywords ? JSON.parse(document.keywords) : [],
    };

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    const response = toNextResponse(apiSuccess(responseDocument));
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error fetching document:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération du document.');
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
