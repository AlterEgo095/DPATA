'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Activity,
  FileText,
  Target,
  BarChart3,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface KPIData {
  id: string;
  title: string;
  value: number | string;
  previousValue?: number;
  unit?: string;
  format?: 'number' | 'percent' | 'currency';
  icon: React.ComponentType<{ className?: string }>;
  color: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'teal';
  
  // Sparkline data (mini graphique)
  sparklineData?: number[];
  
  // État de santé
  healthStatus?: 'good' | 'warning' | 'critical';
  
  // Seuils pour déterminer le statut
  thresholds?: {
    good?: number;    // En dessous = bon (pour les métriques négatives comme le plagiat)
    warning?: number; // Entre warning et critical
    critical?: number; // Au-dessus = critique
  };
  invertThresholds?: boolean; // Si true, plus bas = meilleur
  
  // Lien optionnel
  href?: string;
}

interface PremiumStatsProps {
  kpis: KPIData[];
  title?: string;
  columns?: 2 | 3 | 4;
  showSparklines?: boolean;
  showDeltaBadges?: boolean;
  className?: string;
}

// ============================================================
// Configuration des Couleurs
// ============================================================

const COLOR_STYLES = {
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
  },
  teal: {
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
  },
};

const HEALTH_STYLES = {
  good: {
    badge: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
    label: 'Normal',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-700',
    icon: AlertTriangle,
    label: 'Attention',
  },
  critical: {
    badge: 'bg-rose-100 text-rose-700',
    icon: AlertTriangle,
    label: 'Critique',
  },
};

// ============================================================
// Composant Principal
// ============================================================

export function PremiumStats({
  kpis,
  title = 'Indicateurs Clés',
  columns = 4,
  showSparklines = true,
  showDeltaBadges = true,
  className,
}: PremiumStatsProps) {
  
  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-500" />
          {title}
        </h3>
      )}
      
      <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-4`}>
        {kpis.map((kpi) => (
          <KpiCard 
            key={kpi.id} 
            kpi={kpi} 
            showSparkline={showSparklines}
            showDeltaBadge={showDeltaBadges}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Composant KPI Card
// ============================================================

interface KpiCardProps {
  kpi: KPIData;
  showSparkline: boolean;
  showDeltaBadge: boolean;
}

function KpiCard({ kpi, showSparkline, showDeltaBadge }: KpiCardProps) {
  const colors = COLOR_STYLES[kpi.color];
  const Icon = kpi.icon;
  
  // Calculer le delta et la tendance
  const delta = useMemo(() => {
    if (kpi.previousValue === undefined || typeof kpi.value !== 'number') return null;
    
    const current = kpi.value;
    const previous = kpi.previousValue;
    
    if (previous === 0) return current > 0 ? { value: 100, direction: 'up' as const } : null;
    
    const changePercent = ((current - previous) / Math.abs(previous)) * 100;
    
    return {
      value: Math.abs(changePercent),
      direction: changePercent > 0 ? 'up' as const : changePercent < 0 ? 'down' as const : 'neutral' as const,
    };
  }, [kpi.value, kpi.previousValue]);
  
  // Déterminer le statut de santé
  const healthStatus = useMemo(() => {
    if (kpi.healthStatus) return kpi.healthStatus;
    if (!kpi.thresholds || typeof kpi.value !== 'number') return 'good';
    
    const { good = 15, warning = 25, critical = 40 } = kpi.thresholds;
    const value = kpi.value;
    
    if (kpi.invertThresholds) {
      // Plus bas = meilleur (ex: score d'originalité)
      if (value >= good) return 'good';
      if (value >= warning) return 'warning';
      return 'critical';
    } else {
      // Plus bas = moins bon (ex: taux de plagiat)
      if (value <= good) return 'good';
      if (value <= warning) return 'warning';
      return 'critical';
    }
  }, [kpi]);
  
  const health = HEALTH_STYLES[healthStatus];
  const HealthIcon = health.icon;
  
  // Formater la valeur
  const formattedValue = useMemo(() => {
    if (typeof kpi.value === 'string') return kpi.value;
    
    switch (kpi.format) {
      case 'percent':
        return `${kpi.value.toFixed(1)}${kpi.unit || '%'}`;
      case 'currency':
        return `${kpi.value.toFixed(2)}${kpi.unit || '€'}`;
      default:
        return kpi.value.toLocaleString('fr-FR');
    }
  }, [kpi.value, kpi.format, kpi.unit]);
  
  // Générer le sparkline SVG
  const sparklineSvg = useMemo(() => {
    if (!showSparkline || !kpi.sparklineData || kpi.sparklineData.length < 2) return null;
    
    const data = kpi.sparklineData;
    const width = 80;
    const height = 30;
    const padding = 3;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = padding + ((max - value) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
    
    // Déterminer la couleur basée sur la tendance
    const lastTwo = data.slice(-2);
    const isUp = lastTwo[1] > lastTwo[0];
    const strokeColor = kpi.invertThresholds 
      ? (isUp ? '#22c55e' : '#ef4444')
      : (isUp ? '#ef4444' : '#22c55e');
    
    return (
      <svg 
        width={width} 
        height={height} 
        className="overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Zone sous la courbe */}
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill={`${strokeColor}20`}
        />
        {/* Ligne */}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Point final */}
        <circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
          cy={padding + ((max - data[data.length - 1]) / range) * (height - padding * 2)}
          r="2.5"
          fill={strokeColor}
        />
      </svg>
    );
  }, [showSparkline, kpi.sparklineData, kpi.invertThresholds]);
  
  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-md ${colors.border} border`}>
      <CardContent className="p-4">
        {/* Header avec icône */}
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${colors.iconBg}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          
          {/* Badge de santé */}
          <Badge variant="secondary" className={`${health.badge} text-[10px] px-1.5 py-0.5 gap-1`}>
            <HealthIcon className="h-3 w-3" />
            {health.label}
          </Badge>
        </div>
        
        {/* Valeur principale */}
        <div className="mb-1">
          <span className="text-2xl font-bold text-slate-900">{formattedValue}</span>
          
          {/* Badge de variation */}
          {showDeltaBadge && delta && (
            <DeltaBadge value={delta.value} direction={delta.direction} />
          )}
        </div>
        
        {/* Titre */}
        <p className="text-sm text-slate-500 font-medium truncate">{kpi.title}</p>
        
        {/* Sparkline */}
        {sparklineSvg && (
          <div className="mt-2 flex justify-end">
            {sparklineSvg}
          </div>
        )}
      </CardContent>
      
      {/* Barre de couleur en bas (indicateur visuel) */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1" 
        style={{ backgroundColor: colors.text.replace('text-', '') }}
      />
    </Card>
  );
}

