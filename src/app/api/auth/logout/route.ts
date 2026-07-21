// Route API: POST /api/auth/logout
// 🔒 SÉCURITÉ: Invalidation de session avec gestion d'erreurs
import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth/jwt';
import { getSecurityHeaders } from '@/lib/security';

export async function POST() {
  try {
    await clearAuthCookie();
    return NextResponse.json(
      { success: true, message: 'Déconnexion réussie' },
      { headers: getSecurityHeaders() }
    );
  } catch (e) {
    // Même en cas d'erreur, on retourne un succès (le cookie va expirer seul)
    console.error('[LOGOUT_ERROR]', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { success: true, message: 'Déconnexion effectuée' },
      { headers: getSecurityHeaders() }
    );
  }
}
