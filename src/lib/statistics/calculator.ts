/**
 * Moteur de Calculs Statistiques Avancés
 * PlagiatIA - Module Statistiques Premium
 * 
 * Fournit des mesures statistiques complètes pour l'analyse des données de plagiat.
 */

// ============================================================
// Types et Interfaces
// ============================================================

export interface StatisticalMeasures {
  // Tendance centrale
  mean: number;
  median: number;
  mode: number[];
  
  // Dispersion
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  quartiles: [number, number, number]; // Q1, Q2 (median), Q3
  iqr: number; // Interquartile range
  
  // Distribution
  skewness: number;
  kurtosis: number;
  
  // Méthode utilitaire
  percentile(p: number): number;
  
  // Corrélation
  correlation(otherSeries: number[]): number;
  
  // Tendances
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number; // 0-1
  growthRate: number; // en pourcentage
  
  // Données brutes
  data: number[];
  count: number;
}

export interface TimeSeriesPoint {
  date: string | Date;
  value: number;
  label?: string;
}

export interface TrendAnalysis {
  period: string;
  startPoint: TimeSeriesPoint;
  endPoint: TimeSeriesPoint;
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number; // Pente de la régression linéaire
  rSquared: number; // Coefficient de détermination
  movingAverages: {
    period7: TimeSeriesPoint[] | null;
    period30: TimeSeriesPoint[] | null;
  };
  seasonality?: SeasonalityResult;
  forecast?: ForecastPoint[];
}

export interface SeasonalityResult {
  detected: boolean;
  period: number; // en jours
  strength: number; // 0-1
  pattern: number[];
}

export interface ForecastPoint {
  date: string;
  value: number;
  confidenceLower: number;
  confidenceUpper: number;
}

export interface OutlierResult {
  index: number;
  value: number;
  type: 'mild' | 'extreme';
  method: 'iqr' | 'zscore';
  zScore?: number;
  iqrMultiplier?: number;
}

export interface ComparisonResult {
  groupALabel: string;
  groupBLabel: string;
  groupAStats: StatisticalMeasures;
  groupBStats: StatisticalMeasures;
  tStatistic: number;
  pValue: number;
  significant: boolean; // alpha = 0.05
  effectSize: number; // Cohen's d
  mannWhitneyU?: number;
  mannWhitneyPValue?: number;
}

// ============================================================
// Implémentation du Calculateur Statistique
// ============================================================

class StatisticalMeasuresImpl implements StatisticalMeasures {
  readonly data: number[];
  private _sortedData: number[] | null = null;
  private _percentileCache: Map<number, number> = new Map();
  
  constructor(data: number[]) {
    this.data = [...data];
  }
  
  get sorted(): number[] {
    if (!this._sortedData) {
      this._sortedData = [...this.data].sort((a, b) => a - b);
    }
    return this._sortedData!;
  }
  
  get count(): number {
    return this.data.length;
  }
  
  // Tendance Centrale
  get mean(): number {
    if (this.data.length === 0) return 0;
    return this.data.reduce((sum, val) => sum + val, 0) / this.data.length;
  }
  
  get median(): number {
    if (this.data.length === 0) return 0;
    const sorted = this.sorted;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  get mode(): number[] {
    if (this.data.length === 0) return [];
    
    const frequency = new Map<number, number>();
    let maxFreq = 0;
    
    for (const value of this.data) {
      const freq = (frequency.get(value) || 0) + 1;
      frequency.set(value, freq);
      if (freq > maxFreq) maxFreq = freq;
    }
    
    if (maxFreq <= 1) return []; // Pas de mode unique
    
    const modes: number[] = [];
    for (const [value, freq] of frequency.entries()) {
      if (freq === maxFreq) modes.push(value);
    }
    
    return modes.sort((a, b) => a - b);
  }
  
  // Dispersion
  get variance(): number {
    if (this.data.length === 0) return 0;
    if (this.data.length === 1) return 0;
    const m = this.mean;
    const squaredDiffs = this.data.reduce((sum, val) => sum + Math.pow(val - m, 2), 0);
    return squaredDiffs / (this.data.length - 1); // Variance échantillon
  }
  
  get stdDev(): number {
    return Math.sqrt(this.variance);
  }
  
  get min(): number {
    if (this.data.length === 0) return 0;
    return Math.min(...this.data);
  }
  
  get max(): number {
    if (this.data.length === 0) return 0;
    return Math.max(...this.data);
  }
  
  get range(): number {
    return this.max - this.min;
  }
  
  get quartiles(): [number, number, number] {
    const sorted = this.sorted;
    const n = sorted.length;
    
    if (n === 0) return [0, 0, 0];
    if (n === 1) return [sorted[0], sorted[0], sorted[0]];
    
    const q1Index = Math.floor(n * 0.25);
    const q2Index = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);
    
    return [
      this.percentileFromSorted(sorted, 0.25),
      this.percentileFromSorted(sorted, 0.5),
      this.percentileFromSorted(sorted, 0.75)
    ];
  }
  
