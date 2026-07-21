// AI Analysis API - Analyse Hybride Avancée
// v0.3 — Endpoint pour analyses TF-IDF + Semantic Embeddings
//
// Routes:
// POST /api/ai/analyze      - Lancer une analyse hybride complète
// GET  /api/ai/analyze      - Récupérer les analyses en cours
// GET  /api/ai/analyze/[id] - Statut d'une analyse spécifique
//
// Supporte:
// - Streaming progress via Server-Sent Events (optionnel)
// - Analyse comparative multi-documents
// - Métadonnées détaillées par segment

import { NextRequest, NextResponse } from 'next/server';
import { EngineFactoryEnhanced } from '@/lib/ia/engine-factory-enhanced';
import {
  ComparativeAnalysisResult,
  AnalysisProgress,
} from '@/lib/ia/engines/hybrid-engine';

// ============================================================================
// TYPES POUR L'API
// ============================================================================

interface AnalyzeRequestBody {
  /** Texte à analyser (requis) */
  query: string;
  /** Corpus de documents de référence */
  corpus: Array<{ id: string; text: string; title?: string }>;
  /** Options d'analyse */
  options?: {
    /** Seuil de détection (0-1, défaut: 0.15) */
    threshold?: number;
    /** Type de moteur forcé (optionnel) */
    engineType?: 'TFIDF' | 'EMBEDDING' | 'HYBRID';
    /** Contexte d'analyse pour auto-sélection */
    context?: string;
    /** Mode comparatif multi-documents */
    comparativeMode?: boolean;
    /** Inclure les métadonnées détaillées */
    includeSegmentMetadata?: boolean;
    /** Langue du document */
    language?: 'fr' | 'en' | 'auto';
    /** Nombre max de résultats */
    maxResults?: number;
  };
}

interface AnalysisSession {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  result?: ComparativeAnalysisResult | any;
  error?: string;
  progress?: AnalysisProgress;
}

// ============================================================================
// STOCKAGE DES SESSIONS D'ANALYSE (MÉMOIRE)
// ============================================================================

const analysisSessions = new Map<string, AnalysisSession>();

/**
 * Génère un ID unique pour une analyse
 */
function generateAnalysisId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

/**
 * POST /api/ai/analyze - Lancer une analyse hybride complète
 * 
 * Corps de la requête:
 * ```json
 * {
 *   "query": "Texte à analyser pour plagiat",
 *   "corpus": [
 *     { "id": "doc1", "text": "Document de référence 1" },
 *     { "id": "doc2", "text": "Document de référence 2" }
 *   ],
 *   "options": {
 *     "threshold": 0.15,
 *     "engineType": "HYBRID",
 *     "comparativeMode": false,
 *     "includeSegmentMetadata": true
 *   }
 * }
 * ```
 * 
 * Réponse:
 * ```json
 * {
 *   "success": true,
 *   "analysisId": "analysis-xxx",
 *   "result": { ... },
 *   "processingTimeMs": 1234
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parser le corps de la requête
    let body: AnalyzeRequestBody;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: 'JSON invalide',
          message: 'Le corps de la requête doit être un JSON valide',
        },
        { status: 400 }
      );
    }

    // Validation des champs requis
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Champ "query" manquant ou invalide',
          message: 'Le texte à analyser est requis et doit être une chaîne de caractères',
        },
        { status: 400 }
      );
    }

    if (!body.corpus || !Array.isArray(body.corpus) || body.corpus.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Champ "corpus" manquant ou vide',
          message: 'Au moins un document de référence est requis',
        },
        { status: 400 }
      );
    }

    // Validation des documents du corpus
    for (let i = 0; i < body.corpus.length; i++) {
      const doc = body.corpus[i];
      if (!doc.id || !doc.text) {
        return NextResponse.json(
          {
            success: false,
            error: `Corpus invalide à l'index ${i}`,
            message: 'Chaque document doit avoir "id" (string) et "text" (string)',
          },
          { status: 400 }
        );
      }
    }

    // Créer la session d'analyse
    const analysisId = generateAnalysisId();
    const session: AnalysisSession = {
      id: analysisId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    analysisSessions.set(analysisId, session);

    // Vérifier si le client veut du streaming (Server-Sent Events)
    const acceptSSE = request.headers.get('accept')?.includes('text/event-stream');
    
    if (acceptSSE) {
      // Mode streaming avec SSE
      return handleStreamingAnalysis(analysisId, session, body);
    }

    // Mode standard (réponse unique)
    session.status = 'running';
    session.updatedAt = new Date().toISOString();

    // Récupérer la factory
    let factory: EngineFactoryEnhanced;
    try {
      factory = await EngineFactoryEnhanced.create();
    } catch (factoryError: any) {
      session.status = 'failed';
      session.error = factoryError.message;
      return NextResponse.json(
        {
          success: false,
          error: 'Erreur d\'initialisation du moteur IA',
          message: factoryError.message,
        },
        { status: 503 }
      );
    }

    // Préparer les options
    const analysisOptions: Parameters<typeof factory.analyze>[2] = {
      threshold: body.options?.threshold ?? 0.15,
      engine: body.options?.engineType as any,
      context: (body.options?.context as any) || 'general',
      includeExplanations: true,
      maxResults: body.options?.maxResults,
      language: body.options?.language as any,
    };

    // Options étendues pour l'analyse comparative
    const extendedOptions: Record<string, unknown> = {
      ...analysisOptions,
      comparativeMode: body.options?.comparativeMode ?? false,
      includeSegmentMetadata: body.options?.includeSegmentMetadata ?? false,
      referenceDocuments: body.options?.comparativeMode
        ? body.corpus.map(d => ({ id: d.id, title: d.title || d.id, text: d.text }))
        : undefined,
      onProgress: (progress: AnalysisProgress) => {
        session.progress = progress;
        session.updatedAt = new Date().toISOString();
      },
    };

    // Exécuter l'analyse
    try {
      let result;
      
      if (body.options?.includeSegmentMetadata || body.options?.comparativeMode) {
        // Utiliser analyzeWithProgress pour les fonctionnalités avancées
        result = await factory.analyzeWithProgress(body.query, body.corpus, extendedOptions as any);
      } else {
        // Analyse standard
        result = await factory.analyze(body.query, body.corpus, analysisOptions);
      }

      // Mettre à jour la session
      session.status = 'completed';
      session.result = result;
      session.updatedAt = new Date().toISOString();

      // Nettoyer les anciennes sessions (garder les 100 dernières)
      cleanupOldSessions();

      // Retourner le résultat
      return NextResponse.json({
        success: true,
        analysisId,
        result,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

    } catch (analysisError: any) {
      session.status = 'failed';
      session.error = analysisError.message;
      
      console.error('[AI Analyze] Erreur d\'analyse:', analysisError);
      
      return NextResponse.json(
        {
          success: false,
          analysisId,
          error: 'Erreur lors de l\'analyse',
          message: analysisError.message,
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[AI Analyze] Erreur inattendue:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Veuillez réessayer plus tard',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/analyze - Lister les analyses récentes ou récupérer une analyse spécifique
 * 
 * Query params:
 * - id: ID d'une analyse spécifique (optionnel)
 * - limit: Nombre de résultats à retourner (défaut: 20)
 * - status: Filtrer par statut (optionnel)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const statusFilter = searchParams.get('status');

    // Si un ID est fourni, retourner cette analyse spécifique
    if (analysisId) {
      const session = analysisSessions.get(analysisId);
      
      if (!session) {
        return NextResponse.json(
          {
            success: false,
            error: 'Analyse non trouvée',
            message: `Aucune analyse avec l'ID "${analysisId}"`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        analysis: session,
      });
    }

    // Sinon, lister les analyses récentes
    let sessions = Array.from(analysisSessions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filtrer par statut si demandé
    if (statusFilter) {
      sessions = sessions.filter(s => s.status === statusFilter);
    }

    // Limiter les résultats
    const limitedSessions = sessions.slice(0, Math.min(limit, 100));

    return NextResponse.json({
      success: true,
      analyses: limitedSessions,
      total: sessions.length,
      returned: limitedSessions.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[AI Analyze GET] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur de récupération des analyses',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// FONCTIONS AUXILIAIRES
// ============================================================================

/**
 * Gère l'analyse en mode streaming (Server-Sent Events)
 */
