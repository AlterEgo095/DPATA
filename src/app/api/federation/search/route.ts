// POST /api/federation/search
// Recherche interuniversitaire de plagiat améliorée
// Support: multi-universités, agrégation, ranking, anonymisation

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getUniversities } from '@/lib/federation/store';
import { detectPlagiat } from '@/lib/ia/engine';
import { loadDB } from '@/lib/store/db';
import type { 
  FederationMatch, 
  FederatedSearchResult, 
  FederationSearchResponse,
  MatchType,
} from '@/lib/federation/types';
import { getPrivacyManager } from '@/lib/federation/privacy';
import { z } from 'zod';

// ============================================================
// SCHÉMA DE VALIDATION
// ============================================================

const SearchSchema = z.object({
  text: z.string().min(50).max(100000), // Max 100K caractères
  threshold: z.number().min(0).max(1).default(0.15),
  universities: z.array(z.string()).default([]), // vide = toutes les actives
  scope: z.enum(['faculty', 'department', 'all']).default('all'),
  maxResultsPerUniversity: z.number().min(5).max(100).default(20),
  includeAnonymizedOnly: z.boolean().default(true),
  sortBy: z.enum(['relevance', 'score', 'university', 'date']).default('relevance'),
});

// ============================================================
// TYPES INTERNES
// ============================================================

interface SearchContext {
  queryId: string;
  queryUniversity: string;
  startTime: number;
  requestedUniversities: string[];
}

// ============================================================
// UTILITAIRES
// ============================================================

function generateQueryId(): string {
  return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateCombinedScore(semanticScore: number, lexicalScore: number): number {
  // Pondération: 60% sémantique, 40% lexical
  return semanticScore * 0.6 + lexicalScore * 0.4;
}

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function matchTypeToEnum(type: string): MatchType {
  const typeMap: Record<string, MatchType> = {
    'COPY_PASTE': 'COPY_PASTE',
    'PARAPHRASE': 'PARAPHRASE',
    'REFORMULATION': 'REFORMULATION',
    'TRANSLATION': 'TRANSLATION',
    'WEAK_MATCH': 'WEAK_MATCH',
  };
  return typeMap[type] || 'WEAK_MATCH';
}

// ============================================================
// RECHERCHE LOCALE (NOTRE CORPUS)
// ============================================================

async function searchLocalCorpus(
  text: string,
  threshold: number,
  universityCode: string,
  universityName: string,
  maxResults: number
): Promise<FederatedMatch[]> {
  const db = await loadDB();
  
  const corpus = db.documents
    .filter(d => d.textExtract)
    .map(d => ({
      documentId: d.id,
      text: d.textExtract!,
    }));

  if (corpus.length === 0) return [];

  const result = detectPlagiat(text, corpus, threshold);
  const matches: FederatedMatch[] = [];
  const privacyManager = getPrivacyManager();

  for (const m of result.matches.slice(0, maxResults)) {
    const doc = db.documents.find(d => d.id === m.sourceDocumentId);
    
    // Hasher le segment texte pour ne pas l'envoyer en clair
    let segmentHash = '';
    try {
      segmentHash = await privacyManager.hashTextForComparison(m.sourceSegmentText)
        .then(r => r.fullHash);
    } catch {
      segmentHash = `hash_${m.sourceSegmentIndex}`;
    }

    matches.push({
      id: `match-${m.sourceDocumentId}-${m.sourceSegmentIndex}`,
      universityCode,
      universityName,
      documentId: m.sourceDocumentId,
      documentTitle: doc?.title || 'Document inconnu',
      documentType: doc?.type || 'AUTRE',
      segmentIndex: m.sourceSegmentIndex,
      segmentHash, // Hash au lieu du texte en clair!
      semanticScore: Math.round(m.semanticScore * 1000) / 1000,
      lexicalScore: Math.round(m.lexicalScore * 1000) / 1000,
      combinedScore: calculateCombinedScore(m.semanticScore, m.lexicalScore),
      matchType: matchTypeToEnum(m.matchType),
      confidence: getConfidenceLevel(calculateCombinedScore(m.semanticScore, m.lexicalScore)),
    });
  }

  return matches;
}

// ============================================================
// SIMULATION RECHERCHE DISTANTE
// ============================================================

async function simulateRemoteSearch(
  _text: string,
  _threshold: number,
  universityCode: string,
  universityName: string,
  _maxResults: number
): Promise<{ matches: FederatedMatch[]; responseTimeMs: number }> {
  // En production: fetch vers l'API de l'université partenaire
  // Pour la démo: simuler un délai et des résultats aléatoires
  
  // Simuler un délai réseau (200-800ms)
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 600));
  
  // Simuler quelques résultats pour certaines universités
  const mockResults: Record<string, FederatedMatch[]> = {
    'UNILU': [
      {
        id: 'match-remote-unilu-1',
        universityCode: 'UNILU',
        universityName: 'Université de Lubumbashi',
        documentId: 'doc-remote-001',
        documentTitle: 'Analyse des systèmes de gestion académique',
        documentType: 'MEMOIRE',
        segmentIndex: 3,
        segmentHash: 'hash_remote_unilu_abc123...',
        semanticScore: 0.72,
        lexicalScore: 0.58,
        combinedScore: 0.664,
        matchType: 'PARAPHRASE',
        confidence: 'medium',
      },
    ],
    'UCB': [
      {
        id: 'match-remote-ucb-1',
        universityCode: 'UCB',
        universityName: 'Université Catholique de Bukavu',
        documentId: 'doc-remote-002',
        documentTitle: 'Impact des TIC sur l\'éducation en RDC',
        documentType: 'TFC',
        segmentIndex: 1,
        segmentHash: 'hash_remote_ucb_def456...',
        semanticScore: 0.65,
        lexicalScore: 0.45,
        combinedScore: 0.57,
        matchType: 'REFORMULATION',
        confidence: 'low',
      },
    ],
  };

  const responseTimeMs = Math.floor(300 + Math.random() * 500);

  return {
    matches: mockResults[universityCode] || [],
    responseTimeMs,
  };
}

