// Moteur IA de détection du plagiat — implémentation TypeScript native
// Pipeline : segmentation → vectorisation TF-IDF → similarité cosinus → classification

// ============================================================
// STOP WORDS (français + anglais)
// ============================================================

const STOP_WORDS = new Set([
  // Français
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais',
  'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi', 'dont', 'où', 'ce',
  'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs', 'notre',
  'nos', 'votre', 'vos', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'je',
  'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te',
  'se', 'lui', 'soi', 'eux', 'à', 'au', 'aux', 'dans', 'sur', 'sous',
  'par', 'pour', 'avec', 'sans', 'chez', 'vers', 'entre', 'pendant',
  'depuis', 'avant', 'après', 'contre', 'est', 'sont', 'été', 'être',
  'avoir', 'avait', 'ont', 'eu', 'fait', 'faire', 'comme',
  'plus', 'moins', 'très', 'trop', 'peu', 'aussi', 'encore', 'déjà',
  // Anglais
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'because', 'if', 'when',
  'where', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
  'those', 'his', 'her', 'their', 'our', 'your', 'my', 'i', 'you',
  'he', 'she', 'it', 'we', 'they', 'me', 'him', 'them', 'to', 'in',
  'on', 'at', 'by', 'for', 'with', 'from', 'of', 'as', 'is', 'are',
  'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can',
  'more', 'less', 'very', 'too', 'also', 'than', 'then',
]);

// ============================================================
// PRÉTRAITEMENT
// ============================================================

export function normalizeText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\S+@\S+/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\xC0-\xFF\u2018\u2019\u201C\u201D]/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/\b[a-zA-ZÀ-ÿ]{2,}\b/g) || [];
  return matches.filter(t => !STOP_WORDS.has(t) && t.length >= 2);
}

export function segmentSentences(text: string): string[] {
  const normalized = normalizeText(text);
  const sentences = normalized.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/);
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

export function segmentDocument(text: string, minWords = 5, maxWords = 60): string[] {
  const sentences = segmentSentences(text);
  const segments: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentTokens = tokenize(sentence);
    const sentWordCount = sentTokens.length;
    if (sentWordCount === 0) continue;

    if (sentWordCount >= maxWords) {
      if (current.length > 0) {
        segments.push(current.join(' '));
        current = [];
        wordCount = 0;
      }
      segments.push(sentence);
      continue;
    }

    if (wordCount + sentWordCount > maxWords && current.length > 0) {
      segments.push(current.join(' '));
      current = [sentence];
      wordCount = sentWordCount;
    } else {
      current.push(sentence);
      wordCount += sentWordCount;
    }
  }

  if (current.length > 0) {
    const segmentText = current.join(' ');
    if (tokenize(segmentText).length >= minWords) {
      segments.push(segmentText);
    }
  }

  return segments.filter(s => tokenize(s).length >= minWords);
}

// ============================================================
// TF-IDF (implémentation native)
// ============================================================

interface TfidfModel {
  vocabulary: Map<string, number>;
  idf: Float64Array;
}

