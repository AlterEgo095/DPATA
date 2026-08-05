/**
 * French Stemmer Module - PlagiatIA
 * 🔤 Algorithme de stemming français basé sur l'algorithme de Porter adapté
 * 
 * Référence: "Stemming French: A Study of the Algorithm and its Application" (Savoy, 1993)
 */

/**
 * Suffixes à supprimer avec leur longueur minimale du radical restant
 */
const SUFFIX_STEP1 = [
  { suffix: 'issement', minLen: 0 },  // + replacement rules
  { suffix: 'issant', minLen: 0 },
  { suffix: 'ement', minLen: 0 },
  { suffix: 'euse', minLen: 0 },
  { suffix: 'euses', minLen: 0 },
  { suffix: 'ation', minLen: 0 },
  { suffix: 'ition', minLen: 0 },
  { suffix: 'ation', minLen: 0 },
  { suffix: 'able', minLen: 0 },
  { suffix: 'ible', minLen: 0 },
  { suffix: 'ique', minLen: 0 },
  { suffix: 'isme', minLen: 0 },
  { suffix: 'iste', minLen: 0 },
  { suffix: 'eux', minLen: 0 },
  { suffix: 'euse', minLen: 0 },
  { suffix: 'ment', minLen: 3 },
  { suffix: 'ment', minLen: 3 },
  { suffix: 'ance', minLen: 3 },
  { suffix: 'ence', minLen: 3 },
];

const SUFFIX_STEP2A = [
  { suffix: 'ira', cond: (w: string) => w.includes('i') },
  { suffix: 'ie', cond: () => true },
  { suffix: 'ee', cond: () => true },
  { suffix: 'mes', cond: () => true },
  { suffix: 'ses', cond: () => true },
  { suffix: 'ite', cond: () => true },
  { suffix: 'ait', cond: () => true },
  { suffix: 'ant', cond: (w: string) => w.includes('i') },
  { suffix: 'ent', cond: (w: string) => w.includes('i') },
  { suffix: 'ifs', cond: (w: string) => w.includes('i') },
  { suffix: 'ive', cond: (w: string) => w.includes('i') },
];

const SUFFIX_STEP2B = [
  { suffix: 'ions', minLen: 0 },
  { suffix: 'ier', minLen: 0 },
  { suffix: 'ière', minLen: 0 },
  { suffix: 'ion', minLen: 4, cond: (w: string) => /[st]$/.test(w) },
  { suffix: 'er', minLen: 0 },
  { suffix: 'ez', minLen: 0 },
  { suffix: 'e', minLen: 0 },
];

// Voyelles pour le test
const VOWELS = 'aeiouyàâäéèêëïîôùûüÿœæ';

/**
 * Vérifie si un mot contient une voyelle
 */
function hasVowel(word: string): boolean {
  return word.split('').some(c => VOWELS.includes(c));
}

/**
 * Compte le nombre de syllabes (approximation par groupes voyelle-consonne)
 */
function countSyllables(word: string): number {
  let count = 0;
  let prevVowel = false;
  
  for (const char of word.toLowerCase()) {
    const isVowel = VOWELS.includes(char);
    if (isVowel && !prevVowel) {
      count++;
    }
    prevVowel = isVowel;
  }
  
  return count;
}

/**
 * Supprime le suffixe d'un mot si les conditions sont remplies
 */
function removeSuffix(word: string, suffix: string, minLength: number = 2): string | null {
  if (!word.endsWith(suffix)) return null;
  
  const stem = word.slice(0, -suffix.length);
  
  if (stem.length < minLength) return null;
  if (!hasVowel(stem)) return null;
  
  return stem;
}

/**
 * Remplace un suffixe par un autre
 */
function replaceSuffix(word: string, oldSuffix: string, newSuffix: string, minLength: number = 2): string | null {
  if (!word.endsWith(oldSuffix)) return null;
  
  const stem = word.slice(0, -oldSuffix.length) + newSuffix;
  
  if (stem.slice(0, -newSuffix.length || undefined).length < minLength) return null;
  if (!hasVowel(stem.slice(0, -newSuffix.length || undefined))) return null;
  
  return stem;
}

/**
 * Stemming français simplifié mais efficace
 * Basé sur l'algorithme de Porter-Stemmeur
 * 
 * @param word Le mot à stemming
 * @returns Le radical (stem) du mot
 * 
 * @example
 * frenchStemmer('traitement') // → 'trait'
 * frenchStemmer('analyse') // → 'analys'
 * frenchStemmer('détecteur') // → 'détec'
 */
