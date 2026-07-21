// Générateur de rapports consolidés pour les analyses batch
// Agrège les résultats, calcule statistiques, identifie documents problématiques
// PlagiatIA - Mode Batch v0.3

import { 
  BatchResult, 
  BatchJobStats, 
  BatchSummary, 
  BatchConfig,
  BatchJobStatus 
} from './types';

// ============================================================
// STATISTIQUES GLOBALES
// ============================================================

export function calculateBatchStats(results: BatchResult[], startTime?: Date): BatchJobStats {
  const totalDocs = results.length;
  const completedResults = results.filter(r => r.status === 'completed');
  const failedResults = results.filter(r => r.status === 'failed');
  const pendingResults = results.filter(r => r.status !== 'completed' && r.status !== 'failed');

  const completedDocs = completedResults.length;
  const failedDocs = failedResults.length;
  const pendingDocs = pendingResults.length;

  // Scores des analyses complétées
  const scores = completedResults
    .map(r => r.globalScore)
    .filter((s): s is number => s !== undefined && s !== null);

  // Calculs statistiques
  const avgScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
    : undefined;

  const sortedScores = [...scores].sort((a, b) => a - b);
  const minScore = scores.length > 0 ? sortedScores[0] : undefined;
  const maxScore = scores.length > 0 ? sortedScores[scores.length - 1] : undefined;
  
  const medianScore = calculateMedian(sortedScores);
  const stdDev = calculateStdDev(scores, avgScore);

  // Top plagiaires (documents avec score le plus élevé)
  const topPlagiarists = completedResults
    .filter(r => r.globalScore !== undefined && r.globalScore > 0.3)
    .sort((a, b) => (b.globalScore || 0) - (a.globalScore || 0))
    .slice(0, 10);

  // Temps de traitement total
  let processingTimeMs = 0;
  if (startTime) {
    processingTimeMs = Date.now() - startTime.getTime();
  } else {
    processingTimeMs = completedResults.reduce(
      (sum, r) => sum + (r.processingTimeMs || 0), 
      0
    );
  }

  return {
    totalDocs,
    processedDocs: completedDocs + failedDocs,
    completedDocs,
    failedDocs,
    pendingDocs,
    avgScore: avgScore !== undefined ? Math.round(avgScore * 10000) / 10000 : undefined,
    medianScore: medianScore !== undefined ? Math.round(medianScore * 10000) / 10000 : undefined,
    minScore: minScore !== undefined ? Math.round(minScore * 10000) / 10000 : undefined,
    maxScore: maxScore !== undefined ? Math.round(maxScore * 10000) / 10000 : undefined,
    stdDev: stdDev !== undefined ? Math.round(stdDev * 10000) / 10000 : undefined,
    topPlagiarists,
    processingTimeMs,
  };
}

function calculateMedian(sortedScores: number[]): number | undefined {
  if (sortedScores.length === 0) return undefined;
  
  const mid = Math.floor(sortedScores.length / 2);
  if (sortedScores.length % 2 === 0) {
    return (sortedScores[mid - 1] + sortedScores[mid]) / 2;
  }
  return sortedScores[mid];
}

