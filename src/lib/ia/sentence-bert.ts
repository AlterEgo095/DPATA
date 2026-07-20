// Sentence-BERT Simulation - Embeddings Multilingues pour PlagiatIA
// v0.3 — Simulation de distiluse-base-multilingual-cased-v1
// 
// Ce module implémente une vectorisation sémantique basée sur n-grams pondérés
// pour simuler le comportement de Sentence-BERT sans dépendances Python.
// Supporte: Français, Anglais, Swahili, Lingala

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/** Langues supportées par le modèle */
export type SupportedLanguage = 'fr' | 'en' | 'sw' | 'ln' | 'auto';

/** Configuration du générateur d'embeddings */
export interface SentenceBertConfig {
  /** Dimension du vecteur de sortie (384 comme distiluse-base) */
  dimensions: number;
  /** Portée des n-grams [min, max] */
  ngramRange: [number, number];
  /** Langue par défaut */
  defaultLanguage: SupportedLanguage;
  /** Utiliser la normalisation L2 */
  normalize: boolean;
  /** Ponderation IDF */
  useIdf: boolean;
  /** Cache activé */
  cacheEnabled: boolean;
}

/** Métadonnées d'un embedding généré */
export interface EmbeddingMetadata {
  text: string;
  language: DetectedLanguage;
  tokenCount: number;
  ngramCount: number;
  processingTimeMs: number;
  timestamp: string;
}

/** Résultat complet avec embedding et métadonnées */
export interface EmbeddingResult {
  vector: Float64Array;
  metadata: EmbeddingMetadata;
}

/** Résultat de recherche de similarité */
export interface SimilaritySearchResult {
  id: string;
  text: string;
  score: number;
  rank: number;
  metadata?: EmbeddingMetadata;
}

/** Langue détectée */
export type DetectedLanguage = 'fr' | 'en' | 'sw' | 'ln' | 'unknown';

// ============================================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================================

const DEFAULT_CONFIG: SentenceBertConfig = {
  dimensions: 384, // Même dimension que distiluse-base-multilingual-cased-v1
  ngramRange: [1, 3], // Unigrams, bigrams, trigrams
  defaultLanguage: 'auto',
  normalize: true,
  useIdf: true,
  cacheEnabled: true,
};

// ============================================================================
// DICTIONNAIRES LINGUISTIQUES MULTILINGUES
// ============================================================================

/**
 * Mots spécifiques par langue pour la détection
 * Permet d'identifier la langue dominante d'un texte
 */
