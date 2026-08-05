/**
 * Stop Words Module - PlagiatIA Centralized
 * 🔤 Mots vides (stop words) centralisés pour toutes les langues supportées
 * 
 * Ce module évite la duplication et garantit la cohérence des filtres linguistiques.
 */

// ============================================================================
// FRANÇAIS - Mots vides complets (articles, prépositions, conjugaisons, etc.)
// ============================================================================
export const FRENCH_STOP_WORDS: ReadonlySet<string> = new Set([
  // Articles définis
  'le', 'la', 'les', "l'", 'du', 'des',
  // Articles indéfinis
  'un', 'une', 'une', 'duns', 'dunes',
  // Pronoms personnels sujets
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  // Pronoms objets
  'me', 'te', 'se', 'lui', 'y', 'leur', 'leuri',
  // Pronoms réfléchis
  'moi', 'toi', 'soi', 'lui', 'eux', 'elles', 'nous', 'vous',
  // Possessifs
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  // Démonstratifs
  'ce', 'cet', 'cette', 'ces', 'ceci', 'cela', 'ça',
  // Conjonctions de coordination
  'et', 'ou', 'ni', 'mais', 'or', 'car', 'donc',
  // Conjonctions de subordination
  'que', 'qui', 'quoi', 'dont', 'où', 'qu', 'laquelle', 'lequel',
  'auxquels', 'auxquelles', 'duquel', 'desquels', 'desquelles',
  'celui', 'celle', 'ceux', 'celles', 'ceuxci', 'celleci',
  // Prépositions principales
  'à', 'au', 'aux', 'de', 'dans', 'sur', 'sous', 'par', 'pour',
  'avec', 'sans', 'chez', 'vers', 'entre', 'pendant', 'depuis',
  'avant', 'après', 'contre', 'malgré', 'selon', 'hors', 'sauf',
  // Verbes auxiliaires et courants (infinitif)
  'être', 'avoir', 'faire', 'aller', 'dire', 'voir', 'savoir',
  'pouvoir', 'vouloir', 'venir', 'falloir', 'devoir',
  // Verbes conjugués courants
  'est', 'sont', 'été', 'ait', 'ont', 'eu', 'fait', 'avais',
  'avait', 'avions', 'avaient', 'fut', 'sera', 'seront', 'serait',
  // Adverbes courants
  'plus', 'moins', 'très', 'trop', 'peu', 'aussi', 'encore', 'déjà',
  'bien', 'mal', 'tout', 'toute', 'toutes', 'tous', 'autre', 'autres',
  'toujours', 'jamais', 'parfois', 'souvent', 'rarement', 'bientôt',
  'alors', 'ainsi', 'ici', 'là', 'où', 'quand', 'comment', 'pourquoi',
  'combien', 'tant', 'tellement', 'presque', 'juste', 'seulement',
  'vraiment', 'exactement', 'plutôt', 'pourtant', 'cependant', 'cependant',
  'cependant', 'nan', 'non', 'oui', 'si',
  // Nombres écrits
  'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
  'neuf', 'dix', 'cent', 'mille', 'million', 'milliard',
]);

// ============================================================================
// ANGLAIS - Stop words complets
// ============================================================================
export const ENGLISH_STOP_WORDS: ReadonlySet<string> = new Set([
  // Articles
  'the', 'a', 'an',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us',
  'them', 'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours',
  'hers', 'ours', 'theirs', 'myself', 'yourself', 'himself', 'herself',
  'itself', 'ourselves', 'themselves', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'whose',
  // Conjunctions
  'and', 'or', 'but', 'nor', 'for', 'yet', 'so', 'because', 'although',
  'though', 'since', 'unless', 'while', 'whereas', 'whether',
  // Prepositions
  'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'once',
  // Auxiliary verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'might',
  'can', 'may', 'must', 'shall',
  // Common adverbs/adjectives
  'not', 'no', 'yes', 'very', 'too', 'more', 'most', 'less', 'least',
  'also', 'only', 'just', 'same', 'other', 'such', 'all', 'any', 'each',
  'every', 'both', 'few', 'many', 'much', 'own', 'some', 'than', 'then',
  'there', 'here', 'when', 'where', 'why', 'how', 'now', 'still',
  'even', 'also', 'already', 'always', 'never', 'often', 'ever',
]);

