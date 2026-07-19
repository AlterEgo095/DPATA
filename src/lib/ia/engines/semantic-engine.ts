// Semantic Embedding Engine - Advanced NLP for DPATA
// PHASE 6: IA AVANCÉE - Embeddings Sémantiques & Recherche Vectorielle

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
  EmbeddingVector,
} from './types';

// ============================================================================
// TEXT PREPROCESSING - Enhanced Tokenization
// ============================================================================

interface TokenizationOptions {
  useNgrams?: boolean;
  ngramRange?: [number, number];
  removeStopWords?: boolean;
  stemming?: boolean;
  normalize?: boolean;
}

const FRENCH_STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à',
  'ce', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs', 'que',
  'qui', 'dont', 'au', 'aux', 'par', 'pour', 'dans', 'sur', 'avec',
  'sans', 'sous', 'entre', 'vers', 'contre', 'après', 'avant', 'mais',
  'ou', 'où', 'si', 'ne', 'pas', 'plus', 'moins', 'très', 'bien',
  'mal', 'tout', 'tous', 'toute', 'toutes', 'autre', 'autres', 'même',
  'mêmes', 'tel', 'telle', ' tels', 'telles', 'aussi', 'comme', 'donc',
  'car', 'ni', 'encore', 'alors', 'ainsi', 'déjà', 'toujours', 'jamais',
  'peut', 'être', 'avoir', 'faire', 'aller', 'voir', 'savoir', 'pouvoir',
  'vouloir', 'devenir', 'falloir', 'valoir', 'est', 'ont', 'a', 'ont',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'of', 'to', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'out',
  'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'if',
]);

/**
 * Enhanced text preprocessing for semantic analysis
 */
export function preprocessText(text: string, options: TokenizationOptions = {}): string[] {
  const {
    useNgrams = true,
    ngramRange = [1, 3],
    removeStopWords = true,
    stemming = false,
    normalize = true,
  } = options;

  let processed = text;

  // Normalize text
  if (normalize) {
    processed = processed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, ' ') // Keep only alphanumeric and spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Tokenize
  let tokens = processed.split(/\s+/).filter(t => t.length > 1);

  // Remove stop words
  if (removeStopWords) {
    tokens = tokens.filter(t => !FRENCH_STOP_WORDS.has(t));
  }

  // Apply simple stemming (suffix removal)
  if (stemming) {
    tokens = tokens.map(applySimpleStemming);
  }

  // Generate n-grams
  if (useNgrams && ngramRange[1] > 1) {
    const ngrams: string[] = [];
    for (let n = ngramRange[0]; n <= ngramRange[1]; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join('_'));
      }
    }
    return [...tokens, ...ngrams];
  }

  return tokens;
}

/**
 * Simple suffix-based stemmer (French/English)
 */
function applySimpleStemming(word: string): string {
  const suffixes = [
    'issement', 'issement', 'ement', 'ement', 'ation', 'ition', 'ique',
    'isme', 'iste', 'able', 'ible', 'oire', 'eur', 'euse', 'ance',
    'ence', 'ment', 'eux', 'euse', 'if', 'ive', 'al', 'ale', 'ux',
    'ure', 'age', 'ine', 'ain', 'oir', 'oirs', 'er', 'ez', 'é', 'ée',
    'es', 'ing', 'tion', 'sion', 'ness', 'ment', 'able', 'ible',
    'ful', 'less', 'ous', 'ive', 'ity', 'ies', 'ied', 'ier', 'iest',
  ];

  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }

  return word;
}

// ============================================================================
// TF-IDF VECTORIZER - Enhanced with BM25
// ============================================================================

interface TFIDFModel {
  vocabulary: Map<string, number>;
  idf: Float32Array;
  documentCount: number;
  avgDocumentLength: number;
}

/**
 * Build enhanced TF-IDF model with BM25-like scoring
 */
