// GET /api/documents (liste filtrée par rôle) + POST (création métadonnées)
// PHASE 2: Robustesse Backend - Pagination + Search + Security

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type Document as Doc } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getPaginationParams,
  createPaginatedResponse,
  filterBySearchTerm,
  sortArray,
} from '@/lib/pagination';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';
import { z } from 'zod';

const CreateSchema = z.object({
  title: z.string().min(3).max(300),
  type: z.enum(['TFC', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE']).default('TFC'),
  subject: z.string().max(500).optional(),
  abstract: z.string().max(5000).optional(),
  fileName: z.string(),
  fileSize: z.number().max(100 * 1024 * 1024), // Max 100MB
  mimeType: z.string().regex(/^(application|image|text)\/(pdf|docx|txt|png|jpeg|rtf)$/),
  textExtract: z.string().optional(),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  promotionId: z.string().optional(),
  academicYear: z.string().default('2025-2026'),
  supervisedById: z.string().optional(),
  keywords: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const db = await loadDB();
    const { searchParams } = new URL(req.url);
    
    // Pagination parameters
    const pagination = getPaginationParams(searchParams);
    
    // Filters
    const searchTerm = searchParams.get('search');
    const status = searchParams.get('status');
    const facultyId = searchParams.get('facultyId');
    const type = searchParams.get('type');
    
    // Sort
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    let docs = [...db.documents]; // Create copy for sorting
    
    // Role-based filtering
    if (user.role === 'STUDENT') {
      docs = docs.filter(d => d.uploadedById === user.sub);
    } else if (user.role === 'TEACHER') {
      docs = docs.filter(d => d.supervisedById === user.sub || d.uploadedById === user.sub);
    } else if (user.role === 'FACULTY_ADMIN') {
      docs = docs.filter(d => d.facultyId === user.facultyId);
    }
    
    // Apply filters
    if (status) docs = docs.filter(d => d.status === status);
    if (facultyId) docs = docs.filter(d => d.facultyId === facultyId);
    if (type) docs = docs.filter(d => d.type === type);
    
    // Search filter
    if (searchTerm) {
      docs = filterBySearchTerm(docs, searchTerm, ['title', 'subject', 'keywords']);
    }

    // Get total before pagination
    const totalItems = docs.length;

    // Sort
    docs = sortArray(docs, sortBy, sortOrder);

    // Enrich with related data AFTER pagination to avoid overhead
    const paginatedDocs = docs.slice(pagination.offset, pagination.offset + pagination.limit);
    const enriched = paginatedDocs.map(d => ({
      ...d,
      uploadedBy: db.users.find(u => u.id === d.uploadedById)
        ? { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }
          .bind({ id: d.uploadedById })()
        : null,
      supervisedBy: db.users.find(u => u.id === d.supervisedById)
        ? { id: u.id, firstName: u.firstName, lastName: u.lastName }
          .bind({ id: d.supervisedById })()
        : null,
      faculty: db.faculties.find(f => f.id === d.facultyId)?.name || null,
      department: db.departments.find(dep => dep.id === d.departmentId)?.name || null,
      promotion: db.promotions.find(p => p.id === d.promotionId)?.name || null,
      hasAnalysis: db.analyses.some(a => a.documentId === d.id),
    }));

    return NextResponse.json({
      data: enriched,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / pagination.limit),
        hasNextPage: pagination.page < Math.ceil(totalItems / pagination.limit),
        hasPrevPage: pagination.page > 1,
      },
      filters: { status, facultyId, type },
      // Metadata for dropdowns (not paginated)
      faculties: db.faculties,
      departments: db.departments,
      promotions: db.promotions,
      teachers: db.users.filter(u => u.role === 'TEACHER').map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten(), code: 'VALIDATION_ERROR' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const db = await loadDB();
    let facultyId = parsed.data.facultyId;
    let departmentId = parsed.data.departmentId;
    let promotionId = parsed.data.promotionId;

    // Auto-rattachement si étudiant
    if (user.role === 'STUDENT') {
      const me = db.users.find(u => u.id === user.sub);
      facultyId = me?.facultyId;
      departmentId = me?.departmentId;
      promotionId = me?.promotionId;
    }
    
    if (!facultyId) {
      return NextResponse.json(
        { error: 'Faculté requise', code: 'FACULTY_REQUIRED' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const doc: Doc = {
      id: genId('doc'),
      title: parsed.data.title,
      type: parsed.data.type,
      subject: parsed.data.subject,
      abstract: parsed.data.abstract,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      mimeType: parsed.data.mimeType,
      textExtract: parsed.data.textExtract,
      status: 'SUBMITTED',
      facultyId,
      departmentId: departmentId || '',
      promotionId,
      academicYear: parsed.data.academicYear,
      uploadedById: user.sub,
      supervisedById: parsed.data.supervisedById,
      keywords: parsed.data.keywords,
      createdAt: now(),
      updatedAt: now(),
    };

    db.documents.push(doc);
    await saveDB(db);
    
    await audit(
      user.sub,
      `${user.firstName} ${user.lastName}`,
      'CREATE_DOCUMENT',
      'Document',
      doc.id,
      { title: doc.title, type: doc.type }
    );

    return NextResponse.json(
      { document: doc }, 
      { status: 201, headers: getSecurityHeaders() }
    );
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
