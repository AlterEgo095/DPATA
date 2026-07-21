/**
 * Module Statistiques Avancées - PlagiatIA
 * 
 * Ce module fournit des fonctionnalités statistiques premium pour l'analyse
 * des données de plagiat, incluant:
 * 
 * - Moteur de calculs statistiques (moyenne, médiane, écart-type, etc.)
 * - Agrégateur de données avec cache intelligent
 * - Générateur d'insights automatisés
 * - Composants graphiques avancés (Recharts)
 */

// Export du moteur de calculs
export { StatisticsCalculator } from './calculator';
export type {
  StatisticalMeasures,
  TimeSeriesPoint,
  TrendAnalysis,
  SeasonalityResult,
  ForecastPoint,
  OutlierResult,
  ComparisonResult,
  HistogramBin,
  NormalCurvePoint,
} from './calculator';

// Export de l'agrégateur
export { DataAggregator } from './aggregator';
export type {
  PeriodType,
  GroupBy,
  DateRange,
  AggregationOptions,
  AggregatedMetric,
  GroupAggregation,
  DashboardStats,
} from './aggregator';

// Export du générateur d'insights
export { InsightGenerator, generateInsightSummary } from './insights';
export type {
  Insight,
  InsightConfig,
  MetricData,
  AggregatedData as InsightAggregatedData,
} from './insights';
