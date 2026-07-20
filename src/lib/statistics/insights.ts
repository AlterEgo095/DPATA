/**
 * Générateur d'Insights Automatisés
 * PlagiatIA - Module Statistiques Premium
 * 
 * Détecte automatiquement les anomalies, tendances et opportunités
 * dans les données de plagiat pour générer des recommandations actionnables.
 */

import { StatisticsCalculator, type TimeSeriesPoint, type OutlierResult } from './calculator';
import type { DashboardStats, GroupAggregation } from './aggregator';

// ============================================================
// Types et Interfaces
// ============================================================

export interface Insight {
  id: string;
  type: 'anomaly' | 'trend' | 'milestone' | 'warning' | 'opportunity';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  recommendation?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface InsightConfig {
  // Seuils de détection d'anomalies
  anomalyThreshold: number;        // Écart-type pour outlier (défaut: 2)
  trendSensitivity: number;        // Sensibilité détection tendance (0-1, défaut: 0.3)
  
  // Seuils de taux de plagiat
  highPlagiarismThreshold: number; // % au-delà duquel c'est critique (défaut: 30%)
  warningPlagiarismThreshold: number; // % pour avertissement (défaut: 20%)
  
  // Changement significatif (%)
  significantChangePercent: number; // % de changement significatif (défaut: 20%)
  
  // Limites
  maxInsights: number;              // Nombre max d'insights générés (défaut: 10)
}

export interface MetricData {
  name: string;
  current: number;
  previous: number;
  history: TimeSeriesPoint[];
  unit?: string;
}

export interface AggregatedData extends DashboardStats {
  periodComparison?: {
    currentPeriod: { avgScore: number; totalAnalyses: number };
    previousPeriod: { avgScore: number; totalAnalyses: number };
  };
}

// ============================================================
// Configuration par Défaut
// ============================================================

const DEFAULT_CONFIG: InsightConfig = {
  anomalyThreshold: 2,
  trendSensitivity: 0.3,
  highPlagiarismThreshold: 30,
  warningPlagiarismThreshold: 20,
  significantChangePercent: 20,
  maxInsights: 10,
};

// ============================================================
// Classe Principale InsightGenerator
// ============================================================

export class InsightGenerator {
  private config: InsightConfig;
  
