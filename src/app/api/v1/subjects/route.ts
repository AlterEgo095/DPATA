// API v1 Subjects Endpoint
// List subjects and validate new subject proposals
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// NOTE on schema mismatch:
//   The JSON store has `AcademicSubject` (collection: `db.academicSubjects`)
//   which is a SUPERSET of the original Prisma `Subject` model, with different
//   field names for the same concepts:
//     Prisma `type`             -> AcademicSubject `workType`
//     Prisma `isValidated`      -> derived from AcademicSubject `status === 'VALIDATED'`
//     Prisma `validationScore`  -> derived from AcademicSubject `similarityScore`
//                                  (stored as `1 - (validationScore/100)` so that
//                                   high similarity <=> low validation score)
//   The JSON store has no `proposedById` field, so the `proposedBy` relation
//   is always `null` in the response (field is present, value is null).
//   The JSON store has no document↔subject FK, so `_count.documents` is `0`.
//   These are the only behavioral deltas; all other response fields are preserved.
// - `db.subject.findMany` -> `db.academicSubjects.filter(...).sort(...).slice(...)`
// - `db.subject.create`   -> `db.academicSubjects.push(...)` + `saveDB(db)`
// - `db.apiAccessLog.create` -> push to `db.apiAccessLogs` (auto-trim at 5000)

import { NextRequest } from 'next/server';
import {
  loadDB,
  saveDB,
  genId,
  now,
  type AcademicSubject,
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
import { parseQueryParams, parseJsonBody, listSubjectsSchema, validateSubjectSchema } from '@/lib/api/validation/request-validator';

// ============================================================
// Response shape helpers (matches original Prisma `select` projection)
// ============================================================

interface UserProjection {
  id: string;
  firstName: string;
  lastName: string;
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

interface SubjectListItem {
  id: string;
  title: string;
  description?: string;
  type: NonNullable<AcademicSubject['workType']>;
  isValidated: boolean;
  validationScore: number | null;
  createdAt: string;
  updatedAt: string;
  faculty: FacultyProjection | null;
  department: DepartmentProjection | null;
  proposedBy: UserProjection | null;
  _count: { documents: number };
}

interface CreatedSubjectProjection {
  id: string;
  title: string;
  type: NonNullable<AcademicSubject['workType']>;
  isValidated: boolean;
  validationScore: number | null;
  createdAt: string;
}

// Mappers between AcademicSubject (JSON store) and API response shape.
// `validationScore` (Prisma 0-100) <-> `similarityScore` (JSON store 0-1, inverted).
function deriveIsValidated(s: AcademicSubject): boolean {
  return s.status === 'VALIDATED';
}

function deriveValidationScore(s: AcademicSubject): number | null {
  if (s.similarityScore === null || s.similarityScore === undefined) return null;
  return Math.round((1 - s.similarityScore) * 100);
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
    return toNextResponse({ response: queryParams.error, status: HttpStatus.BAD_REQUEST });
  }

  const { page, perPage, facultyId, departmentId, search, isValidated } = queryParams.data;

  try {
    const db = await loadDB();

    // Build filtered set (replaces Prisma `where` clause)
    let subjects: AcademicSubject[] = db.academicSubjects.filter((s) => {
      if (facultyId && s.facultyId !== facultyId) return false;
      if (departmentId && s.departmentId !== departmentId) return false;
      if (isValidated !== undefined && deriveIsValidated(s) !== isValidated) return false;
      if (search) {
        const term = search.toLowerCase();
        const inTitle = s.title.toLowerCase().includes(term);
        const inDescription = s.description ? s.description.toLowerCase().includes(term) : false;
        if (!inTitle && !inDescription) return false;
      }
      return true;
    });

    // Sort by createdAt desc
    subjects = subjects.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = subjects.length;

    // Pagination
    const skip = (page - 1) * perPage;
    const paginated = subjects.slice(skip, skip + perPage);

    // Build response with manual joins
    const items: SubjectListItem[] = paginated.map<SubjectListItem>((s) => {
      const faculty = projectFaculty(db.faculties.find((f) => f.id === s.facultyId));
      const department = projectDepartment(db.departments.find((d) => d.id === s.departmentId));
      // JSON store has no proposedById field -> proposedBy is always null
      const proposedBy: UserProjection | null = null;
      // JSON store has no document↔subject FK -> documents count is always 0
      const documentsCount = 0;

      return {
        id: s.id,
        title: s.title,
        description: s.description,
        type: (s.workType || 'AUTRE') as NonNullable<AcademicSubject['workType']>,
        isValidated: deriveIsValidated(s),
        validationScore: deriveValidationScore(s),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        faculty,
        department,
        proposedBy,
        _count: { documents: documentsCount },
      };
    });

    // Increment usage and log
    await apiKeyAuth.incrementUsage(authResult.apiKey.id);

    const response = jsonPaginated(items, total, page, perPage);
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

    // Create new AcademicSubject record (push + save).
    // Note: JSON store has no `proposedById` field; we omit it.
    // `similarityScore` stores `1 - (validationScore/100)` so the GET endpoint
    // can recover the original `validationScore` via `deriveValidationScore()`.
    const timestamp = now();
    const newSubject: AcademicSubject = {
      id: genId('subj'),
      title: data.title,
      description: data.description,
      workType: data.type,
      keywords: data.keywords ? data.keywords.join(', ') : undefined,
      facultyId: data.facultyId,
      departmentId: data.departmentId,
      status: allPassed && validationScore >= 70 ? 'VALIDATED' : 'PENDING',
      isOriginal: allPassed && validationScore >= 70,
      similarityScore: 1 - validationScore / 100,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    db.academicSubjects.push(newSubject);
    await saveDB(db);

    // Build response projection (matches original Prisma `select`)
    const subject: CreatedSubjectProjection = {
      id: newSubject.id,
      title: newSubject.title,
      type: (newSubject.workType || 'AUTRE') as NonNullable<AcademicSubject['workType']>,
      isValidated: deriveIsValidated(newSubject),
      validationScore: deriveValidationScore(newSubject),
      createdAt: newSubject.createdAt,
    };

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
