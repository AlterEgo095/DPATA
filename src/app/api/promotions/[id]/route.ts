// GET /api/promotions/[id] + PUT + DELETE
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const UpdateSchema = z.object({
  code: z.string().min(2).max(30).optional(),
  name: z.string().min(2).max(100).optional(),
  level: z.string().min(1).max(20).optional(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  departmentId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await params;
  const db = await loadDB();
  const prom = db.promotions.find(p => p.id === id);
  if (!prom) return NextResponse.json({ error: 'Promotion introuvable' }, { status: 404 });
  return NextResponse.json({ promotion: prom });
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
  const prom = db.promotions.find(p => p.id === id);
  if (!prom) return NextResponse.json({ error: 'Promotion introuvable' }, { status: 404 });

  Object.assign(prom, parsed.data, { updatedAt: now() });
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'UPDATE_PROMOTION', 'Promotion', prom.id, parsed.data);
  return NextResponse.json({ promotion: prom });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { id } = await params;
  const db = await loadDB();
  const prom = db.promotions.find(p => p.id === id);
  if (!prom) return NextResponse.json({ error: 'Promotion introuvable' }, { status: 404 });

  const studentsCount = db.users.filter(u => u.promotionId === id).length;
  if (studentsCount > 0) {
    return NextResponse.json({ error: `${studentsCount} étudiant(s) rattaché(s).` }, { status: 409 });
  }

  db.promotions = db.promotions.filter(p => p.id !== id);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'DELETE_PROMOTION', 'Promotion', id, { code: prom.code });
  return NextResponse.json({ success: true });
}
