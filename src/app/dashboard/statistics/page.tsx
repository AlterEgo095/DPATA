'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Download,
  RefreshCw,
  Calendar,
  Filter,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';

// Composants de graphiques
import { PlagiatTrendChart } from '@/components/charts/plagiat-trend-chart';
import { DistributionChart } from '@/components/charts/distribution-chart';
import { FacultyComparisonChart } from '@/components/charts/faculty-comparison-chart';
import { MatchTypePie } from '@/components/charts/match-type-pie';
import { ActivityTimeline } from '@/components/charts/activity-timeline';
import { PremiumStats, createPlagiatKPIs } from '@/components/dashboard/premium-stats';

// Types
import type { Insight } from '@/lib/statistics/insights';
import type { DashboardStats } from '@/lib/statistics/aggregator';

// ============================================================
// Types Locaux
// ============================================================

type PeriodOption = '7d' | '30d' | '90d' | '1y' | 'all';

interface StatisticsPageState {
  loading: boolean;
  data: DashboardStats | null;
  insights: Insight[];
  selectedPeriod: PeriodOption;
  error: string | null;
  lastUpdated: Date | null;
}

// ============================================================
// Configuration
// ============================================================

const PERIOD_OPTIONS: { value: PeriodOption; label: string; days: number }[] = [
  { value: '7d', label: '7 jours', days: 7 },
  { value: '30d', label: '30 jours', days: 30 },
  { value: '90d', label: '90 jours', days: 90 },
  { value: '1y', label: '1 an', days: 365 },
  { value: 'all', label: 'Tout', days: 365 * 5 },
];

const periodToApiFormat = (period: PeriodOption): string => {
  return period === 'all' ? 'all' : period;
};

// ============================================================
// Page Principale
// ============================================================

