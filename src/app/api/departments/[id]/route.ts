// GET /api/departments/[id] + PUT + DELETE
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const UpdateSchema = z.object({
  code: z.string().min(2).max(20).optional(),
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  facultyId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await params;
  const db = await loadDB();
  const dept = db.departments.find(d => d.id === id);
  if (!dept) return NextResponse.json({ error: 'Département introuvable' }, { status: 404 });

  return NextResponse.json({
    department: dept,
    faculty: db.faculties.find(f => f.id === dept.facultyId),
    promotions: db.promotions.filter(p => p.departmentId === id),
    usersCount: db.users.filter(u => u.departmentId === id).length,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const db = await loadDB();
  const dept = db.departments.find(d => d.id === id);
  if (!dept) return NextResponse.json({ error: 'Département introuvable' }, { status: 404 });

  if (parsed.data.code && parsed.data.code !== dept.code) {
    if (db.departments.some(d => d.code.toLowerCase() === parsed.data.code!.toLowerCase())) {
      return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 409 });
    }
  }

  Object.assign(dept, parsed.data, { updatedAt: now() });
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'UPDATE_DEPARTMENT', 'Department', dept.id, parsed.data);
  return NextResponse.json({ department: dept });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { id } = await params;
  const db = await loadDB();
  const dept = db.departments.find(d => d.id === id);
  if (!dept) return NextResponse.json({ error: 'Département introuvable' }, { status: 404 });

  const promCount = db.promotions.filter(p => p.departmentId === id).length;
  if (promCount > 0) {
    return NextResponse.json({ error: `${promCount} promotion(s) rattachée(s). Supprimez d'abord.` }, { status: 409 });
  }

  db.departments = db.departments.filter(d => d.id !== id);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'DELETE_DEPARTMENT', 'Department', id, { code: dept.code, name: dept.name });
  return NextResponse.json({ success: true });
}
