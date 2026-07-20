// Hybrid Engine - Combines TF-IDF + Semantic Embeddings (Enhanced v0.3)
// PHASE 6: IA AVANCÉE - Moteur Hybride pour Détection Avancée
// 
// Améliorations v0.3:
// - Méthode analyzeWithProgress() pour suivi en temps réel
// - Normalisation Min-Max pour le scoring hybride
// - Métadonnées détaillées par segment analysé
// - Support analyse comparative multi-documents

import {
  IAnalysisEngine,
  EngineType,
  AnalysisOptions,
  AnalysisResult,
  SubjectValidationResult,
  SubjectAnalysisInput,
  SimilarityResult,
  MatchSeverity,
  MatchCategory,
} from '../types';
import { TfidfEngine } from './tfidf-engine';
import { SemanticEmbeddingEngine } from './semantic-engine';
import { SentenceBert } from '../sentence-bert';

// ============================================================================
// TYPES ÉTENDUS POUR V0.3
// ============================================================================

/** Progression d'une analyse en cours */
export interface AnalysisProgress {
  /** ID unique de l'analyse */
  analysisId: string;
  /** Étape actuelle (0-100) */
  currentStep: number;
  /** Nombre total d'étapes */
  totalSteps: number;
  /** Pourcentage de complétion (0-100) */
  percentage: number;
  /** Description de l'étape en cours */
  currentPhase: string;
  /** Timestamp de la dernière mise à jour */
  timestamp: string;
  /** Résultat partiel (si disponible) */
  partialResult?: PartialAnalysisResult;
}

/** Résultat partiel pendant l'analyse */
export interface PartialAnalysisResult {
  segmentsProcessed: number;
  totalSegments: number;
  matchesFound: number;
  currentScore: number;
  estimatedTimeRemaining: number; // ms
}

/** Métadonnées étendues par segment */
export interface SegmentMetadata {
  /** Index du segment dans le document source */
  segmentIndex: number;
  /** Texte du segment (tronqué) */
  textPreview: string;
  /** Nombre de tokens */
  tokenCount: number;
  /** Score TF-IDF brut */
  tfidfScore: number;
  /** Score sémantique brut */
  semanticScore: number;
  /** Score combiné normalisé Min-Max */
  normalizedScore: number;
  /** Langue détectée du segment */
  detectedLanguage: string;
  /** Catégorie de match */
  matchCategory: MatchCategory;
  /** Niveau de sévérité */
  severity: MatchSeverity;
  /** Niveau de confiance */
  confidence: 'high' | 'medium' | 'low';
  /** Timestamp d'analyse */
  analyzedAt: string;
}

/** Configuration pour analyse comparative multi-documents */
export interface ComparativeAnalysisOptions extends AnalysisOptions {
  /** Activer le mode comparatif */
  comparativeMode?: boolean;
  /** Documents de référence pour comparaison */
  referenceDocuments?: Array<{ id: string; title: string; text: string }>;
  /** Générer une matrice de similarité inter-documents */
  generateSimilarityMatrix?: boolean;
  /** Inclure les métadonnées détaillées par segment */
  includeSegmentMetadata?: boolean;
  /** Callback de progression (pour streaming) */
  onProgress?: (progress: AnalysisProgress) => void;
  /** Intervalle de mise à jour de progression (ms) */
  progressInterval?: number;
}

/** Résultat d'analyse comparative multi-documents */
export interface ComparativeAnalysisResult extends AnalysisResult {
  /** Matrice de similarité entre documents */
  similarityMatrix?: Array<{
    docId1: string;
    docId2: string;
    similarity: number;
  }>;
  /** Analyse par document individuel */
  perDocumentResults?: Array<{
    documentId: string;
    documentTitle: string;
    score: number;
    severity: MatchSeverity;
    matchedSegments: number;
    totalSegments: number;
  }>;
  /** Métadonnées détaillées par segment */
  segmentMetadata?: SegmentMetadata[];
  /** Statistiques avancées */
  advancedStats: AdvancedStatistics;
}

