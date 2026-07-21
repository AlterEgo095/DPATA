/**
 * Agrégateur de Données Statistiques
 * PlagiatIA - Module Statistiques Premium
 * 
 * Récupère et agrège les données depuis le store pour l'analyse statistique.
 */

import { loadDB, type Analysis, type Document, type Match, type Faculty, type Department, type Promotion } from '@/lib/store/db';
import { StatisticsCalculator, type TimeSeriesPoint } from './calculator';

// ============================================================
// Types et Interfaces
// ============================================================

export type PeriodType = 'day' | 'week' | 'month' | 'year';
export type GroupBy = 'faculty' | 'department' | 'promotion' | 'documentType' | 'status';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AggregationOptions {
  period: PeriodType;
  groupBy?: GroupBy;
  dateRange?: DateRange;
  facultyId?: string;
  departmentId?: string;
}

export interface AggregatedMetric {
  period: string;
  date: string;
  value: number;
  previousValue?: number;
  delta?: number; // Changement en %
  deltaAbsolute?: number;
}

export interface GroupAggregation {
  group: string;
  groupId: string;
  count: number;
  percentage: number;
  metrics: {
    totalDocuments: number;
    totalAnalyses: number;
    completedAnalyses: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
    totalMatches: number;
    plagiarismRate: number; // % de documents avec score > seuil
  };
}

export interface DashboardStats {
  // KPIs principaux
  totalDocuments: number;
  totalAnalyses: number;
  completedAnalyses: number;
  pendingAnalyses: number;
  avgPlagiarismRate: number;
  
  // Tendances
  plagiarismTrend: TimeSeriesPoint[];
  documentTrend: TimeSeriesPoint[];
  analysisTrend: TimeSeriesPoint[];
  
  // Par groupe (faculté)
  byFaculty: GroupAggregation[];
  byDepartment: GroupAggregation[];
  byDocumentType: Record<string, number>;
  byStatus: Record<string, number>;
  
  // Distribution des scores
  scoreDistribution: {
    low: number;      // 0-15%
    medium: number;   // 15-30%
    high: number;     // 30-50%
    critical: number; // >50%
  };
  
  // Types de correspondance
  matchTypes: {
    COPY_PASTE: number;
    PARAPHRASE: number;
    REFORMULATION: number;
    TRANSLATION: number;
    WEAK_MATCH: number;
  };
  
  // Période
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
}

// ============================================================
// Cache Intelligent
// ============================================================

class StatsCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes par défaut
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }
  
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

const statsCache = new StatsCache();

// ============================================================
// Classe Principale DataAggregator
// ============================================================

export class DataAggregator {
  /**
   * Récupère les statistiques complètes du dashboard
   */
  static async getDashboardStats(options?: Partial<AggregationOptions>): Promise<DashboardStats> {
    const cacheKey = `dashboard:${JSON.stringify(options)}`;
    const cached = await statsCache.get<DashboardStats>(cacheKey);
    if (cached) return cached;
    
    const db = await loadDB();
    const now = new Date();
    
    // Définir la plage de dates
    const daysBack = options?.period === 'day' ? 1 
                   : options?.period === 'week' ? 7 
                   : options?.period === 'month' ? 30 
                   : options?.period === 'year' ? 365 
                   : 30;
    
    const startDate = options?.dateRange?.start || new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const endDate = options?.dateRange?.end || now;
    
    // Filtrer les analyses par date
    const filteredAnalyses = db.analyses.filter(a => {
      const createdAt = new Date(a.createdAt);
      return createdAt >= startDate && createdAt <= endDate;
    });
    
    const completedAnalyses = filteredAnalyses.filter(a => a.status === 'COMPLETED');
    const pendingAnalyses = filteredAnalyses.filter(a => a.status === 'PENDING' || a.status === 'RUNNING');
    
    // Calculer les scores
    const scores = completedAnalyses.map(a => a.globalScore ?? 0).filter(s => s > 0);
    const avgPlagiarismRate = scores.length > 0 
      ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 
      : 0;
    
    // Tendances temporelles
    const plagiarismTrend = this.buildTimeSeries(completedAnalyses, options?.period ?? 'month', 'globalScore');
    const documentTrend = this.buildDocumentTimeSeries(db.documents, startDate, endDate, options?.period ?? 'month');
    const analysisTrend = this.buildTimeSeries(filteredAnalyses, options?.period ?? 'month', 'count');
    
    // Agrégations par faculté
    const byFaculty = this.aggregateByFaculty(db, completedAnalyses, startDate, endDate);
    const byDepartment = this.aggregateByDepartment(db, completedAnalyses, startDate, endDate);
    
    // Par type de document
    const byDocumentType = this.aggregateByDocumentType(db.documents, startDate, endDate);
    
    // Par statut
    const byStatus = this.aggregateByStatus(filteredAnalyses);
    
    // Distribution des scores
    const scoreDistribution = this.calculateScoreDistribution(scores);
    
    // Types de correspondance
    const matchTypes = this.aggregateMatchTypes(db.matches, completedAnalyses);
    
    const stats: DashboardStats = {
      totalDocuments: db.documents.length,
      totalAnalyses: db.analyses.length,
      completedAnalyses: completedAnalyses.length,
      pendingAnalyses: pendingAnalyses.length,
      avgPlagiarismRate,
      plagiarismTrend,
      documentTrend,
      analysisTrend,
      byFaculty,
      byDepartment,
      byDocumentType,
      byStatus,
      scoreDistribution,
      matchTypes,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
    };
    
    statsCache.set(cacheKey, stats);
    return stats;
  }
  