// ============================================================
// ROUTE PRINCIPALE
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authentification
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    if (user.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Les étudiants ne peuvent pas faire de recherche fédérée' }, 
        { status: 403 }
      );
    }

    // Validation des données
    const body = await request.json();
    const parsed = SearchSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Données invalides',
        details: parsed.error.flatten(),
      }, { status: 400 });
    }

    const { 
      text, 
      threshold, 
      universities: requestedUnis, 
      scope,
      maxResultsPerUniversity,
      sortBy,
    } = parsed.data;

    // Contexte de recherche
    const context: SearchContext = {
      queryId: generateQueryId(),
      queryUniversity: 'UNIKIN', // Notre université
      startTime,
      requestedUniversities: requestedUnis,
    };

    // Récupérer les universités cibles
    const allUnis = await getUniversities();
    const targetUnis = requestedUnis.length > 0
      ? allUnis.filter(u => requestedUnis.includes(u.id))
      : allUnis.filter(u => u.isActive);

    if (targetUnis.length === 0) {
      return NextResponse.json({
        error: 'Aucune université cible disponible pour la recherche',
        suggestion: 'Vérifiez que les universités sont actives ou spécifiez les universités cibles',
      }, { status: 400 });
    }

    // Hasher le texte query pour les logs (pas stocké!)
    const privacyManager = getPrivacyManager();
    const textHash = await privacyManager.hashTextForComparison(text);

    console.log(`[Federation/Search] Query ${context.queryId}: ${targetUnis.length} universities, hash=${textHash.fullHash.slice(0, 16)}...`);

    // Exécuter les recherches en parallèle
    const searchPromises = targetUnis.map(async (uni) => {
      const uniStartTime = Date.now();
      
      try {
        let matches: FederatedMatch[];
        
        if (uni.code === 'UNIKIN') {
          // Recherche locale (notre propre corpus)
          matches = await searchLocalCorpus(
            text, 
            threshold, 
            uni.code, 
            uni.name, 
            maxResultsPerUniversity
          );
        } else {
          // Recherche distante (ou simulation)
          const remoteResult = await simulateRemoteSearch(
            text,
            threshold,
            uni.code,
            uni.name,
            maxResultsPerUniversity
          );
          matches = remoteResult.matches;
        }

        const responseTimeMs = Date.now() - uniStartTime;

        const result: FederatedSearchResult = {
          universityName: uni.name,
          universityCode: uni.code,
          matches,
          responseTimeMs,
          timestamp: new Date(),
          status: 'success',
        };

        return result;

      } catch (error) {
        console.error(`[Federation/Search] Error searching ${uni.code}:`, error);
        
        return {
          universityName: uni.name,
          universityCode: uni.code,
          matches: [],
          responseTimeMs: Date.now() - uniStartTime,
          timestamp: new Date(),
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Attendre toutes les recherches
    const resultsByUniversity = await Promise.all(searchPromises);

    // Agréger tous les résultats
    const allMatches: FederatedMatch[] = resultsByUniversity.flatMap(r => r.matches);

    // Trier selon le critère choisi
    switch (sortBy) {
      case 'score':
        allMatches.sort((a, b) => b.combinedScore - a.combinedScore);
        break;
      case 'university':
        allMatches.sort((a, b) => a.universityCode.localeCompare(b.universityCode));
        break;
      case 'relevance':
      default:
        // Tri par pertinence combinée (score pondéré)
        allMatches.sort((a, b) => {
          const scoreDiff = b.combinedScore - a.combinedScore;
          if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
          // Tie-break par confiance
          const confidenceOrder = { high: 3, medium: 2, low: 1 };
          return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        });
        break;
    }

    // Limiter le nombre total de résultats
    const MAX_TOTAL_RESULTS = 200;
    const limitedMatches = allMatches.slice(0, MAX_TOTAL_RESULTS);

    // Calculer les statistiques finales
    const successfulQueries = resultsByUniversity.filter(r => r.status === 'success');
    const totalProcessingTime = Date.now() - startTime;

    // Construire la réponse
    const response: FederationSearchResponse = {
      queryId: context.queryId,
      queryUniversity: context.queryUniversity,
      totalMatches: limitedMatches.length,
      matches: limitedMatches,
      resultsByUniversity,
      universitiesQueried: targetUnis.length,
      universitiesResponded: successfulQueries.length,
      processingTimeMs: totalProcessingTime,
      timestamp: new Date(),
    };

    // Log de statistiques
    console.log(`[Federation/Search] Query ${context.queryId} completed: ${limitedMatches.length} matches from ${successfulQueries.length}/${targetUnis.length} universities in ${totalProcessingTime}ms`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Federation/Search] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Erreur interne lors de la recherche fédérée',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined,
      },
      { status: 500 }
    );
  }
}

// GET - Endpoint optionnel pour les stats de recherche (non utilisé actuellement)
export async function GET() {
  return NextResponse.json({
    message: 'Utilisez POST pour effectuer une recherche fédérée',
    endpoint: '/api/federation/search',
    method: 'POST',
    schema: {
      text: 'string (min 50 chars)',
      threshold: 'number (0-1, default 0.15)',
      universities: 'string[] (optional, empty = all active)',
      scope: 'faculty | department | all',
      maxResultsPerUniversity: 'number (5-100, default 20)',
      sortBy: 'relevance | score | university | date',
    },
  });
}
