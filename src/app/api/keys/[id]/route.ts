// API Key Stats and Delete Endpoint (Internal - for Dashboard)
// Get usage statistics and revoke API keys

import { NextRequest } from 'next/server';
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/keys/[id]/stats - Get usage statistics for an API key
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
  const { id: keyId } = await params;

  try {
    const key = await apiKeyAuth.getKeyById(keyId);
    if (!key) {
      return jsonNotFound('Clé API', keyId);
    }

    await apiKeyAuth.revoke(keyId);

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
