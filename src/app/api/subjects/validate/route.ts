// POST /api/subjects/validate
// Mission 1 : Validation intelligente d'un sujet
// Mission 2 : Génération d'alternatives si doublon détecté
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type SubjectValidation } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { validateSubject, type SubjectInput } from '@/lib/ia/subjectEngine';
import { z } from 'zod';

const ValidateSchema = z.object({
  title: z.string().min(5, 'Le titre doit faire au moins 5 caractères'),
  description: z.string().max(5000).optional(),
  domain: z.string().max(200).optional(),
  keywords: z.string().max(1000).optional(),
  objectives: z.string().max(3000).optional(),
  problemStatement: z.string().max(3000).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const parsed = ValidateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });

  const { threshold, ...subjectData } = parsed.data;
  const thresholdValue = threshold ?? 0.20;

  const db = await loadDB();
  if (!db.academicSubjects) db.academicSubjects = [];

  // Récupérer tous les sujets existants comme base de connaissances
  const existingSubjects = db.academicSubjects.map(s => ({
    id: s.id,
    title: s.title,
    description: s.description,
    domain: s.domain,
    keywords: s.keywords,
    objectives: s.objectives,
    problemStatement: s.problemStatement,
  }));

  // Exécuter la validation IA
  const result = validateSubject(subjectData as SubjectInput, existingSubjects, thresholdValue);

  // Sauvegarder la validation
  if (!db.subjectValidations) db.subjectValidations = [];

  const validation: SubjectValidation = {
    id: genId('val'),
    submittedTitle: subjectData.title,
    submittedDescription: subjectData.description,
    submittedDomain: subjectData.domain,
    submittedKeywords: subjectData.keywords,
    submittedObjectives: subjectData.objectives,
    submittedProblemStatement: subjectData.problemStatement,
    submittedBy: user.sub,
    status: result.isOriginal ? 'VALIDATED' : (result.alternatives.length > 0 ? 'ALTERNATIVES_GENERATED' : 'REJECTED'),
    similarityScore: result.similarityScore,
    threshold: thresholdValue,
    isOriginal: result.isOriginal,
    report: result.report,
    similarSubjects: result.similarSubjects,
    alternatives: result.alternatives,
    createdAt: now(),
    completedAt: now(),
  };

  db.subjectValidations.push(validation);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'VALIDATE_SUBJECT', 'SubjectValidation', validation.id, {
    title: subjectData.title,
    isOriginal: result.isOriginal,
    score: result.similarityScore,
    alternatives: result.alternatives.length,
  });

  return NextResponse.json({
    validation,
    result: {
      isOriginal: result.isOriginal,
      similarityScore: result.similarityScore,
      threshold: result.threshold,
      report: result.report,
      recommendation: result.recommendation,
      similarSubjects: result.similarSubjects,
      alternatives: result.alternatives,
    },
  });
}