function calculateStdDev(scores: number[], mean?: number): number | undefined {
  if (scores.length < 2) return undefined;
  
  const avg = mean ?? (scores.reduce((s, v) => s + v, 0) / scores.length);
  const squareDiffs = scores.map(s => Math.pow(s - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((s, v) => s + v, 0) / scores.length;
  return Math.sqrt(avgSquareDiff);
}

// ============================================================
// RÉSUMÉ EXÉCUTIF BATCH
// ============================================================

export interface ExecutiveSummary {
  title: string;
  overallVerdict: 'clean' | 'moderate' | 'critical';
  keyFindings: string[];
  recommendations: string[];
  statsSummary: {
    analyzedDocuments: number;
    suspiciousDocuments: number;
    criticalDocuments: number;
    averageSimilarity: string;
    completionRate: string;
  };
}

export function generateExecutiveSummary(
  jobName: string,
  config: BatchConfig,
  stats: BatchJobStats
): ExecutiveSummary {
  const suspiciousThreshold = config.threshold;
  const criticalThreshold = config.threshold + 0.2;
  
  const suspiciousCount = stats.topPlagiarists.filter(
    r => r.globalScore !== undefined && r.globalScore >= suspiciousThreshold
  ).length;
  
  const criticalCount = stats.topPlagiarists.filter(
    r => r.globalScore !== undefined && r.globalScore >= criticalThreshold
  ).length;

  // Déterminer le verdict global
  let overallVerdict: 'clean' | 'moderate' | 'critical' = 'clean';
  if (criticalCount > 0) overallVerdict = 'critical';
  else if (suspiciousCount > stats.totalDocs * 0.2) overallVerdict = 'moderate';

  // Calculer le taux de complétion
  const completionRate = stats.totalDocs > 0 
    ? ((stats.completedDocs / stats.totalDocs) * 100).toFixed(1)
    : '0';

  // Générer les conclusions clés
  const keyFindings: string[] = [];
  
  if (stats.avgScore !== undefined) {
    keyFindings.push(`Taux de similarité moyen : ${(stats.avgScore * 100).toFixed(1)}%`);
  }
  
  if (suspiciousCount > 0) {
    keyFindings.push(`${suspiciousCount} document(s) dépassent le seuil de ${Math.round(suspiciousThreshold * 100)}%`);
  }
  
  if (criticalCount > 0) {
    keyFindings.push(`${criticalCount} document(s) nécessitent une attention urgente`);
  }
  
  if (stats.failedDocs > 0) {
    keyFindings.push(`${stats.failedDocs} analyse(s) ont échoué et doivent être relancées`);
  }

  // Recommandations
  const recommendations: string[] = [];
  
  if (overallVerdict === 'critical') {
    recommendations.push('Examen manuel urgent des documents critiques recommandé');
    recommendations.push('Considérer un entretien avec les auteurs concernés');
  }
  
  if (overallVerdict === 'moderate') {
    recommendations.push('Vérification approfondie des documents suspects');
    recommendations.push('Comparaison croisée avec d\'autres sources possible');
  }
  
  if (suspiciousCount > stats.totalDocs * 0.3) {
    recommendations.push('Potentielle problématique systémique à investiguer');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Aucune action particulière requise');
  }

  return {
    title: `Rapport Batch : ${jobName}`,
    overallVerdict,
    keyFindings,
    recommendations,
    statsSummary: {
      analyzedDocuments: stats.completedDocs,
      suspiciousDocuments: suspiciousCount,
      criticalDocuments: criticalCount,
      averageSimilarity: stats.avgScore !== undefined 
        ? `${(stats.avgScore * 100).toFixed(1)}%` 
        : 'N/A',
      completionRate: `${completionRate}%`,
    },
  };
}

// ============================================================
// GÉNÉRATION DU RAPPORT COMPLET
// ============================================================

export function generateFullReport(summary: BatchSummary): object {
  const executiveSummary = generateExecutiveSummary(
    summary.jobName,
    summary.config,
    summary.stats
  );

  return {
    meta: {
      jobId: summary.jobId,
      jobName: summary.jobName,
      status: summary.status,
      generatedAt: new Date().toISOString(),
      engine: summary.config.engine,
      scope: summary.config.scope,
      threshold: summary.config.threshold,
    },
    executiveSummary,
    statistics: {
      ...summary.stats,
      averageSimilarityPercent: summary.stats.avgScore 
        ? `${(summary.stats.avgScore * 100).toFixed(1)}%` 
        : null,
      medianSimilarityPercent: summary.stats.medianScore 
        ? `${(summary.stats.medianScore * 100).toFixed(1)}%` 
        : null,
    },
    topPlagiarists: summary.stats.topPlagiarists.map(r => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      similarityScore: r.globalScore ? `${(r.globalScore * 100).toFixed(1)}%` : 'N/A',
      matchedSegments: r.matchedSegments,
      totalSegments: r.totalSegments,
      matchTypes: r.matchTypes,
    })),
    detailedResults: summary.results.map(r => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      status: r.status,
      score: r.globalScore ? `${(r.globalScore * 100).toFixed(1)}%` : null,
      segmentsAnalyzed: r.totalSegments,
      matchesFound: r.matchesCount,
      processingTime: r.processingTimeMs ? `${(r.processingTimeMs / 1000).toFixed(1)}s` : null,
      error: r.error,
      analyzedAt: r.analyzedAt,
    })),
  };
}

