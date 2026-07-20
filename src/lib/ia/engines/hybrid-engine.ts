// Hybrid Engine - Combines TF-IDF + Semantic Embeddings
// PHASE 6: IA AVANCÉE - Moteur Hybride pour Détection Avancée

import {
  IAnalysisEngine,
  EngineType,
  AnalysisOptions,
  AnalysisResult,
  SubjectValidationResult,
  SubjectAnalysisInput,
  SimilarityResult,
  MatchSeverity,
} from '../types';
import { TfidfEngine } from './tfidf-engine';
import { SemanticEmbeddingEngine } from './semantic-engine';

// ============================================================================
// HYBRID ENGINE CONFIGURATION
// ============================================================================

interface HybridConfig {
  tfidfWeight: number;
  semanticWeight: number;
  jaccardWeight: number;
  consensusThreshold: number; // Minimum agreement between engines
}

const DEFAULT_HYBRID_CONFIG: HybridConfig = {
  tfidfWeight: 0.35,
  semanticWeight: 0.45,
  jaccardWeight: 0.20,
  consensusThreshold: 0.3,
};

// ============================================================================
// HYBRID ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Hybrid Analysis Engine combining:
 * - TF-IDF (lexical matching)
 * - Semantic Embeddings (meaning-based matching)
 * - Jaccard (set overlap)
 * 
 * Uses weighted voting for final decision
 */
export class HybridEngine implements IAnalysisEngine {
  readonly type: EngineType = 'HYBRID';
  readonly name: string = 'Hybrid TF-IDF + Semantic v4.0';
  readonly version: string = '4.0.0';

  private config: HybridConfig;
  private tfidfEngine: TfidfEngine;
  private semanticEngine: SemanticEmbeddingEngine;
  private initialized = false;

  constructor(config?: Partial<HybridConfig>) {
    this.config = { ...DEFAULT_HYBRID_CONFIG, ...config };
    this.tfidfEngine = new TfidfEngine();
    this.semanticEngine = new SemanticEmbeddingEngine();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Promise.all([
        this.tfidfEngine.initialize(),
        this.semanticEngine.initialize(),
      ]);
      this.initialized = true;
    } catch (error) {
      console.error('[HybridEngine] Initialization failed:', error);
    }
  }

  async analyze(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const threshold = options?.threshold ?? 0.15;

    // Run both engines in parallel
    const [tfidfResult, semanticResult] = await Promise.all([
      this.tfidfEngine.analyze(query, corpus, options),
      this.semanticEngine.analyze(query, corpus, options),
    ]);

    // Combine results using weighted scoring
    const combinedMatches = this.combineMatches(
      tfidfResult.matches,
      semanticResult.matches,
      threshold
    );

    // Calculate weighted overall score
    const overallScore = this.calculateWeightedScore(tfidfResult, semanticResult);

    return {
      id: `hybrid-analysis-${Date.now()}`,
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
    };
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
        details: `Hybrid engine fully operational. Both sub-engines healthy.`,
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
  // Private Methods
  // ============================================================

  private combineMatches(
    tfidfMatches: SimilarityResult[],
    semanticMatches: SimilarityResult[],
    threshold: number
  ): SimilarityResult[] {
    const matchMap = new Map<string, SimilarityResult>();

    // Process TF-IDF matches
    for (const match of tfidfMatches) {
      matchMap.set(match.id, {
        ...match,
        score: match.score * this.config.tfidfWeight,
      });
    }

    // Process Semantic matches (add to or update existing)
    for (const match of semanticMatches) {
      const existing = matchMap.get(match.id);
      
      if (existing) {
        // Weighted average of scores
        existing.score += match.score * this.config.semanticWeight;
        
        // Keep the higher confidence level
        if (match.confidence === 'high' && existing.confidence !== 'high') {
          existing.confidence = 'high';
        }
        
        // Use more severe classification
        if (this.compareSeverity(match.severity, existing.severity) > 0) {
          existing.severity = match.severity;
          existing.matchType = match.matchType;
        }
      } else {
        matchMap.set(match.id, {
          ...match,
          score: match.score * this.config.semanticWeight,
        });
      }
    }

    // Filter by threshold and convert to array
    return [...matchMap.values()]
      .filter(m => m.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }

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
      recs.push('💡 Quelques similités détectées');
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
      return '📋 ATTENTION - Clarifiez l\'originalité du sujet.';
    }
    return '✅ SUJET VALIDÉ - Originalité confirmée par analyse hybride.';
  }

  private mergeSimilarSubjects(
    tfidfSubjects: Array<{ id: string; title: string; similarity: number; sharedKeywords: string[]; explanation: string }>,
    semanticSubjects: Array<{ id: string; title: string; similarity: number; sharedKeywords: string[]; explanation: string }>
  ): Array<{ id: string; title: string; similarity: number; sharedKeywords: string[]; explanation: string }> {
    const merged = new Map<string, any>();

    // Add TF-IDF subjects
    for (const s of tfidfSubjects) {
      merged.set(s.id, { ...s, sources: ['tfidf'] as string[] });
    }

    // Merge/add semantic subjects
    for (const s of semanticSubjects) {
      const existing = merged.get(s.id);
      if (existing) {
        // Weighted average of similarities
        existing.similarity = (
          existing.similarity * this.config.tfidfWeight +
          s.similarity * this.config.semanticWeight
        );
        // Merge keywords
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
        lines.push(`│ Similarité: ${(ss.similarity * 100).toFixed(1)}%`);
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
