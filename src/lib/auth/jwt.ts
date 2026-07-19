// Authentification JWT via jose
// PHASE 1 HARDING SÉCURITÉ - JWT Secret obligatoire + sécurité renforcée

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { loadDB, type User, type UserRole } from '@/lib/store/db';

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
  iat?: number;
  exp?: number;
}

// ============================================================================
// Token Generation & Verification
// ============================================================================

/**
 * Sign a new JWT token for the given user
 * Includes issued-at and expiration claims
 */
export async function signToken(user: User): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
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
 * Returns null if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: 'dpata-v2',
      audience: 'dpata-app',
    });
    return payload as unknown as JWTPayload;
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

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getTokenFromCookies();
  if (!token) return null;
  return verifyToken(token);
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
 */
export async function requireRole(...roles: UserRole[]): Promise<JWTPayload> {
  const user = await requireAuth();
  if (!hasRole(user, ...roles)) {
    throw new Error('FORBIDDEN');
  }
  return user;
}