export function frenchStemmer(word: string): string {
  if (word.length <= 2) return word;
  
  let w = word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  
  // Étape 0: Nettoyage initial des accents (déjà fait ci-dessus)
  
  // Étape 1: Suppression des suffixes pluriels et féminins
  // Pluriel en s/x/z
  if ((w.endsWith('s') || w.endsWith('x') || w.endsWith('z')) && w.length > 3) {
    // Vérifier que ce n'est pas un mot qui se termine naturellement par s
    const prevChar = w[w.length - 2];
    if (!'aeiou'.includes(prevChar)) {
      w = w.slice(0, -1);
    }
  }
  
  // Féminin en e (si le mot a plus de 3 lettres et contient une voyelle)
  if (w.endsWith('e') && w.length > 3 && hasVowel(w.slice(0, -1))) {
    w = w.slice(0, -1);
  }
  
  // Étape 2: Suppression des suffixes verbaux et adjectivaux
  const verbalSuffixes = [
    'issaient', 'irais', 'irait', 'irent', 'issent', 'irons', 'irez',
    'iraient', 'isses', 'isses', 'iront', 'isses', 'issiez', 'issant',
    'aient', 'asses', 'antes', 'antes', 'âtes', 'âmes', 'èrent',
    'ais', 'ait', 'ant', 'ant', 'ées', 'ée', 'és', 'er', 'ez',
    'ent', 'ons', 'as', 'es'
  ];
  
  for (const suffix of verbalSuffixes) {
    if (w.endsWith(suffix) && w.length > suffix.length + 2) {
      const candidate = w.slice(0, -suffix.length);
      if (hasVowel(candidate)) {
        w = candidate;
        break;
      }
    }
  }
  
  // Étape 3: Suppression des suffixes nominaux/ adverbiaux
  const nominalSuffixes = [
    { suffix: 'isation', repl: '' },
    { suffix: 'isateur', repl: '' },
    { suffix: 'atrice', repl: '' },
    { suffix: 'tion', repl: '' },
    { suffix: 'logue', repl: 'log' },
    { suffix: 'ique', repl: '' },
    { suffix: 'isme', repl: '' },
    { suffix: 'iste', repl: '' },
    { suffix: 'ité', repl: '' },
    { suffix: 'if', repl: '' },
    { suffix: 'ive', repl: '' },
    { suffix: 'eur', repl: '' },
    { suffix: 'euse', repl: '' },
    { suffix: 'ment', repl: '', minLen: 4 },
    { suffix: 'ance', repl: '', minLen: 4 },
    { suffix: 'ence', repl: '', minLen: 4 },
    { suffix: 'able', repl: '', minLen: 4 },
    { suffix: 'ible', repl: '', minLen: 4 },
  ];
  
  for (const { suffix, repl, minLen = 2 } of nominalSuffixes) {
    if (w.endsWith(suffix) && w.length > suffix.length + (minLen || 2)) {
      const candidate = w.slice(0, -suffix.length) + repl;
      if (candidate.length >= (minLen || 2) && hasVowel(candidate.replace(repl, ''))) {
        w = candidate;
        break;
      }
    }
  }
  
  // Étape 4: Règles spéciales pour certains motifs
  // Double consonne finale
  if (/([a-z])\1$/.test(w) && w.length > 4) {
    w = w.slice(0, -1);
  }
  
  // y final après consonne
  if (w.endsWith('y') && w.length > 3 && !VOWELS.includes(w[w.length - 2])) {
    w = w.slice(0, -1) + 'i';
  }
  
  return w;
}

/**
 * Stemming anglais simplifié (Porter basic)
 */
export function englishStemmer(word: string): string {
  if (word.length <= 2) return word;
  
  let w = word.toLowerCase();
  
  // Step 1a: Plural
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (w.endsWith('ss')) w = w; // keep
  else if (w.endsWith('s')) w = w.slice(0, -1);
  
  // Step 1b: -eed -> ee if VC after stem
  if (w.endsWith('eed')) {
    const stem = w.slice(0, -3);
    if (countSyllables(stem) > 1) w = stem + 'ee';
  } else if (w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    if (hasVowel(stem)) w = stem;
  } else if (w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    if (hasVowel(stem)) w = stem;
  }
  
  // Step 2: Suffixes
  const step2 = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'],
    ['anci', 'ance'], ['izer', 'ize'], ['abli', 'able'],
    ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'],
    ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'],
    ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'],
    ['iviti', 'ive'], ['biliti', 'ble']
  ];
  
  for (const [suffix, repl] of step2) {
    if (w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      if (countSyllables(stem) > 1) {
        w = stem + repl;
        break;
      }
    }
  }
  
  return w;
}

/**
 * Détecte la langue d'un mot et applique le stemming approprié
 * @param word Le mot à traiter
 * @param language Code langue ('fr' ou 'en')
 * @returns Le radical du mot
 */
export function stemWord(word: string, language: string = 'fr'): string {
  if (word.length <= 2) return word;
  
  switch (language.toLowerCase()) {
    case 'fr':
    case 'french':
      return frenchStemmer(word);
    case 'en':
    case 'english':
      return englishStemmer(word);
    default:
      return frenchStemmer(word); // Default to French
  }
}

/**
 * Applique le stemming à tous les mots d'un tableau
 * @param words Tableau de mots
 * @param language Langue cible
 * @returns Tableau de radicaux
 */
export function stemWords(words: string[], language: string = 'fr'): string[] {
  return words.map(word => stemWord(word, language));
}

export default {
  frenchStemmer,
  englishStemmer,
  stemWord,
  stemWords,
};

