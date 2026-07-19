// GET /api/departments (liste, filtre par facultyId) + POST (création)
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const CreateSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  facultyId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const db = await loadDB();
  const { searchParams } = new URL(req.url);
  const facultyId = searchParams.get('facultyId');

  let departments = db.departments;
  if (facultyId) departments = departments.filter(d => d.facultyId === facultyId);

  // Si FACULTY_ADMIN, limiter à sa faculté
  if (user.role === 'FACULTY_ADMIN') {
    departments = departments.filter(d => d.facultyId === user.facultyId || d.facultyId === undefined);
  }

  const enriched = departments.map(d => ({
    ...d,
    faculty: db.faculties.find(f => f.id === d.facultyId)?.name || 'N/A',
    promotionsCount: db.promotions.filter(p => p.departmentId === d.id).length,
    usersCount: db.users.filter(u => u.departmentId === d.id).length,
    documentsCount: db.documents.filter(doc => doc.departmentId === d.id).length,
  }));

  return NextResponse.json({ departments: enriched, faculties: db.faculties });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = await loadDB();
  const faculty = db.faculties.find(f => f.id === parsed.data.facultyId);
  if (!faculty) return NextResponse.json({ error: 'Faculté introuvable' }, { status: 404 });

  if (db.departments.some(d => d.code.toLowerCase() === parsed.data.code.toLowerCase())) {
    return NextResponse.json({ error: 'Ce code département existe déjà' }, { status: 409 });
  }

  const dept = {
    id: genId('dep'),
    code: parsed.data.code,
    name: parsed.data.name,
    description: parsed.data.description,
    isActive: true,
    facultyId: parsed.data.facultyId,
    createdAt: now(),
    updatedAt: now(),
  };
  db.departments.push(dept);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'CREATE_DEPARTMENT', 'Department', dept.id, { code: dept.code, name: dept.name });

  return NextResponse.json({ department: dept }, { status: 201 });
}
