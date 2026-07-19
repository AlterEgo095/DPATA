// Authentification JWT via jose

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { loadDB, type User, type UserRole } from '@/lib/store/db';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'plagiat-ia-unikin-secret-2025-2026-very-long-key'
);
const TOKEN_COOKIE = 'plagiat_token';
const TOKEN_TTL = '7d';

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

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
    .setExpirationTime(TOKEN_TTL)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value;
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getTokenFromCookies();
  if (!token) return null;
  return verifyToken(token);
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
}

// Vérifie si l'utilisateur a l'un des rôles requis
export function hasRole(user: JWTPayload | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

// Récupère l'utilisateur complet depuis la DB
export async function getCurrentFullUser(): Promise<User | null> {
  const payload = await getCurrentUser();
  if (!payload) return null;
  const db = await loadDB();
  return db.users.find(u => u.id === payload.sub) || null;
}