export default function StatisticsPage() {
  const [state, setState] = useState<StatisticsPageState>({
    loading: true,
    data: null,
    insights: [],
    selectedPeriod: '30d',
    error: null,
    lastUpdated: null,
  });

  // Charger les données
  const fetchData = useCallback(async (period: PeriodOption) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams({
        period: periodToApiFormat(period),
      });

      // Récupérer les statistiques
      const statsRes = await fetch(`/api/statistics?${params}`);
      if (!statsRes.ok) throw new Error('Erreur lors du chargement des statistiques');
      const statsData = await statsRes.json();

      // Récupérer les insights
      const insightsRes = await fetch(`/api/statistics/insights?${params}`);
      let insightsData: Insight[] = [];
      if (insightsRes.ok) {
        insightsData = await insightsRes.json();
      }

      setState({
        loading: false,
        data: statsData,
        insights: insightsData,
        selectedPeriod: period,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue',
      }));
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    fetchData(state.selectedPeriod);
  }, [fetchData, state.selectedPeriod]);

  // Handler pour le changement de période
  const handlePeriodChange = (value: string) => {
    setState(prev => ({ ...prev, selectedPeriod: value as PeriodOption }));
  };

  // Export des données
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        period: periodToApiFormat(state.selectedPeriod),
      });
      
      const res = await fetch(`/api/statistics/export?${params}`);
      if (!res.ok) throw new Error('Erreur lors de l\'export');
      
      const data = await res.text();
      
      // Télécharger le fichier
      const blob = new Blob([data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plagiatia-statistiques-${state.selectedPeriod}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // État de chargement
  if (state.loading && !state.data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-64 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-96 bg-slate-200 animate-pulse rounded mt-2" />
          </div>
          <div className="h-10 w-40 bg-slate-200 animate-pulse rounded" />
        </div>
        
        {/* KPIs skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
        
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-80 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // État d'erreur
  if (state.error && !state.data) {
    return (
      <Card className="border-rose-200 bg-rose-50/50">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-rose-800 mb-2">Erreur de chargement</h3>
          <p className="text-rose-600 mb-4">{state.error}</p>
          <Button onClick={() => fetchData(state.selectedPeriod)} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = state.data;

  // Préparer les KPIs
  const kpis = data ? createPlagiatKPIs({
    avgPlagiarismRate: data.avgPlagiarismRate,
    totalDocuments: data.totalDocuments,
    completedAnalyses: data.completedAnalyses,
    dailyAnalyses: Math.round(data.completedAnalyses / 30),
    rateTrend: data.plagiarismTrend.map(p => p.value * 100),
    docsTrend: data.documentTrend.map(p => p.value),
    analysesTrend: data.analysisTrend.map(p => p.value),
  }) : [];

  // Préparer les données pour les graphiques
  const trendChartData = data?.plagiarismTrend.map(p => ({
    ...p,
    value: p.value * 100, // Convertir en pourcentage
  })) || [];

  const distributionData = generateDistributionData(data);

  const matchTypeData = data ? [
    { type: 'COPY_PASTE', label: 'Copier-Coller', count: data.matchTypes.COPY_PASTE, percentage: 0, color: '#ef4444' },
    { type: 'PARAPHRASE', label: 'Paraphrase', count: data.matchTypes.PARAPHRASE, percentage: 0, color: '#f59e0b' },
    { type: 'REFORMULATION', label: 'Réformulation', count: data.matchTypes.REFORMULATION, percentage: 0, color: '#f97316' },
    { type: 'TRANSLATION', label: 'Traduction', count: data.matchTypes.TRANSLATION, percentage: 0, color: '#8b5cf6' },
    { type: 'WEAK_MATCH', label: 'Corr. faible', count: data.matchTypes.WEAK_MATCH, percentage: 0, color: '#22c55e' },
  ] : [];

  // Calculer les pourcentages pour les types de correspondance
  const totalMatches = matchTypeData.reduce((sum, t) => sum + t.count, 0);
  matchTypeData.forEach(t => {
    t.percentage = totalMatches > 0 ? (t.count / totalMatches) * 100 : 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-emerald-600" />
            Analytiques Avancées
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Statistiques et analyses approfondies de la plateforme PlagiatIA
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sélecteur de période */}
          <Select value={state.selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bouton refresh */}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchData(state.selectedPeriod)}
            disabled={state.loading}
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Boutons export */}
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={!data}
            >
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('json')}
              disabled={!data}
            >
              <Download className="h-4 w-4 mr-1.5" />
              JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Dernière mise à jour */}
      {state.lastUpdated && (
        <p className="text-xs text-slate-400">
          Dernière mise à jour: {state.lastUpdated.toLocaleString('fr-FR')}
        </p>
      )}

      {/* KPI Cards Premium */}
      <PremiumStats kpis={kpis} columns={4} />

      {/* Grille principale de graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique tendance */}
        <PlagiatTrendChart
          data={trendChartData}
          title="Évolution du Taux de Plagiat"
          description="Tendance temporelle avec moyennes mobiles"
          showMovingAverages={true}
          threshold={20}
        />

        {/* Graphique types de plagiat */}
        <MatchTypePie
          data={matchTypeData}
          title="Types de Correspondances"
          description="Répartition par type de plagiat détecté"
        />
      </div>

      {/* Deuxième ligne de graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution des scores */}
        <DistributionChart
          data={distributionData}
          thresholds={{ low: 15, medium: 30 }}
          stats={{
            mean: data?.avgPlagiarismRate || 0,
            median: data?.avgPlagiarismRate || 0,
            mode: [],
            stdDev: Math.abs((data?.avgPlagiarismRate || 0) * 0.3), // Approximation
          }}
        />

        {/* Comparaison facultés */}
        <FacultyComparisonChart
          data={data?.byFaculty || []}
          title="Comparaison Inter-Facultés"
          description="Analyse comparative des taux par faculté"
        />
      </div>

      {/* Timeline d'activité */}
      <ActivityTimeline
        timelineData={generateTimelineData(data)}
        title="Activité de la Plateforme"
        description="Flux d'événements et heatmap d'utilisation"
      />

      {/* Section Insights */}
      {(state.insights.length > 0 || !state.loading) && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Insights & Recommandations
            </CardTitle>
            <CardDescription>
              Analyses automatisées et recommandations actionnables basées sur vos données
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.insights.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <h4 className="font-medium text-emerald-700 mb-1">Tout va bien!</h4>
                <p className="text-sm text-emerald-600">
                  Aucune anomalie ni alerte significative détectée sur cette période.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {state.insights.map(insight => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Footer avec résumé */}
      {data && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-6">
                <span>
                  <strong>Période:</strong> {PERIOD_OPTIONS.find(p => p.value === state.selectedPeriod)?.label}
                </span>
                <span>
                  <strong>Documents:</strong> {data.totalDocuments.toLocaleString()}
                </span>
                <span>
                  <strong>Analyses:</strong> {data.completedAnalyses.toLocaleString()}
                </span>
                <span>
                  <strong>Taux moyen:</strong>{' '}
                  <span className={data.avgPlagiarismRate > 25 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {data.avgPlagiarismRate.toFixed(1)}%
                  </span>
                </span>
              </div>
              
              <Badge variant="secondary" className="gap-1.5">
                <Info className="h-3 w-3" />
                {state.insights.length} insight(s)
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

interface InsightCardProps {
  insight: Insight;
}

function InsightCard({ insight }: InsightCardProps) {
  const severityStyles = {
    critical: {
      border: 'border-l-rose-500',
      bg: 'bg-rose-50',
      icon: AlertTriangle,
      iconColor: 'text-rose-500',
      badge: 'bg-rose-100 text-rose-700',
    },
    warning: {
      border: 'border-l-amber-500',
      bg: 'bg-amber-50',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      badge: 'bg-amber-100 text-amber-700',
    },
    info: {
      border: 'border-l-blue-500',
      bg: 'bg-blue-50',
      icon: Info,
      iconColor: 'text-blue-500',
      badge: 'bg-blue-100 text-blue-700',
    },
  };

  const style = severityStyles[insight.severity];
  const Icon = style.icon;

  return (
    <div className={`flex gap-4 p-4 rounded-lg ${style.bg} border-l-4 ${style.border}`}>
      <div className={`${style.iconColor} shrink-0 mt-0.5`}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-semibold text-slate-800">{insight.title}</h4>
          <Badge variant="secondary" className={`${style.badge} shrink-0`}>
            {insight.severity === 'critical' ? 'Critique' : insight.severity === 'warning' ? 'Alerte' : 'Info'}
          </Badge>
        </div>
        
        <p className="text-sm text-slate-600 mb-2">{insight.description}</p>
        
        {insight.recommendation && (
          <div className="text-sm text-slate-700 bg-white/60 rounded px-3 py-2">
            <span className="font-medium">💡 Recommandation:</span> {insight.recommendation}
          </div>
        )}
        
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          {insight.changePercent !== undefined && (
            <span className={insight.changePercent > 0 ? 'text-rose-500' : 'text-emerald-500'}>
              <TrendingUp className="inline h-3 w-3 mr-1" />
              {insight.changePercent > 0 ? '+' : ''}{insight.changePercent.toFixed(1)}%
            </span>
          )}
          <span>Métrique: {insight.metric}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Fonctions utilitaires pour générer des données de démo
// ============================================================

function generateDistributionData(stats?: DashboardStats | null) {
  // Générer une distribution basée sur les données disponibles
  // En production, cela viendrait de l'API
  const baseDistribution = [
    { start: 0, end: 5, count: 15, frequency: 0.25, density: 0.05, mid: 2.5, label: '0-5%' },
    { start: 5, end: 10, count: 25, frequency: 0.42, density: 0.08, mid: 7.5, label: '5-10%' },
    { start: 10, end: 15, count: 8, frequency: 0.13, density: 0.03, mid: 12.5, label: '10-15%' },
    { start: 15, end: 20, count: 5, frequency: 0.08, density: 0.02, mid: 17.5, label: '15-20%' },
    { start: 20, end: 30, count: 4, frequency: 0.07, density: 0.01, mid: 25, label: '20-30%' },
    { start: 30, end: 40, count: 2, frequency: 0.03, density: 0.005, mid: 35, label: '30-40%' },
    { start: 40, end: 50, count: 1, frequency: 0.02, density: 0.002, mid: 45, label: '40-50%' },
    { start: 50, end: 100, count: 0, frequency: 0, density: 0, mid: 75, label: '50%+' },
  ];

  // Ajuster selon le taux moyen réel si disponible
  if (stats && stats.avgPlagiarismRate > 0) {
    const shiftFactor = stats.avgPlagiarismRate / 20; // Normaliser autour de 20%
    
    return baseDistribution.map(bin => ({
      ...bin,
      count: Math.round(bin.count * (1 + (shiftFactor - 1) * (bin.mid - 12.5) / 50)),
    }));
  }

  return baseDistribution;
}

function generateTimelineData(stats?: DashboardStats | null) {
  if (!stats) return [];

  return stats.analysisTrend.map((point, index) => ({
    date: point.date,
    label: point.label || point.date,
    uploads: Math.round(point.value * 0.4),
    analyses: Math.round(point.value * 0.5),
    validations: Math.round(point.value * 0.1),
    total: Math.round(point.value),
  }));
}
