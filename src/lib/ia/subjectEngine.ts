// Moteur IA pour la validation intelligente de sujets et la recommandation
// Mission 1 : Valider un sujet (comparaison sémantique avec la base)
// Mission 2 : Générer des sujets alternatifs quand un doublon est détecté

import { tokenize, normalizeText, segmentDocument, buildTfidfModel, vectorize, cosineSimilarity, jaccardSimilarity } from './engine';

export interface SubjectInput {
  title: string;
  description?: string;
  domain?: string;
  keywords?: string;
  objectives?: string;
  problemStatement?: string;
}

export interface SimilarSubject {
  subjectId: string;
  title: string;
  similarity: number;
  explanation: string;
  sharedKeywords: string[];
}

export interface ValidationResult {
  isOriginal: boolean;
  similarityScore: number;
  threshold: number;
  report: string;
  similarSubjects: SimilarSubject[];
  alternatives: string[];
  recommendation: string;
}

// Combiner toutes les informations d'un sujet en un texte unique
function subjectToText(subject: SubjectInput | any): string {
  const parts = [
    subject.title || '',
    subject.description || '',
    subject.domain || '',
    subject.keywords || '',
    subject.objectives || '',
    subject.problemStatement || subject.problemStatement || '',
  ];
  return parts.filter(p => p.trim()).join(' ');
}

// Extraire les mots-clés principaux d'un texte
function extractKeywords(text: string, topN: number = 10): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

// Trouver les mots-clés partagés entre deux sujets
function findSharedKeywords(textA: string, textB: string): string[] {
  const kwA = new Set(extractKeywords(textA, 15));
  const kwB = new Set(extractKeywords(textB, 15));
  const shared: string[] = [];
  for (const k of kwA) {
    if (kwB.has(k)) shared.push(k);
  }
  return shared.slice(0, 8);
}

// Générer une explication de la similarité
function explainSimilarity(
  submittedTitle: string,
  existingTitle: string,
  semanticScore: number,
  sharedKeywords: string[]
): string {
  const parts: string[] = [];
  
  if (semanticScore >= 0.5) {
    parts.push(`Le sujet proposé est très proche de "${existingTitle}" (similarité sémantique de ${(semanticScore * 100).toFixed(1)}%).`);
  } else if (semanticScore >= 0.3) {
    parts.push(`Le sujet présente une similarité modérée avec "${existingTitle}" (${(semanticScore * 100).toFixed(1)}%).`);
  } else if (semanticScore >= 0.15) {
    parts.push(`Quelques points communs détectés avec "${existingTitle}" (${(semanticScore * 100).toFixed(1)}%).`);
  }

  if (sharedKeywords.length > 0) {
    parts.push(`Mots-clés partagés : ${sharedKeywords.join(', ')}.`);
  }

  if (parts.length === 0) {
    parts.push('Similarité faible, le sujet semble différent.');
  }

  return parts.join(' ');
}

