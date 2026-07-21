// API v1 Documents Endpoint
// List and create documents

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
  apiPaginated, 
  apiCreated,
  ErrorCodes,
  jsonError,
  jsonPaginated
} from '@/lib/api/response/api-response';
import { parseQueryParams, parseJsonBody, listDocumentsSchema, createDocumentSchema } from '@/lib/api/validation/request-validator';

/**
 * GET /api/v1/documents - List documents (paginated, filterable)
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

  // Check key-specific rate limit
  const keyRateLimit = rateLimiter.checkApiKey(authResult.apiKey.id, authResult.apiKey.rateLimit);
  if (!keyRateLimit.allowed) {
    return createRateLimitResponse(keyRateLimit);
  }

  // Parse query parameters
  const queryParams = parseQueryParams(listDocumentsSchema, request.nextUrl.searchParams);
  if (!queryParams.success) {
    return toNextResponse(queryParams.error as any);
  }

  const { page, perPage, status, type, facultyId, departmentId, search, sortBy, sortOrder } = queryParams.data;

  // Build where clause
  const where: Record<string, any> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (facultyId) where.facultyId = facultyId;
  if (departmentId) where.departmentId = departmentId;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { subject: { contains: search } },
    ];
  }

  // Get total count
  const total = await db.document.count({ where });

  // Get paginated results
  const documents = await db.document.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * perPage,
    take: perPage,
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
      createdAt: true,
      updatedAt: true,
      uploadedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      faculty: {
        select: { id: true, name: true, code: true },
      },
      department: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: { analyses: true },
      },
    },
  });

  // Increment usage and log
  await apiKeyAuth.incrementUsage(authResult.apiKey.id);

  const response = jsonPaginated(documents, total, page, perPage);
  return addRateLimitHeaders(response, keyRateLimit);
}

/**
 * POST /api/v1/documents - Create a new document
 */
export async function POST(request: NextRequest) {
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

  // Check key-specific rate limit
  const keyRateLimit = rateLimiter.checkApiKey(authResult.apiKey.id, authResult.apiKey.rateLimit);
  if (!keyRateLimit.allowed) {
    return createRateLimitResponse(keyRateLimit);
  }

  // Parse and validate body
  const bodyResult = await parseJsonBody(createDocumentSchema, request);
  if (!bodyResult.success) {
    return toNextResponse(bodyResult.error as any);
  }

  const data = bodyResult.data;

  try {
    // Verify referenced entities exist
    const faculty = await db.faculty.findUnique({ where: { id: data.facultyId } });
    if (!faculty) {
      return jsonError(ErrorCodes.INVALID_PARAMETER, 'Faculté non trouvée.', { field: 'facultyId' });
    }

    const department = await db.department.findUnique({ where: { id: data.departmentId } });
    if (!department) {
      return jsonError(ErrorCodes.INVALID_PARAMETER, 'Département non trouvé.', { field: 'departmentId' });
    }

    // Create document
    const document = await db.document.create({
      data: {
        title: data.title,
        type: data.type,
        subject: data.subject,
        abstract: data.abstract,
        textExtract: data.content, // Store content for analysis
        filePath: '', // Will be set when file is uploaded
        fileName: `${data.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`,
        fileSize: data.content ? Buffer.byteLength(data.content) : 0,
        mimeType: 'text/plain',
        status: 'SUBMITTED',
        facultyId: data.facultyId,
        departmentId: data.departmentId,
        promotionId: data.promotionId,
        academicYear: data.academicYear,
        keywords: data.keywords ? JSON.stringify(data.keywords) : null,
        uploadedById: data.uploadedById,
      },
      select: {
        id: true,
        title: true,
        type: true,
        subject: true,
        status: true,
        createdAt: true,
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // Increment usage
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    // Log API access
    await logApiAccess(authResult.apiKey.id, 'POST', '/v1/documents', 201, Date.now() - startTime, ipAddress);

    const response = toNextResponse(apiCreated(document));
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error creating document:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la création du document.');
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
    // Don't fail the request if logging fails
    console.error('Failed to log API access:', e);
  }
}
