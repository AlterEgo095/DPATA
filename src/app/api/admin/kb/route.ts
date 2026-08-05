// /api/admin/kb - Knowledge Base management API
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB, saveDB, genId, now, audit } from '@/lib/store/db';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN')) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const db = await loadDB();
  let subjects = db.subjects || [];
  const q = searchParams.get('q');
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    subjects = subjects.filter((s: any) => {
      const text = `${s.title} ${s.description || ''} ${s.domain || ''} ${s.keywords || ''}`.toLowerCase();
      return terms.every(t => text.includes(t));
    });
  }
  const domain = searchParams.get('domain');
  if (domain) subjects = subjects.filter((s: any) => s.domain === domain);
  const sort = searchParams.get('sort') || 'createdAt';
  const dir = searchParams.get('dir') === 'asc' ? 1 : -1;
  subjects.sort((a: any, b: any) => {
    if (sort === 'title') return dir * (a.title || '').localeCompare(b.title || '');
    return dir * ((new Date(a[sort] || a.createdAt)).getTime() - (new Date(b[sort] || b.createdAt)).getTime());
  });
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const total = subjects.length;
  subjects = subjects.slice((page - 1) * limit, page * limit);
  const domains = [...new Set((db.subjects || []).map((s: any) => s.domain).filter(Boolean))];
  const stats = { total: (db.subjects || []).length, original: (db.subjects || []).filter((s: any) => s.isOriginal).length, duplicate: (db.subjects || []).filter((s: any) => !s.isOriginal).length, avgSimilarity: 0, domains };
  return NextResponse.json({ subjects, total, page, limit, stats });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN')) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const db = await loadDB();
    if (!db.subjects) db.subjects = [];
    const subject = {
      id: genId('sub'), title: body.title, description: body.description || '',
      domain: body.domain || '', field: body.field || '', specialty: body.specialty || '',
      level: body.level || '', keywords: body.keywords || '', objectives: body.objectives || '',
      problemStatement: body.problemStatement || '', authorName: body.authorName || '',
      workType: body.workType || 'MEMOIRE', status: 'VALIDATED', isOriginal: true, similarityScore: 0,
      facultyId: body.facultyId || '', departmentId: body.departmentId || '',
      academicYear: body.academicYear || '', createdAt: now(), updatedAt: now(),
    };
    db.subjects.push(subject);
    await saveDB(db);
    await audit(user.sub, `${user.firstName} ${user.lastName}`, 'CREATE_SUBJECT', 'Subject', subject.id, { title: subject.title });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Accès réservé' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get('ids')?.split(',') || [];
    if (!ids.length) return NextResponse.json({ error: 'Aucun ID' }, { status: 400 });
    const db = await loadDB();
    db.subjects = (db.subjects || []).filter((s: any) => !ids.includes(s.id));
    await saveDB(db);
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
