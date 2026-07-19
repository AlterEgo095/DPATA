// GET /api/users + POST
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type UserRole } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  matricule: z.string().max(50).optional(),
  role: z.enum(['FACULTY_ADMIN', 'TEACHER', 'STUDENT']),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  promotionId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const db = await loadDB();
  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');
  const facultyId = searchParams.get('facultyId');

  let users = db.users.filter(u => u.role !== 'SUPER_ADMIN');
  if (role) users = users.filter(u => u.role === role);
  if (facultyId) users = users.filter(u => u.facultyId === facultyId);
  if (user.role === 'FACULTY_ADMIN') users = users.filter(u => u.facultyId === user.facultyId);

  const enriched = users.map(u => ({
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
    matricule: u.matricule, role: u.role, isActive: u.isActive,
    facultyId: u.facultyId, departmentId: u.departmentId, promotionId: u.promotionId,
    createdAt: u.createdAt,
    faculty: db.faculties.find(f => f.id === u.facultyId)?.name || null,
    department: db.departments.find(d => d.id === u.departmentId)?.name || null,
    promotion: db.promotions.find(p => p.id === u.promotionId)?.name || null,
  }));

  return NextResponse.json({
    users: enriched,
    faculties: db.faculties,
    departments: db.departments,
    promotions: db.promotions,
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
  if (db.users.some(u => u.email.toLowerCase() === parsed.data.email.toLowerCase())) {
    return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 });
  }
  if (parsed.data.matricule && db.users.some(u => u.matricule === parsed.data.matricule)) {
    return NextResponse.json({ error: 'Ce matricule existe déjà' }, { status: 409 });
  }

  // FACULTY_ADMIN ne peut créer que dans sa faculté
  let facultyId = parsed.data.facultyId;
  if (user.role === 'FACULTY_ADMIN') facultyId = user.facultyId || facultyId;

  const newUser = {
    id: genId('usr'),
    email: parsed.data.email,
    passwordHash: parsed.data.password, // démo — hasher en prod
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
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'CREATE_USER', 'User', newUser.id, { email: newUser.email, role: newUser.role });
  return NextResponse.json({ user: { ...newUser, passwordHash: undefined } }, { status: 201 });
}
