// CSRF Protection Middleware
// PHASE 1 HARDING SÉCURITÉ
// 
// Ce module fournit:
// - Génération de tokens CSRF
// - Validation des tokens
// - Intégration avec les routes API

import crypto from 'crypto';
import { cookies } from 'next/server';

const CSRF_COOKIE_NAME = 'dpata_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a new CSRF token and set it as a cookie
 * Call this when rendering forms or after login
 */
export async function generateCSRFToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  
  // Set CSRF token in cookie (for later validation)
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JavaScript needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 2, // 2 hours
    path: '/',
  });
  
  return token;
}

/**
 * Validate CSRF token from request
 * Checks both header and body for the token
 */
export async function validateCSRFFromRequest(req: Request): Promise<boolean> {
  // Skip for GET/HEAD/OPTIONS (safe methods)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }

  const cookieStore = await cookies();
  const storedToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (!storedToken) {
    return false;
  }

  // Check header first, then form body
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  
  if (headerToken) {
    return timingSafeEqual(headerToken, storedToken);
  }

  // For form submissions, check body
  try {
    const clonedReq = req.clone();
    const body = await clonedReq.formData();
    const bodyToken = body.get('csrfToken') as string | null;
    
    if (bodyToken) {
      return timingSafeEqual(bodyToken, storedToken);
    }
  } catch {
    // Not a form submission
  }

  // For JSON API requests with token in body
  try {
    const clonedReq = req.clone();
    const body = await clonedReq.json() as { csrfToken?: string };
    
    if (body.csrfToken) {
      return timingSafeEqual(body.csrfToken, storedToken);
    }
  } catch {
    // Not JSON or no csrfToken field
  }

  return false;
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Get CSRF token name for templates
 */
export function getCSRFFieldName(): string {
  return 'csrfToken';
}

/**
 * Get CSRF header name for API clients
 */
 export function getCSRFHeaderName(): string {
  return CSRF_HEADER_NAME;
}