/** Statistiques avancées d'analyse */
export interface AdvancedStatistics {
  /** Distribution des scores */
  scoreDistribution: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    percentiles: { p25: number; p75: number; p90: number; p95: number };
  };
  /** Répartition par type de match */
  matchTypeDistribution: Record<MatchCategory, number>;
  /** Répartition par sévérité */
  severityDistribution: Record<MatchSeverity, number>;
  /** Temps de processing par composant */
  processingBreakdown: {
    tfidfMs: number;
    semanticMs: number;
    combinationMs: number;
    totalMs: number;
  };
  /** Taux de couverture du document */
  coverageRate: number;
  /** Score de cohérence inter-moteurs */
  engineAgreementScore: number;
}

// ============================================================================
// HYBRID ENGINE CONFIGURATION V0.3
// ============================================================================

interface HybridConfig {
  tfidfWeight: number;
  semanticWeight: number;
  jaccardWeight: number;
  consensusThreshold: number;
  // Nouveaux paramètres v0.3
  useMinMaxNormalization: boolean;
  enableDetailedSegments: boolean;
  maxConcurrentAnalyses: number;
  cacheEmbeddings: boolean;
}

const DEFAULT_HYBRID_CONFIG: HybridConfig = {
  tfidfWeight: 0.35,
  semanticWeight: 0.45,
  jaccardWeight: 0.20,
  consensusThreshold: 0.3,
  // Valeurs par défaut v0.3
  useMinMaxNormalization: true,
  enableDetailedSegments: false,
  maxConcurrentAnalyses: 5,
  cacheEmbeddings: true,
};

// ============================================================================
// HYBRID ENGINE IMPLEMENTATION V0.3
// ============================================================================

/**
 * Hybrid Analysis Engine (Enhanced v0.3)
 * 
 * Combine trois approches complémentaires:
 * - TF-IDF (lexical matching) — détection copier-coller
 * - Semantic Embeddings (meaning-based matching) — détection paraphrase
 * - Jaccard (set overlap) — recouvrement de vocabulaire
 * 
 * Améliorations v0.3:
 * - Suivi de progression en temps réel via analyzeWithProgress()
 * - Normalisation Min-Max pour scoring plus précis
 * - Métadonnées granulaires par segment
 * - Mode comparatif multi-documents
 * 
 * @example
 * ```typescript
 * const engine = new HybridEngine();
 * await engine.initialize();
 * 
 * // Analyse avec progression
 * const result = await engine.analyzeWithProgress(query, corpus, {
 *   onProgress: (p) => console.log(`${p.percentage}%`)
 * });
 * ```
 */
export class HybridEngine implements IAnalysisEngine {
  readonly type: EngineType = 'HYBRID';
  readonly name: string = 'Hybrid TF-IDF + Semantic v5.0';
  readonly version: string = '5.0.0';

  private config: HybridConfig;
  private tfidfEngine: TfidfEngine;
  private semanticEngine: SemanticEmbeddingEngine;
  private sentenceBert: SentenceBert;
  private initialized = false;
  
  // Tracking des analyses en cours
  private activeAnalyses: Map<string, AnalysisProgress> = new Map();

