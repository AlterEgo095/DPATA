// API v1 Documents Endpoint
// List and create documents
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// All Prisma calls (count, findMany, findUnique, create, apiAccessLog.create)
// translated to in-memory filter/sort/slice/push operations against `db.documents`,
// `db.faculties`, `db.departments`, `db.users`, `db.analyses`, `db.apiAccessLogs`.
// API request/response shapes are unchanged; only the data access layer changed.

import { NextRequest } from 'next/server';
import {
  loadDB,
  saveDB,
  genId,
  now,
  type Document,
  type User,
  type Faculty,
  type Department,
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
  apiPaginated,
  apiCreated,
  ErrorCodes,
  HttpStatus,
  jsonError,
  jsonPaginated
} from '@/lib/api/response/api-response';
import { parseQueryParams, parseJsonBody, listDocumentsSchema, createDocumentSchema } from '@/lib/api/validation/request-validator';

// ============================================================
// Response shape helpers (manual projection replacing Prisma `select`)
// ============================================================

interface UploadedByProjection {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface FacultyProjection {
  id: string;
  name: string;
  code: string;
}

interface DepartmentProjection {
  id: string;
  name: string;
  code: string;
}

interface DocumentListItem {
  id: string;
  title: string;
  type: Document['type'];
  subject?: string;
  abstract?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: Document['status'];
  academicYear: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy: UploadedByProjection | null;
  faculty: FacultyProjection | null;
  department: DepartmentProjection | null;
  _count: { analyses: number };
}

interface CreatedDocumentProjection {
  id: string;
  title: string;
  type: Document['type'];
  subject?: string;
  status: Document['status'];
  createdAt: string;
  faculty: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
}

function projectUser(u: User | undefined): UploadedByProjection | null {
  if (!u) return null;
  return { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email };
}

function projectFaculty(f: Faculty | undefined): FacultyProjection | null {
  if (!f) return null;
  return { id: f.id, name: f.name, code: f.code };
}

function projectDepartment(d: Department | undefined): DepartmentProjection | null {
  if (!d) return null;
  return { id: d.id, name: d.name, code: d.code };
}

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
    // queryParams.error is ApiResponse<never> (the response body); toNextResponse
    // expects the wrapped { response, status } form. Validation errors are 400.
    return toNextResponse({ response: queryParams.error, status: HttpStatus.BAD_REQUEST });
  }

  const { page, perPage, status, type, facultyId, departmentId, search, sortBy, sortOrder } = queryParams.data;

  // Load DB once and filter in-memory (replaces Prisma where/count/findMany)
  const db = await loadDB();

  // Build filtered set
  let docs: Document[] = db.documents.filter((doc) => {
    if (status && doc.status !== status) return false;
    if (type && doc.type !== type) return false;
    if (facultyId && doc.facultyId !== facultyId) return false;
    if (departmentId && doc.departmentId !== departmentId) return false;
    if (search) {
      const term = search.toLowerCase();
      const inTitle = doc.title.toLowerCase().includes(term);
      const inSubject = doc.subject ? doc.subject.toLowerCase().includes(term) : false;
      if (!inTitle && !inSubject) return false;
    }
    return true;
  });

  // Sort
  const sortDir = sortOrder === 'asc' ? 1 : -1;
  docs = docs.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title) * sortDir;
    if (sortBy === 'updatedAt') {
      const cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return cmp * sortDir;
    }
    // default: createdAt
    const cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return cmp * sortDir;
  });

  const total = docs.length;

  // Pagination
  const skip = (page - 1) * perPage;
  const paginated = docs.slice(skip, skip + perPage);

  // Build response with manual joins (replaces Prisma `select` + relations)
  const documents: DocumentListItem[] = paginated.map((doc) => {
    const uploadedBy = projectUser(db.users.find((u) => u.id === doc.uploadedById));
    const faculty = projectFaculty(db.faculties.find((f) => f.id === doc.facultyId));
    const department = projectDepartment(db.departments.find((d) => d.id === doc.departmentId));
    const analysesCount = db.analyses.filter((a) => a.documentId === doc.id).length;

    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      subject: doc.subject,
      abstract: doc.abstract,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      status: doc.status,
      academicYear: doc.academicYear,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      uploadedBy,
      faculty,
      department,
      _count: { analyses: analysesCount },
    };
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
    return toNextResponse({ response: bodyResult.error, status: HttpStatus.BAD_REQUEST });
  }

  const data = bodyResult.data;

  try {
    const db = await loadDB();

    // Verify referenced entities exist
    const faculty = db.faculties.find((f) => f.id === data.facultyId);
    if (!faculty) {
      return jsonError(ErrorCodes.INVALID_PARAMETER, 'Faculté non trouvée.', { details: { field: 'facultyId' } });
    }

    const department = db.departments.find((d) => d.id === data.departmentId);
    if (!department) {
      return jsonError(ErrorCodes.INVALID_PARAMETER, 'Département non trouvé.', { details: { field: 'departmentId' } });
    }

    // Create document (push to in-memory array, then save)
    const timestamp = now();
    const newDoc: Document = {
      id: genId('doc'),
      title: data.title,
      type: data.type,
      subject: data.subject,
      abstract: data.abstract,
      textExtract: data.content, // Store content for analysis
      fileName: `${data.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`,
      fileSize: data.content ? Buffer.byteLength(data.content) : 0,
      mimeType: 'text/plain',
      status: 'SUBMITTED',
      facultyId: data.facultyId,
      departmentId: data.departmentId,
      promotionId: data.promotionId,
      academicYear: data.academicYear,
      keywords: data.keywords ? JSON.stringify(data.keywords) : undefined,
      uploadedById: data.uploadedById,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    db.documents.push(newDoc);
    await saveDB(db);

    // Build response projection (matches original Prisma `select`)
    const document: CreatedDocumentProjection = {
      id: newDoc.id,
      title: newDoc.title,
      type: newDoc.type,
      subject: newDoc.subject,
      status: newDoc.status,
      createdAt: newDoc.createdAt,
      faculty: { id: faculty.id, name: faculty.name },
      department: { id: department.id, name: department.name },
    };

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
// P2-A: Migrated from `db.apiAccessLog.create()` (Prisma) to JSON store push.
// Note: `error` and `requestId` fields from original Prisma call are dropped
// because the ApiAccessLogRecord schema in the JSON store does not include them.
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
      // Defensive: ensure the array exists (store_db_patch added it but be safe)
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
    // Auto-trim to keep the file manageable (mirrors store/db.ts audit() pattern)
    if (db.apiAccessLogs.length > 5000) {
      db.apiAccessLogs = db.apiAccessLogs.slice(0, 5000);
    }
    await saveDB(db);
  } catch (e) {
    // Don't fail the request if logging fails
    console.error('Failed to log API access:', e);
  }
}
