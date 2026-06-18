// GET /api/documents/[id] + DELETE
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await params;
  const db = await loadDB();
  const doc = db.documents.find(d => d.id === id);
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });

  // Vérif permissions
  if (user.role === 'STUDENT' && doc.uploadedById !== user.sub) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  return NextResponse.json({
    document: {
      ...doc,
      uploadedBy: db.users.find(u => u.id === doc.uploadedById),
      supervisedBy: db.users.find(u => u.id === doc.supervisedById),
      faculty: db.faculties.find(f => f.id === doc.facultyId),
      department: db.departments.find(d => d.id === doc.departmentId),
      promotion: db.promotions.find(p => p.id === doc.promotionId),
    },
    analysis: db.analyses.find(a => a.documentId === id) || null,
    matches: db.matches.filter(m => m.analysisId === db.analyses.find(a => a.documentId === id)?.id),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await params;
  const db = await loadDB();
  const doc = db.documents.find(d => d.id === id);
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });

  // Permissions
  if (user.role === 'STUDENT' && doc.uploadedById !== user.sub) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (user.role === 'TEACHER' && doc.supervisedById !== user.sub && doc.uploadedById !== user.sub) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // Supprimer analyses et matches associés
  const analysesIds = db.analyses.filter(a => a.documentId === id).map(a => a.id);
  db.matches = db.matches.filter(m => !analysesIds.includes(m.analysisId));
  db.analyses = db.analyses.filter(a => a.documentId !== id);
  db.documents = db.documents.filter(d => d.id !== id);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'DELETE_DOCUMENT', 'Document', id, { title: doc.title });
  return NextResponse.json({ success: true });
}
