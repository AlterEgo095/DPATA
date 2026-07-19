// TF-IDF Engine - Wraps existing implementation with new interface
// Phase 3 — Adapter for legacy TF-IDF + Cosine + Jaccard implementation

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
import {
  detectPlagiat,
  tokenize,
  normalizeText,
  buildTfidfModel,
  vectorize,
  cosineSimilarity,
  jaccardSimilarity,
  classifyMatch,
  type MatchType,
  type PlagiatResult,
  type PlagiatMatch,
} from '../engine';
import {
  validateSubject,
  generateAlternatives as genAlts,
  computeSubjectStats,
  type ValidationResult,
  type SubjectInput,
  type SimilarSubject,
} from '../subjectEngine';

export class TfidfEngine implements IAnalysisEngine {
  readonly type: EngineType = 'TFIDF';
  readonly name: string = 'TF-IDF + Cosine + Jaccard';
  readonly version: string = '2.0.0';

  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // Pre-warm the engine by running a dummy computation
    try {
      buildTfidfModel(['test initialization']);
      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize TF-IDF engine:', e);
    }
  }

  async analyze(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const threshold = options?.threshold ?? 0.15;

    const result: PlagiatResult = detectPlagiat(
      query,
      corpus.map((c) => ({ documentId: c.id, text: c.text })),
      threshold
    );

    // Convert to new format
    const matches: SimilarityResult[] = result.matches.map((m) => ({
      id: `${m.querySegmentIndex}-${m.sourceSegmentIndex}`,
      score: m.semanticScore,
      confidence:
        m.semanticScore > 0.7
          ? 'high'
          : m.semanticScore > 0.4
            ? 'medium'
            : 'low',
      matchType: m.matchType as any,
      severity: this.getSeverity(m.semanticScore),
      sourceText: m.sourceSegmentText,
      matchedText: m.querySegmentText,
      startIndex: 0,
      endIndex: m.querySegmentText.length,
      explanation: this.generateExplanation(m),
    }));

    return {
      id: `analysis-${Date.now()}`,
      overallScore: Math.round(result.globalScore * 100 * 10) / 10,
      severity: this.getOverallSeverity(result.globalScore),
      engineUsed: 'TFIDF',
      processingTimeMs: result.metadata.processingTimeMs,
      totalSegments: result.totalSegments,
      matchedSegments: result.matchedSegments,
      matches,
      summary: this.generateSummary(result),
      recommendations: this.generateRecommendations(result),
      metadata: {
        corpusSize: result.metadata.corpusSize,
        modelVersion: this.version,
        threshold,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async validateSubject(
    subject: SubjectAnalysisInput,
    existingSubjects: unknown[]
  ): Promise<SubjectValidationResult> {
    const input: SubjectInput = {
      title: subject.title,
      description: subject.description,
      domain: subject.domain,
      keywords: subject.keywords,
      objectives: subject.objectives,
      problemStatement: subject.problemStatement,
    };

    const result: ValidationResult = validateSubject(
      input,
      existingSubjects as Array<{
        id: string;
        title: string;
        description?: string;
        domain?: string;
        keywords?: string;
        objectives?: string;
        problemStatement?: string;
      }>
    );

    return {
      isValid: result.isOriginal,
      originalityScore: Math.round((1 - result.similarityScore) * 100 * 10) / 10,
      similarityThreshold: result.threshold,
      isOriginal: result.isOriginal,
      similarSubjects: result.similarSubjects.map((s) => ({
        id: s.subjectId,
        title: s.title,
        similarity: s.similarity,
        sharedKeywords: s.sharedKeywords,
        explanation: s.explanation,
      })),
      alternatives: result.alternatives,
      recommendation: result.recommendation,
      riskLevel: this.getRiskLevel(result.similarityScore, result.threshold),
      detailedReport: result.report,
    };
  }

  async generateAlternatives(
    subject: SubjectAnalysisInput,
    similarSubjects: unknown[]
  ): Promise<string[]> {
    const input: SubjectInput = {
      title: subject.title,
      description: subject.description,
      domain: subject.domain,
      keywords: subject.keywords,
    };

    // Use internal alternative generation
    return genAlts(
      input,
      (similarSubjects as Array<{ id: string; title: string; similarity: number }>).map(
        (s) => ({
          subjectId: s.id,
          title: s.title,
          similarity: s.similarity,
          explanation: '',
          sharedKeywords: [] as string[],
        })
      )
    );
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: string;
  }> {
    try {
      const testResult = detectPlagiat('Test document for health check', []);
      return {
        status: 'healthy',
        details: `TF-IDF engine operational. Processing time: ${testResult.metadata.processingTimeMs}ms`,
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return {
        status: 'unhealthy',
        details: error,
      };
    }
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  private getSeverity(score: number): MatchSeverity {
    if (score >= 0.85) return 'CRITICAL';
    if (score >= 0.60) return 'HIGH';
    if (score >= 0.40) return 'MEDIUM';
    if (score >= 0.25) return 'LOW';
    return 'INFO';
  }

  private getOverallSeverity(score: number): MatchSeverity {
    if (score >= 0.50) return 'CRITICAL';
    if (score >= 0.30) return 'HIGH';
    if (score >= 0.15) return 'MEDIUM';
    return 'LOW';
  }

  private getRiskLevel(
    score: number,
    threshold: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const ratio = score / threshold;
    if (ratio >= 2) return 'CRITICAL';
    if (ratio >= 1.5) return 'HIGH';
    if (ratio >= 1) return 'MEDIUM';
    return 'LOW';
  }

  private generateExplanation(match: PlagiatMatch): string {
    const explanations: Record<string, string> = {
      COPY_PASTE:
        'Copier-coller détecté : texte identique ou quasi-identique',
      PARAPHRASE:
        'Paraphrase détectée : structure similaire avec modifications mineures',
      REFORMULATION:
        'Reformulation détectée : idées similaires exprimées différemment',
      TRANSLATION:
        'Traduction potentielle détectée : correspondance inter-langue',
      WEAK_MATCH: 'Faible correspondance : quelques éléments communs',
    };
    return explanations[match.matchType] || 'Correspondance détectée';
  }

  private generateSummary(result: PlagiatResult): string {
    const pct = Math.round(result.globalScore * 100);
    if (pct >= 50)
      return `Plagiât massif détecté (${pct}% de similarité globale). ${result.matchedSegments}/${result.totalSegments} segments concernés.`;
    if (pct >= 30)
      return `Similarité élevée détectée (${pct}%). Recommande une analyse approfondie.`;
    if (pct >= 15)
      return `Similarité modérée (${pct}%). Quelques passages nécessitent attention.`;
    return `Faible similarité (${pct}%). Le document semble majoritairement original.`;
  }

  private generateRecommendations(result: PlagiatResult): string[] {
    const recs: string[] = [];
    const pct = Math.round(result.globalScore * 100);

    if (pct >= 50) {
      recs.push('Revue complète du document requise');
      recs.push('Citer correctement toutes les sources');
      recs.push('Consulter un encadreur académique');
    } else if (pct >= 30) {
      recs.push('Vérifier les passages marqués');
      recs.push('Améliorer la paraphrase avec citations');
    } else if (pct >= 15) {
      recs.push('Passer en revue les sections surlignées');
      recs.push('Assurer une attribution appropriée');
    } else {
      recs.push('Document apparemment original');
      recs.push('Continuer les bonnes pratiques de citation');
    }

    return recs;
  }
}
