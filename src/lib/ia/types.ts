// Unified AI Engine Type Definitions for DPATA
// Phase 3 — Extensible architecture for RAG, Embeddings, and LLM integration

// ============================================================
// Analysis Result Types
// ============================================================

export type MatchSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type MatchCategory = 'COPY_PASTE' | 'PARAPHRASE' | 'REFORMULATION' | 'TRANSLATION' | 'WEAK_MATCH' | 'AI_GENERATED';

// ============================================================
// Engine Types
// ============================================================

export type EngineType = 'TFIDF' | 'EMBEDDING' | 'HYBRID' | 'LLM' | 'RAG';

// ============================================================
// Analysis Options & Results
// ============================================================

export interface AnalysisOptions {
  threshold?: number;
  engine?: EngineType;
  maxResults?: number;
  includeExplanations?: boolean;
  language?: 'fr' | 'en' | 'auto';
}

export interface SimilarityResult {
  id: string;
  score: number; // 0-1
  confidence: 'high' | 'medium' | 'low';
  matchType: MatchCategory;
  severity: MatchSeverity;
  sourceText: string;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  explanation?: string;
  suggestions?: string[];
}

export interface AnalysisResult {
  id: string;
  overallScore: number; // 0-100 percentage
  severity: MatchSeverity;
  engineUsed: EngineType;
  processingTimeMs: number;
  totalSegments: number;
  matchedSegments: number;
  matches: SimilarityResult[];
  summary: string;
  recommendations: string[];
  metadata: {
    corpusSize: number;
    modelVersion: string;
    threshold: number;
    timestamp: string;
  };
}

// ============================================================
// Subject Validation Types
// ============================================================

export interface SubjectAnalysisInput {
  title: string;
  description?: string;
  domain?: string;
  keywords?: string;
  objectives?: string;
  problemStatement?: string;
  facultyId?: string;
  departmentId?: string;
}

export interface SubjectValidationResult {
  isValid: boolean;
  originalityScore: number; // 0-100
  similarityThreshold: number;
  isOriginal: boolean;
  similarSubjects: Array<{
    id: string;
    title: string;
    similarity: number;
    sharedKeywords: string[];
    explanation: string;
  }>;
  alternatives: string[];
  recommendation: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detailedReport: string;
}

// ============================================================
// Embedding Types (for future use)
// ============================================================

export interface EmbeddingVector {
  dimensions: number;
  values: Float32Array;
  model: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  index: number;
  text: string;
  embedding?: EmbeddingVector;
  metadata: Record<string, unknown>;
}

// ============================================================
// RAG Types (for future use)
// ============================================================

export interface RAGContext {
  query: string;
  relevantChunks: Array<{
    chunk: DocumentChunk;
    relevanceScore: number;
  }>;
  augmentedPrompt: string;
}

// ============================================================
// Engine Adapter Interface
// ============================================================

export interface IAnalysisEngine {
  readonly type: EngineType;
  readonly name: string;
  readonly version: string;

  initialize(): Promise<void>;
  analyze(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: AnalysisOptions
  ): Promise<AnalysisResult>;
  validateSubject(
    subject: SubjectAnalysisInput,
    existingSubjects: unknown[]
  ): Promise<SubjectValidationResult>;
  generateAlternatives(
    subject: SubjectAnalysisInput,
    similarSubjects: unknown[]
  ): Promise<string[]>;
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: string;
  }>;
}
