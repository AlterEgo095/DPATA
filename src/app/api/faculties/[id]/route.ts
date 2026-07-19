// GET /api/faculties/[id] (détail) + PUT (update) + DELETE + PATCH (toggle active)
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const UpdateSchema = z.object({
  code: z.string().min(2).max(20).optional(),
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await params;
  const db = await loadDB();
  const faculty = db.faculties.find(f => f.id === id);
  if (!faculty) return NextResponse.json({ error: 'Faculté introuvable' }, { status: 404 });

  return NextResponse.json({
    faculty,
    departments: db.departments.filter(d => d.facultyId === id),
    usersCount: db.users.filter(u => u.facultyId === id).length,
    documentsCount: db.documents.filter(d => d.facultyId === id).length,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = await loadDB();
  const faculty = db.faculties.find(f => f.id === id);
  if (!faculty) return NextResponse.json({ error: 'Faculté introuvable' }, { status: 404 });

  // Vérifier unicité du code si modifié
  if (parsed.data.code && parsed.data.code !== faculty.code) {
    if (db.faculties.some(f => f.code.toLowerCase() === parsed.data.code!.toLowerCase())) {
      return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 409 });
    }
  }

  Object.assign(faculty, parsed.data, { updatedAt: now() });
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'UPDATE_FACULTY', 'Faculty', faculty.id, parsed.data);

  return NextResponse.json({ faculty });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { id } = await params;
  const db = await loadDB();
  const faculty = db.faculties.find(f => f.id === id);
  if (!faculty) return NextResponse.json({ error: 'Faculté introuvable' }, { status: 404 });

  // Vérifier s'il y a des départements liés
  const depsCount = db.departments.filter(d => d.facultyId === id).length;
  if (depsCount > 0) {
    return NextResponse.json({
      error: `Impossible de supprimer : ${depsCount} département(s) rattaché(s). Supprimez d'abord les départements.`,
    }, { status: 409 });
  }

  db.faculties = db.faculties.filter(f => f.id !== id);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'DELETE_FACULTY', 'Faculty', id, { code: faculty.code, name: faculty.name });

  return NextResponse.json({ success: true });
}
