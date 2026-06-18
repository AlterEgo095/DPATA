// GET /api/promotions + POST
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const CreateSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(100),
  level: z.string().min(1).max(20),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  departmentId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const db = await loadDB();
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');

  let proms = db.promotions;
  if (departmentId) proms = proms.filter(p => p.departmentId === departmentId);

  const enriched = proms.map(p => ({
    ...p,
    department: db.departments.find(d => d.id === p.departmentId)?.name || 'N/A',
    faculty: db.faculties.find(f => f.id === db.departments.find(d => d.id === p.departmentId)?.facultyId)?.name || 'N/A',
    studentsCount: db.users.filter(u => u.promotionId === p.id).length,
    documentsCount: db.documents.filter(d => d.promotionId === p.id).length,
  }));

  return NextResponse.json({
    promotions: enriched,
    departments: db.departments.map(d => ({
      id: d.id, name: d.name, code: d.code,
      facultyId: d.facultyId,
      faculty: db.faculties.find(f => f.id === d.facultyId)?.name || '',
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });

  const db = await loadDB();
  if (!db.departments.find(d => d.id === parsed.data.departmentId)) {
    return NextResponse.json({ error: 'Département introuvable' }, { status: 404 });
  }
  if (db.promotions.some(p => p.code.toLowerCase() === parsed.data.code.toLowerCase())) {
    return NextResponse.json({ error: 'Ce code promotion existe déjà' }, { status: 409 });
  }

  const prom = {
    id: genId('prom'),
    code: parsed.data.code,
    name: parsed.data.name,
    level: parsed.data.level,
    academicYear: parsed.data.academicYear,
    departmentId: parsed.data.departmentId,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  };
  db.promotions.push(prom);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'CREATE_PROMOTION', 'Promotion', prom.id, { code: prom.code, name: prom.name });
  return NextResponse.json({ promotion: prom }, { status: 201 });
}
