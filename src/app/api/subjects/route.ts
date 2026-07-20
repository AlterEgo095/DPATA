// GET /api/subjects (liste) + POST (création)
// PHASE 2: Robustesse Backend - Pagination + Search + Sort

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type AcademicSubject } from '@/lib/store/db';
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
  title: z.string().min(5).max(500),
  description: z.string().max(5000).optional(),
  domain: z.string().max(200).optional(),
  field: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  level: z.string().max(50).optional(),
  keywords: z.string().max(1000).optional(),
  objectives: z.string().max(3000).optional(),
  problemStatement: z.string().max(3000).optional(),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  academicYear: z.string().optional(),
  authorName: z.string().max(200).optional(),
  workType: z.enum(['TFC', 'TFE', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE']).optional(),
  synonyms: z.string().max(1000).optional(),
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
    
    // Pagination
    const pagination = getPaginationParams(searchParams);
    
    // Filters
    const searchTerm = searchParams.get('search');
    const domain = searchParams.get('domain');
    const facultyId = searchParams.get('facultyId');
    const workType = searchParams.get('workType');
    const status = searchParams.get('status');
    
    // Sort
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    let subjects = db.academicSubjects || [];
    
    // Apply filters
    if (searchTerm) {
      subjects = filterBySearchTerm(subjects, searchTerm, ['title', 'description', 'keywords', 'domain']);
    }
    if (domain) subjects = subjects.filter(s => s.domain?.toLowerCase().includes(domain.toLowerCase()));
    if (facultyId) subjects = subjects.filter(s => s.facultyId === facultyId);
    if (workType) subjects = subjects.filter(s => s.workType === workType);
    if (status) subjects = subjects.filter(s => s.status === status);

    // Get total before pagination for accurate count
    const totalItems = subjects.length;

    // Sort
    subjects = sortArray(subjects, sortBy, sortOrder);

    // Paginate
    const result = createPaginatedResponse(subjects, pagination, totalItems);

    return NextResponse.json({
      ...result,
      filters: { domain, facultyId, workType, status },
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
    if (!db.academicSubjects) db.academicSubjects = [];

    const subject: AcademicSubject = {
      id: genId('sub'),
      title: parsed.data.title,
      description: parsed.data.description,
      domain: parsed.data.domain,
      field: parsed.data.field,
      specialty: parsed.data.specialty,
      level: parsed.data.level,
      keywords: parsed.data.keywords,
      objectives: parsed.data.objectives,
      problemStatement: parsed.data.problemStatement,
      facultyId: parsed.data.facultyId,
      departmentId: parsed.data.departmentId,
      academicYear: parsed.data.academicYear,
      authorName: parsed.data.authorName,
      workType: parsed.data.workType,
      status: 'VALIDATED',
      isOriginal: true,
      synonyms: parsed.data.synonyms,
      createdAt: now(),
      updatedAt: now(),
    };

    db.academicSubjects.push(subject);
    await saveDB(db);
    
    await audit(
      user.sub,
      `${user.firstName} ${user.lastName}`,
      'CREATE_SUBJECT',
      'AcademicSubject',
      subject.id,
      { title: subject.title }
    );

    return NextResponse.json(
      { subject }, 
      { status: 201, headers: getSecurityHeaders() }
    );
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
