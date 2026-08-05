// Analysis Enricher — Generates comprehensive pedagogical analysis for validated subjects
// Uses ZAI LLM (glm-4.5-flash) to produce rich, structured academic guidance
// v1.0 — Task 7: Enriched subject validation analysis

import { chatCompletion, extractJSONFromRaw } from '@/lib/ia/zai-client';

// ============================================================
// TYPES
// ============================================================

export interface EnrichedSimilarSubject {
  title: string;
  similarity: number;
  explanation: string;
}

export interface EnrichedSimilarityAnalysis {
  score: number;
  classification: 'ORIGINAL' | 'PROCHE' | 'FORTEMENT_SIMILAIRE' | 'EXISTANT';
  sujetsSimilaires: EnrichedSimilarSubject[];
  pointsDeVigilance: string[];
}

export interface MethodologyStep {
  titre: string;
  description: string;
}

export interface MethodologieProposee {
  etape1: MethodologyStep;
  etape2: MethodologyStep;
  etape3: MethodologyStep;
  etape4: MethodologyStep;
  etape5: MethodologyStep;
}

export interface Chapitre {
  titre: string;
  description: string;
  sousParties: string[];
}

export interface PlanResolution {
  chapitres: Chapitre[];
}

export interface EnrichedAnalysis {
  resume: string;
  contexteGeneral: string;
  conceptsCles: string[];
  objectifsTravail: string[];
  niveauDifficulte: 'FACILE' | 'MOYEN' | 'DIFFICILE' | 'AVANCE';
  analyseSimilarite: EnrichedSimilarityAnalysis;
  pistesAmelioration: string[];
  methodologieProposee: MethodologieProposee;
  planResolution: PlanResolution;
  recommandationsBibliographiques: string[];
  competencesRequises: string[];
  dureeEstimee: string;
  generatedAt: string;
  modelUsed: string;
  generationTimeMs: number;
}

// ============================================================
// INPUT TYPE
// ============================================================

export interface EnricherInput {
  title: string;
  description?: string;
  domain?: string;
  keywords?: string;
  objectives?: string;
  problemStatement?: string;
  similarityScore: number;
  isOriginal: boolean;
  similarSubjects: Array<{ id?: string; title: string; similarity: number; explanation?: string }>;
  classificationLevel: string;  // EXISTING | STRONGLY_SIMILAR | CLOSE | ORIGINAL
}

// ============================================================
// CLASSIFICATION MAPPING
// ============================================================