export function buildTfidfModel(segments: string[]): TfidfModel {
  const tokenizedDocs = segments.map(s => tokenize(s));
  const docCount = tokenizedDocs.length;

  const vocab = new Map<string, number>();
  const df = new Map<string, number>();

  for (const tokens of tokenizedDocs) {
    const uniqueTokens = new Set(tokens);
    for (const t of uniqueTokens) {
      if (!vocab.has(t)) {
        vocab.set(t, vocab.size);
      }
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  const idf = new Float64Array(vocab.size);
  for (const [token, idx] of vocab) {
    idf[idx] = Math.log((1 + docCount) / (1 + (df.get(token) || 0))) + 1;
  }

  return { vocabulary: vocab, idf };
}

export function vectorize(text: string, model: TfidfModel): Float64Array {
  const tokens = tokenize(text);
  const vec = new Float64Array(model.vocabulary.size);

  const tf = new Map<number, number>();
  for (const t of tokens) {
    const idx = model.vocabulary.get(t);
    if (idx !== undefined) {
      tf.set(idx, (tf.get(idx) || 0) + 1);
    }
  }

  for (const [idx, freq] of tf) {
    vec[idx] = (1 + Math.log(freq)) * model.idf[idx];
  }

  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }

  return vec;
}

export function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ============================================================
// CLASSIFICATION
// ============================================================

export type MatchType = 'COPY_PASTE' | 'PARAPHRASE' | 'REFORMULATION' | 'TRANSLATION' | 'WEAK_MATCH';

export function classifyMatch(semanticScore: number, lexicalScore: number): MatchType {
  if (semanticScore >= 0.85 && lexicalScore >= 0.70) return 'COPY_PASTE';
  if (semanticScore >= 0.60 && lexicalScore >= 0.40) return 'PARAPHRASE';
  if (semanticScore >= 0.40) return 'REFORMULATION';
  if (semanticScore >= 0.25) return 'TRANSLATION';
  return 'WEAK_MATCH';
}

// ============================================================
// DÉTECTION
// ============================================================

export interface PlagiatMatch {
  querySegmentIndex: number;
  querySegmentText: string;
  sourceDocumentId: string;
  sourceSegmentIndex: number;
  sourceSegmentText: string;
  semanticScore: number;
  lexicalScore: number;
  matchType: MatchType;
}

export interface PlagiatResult {
  globalScore: number;
  matchedSegments: number;
  totalSegments: number;
  byType: Record<string, number>;
  matches: PlagiatMatch[];
  metadata: {
    threshold: number;
    processingTimeMs: number;
    model: string;
    corpusSize: number;
    sourceSegmentsCount: number;
  };
}

export function detectPlagiat(
  queryText: string,
  corpus: { documentId: string; text: string }[],
  threshold: number = 0.15
): PlagiatResult {
  const startTime = Date.now();

  const querySegments = segmentDocument(queryText);

  if (querySegments.length === 0) {
    return {
      globalScore: 0,
      matchedSegments: 0,
      totalSegments: 0,
      byType: {},
      matches: [],
      metadata: {
        threshold,
        processingTimeMs: Date.now() - startTime,
        model: 'tfidf-cosine-v1',
        corpusSize: corpus.length,
        sourceSegmentsCount: 0,
      },
    };
  }

  const sourceSegments: { docId: string; segIndex: number; text: string }[] = [];
  for (const doc of corpus) {
    if (!doc.text || !doc.text.trim()) continue;
    const segs = segmentDocument(doc.text);
    segs.forEach((seg, i) => {
      sourceSegments.push({ docId: doc.documentId, segIndex: i, text: seg });
    });
  }

  if (sourceSegments.length === 0) {
    return {
      globalScore: 0,
      matchedSegments: 0,
      totalSegments: querySegments.length,
      byType: {},
      matches: [],
      metadata: {
        threshold,
        processingTimeMs: Date.now() - startTime,
        model: 'tfidf-cosine-v1',
        corpusSize: corpus.length,
        sourceSegmentsCount: 0,
      },
    };
  }

  const allSegments = [...querySegments, ...sourceSegments.map(s => s.text)];
  const model = buildTfidfModel(allSegments);

  const queryVectors = querySegments.map(s => vectorize(s, model));
  const sourceVectors = sourceSegments.map(s => vectorize(s.text, model));

  const matches: PlagiatMatch[] = [];

  for (let i = 0; i < querySegments.length; i++) {
    const qVec = queryVectors[i];
    const qTokens = new Set(tokenize(querySegments[i]));

    const scores: { idx: number; score: number }[] = [];
    for (let j = 0; j < sourceSegments.length; j++) {
      const score = cosineSimilarity(qVec, sourceVectors[j]);
      scores.push({ idx: j, score });
    }

    scores.sort((a, b) => b.score - a.score);
    const topMatches = scores.slice(0, 3);

    for (const { idx: j, score } of topMatches) {
      if (score < threshold) continue;

      const source = sourceSegments[j];
      const sTokens = new Set(tokenize(source.text));
      const lexScore = jaccardSimilarity(qTokens, sTokens);
      const matchType = classifyMatch(score, lexScore);

      matches.push({
        querySegmentIndex: i,
        querySegmentText: querySegments[i],
        sourceDocumentId: source.docId,
        sourceSegmentIndex: source.segIndex,
        sourceSegmentText: source.text,
        semanticScore: Math.round(score * 10000) / 10000,
        lexicalScore: Math.round(lexScore * 10000) / 10000,
        matchType,
      });
    }
  }

  matches.sort((a, b) => b.semanticScore - a.semanticScore);

  const matchedIndices = new Set(matches.map(m => m.querySegmentIndex));
  const coverage = matchedIndices.size / querySegments.length;
  const avgScore = matches.length > 0
    ? matches.reduce((s, m) => s + m.semanticScore, 0) / matches.length
    : 0;
  const globalScore = Math.min(1, coverage * 0.7 + avgScore * 0.3);

  const byType: Record<string, number> = {};
  for (const m of matches) {
    byType[m.matchType] = (byType[m.matchType] || 0) + 1;
  }

  return {
    globalScore: Math.round(globalScore * 10000) / 10000,
    matchedSegments: matchedIndices.size,
    totalSegments: querySegments.length,
    byType,
    matches: matches.slice(0, 50),
    metadata: {
      threshold,
      processingTimeMs: Date.now() - startTime,
      model: 'tfidf-cosine-v1',
      corpusSize: corpus.length,
      sourceSegmentsCount: sourceSegments.length,
    },
  };
}
