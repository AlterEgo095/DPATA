// GET /api/faculties (liste) + POST /api/faculties (création)
// 🔒 SÉCURITÉ: Validation Zod + gestion d'erreurs complète
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { sanitizeError, getSecurityHeaders } from '@/lib/security';
import { z } from 'zod';

const CreateSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }
    
    const db = await loadDB();

    // Enrichir avec comptes
    const faculties = db.faculties.map(f => ({
      ...f,
      departmentsCount: db.departments.filter(d => d.facultyId === f.id).length,
      usersCount: db.users.filter(u => u.facultyId === f.id).length,
      documentsCount: db.documents.filter(d => d.facultyId === f.id).length,
    }));

    return NextResponse.json({ faculties }, { headers: getSecurityHeaders() });
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
    
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const db = await loadDB();
    // Vérifier code unique
    if (db.faculties.some(f => f.code.toLowerCase() === parsed.data.code.toLowerCase())) {
      return NextResponse.json(
        { error: 'Ce code faculté existe déjà', code: 'DUPLICATE' },
        { status: 409, headers: getSecurityHeaders() }
      );
    }

    const faculty = {
      id: genId('fac'),
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    };
    db.faculties.push(faculty);
    await saveDB(db);
    await audit(user.sub, `${user.firstName} ${user.lastName}`, 'CREATE_FACULTY', 'Faculty', faculty.id, { code: faculty.code, name: faculty.name });

    return NextResponse.json({ faculty }, { status: 201, headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
