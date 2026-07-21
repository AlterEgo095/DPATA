// Route API: GET /api/auth/me — retourne l'utilisateur courant
// 🔒 SÉCURITÉ: Validation de session avec gestion d'erreurs complète
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB } from '@/lib/store/db';
import { sanitizeError, getSecurityHeaders } from '@/lib/security';

export async function GET() {
  try {
    const payload = await getCurrentUser();
    if (!payload) {
      return NextResponse.json(
        { user: null, authenticated: false }, 
        { status: 200, headers: getSecurityHeaders() }
      );
    }
    
    const db = await loadDB();
    const user = db.users.find(u => u.id === payload.sub);
    
    if (!user || !user.isActive) {
      return NextResponse.json(
        { user: null, authenticated: false, reason: 'account_not_found_or_inactive' },
        { status: 200, headers: getSecurityHeaders() }
      );
    }
    
    // 🔒 SÉCURITÉ: Ne jamais exposer le hash du mot de passe
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        matricule: user.matricule,
        role: user.role,
        facultyId: user.facultyId,
        departmentId: user.departmentId,
        promotionId: user.promotionId,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      authenticated: true,
    }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(
      { user: null, authenticated: false, error: error.error },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}