  /**
   * Récupère les tendances pour une métrique spécifique
   */
  static async getTrends(
    metric: 'plagiarism_rate' | 'documents' | 'analyses' | 'avg_score',
    period: PeriodType = 'month',
    dateRange?: DateRange
  ): Promise<TimeSeriesPoint[]> {
    const cacheKey = `trends:${metric}:${period}:${dateRange?.start}-${dateRange?.end}`;
    const cached = await statsCache.get<TimeSeriesPoint[]>(cacheKey);
    if (cached) return cached;
    
    const db = await loadDB();
    const now = new Date();
    
    const daysBack = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const start = dateRange?.start || new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const end = dateRange?.end || now;
    
    let trend: TimeSeriesPoint[] = [];
    
    switch (metric) {
      case 'plagiarism_rate':
        const completed = db.analyses.filter(a => {
          const d = new Date(a.createdAt);
          return a.status === 'COMPLETED' && d >= start && d <= end;
        });
        trend = this.buildTimeSeries(completed, period, 'globalScore');
        break;
        
      case 'documents':
        trend = this.buildDocumentTimeSeries(db.documents, start, end, period);
        break;
        
      case 'analyses':
        const allAnalyses = db.analyses.filter(a => {
          const d = new Date(a.createdAt);
          return d >= start && d <= end;
        });
        trend = this.buildTimeSeries(allAnalyses, period, 'count');
        break;
        
      case 'avg_score':
        const scored = db.analyses.filter(a => {
          const d = new Date(a.createdAt);
          return a.status === 'COMPLETED' && a.globalScore !== undefined && d >= start && d <= end;
        });
        trend = this.buildTimeSeries(scored, period, 'avgGlobalScore');
        break;
    }
    
    statsCache.set(cacheKey, trend);
    return trend;
  }
  