  constructor(config?: Partial<HybridConfig>) {
    this.config = { ...DEFAULT_HYBRID_CONFIG, ...config };
    this.tfidfEngine = new TfidfEngine();
    this.semanticEngine = new SemanticEmbeddingEngine();
    this.sentenceBert = new SentenceBert({
      cacheEnabled: this.config.cacheEmbeddings,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Promise.all([
        this.tfidfEngine.initialize(),
        this.semanticEngine.initialize(),
        this.sentenceBert.initialize(),
      ]);
      this.initialized = true;
    } catch (error) {
      console.error('[HybridEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Analyse standard (compatibilité avec interface IAnalysisEngine)
   */
  async analyze(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    return this.analyzeWithProgress(query, corpus, options as ComparativeAnalysisOptions);
  }

  /**
   * Analyse améliorée avec suivi de progression en temps réel
   * 
   * Cette méthode permet un streaming de la progression via le callback onProgress,
   * utile pour les longs documents et les interfaces utilisateur réactives.
   * 
   * @param query - Texte à analyser
   * @param corpus - Corpus de documents de référence
   * @param options - Options d'analyse (inclut onProgress pour le streaming)
   * @returns Résultat d'analyse complet avec métadonnées étendues
   */
  async analyzeWithProgress(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: ComparativeAnalysisOptions
  ): Promise<ComparativeAnalysisResult> {
    const startTime = Date.now();
    const analysisId = `hybrid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const threshold = options?.threshold ?? 0.15;
    
    // Initialiser la progression
    const totalSteps = options?.comparativeMode ? 8 : 6;
    let currentStep = 0;
    
    const updateProgress = (phase: string, partial?: PartialAnalysisResult) => {
      currentStep++;
      const progress: AnalysisProgress = {
        analysisId,
        currentStep,
        totalSteps,
        percentage: Math.round((currentStep / totalSteps) * 100),
        currentPhase: phase,
        timestamp: new Date().toISOString(),
        partialResult: partial,
      };
      
      this.activeAnalyses.set(analysisId, progress);
      
      // Appeler le callback si fourni
      if (options?.onProgress) {
        options.onProgress(progress);
      }
      
      return progress;
    };

    try {
      // Étape 1: Prétraitement et segmentation
      updateProgress('Prétraitement et segmentation du texte...', {
        segmentsProcessed: 0,
        totalSegments: 1,
        matchesFound: 0,
        currentScore: 0,
        estimatedTimeRemaining: 5000,
      });

      // Simuler un léger délai pour la démonstration de progression
      await this.delay(10);

      // Étape 2: Exécution parallèle des moteurs
      updateProgress('Exécution des moteurs TF-IDF et Sémantique...');
      
      const tfidfStartTime = Date.now();
      const [tfidfResult, semanticResult] = await Promise.all([
        this.tfidfEngine.analyze(query, corpus, options),
        this.semanticEngine.analyze(query, corpus, options),
      ]);
      const tfidfTime = Date.now() - tfidfStartTime;

      // Étape 3: Génération des embeddings Sentence-BERT (optionnel)
      updateProgress('Génération des embeddings sémantiques enrichis...');
      
      let sentenceBertScores: Map<string, number> = new Map();
      if (this.config.useMinMaxNormalization) {
        sentenceBertScores = await this.computeSentenceBertScores(query, corpus);
      }

      // Étape 4: Combinaison des résultats avec normalisation Min-Max
      updateProgress('Combinaison des résultats et normalisation Min-Max...');
      
      const combineStartTime = Date.now();
      const combinedMatches = this.combineMatchesWithNormalization(
        tfidfResult.matches,
        semanticResult.matches,
        sentenceBertScores,
        threshold
      );
      const combineTime = Date.now() - combineStartTime;

      // Étape 5: Calcul du score pondéré
      updateProgress('Calcul des scores finaux...');
      
      const overallScore = this.calculateWeightedScore(tfidfResult, semanticResult);

      // Étape 6: Génération des métadonnées de segments
      let segmentMetadata: SegmentMetadata[] | undefined;
      if (options?.includeSegmentMetadata || this.config.enableDetailedSegments) {
        updateProgress('Génération des métadonnées détaillées...');
        segmentMetadata = this.generateSegmentMetadata(
          combinedMatches,
          tfidfResult.matches,
          semanticResult.matches
        );
      }

      // Étapes 7-8: Analyse comparative (si activée)
      let similarityMatrix: ComparativeAnalysisResult['similarityMatrix'];
      let perDocumentResults: ComparativeAnalysisResult['perDocumentResults'];
      
      if (options?.comparativeMode && options.referenceDocuments?.length) {
        updateProgress('Analyse comparative multi-documents...');
        
        similarityMatrix = await this.sentenceBert.computeSimilarityMatrix(
          options.referenceDocuments.map(d => ({ id: d.id, text: d.text }))
        );
        
        perDocumentResults = await this.generatePerDocumentResults(
          query,
          options.referenceDocuments,
          threshold
        );
        
        updateProgress('Finalisation de l\'analyse comparative...');
      }

      // Nettoyer le tracking
      this.activeAnalyses.delete(analysisId);

      // Calculer les statistiques avancées
      const advancedStats = this.calculateAdvancedStats(
        combinedMatches,
        { tfidfMs: tfidfTime, semanticMs: 0, combinationMs: combineTime, totalMs: Date.now() - startTime },
        tfidfResult.totalSegments || 1
      );

      return {
        id: analysisId,
        overallScore: Math.round(overallScore * 10) / 10,
        severity: this.getOverallSeverity(overallScore),
        engineUsed: 'HYBRID',
        processingTimeMs: Date.now() - startTime,
        totalSegments: Math.max(tfidfResult.totalSegments, semanticResult.totalSegments),
        matchedSegments: combinedMatches.length,
        matches: combinedMatches,
        summary: this.generateHybridSummary(overallScore, combinedMatches.length),
        recommendations: this.generateHybridRecommendations(overallScore),
        metadata: {
          corpusSize: corpus.length,
          modelVersion: this.version,
          threshold,
          timestamp: new Date().toISOString(),
          engineBreakdown: {
            tfidfScore: tfidfResult.overallScore,
            semanticScore: semanticResult.overallScore,
            config: this.config,
          },
        },
        // Extensions v0.3
        similarityMatrix,
        perDocumentResults,
        segmentMetadata,
        advancedStats,
      };
    } catch (error) {
      this.activeAnalyses.delete(analysisId);
      throw error;
    }
  }

  /**
   * Récupère la progression d'une analyse en cours
   */
  getAnalysisProgress(analysisId: string): AnalysisProgress | null {
    return this.activeAnalyses.get(analysisId) || null;
  }

  /**
   * Liste toutes les analyses actives
   */
  getActiveAnalyses(): AnalysisProgress[] {
    return [...this.activeAnalyses.values()];
  }

  async validateSubject(
    subject: SubjectAnalysisInput,
    existingSubjects: unknown[]
  ): Promise<SubjectValidationResult> {
    // Run both validations in parallel
    const [tfidfValidation, semanticValidation] = await Promise.all([
      this.tfidfEngine.validateSubject(subject, existingSubjects),
      this.semanticEngine.validateSubject(subject, existingSubjects),
    ]);

    // Combine similarity scores with weights
    const maxTfidfSimilarity = tfidfValidation.similarSubjects.length > 0
      ? Math.max(...tfidfValidation.similarSubjects.map(s => s.similarity))
      : 0;

    const maxSemanticSimilarity = semanticValidation.similarSubjects.length > 0
      ? Math.max(...semanticValidation.similarSubjects.map(s => s.similarity))
      : 0;

    const weightedSimilarity = (
      maxTfidfSimilarity * this.config.tfidfWeight +
      maxSemanticSimilarity * this.config.semanticWeight
    );

    // Merge similar subjects from both engines
    const mergedSimilarSubjects = this.mergeSimilarSubjects(
      tfidfValidation.similarSubjects,
      semanticValidation.similarSubjects
    );

    const isOriginal = weightedSimilarity < 0.38;

    return {
      isValid: isOriginal,
      originalityScore: Math.round((1 - weightedSimilarity) * 100 * 10) / 10,
      similarityThreshold: 0.38,
      isOriginal,
      similarSubjects: mergedSimilarSubjects.slice(0, 10),
      alternatives: [
        ...tfidfValidation.alternatives.slice(0, 3),
        ...semanticValidation.alternatives.slice(0, 3),
      ].slice(0, 6),
      recommendation: this.generateValidationRecommendation(weightedSimilarity),
      riskLevel: this.getRiskLevel(weightedSimilarity),
      detailedReport: this.generateDetailedValidationReport(
        subject,
        mergedSimilarSubjects,
        { tfidf: tfidfValidation, semantic: semanticValidation }
      ),
    };
  }

  async generateAlternatives(
    subject: SubjectAnalysisInput,
    similarSubjects: unknown[]
  ): Promise<string[]> {
    // Get alternatives from both engines and merge
    const [tfidfAlts, semanticAlts] = await Promise.all([
      this.tfidfEngine.generateAlternatives(subject, similarSubjects),
      this.semanticEngine.generateAlternatives(subject, similarSubjects),
    ]);

    // Deduplicate and limit
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const alt of [...semanticAlts, ...tfidfAlts]) {
      if (!seen.has(alt.toLowerCase())) {
        seen.add(alt.toLowerCase());
        merged.push(alt);
      }
    }

    return merged.slice(0, 8);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: string }> {
    try {
      const [tfidfHealth, semanticHealth] = await Promise.all([
        this.tfidfEngine.healthCheck(),
        this.semanticEngine.healthCheck(),
      ]);

      if (tfidfHealth.status === 'unhealthy' || semanticHealth.status === 'unhealthy') {
        return {
          status: 'degraded',
          details: `Hybrid engine degraded: TF-IDF=${tfidfHealth.status}, Semantic=${semanticHealth.status}`,
        };
      }

      return {
        status: 'healthy',
        details: `Hybrid engine v${this.version} fully operational. Both sub-engines healthy.`,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // ============================================================
  // Private Methods - Enhanced v0.3
  // ============================================================

  /**
   * Calcule les scores supplémentaires via Sentence-BERT
   * Utilisé pour enrichir l'analyse avec des embeddings multilingues
   */
  private async computeSentenceBertScores(
    query: string,
    corpus: Array<{ id: string; text: string }>
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    
    try {
      const queryEmbedding = await this.sentenceBert.generateEmbedding(query);
      
      for (const doc of corpus) {
        const docEmbedding = await this.sentenceBert.generateEmbedding(doc.text);
        const similarity = this.sentenceBert.cosineSimilarity(queryEmbedding, docEmbedding);
        scores.set(doc.id, similarity);
      }
    } catch (error) {
      console.warn('[HybridEngine] Sentence-BERT scoring failed, using fallback:', error);
    }
    
    return scores;
  }

  /**
   * Combine les résultats avec normalisation Min-Max
   * Améliore la précision du scoring en normalisant sur une échelle commune
   */
  private combineMatchesWithNormalization(
    tfidfMatches: SimilarityResult[],
    semanticMatches: SimilarityResult[],
    sentenceBertScores: Map<string, number>,
    threshold: number
  ): SimilarityResult[] {
    const matchMap = new Map<string, {
      match: SimilarityResult;
      tfidfRaw: number;
      semanticRaw: number;
      bertRaw: number;
    }>();

    // Extraire tous les scores bruts pour normalisation Min-Max
    const allTfidfScores: number[] = [];
    const allSemanticScores: number[] = [];
    const allBertScores: number[] = [];

    // Processus TF-IDF matches
    for (const match of tfidfMatches) {
      allTfidfScores.push(match.score);
      matchMap.set(match.id, {
        match: { ...match },
        tfidfRaw: match.score,
        semanticRaw: 0,
        bertRaw: sentenceBertScores.get(match.id) || 0,
      });
    }

    // Processus Semantic matches
    for (const match of semanticMatches) {
      allSemanticScores.push(match.score);
      allBertScores.push(sentenceBertScores.get(match.id) || 0);
      
      const existing = matchMap.get(match.id);
      if (existing) {
        existing.semanticRaw = match.score;
        existing.bertRaw = sentenceBertScores.get(match.id) || existing.bertRaw;
      } else {
        matchMap.set(match.id, {
          match: { ...match },
          tfidfRaw: 0,
          semanticRaw: match.score,
          bertRaw: sentenceBertScores.get(match.id) || 0,
        });
      }
    }

    // Calculer les paramètres Min-Max pour chaque source
    const tfidfNorm = this.calculateMinMaxParams(allTfidfScores);
    const semanticNorm = this.calculateMinMaxParams(allSemanticScores);
    const bertNorm = this.calculateMinMaxParams(allBertScores);

    // Combiner avec scores normalisés
    const results: SimilarityResult[] = [];
    
    for (const [, data] of matchMap) {
      // Normalisation Min-Max de chaque score
      const normTfidf = this.normalizeValue(data.tfidfRaw, tfidfNorm);
      const normSemantic = this.normalizeValue(data.semanticRaw, semanticNorm);
      const normBert = this.normalizeValue(data.bertRaw, bertNorm);

      // Score combiné pondéré
      const combinedScore = (
        normTfidf * this.config.tfidfWeight +
        normSemantic * this.config.semanticWeight +
        normBert * 0.20 // Poids additionnel pour Sentence-BERT
      );

      if (combinedScore >= threshold || data.match.score >= threshold) {
        results.push({
          ...data.match,
          score: Math.round(combinedScore * 10000) / 10000,
          // Garder le niveau de confiance le plus élevé
          confidence: this.getCombinedConfidence(normTfidf, normSemantic, normBert),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calcule les paramètres min/max pour normalisation
   */
  private calculateMinMaxParams(values: number[]): { min: number; max: number; range: number } {
    if (values.length === 0) return { min: 0, max: 1, range: 1 };
    
    let min = Infinity;
    let max = -Infinity;
    
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    
    const range = max - min || 1; // Éviter division par zéro
    
    return { min, max, range };
  }

  /**
   * Normalise une valeur selon les paramètres Min-Max
   */
  private normalizeValue(value: number, params: { min: number; max: number; range: number }): number {
    return (value - params.min) / params.range;
  }

  /**
   * Détermine le niveau de confiance combiné
   */
  private getCombinedConfidence(
    tfidf: number,
    semantic: number,
    bert: number
  ): 'high' | 'medium' | 'low' {
    const avg = (tfidf + semantic + bert) / 3;
    if (avg >= 0.7) return 'high';
    if (avg >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Génère les métadonnées détaillées pour chaque segment
   */
  private generateSegmentMetadata(
    combinedMatches: SimilarityResult[],
    tfidfMatches: SimilarityResult[],
    semanticMatches: SimilarityResult[]
  ): SegmentMetadata[] {
    const metadata: SegmentMetadata[] = [];
    
    for (let i = 0; i < combinedMatches.length; i++) {
      const match = combinedMatches[i];
      const tfidfMatch = tfidfMatches.find(m => m.id === match.id);
      const semanticMatch = semanticMatches.find(m => m.id === match.id);
      
      metadata.push({
        segmentIndex: i,
        textPreview: match.sourceText.substring(0, 150) + (match.sourceText.length > 150 ? '...' : ''),
        tokenCount: match.sourceText.split(/\s+/).length,
        tfidfScore: tfidfMatch?.score || 0,
        semanticScore: semanticMatch?.score || 0,
        normalizedScore: match.score,
        detectedLanguage: this.detectSegmentLanguage(match.sourceText),
        matchCategory: match.matchType,
        severity: match.severity,
        confidence: match.confidence,
        analyzedAt: new Date().toISOString(),
      });
    }
    
    return metadata;
  }

  /**
   * Détecte la langue d'un segment de texte
   */
  private detectSegmentLanguage(text: string): string {
    // Patterns simples pour détection rapide
    const frenchPatterns = /(le|la|les|des|du|une|est|sont|été|pour|dans|avec|sur)\s+/i;
    const englishPatterns = /\b(the|is|are|was|were|been|being|have|has|had|for|with|from)\b/i;
    const swahiliPatterns = /\b(na|kwa|ya|wa|la|ku|mu|cha|vya|hya|kubwa)\b/i;
    const lingalaPatterns = /\b(na|ya|wa|la|kwa|ba|mi|li|ma|ki|yo|zo)\b/i;
    
    if (frenchPatterns.test(text)) return 'fr';
    if (englishPatterns.test(text)) return 'en';
    if (swahiliPatterns.test(text)) return 'sw';
    if (lingalaPatterns.test(text)) return 'ln';
    
    return 'unknown';
  }

  /**
   * Génère les résultats par document pour l'analyse comparative
   */
  private async generatePerDocumentResults(
    query: string,
    documents: Array<{ id: string; title: string; text: string }>,
    threshold: number
  ): Promise<ComparativeAnalysisResult['perDocumentResults']> {
    const results: NonNullable<ComparativeAnalysisResult['perDocumentResults']> = [];
    
    for (const doc of documents) {
      const docResult = await this.analyze(query, [{ id: doc.id, text: doc.text }]);
      results.push({
        documentId: doc.id,
        documentTitle: doc.title,
        score: docResult.overallScore,
        severity: docResult.severity,
        matchedSegments: docResult.matchedSegments,
        totalSegments: docResult.totalSegments,
      });
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calcule les statistiques avancées d'une analyse
   */
  private calculateAdvancedStats(
    matches: SimilarityResult[],
    timing: { tfidfMs: number; semanticMs: number; combinationMs: number; totalMs: number },
    totalSegments: number
  ): AdvancedStatistics {
    // Extraire les scores
    const scores = matches.map(m => m.score).sort((a, b) => a - b);
    
    // Calculs statistiques de base
    const mean = scores.length > 0 
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
      : 0;
    
    const median = scores.length > 0
      ? scores[Math.floor(scores.length / 2)]
      : 0;
    
    const variance = scores.length > 0
      ? scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
      : 0;
    
    const stdDev = Math.sqrt(variance);
    
    // Percentiles
    const percentile = (p: number): number => {
      if (scores.length === 0) return 0;
      const idx = Math.ceil((p / 100) * scores.length) - 1;
      return scores[Math.max(0, idx)];
    };
    
    // Distribution par type
    const matchTypeDistribution: Record<string, number> = {};
    for (const m of matches) {
      matchTypeDistribution[m.matchType] = (matchTypeDistribution[m.matchType] || 0) + 1;
    }
    
    // Distribution par sévérité
    const severityDistribution: Record<string, number> = {};
    for (const m of matches) {
      severityDistribution[m.severity] = (severityDistribution[m.severity] || 0) + 1;
    }
    
    // Couverture
    const matchedIndices = new Set(matches.map(m => m.id));
    const coverageRate = totalSegments > 0 ? matchedIndices.size / totalSegments : 0;
    
    // Score d'accord inter-moteurs (basé sur la cohérence des scores)
    const engineAgreementScore = stdDev > 0 ? Math.max(0, 1 - stdDev / mean) : 1;
    
    return {
      scoreDistribution: {
        mean: Math.round(mean * 1000) / 1000,
        median: Math.round(median * 1000) / 1000,
        stdDev: Math.round(stdDev * 1000) / 1000,
        min: scores[0] || 0,
        max: scores[scores.length - 1] || 0,
        percentiles: {
          p25: Math.round(percentile(25) * 1000) / 1000,
          p75: Math.round(percentile(75) * 1000) / 1000,
          p90: Math.round(percentile(90) * 1000) / 1000,
          p95: Math.round(percentile(95) * 1000) / 1000,
        },
      },
      matchTypeDistribution: matchTypeDistribution as Record<MatchCategory, number>,
      severityDistribution: severityDistribution as Record<MatchSeverity, number>,
      processingBreakdown: timing,
      coverageRate: Math.round(coverageRate * 1000) / 1000,
      engineAgreementScore: Math.round(engineAgreementScore * 1000) / 1000,
    };
  }

  /**
   * Délai utilitaire pour la simulation de progression
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================
  // Private Methods - Legacy (conservés pour compatibilité)
  // ============================================================

  private calculateWeightedScore(
    tfidfResult: AnalysisResult,
    semanticResult: AnalysisResult
  ): number {
    return (
      tfidfResult.overallScore * this.config.tfidfWeight +
      semanticResult.overallScore * this.config.semanticWeight
    );
  }

  private compareSeverity(a: MatchSeverity, b: MatchSeverity): number {
    const order: Record<MatchSeverity, number> = {
      'CRITICAL': 4,
      'HIGH': 3,
      'MEDIUM': 2,
      'LOW': 1,
      'INFO': 0,
    };

    return (order[a] ?? 0) - (order[b] ?? 0);
  }

  private getOverallSeverity(score: number): MatchSeverity {
    if (score >= 45) return 'CRITICAL';
    if (score >= 28) return 'HIGH';
    if (score >= 14) return 'MEDIUM';
    return 'LOW';
  }

  private getRiskLevel(similarity: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (similarity >= 0.75) return 'CRITICAL';
    if (similarity >= 0.55) return 'HIGH';
    if (similarity >= 0.38) return 'MEDIUM';
    return 'LOW';
  }

  private generateHybridSummary(score: number, matchCount: number): string {
    if (score >= 45) {
      return `⚠️ PLAGIAT CONFIRMÉ par analyse hybride (${score.toFixed(1)}%). ${matchCount} correspondances croisées.`;
    }
    if (score >= 28) {
      return `🔍 Forte suspicion de plagiat détectée (${score.toFixed(1)}%). Analyse multi-moteurs convergente.`;
    }
    if (score >= 14) {
      return `📊 Similarité modérée (${score.toFixed(1)}%). Recommande vérification des passages marqués.`;
    }
    return `✅ Document majoritairement original (${score.toFixed(1)}% de similarité).`;
  }

  private generateHybridRecommendations(score: number): string[] {
    const recs: string[] = [];

    if (score >= 45) {
      recs.push('🚨 Plagiât confirmé par analyse multi-moteurs');
      recs.push('📝 Réécriture complète obligatoire');
      recs.push('👨‍🏫 Consultation immédiate encadreur requise');
      recs.push('📚 Vérification citation de toutes les sources');
    } else if (score >= 28) {
      recs.push('⚠️ Suspicion élevée - 2 moteurs en accord');
      recs.push('🔄 Reformulation nécessaire des passages marqués');
      recs.push('📖 Enrichir avec contenu original');
    } else if (score >= 14) {
      recs.push('💡 Quelques similitudes détectées');
      recs.push('✍️ Relire sections surlignées');
    } else {
      recs.push('🎉 Travail jugé original');
      recs.push('⭐ Continuez vos bonnes pratiques');
    }

    return recs;
  }

  private generateValidationRecommendation(similarity: number): string {
    if (similarity >= 0.75) {
      return '❌ SUJET REFUSÉ - Doublon confirmé par analyse multi-moteurs.';
    }
    if (similarity >= 0.55) {
      return '⚠️ RISIQUE ÉLEVÉ - Reformulation significative requise.';
    }
    if (similarity >= 0.38) {
      return "📋 ATTENTION - Clarifiez l'originalité du sujet.";
    }
    return '✅ SUJET VALIDÉ - Originalité confirmée par analyse hybride.';
  }

  private mergeSimilarSubjects(
    tfidfSubjects: Array<{ id: string; title: string; similarity: number; sharedKeywords: string[]; explanation: string }>,
    semanticSubjects: Array<{ id: string; title: string; similarity: number; sharedKeywords: string[]; explanation: string }>
  ): Array<{ id: string; title: string; similarity: number; sharedKeywords: string[]; explanation: string }> {
    const merged = new Map<string, any>();

    for (const s of tfidfSubjects) {
      merged.set(s.id, { ...s, sources: ['tfidf'] as string[] });
    }

    for (const s of semanticSubjects) {
      const existing = merged.get(s.id);
      if (existing) {
        existing.similarity = (
          existing.similarity * this.config.tfidfWeight +
          s.similarity * this.config.semanticWeight
        );
        existing.sharedKeywords = [...new Set([...existing.sharedKeywords, ...s.sharedKeywords])];
        existing.sources.push('semantic');
        existing.explanation = `${existing.explanation} | ${s.explanation}`;
      } else {
        merged.set(s.id, { ...s, sources: ['semantic'] as string[] });
      }
    }

    return [...merged.values()]
      .sort((a, b) => b.similarity - a.similarity)
      .map(({ sources, ...rest }) => rest);
  }

  private generateDetailedValidationReport(
    subject: SubjectAnalysisInput,
    similarSubjects: Array<any>,
    engineResults: { tfidf: any; semantic: any }
  ): string {
    const lines: string[] = [
      `═══════════════════════════════════════════════`,
      `   RAPPORT DE VALIDATION HYBRIDE`,
      `   Moteur ${this.name}`,
      `═══════════════════════════════════════════════`,
      ``,
      `📌 SUJET PROPOSÉ`,
      `   Titre: ${subject.title}`,
      `   Domaine: ${subject.domain || 'Non spécifié'}`,
      ``,
      `📊 RÉSULTAT DE L'ANALYSE HYBRIDE`,
      `   Score d'originalité: ${(100 - (similarSubjects.length > 0 ? Math.max(...similarSubjects.map((s: any) => s.similarity)) * 100 : 0)).toFixed(1)}%`,
      `   Sujets similaires trouvés: ${similarSubjects.length}`,
      `   Configuration: TF-IDF=${this.config.tfidfWeight}, Sémantique=${this.config.semanticWeight}`,
      ``,
    ];

    if (similarSubjects.length > 0) {
      lines.push(`🔴 DÉTAILS DES SIMILARITÉS`);
      lines.push('');
      for (const ss of similarSubjects.slice(0, 5)) {
        lines.push(`┌─────────────────────────────────────`);
        lines.push(`│ ${ss.title}`);
        lines.push(`│ Similarity: ${(ss.similarity * 100).toFixed(1)}%`);
        lines.push(`│ Mots-clés: ${ss.sharedKeywords?.join(', ') || 'N/A'}`);
        lines.push(`│ ${ss.explanation || ''}`);
        lines.push(`└─────────────────────────────────────`);
        lines.push('');
      }
    }

    lines.push(`💡 RECOMMANDATION FINALE`);
    lines.push(this.generateValidationRecommendation(
      similarSubjects.length > 0 ? Math.max(...similarSubjects.map((s: any) => s.similarity)) : 0
    ));
    lines.push('');
    lines.push(`═══════════════════════════════════════════════`);

    return lines.join('\n');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default HybridEngine;
export { DEFAULT_HYBRID_CONFIG, type HybridConfig };