  get iqr(): number {
    const [q1, , q3] = this.quartiles;
    return q3 - q1;
  }
  
  // Distribution
  get skewness(): number {
    if (this.data.length < 3) return 0;
    const n = this.data.length;
    const m = this.mean;
    const s = this.stdDev;
    
    if (s === 0) return 0;
    
    const sumCubed = this.data.reduce((sum, val) => 
      sum + Math.pow((val - m) / s, 3), 0);
    
    return (n / ((n - 1) * (n - 2))) * sumCubed;
  }
  
  get kurtosis(): number {
    if (this.data.length < 4) return 0;
    const n = this.data.length;
    const m = this.mean;
    const s = this.stdDev;
    
    if (s === 0) return 0;
    
    const sumFourth = this.data.reduce((sum, val) => 
      sum + Math.pow((val - m) / s, 4), 0);
    
    // Kurtosis excess (normal = 0)
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sumFourth 
           - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }
  
  // Méthodes
  percentile(p: number): number {
    if (p < 0 || p > 100) throw new Error('Percentile doit être entre 0 et 100');
    
    if (this._percentileCache.has(p)) {
      return this._percentileCache.get(p)!;
    }
    
    const result = this.percentileFromSorted(this.sorted, p / 100);
    this._percentileCache.set(p, result);
    return result;
  }
  
  private percentileFromSorted(sorted: number[], p: number): number {
    const n = sorted.length;
    if (n === 0) return 0;
    if (n === 1) return sorted[0];
    
    const index = p * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return sorted[lower];
    
    const fraction = index - lower;
    return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
  }
  
  correlation(otherSeries: number[]): number {
    if (this.data.length !== otherSeries.length || this.data.length === 0) {
      return 0;
    }
    
    const n = this.data.length;
    const meanX = this.mean;
    const meanY = otherSeries.reduce((a, b) => a + b, 0) / n;
    
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = this.data[i] - meanX;
      const dy = otherSeries[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }
    
    const denominator = Math.sqrt(sumX2 * sumY2);
    if (denominator === 0) return 0;
    
    return sumXY / denominator;
  }
  
  // Tendances
  get trend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.data.length < 2) return 'stable';
    
    const firstHalf = this.data.slice(0, Math.ceil(this.data.length / 2));
    const secondHalf = this.data.slice(Math.floor(this.data.length / 2));
    
    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = secondMean - firstMean;
    const threshold = this.stdDev * 0.1; // 10% de l'écart-type comme seuil
    
    if (Math.abs(diff) < threshold) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }
  
  get trendStrength(): number {
    if (this.data.length < 2) return 0;
    
    // Utiliser le R² de la régression linéaire
    const regression = this.linearRegression();
    return regression.rSquared;
  }
  
  get growthRate(): number {
    if (this.data.length < 2) return 0;
    
    const first = this.data[0];
    const last = this.data[this.data.length - 1];
    
    if (first === 0) return last > 0 ? 100 : 0;
    
    return ((last - first) / first) * 100;
  }
  
  private linearRegression(): { slope: number; intercept: number; rSquared: number } {
    const n = this.data.length;
    if (n < 2) return { slope: 0, intercept: this.data[0] || 0, rSquared: 0 };
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += this.data[i];
      sumXY += i * this.data[i];
      sumX2 += i * i;
      sumY2 += this.data[i] * this.data[i];
    }
    
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return { slope: 0, intercept: this.mean, rSquared: 0 };
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    // R²
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssTotal += Math.pow(this.data[i] - yMean, 2);
      ssResidual += Math.pow(this.data[i] - predicted, 2);
    }
    
    const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);
    
    return { slope, intercept, rSquared: Math.max(0, Math.min(1, rSquared)) };
  }
}

// ============================================================
// Classe Principale StatisticsCalculator
// ============================================================