  /**
   * Compare deux périodes
   */
  static async comparePeriods(
    currentPeriod: PeriodType,
    previousPeriod?: PeriodType
  ): Promise<{
    current: AggregatedMetric[];
    previous: AggregatedMetric[] | null;
    comparison: { metric: string; current: number; previous: number; changePercent: number }[];
  }> {
    const db = await loadDB();
    const now = new Date();
    
    // Calculer les dates
    const currentDays = this.periodToDays(currentPeriod);
    const prevDays = this.periodToDays(previousPeriod || currentPeriod);
    
    const currentStart = new Date(now.getTime() - currentDays * 24 * 60 * 60 * 1000);
    const currentEnd = now;
    const prevStart = new Date(currentStart.getTime() - prevDays * 24 * 60 * 60 * 1000);
    const prevEnd = currentStart;
    
    // Récupérer les données pour chaque période
    const currentAnalyses = db.analyses.filter(a => {
      const d = new Date(a.createdAt);
      return d >= currentStart && d <= currentEnd && a.status === 'COMPLETED';
    });
    
    const prevAnalyses = db.analyses.filter(a => {
      const d = new Date(a.createdAt);
      return d >= prevStart && d <= prevEnd && a.status === 'COMPLETED';
    });
    
    // Calculer les métriques
    const currentMetrics = this.calculatePeriodMetrics(currentAnalyses, currentPeriod, currentStart, currentEnd);
    const prevMetrics = this.calculatePeriodMetrics(prevAnalyses, previousPeriod || currentPeriod, prevStart, prevEnd);
    
    // Comparaison
    const comparison = [
      {
        metric: 'avgPlagiarismRate',
        current: currentMetrics.avgScore,
        previous: prevMetrics.avgScore,
        changePercent: prevMetrics.avgScore !== 0 
          ? ((currentMetrics.avgScore - prevMetrics.avgScore) / prevMetrics.avgScore) * 100 
          : 0,
      },
      {
        metric: 'totalAnalyses',
        current: currentMetrics.totalCount,
        previous: prevMetrics.totalCount,
        changePercent: prevMetrics.totalCount !== 0 
          ? ((currentMetrics.totalCount - prevMetrics.totalCount) / prevMetrics.totalCount) * 100 
          : 0,
      },
      {
        metric: 'highRiskDocuments',
        current: currentMetrics.highRiskCount,
        previous: prevMetrics.highRiskCount,
        changePercent: prevMetrics.highRiskCount !== 0 
          ? ((currentMetrics.highRiskCount - prevMetrics.highRiskCount) / prevMetrics.highRiskCount) * 100 
          : 0,
      },
    ];
    
    return {
      current: currentMetrics.breakdown,
      previous: prevMetrics.breakdown,
      comparison,
    };
  }
  
