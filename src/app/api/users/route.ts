// GET /api/users + POST
// PHASE 2: Robustesse Backend - Pagination + Password Hashing

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type UserRole } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { hashPassword, getSecurityHeaders, sanitizeError } from '@/lib/security';
import {
  getPaginationParams,
  createPaginatedResponse,
  filterBySearchTerm,
  sortArray,
} from '@/lib/pagination';
import { z } from 'zod';

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  matricule: z.string().max(50).optional(),
  role: z.enum(['FACULTY_ADMIN', 'TEACHER', 'STUDENT']),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  promotionId: z.string().optional(),
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
    
    // Get pagination parameters
    const pagination = getPaginationParams(searchParams);
    const searchTerm = searchParams.get('search');
    const role = searchParams.get('role');
    const facultyId = searchParams.get('facultyId');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    // Filter users
    let users = db.users.filter(u => u.role !== 'SUPER_ADMIN');
    
    if (role) users = users.filter(u => u.role === role);
    if (facultyId) users = users.filter(u => u.facultyId === facultyId);
    if (user.role === 'FACULTY_ADMIN') users = users.filter(u => u.facultyId === user.facultyId);

    // Search filter
    if (searchTerm) {
      users = filterBySearchTerm(users, searchTerm, ['email', 'firstName', 'lastName', 'matricule']);
    }

    // Sort
    users = sortArray(users, sortBy, sortOrder);

    // Enrich with related data
    const enriched = users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      matricule: u.matricule,
      role: u.role,
      isActive: u.isActive,
      facultyId: u.facultyId,
      departmentId: u.departmentId,
      promotionId: u.promotionId,
      createdAt: u.createdAt,
      faculty: db.faculties.find(f => f.id === u.facultyId)?.name || null,
      department: db.departments.find(d => d.id === u.departmentId)?.name || null,
      promotion: db.promotions.find(p => p.id === u.promotionId)?.name || null,
    }));

    // Create paginated response
    const result = createPaginatedResponse(enriched, pagination);

    return NextResponse.json({
      ...result,
      faculties: db.faculties,
      departments: db.departments,
      promotions: db.promotions,
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
    
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
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
    
    if (db.users.some(u => u.email.toLowerCase() === parsed.data.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé', code: 'DUPLICATE_EMAIL' },
        { status: 409, headers: getSecurityHeaders() }
      );
    }
    
    if (parsed.data.matricule && db.users.some(u => u.matricule === parsed.data.matricule)) {
      return NextResponse.json(
        { error: 'Ce matricule existe déjà', code: 'DUPLICATE_MATRICULE' },
        { status: 409, headers: getSecurityHeaders() }
      );
    }

    // FACULTY_ADMIN ne peut créer que dans sa faculté
    let facultyId = parsed.data.facultyId;
    if (user.role === 'FACULTY_ADMIN') facultyId = user.facultyId || facultyId;

    // Hash password with bcrypt (PHASE 1 security)
    const passwordHash = await hashPassword(parsed.data.password);

    const newUser = {
      id: genId('usr'),
      email: parsed.data.email,
      passwordHash, // Now properly hashed with bcrypt
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      matricule: parsed.data.matricule,
      role: parsed.data.role as UserRole,
      isActive: true,
      facultyId,
      departmentId: parsed.data.departmentId,
      promotionId: parsed.data.promotionId,
      createdAt: now(),
      updatedAt: now(),
    };

    db.users.push(newUser);
    await saveDB(db);
    
    await audit(
      user.sub,
      `${user.firstName} ${user.lastName}`,
      'CREATE_USER',
      'User',
      newUser.id,
      { email: newUser.email, role: newUser.role }
    );

    return NextResponse.json(
      { user: { ...newUser, passwordHash: undefined } }, 
      { status: 201, headers: getSecurityHeaders() }
    );
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
