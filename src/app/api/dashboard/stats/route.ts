// GET /api/dashboard/stats
import { NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const db = await loadDB();

  const students = db.users.filter(u => u.role === 'STUDENT').length;
  const teachers = db.users.filter(u => u.role === 'TEACHER').length;
  const admins = db.users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'FACULTY_ADMIN').length;

  const completedAnalyses = db.analyses.filter(a => a.status === 'COMPLETED');
  const pendingAnalyses = db.analyses.filter(a => a.status === 'PENDING' || a.status === 'RUNNING').length;
  const avgScore = completedAnalyses.length > 0
    ? completedAnalyses.reduce((sum, a) => sum + (a.globalScore || 0), 0) / completedAnalyses.length
    : null;

  // Documents par faculté
  const byFaculty = db.faculties.map(f => ({
    faculty: f.name,
    count: db.documents.filter(d => d.facultyId === f.id).length,
  })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    faculties: db.faculties.length,
    departments: db.departments.length,
    promotions: db.promotions.length,
    users: db.users.filter(u => u.role !== 'SUPER_ADMIN').length,
    students,
    teachers,
    admins,
    documents: db.documents.length,
    analyses: db.analyses.length,
    pendingAnalyses,
    completedAnalyses: completedAnalyses.length,
    avgScore,
    recentAudit: db.auditLogs.slice(0, 20),
    documentsByFaculty: byFaculty,
  });
}