function mapClassification(level: string): 'ORIGINAL' | 'PROCHE' | 'FORTEMENT_SIMILAIRE' | 'EXISTANT' {
  switch (level) {
    case 'EXISTING': return 'EXISTANT';
    case 'STRONGLY_SIMILAR': return 'FORTEMENT_SIMILAIRE';
    case 'CLOSE': return 'PROCHE';
    default: return 'ORIGINAL';
  }
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildEnrichmentPrompt(input: EnricherInput): string {
  const similarList = input.similarSubjects
    .slice(0, 5)
    .map(s => `- "${s.title}" (similarite: ${(s.similarity * 100).toFixed(1)}%)${s.explanation ? ' — ' + s.explanation : ''}`)
    .join('\n');

  const subjectDetails = [
    `Titre: ${input.title}`,
    input.description ? `Description: ${input.description.slice(0, 1500)}` : '',
    input.domain ? `Domaine: ${input.domain}` : '',
    input.keywords ? `Mots-cles: ${input.keywords}` : '',
    input.objectives ? `Objectifs: ${input.objectives.slice(0, 800)}` : '',
    input.problemStatement ? `Problematique: ${input.problemStatement.slice(0, 800)}` : '',
  ].filter(Boolean).join('\n');

  return `Analyse en profondeur le sujet academique suivant et genere une analyse pedagogique complete.

=== SUJET SOUMIS ===
${subjectDetails}

=== RESULTATS DE VALIDATION ===
- Score de similarite: ${(input.similarityScore * 100).toFixed(1)}%
- Statut: ${input.isOriginal ? 'Original' : 'Similaire'}
- Classification: ${input.classificationLevel}

=== SUJETS SIMILAIRES DETECTES ===
${similarList || 'Aucun sujet similaire.'}

Genere une analyse pedagogique COMPLETE en JSON valide avec EXACTEMENT cette structure:
{
  "resume": "<resume synthetique du sujet en 3-5 phrases>",
  "contexteGeneral": "<contexte academique general du domaine, en 4-6 phrases>",
  "conceptsCles": ["<concept1>", "<concept2>", "<concept3>", "<concept4>", "<concept5>", "<concept6>", "<concept7>"],
  "objectifsTravail": ["<objectif1>", "<objectif2>", "<objectif3>", "<objectif4>"],
  "niveauDifficulte": "<FACILE|MOYEN|DIFFICILE|AVANCE>",
  "analyseSimilarite": {
    "score": <0-1>,
    "classification": "<ORIGINAL|PROCHE|FORTEMENT_SIMILAIRE|EXISTANT>",
    "sujetsSimilaires": [
      {"title": "<titre>", "similarity": <0-1>, "explanation": "<explication>"},
      {"title": "<titre>", "similarity": <0-1>, "explanation": "<explication>"}
    ],
    "pointsDeVigilance": ["<point1>", "<point2>", "<point3>"]
  },
  "pistesAmelioration": ["<piste1>", "<piste2>", "<piste3>", "<piste4>"],
  "methodologieProposee": {
    "etape1": {"titre": "<titre court>", "description": "<description de 2-3 phrases>"},
    "etape2": {"titre": "<titre court>", "description": "<description de 2-3 phrases>"},
    "etape3": {"titre": "<titre court>", "description": "<description de 2-3 phrases>"},
    "etape4": {"titre": "<titre court>", "description": "<description de 2-3 phrases>"},
    "etape5": {"titre": "<titre court>", "description": "<description de 2-3 phrases>"}
  },
  "planResolution": {
    "chapitres": [
      {"titre": "<Chapitre 1: ...>", "description": "<description>", "sousParties": ["<1.1>", "<1.2>", "<1.3>"]},
      {"titre": "<Chapitre 2: ...>", "description": "<description>", "sousParties": ["<2.1>", "<2.2>"]},
      {"titre": "<Chapitre 3: ...>", "description": "<description>", "sousParties": ["<3.1>", "<3.2>", "<3.3>"]}
    ]
  },
  "recommandationsBibliographiques": ["<ref1>", "<ref2>", "<ref3>", "<ref4>", "<ref5>", "<ref6>", "<ref7>"],
  "competencesRequises": ["<competence1>", "<competence2>", "<competence3>", "<competence4>", "<competence5>"],
  "dureeEstimee": "<estimation par exemple: 3-4 mois, 6-8 semaines>"
}

IMPORTANT:
- TOUT le contenu doit etre en FRANCAIS
- Les references bibliographiques doivent etre REALISTES et PERTINENTES (auteurs, annees, titres vraisemblables)
- Le planResolution doit avoir entre 3 et 5 chapitres avec des sous-parties concretes
- Les pistesAmelioration doivent etre ACTIONNABLES et specifiques
- Si le sujet est original, pointsDeVigilance doit etre vide et pistesAmelioration doit suggerer des angles d'approfondissement
- Si similaire, les pistes doivent expliquer COMMENT se differencier des sujets existants
- Le niveauDifficulte doit refleter la complexite reelle du sujet
- Adapte le contenu au contexte academique africain (UNIKIN, RD Congo) quand c'est pertinent`;
}

// ============================================================
// ENRICHMENT FUNCTION
// ============================================================

const ENRICHER_TIMEOUT_MS = 28000; // 28s — slightly under 30s to allow cleanup

export async function enrichSubjectValidation(
  input: EnricherInput,
  timeoutMs: number = ENRICHER_TIMEOUT_MS
): Promise<EnrichedAnalysis | null> {
  const startTime = Date.now();
  const model = 'glm-4.5-flash';

  try {
    // Check API key availability
    if (!process.env.ZAI_API_KEY) {
      console.warn('[AnalysisEnricher] ZAI_API_KEY not configured, skipping enrichment');
      return null;
    }

    const prompt = buildEnrichmentPrompt(input);

    // Race the LLM call against the timeout
    const result = await Promise.race([
      chatCompletion(
        [
          {
            role: 'system',
            content: `Tu es un expert pedagogique et academique specialise dans l'accompagnement de travaux de recherche (memoires, TFC, TFE).
Tu generes des analyses detaillees, structurees et actionnables pour aider les etudiants a mieux comprendre et aborder leur sujet.
Tu es rigoureux, precis, et tes recommandations bibliographiques sont realistes et pertinentes.
Reponds UNIQUEMENT en JSON valide (pas de markdown, pas de commentaires hors JSON). Reponds en FRANCAIS.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.35,
          maxTokens: 4096,
          model,
          function: 'subject_enrichment_analysis',
          enableFallback: true,
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Enrichment timeout')), timeoutMs)
      ),
    ]);

    const generationTimeMs = Date.now() - startTime;

    // Parse the JSON response
    const data = extractJSONFromRaw(result);

    // Build and validate the enriched analysis
    const analysis: EnrichedAnalysis = {
      resume: typeof data.resume === 'string' ? data.resume : '',
      contexteGeneral: typeof data.contexteGeneral === 'string' ? data.contexteGeneral : '',
      conceptsCles: Array.isArray(data.conceptsCles)
        ? data.conceptsCles.filter((c: any) => typeof c === 'string').slice(0, 8)
        : [],
      objectifsTravail: Array.isArray(data.objectifsTravail)
        ? data.objectifsTravail.filter((o: any) => typeof o === 'string').slice(0, 5)
        : [],
      niveauDifficulte: ['FACILE', 'MOYEN', 'DIFFICILE', 'AVANCE'].includes(data.niveauDifficulte)
        ? data.niveauDifficulte
        : 'MOYEN',
      analyseSimilarite: {
        score: typeof data.analyseSimilarite?.score === 'number'
          ? Math.min(Math.max(data.analyseSimilarite.score, 0), 1)
          : input.similarityScore,
        classification: ['ORIGINAL', 'PROCHE', 'FORTEMENT_SIMILAIRE', 'EXISTANT'].includes(data.analyseSimilarite?.classification)
          ? data.analyseSimilarite.classification
          : mapClassification(input.classificationLevel),
        sujetsSimilaires: Array.isArray(data.analyseSimilarite?.sujetsSimilaires)
          ? data.analyseSimilarite.sujetsSimilaires
              .filter((s: any) => typeof s?.title === 'string')
              .slice(0, 5)
              .map((s: any) => ({
                title: s.title,
                similarity: typeof s.similarity === 'number' ? Math.min(Math.max(s.similarity, 0), 1) : 0,
                explanation: typeof s.explanation === 'string' ? s.explanation : '',
              }))
          : input.similarSubjects.slice(0, 5).map(s => ({
              title: s.title,
              similarity: s.similarity,
              explanation: s.explanation || '',
            })),
        pointsDeVigilance: Array.isArray(data.analyseSimilarite?.pointsDeVigilance)
          ? data.analyseSimilarite.pointsDeVigilance.filter((p: any) => typeof p === 'string')
          : [],
      },
      pistesAmelioration: Array.isArray(data.pistesAmelioration)
        ? data.pistesAmelioration.filter((p: any) => typeof p === 'string').slice(0, 6)
        : [],
      methodologieProposee: {
        etape1: formatMethodologyStep(data.methodologieProposee?.etape1, 1),
        etape2: formatMethodologyStep(data.methodologieProposee?.etape2, 2),
        etape3: formatMethodologyStep(data.methodologieProposee?.etape3, 3),
        etape4: formatMethodologyStep(data.methodologieProposee?.etape4, 4),
        etape5: formatMethodologyStep(data.methodologieProposee?.etape5, 5),
      },
      planResolution: {
        chapitres: Array.isArray(data.planResolution?.chapitres)
          ? data.planResolution.chapitres
              .filter((c: any) => typeof c?.titre === 'string')
              .slice(0, 6)
              .map((c: any) => ({
                titre: c.titre,
                description: typeof c.description === 'string' ? c.description : '',
                sousParties: Array.isArray(c.sousParties)
                  ? c.sousParties.filter((sp: any) => typeof sp === 'string').slice(0, 8)
                  : [],
              }))
          : [],
      },
      recommandationsBibliographiques: Array.isArray(data.recommandationsBibliographiques)
        ? data.recommandationsBibliographiques.filter((r: any) => typeof r === 'string').slice(0, 8)
        : [],
      competencesRequises: Array.isArray(data.competencesRequises)
        ? data.competencesRequises.filter((c: any) => typeof c === 'string').slice(0, 8)
        : [],
      dureeEstimee: typeof data.dureeEstimee === 'string' ? data.dureeEstimee : 'Non estimee',
      generatedAt: new Date().toISOString(),
      modelUsed: model,
      generationTimeMs,
    };

    console.log(`[AnalysisEnricher] Generated enriched analysis in ${generationTimeMs}ms`);
    return analysis;

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    if (error.message?.includes('timeout')) {
      console.warn(`[AnalysisEnricher] Timeout after ${elapsed}ms`);
    } else {
      console.error(`[AnalysisEnricher] Error: ${error.message}`);
    }
    return null;
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatMethodologyStep(step: any, num: number): MethodologyStep {
  if (step && typeof step.titre === 'string' && typeof step.description === 'string') {
    return { titre: step.titre, description: step.description };
  }
  // Fallback defaults
  const defaults: Record<number, MethodologyStep> = {
    1: { titre: 'Revue de litterature', description: 'Analyser les travaux existants sur le sujet et identifier les lacunes.' },
    2: { titre: 'Cadre theorique', description: 'Definir le cadre conceptuel et les hypotheses de recherche.' },
    3: { titre: 'Methodologie', description: 'Choisir et justifier les methodes de collecte et analyse des donnees.' },
    4: { titre: 'Collecte et analyse', description: 'Executer la collecte de donnees et proceder aux analyses.' },
    5: { titre: 'Redaction et soutenance', description: 'Rediger le memoire et preparer la soutenance.' },
  };
  return defaults[num] || { titre: `Etape ${num}`, description: `Description de l'etape ${num}.` };
}
