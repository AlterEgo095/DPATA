// GET /api/subjects/stats
// 🔒 SÉCURITÉ: Gestion d'erreurs ajoutée
import { NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { computeSubjectStats } from '@/lib/ia/subjectEngine';
import { sanitizeError, getSecurityHeaders } from '@/lib/security';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }
    
    const db = await loadDB();
    const stats = computeSubjectStats(db.academicSubjects || [], db.subjectValidations || []);
    
    return NextResponse.json(stats, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
