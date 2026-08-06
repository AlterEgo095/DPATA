// app/api/users/[id]/force-logout/route.ts — P4-C NEW: force-logout endpoint
//
// POST /api/users/[id]/force-logout
//   SUPER_ADMIN only
//   Revokes all active JWTs for the target user by setting
//   `user.forcedLogoutAt = now()`. The next request from that user will be
//   rejected with 401 by getCurrentUser() (jwt.ts), which checks
//   forcedLogoutAt > jwt.iat.
//
// Coordination with P4-A:
//   - P4-A Fix A8/A9 plans to add a JWT revocation list (jti-based). Until
//     that lands, the `forcedLogoutAt` timestamp approach is the primary
//     mechanism. It is simpler (no schema change for sessions table) and
//     works for all existing JWTs.
//   - If P4-A lands first, this endpoint should ALSO revoke via the jti
//     list. For now, the forcedLogoutAt approach is sufficient.
//
// Request body: none (empty or `{}`).
// Response shape:
//   { "success": true, "message": "Session utilisateur révoquée", "userId": "..." }
//
// Audit: emits a `user.force_logout` audit log entry.

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // RBAC: SUPER_ADMIN only.
    const admin = await getCurrentUser();
    if (!admin) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }
    if (admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'ID utilisateur requis', code: 'MISSING_USER_ID' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Extract IP for audit logging.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || undefined;

    const db = await loadDB();
    const targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable', code: 'USER_NOT_FOUND' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // Self-protection: a SUPER_ADMIN cannot force-logout another SUPER_ADMIN
    // (prevents privilege escalation / lockout). They can still force-logout
    // themselves (rare but legitimate).
    if (targetUser.role === 'SUPER_ADMIN' && targetUser.id !== admin.sub) {
      return NextResponse.json(
        { error: 'Impossible de forcer la déconnexion d\'un autre super-administrateur', code: 'CANNOT_FORCE_LOGOUT_SUPER_ADMIN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    // Set forcedLogoutAt to current ISO timestamp. getCurrentUser() in jwt.ts
    // will return null for any JWT issued BEFORE this timestamp, forcing the
    // user to re-authenticate.
    const revokedAt = now();
    targetUser.forcedLogoutAt = revokedAt;
    targetUser.updatedAt = revokedAt;

    await saveDB(db);

    // Audit log entry.
    await audit(
      admin.sub,
      `${admin.firstName} ${admin.lastName}`,
      'FORCE_LOGOUT',
      'User',
      targetUser.id,
      { targetEmail: targetUser.email, revokedAt },
      ip
    );

    return NextResponse.json({
      success: true,
      message: 'Session utilisateur révoquée',
      userId: targetUser.id,
      revokedAt,
    }, { status: 200, headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

/**
 * OPTIONS /api/users/[id]/force-logout — CORS preflight.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  });
}
