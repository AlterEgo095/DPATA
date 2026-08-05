// LLM Engine — Detection semantique de plagiat via Z.ai
// v2.0 — Uses public API with GLM-4.5-Flash (primary) + fallback

import {
  IAnalysisEngine,
  EngineType,
  AnalysisOptions,
  AnalysisResult,
  SimilarityResult,
  SubjectAnalysisInput,
  SubjectValidationResult,
  MatchSeverity,
  MatchCategory,
} from '../types';
import { chatCompletion, extractJSONFromRaw } from '../zai-client';

// ============================================================
// PROMPTS
// ============================================================

const DETECTION_SYSTEM = `Tu es un expert en detection de plagiat academique, specialise dans les memoires de l'UNIKIN.
Tu analyses un texte et le compares a un corpus pour detecter copier-coller, paraphrases, reformulations.
Reponds UNIQUEMENT en JSON valide (pas de markdown, pas de commentaires, pas de backticks). Reponds en francais.`;

const DETECTION_USER = (query: string, corpusText: string) =>
`Analyse le texte et compare au corpus.

=== TEXTE A ANALYSER ===
${query}

=== CORPUS ===
${corpusText || 'Aucun document de reference.'}

Retourne un JSON exact :
{"overallScore":<0-100>,"summary":"<2-3 phrases>","recommendations":["<rec1>","<rec2>"],"matches":[{"id":"m1","score":<0-1>,"confidence":"high|medium|low","matchType":"COPY_PASTE|PARAPHRASE|REFORMULATION|WEAK_MATCH|AI_GENERATED","severity":"CRITICAL|HIGH|MEDIUM|LOW|INFO","sourceText":"<extrait corpus>","matchedText":"<extrait texte>","explanation":"<pourquoi>"}]}
Max 10 matches. Si pas de plagiat: score 0, matches vide.`;

const SUBJECT_SYSTEM = `Tu es un expert academique de l'UNIKIN. Tu evalues l'originalite de sujets de memoire.
Reponds UNIQUEMENT en JSON valide (pas de markdown, pas de commentaires, pas de backticks). Reponds en francais.`;

const SUBJECT_USER = (title: string, description: string, existingText: string) =>
`Sujet propose: ${title}
${description || ''}

Sujets existants:
${existingText || 'Aucun.'}

Retourne un JSON exact :
{"isValid":true|false,"originalityScore":<0-100>,"isOriginal":true|false,"recommendation":"<avis detaille>","riskLevel":"LOW|MEDIUM|HIGH|CRITICAL","detailedReport":"<rapport 5-10 phrases>","similarSubjects":[{"id":"<id>","title":"<titre>","similarity":<0-1>,"explanation":"<pourquoi>"}],"alternatives":["<alt1>","<alt2>","<alt3>"]}`;

const ALTERNATIVES_USER = (title: string, domain: string, existingTitles: string) =>
`Domaine: ${domain}
Sujets a eviter:
${existingTitles || 'Aucun.'}

Propose 5 sujets de memoire originaux dans ce domaine.
Retourne UNIQUEMENT un tableau JSON de 5 chaines (pas de markdown, pas de commentaires).`;

// ============================================================
// HELPERS
// ============================================================

function severityFromScore(score: number): MatchSeverity {
  if (score >= 0.8) return 'CRITICAL';
  if (score >= 0.6) return 'HIGH';
  if (score >= 0.4) return 'MEDIUM';
  if (score >= 0.2) return 'LOW';
  return 'INFO';
}

function confidenceFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

// ============================================================
// LLM ENGINE
// ============================================================

export class LLMEngine implements IAnalysisEngine {
  readonly type: EngineType = 'LLM';
  readonly name = 'Z.ai Semantic Engine (GLM-4.5-Flash)';
  readonly version = '2.0.0';

  async initialize(): Promise<void> {
    if (!process.env.ZAI_API_KEY) {
      throw new Error('ZAI_API_KEY non configuree');
    }
  }