export class StatisticsCalculator {
  /**
   * Crée des mesures statistiques à partir d'un tableau de nombres
   */
  static fromArray(data: number[]): StatisticalMeasures {
    if (!data || data.length === 0) {
      return new StatisticalMeasuresImpl([]);
    }
    return new StatisticalMeasuresImpl(data.filter(v => typeof v === 'number' && !isNaN(v)));
  }
  
  /**
   * Analyse une série temporelle
   */
  static timeSeriesAnalysis(data: TimeSeriesPoint[], options?: {
    forecastDays?: number;
    detectSeasonality?: boolean;
  }): TrendAnalysis {
    if (!data || data.length === 0) {
      return {
        period: '',
        startPoint: { date: '', value: 0 },
        endPoint: { date: '', value: 0 },
        trend: 'stable',
        slope: 0,
        rSquared: 0,
        movingAverages: { period7: null, period30: null },
      };
    }
    
    const values = data.map(d => d.value);
    const stats = this.fromArray(values);
    const regression = this.linearRegressionTimeSeries(data);
    
    // Moyennes mobiles
    const ma7 = this.movingAverage(data, 7);
    const ma30 = this.movingAverage(data, 30);
    
    // Détection de saisonnalité
    let seasonality: SeasonalityResult | undefined;
    if (options?.detectSeasonality && data.length >= 14) {
      seasonality = this.detectSeasonality(data);
    }
    
    // Prévisions simples
    let forecast: ForecastPoint[] | undefined;
    if (options?.forecastDays && options.forecastDays > 0 && data.length >= 7) {
      forecast = this.simpleForecast(data, regression, options.forecastDays);
    }
    
    return {
      period: `${data[0]?.date} → ${data[data.length - 1]?.date}`,
      startPoint: data[0],
      endPoint: data[data.length - 1],
      trend: stats.trend,
      slope: regression.slope,
      rSquared: regression.rSquared,
      movingAverages: { period7: ma7, period30: ma30 },
      seasonality,
      forecast,
    };
  }
  
  /**
   * Détecte les valeurs aberrantes (outliers)
   */
  static detectOutliers(
    data: number[], 
    method: 'iqr' | 'zscore' = 'iqr',
    options?: { iqrMultiplier?: number; zScoreThreshold?: number }
  ): OutlierResult[] {
    if (!data || data.length < 4) return [];
    
    const stats = this.fromArray(data);
    const results: OutlierResult[] = [];
    
    if (method === 'iqr') {
      const multiplier = options?.iqrMultiplier ?? 1.5;
      const [q1, , q3] = stats.quartiles;
      const iqr = stats.iqr;
      const lowerBound = q1 - multiplier * iqr;
      const upperBound = q3 + multiplier * iqr;
      
      data.forEach((value, index) => {
        if (value < lowerBound || value > upperBound) {
          results.push({
            index,
            value,
            type: value < (q1 - 2 * iqr) || value > (q3 + 2 * iqr) ? 'extreme' : 'mild',
            method: 'iqr',
            iqrMultiplier: multiplier,
          });
        }
      });
    } else {
      // Z-Score method
      const threshold = options?.zScoreThreshold ?? 3;
      
      data.forEach((value, index) => {
        const zScore = (value - stats.mean) / stats.stdDev;
        if (Math.abs(zScore) > threshold) {
          results.push({
            index,
            value,
            type: Math.abs(zScore) > 4 ? 'extreme' : 'mild',
            method: 'zscore',
            zScore,
          });
        }
      });
    }
    
    return results;
  }
  
  /**
   * Compare deux groupes de données
   */
  static compareGroups(
    groupA: number[],
    groupB: number[],
    labelA: string = 'Groupe A',
    labelB: string = 'Groupe B'
  ): ComparisonResult {
    const statsA = this.fromArray(groupA);
    const statsB = this.fromArray(groupB);
    
    // Test t de Student (approximation)
    const { tStat, pValue } = this.tTest(groupA, groupB);
    
    // Taille d'effet (Cohen's d)
    const pooledStdDev = Math.sqrt(
      (statsA.variance * (groupA.length - 1) + statsB.variance * (groupB.length - 1)) /
      (groupA.length + groupB.length - 2)
    );
    const cohensD = pooledStdDev > 0 
      ? (statsA.mean - statsB.mean) / pooledStdDev 
      : 0;
    
    // Test U de Mann-Whitney (non-paramétrique)
    const { u, pValue: uPValue } = this.mannWhitneyUTest(groupA, groupB);
    
    return {
      groupALabel: labelA,
      groupBLabel: labelB,
      groupAStats: statsA,
      groupBStats: statsB,
      tStatistic: tStat,
      pValue,
      significant: pValue < 0.05,
      effectSize: cohensD,
      mannWhitneyU: u,
      mannWhitneyPValue: uPValue,
    };
  }
  
