// API v1 Document Detail Endpoint
// Get document details by ID
//
// P2-A MIGRATION: Replaced Prisma (`@/lib/db`) with JSON store (`@/lib/store/db`).
// Prisma's `findUnique` + nested `select`/`include` (uploadedBy, supervisedBy,
// faculty, department, promotion, analyses, _count) is now expressed as a single
// loadDB() followed by in-memory lookups on db.users / db.faculties / db.departments
// / db.promotions / db.analyses / db.matches. API response shape is unchanged.

import { NextRequest } from 'next/server';
import {
  loadDB,
  type Document,
  type User,
  type Faculty,
  type Department,
  type Promotion,
  type Analysis,
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
  ErrorCodes,
  jsonError,
  jsonNotFound
} from '@/lib/api/response/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================
// Response shape (matches original Prisma `select` projection)
// ============================================================

interface UserProjection {
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

interface PromotionProjection {
  id: string;
  name: string;
  level: string;
}

interface AnalysisProjection {
  id: string;
  status: Analysis['status'];
  globalScore?: number;
  threshold: number;
  createdAt: string;
  completedAt?: string;
}

interface DocumentDetailResponse {
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
  keywords: string[]; // parsed from JSON string in storage
  createdAt: string;
  updatedAt: string;
  uploadedBy: UserProjection | null;
  supervisedBy: UserProjection | null;
  faculty: FacultyProjection | null;
  department: DepartmentProjection | null;
  promotion: PromotionProjection | null;
  analyses: AnalysisProjection[];
  _count: { analyses: number; matches: number };
}

function projectUser(u: User | undefined): UserProjection | null {
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

function projectPromotion(p: Promotion | undefined): PromotionProjection | null {
  if (!p) return null;
  return { id: p.id, name: p.name, level: p.level };
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
    const db = await loadDB();

    // Find document
    const doc = db.documents.find((d) => d.id === id);
    if (!doc) {
      return jsonNotFound('Document', id);
    }

    // Manual joins (replaces Prisma `select` with nested relations)
    const uploadedBy = projectUser(db.users.find((u) => u.id === doc.uploadedById));
    const supervisedBy = projectUser(db.users.find((u) => u.id === doc.supervisedById));
    const faculty = projectFaculty(db.faculties.find((f) => f.id === doc.facultyId));
    const department = projectDepartment(db.departments.find((d) => d.id === doc.departmentId));
    const promotion = projectPromotion(db.promotions.find((p) => p.id === doc.promotionId));

    // Analyses: last 10 by createdAt desc
    const docAnalyses = db.analyses
      .filter((a) => a.documentId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map<AnalysisProjection>((a) => ({
        id: a.id,
        status: a.status,
        globalScore: a.globalScore,
        threshold: a.threshold,
        createdAt: a.createdAt,
        completedAt: a.completedAt,
      }));

    // Counts
    const allDocAnalyses = db.analyses.filter((a) => a.documentId === id);
    const analysesCount = allDocAnalyses.length;
    const analysisIds = new Set(allDocAnalyses.map((a) => a.id));
    const matchesCount = db.matches.filter((m) => analysisIds.has(m.analysisId)).length;

    // Parse JSON keywords field (original behavior preserved)
    let parsedKeywords: string[] = [];
    if (doc.keywords) {
      try {
        const parsed = JSON.parse(doc.keywords);
        if (Array.isArray(parsed)) {
          parsedKeywords = parsed as string[];
        }
      } catch {
        parsedKeywords = [];
      }
    }

    const responseDocument: DocumentDetailResponse = {
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
      keywords: parsedKeywords,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      uploadedBy,
      supervisedBy,
      faculty,
      department,
      promotion,
      analyses: docAnalyses,
      _count: { analyses: analysesCount, matches: matchesCount },
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
