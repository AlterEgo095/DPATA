// GET /api/users/[id] + PUT + DELETE
// 🔒 SÉCURITÉ: Les mots de passe sont hashés avec bcrypt avant stockage
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { hashPassword } from '@/lib/security';
import { z } from 'zod';

const UpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  matricule: z.string().max(50).optional().nullable(),
  role: z.enum(['FACULTY_ADMIN', 'TEACHER', 'STUDENT']).optional(),
  isActive: z.boolean().optional(),
  facultyId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  promotionId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { id } = await params;
    const db = await loadDB();
    const u = db.users.find(x => x.id === id);
    if (!u) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    return NextResponse.json({ user: { ...u, passwordHash: undefined } });
  } catch (e) {
    const { sanitizeError, getSecurityHeaders } = await import('@/lib/security');
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
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
  const u = db.users.find(x => x.id === id);
  if (!u) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  if (parsed.data.email && parsed.data.email !== u.email) {
    if (db.users.some(x => x.email.toLowerCase() === parsed.data.email!.toLowerCase())) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
    }
  }

  // Appliquer les modifications
  if (parsed.data.email) u.email = parsed.data.email;
  // 🔒 SÉCURITÉ: Hash le mot de passe avec bcrypt avant stockage
  if (parsed.data.password) u.passwordHash = await hashPassword(parsed.data.password);
  if (parsed.data.firstName) u.firstName = parsed.data.firstName;
  if (parsed.data.lastName) u.lastName = parsed.data.lastName;
  if (parsed.data.matricule !== undefined) u.matricule = parsed.data.matricule || undefined;
  if (parsed.data.role) u.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) u.isActive = parsed.data.isActive;
  if (parsed.data.facultyId !== undefined) u.facultyId = parsed.data.facultyId || undefined;
  if (parsed.data.departmentId !== undefined) u.departmentId = parsed.data.departmentId || undefined;
  if (parsed.data.promotionId !== undefined) u.promotionId = parsed.data.promotionId || undefined;
  u.updatedAt = now();

  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'UPDATE_USER', 'User', u.id, parsed.data);
  return NextResponse.json({ user: { ...u, passwordHash: undefined } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
    }
    const { id } = await params;
    const db = await loadDB();
    const u = db.users.find(x => x.id === id);
    if (!u) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    if (u.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Impossible de supprimer un super-admin' }, { status: 403 });

    db.users = db.users.filter(x => x.id !== id);
    await saveDB(db);
    await audit(user.sub, `${user.firstName} ${user.lastName}`, 'DELETE_USER', 'User', id, { email: u.email });
    return NextResponse.json({ success: true });
  } catch (e) {
    const { sanitizeError, getSecurityHeaders } = await import('@/lib/security');
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