  constructor(config?: Partial<InsightConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Génère tous les insights à partir des données agrégées
   */
  generateInsights(data: AggregatedData): Insight[] {
    const insights: Insight[] = [];
    
    // 1. Détecter les anomalies dans le temps
    const anomalyInsights = this.detectAnomalies(data.plagiarismTrend);
    insights.push(...anomalyInsights);
    
    // 2. Identifier les tendances
    const trendInsights = this.identifyTrends([
      { name: 'Taux de plagiat', current: data.avgPlagiarismRate, previous: 0, history: data.plagiarismTrend, unit: '%' },
      { name: 'Documents analysés', current: data.completedAnalyses, previous: 0, history: data.analysisTrend, unit: '' },
      { name: 'Nouveaux documents', current: data.totalDocuments, previous: 0, history: data.documentTrend, unit: '' },
    ]);
    insights.push(...trendInsights);
    
    // 3. Analyser par faculté
    const facultyInsights = this.analyzeFacultyData(data.byFaculty);
    insights.push(...facultyInsights);
    
    // 4. Vérifier les seuils critiques
    const thresholdInsights = this.checkThresholds(data);
    insights.push(...thresholdInsights);
    
    // 5. Identifier les jalons
    const milestoneInsights = this.identifyMilestones(data);
    insights.push(...milestoneInsights);
    
    // 6. Trier par sévérité et limiter
    return this.prioritizeAndLimit(insights);
  }
  
  /**
   * Détecte les anomalies dans une série temporelle
   */
  detectAnomalies(timeSeries: TimeSeriesPoint[]): Insight[] {
    const insights: Insight[] = [];
    
    if (!timeSeries || timeSeries.length < 5) return insights;
    
    const values = timeSeries.map(p => p.value);
    const outliers = StatisticsCalculator.detectOutliers(values, 'zscore', {
      zScoreThreshold: this.config.anomalyThreshold,
    });
    
    for (const outlier of outliers) {
      const point = timeSeries[outlier.index];
      const isHighOutlier = outlier.value > 
        values.reduce((a, b) => a + b, 0) / values.length;
      
      insights.push({
        id: `anomaly-${outlier.index}-${Date.now()}`,
        type: 'anomaly',
        severity: outlier.type === 'extreme' ? 'critical' : 'warning',
        title: isHighOutlier ? 'Pic de plagiat détecté' : 'Chute anormale du taux de plagiat',
        description: `Le ${new Date(point.date).toLocaleDateString('fr-FR')}, le taux de plagiat a atteint ${(outlier.value * 100).toFixed(1)}%, ce qui représente une ${outlier.type === 'extreme' ? 'anomalie extrême' : 'anomalie modérée'} par rapport à la tendance normale.`,
        metric: 'plagiarism_rate',
        value: outlier.value * 100,
        recommendation: isHighOutlier 
          ? 'Investiguer les documents soumis pendant cette période et vérifier s\'il y a une cause systémique.'
          : 'Vérifier si cette baisse est due à une amélioration réelle ou à un manque de données.',
        createdAt: new Date(),
        metadata: {
          date: point.date,
          zScore: outlier.zScore,
          outlierType: outlier.type,
        },
      });
    }
    
    return insights;
  }
  
  /**
   * Identifie les tendances dans les métriques
   */
  identifyTrends(metrics: MetricData[]): Insight[] {
    const insights: Insight[] = [];
    
    for (const metric of metrics) {
      if (metric.history.length < 5) continue;
      
      const stats = StatisticsCalculator.fromArray(metric.history.map(h => h.value));
      
      if (stats.trend !== 'stable' && stats.trendStrength > this.config.trendSensitivity) {
        const changePercent = Math.abs(stats.growthRate);
        
        if (changePercent > this.config.significantChangePercent) {
          const isIncreasing = stats.trend === 'increasing';
          const isConcerningMetric = metric.name.toLowerCase().includes('plagiat');
          
          insights.push({
            id: `trend-${metric.name}-${Date.now()}`,
            type: 'trend',
            severity: isConcerningMetric && isIncreasing 
              ? (changePercent > 50 ? 'critical' : 'warning')
              : 'info',
            title: `${isIncreasing ? 'Hausse' : 'Baisse'} ${isIncreasing ? 'significative' : 'notable'} de ${metric.name.toLowerCase()}`,
            description: `${metric.name} montre une tendance ${isIncreasing ? 'haussière' : 'baissière'} avec une évolution de ${stats.growthRate.toFixed(1)}% sur la période analysée. La force de cette tendance est estimée à ${(stats.trendStrength * 100).toFixed(0)}%.`,
            metric: metric.name.toLowerCase().replace(/\s+/g, '_'),
            value: metric.current,
            previousValue: metric.history[0]?.value,
            changePercent: stats.growthRate,
            recommendation: this.getTrendRecommendation(metric.name, isIncreasing, changePercent),
            createdAt: new Date(),
            metadata: {
              trendDirection: stats.trend,
              trendStrength: stats.trendStrength,
              growthRate: stats.growthRate,
            },
          });
        }
      }
    }
    
    return insights;
  }
  
  /**
   * Analyse les données par faculté pour identifier les problèmes/opportunités
   */
  analyzeFacultyData(faculties: GroupAggregation[]): Insight[] {
    const insights: Insight[] = [];
    
    if (!faculties || faculties.length === 0) return insights;
    
    // Calculer la moyenne globale
    const avgScores = faculties.map(f => f.metrics.avgScore).filter(s => s > 0);
    const globalAvg = avgScores.length > 0 
      ? avgScores.reduce((a, b) => a + b, 0) / avgScores.length 
      : 0;
    
    for (const faculty of faculties) {
      const score = faculty.metrics.avgScore;
      const diffFromGlobal = score - globalAvg;
      const diffPercent = globalAvg !== 0 ? (diffFromGlobal / globalAvg) * 100 : 0;
      
      // Faculté avec un taux de plagiat élevé
      if (score > this.config.highPlagiarismThreshold) {
        insights.push({
          id: `faculty-high-${faculty.groupId}-${Date.now()}`,
          type: 'warning',
          severity: score > this.config.highPlagiarismThreshold * 1.5 ? 'critical' : 'warning',
          title: `Taux de plagiat élevé en ${faculty.group}`,
          description: `La faculté ${faculty.group} affiche un taux moyen de plagiat de ${score.toFixed(1)}%, supérieur au seuil critique de ${this.config.highPlagiarismThreshold}%. C'est ${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(1)}% par rapport à la moyenne globale (${globalAvg.toFixed(1)}%).`,
          metric: 'faculty_plagiarism_rate',
          value: score,
          previousValue: globalAvg,
          changePercent: diffPercent,
          recommendation: `Organiser une session de sensibilisation au plagiat pour les étudiants de ${faculty.group}. Renforcer les contrôles avant soumission des travaux.`,
          createdAt: new Date(),
          metadata: {
            facultyId: faculty.groupId,
            facultyName: faculty.group,
            documentCount: faculty.metrics.totalDocuments,
            analysisCount: faculty.metrics.totalAnalyses,
          },
        });
      }
      
      // Faculté avec une amélioration notable (si on avait des données historiques)
      else if (score < this.config.warningPlagiarismThreshold && score > 0) {
        insights.push({
          id: `faculty-good-${faculty.groupId}-${Date.now()}`,
          type: 'opportunity',
          severity: 'info',
          title: `Bonne performance en ${faculty.group}`,
          description: `La faculté ${faculty.group} maintient un taux de plagiat bas (${score.toFixed(1)}%), en dessous du seuil d'alerte. Cette faculté pourrait servir de modèle de bonnes pratiques.`,
          metric: 'faculty_plagiarism_rate',
          value: score,
          recommendation: `Documenter et partager les bonnes pratiques de ${faculty.group} avec les autres facultés.`,
          createdAt: new Date(),
          metadata: {
            facultyId: faculty.groupId,
            facultyName: faculty.group,
          },
        });
      }
    }
    
    // Identifier la faculté avec le plus grand écart
    if (faculties.length >= 2) {
      const sortedByScore = [...faculties].sort((a, b) => b.metrics.avgScore - a.metrics.avgScore);
      const highest = sortedByScore[0];
      const lowest = sortedByScore[sortedByScore.length - 1];
      const gap = highest.metrics.avgScore - lowest.metrics.avgScore;
      
      if (gap > 20) { // Écart de plus de 20 points de pourcentage
        insights.push({
          id: `faculty-gap-${Date.now()}`,
          type: 'trend',
          severity: 'warning',
          title: 'Écart important entre facultés',
          description: `L'écart de taux de plagiat entre la faculté la plus affectée (${highest.group}: ${highest.metrics.avgScore.toFixed(1)}%) et la moins affectée (${lowest.group}: ${lowest.metrics.avgScore.toFixed(1)}%) est de ${gap.toFixed(1)} points de pourcentage.`,
          metric: 'faculty_gap',
          value: gap,
          recommendation: `Analyser les différences de processus entre ${highest.group} et ${lowest.group} pour identifier les facteurs de succès.`,
          createdAt: new Date(),
          metadata: {
            highestFaculty: highest.group,
            lowestFaculty: lowest.group,
            gap,
          },
        });
      }
    }
    
    return insights;
  }
  
  /**
   * Vérifie si des seuils critiques sont dépassés
   */
  checkThresholds(data: AggregatedData): Insight[] {
    const insights: Insight[] = [];
    
    // Vérifier le taux de plagiat global
    if (data.avgPlagiarismRate > this.config.highPlagiarismThreshold) {
      insights.push({
        id: `threshold-global-high-${Date.now()}`,
        type: 'warning',
        severity: data.avgPlagiarismRate > this.config.highPlagiarismThreshold * 1.5 ? 'critical' : 'warning',
        title: 'Seuil de plagiat critique dépassé',
        description: `Le taux moyen de plagiat sur la plateforme (${data.avgPlagiarismRate.toFixed(1)}%) dépasse le seuil critique de ${this.config.highPlagiarismThreshold}%. Une action immédiate est recommandée.`,
        metric: 'global_plagiarism_rate',
        value: data.avgPlagiarismRate,
        recommendation: `Convoyer une réunion d'urgence avec les responsables académiques. Envisager des mesures préventives renforcées.`,
        createdAt: new Date(),
      });
    } else if (data.avgPlagiarismRate > this.config.warningPlagiarismThreshold) {
      insights.push({
        id: `threshold-global-warning-${Date.now()}`,
        type: 'warning',
        severity: 'warning',
        title: 'Seuil d\'alerte plagiat approché',
        description: `Le taux moyen de plagiat (${data.avgPlagiarismRate.toFixed(1)}%) approche le seuil d'alerte de ${this.config.warningPlagiarismThreshold}%. Une vigilance accrue est conseillée.`,
        metric: 'global_plagiarism_rate',
        value: data.avgPlagiarismRate,
        recommendation: `Surveiller l'évolution et préparer des mesures préventives si la tendance se confirme.`,
        createdAt: new Date(),
      });
    }
    
    // Vérifier les documents à risque critique
    const criticalDocs = data.scoreDistribution.critical;
    const totalAnalyzed = Object.values(data.scoreDistribution).reduce((a, b) => a + b, 0);
    const criticalPercent = totalAnalyzed > 0 ? (criticalDocs / totalAnalyzed) * 100 : 0;
    
    if (criticalPercent > 10) { // Plus de 10% de documents critiques
      insights.push({
        id: `threshold-critical-docs-${Date.now()}`,
        type: 'warning',
        severity: criticalPercent > 25 ? 'critical' : 'warning',
        title: 'Volume élevé de documents à haut risque',
        description: `${criticalDocs} documents (${criticalPercent.toFixed(1)}%) présentent un taux de plagiat supérieur à 50%. Ces documents nécessitent une attention particulière.`,
        metric: 'critical_documents',
        value: criticalDocs,
        changePercent: criticalPercent,
        recommendation: `Prioriser la revue des documents à haut risque. Contacter les encadreurs concernés.`,
        createdAt: new Date(),
        metadata: {
          criticalCount: criticalDocs,
          totalCount: totalAnalyzed,
          criticalPercentage: criticalPercent,
        },
      });
    }
    
    // Vérifier le ratio analyses en attente
    if (data.pendingAnalyses > 0 && data.completedAnalyses > 0) {
      const pendingRatio = (data.pendingAnalyses / (data.pendingAnalyses + data.completedAnalyses)) * 100;
      
      if (pendingRatio > 30) {
        insights.push({
          id: `threshold-pending-${Date.now()}`,
          type: 'warning',
          severity: 'warning',
          title: 'File d\'attente d\'analyses importante',
          description: `${data.pendingAnalyses} analyses sont en attente (${pendingRatio.toFixed(1)}% du total), ce qui peut retarder le traitement des documents.`,
          metric: 'pending_analyses',
          value: data.pendingAnalyses,
          changePercent: pendingRatio,
          recommendation: `Vérifier l'état du moteur d'analyse. Si nécessaire, augmenter la capacité de traitement.`,
          createdAt: new Date(),
        });
      }
    }
    
    return insights;
  }
  
  /**
   * Identifie les jalons et accomplissements notables
   */
  identifyMilestones(data: AggregatedData): Insight[] {
    const insights: Insight[] = [];
    
    // Jalon: Nombre d'analyses
    if (data.completedAnalyses >= 100 && data.completedAnalyses % 100 < 10) {
      insights.push({
        id: `milestone-analyses-${Date.now()}`,
        type: 'milestone',
        severity: 'info',
        title: `Jalon: ${Math.floor(data.completedAnalyses / 100) * 100} analyses réalisées`,
        description: `Félicitations! La plateforme a dépassé le jalon des ${Math.floor(data.completedAnalyses / 100) * 100} analyses complétées depuis son lancement.`,
        metric: 'total_analyses',
        value: data.completedAnalyses,
        recommendation: `Communiquer cet accomplissement aux parties prenantes.`,
        createdAt: new Date(),
      });
    }
    
    // Jalon: Couverture complète d'une promotion
    if (data.byFaculty.length > 0) {
      for (const faculty of data.byFaculty) {
        const coverage = faculty.metrics.totalDocuments > 0 
          ? (faculty.metrics.completedAnalyses / faculty.metrics.totalDocuments) * 100 
          : 0;
        
        if (coverage >= 95 && coverage <= 105 && faculty.metrics.totalDocuments >= 10) {
          insights.push({
            id: `milestone-coverage-${faculty.groupId}-${Date.now()}`,
            type: 'milestone',
            severity: 'info',
            title: `Couverture complète: ${faculty.group}`,
            description: `Tous les documents de la faculté ${faculty.group} (${faculty.metrics.totalDocuments}) ont été analysés. Couverture: ${coverage.toFixed(0)}%.`,
            metric: 'faculty_coverage',
            value: coverage,
            recommendation: `Maintenir cette couverture en encourageant les nouvelles soumissions.`,
            createdAt: new Date(),
            metadata: {
              facultyId: faculty.groupId,
              facultyName: faculty.group,
              coverage,
            },
          });
        }
      }
    }
    
    // Opportunité: Amélioration globale
    if (data.periodComparison) {
      const { currentPeriod, previousPeriod } = data.periodComparison;
      const improvement = previousPeriod.avgScore - currentPeriod.avgScore;
      
      if (improvement > 5 && previousPeriod.avgScore > 0) { // Amélioration de plus de 5%
        insights.push({
          id: `opportunity-improvement-${Date.now()}`,
          type: 'opportunity',
          severity: 'info',
          title: 'Amélioration globale du taux de plagiat',
          description: `Le taux moyen de plagiat a baissé de ${improvement.toFixed(1)}% par rapport à la période précédente (${previousPeriod.avgScore.toFixed(1)}% → ${currentPeriod.avgScore.toFixed(1)}%). Les mesures préventives portent leurs fruits!`,
          metric: 'plagiarism_improvement',
          value: improvement,
          previousValue: previousPeriod.avgScore,
          changePercent: (improvement / previousPeriod.avgScore) * 100,
          recommendation: `Poursuivre et renforcer les actions actuelles. Documenter les meilleures pratiques.`,
          createdAt: new Date(),
        });
      }
    }
    
    return insights;
  }
  
  // ============================================================
  // Méthodes Privées
  // ============================================================
  
  private getTrendRecommendation(
    metricName: string, 
    isIncreasing: boolean, 
    changePercent: number
  ): string {
    const isPlagiat = metricName.toLowerCase().includes('plagiat');
    
    if (isPlagiat && isIncreasing) {
      if (changePercent > 50) {
        return 'URGENT: Investiguer immédiatement la cause de cette hausse alarmante. Envisager un audit complet.';
      }
      return 'Renforcer les mesures préventives et sensibiliser les utilisateurs aux risques de plagiat.';
    }
    
    if (isPlagiat && !isIncreasing) {
      return 'Excellent! Continuer les efforts actuels et documenter les pratiques efficaces.';
    }
    
    if (metricName.toLowerCase().includes('document') && isIncreasing) {
      return 'Bonne adoption de la plateforme! S\'assurer que les ressources sont suffisantes.';
    }
    
    if (metricName.toLowerCase().includes('analyse') && !isIncreasing) {
      return 'Vérifier s\'il y a un problème technique ou une baisse de soumissions.';
    }
    
    return 'Surveiller l\'évolution de cette métrique.';
  }
  
  private prioritizeAndLimit(insights: Insight[]): Insight[] {
    // Trier par sévérité
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    
    insights.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Même sévérité: préférer les plus récents
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    // Limiter le nombre d'insights
    return insights.slice(0, this.config.maxInsights);
  }
}

// ============================================================
// Fonctions Utilitaires
// ============================================================

/**
 * Génère un résumé textuel des insights
 */
export function generateInsightSummary(insights: Insight[]): {
  total: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  summary: string;
  topInsights: Insight[];
} {
  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;
  const infoCount = insights.filter(i => i.severity === 'info').length;
  
  let summary = '';
  
  if (criticalCount > 0) {
    summary = `${criticalCount} alerte(s) critique(s) nécessitent une attention immédiate.`;
  } else if (warningCount > 0) {
    summary = `${warningCount} point(s) de vigilance à surveiller.`;
  } else if (infoCount > 0) {
    summary = `La plateforme fonctionne normalement. ${infoCount} information(s) disponible(s).`;
  } else {
    summary = 'Aucune anomalie détectée. Tout semble normal.';
  }
  
  return {
    total: insights.length,
    criticalCount,
    warningCount,
    infoCount,
    summary,
    topInsights: insights.slice(0, 3),
  };
}

// Export par défaut
export default InsightGenerator;
