// POST /api/auth/register
// Public student self-registration endpoint

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, type UserRole } from '@/lib/store/db';
import { hashPassword, getSecurityHeaders, sanitizeError } from '@/lib/security';
import { rateLimiter, createRateLimitResponse } from '@/lib/api/middleware/rate-limiter';
import { z } from 'zod';

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
  try {
    // Rate limiting - 5 registrations per hour per IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = rateLimiter.check(ip, 5, 3600000); // 5 requests per hour
    
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

    // 🔒 Sanitize ALL user inputs to prevent XSS
    const sanitizedData = {
      ...parsed.data,
      firstName: sanitizeInput(parsed.data.firstName),
      lastName: sanitizeInput(parsed.data.lastName),
      email: parsed.data.email.toLowerCase().trim(),
      matricule: parsed.data.matricule ? sanitizeInput(parsed.data.matricule) : null,
    };

    // Re-validate after sanitization
    if (sanitizedData.firstName.length < 2) {
      return NextResponse.json(
        { error: 'Prénom invalide après nettoyage', code: 'SANITIZATION_ERROR' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Force fresh DB read to ensure we have latest data
    const db = await loadDB(true);
    
    // Check for existing email (case-insensitive)
    if (db.users.some(u => u.email.toLowerCase() === sanitizedData.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé', code: 'DUPLICATE_EMAIL' },
        { status: 409, headers: getSecurityHeaders() }
      );
    }
    
    // Check for existing matricule
    if (sanitizedData.matricule && db.users.some(u => u.matricule === sanitizedData.matricule)) {
      return NextResponse.json(
        { error: 'Ce matricule existe déjà', code: 'DUPLICATE_MATRICULE' },
        { status: 409, headers: getSecurityHeaders() }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(parsed.data.password);

    // Create new STUDENT user (self-registration only allows student role)
    const newUser = {
      id: genId('usr'),
      email: sanitizedData.email,
      passwordHash,
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName,
      matricule: sanitizedData.matricule,
      role: 'STUDENT' as UserRole, // Force STUDENT role for self-registration
      isActive: true,
      facultyId: sanitizedData.facultyId || null,
      departmentId: null,
      promotionId: null,
      createdAt: now(),
      updatedAt: now(),
    };

    db.users.push(newUser);
    await saveDB(db);

    console.log(`[REGISTER] New student registered: ${newUser.email} (${newUser.id})`);

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