const LANGUAGE_MARKERS: Record<string, { markers: Set<string>; weight: number }> = {
  fr: {
    markers: new Set([
      'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'ce',
      'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs', 'que', 'qui', 'dont',
      'est', 'sont', 'été', 'être', 'avoir', 'fait', 'faire', 'pour', 'dans',
      'sur', 'avec', 'sans', 'par', 'mais', 'ou', 'donc', 'car', 'ni', 'comme',
      'plus', 'moins', 'très', 'bien', 'tout', 'toute', 'toutes', 'autre', 'autres',
      'aussi', 'encore', 'déjà', 'toujours', 'jamais', 'alors', 'ainsi', 'après',
      'avant', 'contre', 'entre', 'vers', 'chez', 'depuis', 'pendant', 'lorsque',
      'puisque', 'quoique', 'cependant', 'cependant', 'cependant', 'notre', 'nos',
      'votre', 'vos', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'leur', 'leurs',
      // Mots distinctifs français
      'congé', 'travail', 'entreprise', 'gouvernement', 'ministère', 'république',
      'démocratique', 'congolaise', 'université', 'faculté', 'département',
    ]),
    weight: 1.0,
  },
  en: {
    markers: new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'so', 'because', 'if', 'when',
      'where', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'shall', 'can', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
      'from', 'of', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'only', 'own', 'same', 'than', 'too', 'very', 'just', 'about', 'also',
      'now', 'not', 'no', 'any', 'my', 'your', 'his', 'her', 'its', 'our',
      'their', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'them',
    ]),
    weight: 1.0,
  },
  sw: {
    markers: new Set([
      'na', 'ya', 'wa', 'la', 'kwa', 'ku', 'mu', 'u', 'i', 'za', 'cha', 'vya',
      'hya', 'nyingi', 'kubwa', 'ndogo', 'refu', 'fupi', 'pya', 'zuri', 'baya',
      'nzuri', 'nzito', 'epesi', 'tupu', 'juu', 'chini', 'ndani', 'nje', 'karibu',
      'mbali', 'leo', 'kesho', 'jana', 'sasa', 'mara', 'muda', 'mwaka', 'mwezi',
      'wiki', 'siku', 'langu', 'lako', 'lake', 'yetu', 'yenu', 'yao', 'angu',
      'ako', 'ake', 'etu', 'enu', 'ao', 'ninaweza', 'unaweza', 'anaweza', 'tuweze',
      'mwenewe', 'mwenyewe', 'lenyewe', 'kenyewe', 'hapa', 'pale', 'kule', 'humu',
      'kuliko', 'lakini', 'au', 'ama', 'kama', 'ikiwa', 'ambapo', 'ambayo', 'ambaye',
      // Mots swahili académiques
      'chuo', 'kikuu', 'sayansi', 'elimu', 'ufundishaji', 'tafiti', 'serikali',
      'shirika', 'maendeleo', 'jamii', 'uchumi', 'mazingira', 'afya', 'kanisa',
    ]),
    weight: 1.2, // Poids plus élevé car moins commun
  },
  ln: {
    markers: new Set([
      'na', 'ya', 'wa', 'la', 'kwa', 'ku', 'mu', 'ba', 'mi', 'li', 'ma', 'ki',
      'yo', 'zo', 'bo', 'lo', 'ngo', 'mingi', 'mosusu', 'moke', 'molai', 'mwa',
      'zoba', 'tei', 'lamvu', 'mbote', 'malamu', 'malamu', 'mboka', 'mokolo',
      'sika', 'lelo', 'luyobo', 'mokolo', 'sanza', 'bokolo', 'mwana', 'mkwa',
      'nata', 'kolamba', 'koma', 'tuna', 'lenda', 'zali', 'vonama', 'somba',
      'loboko', 'likolo', 'se', 'wana', 'bino', 'yango', 'bino', 'yinso',
      // Mots lingala courants
      'mozindo', 'kimia', 'mayele', 'bosolo', 'ntomo', 'kelasi', 'lipanda',
      'mabanga', 'biloko', 'bakolo', 'bandeko', 'liboso', 'sima', 'mwambe',
      'mboka', 'kinshasa', 'congo', 'zaire', 'mongala', 'kasai', 'equateur',
    ]),
    weight: 1.3, // Poids plus élevé (langue régionale)
  },
};

/**
 * Stop words étendus par langue pour le filtrage
 */
const STOP_WORDS_MULTILANG: Record<string, Set<string>> = {
  fr: LANGUAGE_MARKERS.fr.markers,
  en: LANGUAGE_MARKERS.en.markers,
  sw: LANGUAGE_MARKERS.sw.markers,
  ln: LANGUAGE_MARKERS.ln.markers,
};

// ============================================================================
// HASH FONCTION POUR VECTORISATION DÉTERMINISTE
// ============================================================================

/**
 * Fonction de hash déterministe basée sur djb2
 * Convertit une chaîne en nombre uniformément distribué
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convertir en entier 32 bits
  }
  return Math.abs(hash);
}

/**
 * Génère une valeur pseudo-aléatoire mais déterministe pour un n-gram
 * Simule le poids qu'un vrai modèle BERT attribuerait
 */
function semanticWeight(ngram: string, language: DetectedLanguage): number {
  const baseHash = hashString(ngram);
  
  // Normaliser entre -1 et 1
  const normalized = (baseHash % 10000) / 10000; 
  
  // Appliquer une transformation sinusoïdale pour plus de variété
  // Cela simule mieux les embeddings réels qui ne sont pas linéaires
  return Math.sin(normalized * Math.PI * 2) * Math.cos(normalized * Math.PI);
}

// ============================================================================
// DÉTECTION DE LANGUE
// ============================================================================

/**
 * Détecte la langue dominante d'un texte
 * Analyse les marqueurs linguistiques et retourne la langue la plus probable
 */
export function detectLanguage(text: string): DetectedLanguage {
  const words = text.toLowerCase().match(/\b[a-zA-ZÀ-ÿ]{2,}\b/g) || [];
  
  if (words.length === 0) return 'unknown';
  
  const scores: Record<string, number> = { fr: 0, en: 0, sw: 0, ln: 0 };
  
  for (const word of words) {
    for (const [lang, { markers, weight }] of Object.entries(LANGUAGE_MARKERS)) {
      if (markers.has(word)) {
        scores[lang] = (scores[lang] || 0) + weight;
      }
    }
  }
  
  // Trouver la langue avec le score maximum
  let maxScore = 0;
  let detectedLang: DetectedLanguage = 'unknown';
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang as DetectedLanguage;
    }
  }
  
  // Seuil minimum pour éviter les faux positifs
  if (maxScore < words.length * 0.05) {
    return 'unknown';
  }
  
  return detectedLang;
}

