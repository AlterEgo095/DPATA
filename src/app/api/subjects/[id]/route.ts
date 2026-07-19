// GET /api/subjects/[id] + PUT + DELETE
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await params;
  const db = await loadDB();
  const subject = (db.academicSubjects || []).find(s => s.id === id);
  if (!subject) return NextResponse.json({ error: 'Sujet introuvable' }, { status: 404 });
  return NextResponse.json({ subject });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role === 'STUDENT') return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const db = await loadDB();
  const subject = (db.academicSubjects || []).find(s => s.id === id);
  if (!subject) return NextResponse.json({ error: 'Sujet introuvable' }, { status: 404 });

  Object.assign(subject, body, { updatedAt: now() });
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'UPDATE_SUBJECT', 'AcademicSubject', subject.id, body);
  return NextResponse.json({ subject });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  const { id } = await params;
  const db = await loadDB();
  const subject = (db.academicSubjects || []).find(s => s.id === id);
  if (!subject) return NextResponse.json({ error: 'Sujet introuvable' }, { status: 404 });

  db.academicSubjects = (db.academicSubjects || []).filter(s => s.id !== id);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'DELETE_SUBJECT', 'AcademicSubject', id, { title: subject.title });
  return NextResponse.json({ success: true });
}
