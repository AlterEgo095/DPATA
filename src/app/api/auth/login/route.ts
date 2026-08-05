// Route API: POST /api/auth/login
// P0 FIX: Robust body parsing — handles JSON, form-urlencoded, and edge cases.

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, audit, saveDB } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { verifyPassword, migratePasswordHash, sanitizeError, generateCSRFToken, rateLimiters, getSecurityHeaders } from '@/lib/security';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

/**
 * Robust body parser — handles JSON, form-urlencoded, and empty bodies.
 * Fixes: "JSON Parse error: Unexpected identifier 'email'" when client sends form data.
 */
async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') || '';
  const raw = await req.text();

  if (!raw || raw.trim().length === 0) return {};

  // JSON body
  if (contentType.includes('application/json') || raw.trim().startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      // Malformed JSON — try form parsing as fallback
    }
  }

  // Form-urlencoded body (e.g., "email=xxx&password=yyy")
  if (contentType.includes('application/x-www-form-urlencoded') || raw.includes('=')) {
    try {
      const params = new URLSearchParams(raw);
      const obj: Record<string, string> = {};
      params.forEach((value, key) => { obj[key] = value; });
      if (Object.keys(obj).length > 0) return obj;
    } catch {
      // fall through
    }
  }

  // Last resort: try JSON anyway
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('x-real-ip') || 'unknown';

  // Rate limiting
  try {
    await rateLimiters.auth.consume(ip);
  } catch {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans 15 minutes.', code: 'RATE_LIMITED' },
      { status: 429, headers: getSecurityHeaders() }
    );
  }

  try {
    const body = await parseBody(req);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const { email, password } = parsed.data;
    const db = await loadDB();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
    const isValidPassword = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !isValidPassword) {
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect', code: 'INVALID_CREDENTIALS' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    // Auto-migrate legacy SHA256 -> bcrypt
    if (!user.passwordHash.startsWith('$2a$') && !user.passwordHash.startsWith('$2b$') && !user.passwordHash.startsWith('$2y$')) {
      const newHash = await migratePasswordHash(password);
      const idx = db.users.findIndex(u => u.id === user.id);
      if (idx !== -1) { db.users[idx].passwordHash = newHash; await saveDB(db); }
    }

    const token = await signToken(user);
    const csrf = generateCSRFToken();

    await audit(user.id, `${user.firstName} ${user.lastName}`, 'LOGIN', 'User', user.id, {}, ip);

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      csrfToken: csrf,
    }, { headers: getSecurityHeaders() });

    response.cookies.set('plagiat_token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
    });

    return response;
  } catch (e: any) {
    console.error('[LOGIN_ERROR]', e);
    return NextResponse.json(sanitizeError(e), { status: 500, headers: getSecurityHeaders() });
  }
}