// ============================================================
// EXPORT CSV
// ============================================================

export function exportToCSV(results: BatchResult[], includeHeaders: boolean = true): string {
  const headers = [
    'Document ID',
    'Titre du Document',
    'Statut',
    'Score Global (%)',
    'Segments Analysés',
    'Correspondances Trouvées',
    'Temps de Traitement (s)',
    'Erreur',
    'Date Analyse',
  ];

  const rows = results.map(r => [
    r.documentId,
    escapeCSVField(r.documentTitle),
    r.status,
    r.globalScore !== undefined ? (r.globalScore * 100).toFixed(2) : '',
    r.totalSegments?.toString() ?? '',
    r.matchesCount?.toString() ?? '',
    r.processingTimeMs ? (r.processingTimeMs / 1000).toFixed(2) : '',
    escapeCSVField(r.error || ''),
    r.analyzedAt || '',
  ]);

  const csvContent = [
    ...(includeHeaders ? [headers.join(',')] : []),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csvContent;
}

export function exportStatsToCSV(stats: BatchJobStats, jobName: string): string {
  const headers = ['Métrique', 'Valeur'];
  const rows = [
    ['Nom du Job', escapeCSVField(jobName)],
    ['Total Documents', stats.totalDocs.toString()],
    ['Documents Complétés', stats.completedDocs.toString()],
    ['Documents Échoués', stats.failedDocs.toString()],
    ['Documents en Attente', stats.pendingDocs.toString()],
    ['Score Moyen (%)', stats.avgScore ? (stats.scoreAvg = (stats.avgScore * 100).toFixed(2)) : 'N/A'],
    ['Score Médian (%)', stats.medianScore ? (stats.medianScore * 100).toFixed(2) : 'N/A'],
    ['Score Minimum (%)', stats.minScore ? (stats.minScore * 100).toFixed(2) : 'N/A'],
    ['Score Maximum (%)', stats.maxScore ? (stats.maxScore * 100).toFixed(2) : 'N/A'],
    ['Écart-Type (%)', stats.stdDev ? (stats.stdDev * 100).toFixed(2) : 'N/A'],
    ['Temps Total (ms)', stats.processingTimeMs.toString()],
  ];

  delete (stats as any).scoreAvg; // Clean up temp property
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// ============================================================
// EXPORT JSON
// ============================================================

export function exportToJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ============================================================
// UTILITAIRES
// ============================================================

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// ============================================================
// CLASSIFICATION DES DOCUMENTS PAR NIVEAU DE RISQUE
// ============================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function classifyRisk(score: number | undefined, threshold: number): RiskLevel {
  if (score === undefined || score === null) return 'low';
  if (score >= threshold + 0.3) return 'critical';
  if (score >= threshold + 0.15) return 'high';
  if (score >= threshold) return 'medium';
  return 'low';
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return '#22c55e';      // green
    case 'medium': return '#f59e0b';   // amber
    case 'high': return '#ef4444';     // red
    case 'critical': return '#991b1b'; // dark red
    default: return '#6b7280';         // gray
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'Faible risque';
    case 'medium': return 'Risque modéré';
    case 'high': return 'Risque élevé';
    case 'critical': return 'Critique';
    default: return 'Inconnu';
  }
}
