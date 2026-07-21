// API v1 Subjects Endpoint
// List subjects and validate new subject proposals

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
import { parseQueryParams, parseJsonBody, listSubjectsSchema, validateSubjectSchema } from '@/lib/api/validation/request-validator';

/**
 * GET /api/v1/subjects - List subjects (paginated, filterable)
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
  const queryParams = parseQueryParams(listSubjectsSchema, request.nextUrl.searchParams);
  if (!queryParams.success) {
    return toNextResponse(queryParams.error as any);
  }

  const { page, perPage, facultyId, departmentId, search, isValidated } = queryParams.data;

  try {
    // Build where clause
    const where: Record<string, any> = {};
    if (facultyId) where.facultyId = facultyId;
    if (departmentId) where.departmentId = departmentId;
    if (isValidated !== undefined) where.isValidated = isValidated;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Get total count
    const total = await db.subject.count({ where });

    // Get paginated results
    const subjects = await db.subject.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        isValidated: true,
        validationScore: true,
        createdAt: true,
        updatedAt: true,
        faculty: {
          select: { id: true, name: true, code: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        proposedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    const response = jsonPaginated(subjects, total, page, perPage);
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la récupération des sujets.');
  }
}

/**
 * POST /api/v1/subjects - Validate a subject proposal
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
  const bodyResult = await parseJsonBody(validateSubjectSchema, request);
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

    // Perform basic validation checks
    const validationChecks = {
      titleLength: data.title.length >= 10 && data.title.length <= 500,
      descriptionLength: data.description.length >= 50 && data.description.length <= 10000,
      hasKeywords: (data.keywords?.length || 0) >= 3,
      titleNotAllCaps: data.title !== data.title.toUpperCase(),
      titleNotAllLower: data.title !== data.title.toLowerCase(),
    };

    const allPassed = Object.values(validationChecks).every(Boolean);
    
    // Calculate validation score (0-100)
    const scoreComponents = [
      validationChecks.titleLength ? 25 : 0,
      validationChecks.descriptionLength ? 25 : 0,
      validationChecks.hasKeywords ? 20 : 0,
      validationChecks.titleNotAllCaps ? 15 : 0,
      validationChecks.titleNotAllLower ? 15 : 0,
    ];
    const validationScore = scoreComponents.reduce((a, b) => a + b, 0);

    // Create or update subject record
    const subject = await db.subject.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        keywords: JSON.stringify(data.keywords || []),
        validationScore,
        isValidated: allPassed && validationScore >= 70,
        facultyId: data.facultyId,
        departmentId: data.departmentId,
        proposedBy: authResult.apiKey.createdBy, // Use API key creator as proposer
      },
      select: {
        id: true,
        title: true,
        type: true,
        isValidated: true,
        validationScore: true,
        createdAt: true,
      },
    });

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    // Log API access
    await logApiAccess(authResult.apiKey.id, 'POST', '/v1/subjects', 201, Date.now() - startTime, ipAddress);

    const response = toNextResponse(apiCreated({
      ...subject,
      validation: {
        score: validationScore,
        passed: allPassed,
        checks: validationChecks,
        recommendation: validationScore >= 70 
          ? 'Le sujet est valide et peut être utilisé.'
          : 'Le sujet nécessite des améliorations avant d\'être validé.',
      },
    }));
    
    return addRateLimitHeaders(response, keyRateLimit);
  } catch (error) {
    console.error('Error validating subject:', error);
    return jsonError(ErrorCodes.INTERNAL_ERROR, 'Erreur lors de la validation du sujet.');
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
    console.error('Failed to log API access:', e);
  }
}