// ============================================================
// Composant Delta Badge
// ============================================================

interface DeltaBadgeProps {
  value: number;
  direction: 'up' | 'down' | 'neutral';
}

function DeltaBadge({ value, direction }: DeltaBadgeProps) {
  const isPositive = direction === 'up';
  const isNeutral = direction === 'neutral';
  
  const colorClass = isNeutral 
    ? 'bg-slate-100 text-slate-600'
    : isPositive 
      ? 'bg-rose-50 text-rose-600' 
      : 'bg-emerald-50 text-emerald-600';
  
  const Icon = isNeutral 
    ? Minus 
    : isPositive 
      ? TrendingUp 
      : TrendingDown;
  
  return (
    <span className={`inline-flex items-center gap-0.5 ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

// ============================================================
// KPIs Prédéfinis pour PlagiatIA
// ============================================================

export function createPlagiatKPIs(stats: {
  avgPlagiarismRate: number;
  totalDocuments: number;
  completedAnalyses: number;
  dailyAnalyses: number;
  previousAvgRate?: number;
  previousDocs?: number;
  previousAnalyses?: number;
  rateTrend?: number[];
  docsTrend?: number[];
  analysesTrend?: number[];
}): KPIData[] {
  return [
    {
      id: 'plagiarism-rate',
      title: 'Taux de plagiat',
      value: stats.avgPlagiarismRate,
      previousValue: stats.previousAvgRate,
      format: 'percent',
      icon: Target,
      color: stats.avgPlagiarismRate > 30 ? 'rose' : stats.avgPlagiarismRate > 15 ? 'amber' : 'emerald',
      sparklineData: stats.rateTrend,
      thresholds: { good: 15, warning: 30, critical: 45 },
      healthStatus: stats.avgPlagiarismRate > 35 ? 'critical' : stats.avgPlagiarismRate > 20 ? 'warning' : 'good',
    },
    {
      id: 'total-documents',
      title: 'Documents ce mois',
      value: stats.totalDocuments,
      previousValue: stats.previousDocs,
      icon: FileText,
      color: 'blue',
      sparklineData: stats.docsTrend,
      invertThresholds: true,
    },
    {
      id: 'avg-score',
      title: 'Score moyen',
      value: stats.avgPlagiarismRate,
      format: 'percent',
      icon: TrendingUp,
      color: 'purple',
      sparklineData: stats.rateTrend,
      thresholds: { good: 10, warning: 25, critical: 40 },
    },
    {
      id: 'daily-analyses',
      title: 'Analyses/jour',
      value: stats.dailyAnalyses,
      previousValue: stats.previousAnalyses && Math.round(stats.previousAnalyses / 30),
      icon: Activity,
      color: 'teal',
      sparklineData: stats.analysesTrend,
      invertThresholds: true,
    },
  ];
}

export default PremiumStats;