  async analyze(
    query: string,
    corpus: Array<{ id: string; text: string; title?: string }>,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const threshold = options?.threshold ?? 0.15;

    const corpusText = corpus
      .slice(0, 15)
      .map((d, i) => `[${d.id}] ${d.title || 'Doc ' + (i + 1)}:
${d.text.slice(0, 1500)}`)
      .join('\n---\n');

    const raw = await chatCompletion(
      [
        { role: 'system', content: DETECTION_SYSTEM },
        { role: 'user', content: DETECTION_USER(query, corpusText) },
      ],
      {
        temperature: 0.2,
        maxTokens: 4096,
        model: 'glm-4.5-flash',
        function: 'plagiarism_detection',
        enableFallback: true,
      }
    );

    const data = extractJSONFromRaw(raw);
    const matches: SimilarityResult[] = (data.matches || [])
      .filter((m: any) => m.score >= threshold)
      .slice(0, 10)
      .map((m: any, i: number) => ({
        id: m.id || `llm-m${i}`,
        score: Math.min(m.score, 1),
        confidence: m.confidence || confidenceFromScore(m.score),
        matchType: (m.matchType || 'WEAK_MATCH') as MatchCategory,
        severity: (m.severity || severityFromScore(m.score)) as MatchSeverity,
        sourceText: m.sourceText || '',
        matchedText: m.matchedText || '',
        startIndex: 0,
        endIndex: (m.matchedText || '').length,
        explanation: m.explanation,
      }));

    return {
      id: `llm-analysis-${Date.now()}`,
      overallScore: Math.max(0, Math.min(100, Number(data.overallScore) || 0)),
      severity: severityFromScore((Number(data.overallScore) || 0) / 100),
      engineUsed: 'LLM',
      processingTimeMs: Date.now() - startTime,
      totalSegments: 1,
      matchedSegments: matches.length,
      matches,
      summary: data.summary || 'Analyse semantique par LLM.',
      recommendations: data.recommendations || [],
      metadata: {
        corpusSize: corpus.length,
        modelVersion: this.version,
        threshold,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async validateSubject(
    subject: SubjectAnalysisInput,
    existingSubjects: SubjectAnalysisInput[]
  ): Promise<SubjectValidationResult> {
    const startTime = Date.now();

    const existingText = existingSubjects
      .slice(0, 20)
      .map((s, i) => `[${i}] ${s.title}${s.description ? ': ' + s.description.slice(0, 200) : ''}`)
      .join('\n');

    const raw = await chatCompletion(
      [
        { role: 'system', content: SUBJECT_SYSTEM },
        { role: 'user', content: SUBJECT_USER(subject.title, subject.description || '', existingText) },
      ],
      {
        temperature: 0.2,
        maxTokens: 4096,
        model: 'glm-4.5-flash',
        function: 'subject_validation',
        enableFallback: true,
      }
    );

    const data = extractJSONFromRaw(raw);

    return {
      isValid: data.isValid ?? true,
      originalityScore: Math.max(0, Math.min(100, Number(data.originalityScore) || 50)),
      similarityThreshold: 0.3,
      isOriginal: data.isOriginal ?? true,
      similarSubjects: (data.similarSubjects || []).map((s: any) => ({
        id: s.id || 'unknown',
        title: s.title || '',
        similarity: Math.min(Number(s.similarity) || 0, 1),
        sharedKeywords: [],
        explanation: s.explanation || '',
      })),
      alternatives: data.alternatives || [],
      recommendation: data.recommendation || '',
      riskLevel: data.riskLevel || 'LOW',
      detailedReport: data.detailedReport || '',
    };
  }

  async generateAlternatives(
    subject: SubjectAnalysisInput,
    existingSubjects: SubjectAnalysisInput[]
  ): Promise<string[]> {
    const existingTitles = existingSubjects
      .slice(0, 30)
      .map(s => `- ${s.title}`)
      .join('\n');

    const raw = await chatCompletion(
      [
        { role: 'system', content: 'Tu es un expert academique de l\'UNIKIN. Reponds UNIQUEMENT en JSON valide.' },
        { role: 'user', content: ALTERNATIVES_USER(subject.title || 'sujets de memoire', subject.domain || 'informatique', existingTitles) },
      ],
      {
        temperature: 0.7,
        maxTokens: 2048,
        model: 'glm-4.5-flash',
        function: 'topic_generation',
        enableFallback: true,
      }
    );

    try {
      const data = extractJSONFromRaw(raw);
      return Array.isArray(data) ? data.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<{ status: string; details: string }> {
    try {
      const start = Date.now();
      await chatCompletion(
        [{ role: 'user', content: 'Reponds OK' }],
        { maxTokens: 5, function: 'healthcheck', enableFallback: true }
      );
      return { status: 'healthy' as const, details: `Response in ${Date.now() - start}ms` };
    } catch (e: any) {
      return { status: 'unhealthy', details: e.message };
    }
  }
}