// Mission 1 : Valider un sujet
export function validateSubject(
  submitted: SubjectInput,
  existingSubjects: Array<{ id: string; title: string; description?: string; domain?: string; keywords?: string; objectives?: string; problemStatement?: string }>,
  threshold: number = 0.20
): ValidationResult {
  const submittedText = subjectToText(submitted);
  
  if (existingSubjects.length === 0) {
    return {
      isOriginal: true,
      similarityScore: 0,
      threshold,
      report: 'Aucun sujet existant dans la base de connaissances. Le sujet est automatiquement considéré comme original.',
      similarSubjects: [],
      alternatives: [],
      recommendation: '✅ Sujet original — La base de connaissances est vide, le sujet peut être validé.',
    };
  }

  // Construire le modèle TF-IDF avec tous les sujets
  const allTexts = [submittedText, ...existingSubjects.map(s => subjectToText(s))];
  const model = buildTfidfModel(allTexts);

  // Vectoriser le sujet soumis
  const submittedVec = vectorize(submittedText, model);
  const submittedTokens = new Set(tokenize(submittedText));

  // Comparer avec chaque sujet existant
  const similarSubjects: SimilarSubject[] = [];
  
  for (const existing of existingSubjects) {
    const existingText = subjectToText(existing);
    const existingVec = vectorize(existingText, model);
    
    // Similarité sémantique (cosinus)
    const semanticScore = cosineSimilarity(submittedVec, existingVec);
    
    // Similarité lexicale (Jaccard)
    const existingTokens = new Set(tokenize(existingText));
    const lexScore = jaccardSimilarity(submittedTokens, existingTokens);
    
    // Score combiné (poids sémantique + lexical)
    const combinedScore = semanticScore * 0.7 + lexScore * 0.3;
    
    if (combinedScore >= threshold) {
      const shared = findSharedKeywords(submittedText, existingText);
      const explanation = explainSimilarity(
        submitted.title,
        existing.title,
        combinedScore,
        shared
      );
      
      similarSubjects.push({
        subjectId: existing.id,
        title: existing.title,
        similarity: Math.round(combinedScore * 10000) / 10000,
        explanation,
        sharedKeywords: shared,
      });
    }
  }

  // Trier par similarité décroissante
  similarSubjects.sort((a, b) => b.similarity - a.similarity);

  // Score global = score du sujet le plus similaire
  const maxScore = similarSubjects.length > 0 ? similarSubjects[0].similarity : 0;
  const isOriginal = maxScore < threshold;

  // Générer le rapport
  let report = '';
  let recommendation = '';
  let alternatives: string[] = [];

  if (isOriginal) {
    report = `Le sujet "${submitted.title}" a été analysé et comparé avec ${existingSubjects.length} sujet(s) existant(s) dans la base de connaissances.\n\n`;
    report += `Score de similarité maximal : ${(maxScore * 100).toFixed(1)}% (seuil de rejet : ${(threshold * 100).toFixed(0)}%).\n\n`;
    report += `Le sujet est considéré comme ORIGINAL. Il peut être validé pour un TFC, TFE ou mémoire.`;
    recommendation = `✅ Sujet original (${(maxScore * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%) — Validation autorisée.`;
  } else {
    report = `Le sujet "${submitted.title}" a été analysé et comparé avec ${existingSubjects.length} sujet(s) existant(s).\n\n`;
    report += `Score de similarité maximal : ${(maxScore * 100).toFixed(1)}% (seuil de rejet : ${(threshold * 100).toFixed(0)}%).\n\n`;
    report += `Le sujet est considéré comme UN DOUBLON ou trop similaire à un travail existant.\n\n`;
    report += `Sujets similaires détectés :\n`;
    for (const s of similarSubjects.slice(0, 5)) {
      report += `  • ${s.title} (${(s.similarity * 100).toFixed(1)}%) — ${s.explanation}\n`;
    }
    report += `\nGénération de sujets alternatifs en cours...`;
    recommendation = `❌ Sujet non original (${(maxScore * 100).toFixed(1)}% ≥ ${(threshold * 100).toFixed(0)}%) — Alternatives générées ci-dessous.`;

    // Mission 2 : Générer des alternatives
    alternatives = generateAlternatives(submitted, similarSubjects);
  }

  return {
    isOriginal,
    similarityScore: Math.round(maxScore * 10000) / 10000,
    threshold,
    report,
    similarSubjects: similarSubjects.slice(0, 10),
    alternatives,
    recommendation,
  };
}

