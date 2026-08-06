// API Key Stats and Delete Endpoint (Internal - for Dashboard)
// Get usage statistics and revoke API keys
//
// P4-D D6: Added audit() call on DELETE (apikey.revoke) — captures IP + UA +
// before/after via the new meta arg. No other changes to the route logic.

import { NextRequest, NextResponse } from 'next/server';
import { apiKeyAuth } from '@/lib/api/auth/api-key-auth';
import { 
  toNextResponse, 
  apiSuccess, 
  apiError, 
  apiNoContent,
  ErrorCodes,
  jsonError,
  jsonNotFound
} from '@/lib/api/response/api-response';
import { audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getRequestMeta } from '@/lib/request-meta';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/keys/[id]/stats - Get usage statistics for an API key
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

  const { id: keyId } = await params;
  
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  try {
    const key = await apiKeyAuth.getKeyById(keyId);
    if (!key) {
      return jsonNotFound('Clé API', keyId);
    }

    const stats = await apiKeyAuth.getKeyStats(keyId, Math.min(Math.max(days, 1), 365));

    return toNextResponse(apiSuccess(stats));
  } catch (error) {
    console.error('Error fetching key stats:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération des statistiques.');
  }
}

/**
 * DELETE /api/keys/[id] - Revoke an API key
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

  const { id: keyId } = await params;

  try {
    const key = await apiKeyAuth.getKeyById(keyId);
    if (!key) {
      return jsonNotFound('Clé API', keyId);
    }

    // P4-D D6: capture before-state for audit log (safe fields only — no hash).
    const beforeSnapshot = {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      isValid: key.isValid,
      permissions: key.permissions,
      usageCount: key.usageCount,
    };

    await apiKeyAuth.revoke(keyId);

    // ---------------------------------------------------------------
    // P4-D D6: audit log entry — apikey.revoke
    // ---------------------------------------------------------------
    try {
      const currentUser = await getCurrentUser();
      const { ip, userAgent } = getRequestMeta(request);
      await audit(
        currentUser?.sub,
        currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
        'APIKEY_REVOKE',
        'ApiKey',
        keyId,
        {
          name: key.name,
          prefix: key.prefix,
        },
        ip,
        {
          userAgent,
          method: 'DELETE',
          path: `/api/keys/${keyId}`,
          before: beforeSnapshot,
          after: { id: keyId, isValid: false },
        }
      );
    } catch (auditErr) {
      console.error('[keys DELETE] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return toNextResponse(apiNoContent());
  } catch (error) {
    console.error('Error revoking API key:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la révocation de la clé API.');
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
