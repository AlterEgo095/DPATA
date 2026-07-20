// GET /api/subjects/[id] + PUT + DELETE
// PHASE 1 HARDING SÉCURITÉ - Validation Zod + sanitization

import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, now, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { sanitizeObject, sanitizeError, getSecurityHeaders } from '@/lib/security';
import { z } from 'zod';

// Validation schema for subject updates (prevent object injection)
const UpdateSubjectSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  domain: z.string().max(100).optional(),
  field: z.string().max(100).optional(),
  specialty: z.string().max(100).optional(),
  level: z.enum(['LICENCE', 'MASTER', 'DOCTORAT', 'DEA/Master', 'TFC', 'AUTRE']).optional(),
  keywords: z.string().max(500).optional(),
  objectives: z.string().max(1000).optional(),
  problemStatement: z.string().max(500).optional(),
  workType: z.enum(['MEMOIRE', 'TFC', 'THESE', 'PROJET', 'RAPPORT', 'AUTRE']).optional(),
  status: z.enum(['DRAFT', 'VALIDATED', 'APPROVED', 'REJECTED', 'ARCHIVED']).optional(),
  isOriginal: z.boolean().optional(),
}).strict(); // Reject unknown fields

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }
    
    const { id } = await params;
    
    // Sanitize ID to prevent injection
    const sanitizedId = sanitizeInput(id);
    const db = await loadDB();
    const subject = (db.academicSubjects || []).find(s => s.id === sanitizedId);
    
    if (!subject) {
      return NextResponse.json(
        { error: 'Sujet introuvable', code: 'NOT_FOUND' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }
    
    return NextResponse.json({ subject }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }
    
    if (user.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    const { id } = await params;
    const body = await req.json();
    
    // Validate input with Zod (prevents object injection)
    const parsed = UpdateSubjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: 'Données invalides', 
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten() 
        },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Sanitize all string inputs
    const sanitizedData = sanitizeObject(parsed.data);
    
    const db = await loadDB();
    const subjectIndex = (db.academicSubjects || []).findIndex(s => s.id === id);
    
    if (subjectIndex === -1) {
      return NextResponse.json(
        { error: 'Sujet introuvable', code: 'NOT_FOUND' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // Apply only validated and sanitized fields
    const subject = db.academicSubjects[subjectIndex];
    Object.assign(subject, sanitizedData, { updatedAt: now() });
    
    await saveDB(db);
    await audit(
      user.sub,
      `${user.firstName} ${user.lastName}`,
      'UPDATE_SUBJECT',
      'AcademicSubject',
      subject.id,
      sanitizedData
    );

    return NextResponse.json({ subject }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }
    
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    const { id } = await params;
    const db = await loadDB();
    const subject = (db.academicSubjects || []).find(s => s.id === id);
    
    if (!subject) {
      return NextResponse.json(
        { error: 'Sujet introuvable', code: 'NOT_FOUND' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    db.academicSubjects = (db.academicSubjects || []).filter(s => s.id !== id);
    await saveDB(db);
    
    await audit(
      user.sub,
      `${user.firstName} ${user.lastName}`,
      'DELETE_SUBJECT',
      'AcademicSubject',
      id,
      { title: subject.title }
    );

    return NextResponse.json(
      { success: true }, 
      { headers: getSecurityHeaders() }
    );
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}

// Import sanitizeInput for ID sanitization
import { sanitizeInput } from '@/lib/security';