export function buildEnhancedTFIDFModel(documents: string[]): TFIDFModel {
  const vocab = new Map<string, number>();
  const docFreq = new Map<string, number>();
  let totalLength = 0;

  // Build vocabulary and document frequencies
  for (const doc of documents) {
    const tokens = preprocessText(doc);
    totalLength += tokens.length;
    const uniqueTokens = new Set(tokens);

    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }

    for (const token of tokens) {
      vocab.set(token, (vocab.get(token) || 0) + 1);
    }
  }

  // Sort vocabulary by frequency
  const sortedVocab = [...vocab.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10000); // Limit vocabulary size

  const vocabulary = new Map<string, number>();
  sortedVocab.forEach(([token], idx) => vocabulary.set(token, idx));

  // Calculate IDF with smoothing (BM25-style)
  const idf = new Float32Array(vocabulary.size);
  const k = 1.5; // BM25 parameter
  const n = documents.length;

  vocabulary.forEach((idx, token) => {
    const df = docFreq.get(token) || 0;
    // Smooth IDF formula (BM25)
    idf[idx] = Math.log((n - df + 0.5) / (df + 0.5) + 1);
  });

  return {
    vocabulary,
    idf,
    documentCount: n,
    avgDocumentLength: totalLength / n,
  };
}

/**
 * Vectorize a document using the TF-IDF model
 */
