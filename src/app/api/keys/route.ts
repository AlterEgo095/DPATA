// API Keys Management Endpoint (Internal - for Dashboard)
// CRUD operations for API keys

import { NextRequest } from 'next/server';
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

/**
 * GET /api/keys - List API keys for current user (requires session auth)
 */
export async function GET(request: NextRequest) {
  // This endpoint is used by the dashboard and requires session authentication
  // For now, we'll return keys based on a query parameter or session
  
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return jsonError(ErrorCodes.INVALID_PARAMETER, 'L\'utilisateur est requis.', {
      hint: 'Fournissez le paramètre userId',
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
  // Parse and validate body
  const bodyResult = await parseJsonBody(createApiKeySchema, request);
  if (!bodyResult.success) {
    return toNextResponse(bodyResult.error as any);
  }

  const data = bodyResult.data;

  try {
    // Verify user exists
    const user = await db.user.findUnique({ where: { id: data.createdBy || '' } });
    if (!user) {
      return jsonError(ErrorCodes.INVALID_PARAMETER, 'Utilisateur non trouvé.', { field: 'createdBy' });
    }

    // Generate new API key
    const options: CreateKeyOptions = {
      name: data.name,
      permissions: data.permissions as any,
      rateLimit: data.rateLimit,
      ipAddressWhitelist: data.ipAddressWhitelist,
      expiresAt: data.expiresAt,
      isTest: data.isTest,
      createdBy: data.createdBy || '',
    };

    const newKey = await apiKeyAuth.generate(options);

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
