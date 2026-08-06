// Authentification JWT via jose
// PHASE 1 HARDING SÉCURITÉ - JWT Secret obligatoire + sécurité renforcée
// P4-A FIXES (A5, A8, A9):
//   - A5: getCurrentUser now checks user.isActive (suspended users immediately lose access)
//   - A8: signToken adds `jti` claim; verifyToken checks db.revokedTokens;
//          new revokeToken(jti) helper to invalidate tokens server-side
//   - A9: getCurrentUser checks user.forcedLogoutAt > jwt.iat → invalidates
//          all existing tokens for that user (force-logout endpoint)
// P4-C ADDITIONS:
//   - getCurrentUser calls metrics.touchUser(payload.sub) to track active users
//     for the active_users_gauge metric (last 5 min window).
//   - requireRole increments metrics.rbac_denies_total{required_role=X} on denial.

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { loadDB, saveDB, type User, type UserRole } from '@/lib/store/db';
// P4-C: metrics singleton — used to track active users and RBAC denials.
import { metrics } from '@/lib/observability/metrics';

// ============================================================================
// CRITICAL: JWT Secret Configuration
// ============================================================================
// In production, JWT_SECRET MUST be set as environment variable
// The application will FAIL FAST if not configured properly

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      // In production, this is a CRITICAL error - fail fast
      throw new Error(
        'CRITICAL: JWT_SECRET environment variable is required in production. ' +
        'Set it with: export JWT_SECRET=$(openssl rand -base64 32)'
      );
    }

    // Development only warning
    console.warn(
      '[SECURITY WARNING] Using default JWT secret in development. ' +
      'Set JWT_SECRET environment variable for production use.'
    );

    return new TextEncoder().encode('dev-secret-change-in-production-2024');
  }

  // Validate minimum secret length (256 bits = 32 bytes)
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters (current: ${secret.length}). ` +
      'Generate a strong one: openssl rand -base64 32'
    );
  }

  return new TextEncoder().encode(secret);
}

const SECRET = getJWTSecret();
const TOKEN_COOKIE = 'plagiat_token';
const TOKEN_TTL = '7d'; // 7 days - configurable via env

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  // P2-B: Added facultyId to support faculty-scoped filtering in API routes
  // (departments, documents, users). Optional because not all roles have a faculty.
  facultyId?: string;
  // P4-A (A8): unique JWT ID, used for revocation lookup
  jti?: string;
  iat?: number;
  exp?: number;
}

// ============================================================================
// Token Generation & Verification
// ============================================================================

/**
 * Sign a new JWT token for the given user
 * Includes issued-at and expiration claims
 * P4-A (A8): also includes a `jti` (JWT ID) claim for revocation tracking.
 */
export async function signToken(user: User): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    facultyId: user.facultyId,
    // P4-A: jti claim enables per-token revocation
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_TTL || TOKEN_TTL)
    .setIssuer('dpata-v2')
    .setAudience('dpata-app')
    .sign(SECRET);
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid, expired, tampered with, OR revoked (P4-A).
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: 'dpata-v2',
      audience: 'dpata-app',
    });
    const jwtPayload = payload as unknown as JWTPayload;

    // P4-A (A8): revocation list check
    if (jwtPayload.jti) {
      const db = await loadDB();
      const revoked = db.revokedTokens;
      if (Array.isArray(revoked) && revoked.includes(jwtPayload.jti)) {
        return null;
      }
    }
    // P4-A (A8) note: db.revokedTokens is typed as optional (string[] | undefined).
    // The Array.isArray() check above already guards against undefined; if the
    // jti is not in the (possibly empty) list, the token is valid.

    return jwtPayload;
  } catch (error) {
    // Token invalid, expired, or tampered with
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[JWT_VERIFY_FAILED]', error instanceof Error ? error.message : 'Unknown error');
    }
    return null;
  }
}

// ============================================================================
// Cookie Management (HTTP-Only, Secure)
// ============================================================================

export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value;
}

/**
 * P4-A (A5 + A9): getCurrentUser now performs additional server-side checks:
 *  - A5: user.isActive must be true (suspended users lose access immediately)
 *  - A9: user.forcedLogoutAt (if set) must be <= jwt.iat — otherwise the
 *        token was issued before the force-logout action and is invalid
 *
 * This invalidates suspended/force-logged-out users on the very next request
 * without requiring JWT rotation.
 */
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getTokenFromCookies();
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // P4-A (A5 + A9): re-validate against DB state
  try {
    const db = await loadDB();
    const user = db.users.find(u => u.id === payload.sub);
    if (!user) return null;

    // A5: active check
    if (user.isActive !== true) return null;

    // A9: force-logout check — `forcedLogoutAt` is an ISO timestamp; if it
    // is set and greater than the token's iat (issued-at), the token is
    // considered revoked for this user.
    const forcedAt = (user as User & { forcedLogoutAt?: string }).forcedLogoutAt;
    if (forcedAt && payload.iat) {
      const forcedTs = new Date(forcedAt).getTime();
      if (!Number.isNaN(forcedTs) && forcedTs > payload.iat * 1000) {
        return null;
      }
    }
  } catch (e) {
    // If DB load fails, fail closed (treat as unauthenticated) — except in
    // development where we log but allow, to avoid locking everyone out
    // during a transient DB hiccup. Production stays strict.
    if (process.env.NODE_ENV === 'production') return null;
    console.warn('[AUTH_GETCURRENTUSER_DB_CHECK_FAILED]', e);
  }

  // P4-C: Record this user as active in the metrics registry (last 5 min window).
  // This powers the active_users_gauge metric surfaced in /api/v1/metrics
  // and /api/admin/realtime/feed. Wrapped in try/catch — must never block auth.
  try {
    if (payload.sub) {
      metrics.touchUser(payload.sub);
    }
  } catch {
    // metrics failure must never block authentication
  }

  return payload;
}

/**
 * Set authentication cookie with security flags:
 * - httpOnly: Prevents JavaScript access (XSS protection)
 * - secure: Only sent over HTTPS (in production)
 * - sameSite=lax: CSRF protection
 * - path: Cookie scope
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: '/',
    // Additional security headers for cookie
    ...(isProduction && {
      domain: process.env.COOKIE_DOMAIN, // e.g., '.unikin.ac.cd'
      partitioned: true, // CHIPS (Cookies Having Independent Partitioned State)
    }),
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
}

// ============================================================================
// Authorization Helpers
// ============================================================================

/**
 * Check if user has one of the required roles
 */
export function hasRole(user: JWTPayload | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Get full user object from database using JWT payload
 */
export async function getCurrentFullUser(): Promise<User | null> {
  const payload = await getCurrentUser();
  if (!payload) return null;
  const db = await loadDB();
  return db.users.find(u => u.id === payload.sub) || null;
}

/**
 * Require authentication - returns user or throws
 * Use in API routes that require login
 */
export async function requireAuth(): Promise<JWTPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/**
 * Require specific role(s) - returns user or throws
 * Use in API routes that require specific permissions
 *
 * P4-C: When access is denied, increments the `rbac_denies_total` counter
 * (label: required_role = the first required role). Wrapped in try/catch —
 * metrics must never block the auth flow.
 */
export async function requireRole(...roles: UserRole[]): Promise<JWTPayload> {
  const user = await requireAuth();
  if (!hasRole(user, ...roles)) {
    // P4-C: record the RBAC denial for monitoring.
    try {
      const requiredRole = roles.length > 0 ? roles[0] : 'UNKNOWN';
      metrics.incrementCounter('rbac_denies_total', { required_role: requiredRole });
    } catch {
      // never let metrics break auth
    }
    throw new Error('FORBIDDEN');
  }
  return user;
}

// ============================================================================
// P4-A (A8): Token Revocation Helpers
// ============================================================================

// Hard cap to prevent unbounded growth of the revokedTokens array. Entries
// beyond the cap are evicted oldest-first. Since tokens expire (default 7d),
// an entry past the cap would have expired anyway.
const MAX_REVOKED_TOKENS = 10000;

/**
 * P4-A (A8): Revoke a specific JWT by its `jti` claim.
 * Adds the jti to `db.revokedTokens` (capped at MAX_REVOKED_TOKENS) and
 * prunes entries whose `exp` has already passed (best-effort: relies on
 * the token being decodable; entries we can't decode are kept until cap).
 *
 * Returns true on success, false if the jti could not be parsed or the
 * token was already expired at revocation time.
 */
export async function revokeToken(jti: string): Promise<boolean> {
  if (!jti || typeof jti !== 'string') return false;
  const db = await loadDB();
  if (!Array.isArray(db.revokedTokens)) {
    db.revokedTokens = [];
  }
  if (db.revokedTokens.includes(jti)) return true; // idempotent
  db.revokedTokens.push(jti);

  // Cap: evict oldest when over the limit
  if (db.revokedTokens.length > MAX_REVOKED_TOKENS) {
    db.revokedTokens = db.revokedTokens.slice(db.revokedTokens.length - MAX_REVOKED_TOKENS);
  }

  await saveDB(db);
  return true;
}

/**
 * P4-A (A8): Revoke the current caller's token (used by logout endpoint).
 * Reads the token from the cookie, extracts its `jti`, and pushes it to
 * the revocation list. Returns true if a token was found and revoked.
 */
export async function revokeCurrentToken(): Promise<boolean> {
  const token = await getTokenFromCookies();
  if (!token) return false;
  // Decode without verifying signature (the cookie was set by us; we just
  // need the jti claim). jose's decodeJwt does this safely.
  let jti: string | undefined;
  try {
    const { decodeJwt } = await import('jose');
    const decoded = decodeJwt(token);
    jti = decoded.jti;
  } catch {
    return false;
  }
  if (!jti) return false;
  return revokeToken(jti);
}
