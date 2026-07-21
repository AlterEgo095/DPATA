// GET /api/documents/[id] + DELETE
// 🔒 SÉCURITÉ: Gestion d'erreurs + validation des permissions
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { sanitizeError, getSecurityHeaders, sanitizeInput } from '@/lib/security';

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
    // 🔒 SÉCURITÉ: Sanitize l'ID
    const sanitizedId = sanitizeInput(id);
    const db = await loadDB();
    const doc = db.documents.find(d => d.id === sanitizedId);
    
    if (!doc) {
      return NextResponse.json(
        { error: 'Document introuvable', code: 'NOT_FOUND' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // Vérif permissions
    if (user.role === 'STUDENT' && doc.uploadedById !== user.sub) {
      return NextResponse.json(
        { error: 'Accès refusé', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    // 🔒 SÉCURITÉ: Ne pas exposer le textExtract dans la réponse par défaut
    return NextResponse.json({
      document: {
        ...doc,
        textExtract: undefined, // Ne pas exposer le texte complet
        uploadedBy: db.users.find(u => u.id === doc.uploadedById) ? {
          id: db.users.find(u => u.id === doc.uploadedById)!.id,
          firstName: db.users.find(u => u.id === doc.uploadedById)!.firstName,
          lastName: db.users.find(u => u.id === doc.uploadedById)!.lastName,
          email: db.users.find(u => u.id === doc.uploadedById)!.email,
          role: db.users.find(u => u.id === doc.uploadedById)!.role,
        } : null,
        supervisedBy: db.users.find(u => u.id === doc.supervisedById) ? {
          id: db.users.find(u => u.id === doc.supervisedById)!.id,
          firstName: db.users.find(u => u.id === doc.supervisedById)!.firstName,
          lastName: db.users.find(u => u.id === doc.supervisedById)!.lastName,
        } : null,
        faculty: db.faculties.find(f => f.id === doc.facultyId),
        department: db.departments.find(d => d.id === doc.departmentId),
        promotion: db.promotions.find(p => p.id === doc.promotionId),
      },
      analysis: db.analyses.find(a => a.documentId === sanitizedId) || null,
      matches: db.matches.filter(m => m.analysisId === db.analyses.find(a => a.documentId === sanitizedId)?.id),
    }, { headers: getSecurityHeaders() });
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
    
    const { id } = await params;
    // 🔒 SÉCURITÉ: Sanitize l'ID
    const sanitizedId = sanitizeInput(id);
    const db = await loadDB();
    const doc = db.documents.find(d => d.id === sanitizedId);
    
    if (!doc) {
      return NextResponse.json(
        { error: 'Document introuvable', code: 'NOT_FOUND' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // Permissions
    if (user.role === 'STUDENT' && doc.uploadedById !== user.sub) {
      return NextResponse.json(
        { error: 'Accès refusé', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }
    if (user.role === 'TEACHER' && doc.supervisedById !== user.sub && doc.uploadedById !== user.sub) {
      return NextResponse.json(
        { error: 'Accès refusé', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    // Supprimer analyses et matches associés
    const analysesIds = db.analyses.filter(a => a.documentId === sanitizedId).map(a => a.id);
    db.matches = db.matches.filter(m => !analysesIds.includes(m.analysisId));
    db.analyses = db.analyses.filter(a => a.documentId !== sanitizedId);
    db.documents = db.documents.filter(d => d.id !== sanitizedId);
    
    await saveDB(db);
    await audit(user.sub, `${user.firstName} ${user.lastName}`, 'DELETE_DOCUMENT', 'Document', sanitizedId, { title: doc.title });
    
    return NextResponse.json(
      { success: true },
      { headers: getSecurityHeaders() }
    );
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
