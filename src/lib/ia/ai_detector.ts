// Détection de texte généré par IA (ChatGPT, Claude, etc.)
// Approche : analyse stylométrique + perplexité proxy

interface StylometricFeatures {
  avgSentenceLength: number;
  sentenceLengthStd: number;
  burstiness: number;
  ttr: number; // Type-Token Ratio
  punctuationDensity: number;
  avgWordLength: number;
  repeatedBigramsRatio: number;
  connectiveDensity: number;
  passiveIndicator: number;
}

export interface AIDetectionResult {
  isAIGenerated: boolean;
  confidence: number;
  aiProbability: number;
  verdict: string;
  confidenceLabel: string;
  features: StylometricFeatures;
  perplexityScore: number;
  explanation: string;
}

const CONNECTIVES = [
  // Français
  'en effet', 'cependant', 'néanmoins', 'toutefois', 'par ailleurs',
  'de plus', 'en outre', 'par conséquent', 'ainsi', 'donc',
  'or', 'mais', 'car', 'puisque', 'bien que',
  // Anglais
  'furthermore', 'however', 'moreover', 'therefore', 'thus',
  'consequently', 'nevertheless', 'nonetheless', 'additionally',
];

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/).filter(s => s.trim());
}

function tokenizeWords(text: string): string[] {
  const matches = text.toLowerCase().match(/\b[a-zA-ZÀ-ÿ]+\b/g) || [];
  return matches;
}

