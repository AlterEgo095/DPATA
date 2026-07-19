// GET /api/subjects (liste) + POST (création)
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type AcademicSubject } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const CreateSchema = z.object({
  title: z.string().min(5).max(500),
  description: z.string().max(5000).optional(),
  domain: z.string().max(200).optional(),
  field: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  level: z.string().max(50).optional(),
  keywords: z.string().max(1000).optional(),
  objectives: z.string().max(3000).optional(),
  problemStatement: z.string().max(3000).optional(),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  academicYear: z.string().optional(),
  authorName: z.string().max(200).optional(),
  workType: z.enum(['TFC', 'TFE', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE']).optional(),
  synonyms: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const db = await loadDB();
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  const facultyId = searchParams.get('facultyId');
  const workType = searchParams.get('workType');

  let subjects = db.academicSubjects || [];
  if (domain) subjects = subjects.filter(s => s.domain?.toLowerCase().includes(domain.toLowerCase()));
  if (facultyId) subjects = subjects.filter(s => s.facultyId === facultyId);
  if (workType) subjects = subjects.filter(s => s.workType === workType);

  return NextResponse.json({ subjects, total: subjects.length });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });

  const db = await loadDB();
  if (!db.academicSubjects) db.academicSubjects = [];

  const subject: AcademicSubject = {
    id: genId('sub'),
    title: parsed.data.title,
    description: parsed.data.description,
    domain: parsed.data.domain,
    field: parsed.data.field,
    specialty: parsed.data.specialty,
    level: parsed.data.level,
    keywords: parsed.data.keywords,
    objectives: parsed.data.objectives,
    problemStatement: parsed.data.problemStatement,
    facultyId: parsed.data.facultyId,
    departmentId: parsed.data.departmentId,
    academicYear: parsed.data.academicYear,
    authorName: parsed.data.authorName,
    workType: parsed.data.workType,
    status: 'VALIDATED',
    isOriginal: true,
    synonyms: parsed.data.synonyms,
    createdAt: now(),
    updatedAt: now(),
  };

  db.academicSubjects.push(subject);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'CREATE_SUBJECT', 'AcademicSubject', subject.id, { title: subject.title });

  return NextResponse.json({ subject }, { status: 201 });
}