  /**
   * Calcule les percentiles pour un histogramme
   */
  static histogramBins(data: number[], binCount: number = 10): HistogramBin[] {
    if (!data || data.length === 0) return [];
    
    const stats = this.fromArray(data);
    const min = stats.min;
    const max = stats.max;
    const binWidth = (max - min) / binCount || 1;
    
    const bins: HistogramBin[] = [];
    
    for (let i = 0; i < binCount; i++) {
      const start = min + i * binWidth;
      const end = start + binWidth;
      const count = data.filter(v => v >= start && (i === binCount - 1 ? v <= end : v < end)).length;
      
      bins.push({
        start,
        end,
        count,
        frequency: count / data.length,
        density: count / (data.length * binWidth),
        mid: (start + end) / 2,
        label: `${start.toFixed(1)}-${end.toFixed(1)}`,
      });
    }
    
    return bins;
  }
  
  /**
   * Calcule la distribution normale théorique pour comparaison
   */
  static normalDistributionCurve(
    data: number[],
    points: number = 50
  ): NormalCurvePoint[] {
    const stats = this.fromArray(data);
    if (data.length === 0) return [];
    
    const min = stats.min - stats.stdDev * 0.5;
    const max = stats.max + stats.stdDev * 0.5;
    const step = (max - min) / points;
    
    const curvePoints: NormalCurvePoint[] = [];
    
    for (let x = min; x <= max; x += step) {
      const pdf = this.normalPDF(x, stats.mean, stats.stdDev);
      curvePoints.push({ x, y: pdf });
    }
    
    return curvePoints;
  }
  
  // ============================================================
  // Méthodes Privées
  // ============================================================
  
