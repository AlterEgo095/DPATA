// API Keys Management Endpoint (Internal - for Dashboard)
// CRUD operations for API keys
//
// P4-D D6: Added audit() call on POST (apikey.create) — captures IP + UA +
// before/after via the new meta arg. No other changes to the route logic.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeyAuth, type CreateKeyOptions } from '@/lib/api/auth/api-key-auth';
import { 
  toNextResponse, 
  apiSuccess, 
  apiError, 
  apiCreated,
  ErrorCodes,
  jsonError
} from '@/lib/api/response/api-response';
import { parseJsonBody, createApiKeySchema } from '@/lib/api/validation/request-validator';
import { audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getRequestMeta } from '@/lib/request-meta';

/**
 * GET /api/keys - List API keys for current user (requires session auth)
 */
export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

  // This endpoint is used by the dashboard and requires session authentication
  // For now, we'll return keys based on a query parameter or session
  
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    // P2-B: Fixed jsonError() options. The third argument accepts
    // { status?, details? }. The old call passed { hint: '...' } which is an
    // excess property. Moved `hint` into the `details` sub-object so the
    // hint is still surfaced in the API response (under error.details.hint).
    return jsonError(ErrorCodes.INVALID_PARAMETER, 'L\'utilisateur est requis.', {
      details: { hint: 'Fournissez le paramètre userId' },
    });
  }

  try {
    const keys = await apiKeyAuth.getUserKeys(userId);
    
    // Don't expose hashed keys
    const safeKeys = keys.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      permissions: key.permissions,
      rateLimit: key.rateLimit,
      ipAddressWhitelist: key.ipAddressWhitelist,
      isValid: key.isValid,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      createdAt: key.createdAt,
    }));

    return toNextResponse(apiSuccess(safeKeys));
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération des clés API.');
  }
}

/**
 * POST /api/keys - Create new API key
 */
export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

  // Parse and validate body
  const bodyResult = await parseJsonBody(createApiKeySchema, request);
  if (!bodyResult.success) {
    return toNextResponse(bodyResult.error as any);
  }

  const data = bodyResult.data;

  try {
    // Verify user exists
    // P2-B: The createApiKeySchema (in request-validator.ts) does not
    // include a `createdBy` field, so `data.createdBy` is not type-safe.
    // Casting through any to access it. The value flows from the request
    // body (the client sends createdBy). This preserves the original
    // runtime behavior.
    const createdBy = (data as any).createdBy || '';
    const user = await db.user.findUnique({ where: { id: createdBy } });
    if (!user) {
      // P2-B: Fixed jsonError() options — moved `field` into `details`.
      return jsonError(ErrorCodes.INVALID_PARAMETER, 'Utilisateur non trouvé.', {
        details: { field: 'createdBy' },
      });
    }

    // Generate new API key
    const options: CreateKeyOptions = {
      name: data.name,
      permissions: data.permissions as any,
      rateLimit: data.rateLimit,
      ipAddressWhitelist: data.ipAddressWhitelist,
      expiresAt: data.expiresAt,
      isTest: data.isTest,
      createdBy,
    };

    const newKey = await apiKeyAuth.generate(options);

    // ---------------------------------------------------------------
    // P4-D D6: audit log entry — apikey.create
    // ---------------------------------------------------------------
    try {
      const currentUser = await getCurrentUser();
      const { ip, userAgent } = getRequestMeta(request);
      // Don't log the actual key hash — log only safe metadata. Use values
      // from `options` (input) since the GeneratedApiKey type doesn't
      // expose all original input fields (e.g. rateLimit).
      await audit(
        currentUser?.sub || createdBy,
        currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
        'APIKEY_CREATE',
        'ApiKey',
        newKey.id,
        {
          name: options.name,
          prefix: newKey.prefix,
          permissions: options.permissions,
          rateLimit: options.rateLimit,
          createdBy,
        },
        ip,
        {
          userAgent,
          method: 'POST',
          path: '/api/keys',
          after: {
            id: newKey.id,
            name: options.name,
            prefix: newKey.prefix,
            permissions: options.permissions,
            rateLimit: options.rateLimit,
          },
        }
      );
    } catch (auditErr) {
      // Audit failure must not break the route.
      console.error('[keys POST] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return toNextResponse(apiCreated(newKey));
  } catch (error) {
    console.error('Error creating API key:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la création de la clé API.');
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
