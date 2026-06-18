// GET /api/documents (liste filtrée par rôle) + POST (création métadonnées)
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type Document as Doc } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';

const CreateSchema = z.object({
  title: z.string().min(3).max(300),
  type: z.enum(['TFC', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE']).default('TFC'),
  subject: z.string().max(500).optional(),
  abstract: z.string().max(5000).optional(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  textExtract: z.string().optional(),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  promotionId: z.string().optional(),
  academicYear: z.string().default('2025-2026'),
  supervisedById: z.string().optional(),
  keywords: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const db = await loadDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const facultyId = searchParams.get('facultyId');

  let docs = db.documents;
  // Filtrage par rôle
  if (user.role === 'STUDENT') {
    docs = docs.filter(d => d.uploadedById === user.sub);
  } else if (user.role === 'TEACHER') {
    docs = docs.filter(d => d.supervisedById === user.sub || d.uploadedById === user.sub);
  } else if (user.role === 'FACULTY_ADMIN') {
    docs = docs.filter(d => d.facultyId === user.facultyId);
  }
  if (status) docs = docs.filter(d => d.status === status);
  if (facultyId) docs = docs.filter(d => d.facultyId === facultyId);

  const enriched = docs.map(d => ({
    ...d,
    uploadedBy: db.users.find(u => u.id === d.uploadedById),
    supervisedBy: db.users.find(u => u.id === d.supervisedById),
    faculty: db.faculties.find(f => f.id === d.facultyId)?.name || null,
    department: db.departments.find(dep => dep.id === d.departmentId)?.name || null,
    promotion: db.promotions.find(p => p.id === d.promotionId)?.name || null,
    analysis: db.analyses.find(a => a.documentId === d.id) || null,
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    documents: enriched,
    faculties: db.faculties,
    departments: db.departments,
    promotions: db.promotions,
    teachers: db.users.filter(u => u.role === 'TEACHER'),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });

  const db = await loadDB();
  let facultyId = parsed.data.facultyId;
  let departmentId = parsed.data.departmentId;
  let promotionId = parsed.data.promotionId;

  // Auto-rattachement si étudiant
  if (user.role === 'STUDENT') {
    const me = db.users.find(u => u.id === user.sub);
    facultyId = me?.facultyId;
    departmentId = me?.departmentId;
    promotionId = me?.promotionId;
  }
  if (!facultyId) return NextResponse.json({ error: 'Faculté requise' }, { status: 400 });

  const doc: Doc = {
    id: genId('doc'),
    title: parsed.data.title,
    type: parsed.data.type,
    subject: parsed.data.subject,
    abstract: parsed.data.abstract,
    fileName: parsed.data.fileName,
    fileSize: parsed.data.fileSize,
    mimeType: parsed.data.mimeType,
    textExtract: parsed.data.textExtract,
    status: 'SUBMITTED',
    facultyId,
    departmentId: departmentId || '',
    promotionId,
    academicYear: parsed.data.academicYear,
    uploadedById: user.sub,
    supervisedById: parsed.data.supervisedById,
    keywords: parsed.data.keywords,
    createdAt: now(),
    updatedAt: now(),
  };
  db.documents.push(doc);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'CREATE_DOCUMENT', 'Document', doc.id, { title: doc.title, type: doc.type });
  return NextResponse.json({ document: doc }, { status: 201 });
}