  private static linearRegressionTimeSeries(data: TimeSeriesPoint[]): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i].value;
      sumXY += i * data[i].value;
      sumX2 += i * i;
      sumY2 += data[i].value * data[i].value;
    }
    
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return { slope: 0, intercept: 0, rSquared: 0 };
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssTotal += Math.pow(data[i].value - yMean, 2);
      ssResidual += Math.pow(data[i].value - predicted, 2);
    }
    
    const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);
    
    return { slope, intercept, rSquared: Math.max(0, Math.min(1, rSquared)) };
  }
  
  private static movingAverage(data: TimeSeriesPoint[], window: number): TimeSeriesPoint[] | null {
    if (data.length < window) return null;
    
    const result: TimeSeriesPoint[] = [];
    
    for (let i = window - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < window; j++) {
        sum += data[i - j].value;
      }
      result.push({
        date: data[i].date,
        value: sum / window,
        label: `MA${window}`,
      });
    }
    
    return result;
  }
  
  private static detectSeasonality(data: TimeSeriesPoint[]): SeasonalityResult {
    // Détection simple basée sur l'autocorrélation
    const values = data.map(d => d.value);
    const n = values.length;
    const maxLag = Math.min(Math.floor(n / 2), 90); // Max 90 jours
    
    let bestLag = 0;
    let bestCorrelation = 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    
    if (variance === 0) {
      return { detected: false, period: 0, strength: 0, pattern: [] };
    }
    
    for (let lag = 7; lag <= maxLag; lag++) {
      let correlation = 0;
      const count = n - lag;
      
      for (let i = 0; i < count; i++) {
        correlation += (values[i] - mean) * (values[i + lag] - mean);
      }
      
      correlation /= (count * variance);
      
      if (Math.abs(correlation) > Math.abs(bestCorrelation)) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }
    
    // Extraire le pattern saisonnier
    const pattern: number[] = [];
    if (bestLag > 0 && Math.abs(bestCorrelation) > 0.3) {
      for (let i = 0; i < bestLag && i < n; i++) {
        let avg = 0;
        let count = 0;
        for (let j = i; j < n; j += bestLag) {
          avg += values[j];
          count++;
        }
        pattern.push(count > 0 ? avg / count : 0);
      }
    }
    
    return {
      detected: Math.abs(bestCorrelation) > 0.3,
      period: bestLag,
      strength: Math.abs(bestCorrelation),
      pattern,
    };
  }
  
  private static simpleForecast(
    data: TimeSeriesPoint[],
    regression: { slope: number; intercept: number },
    days: number
  ): ForecastPoint[] {
    const n = data.length;
    const lastDate = new Date(data[n - 1].date);
    const forecast: ForecastPoint[] = [];
    
    // Calculer l'écart-type des résidus pour l'intervalle de confiance
    let residualVariance = 0;
    for (let i = 0; i < n; i++) {
      const predicted = regression.slope * i + regression.intercept;
      residualVariance += Math.pow(data[i].value - predicted, 2);
    }
    residualVariance /= n;
    const stdError = Math.sqrt(residualVariance);
    
    for (let i = 1; i <= days; i++) {
      const futureIndex = n + i - 1;
      const predicted = regression.slope * futureIndex + regression.intercept;
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);
      
      // Intervalle de confiance à 95%
      const margin = 1.96 * stdError * Math.sqrt(1 + i / n);
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        value: Math.max(0, predicted), // Les valeurs négatives n'ont pas de sens ici
        confidenceLower: Math.max(0, predicted - margin),
        confidenceUpper: predicted + margin,
      });
    }
    
    return forecast;
  }
  
  private static tTest(groupA: number[], groupB: number[]): { tStat: number; pValue: number } {
    const n1 = groupA.length;
    const n2 = groupB.length;
    
    if (n1 < 2 || n2 < 2) return { tStat: 0, pValue: 1 };
    
    const mean1 = groupA.reduce((a, b) => a + b, 0) / n1;
    const mean2 = groupB.reduce((a, b) => a + b, 0) / n2;
    
    const var1 = groupA.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1);
    const var2 = groupB.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1);
    
    // Welch's t-test (ne suppose pas des variances égales)
    const se = Math.sqrt(var1 / n1 + var2 / n2);
    if (se === 0) return { tStat: 0, pValue: 1 };
    
    const tStat = (mean1 - mean2) / se;
    
    // Degrés de liberté (Welch-Satterthwaite)
    const num = Math.pow(var1 / n1 + var2 / n2, 2);
    const den = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
    const df = den !== 0 ? num / den : Math.min(n1, n2) - 1;
    
    // Approximation de la p-value (simplifiée)
    const pValue = this.approximateTPValue(Math.abs(tStat), df);
    
    return { tStat, pValue };
  }
  
  private static approximateTPValue(t: number, df: number): number {
    // Approximation simple de la p-value pour le test t
    // Pour une implémentation production, utiliser une librairie dédiée
    const x = df / (df + t * t);
    if (x <= 0) return 1;
    if (x >= 1) return 0;
    
    // Approximation via fonction bêta incomplète (simplifiée)
    return Math.pow(1 - x, df / 2) * 0.5; // Très approximatif
  }
  
  private static mannWhitneyUTest(groupA: number[], groupB: number[]): { u: number; pValue: number } {
    // Combiner et ranger
    const combined = [...groupA.map((v, i) => ({ value: v, group: 'A', originalIndex: i })),
                      ...groupB.map((v, i) => ({ value: v, group: 'B', originalIndex: i }))];
    
    combined.sort((a, b) => a.value - b.value);
    
    // Attribuer les rangs (avec gestion des ex-aequo)
    let rankA = 0;
    let i = 0;
    
    while (i < combined.length) {
      let j = i;
      while (j < combined.length && combined[j].value === combined[i].value) j++;
      const avgRank = (i + j - 1) / 2 + 1;
      
      for (let k = i; k < j; k++) {
        if (combined[k].group === 'A') rankA += avgRank;
      }
      
      i = j;
    }
    
    const n1 = groupA.length;
    const n2 = groupB.length;
    const u = rankA - (n1 * (n1 + 1)) / 2;
    const uPrime = n1 * n2 - u;
    const uStat = Math.min(u, uPrime);
    
    // Approximation normale pour la p-value
    const meanU = n1 * n2 / 2;
    const stdU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
    
    if (stdU === 0) return { u: uStat, pValue: 1 };
    
    const z = (uStat - meanU) / stdU;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    return { u: uStat, pValue };
  }
  
  private static normalPDF(x: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return x === mean ? 1 : 0;
    const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
    const exponent = -Math.pow(x - mean, 2) / (2 * stdDev * stdDev);
    return coefficient * Math.exp(exponent);
  }
  
  private static normalCDF(x: number): number {
    // Approximation de la fonction de répartition normale
    // Algorithme Abramowitz and Stegun
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1 + sign * y);
  }
}

// ============================================================
// Types Additionnels
// ============================================================

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
  frequency: number;
  density: number;
  mid: number;
  label: string;
}

export interface NormalCurvePoint {
  x: number;
  y: number;
}

// Export par défaut
export default StatisticsCalculator;