function computeStylometricFeatures(text: string): StylometricFeatures {
  const sentences = splitSentences(text);
  const words = tokenizeWords(text);

  if (!sentences.length || !words.length) {
    return {
      avgSentenceLength: 0, sentenceLengthStd: 0, burstiness: 0, ttr: 0,
      punctuationDensity: 0, avgWordLength: 0, repeatedBigramsRatio: 0,
      connectiveDensity: 0, passiveIndicator: 0,
    };
  }

  const sentLengths = sentences.map(s => tokenizeWords(s).length);
  const avgSentLen = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
  const variance = sentLengths.reduce((sum, l) => sum + Math.pow(l - avgSentLen, 2), 0) / sentLengths.length;
  const sentLenStd = Math.sqrt(variance);
  const burstiness = avgSentLen > 0 ? sentLenStd / avgSentLen : 0;

  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;

  const punctMatches = text.match(/[.,;:!?;""'()\-–—]/g) || [];
  const punctuationDensity = punctMatches.length / words.length;

  const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;

  // Bigrammes répétés
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  const bigramCounts = new Map<string, number>();
  for (const b of bigrams) {
    bigramCounts.set(b, (bigramCounts.get(b) || 0) + 1);
  }
  const repeatedBigrams = Array.from(bigramCounts.values()).filter(c => c > 1).length;
  const repeatedBigramsRatio = bigrams.length > 0 ? repeatedBigrams / bigrams.length : 0;

  // Connecteurs
  const textLower = text.toLowerCase();
  let connectiveCount = 0;
  for (const c of CONNECTIVES) {
    const matches = textLower.match(new RegExp(`\\b${c}\\b`, 'g'));
    if (matches) connectiveCount += matches.length;
  }
  const connectiveDensity = sentences.length > 0 ? connectiveCount / sentences.length : 0;

  // Voix passive (français)
  const passivePatterns = [
    /\b(?:est|sont|était|étaient|été|être)\s+\w+(?:é|ée|és|ées)\b/g,
    /\b(?:a|ont|avait|avaient)\s+été\s+\w+(?:é|ée)\b/g,
  ];
  let passiveCount = 0;
  for (const p of passivePatterns) {
    const matches = textLower.match(p);
    if (matches) passiveCount += matches.length;
  }
  const passiveIndicator = sentences.length > 0 ? passiveCount / sentences.length : 0;

  return {
    avgSentenceLength: Math.round(avgSentLen * 100) / 100,
    sentenceLengthStd: Math.round(sentLenStd * 100) / 100,
    burstiness: Math.round(burstiness * 10000) / 10000,
    ttr: Math.round(ttr * 10000) / 10000,
    punctuationDensity: Math.round(punctuationDensity * 10000) / 10000,
    avgWordLength: Math.round(avgWordLen * 100) / 100,
    repeatedBigramsRatio: Math.round(repeatedBigramsRatio * 10000) / 10000,
    connectiveDensity: Math.round(connectiveDensity * 10000) / 10000,
    passiveIndicator: Math.round(passiveIndicator * 10000) / 10000,
  };
}

function computePerplexityProxy(text: string): number {
  const words = tokenizeWords(text);
  if (words.length < 10) return 0.5;

  const unigramCounts = new Map<string, number>();
  for (const w of words) unigramCounts.set(w, (unigramCounts.get(w) || 0) + 1);

  const bigrams: [string, string][] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push([words[i], words[i + 1]]);
  }
  const bigramCounts = new Map<string, number>();
  for (const [w1, w2] of bigrams) {
    const key = `${w1} ${w2}`;
    bigramCounts.set(key, (bigramCounts.get(key) || 0) + 1);
  }

  const logLikelihoods: number[] = [];
  for (const [w1, w2] of bigrams) {
    const key = `${w1} ${w2}`;
    const pW2GivenW1 = (bigramCounts.get(key) || 0 + 1) / ((unigramCounts.get(w1) || 0) + unigramCounts.size);
    logLikelihoods.push(-Math.log(pW2GivenW1));
  }

  const avgLogLikelihood = logLikelihoods.reduce((a, b) => a + b, 0) / logLikelihoods.length;
  const perplexity = avgLogLikelihood < 20 ? Math.exp(avgLogLikelihood) : 0;
  return Math.min(1, perplexity / 50);
}

export function detectAIGenerated(text: string): AIDetectionResult {
  if (text.trim().length < 100) {
    return {
      isAIGenerated: false,
      confidence: 0,
      aiProbability: 0,
      verdict: 'Humain',
      confidenceLabel: 'Faible',
      features: computeStylometricFeatures(text),
      perplexityScore: 0.5,
      explanation: 'Texte trop court pour analyse fiable (minimum 100 caractères).',
    };
  }

  const features = computeStylometricFeatures(text);
  const perplexityScore = computePerplexityProxy(text);

  let aiScore = 0;
  const explanations: string[] = [];

  // 1. Burstiness (25%)
  if (features.burstiness < 0.3) {
    aiScore += 0.25;
    explanations.push(`Burstiness faible (${features.burstiness.toFixed(2)}) : phrases uniformes, typique de l'IA`);
  } else if (features.burstiness > 0.5) {
    aiScore -= 0.10;
    explanations.push(`Burstiness élevée (${features.burstiness.toFixed(2)}) : variabilité naturelle, typique de l'humain`);
  }

  // 2. TTR (20%)
  if (features.ttr < 0.5) {
    aiScore += 0.20;
    explanations.push(`Diversité lexicale faible (TTR=${features.ttr.toFixed(2)}) : vocabulaire répétitif`);
  } else if (features.ttr > 0.65) {
    aiScore -= 0.05;
    explanations.push(`Bonne diversité lexicale (TTR=${features.ttr.toFixed(2)})`);
  }

  // 3. Connecteurs (15%)
  if (features.connectiveDensity > 1.5) {
    aiScore += 0.15;
    explanations.push(`Densité de connecteurs élevée (${features.connectiveDensity.toFixed(2)}/phrase) : structure artificielle`);
  } else if (features.connectiveDensity < 0.5) {
    aiScore -= 0.05;
  }

  // 4. Voix passive (10%)
  if (features.passiveIndicator > 0.5) {
    aiScore += 0.10;
    explanations.push(`Voix passive fréquente (${features.passiveIndicator.toFixed(2)}/phrase) : style formel typique de l'IA`);
  }

  // 5. Perplexité (30%)
  if (perplexityScore < 0.5) {
    aiScore += 0.30;
    explanations.push(`Perplexité faible (${perplexityScore.toFixed(2)}) : texte prévisible, probablement IA`);
  } else if (perplexityScore > 0.7) {
    aiScore -= 0.10;
    explanations.push(`Perplexité élevée (${perplexityScore.toFixed(2)}) : texte créatif, typique de l'humain`);
  }

  // 6. Bigrammes répétés (10%)
  if (features.repeatedBigramsRatio > 0.05) {
    aiScore += 0.10;
    explanations.push(`Bigrammes répétés (${features.repeatedBigramsRatio.toFixed(2)}) : structures récurrentes`);
  }

  const aiProbability = Math.max(0, Math.min(1, aiScore));
  const isAIGenerated = aiProbability > 0.5;
  const confidence = Math.abs(aiProbability - 0.5) * 2;
  const verdict = isAIGenerated ? 'IA générée' : 'Humain';
  const confidenceLabel = confidence < 0.3 ? 'Faible' : confidence < 0.6 ? 'Modérée' : 'Élevée';

  return {
    isAIGenerated,
    confidence: Math.round(confidence * 10000) / 10000,
    aiProbability: Math.round(aiProbability * 10000) / 10000,
    verdict,
    confidenceLabel,
    features,
    perplexityScore: Math.round(perplexityScore * 10000) / 10000,
    explanation: explanations.length > 0 ? explanations.join(' | ') : 'Analyse neutre, features équilibrées.',
  };
}
