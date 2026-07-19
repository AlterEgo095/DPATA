// POST /api/subjects/import
// Import massif de sujets (CSV, JSON)
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type AcademicSubject } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { z } from 'zod';

const ImportSchema = z.object({
  subjects: z.array(z.object({
    title: z.string().min(5),
    description: z.string().optional(),
    domain: z.string().optional(),
    field: z.string().optional(),
    specialty: z.string().optional(),
    level: z.string().optional(),
    keywords: z.string().optional(),
    objectives: z.string().optional(),
    problemStatement: z.string().optional(),
    academicYear: z.string().optional(),
    authorName: z.string().optional(),
    workType: z.string().optional(),
  })).min(1, 'Au moins un sujet requis'),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role === 'STUDENT') return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });

  const body = await req.json();
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });

  const db = await loadDB();
  if (!db.academicSubjects) db.academicSubjects = [];

  const imported: AcademicSubject[] = [];
  for (const item of parsed.data.subjects) {
    const subject: AcademicSubject = {
      id: genId('sub'),
      title: item.title,
      description: item.description,
      domain: item.domain,
      field: item.field,
      specialty: item.specialty,
      level: item.level,
      keywords: item.keywords,
      objectives: item.objectives,
      problemStatement: item.problemStatement,
      academicYear: item.academicYear,
      authorName: item.authorName,
      workType: (item.workType as any) || 'AUTRE',
      status: 'VALIDATED',
      isOriginal: true,
      createdAt: now(),
      updatedAt: now(),
    };
    db.academicSubjects.push(subject);
    imported.push(subject);
  }

  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'IMPORT_SUBJECTS', 'AcademicSubject', '', { count: imported.length });

  return NextResponse.json({
    imported: imported.length,
    subjects: imported.map(s => ({ id: s.id, title: s.title })),
  }, { status: 201 });
}
