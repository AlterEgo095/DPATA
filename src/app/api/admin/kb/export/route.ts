// /api/admin/kb/export — Export knowledge base
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB } from '@/lib/store/db';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }
  const db = await loadDB();
  // P2-B: Fixed db.subjects -> db.academicSubjects (DB schema uses academicSubjects)
  const subjects = (db.academicSubjects || []).map((s: any) => ({
    title: s.title,
    description: s.description,
    domain: s.domain,
    field: s.field,
    keywords: s.keywords,
    objectives: s.objectives,
    problemStatement: s.problemStatement,
    authorName: s.authorName,
    workType: s.workType,
    status: s.status,
    isOriginal: s.isOriginal,
    similarityScore: s.similarityScore,
    createdAt: s.createdAt,
  }));
  const format = new URL(req.url).searchParams.get('format') || 'json';
  if (format === 'csv') {
    const headers = Object.keys(subjects[0] || {}).join(',');
    const rows = subjects.map(s => Object.values(s).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const csv = headers + '\n' + rows;
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="kb-export.csv"' },
    });
  }
  return new NextResponse(JSON.stringify(subjects, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="kb-export.json"' },
  });
}
