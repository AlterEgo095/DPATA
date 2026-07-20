'use client';

import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart as PieIcon, AreaChart as AreaIcon, ChevronRight } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface MatchTypeData {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface MatchTypeTimeSeries {
  date: string;
  COPY_PASTE?: number;
  PARAPHRASE?: number;
  REFORMULATION?: number;
  TRANSLATION?: number;
  WEAK_MATCH?: number;
}

type ViewMode = 'pie' | 'area';

interface MatchTypePieProps {
  data: MatchTypeData[];
  timeSeriesData?: MatchTypeTimeSeries[];
  title?: string;
  description?: string;
  defaultView?: ViewMode;
  height?: number;
  onDrillDown?: (type: string) => void;
  className?: string;
}

// ============================================================
// Configuration
// ============================================================

const DEFAULT_COLORS = {
  COPY_PASTE: '#ef4444',    // Rouge - le plus grave
  PARAPHRASE: '#f59e0b',    // Amber
  REFORMULATION: '#f97316', // Orange
  TRANSLATION: '#8b5cf6',   // Violet
  WEAK_MATCH: '#22c55e',    // Vert - le moins grave
};

const TYPE_LABELS: Record<string, string> = {
  COPY_PASTE: 'Copier-Coller',
  PARAPHRASE: 'Paraphrase',
  REFORMULATION: 'Réformulation',
  TRANSLATION: 'Traduction',
  WEAK_MATCH: 'Correspondance faible',
};

const chartConfig = {
  COPY_PASTE: { label: 'Copier-Coller', color: DEFAULT_COLORS.COPY_PASTE },
  PARAPHRASE: { label: 'Paraphrase', color: DEFAULT_COLORS.PARAPHRASE },
  REFORMULATION: { label: 'Réformulation', color: DEFAULT_COLORS.REFORMULATION },
  TRANSLATION: { label: 'Traduction', color: DEFAULT_COLORS.TRANSLATION },
  WEAK_MATCH: { label: 'Corr. faible', color: DEFAULT_COLORS.WEAK_MATCH },
};

// ============================================================
// Composant Principal
// ============================================================

export function MatchTypePie({
  data,
  timeSeriesData,
  title = 'Types de Correspondances',
  description = 'Répartition des types de plagiat détectés',
  defaultView = 'pie',
  height = 320,
  onDrillDown,
  className,
}: MatchTypePieProps) {
  
  const [view, setView] = useState<ViewMode>(defaultView);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  // Calculer le total pour les pourcentages si non fournis
  const processedData = useMemo(() => {
    if (data.some(d => d.percentage > 0)) return data;
    
    const total = data.reduce((sum, d) => sum + d.count, 0);
    return data.map(d => ({
      ...d,
      percentage: total > 0 ? (d.count / total) * 100 : 0,
      color: d.color || DEFAULT_COLORS[d.type as keyof typeof DEFAULT_COLORS] || '#64748b',
      label: d.label || TYPE_LABELS[d.type] || d.type,
    }));
  }, [data]);
  
  // Données pour l'area chart (évolution temporelle)
  const areaChartData = useMemo(() => {
    if (!timeSeriesData) return [];
    
    return timeSeriesData.map(point => ({
      ...point,
      label: new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    }));
  }, [timeSeriesData]);
  
  // Trouver le type dominant
  const dominantType = useMemo(() => {
    if (!processedData.length) return null;
    return processedData.reduce((max, current) => 
      current.count > max.count ? current : max
    );
  }, [processedData]);
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-teal-600" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
            
            {/* Type dominant */}
            {dominantType && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${dominantType.color}20`, color: dominantType.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dominantType.color }} />
                Dominant: {dominantType.label} ({dominantType.percentage.toFixed(1)}%)
              </div>
            )}
          </div>
          
          {/* Sélecteur de vue */}
          {timeSeriesData && timeSeriesData.length > 0 && (
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              <Button
                variant={view === 'pie' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('pie')}
                className="h-7 px-2 text-xs"
              >
                <PieIcon className="h-3.5 w-3.5 mr-1" />
                Donut
              </Button>
              <Button
                variant={view === 'area' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('area')}
                className="h-7 px-2 text-xs"
              >
                <AreaIcon className="h-3.5 w-3.5 mr-1" />
                Évolution
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <ChartContainer config={chartConfig} className={`h-[${height}px] w-full`}>
          <ResponsiveContainer width="100%" height={height}>
            {view === 'pie' ? (
              <PieChart>
                <Pie
                  data={processedData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="label"
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {processedData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      opacity={selectedType && selectedType !== entry.type ? 0.4 : 1}
                      style={{
                        cursor: onDrillDown ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        transform: selectedType === entry.type ? 'scale(1.05)' : 'scale(1)',
                        transformOrigin: 'center',
                      }}
                      onClick={() => {
                        setSelectedType(selectedType === entry.type ? null : entry.type);
                        onDrillDown?.(entry.type);
                      }}
                    />
                  ))}
                </Pie>
                
                {/* Label central */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-700"
                  fontSize={16}
                  fontWeight={600}
                >
                  {processedData.reduce((sum, d) => sum + d.count, 0)}
                </text>
                <text
                  x="50%"
                  y="58%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-500"
                  fontSize={10}
                >
                  Total
                </text>
                
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value: number, name: string) => [
                        `${value} (${processedData.find(d => d.label === name)?.percentage.toFixed(1)}%)`,
                        name
                      ]}
                    />
                  }
                />
                
                <Legend 
                  content={<ChartLegendContent />}
                  verticalAlign="bottom"
                  wrapperStyle={{ paddingTop: '10px' }}
                />
              </PieChart>
            ) : (
              <AreaChart data={areaChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {Object.entries(DEFAULT_COLORS).map(([type, color]) => (
                    <linearGradient key={type} id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
                    </linearGradient>
                  ))}
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                
                <XAxis 
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                
                <Tooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                
                {/* Stacked areas pour chaque type */}
                {Object.keys(DEFAULT_COLORS).map(type => (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stackId="1"
                    stroke={DEFAULT_COLORS[type as keyof typeof DEFAULT_COLORS]}
                    fill={`url(#gradient-${type})`}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartContainer>
        
        {/* Liste des types avec détails */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4 pt-4 border-t border-slate-100">
          {processedData.map((item) => (
            <button
              key={item.type}
              onClick={() => {
                setSelectedType(selectedType === item.type ? null : item.type);
                onDrillDown?.(item.type);
              }}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                selectedType === item.type 
                  ? 'border-current bg-opacity-10 shadow-sm' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              style={selectedType === item.type ? { borderColor: item.color, backgroundColor: `${item.color}10` } : {}}
            >
              <span 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <div className="text-left min-w-0">
                <div className="text-xs font-medium text-slate-700 truncate">{item.label}</div>
                <div className="text-xs text-slate-500">
                  {item.count} ({item.percentage.toFixed(0)}%)
                </div>
              </div>
              {onDrillDown && (
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
        
        {/* Indicateur de gravité */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-slate-700">Indice de gravité</span>
            <span className="font-semibold text-slate-900">
              {calculateSeverityIndex(processedData).toFixed(0)}/100
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${calculateSeverityIndex(processedData)}%`,
                background: `linear-gradient(to right, #22c55e, #f59e0b, #ef4444)`
              }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {getSeverityLabel(calculateSeverityIndex(processedData))}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Fonctions Utilitaires
// ============================================================

function calculateSeverityIndex(data: MatchTypeData[]): number {
  // Pondération par type (plus grave = plus de poids)
  const weights: Record<string, number> = {
    COPY_PASTE: 5,
    PARAPHRASE: 3,
    REFORMULATION: 3,
    TRANSLATION: 2,
    WEAK_MATCH: 1,
  };
  
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return 0;
  
  let weightedSum = 0;
  for (const item of data) {
    const weight = weights[item.type] || 1;
    weightedSum += (item.count / total) * weight * 20; // Max 20 par type
  }
  
  return Math.min(100, weightedSum);
}

function getSeverityLabel(index: number): string {
  if (index <= 25) return 'Plagiat majoritairement mineur - Correspondances faibles dominantes';
  if (index <= 50) return 'Niveau modéré - Mix de paraphrases et reformulations';
  if (index <= 75) return 'Niveau préoccupant - Présence significative de copier-coller';
  return 'Niveau critique - Plagiat direct majoritaire, action requise';
}

export default MatchTypePie;
