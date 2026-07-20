// API v1 Auth Endpoint
// Validate API keys and return key information

import { NextRequest } from 'next/server';
import { 
  apiKeyAuth, 
  extractApiKeyFromHeaders, 
  extractIpAddress,
  type ApiKeyInfo 
} from '@/lib/api/auth/api-key-auth';
import { rateLimiter, addRateLimitHeaders, createRateLimitResponse } from '@/lib/api/middleware/rate-limiter';
import { 
  toNextResponse, 
  apiSuccess, 
  apiError, 
  ErrorCodes 
} from '@/lib/api/response/api-response';

export async function POST(request: NextRequest) {
  // Extract IP for rate limiting
  const ipAddress = extractIpAddress(request.headers);
  
  // Check IP-based rate limit first
  const ipRateLimit = rateLimiter.checkIp(ipAddress);
  if (!ipRateLimit.allowed) {
    return createRateLimitResponse(ipRateLimit);
  }

  // Extract API key
  const apiKey = extractApiKeyFromHeaders(request.headers);

  if (!apiKey) {
    return toNextResponse(
      apiError(ErrorCodes.MISSING_API_KEY, 'Clé API manquante.', {
        hint: 'Fournissez une clé API via l\'en-tête X-API-Key',
      }),
      { 'X-RateLimit-Remaining': String(ipRateLimit.remaining) }
    );
  }

  // Validate the API key
  const result = await apiKeyAuth.validate(apiKey, ipAddress);

  if (!result.valid || !result.apiKey) {
    return toNextResponse(
      apiError(result.error?.code || ErrorCodes.INVALID_API_KEY, result.error?.message || 'Clé invalide', {
        details: result.error,
      }),
      { 'X-RateLimit-Remaining': String(ipRateLimit.remaining) }
    );
  }

  // Check rate limit for this specific key
  const keyRateLimit = rateLimiter.checkApiKey(result.apiKey.id, result.apiKey.rateLimit);
  
  // Increment usage
  await apiKeyAuth.incrementUsage(result.apiKey.id);

  // Return key info (safe data only)
  const keyInfo: Partial<ApiKeyInfo> & { prefix: string; permissions: string[]; isValid: boolean } = {
    id: result.apiKey.id,
    name: result.apiKey.name,
    prefix: result.apiKey.prefix,
    permissions: result.apiKey.permissions,
    isValid: result.apiKey.isValid,
    rateLimit: result.apiKey.rateLimit,
    usageCount: result.apiKey.usageCount + 1,
    createdAt: result.apiKey.createdAt,
    lastUsedAt: new Date(),
  };

  // Don't expose sensitive info like expiresAt in validation response
  if (result.apiKey.expiresAt) {
    (keyInfo as any).hasExpiration = true;
    (keyInfo as any).expiresAt = result.apiKey.expiresAt;
  }

  const response = toNextResponse(
    apiSuccess(
      { 
        valid: true, 
        key: keyInfo,
        message: 'Clé API valide.' 
      },
      { rateLimit: { remaining: keyRateLimit.remaining, reset: keyRateLimit.resetTime, limit: result.apiKey.rateLimit } }
    )
  );

  return addRateLimitHeaders(response, keyRateLimit);
}

// GET to check current auth status (requires valid key)
export async function GET(request: NextRequest) {
  const ipAddress = extractIpAddress(request.headers);
  const apiKey = extractApiKeyFromHeaders(request.headers);

  if (!apiKey) {
    return toNextResponse(
      apiError(ErrorCodes.MISSING_API_KEY, 'Clé API manquante.')
    );
  }

  const result = await apiKeyAuth.validate(apiKey, ipAddress);

  if (!result.valid || !result.apiKey) {
    return toNextResponse(
      apiError(result.error?.code || ErrorCodes.INVALID_API_KEY, result.error?.message || 'Clé invalide')
    );
  }

  // Return minimal status info
  return toNextResponse(
    apiSuccess({
      authenticated: true,
      keyId: result.apiKey.id,
      keyName: result.apiKey.name,
      permissions: result.apiKey.permissions,
    })
  );
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