// ============================================================================
// SWAHILI - Maneno ya kawaida (Stop words)
// ============================================================================
export const SWAHILI_STOP_WORDS: ReadonlySet<string> = new Set([
  // Viambishi
  'na', 'ya', 'wa', 'kwa', 'ni', 'hu', 'tu', 'ku', 'mu', 'u', 'i', 'a',
  'za', 'la', 'li', 'lo', 'cha', 'vya', 'nya', 'zo', 'yo', 'ko', 'po',
  'mo', 'pa', 'nyingi', 'ningine', 'zote', 'ote', 'wote', 'vyote',
  // Vifungashio
  'kwamba', 'kama', 'ikuwa', 'lakini', 'pia', 'basi', 'hata', 'kwa sababu',
  'ambapo', 'ambayo', 'ambao', 'ile', 'hii', 'hivi', 'hizo', 'hayo',
  // Vitendukizi
  'ni', 'si', 'ndi', 'tu', 'wa', 'hu', 'ku', 'me', 'ki', 'vi', 'ja',
  'nge', 'ngeli', 'nge', 'ngali', 'singe', 'singekuwa', 'angelikuwa',
  // Wakati
  'leo', 'kesho', 'jana', 'sasa', 'mara', 'bado', 'tayari', 'hapo',
  // Mahali
  'humu', 'hapa', 'pale', 'kuluko', 'nyuma', 'mbele', 'juu', 'chini',
  // Nafsi
  'mimi', 'wewe', 'yeye', 'sisi', 'nyinyi', 'wao',
  // Milengwa
  'angu', 'ako', 'ake', 'etu', 'enu', 'ao',
  // Vigelegele
  'ndiyo', 'hapana', 'labda', 'kumbe', 'eh', 'mhm',
]);

// ============================================================================
// LINGALA - Bobakoli ya lingala (Stop words)
// ============================================================================
export const LINGALA_STOP_WORDS: ReadonlySet<string> = new Set([
  // Ba pronoms
  'na', 'ya', 'wa', 'za', 'o', 'a', 'ba', 'bo', 'bi', 'mi', 'li', 'ki',
  'ma', 'me', 'mo', 'mu', 'to', 'zo',
  // Lingala common words
  'mingi', 'mosusu', 'moko', 'nyonso', 'oyo', 'wana', 'baso', 'ntango',
  'mboka', 'mwana', 'mozoko', 'se', 'te', 'po', 'kombo', 'elengo',
  'bakolo', 'batu', 'bandaku', 'bino', 'bolimbisi', 'bongo', 'bosolo',
]);

// ============================================================================
// DICTONNAIRE UNIFIÉ PAR LANGUE
// ============================================================================
export const STOP_WORDS_BY_LANG: Record<string, ReadonlySet<string>> = {
  fr: FRENCH_STOP_WORDS,
  en: ENGLISH_STOP_WORDS,
  sw: SWAHILI_STOP_WORDS,
  ln: LINGALA_STOP_WORDS,
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupère les stop words pour une langue donnée
 */
export function getStopWords(lang: string): ReadonlySet<string> {
  return STOP_WORDS_BY_LANG[lang] || FRENCH_STOP_WORDS; // Default to French
}

/**
 * Vérifie si un mot est un stop word dans une langue donnée
 */
export function isStopWord(word: string, lang: string = 'fr'): boolean {
  return getStopWords(lang).has(word.toLowerCase());
}

/**
 * Filtre un tableau de mots en supprimant les stop words
 */
export function filterStopWords(words: string[], lang: string = 'fr'): string[] {
  const stopWords = getStopWords(lang);
  return words.filter(w => !stopWords.has(w.toLowerCase()) && w.length >= 2);
}

/**
 * Récupère les stop words combinés (pour recherche multilingue)
 */
export function getCombinedStopWords(languages: string[] = ['fr', 'en']): Set<string> {
  const combined = new Set<string>();
  for (const lang of languages) {
    const words = STOP_WORDS_BY_LANG[lang];
    if (words) {
      for (const word of words) {
        combined.add(word);
      }
    }
  }
  return combined;
}

// Export par défaut pour compatibilité avec code existant
// Combine French + English (usage le plus courant)
export const STOP_WORDS: ReadonlySet<string> = getCombinedStopWords(['fr', 'en']);

export default {
  FRENCH_STOP_WORDS,
  ENGLISH_STOP_WORDS,
  SWAHILI_STOP_WORDS,
  LINGALA_STOP_WORDS,
  STOP_WORDS_BY_LANG,
  STOP_WORDS,
  getStopWords,
  isStopWord,
  filterStopWords,
  getCombinedStopWords,
};