// Mission 2 : Générer des sujets alternatifs
export function generateAlternatives(
  submitted: SubjectInput,
  similarSubjects: SimilarSubject[]
): string[] {
  const alternatives: string[] = [];
  
  // Extraire les concepts clés du sujet soumis
  const submittedText = subjectToText(submitted);
  const keywords = extractKeywords(submittedText, 15);
  const domain = submitted.domain || 'informatique';
  
  // Stratégie 1 : Changer l'angle d'approche
  const angles = [
    `Conception d'un système intelligent de ${keywords.slice(0, 3).join(' ')} basé sur l'IA pour le contexte universitaire congolais`,
    `Développement d'une plateforme prédictive de ${keywords.slice(0, 3).join(' ')} utilisant le machine learning`,
    `Étude comparative des approaches traditionnelles et IA pour ${keywords.slice(0, 3).join(' ')} en milieu académique`,
    `Mise en place d'un assistant intelligent pour ${keywords.slice(0, 3).join(' ')} dans les universités congolaises`,
    `Conception d'un modèle d'IA appliqué à ${keywords.slice(0, 3).join(' ')} : approche hybride et évaluation`,
  ];

  // Stratégie 2 : Combiner avec des domaines connexes
  const domainShifts = [
    `Plateforme intelligente de recommandation de ${keywords.slice(0, 2).join(' ')} universitaires basée sur l'IA`,
    `Système prédictif de gestion des ${keywords.slice(0, 2).join(' ')} universitaires par apprentissage automatique`,
    `Application de classification automatique des ${keywords.slice(0, 2).join(' ')} académiques par IA`,
    `Système d'assistance à la ${keywords.slice(0, 2).join(' ')} utilisant l'intelligence artificielle`,
    `Plateforme d'analyse intelligente des ${keywords.slice(0, 2).join(' ')} pour établissements d'enseignement supérieur`,
  ];

  // Stratégie 3 : Focus sur un aspect spécifique
  if (submitted.problemStatement) {
    const probKeywords = extractKeywords(submitted.problemStatement, 5);
    if (probKeywords.length > 0) {
      alternatives.push(
        `Approche par IA pour résoudre le problème de ${probKeywords.join(' ')} : application au contexte universitaire congolais`
      );
    }
  }

  // Stratégie 4 : Inverser la perspective
  if (submitted.objectives) {
    const objKeywords = extractKeywords(submitted.objectives, 5);
    if (objKeywords.length > 0) {
      alternatives.push(
        `Évaluation de l'efficacité de l'IA dans ${objKeywords.join(' ')} : étude de cas en RDC`
      );
    }
  }

  // Combiner et dédoublonner
  const allAlternatives = [...angles, ...domainShifts];
  
  // Filtrer les alternatives trop similaires entre elles
  const unique: string[] = [];
  for (const alt of allAlternatives) {
    const altTokens = new Set(tokenize(alt));
    let isDup = false;
    for (const existing of unique) {
      const existingTokens = new Set(tokenize(existing));
      if (jaccardSimilarity(altTokens, existingTokens) > 0.5) {
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      unique.push(alt);
    }
  }

  return unique.slice(0, 6); // Top 6 alternatives
}

// Statistiques pour le tableau de bord admin
export function computeSubjectStats(
  subjects: any[],
  validations: any[]
): {
  totalSubjects: number;
  totalValidations: number;
  originalCount: number;
  duplicateCount: number;
  avgSimilarity: number;
  topDomains: Array<{ domain: string; count: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
} {
  const totalSubjects = subjects.length;
  const totalValidations = validations.length;
  const originalCount = validations.filter(v => v.isOriginal).length;
  const duplicateCount = totalValidations - originalCount;
  
  const validatedWithScore = validations.filter(v => v.similarityScore !== undefined);
  const avgSimilarity = validatedWithScore.length > 0
    ? validatedWithScore.reduce((s, v) => s + (v.similarityScore || 0), 0) / validatedWithScore.length
    : 0;

  // Top domaines
  const domainCount = new Map<string, number>();
  for (const s of subjects) {
    const d = s.domain || 'Non spécifié';
    domainCount.set(d, (domainCount.get(d) || 0) + 1);
  }
  const topDomains = Array.from(domainCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  // Top mots-clés
  const keywordCount = new Map<string, number>();
  for (const s of subjects) {
    const text = subjectToText(s);
    const kws = extractKeywords(text, 10);
    for (const k of kws) {
      keywordCount.set(k, (keywordCount.get(k) || 0) + 1);
    }
  }
  const topKeywords = Array.from(keywordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([keyword, count]) => ({ keyword, count }));

  return {
    totalSubjects,
    totalValidations,
    originalCount,
    duplicateCount,
    avgSimilarity,
    topDomains,
    topKeywords,
  };
}
