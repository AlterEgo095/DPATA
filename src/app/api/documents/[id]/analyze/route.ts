// POST /api/documents/[id]/analyze
// Déclenche l'analyse IA d'un document en utilisant le moteur TypeScript natif
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, saveDB, genId, now, audit, type Analysis, type Match } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { detectPlagiat } from '@/lib/ia/engine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role === 'STUDENT') {
    return NextResponse.json({ error: 'Les étudiants ne peuvent pas déclencher d\'analyse' }, { status: 403 });
  }

  const { id } = await params;
  const db = await loadDB();
  const doc = db.documents.find(d => d.id === id);
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });

  // Vérifier qu'il n'y a pas déjà une analyse en cours
  const existing = db.analyses.find(a => a.documentId === id && (a.status === 'PENDING' || a.status === 'RUNNING'));
  if (existing) {
    return NextResponse.json({ error: 'Une analyse est déjà en cours pour ce document', analysis: existing }, { status: 409 });
  }

  // Créer l'analyse
  const analysis: Analysis = {
    id: genId('ana'),
    documentId: id,
    triggeredById: user.sub,
    status: 'RUNNING',
    threshold: 0.15,
    scope: 'faculty',
    startedAt: now(),
    createdAt: now(),
  };
  db.analyses.push(analysis);
  await saveDB(db);
  await audit(user.sub, `${user.firstName} ${user.lastName}`, 'TRIGGER_ANALYSIS', 'Analysis', analysis.id, { documentId: id });

  try {
    // Récupérer le texte du document
    const documentText = doc.textExtract || `[Document: ${doc.title}]\n\n${doc.abstract || ''}`;

    // Construire le corpus : tous les autres documents de la même faculté
    const corpusDocs = db.documents
      .filter(d =>
        d.id !== id &&
        d.facultyId === doc.facultyId &&
        d.textExtract
      )
      .map(d => ({
        documentId: d.id,
        text: d.textExtract!,
      }));

    // Exécuter l'analyse IA (moteur TypeScript natif)
    const iaResult = detectPlagiat(documentText, corpusDocs, analysis.threshold);

    // Mettre à jour l'analyse avec les résultats
    analysis.status = 'COMPLETED';
    analysis.globalScore = iaResult.globalScore;
    analysis.matchedSegments = iaResult.matchedSegments;
    analysis.totalSegments = iaResult.totalSegments;
    analysis.completedAt = now();

    // Insérer les matches
    const matches: Match[] = iaResult.matches.map(m => ({
      id: genId('mtc'),
      analysisId: analysis.id,
      querySegmentIndex: m.querySegmentIndex,
      querySegmentText: m.querySegmentText,
      sourceDocumentId: m.sourceDocumentId,
      sourceSegmentIndex: m.sourceSegmentIndex,
      sourceSegmentText: m.sourceSegmentText,
      semanticScore: m.semanticScore,
      lexicalScore: m.lexicalScore,
      matchType: m.matchType,
      createdAt: now(),
    }));
    db.matches.push(...matches);

    // Mettre à jour le statut du document
    doc.status = 'ANALYZED';
    doc.updatedAt = now();

    await saveDB(db);
    await audit(user.sub, `${user.firstName} ${user.lastName}`, 'ANALYSIS_COMPLETED', 'Analysis', analysis.id, {
      globalScore: analysis.globalScore,
      matchedSegments: analysis.matchedSegments,
      matchesCount: matches.length,
    });

    return NextResponse.json({
      analysis: {
        ...analysis,
        matches: matches.slice(0, 20),
        byType: iaResult.byType,
        metadata: iaResult.metadata,
      },
    });

  } catch (error: any) {
    analysis.status = 'FAILED';
    analysis.error = error.message;
    analysis.completedAt = now();
    await saveDB(db);
    await audit(user.sub, `${user.firstName} ${user.lastName}`, 'ANALYSIS_FAILED', 'Analysis', analysis.id, { error: error.message });

    return NextResponse.json({
      error: 'Erreur lors de l\'analyse',
      message: error.message,
      analysis,
    }, { status: 500 });
  }
}