  /**
   * Exporte les données brutes
   */
  static async exportData(
    format: 'csv' | 'json',
    options?: Partial<AggregationOptions>
  ): Promise<string> {
    const db = await loadDB();
    const stats = await this.getDashboardStats(options);
    
    if (format === 'json') {
      return JSON.stringify(stats, null, 2);
    }
    
    // Format CSV
    const headers = [
      'Période', 'Date', 'Taux Plagiat (%)', 'Documents', 'Analyses', 'Analyses Complétées'
    ];
    
    const rows = stats.plagiarismTrend.map((point, i) => [
      point.label || point.date,
      point.date,
      (point.value * 100).toFixed(2),
      stats.documentTrend[i]?.value?.toString() || '0',
      stats.analysisTrend[i]?.value?.toString() || '0',
      stats.completedAnalyses.toString(),
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csvContent;
  }
  
  /**
   * Invalide le cache
   */
  static invalidateCache(pattern?: string): void {
    statsCache.invalidate(pattern);
  }
  
  /**
   * Retourne les stats du cache
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return statsCache.getStats();
  }
  
  // ============================================================
  // Méthodes Privées
  // ============================================================
  
  private static buildTimeSeries(
    analyses: Analysis[],
    period: PeriodType,
    metric: 'globalScore' | 'count' | 'avgGlobalScore'
  ): TimeSeriesPoint[] {
    if (analyses.length === 0) {
      return this.generateEmptyTimeSeries(period, 10);
    }
    
    // Grouper par période
    const grouped = new Map<string, number[]>();
    
    for (const analysis of analyses) {
      const date = new Date(analysis.createdAt);
      const key = this.getPeriodKey(date, period);
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      
      if (metric === 'globalScore' && analysis.globalScore !== undefined) {
        grouped.get(key)!.push(analysis.globalScore);
      } else if (metric === 'count') {
        grouped.get(key)!.push(1); // Compter comme 1
      } else if (metric === 'avgGlobalScore' && analysis.globalScore !== undefined) {
        grouped.get(key)!.push(analysis.globalScore);
      }
    }
    
    // Convertir en TimeSeriesPoint
    const points: TimeSeriesPoint[] = [];
    const sortedKeys = Array.from(grouped.keys()).sort();
    
    for (const key of sortedKeys) {
      const values = grouped.get(key)!;
      let value: number;
      
      if (metric === 'count') {
        value = values.length;
      } else {
        value = values.reduce((a, b) => a + b, 0) / values.length;
      }
      
      points.push({
        date: key,
        value,
        label: this.formatPeriodLabel(key, period),
      });
    }
    
    return points.length > 0 ? points : this.generateEmptyTimeSeries(period, 10);
  }
  
  private static buildDocumentTimeSeries(
    documents: Document[],
    start: Date,
    end: Date,
    period: PeriodType
  ): TimeSeriesPoint[] {
    const filtered = documents.filter(d => {
      const date = new Date(d.createdAt);
      return date >= start && date <= end;
    });
    
    if (filtered.length === 0) {
      return this.generateEmptyTimeSeries(period, 10);
    }
    
    const grouped = new Map<string, number>();
    
    for (const doc of filtered) {
      const date = new Date(doc.createdAt);
      const key = this.getPeriodKey(date, period);
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }
    
    const points: TimeSeriesPoint[] = [];
    const sortedKeys = Array.from(grouped.keys()).sort();
    
    for (const key of sortedKeys) {
      points.push({
        date: key,
        value: grouped.get(key)!,
        label: this.formatPeriodLabel(key, period),
      });
    }
    
    return points;
  }
  
  private static aggregateByFaculty(
    db: { faculties: Faculty[]; analyses: Analysis[]; documents: Document[] },
    completedAnalyses: Analysis[],
    start: Date,
    end: Date
  ): GroupAggregation[] {
    const result: GroupAggregation[] = [];
    
    for (const faculty of db.faculties) {
      const facultyDocs = db.documents.filter(d => d.facultyId === faculty.id);
      const facultyAnalyses = completedAnalyses.filter(a => {
        const doc = db.documents.find(d => d.id === a.documentId);
        return doc?.facultyId === faculty.id;
      });
      
      const scores = facultyAnalyses.map(a => a.globalScore ?? 0).filter(s => s > 0);
      const threshold = 0.15; // 15%
      const highRiskCount = scores.filter(s => s > threshold).length;
      
      result.push({
        group: faculty.name,
        groupId: faculty.id,
        count: facultyDocs.length,
        percentage: db.documents.length > 0 ? (facultyDocs.length / db.documents.length) * 100 : 0,
        metrics: {
          totalDocuments: facultyDocs.length,
          totalAnalyses: facultyAnalyses.length,
          completedAnalyses: facultyAnalyses.length,
          avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 : 0,
          maxScore: scores.length > 0 ? Math.max(...scores) * 100 : 0,
          minScore: scores.length > 0 ? Math.min(...scores) * 100 : 0,
          totalMatches: 0, // À calculer si nécessaire
          plagiarismRate: scores.length > 0 ? (highRiskCount / scores.length) * 100 : 0,
        },
      });
    }
    
    return result.sort((a, b) => b.count - a.count);
  }
  
  private static aggregateByDepartment(
    db: { departments: Department[]; analyses: Analysis[]; documents: Document[] },
    completedAnalyses: Analysis[],
    start: Date,
    end: Date
  ): GroupAggregation[] {
    const result: GroupAggregation[] = [];
    
    for (const dept of db.departments) {
      const deptDocs = db.documents.filter(d => d.departmentId === dept.id);
      const deptAnalyses = completedAnalyses.filter(a => {
        const doc = db.documents.find(d => d.id === a.documentId);
        return doc?.departmentId === dept.id;
      });
      
      const scores = deptAnalyses.map(a => a.globalScore ?? 0).filter(s => s > 0);
      
      result.push({
        group: dept.name,
        groupId: dept.id,
        count: deptDocs.length,
        percentage: db.documents.length > 0 ? (deptDocs.length / db.documents.length) * 100 : 0,
        metrics: {
          totalDocuments: deptDocs.length,
          totalAnalyses: deptAnalyses.length,
          completedAnalyses: deptAnalyses.length,
          avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 : 0,
          maxScore: scores.length > 0 ? Math.max(...scores) * 100 : 0,
          minScore: scores.length > 0 ? Math.min(...scores) * 100 : 0,
          totalMatches: 0,
          plagiarismRate: 0,
        },
      });
    }
    
    return result.sort((a, b) => b.count - a.count);
  }
  
  private static aggregateByDocumentType(
    documents: Document[],
    start: Date,
    end: Date
  ): Record<string, number> {
    const filtered = documents.filter(d => {
      const date = new Date(d.createdAt);
      return date >= start && date <= end;
    });
    
    const result: Record<string, number> = {
      TFC: 0,
      MEMOIRE: 0,
      THESE: 0,
      ARTICLE: 0,
      AUTRE: 0,
    };
    
    for (const doc of filtered) {
      result[doc.type] = (result[doc.type] || 0) + 1;
    }
    
    return result;
  }
  
  private static aggregateByStatus(analyses: Analysis[]): Record<string, number> {
    return {
      PENDING: analyses.filter(a => a.status === 'PENDING').length,
      RUNNING: analyses.filter(a => a.status === 'RUNNING').length,
      COMPLETED: analyses.filter(a => a.status === 'COMPLETED').length,
      FAILED: analyses.filter(a => a.status === 'FAILED').length,
    };
  }
  
  private static calculateScoreDistribution(scores: number[]): DashboardStats['scoreDistribution'] {
    if (scores.length === 0) {
      return { low: 0, medium: 0, high: 0, critical: 0 };
    }
    
    // Scores sont en 0-1, convertir en pourcentages
    const percentages = scores.map(s => s * 100);
    
    return {
      low: percentages.filter(p => p <= 15).length,
      medium: percentages.filter(p => p > 15 && p <= 30).length,
      high: percentages.filter(p => p > 30 && p <= 50).length,
      critical: percentages.filter(p => p > 50).length,
    };
  }
  
  private static aggregateMatchTypes(
    matches: Match[],
    completedAnalyses: Analysis[]
  ): DashboardStats['matchTypes'] {
    const analysisIds = new Set(completedAnalyses.map(a => a.id));
    const relevantMatches = matches.filter(m => analysisIds.has(m.analysisId));
    
    return {
      COPY_PASTE: relevantMatches.filter(m => m.matchType === 'COPY_PASTE').length,
      PARAPHRASE: relevantMatches.filter(m => m.matchType === 'PARAPHRASE').length,
      REFORMULATION: relevantMatches.filter(m => m.matchType === 'REFORMULATION').length,
      TRANSLATION: relevantMatches.filter(m => m.matchType === 'TRANSLATION').length,
      WEAK_MATCH: relevantMatches.filter(m => m.matchType === 'WEAK_MATCH').length,
    };
  }
  
  private static calculatePeriodMetrics(
    analyses: Analysis[],
    period: PeriodType,
    start: Date,
    end: Date
  ): { breakdown: AggregatedMetric[]; avgScore: number; totalCount: number; highRiskCount: number } {
    const scores = analyses.map(a => a.globalScore ?? 0).filter(s => s > 0);
    const threshold = 0.15;
    
    return {
      breakdown: [],
      avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 : 0,
      totalCount: analyses.length,
      highRiskCount: scores.filter(s => s > threshold).length,
    };
  }
  
  private static getPeriodKey(date: Date, period: PeriodType): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    switch (period) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week': {
        const janFirst = new Date(year, 0, 1);
        const weekNum = Math.ceil(((date.getTime() - janFirst.getTime()) / 86400000 + janFirst.getDay() + 1) / 7);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      }
      case 'month':
        return `${year}-${month}`;
      case 'year':
        return String(year);
      default:
        return `${year}-${month}`;
    }
  }
  
  private static formatPeriodLabel(key: string, period: PeriodType): string {
    switch (period) {
      case 'day': {
        const [y, m, d] = key.split('-');
        return `${d}/${m}`;
      }
      case 'week':
        return key.replace('W', ' Semaine ');
      case 'month': {
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        const [y, m] = key.split('-');
        return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
      }
      case 'year':
        return key;
      default:
        return key;
    }
  }
  
  private static generateEmptyTimeSeries(period: PeriodType, count: number): TimeSeriesPoint[] {
    const points: TimeSeriesPoint[] = [];
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now);
      
      switch (period) {
        case 'day':
          date.setDate(date.getDate() - i);
          break;
        case 'week':
          date.setDate(date.getDate() - (i * 7));
          break;
        case 'month':
          date.setMonth(date.getMonth() - i);
          break;
        case 'year':
          date.setFullYear(date.getFullYear() - i);
          break;
      }
      
      points.push({
        date: this.getPeriodKey(date, period),
        value: 0,
        label: this.formatPeriodLabel(this.getPeriodKey(date, period), period),
      });
    }
    
    return points;
  }
  
  private static periodToDays(period: PeriodType): number {
    switch (period) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
      default: return 30;
    }
  }
}

// Export par défaut
export default DataAggregator;
