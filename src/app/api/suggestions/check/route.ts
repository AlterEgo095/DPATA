// POST /api/suggestions/check
// Vérifie l'originalité d'un sujet de mémoire proposé
// 🔒 SÉCURITÉ: Validation Zod + gestion d'erreurs complète
import { NextRequest, NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { detectPlagiat } from '@/lib/ia/engine';
import { sanitizeError, getSecurityHeaders } from '@/lib/security';
import { z } from 'zod';

const Schema = z.object({
  subject: z.string().min(10, 'Le sujet doit faire au moins 10 caractères'),
  departmentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const { subject, departmentId } = parsed.data;
    const db = await loadDB();

    // Corpus : tous les documents du même département (ou tous si pas de filtre)
    let corpusDocs = db.documents.filter(d => d.textExtract || d.subject);
    if (departmentId) {
      corpusDocs = corpusDocs.filter(d => d.departmentId === departmentId);
    }

    const corpus = corpusDocs.map(d => ({
      documentId: d.id,
      text: `${d.title}. ${d.subject || ''} ${d.textExtract?.slice(0, 500) || ''}`,
    }));

    // Texte à analyser : le sujet proposé
    const result = detectPlagiat(subject, corpus, 0.10);

    // Identifier les sujets les plus proches
    const similarSubjects = result.matches.map(m => {
      const doc = db.documents.find(d => d.id === m.sourceDocumentId);
      const score = m.semanticScore;
      let verdict = 'Faible similarité';
      if (score >= 0.50) verdict = 'DOUBLON probable';
      else if (score >= 0.30) verdict = 'Similarité élevée';
      else if (score >= 0.15) verdict = 'Similarité modérée';
      
      return {
        documentId: m.sourceDocumentId,
        title: doc?.title || 'Inconnu',
        subject: doc?.subject || '',
        similarity: score,
        verdict,
      };
    });

    const isOriginal = result.globalScore < 0.15;

    return NextResponse.json({
      subject,
      isOriginal,
      globalScore: result.globalScore,
      similarSubjects: similarSubjects.slice(0, 10),
      totalChecked: corpus.length,
      recommendation: isOriginal
        ? "✅ Ce sujet semble original. Aucun travail similaire n'a été trouvé dans le corpus."
        : result.globalScore >= 0.50
          ? "⚠️ Ce sujet est très proche d'un travail existant. Considérez le reformuler ou choisir un autre angle."
          : "ℹ️ Ce sujet présente des similarités avec des travaux existants. Vérifiez les travaux listés pour vous différencier.",
    }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