function handleStreamingAnalysis(
  analysisId: string,
  session: AnalysisSession,
  body: AnalyzeRequestBody
): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Fonction helper pour envoyer des événements SSE
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Envoyer l'ID d'analyse
        sendEvent('started', { analysisId, timestamp: new Date().toISOString() });

        // Initialiser la factory
        sendEvent('progress', { phase: 'initialization', percentage: 5 });
        
        const factory = await EngineFactoryEnhanced.create();
        
        sendEvent('progress', { phase: 'analyzing', percentage: 10 });

        // Préparer les options avec callback de progression
        const options: Record<string, unknown> = {
          threshold: body.options?.threshold ?? 0.15,
          comparativeMode: body.options?.comparativeMode ?? false,
          includeSegmentMetadata: body.options?.includeSegmentMetadata ?? false,
          referenceDocuments: body.options?.comparativeMode
            ? body.corpus.map(d => ({ id: d.id, title: d.title || d.id, text: d.text }))
            : undefined,
          onProgress: (progress: AnalysisProgress) => {
            session.progress = progress;
            sendEvent('progress', {
              ...progress,
              phase: progress.currentPhase,
              percentage: progress.percentage,
            });
          },
        };

        // Exécuter l'analyse
        const result = await factory.analyzeWithProgress(body.query, body.corpus, options as any);

        // Mettre à jour la session
        session.status = 'completed';
        session.result = result;

        // Envoyer le résultat final
        sendEvent('complete', {
          analysisId,
          result,
          processingTimeMs: result.processingTimeMs,
          timestamp: new Date().toISOString(),
        });

        controller.close();

      } catch (error: any) {
        session.status = 'failed';
        session.error = error.message;
        
        sendEvent('error', {
          analysisId,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
}

/**
 * Nettoie les anciennes sessions (garde les 100 plus récentes)
 */
function cleanupOldSessions(): void {
  if (analysisSessions.size <= 100) return;
  
  // Trier par date de création (plus ancien en premier)
  const sorted = Array.from(analysisSessions.entries())
    .sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());
  
  // Supprimer les plus anciennes
  const toDelete = sorted.slice(0, sorted.length - 100);
  for (const [id] of toDelete) {
    analysisSessions.delete(id);
  }
}