export function vectorizeDocument(text: string, model: TFIDFModel): Float32Array {
  const vector = new Float32Array(model.vocabulary.size);
  const tokens = preprocessText(text);

  // Count term frequencies
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Calculate TF-IDF with sublinear scaling
  const docLen = tokens.length;
  const k = 1.5; // BM25 k1 parameter
  const b = 0.75; // BM25 b parameter

  tf.forEach((freq, token) => {
    const idx = model.vocabulary.get(token);
    if (idx !== undefined) {
      // BM25-like TF normalization
      const tfNorm = (freq * (k + 1)) / (freq + k * (1 - b + b * (docLen / model.avgDocumentLength)));
      vector[idx] = tfNorm * model.idf[idx];
    }
  });

  // L2 normalize
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

// ============================================================================
// SIMILARITY FUNCTIONS
// ============================================================================

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error('Vector dimensions must match');

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Jaccard similarity between two token sets
 */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = setA.size + setB.size - intersection;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Levenshtein distance (edit distance)
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalized Levenshtein similarity (0 to 1)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

// ============================================================================
// VECTOR INDEX (FAISS-like In-Memory Index)
// ============================================================================

interface IndexedDocument {
  id: string;
  text: string;
  embedding: Float32Array;
  metadata?: Record<string, unknown>;
}

interface SearchResult {
  id: string;
  score: number;
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * In-memory vector index for semantic search (FAISS-like functionality)
 * Supports:
 * - Flat indexing (brute-force search)
 * - IVF-like clustering (for larger datasets)
 * - HNSW-like approximate nearest neighbor (future)
 */
export class VectorIndex {
  private documents: IndexedDocument[] = [];
  private dimension: number = 0;
  private isBuilt: boolean = false;
  private model: TFIDFModel | null = null;

  /**
   * Add documents to the index
   */
  addDocuments(documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>): void {
    // Build or update TF-IDF model
    const allDocs = [...this.documents.map(d => d.text), ...documents.map(d => d.text)];
    this.model = buildEnhancedTFIDFModel(allDocs);
    this.dimension = this.model.vocabulary.size;

    // Vectorize and store new documents
    for (const doc of documents) {
      const embedding = vectorizeDocument(doc.text, this.model);
      this.documents.push({
        id: doc.id,
        text: doc.text,
        embedding,
        metadata: doc.metadata,
      });
    }

    this.isBuilt = true;
  }

  /**
   * Search for similar documents
   * @param query Query text
   * @param topK Number of results to return
   * @param threshold Minimum similarity score (0-1)
   */
  search(query: string, topK: number = 10, threshold: number = 0): SearchResult[] {
    if (!this.isBuilt || !this.model) {
      return [];
    }

    // Vectorize query
    const queryEmbedding = vectorizeDocument(query, this.model);

    // Compute similarities
    const results: SearchResult[] = [];

    for (const doc of this.documents) {
      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);

      if (similarity >= threshold) {
        results.push({
          id: doc.id,
          score: similarity,
          text: doc.text,
          metadata: doc.metadata,
        });
      }
    }

    // Sort by score descending and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Hybrid search combining semantic and keyword matching
   */
  hybridSearch(
    query: string,
    topK: number = 10,
    options: { semanticWeight?: number; keywordWeight?: number } = {}
  ): SearchResult[] {
    const { semanticWeight = 0.7, keywordWeight = 0.3 } = options;

    // Semantic search
    const semanticResults = this.search(query, topK * 2, 0);

    // Keyword search (exact/partial matches)
    const queryTokens = new Set(preprocessText(query));
    const keywordResults: SearchResult[] = [];

    for (const doc of this.documents) {
      const docTokens = preprocessText(doc.text);
      const overlap = queryTokens.size > 0 
        ? [...queryTokens].filter(t => docTokens.includes(t)).length / queryTokens.size 
        : 0;

      if (overlap > 0) {
        keywordResults.push({
          id: doc.id,
          score: overlap,
          text: doc.text,
          metadata: doc.metadata,
        });
      }
    }

    // Combine scores
    const combinedScores = new Map<string, SearchResult>();

    for (const result of semanticResults) {
      combinedScores.set(result.id, {
        ...result,
        score: result.score * semanticWeight,
      });
    }

    for (const result of keywordResults) {
      const existing = combinedScores.get(result.id);
      if (existing) {
        existing.score += result.score * keywordWeight;
      } else {
        combinedScores.set(result.id, {
          ...result,
          score: result.score * keywordWeight,
        });
      }
    }

    return [...combinedScores.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      documentCount: this.documents.length,
      dimension: this.dimension,
      isBuilt: this.isBuilt,
      modelVocabSize: this.model?.vocabulary.size ?? 0,
      memoryUsage: `${(this.documents.reduce((sum, d) => sum + d.embedding.byteLength, 0) / 1024).toFixed(2)} KB`,
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.documents = [];
    this.dimension = 0;
    this.isBuilt = false;
    this.model = null;
  }

  /**
   * Get all indexed document IDs
   */
  getDocumentIds(): string[] {
    return this.documents.map(d => d.id);
  }

  /**
   * Remove a document from the index
   */
  removeDocument(id: string): boolean {
    const idx = this.documents.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.documents.splice(idx, 1);
      
      // Rebuild model if needed
      if (this.documents.length > 0) {
        const texts = this.documents.map(d => d.text);
        this.model = buildEnhancedTFIDFModel(texts);
        
        // Re-vectorize remaining documents
        for (const doc of this.documents) {
          doc.embedding = vectorizeDocument(doc.text, this.model!);
        }
      }
      
      return true;
    }
    return false;
  }
}

// ============================================================================
// SEMANTIC EMBEDDING ENGINE
// ============================================================================

/**
 * Advanced Semantic Analysis Engine using enhanced TF-IDF with BM25
 * Implements IAnalysisEngine interface for seamless integration
 */
export class SemanticEmbeddingEngine implements IAnalysisEngine {
  readonly type: EngineType = 'EMBEDDING';
  readonly name: string = 'Semantic Embeddings v3.0';
  readonly version: string = '3.0.0';

  private initialized = false;
  private vectorIndex = new VectorIndex();
  private corpusDocuments: Array<{ id: string; text: string }> = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Pre-warm with test data
      buildEnhancedTFIDFModel(['initialization test']);
      this.initialized = true;
    } catch (error) {
      console.error('[SemanticEngine] Initialization failed:', error);
    }
  }

  async analyze(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const threshold = options?.threshold ?? 0.15;

    // Rebuild index with corpus
    this.vectorIndex.clear();
    this.corpusDocuments = corpus;
    this.vectorIndex.addDocuments(corpus);

    // Perform hybrid search
    const results = this.vectorIndex.hybridSearch(query, 20, {
      semanticWeight: 0.7,
      keywordWeight: 0.3,
    });

    // Convert to analysis format
    const matches: SimilarityResult[] = results
      .filter(r => r.score >= threshold)
      .map(result => ({
        id: result.id,
        score: result.score,
        confidence: result.score > 0.7 ? 'high' : result.score > 0.4 ? 'medium' : 'low',
        matchType: this.classifyMatchType(result.score) as MatchCategory,
        severity: this.getSeverityFromScore(result.score),
        sourceText: result.text.substring(0, 200) + (result.text.length > 200 ? '...' : ''),
        matchedText: query.substring(0, 200),
        startIndex: 0,
        endIndex: Math.min(200, query.length),
        explanation: this.generateExplanation(result.score),
      }));

    // Calculate overall score
    const overallScore = results.length > 0
      ? Math.max(...results.map(r => r.score)) * 100
      : 0;

    return {
      id: `semantic-analysis-${Date.now()}`,
      overallScore: Math.round(overallScore * 10) / 10,
      severity: this.getOverallSeverity(overallScore / 100),
      engineUsed: 'EMBEDDING',
      processingTimeMs: Date.now() - startTime,
      totalSegments: 1,
      matchedSegments: matches.length,
      matches,
      summary: this.generateSummary(overallScore, matches.length),
      recommendations: this.generateRecommendations(overallScore),
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
    existingSubjects: unknown[]
  ): Promise<SubjectValidationResult> {
    // Combine subject fields into searchable text
    const searchText = [
      subject.title,
      subject.description,
      subject.keywords,
      subject.objectives,
      subject.problemStatement,
    ].filter(Boolean).join(' ');

    // Build index with existing subjects
    const subjects = existingSubjects as Array<{
      id: string;
      title: string;
      description?: string;
      keywords?: string;
    }>;

    this.vectorIndex.clear();
    this.vectorIndex.addDocuments(subjects.map(s => ({
      id: s.id,
      text: [s.title, s.description, s.keywords].filter(Boolean).join(' '),
    })));

    // Search for similar subjects
    const results = this.vectorIndex.hybridSearch(searchText, 10, {
      semanticWeight: 0.8,
      keywordWeight: 0.2,
    });

    const similarSubjects = results
      .filter(r => r.score >= 0.2)
      .map(result => {
        const source = subjects.find(s => s.id === result.id)!;
        return {
          id: result.id,
          title: source.title,
          similarity: result.score,
          sharedKeywords: this.findSharedKeywords(searchText, source),
          explanation: this.generateSubjectExplanation(result.score),
        };
      });

    const maxSimilarity = similarSubjects.length > 0
      ? Math.max(...similarSubjects.map(s => s.similarity))
      : 0;

    const isOriginal = maxSimilarity < 0.4; // Threshold for originality

    return {
      isValid: isOriginal,
      originalityScore: Math.round((1 - maxSimilarity) * 100 * 10) / 10,
      similarityThreshold: 0.4,
      isOriginal,
      similarSubjects,
      alternatives: await this.generateAlternativesForSubject(subject, similarSubjects),
      recommendation: this.generateRecommendation(maxSimilarity),
      riskLevel: this.getRiskLevel(maxSimilarity),
      detailedReport: this.generateDetailedReport(subject, similarSubjects),
    };
  }

  async generateAlternatives(
    subject: SubjectAnalysisInput,
    similarSubjects: unknown[]
  ): Promise<string[]> {
    return this.generateAlternativesForSubject(subject, []);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: string }> {
    try {
      const testIndex = new VectorIndex();
      testIndex.addDocuments([{ id: 'test', text: 'Health check test document' }]);
      const results = testIndex.search('test', 1);
      
      return {
        status: 'healthy',
        details: `Semantic engine operational. Index stats: ${JSON.stringify(testIndex.getStats())}`,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: error.message || 'Unknown error',
      };
    }
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private classifyMatchType(score: number): MatchCategory {
    if (score >= 0.85) return 'COPY_PASTE';
    if (score >= 0.65) return 'PARAPHRASE';
    if (score >= 0.45) return 'REFORMULATION';
    if (score >= 0.30) return 'WEAK_MATCH';
    return 'AI_GENERATED'; // Low similarity might indicate AI-generated content
  }

  private getSeverityFromScore(score: number): MatchSeverity {
    if (score >= 0.85) return 'CRITICAL';
    if (score >= 0.60) return 'HIGH';
    if (score >= 0.40) return 'MEDIUM';
    if (score >= 0.25) return 'LOW';
    return 'INFO';
  }

  private getOverallSeverity(score: number): MatchSeverity {
    if (score >= 50) return 'CRITICAL';
    if (score >= 30) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    return 'LOW';
  }

  private getRiskLevel(similarity: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (similarity >= 0.8) return 'CRITICAL';
    if (similarity >= 0.6) return 'HIGH';
    if (similarity >= 0.4) return 'MEDIUM';
    return 'LOW';
  }

  private generateExplanation(score: number): string {
    if (score >= 0.85) return 'Correspondance sémantique quasi-parfaite détectée';
    if (score >= 0.65) return 'Similarité sémantique élevée - paraphrase probable';
    if (score >= 0.45) return 'Reformulation sémantique détectée';
    if (score >= 0.30) return 'Faible correspondance thématique';
    return 'Correspondance marginale - thèmes adjacents';
  }

  private generateSubjectExplanation(score: number): string {
    if (score >= 0.8) return 'Sujet identique ou très similaire existant';
    if (score >= 0.6) return 'Sujet avec forte similarité thématique';
    if (score >= 0.4) return 'Sujet partiellement chevauchant';
    return 'Sujet adjacent dans le même domaine';
  }

  private generateSummary(score: number, matchCount: number): string {
    if (score >= 50) {
      return `Plagiât massif détecté par analyse sémantique (${score.toFixed(1)}% de similarité). ${matchCount} correspondances trouvées.`;
    }
    if (score >= 30) {
      return `Similarité sémantique élevée (${score.toFixed(1)}%). Analyse approfondie recommandée.`;
    }
    if (score >= 15) {
      return `Similarité modérée détectée (${score.toFixed(1)}%). Quelques passages à vérifier.`;
    }
    return `Faible similarité sémantique (${score.toFixed(1)}%). Document majoritairement original.`;
  }

  private generateRecommendations(score: number): string[] {
    const recs: string[] = [];
    
    if (score >= 50) {
      recs.push('Réécriture complète du document requise');
      recs.push('Citation obligatoire de toutes les sources');
      recs.push('Consultation urgente de l\'encadreur');
    } else if (score >= 30) {
      recs.push('Reformuler les passages marqués');
      recs.push('Ajouter des citations appropriées');
      recs.push('Enrichir avec idées originales');
    } else if (score >= 15) {
      recs.push('Relire les sections surlignées');
      recs.push('Vérifier l\'attribution des sources');
    } else {
      recs.push('Travail original de qualité');
      recs.push('Continuer les bonnes pratiques');
    }

    return recs;
  }

  private generateRecommendation(similarity: number): string {
    if (similarity >= 0.8) {
      return 'SUJET REFUSÉ - Doublon ou quasi-doublon détecté. Choisissez un sujet différent.';
    }
    if (similarity >= 0.6) {
      return 'RISIQUE ÉLEVÉ - Forte similarité avec un sujet existant. Reformulation nécessaire.';
    }
    if (similarity >= 0.4) {
      return 'ATTENTION - Similarité modérée. Clarifiez l\'angle d\'attaque original.';
    }
    return 'SUJET ACCEPTABLE - Originalité suffisante pour validation.';
  }

  private findSharedKeywords(text1: string, source: { title: string; description?: string; keywords?: string }): string[] {
    const tokens1 = new Set(preprocessText(text1));
    const tokens2 = new Set(preprocessText([source.title, source.description, source.keywords].filter(Boolean).join(' ')));
    
    return [...tokens1].filter(t => tokens2.has(t)).slice(0, 10);
  }

  private async generateAlternativesForSubject(
    subject: SubjectAnalysisInput,
    _similarSubjects: Array<{ id: string; title: string; similarity: number }>
  ): Promise<string[]> {
    const alternatives: string[] = [];
    const domain = subject.domain || 'ce domaine';

    // Generate contextual alternatives based on domain keywords
    const prefixes = [
      'Analyse comparative de',
      'Étude exploratoire sur',
      'Impact de',
      'Optimisation de',
      'Modélisation de',
      'Évaluation de',
      'Contribution à',
      'Approche novatrice pour',
    ];

    const suffixes = [
      `dans le contexte ${domain}`,
      ': une étude de cas`,
      'perspectives et défis',
      ': état de l\'art et perspectives',
      ': approche méthodologique innovante',
    ];

    // Generate combinations
    for (let i = 0; i < Math.min(3, prefixes.length); i++) {
      const alt = `${prefixes[i]} ${subject.title.split(':').[0]?.trim() || subject.title} ${suffixes[i] || ''}`;
      if (!alternatives.includes(alt)) {
        alternatives.push(alt.trim());
      }
    }

    // Add specific variations
    if (subject.title.toLowerCase().includes('analyse')) {
      alternatives.push(`Mise en œuvre pratique de ${subject.title.replace('Analyse', '').toLowerCase().trim()}`);
    }
    if (subject.title.toLowerCase().includes('étude')) {
      alternatives.push(`Expérimentation et validation ${subject.title.replace('Étude', '').replace('étude', '').toLowerCase().trim()}`);
    }

    return alternatives.slice(0, 6);
  }

  private generateDetailedReport(
    subject: SubjectAnalysisInput,
    similarSubjects: Array<{ id: string; title: string; similarity: number; sharedKeywords: string[] }>
  ): string {
    const lines: string[] = [
      `# RAPPORT DE VALIDATION DE SUJET`,
      ``,
      `## Informations du sujet proposé`,
      `- **Titre**: ${subject.title}`,
      `- **Domaine**: ${subject.domain || 'Non spécifié'}`,
      ``,
      `## Résultat de l'analyse`,
      `- **Score d'originalité**: ${this.getRiskLevel(similarSubjects.length > 0 ? Math.max(...similarSubjects.map(s => s.similarity)) : 0)}`,
      `- **Sujets similaires trouvés**: ${similarSubjects.length}`,
      ``,
    ];

    if (similarSubjects.length > 0) {
      lines.push(`## Détails des similarités`);
      lines.push('');
      for (const ss of similarSubjects.slice(0, 5)) {
        lines.push(`### ${ss.title}`);
        lines.push(`- **Similarité**: ${(ss.similarity * 100).toFixed(1)}%`);
        lines.push(`- **Mots-clés partagés**: ${ss.sharedKeywords.join(', ') || 'Aucun'}`);
        lines.push(`- **Explication**: ${ss.explanation}`);
        lines.push('');
      }
    }

    lines.push(`## Recommandation`);
    lines.push(this.generateRecommendation(similarSubjects.length > 0 ? Math.max(...similarSubjects.map(s => s.similarity)) : 0));

    return lines.join('\n');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  preprocessText,
  buildEnhancedTFIDFModel,
  vectorizeDocument,
  VectorIndex,
};

export default SemanticEmbeddingEngine;
