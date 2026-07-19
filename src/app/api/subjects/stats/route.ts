// GET /api/subjects/stats
import { NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { computeSubjectStats } from '@/lib/ia/subjectEngine';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const db = await loadDB();
  const stats = computeSubjectStats(db.academicSubjects || [], db.subjectValidations || []);
  return NextResponse.json(stats);
}
