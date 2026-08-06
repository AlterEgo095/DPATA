// POST /api/auth/register
// Public student self-registration endpoint
//
// P4-D D6: Added audit() call (user.register) — captures IP + UA + new user
// metadata (no password hash, only safe fields). This closes the
// "REGISTER is not audit-logged" gap flagged in AUDIT-4 §6.1.

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type UserRole } from '@/lib/store/db';
import { hashPassword, getSecurityHeaders, sanitizeError } from '@/lib/security';
import { rateLimiter, createRateLimitResponse } from '@/lib/api/middleware/rate-limiter';
import { z } from 'zod';
import { getRequestMeta } from '@/lib/request-meta';

// 🔒 XSS Prevention: Sanitize user input by stripping HTML tags and dangerous patterns
function sanitizeInput(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove any HTML tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick=, etc.)
    .trim();
}

const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(128),
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères').max(100),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
  matricule: z.string().optional(),
  facultyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Extract request meta up-front so the audit call can use it.
  const { ip, userAgent } = getRequestMeta(req);

  try {
    // Rate limiting - 5 registrations per hour per IP
    // P2-B: Fixed rateLimiter.check() call signature.
    const rateLimit = rateLimiter.check(ip, { maxRequests: 5, windowMs: 3600000 });
    
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: 'Données invalides', 
          details: parsed.error.flatten(),
          code: 'VALIDATION_ERROR' 
        },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const sanitizedData = {
      ...parsed.data,
      firstName: sanitizeInput(parsed.data.firstName),
      lastName: sanitizeInput(parsed.data.lastName),
      email: parsed.data.email.toLowerCase().trim(),
      matricule: parsed.data.matricule ? sanitizeInput(parsed.data.matricule) : null,
    };

    if (sanitizedData.firstName.length < 2) {
      return NextResponse.json(
        { error: 'Prénom invalide après nettoyage', code: 'SANITIZATION_ERROR' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const db = await loadDB();
    
    if (db.users.some(u => u.email.toLowerCase() === sanitizedData.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé', code: 'DUPLICATE_EMAIL' },
        { status: 409, headers: getSecurityHeaders() }
      );
    }
    
    if (sanitizedData.matricule && db.users.some(u => u.matricule === sanitizedData.matricule)) {
      return NextResponse.json(
        { error: 'Ce matricule existe déjà', code: 'DUPLICATE_MATRICULE' },
        { status: 409, headers: getSecurityHeaders() }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const newUser = {
      id: genId('usr'),
      email: sanitizedData.email,
      passwordHash,
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName,
      matricule: sanitizedData.matricule ?? undefined,
      role: 'STUDENT' as UserRole,
      isActive: true,
      facultyId: sanitizedData.facultyId || undefined,
      departmentId: undefined,
      promotionId: undefined,
      createdAt: now(),
      updatedAt: now(),
    };

    db.users.push(newUser);
    await saveDB(db);

    console.log(`[REGISTER] New student registered: ${newUser.email} (${newUser.id})`);

    // ---------------------------------------------------------------
    // P4-D D6: audit log entry — user.register
    // ---------------------------------------------------------------
    // Self-registration: actor is the new user themselves (no admin
    // involved). userId = newUser.id (NOT undefined) so the audit log
    // can be filtered by the new user's ID immediately.
    try {
      await audit(
        newUser.id,
        `${newUser.firstName} ${newUser.lastName}`,
        'REGISTER',
        'User',
        newUser.id,
        {
          email: newUser.email,
          role: newUser.role,
          facultyId: newUser.facultyId,
          hasMatricule: !!newUser.matricule,
        },
        ip,
        {
          userAgent,
          method: 'POST',
          path: '/api/auth/register',
          after: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
          },
        }
      );
    } catch (auditErr) {
      console.error('[REGISTER] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        }
      },
      { status: 201, headers: getSecurityHeaders() }
    );
  } catch (e) {
    const error = sanitizeError(e);
    console.error('[REGISTER] Error:', error);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
