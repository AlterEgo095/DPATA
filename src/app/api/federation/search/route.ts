// POST /api/federation/search
// Recherche interuniversitaire de plagiat : interroge les universités partenaires
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getUniversities } from '@/lib/federation/store';
import { detectPlagiat } from '@/lib/ia/engine';
import { loadDB } from '@/lib/store/db';
import type { FederationMatch, FederationSearchResponse } from '@/lib/federation/types';
import { z } from 'zod';

const SearchSchema = z.object({
  text: z.string().min(50),
  threshold: z.number().min(0).max(1).default(0.15),
  universities: z.array(z.string()).default([]), // vide = toutes les actives
  scope: z.enum(['faculty', 'department', 'all']).default('all'),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role === 'STUDENT') {
    return NextResponse.json({ error: 'Les étudiants ne peuvent pas faire de recherche fédérée' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = SearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const startTime = Date.now();
  const { text, threshold, universities: requestedUnis, scope } = parsed.data;

  // Récupérer les universités
  const allUnis = await getUniversities();
  const targetUnis = requestedUnis.length > 0
    ? allUnis.filter(u => requestedUnis.includes(u.id))
    : allUnis.filter(u => u.isActive);

  // Pour la démo : on simule en interrogeant localement
  // (en production : fetch vers chaque université partenaire)
  const allMatches: FederationMatch[] = [];
  let universitiesQueried = 0;

  for (const uni of targetUnis) {
    universitiesQueried++;

    if (uni.code === 'UNIKIN') {
      // Recherche locale (notre propre corpus)
      const db = await loadDB();
      const corpus = db.documents
        .filter(d => d.textExtract)
        .map(d => ({
          documentId: d.id,
          text: d.textExtract!,
        }));

      const result = detectPlagiat(text, corpus, threshold);

      for (const m of result.matches) {
        const doc = db.documents.find(d => d.id === m.sourceDocumentId);
        allMatches.push({
          universityCode: uni.code,
          universityName: uni.name,
          documentTitle: doc?.title || 'Document inconnu',
          documentId: m.sourceDocumentId,
          segmentIndex: m.sourceSegmentIndex,
          segmentText: m.sourceSegmentText,
          semanticScore: m.semanticScore,
          lexicalScore: m.lexicalScore,
          matchType: m.matchType,
        });
      }
    } else {
      // Simulation : en production, on ferait fetch(`${uni.apiUrl}/documents/search`)
      // Pour la démo, on simule quelques résultats aléatoires
      // (à remplacer par de vraies requêtes HTTP quand les partenaires seront connectés)
    }
  }

  // Trier par score décroissant
  allMatches.sort((a, b) => b.semanticScore - a.semanticScore);

  const response: FederationSearchResponse = {
    queryUniversity: 'UNIKIN',
    totalMatches: allMatches.length,
    matches: allMatches.slice(0, 50), // Top 50
    universitiesQueried,
    processingTimeMs: Date.now() - startTime,
  };

  return NextResponse.json(response);
}