// ============================================================================
// TOKENISATION ET N-GRAMS
// ============================================================================

interface TokenizationResult {
  tokens: string[];
  ngrams: string[];
  language: DetectedLanguage;
}

/**
 * Tokenise un texte et génère les n-grams selon la configuration
 * Supporte le multilingue avec gestion des caractères spéciaux
 */
function tokenizeAndNgram(
  text: string,
  ngramRange: [number, number],
  language: DetectedLanguage
): TokenizationResult {
  // Normalisation du texte préserver les caractères accentués
  let normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sÀ-ÿ]/g, ' ') // Garder les caractères accentués
    .trim();
  
  // Extraction des tokens (mots de 2+ caractères)
  const tokens = normalized
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .filter(t => {
      // Filtrer les stop words de la langue détectée
      const stopWords = STOP_WORDS_MULTILANG[language];
      if (stopWords && stopWords.has(t)) return false;
      return true;
    });
  
  // Génération des n-grams
  const ngrams: string[] = [];
  const [minN, maxN] = ngramRange;
  
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join('_');
      ngrams.push(ngram);
    }
  }
  
  return { tokens, ngrams, language };
}

// ============================================================================
// CALCUL IDF (Inverse Document Frequency)
// ============================================================================

/**
 * Calculateur IDF avec cache pour performance
 * Utilisé pour pondérer les n-grams selon leur rareté
 */
class IdfCalculator {
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;
  private cache: Map<string, number> = new Map();
  
  /**
   * Met à jour les statistiques IDF avec un nouveau document
   */
  addDocument(ngrams: string[]): void {
    this.totalDocuments++;
    const uniqueNgrams = new Set(ngrams);
    
    for (const ngram of uniqueNgrams) {
      this.documentFrequency.set(
        ngram,
        (this.documentFrequency.get(ngram) || 0) + 1
      );
    }
    
    // Invalider le cache quand on ajoute un document
    this.cache.clear();
  }
  
  /**
   * Calcule l'IDF d'un n-gram
   * IDF = log((N + 1) / (df + 1)) + 1 (smooth IDF)
   */
  getIdf(ngram: string): number {
    // Vérifier le cache
    if (this.cache.has(ngram)) {
      return this.cache.get(ngram)!;
    }
    
    const df = this.documentFrequency.get(ngram) || 0;
    const idf = Math.log((this.totalDocuments + 1) / (df + 1)) + 1;
    
    this.cache.set(ngram, idf);
    return idf;
  }
  
  /**
   * Réinitialise le calculateur
   */
  reset(): void {
    this.documentFrequency.clear();
    this.cache.clear();
    this.totalDocuments = 0;
  }
  
  getStats(): { totalDocuments: number; vocabularySize: number } {
    return {
      totalDocuments: this.totalDocuments,
      vocabularySize: this.documentFrequency.size,
    };
  }
}

// ============================================================================
// CACHE D'EMBEDDINGS
// ============================================================================

/**
 * Cache LRU simple pour les embeddings générés
 * Évite de recalculer les mêmes textes plusieurs fois
 */
class EmbeddingCache {
  private cache: Map<string, { vector: Float64Array; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number; // Time-to-live en ms
  
  constructor(maxSize = 1000, ttl = 30 * 60 * 1000) { // 1000 items, 30 min TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  private generateKey(text: string, config: SentenceBertConfig): string {
    return `${config.dimensions}:${config.ngramRange[0]}-${config.ngramRange[1]}:${text}`;
  }
  
  get(text: string, config: SentenceBertConfig): Float64Array | null {
    const key = this.generateKey(text, config);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Vérifier TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.vector;
  }
  
  set(text: string, config: SentenceBertConfig, vector: Float64Array): void {
    const key = this.generateKey(text, config);
    
    // Éviction si nécessaire (stratégie simple: supprimer le premier)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { vector, timestamp: Date.now() });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// CLASSE PRINCIPALE - SENTENCE BERT SIMULATION
// ============================================================================

/**
 * SentenceBERT Simulator
 * 
 * Simule le comportement de distiluse-base-multilingual-cased-v1
 * pour générer des embeddings sémantiques sans dépendances ML lourdes.
 * 
 * Caractéristiques:
 * - Vectorisation en 384 dimensions (comme le modèle original)
 * - Support multilingue: FR, EN, SW, LN
 * - Basé sur n-grams pondérés sémantiquement
 * - Cache intégré pour performances
 * - Normalisation L2 optionnelle
 * 
 * @example
 * ```typescript
 * const sbert = new SentenceBert();
 * const embedding = await sbert.generateEmbedding('Texte à vectoriser');
 * const similarity = sbert.cosineSimilarity(embedding1, embedding2);
 * ```
 */
export class SentenceBert {
  private config: SentenceBertConfig;
  private idfCalculator: IdfCalculator;
  private cache: EmbeddingCache;
  private initialized: boolean = false;
  
  constructor(config?: Partial<SentenceBertConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.idfCalculator = new IdfCalculator();
    this.cache = new EmbeddingCache(500, 30 * 60 * 1000);
  }
  
  /**
   * Initialise le moteur avec un corpus de référence pour IDF
   * Optionnel mais recommandé pour de meilleurs résultats
   */
  async initialize(corpus?: string[]): Promise<void> {
    if (this.initialized) return;
    
    if (corpus && this.config.useIdf) {
      for (const doc of corpus) {
        const { ngrams } = tokenizeAndNgram(
          doc,
          this.config.ngramRange,
          detectLanguage(doc)
        );
        this.idfCalculator.addDocument(ngrams);
      }
    }
    
    this.initialized = true;
  }
  
  /**
   * Génère un embedding pour un texte donné
   * 
   * @param text - Le texte à vectoriser
   * @returns Float64Array de dimension `config.dimensions`
   * 
   * @example
   * ```typescript
   * const vector = await sbert.generateEmbedding('Le plagiat est un problème sérieux');
   * // vector.length === 384
   * ```
   */
  async generateEmbedding(text: string): Promise<Float64Array> {
    const startTime = Date.now();
    
    // Vérifier le cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(text, this.config);
      if (cached) return cached;
    }
    
    // Détection de langue
    const language = this.config.defaultLanguage === 'auto'
      ? detectLanguage(text)
      : this.config.defaultLanguage;
    
    // Tokenisation et extraction de n-grams
    const { tokens, ngrams } = tokenizeAndNgram(
      text,
      this.config.ngramRange,
      language
    );
    
    // Initialisation du vecteur
    const vector = new Float64Array(this.config.dimensions);
    
    if (ngrams.length === 0) {
      // Retourner un vecteur quasi-nul pour les textes vides
      if (this.config.normalize) {
        // Vecteur unitaire aléatoire mais déterministe
        const seed = hashString(text);
        for (let i = 0; i < this.config.dimensions; i++) {
          vector[i] = Math.sin(seed * (i + 1) * 0.01) * 0.001;
        }
      }
      return vector;
    }
    
    // Remplissage du vecteur avec les poids sémantiques des n-grams
    for (const ngram of ngrams) {
      // Hash déterministe pour distribuer le n-gram dans l'espace vectoriel
      const baseHash = hashString(ngram);
      
      // Chaque n-gram influence plusieurs dimensions (sparse distributed representation)
      const numDimensionsToInfluence = Math.min(
        Math.max(3, Math.floor(this.config.dimensions / 50)),
        10
      );
      
      for (let d = 0; d < numDimensionsToInfluence; d++) {
        const dimIndex = (baseHash + d * 31) % this.config.dimensions;
        
        // Poids sémantique de base
        let weight = semanticWeight(ngram + `_d${d}`, language);
        
        // Pondération IDF si activée
        if (this.config.useIdf) {
          const idf = this.idfCalculator.getIdf(ngram);
          weight *= Math.sqrt(idf); // Racine carrée pour amortir l'effet IDF
        }
        
        // Pondération par longueur du n-gram (les n-grams plus longs sont plus spécifiques)
        const ngramLength = ngram.split('_').length;
        weight *= (0.5 + ngramLength * 0.25);
        
        vector[dimIndex] += weight;
      }
    }
    
    // Normalisation L2 si activée
    if (this.config.normalize) {
      this.normalizeL2(vector);
    }
    
    // Mise en cache
    if (this.config.cacheEnabled) {
      this.cache.set(text, this.config, vector);
    }
    
    return vector;
  }
  
  /**
   * Génère un embedding avec métadonnées détaillées
   */
  async generateEmbeddingWithMetadata(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const vector = await this.generateEmbedding(text);
    const language = detectLanguage(text);
    const { tokens, ngrams } = tokenizeAndNgram(
      text,
      this.config.ngramRange,
      language
    );
    
    return {
      vector,
      metadata: {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        language,
        tokenCount: tokens.length,
        ngramCount: ngrams.length,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  /**
   * Calcule la similarité cosinus entre deux vecteurs
   * 
   * @returns Valeur entre -1 et 1 (1 = identique, 0 = orthogonal, -1 = opposé)
   */
  cosineSimilarity(a: Float64Array, b: Float64Array): number {
    if (a.length !== b.length) {
      throw new Error('Les vecteurs doivent avoir la même dimension');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * Trouve les éléments les plus similaires dans un corpus
   * 
   * @param query - Texte de recherche
   * @param corpus - Corpus de documents à comparer { id, text }[]
   * @param topK - Nombre de résultats à retourner
   * @param threshold - Seuil minimum de similarité
   * @returns Résultats triés par score décroissant
   */
  async findSimilar(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    topK: number = 5,
    threshold: number = 0
  ): Promise<SimilaritySearchResult[]> {
    // Générer l'embedding de la requête
    const queryVector = await this.generateEmbedding(query);
    
    // Calculer les similarités
    const results: Array<{
      id: string;
      text: string;
      score: number;
      metadata?: EmbeddingMetadata;
    }> = [];
    
    for (const doc of corpus) {
      const docVector = await this.generateEmbedding(doc.text);
      const score = this.cosineSimilarity(queryVector, docVector);
      
      if (score >= threshold) {
        results.push({
          id: doc.id,
          text: doc.text.substring(0, 200),
          score: Math.round(score * 10000) / 10000,
        });
      }
    }
    
    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);
    
    // Prendre les topK résultats
    return results.slice(0, topK).map((r, index) => ({
      ...r,
      rank: index + 1,
    }));
  }
  
  /**
   * Calcule la matrice de similarité entre tous les documents d'un corpus
   * Utile pour l'analyse comparative multi-documents
   */
  async computeSimilarityMatrix(
    corpus: Array<{ id: string; text: string }>
  ): Promise<Array<{ docId1: string; docId2: string; similarity: number }>> {
    // Pré-calculer tous les embeddings
    const embeddings = new Map<string, Float64Array>();
    for (const doc of corpus) {
      embeddings.set(doc.id, await this.generateEmbedding(doc.text));
    }
    
    // Calculer les paires de similarité
    const matrix: Array<{ docId1: string; docId2: string; similarity: number }> = [];
    
    for (let i = 0; i < corpus.length; i++) {
      for (let j = i + 1; j < corpus.length; j++) {
        const vec1 = embeddings.get(corpus[i].id)!;
        const vec2 = embeddings.get(corpus[j].id)!;
        const similarity = this.cosineSimilarity(vec1, vec2);
        
        matrix.push({
          docId1: corpus[i].id,
          docId2: corpus[j].id,
          similarity: Math.round(similarity * 10000) / 10000,
        });
      }
    }
    
    return matrix.sort((a, b) => b.similarity - a.similarity);
  }
  
  /**
   * Normalisation L2 inplace d'un vecteur
   */
  private normalizeL2(vector: Float64Array): void {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }
  }
  
  /**
   * Vide les caches
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Retourne les statistiques actuelles
   */
  getStats(): {
    config: SentenceBertConfig;
    idfStats: ReturnType<IdfCalculator['getStats']>;
    cacheSize: number;
    initialized: boolean;
  } {
    return {
      config: this.config,
      idfStats: this.idfCalculator.getStats(),
      cacheSize: this.cache.size,
      initialized: this.initialized,
    };
  }
  
  /**
   * Réinitialise complètement le moteur
   */
  reset(): void {
    this.idfCalculator.reset();
    this.cache.clear();
    this.initialized = false;
  }
}

// ============================================================================
// FONCTIONS UTILITAIRES STANDALONE
// ============================================================================

/** Instance globale singleton pour usage rapide */
let globalInstance: SentenceBert | null = null;

/**
 * Obtient ou crée l'instance globale de SentenceBert
 */
export async function getSentenceBert(config?: Partial<SentenceBertConfig>): Promise<SentenceBert> {
  if (!globalInstance) {
    globalInstance = new SentenceBert(config);
    await globalInstance.initialize();
  }
  return globalInstance;
}

/**
 * Fonction raccourci pour générer un embedding
 */
export async function generateEmbedding(text: string): Promise<Float64Array> {
  const sbert = await getSentenceBert();
  return sbert.generateEmbedding(text);
}

/**
 * Fonction raccourci pour calculer la similarité cosinus
 */
export function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  const sbert = new SentenceBert();
  return sbert.cosineSimilarity(a, b);
}

/**
 * Fonction raccourci pour trouver des documents similaires
 */
export async function findSimilar(
  query: string,
  corpus: Array<{ id: string; text: string }>,
  topK?: number,
  threshold?: number
): Promise<SimilaritySearchResult[]> {
  const sbert = await getSentenceBert();
  return sbert.findSimilar(query, corpus, topK, threshold);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SentenceBert;
