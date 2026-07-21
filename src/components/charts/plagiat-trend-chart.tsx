'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertTriangle } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface TrendDataPoint {
  date: string;
  label?: string;
  value: number; // Taux de plagiat (0-1 ou 0-100)
  ma7?: number;  // Moyenne mobile 7 jours
  ma30?: number; // Moyenne mobile 30 jours
}

interface PlagiatTrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  description?: string;
  showMovingAverages?: boolean;
  height?: number;
  threshold?: number; // Seuil d'alerte (en %)
  unit?: string;
  className?: string;
}

// ============================================================
// Configuration du Graphique
// ============================================================

const chartConfig = {
  value: {
    label: 'Taux de plagiat',
    color: 'hsl(var(--chart-1))',
  },
  ma7: {
    label: 'Moyenne 7j',
    color: 'hsl(var(--chart-2))',
  },
  ma30: {
    label: 'Moyenne 30j',
    color: 'hsl(var(--chart-3))',
  },
};

// ============================================================
// Composant Principal
// ============================================================

export function PlagiatTrendChart({
  data,
  title = 'Évolution du Taux de Plagiat',
  description = 'Analyse temporelle du taux de similarité détecté',
  showMovingAverages = true,
  height = 350,
  threshold = 20,
  unit = '%',
  className,
}: PlagiatTrendChartProps) {
  
  // Calculer les moyennes mobiles si non fournies
  const processedData = useMemo(() => {
    if (!showMovingAverages || data.some(d => d.ma7 !== undefined)) {
      return data;
    }
    
    return data.map((point, index) => ({
      ...point,
      ma7: calculateMA(data, index, 7),
      ma30: calculateMA(data, index, 30),
    }));
  }, [data, showMovingAverages]);
  
  // Calculer les stats pour le tooltip
  const stats = useMemo(() => {
    if (!processedData.length) return null;
    
    const values = processedData.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const latest = values[values.length - 1];
    
    return { avg, max, min, latest };
  }, [processedData]);
  
  // Déterminer si la dernière valeur est au-dessus du seuil
  const isAboveThreshold = (processedData[processedData.length - 1]?.value ?? 0) > threshold;
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {isAboveThreshold && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Au-dessus du seuil
            </div>
          )}
        </div>
        {stats && (
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Actuel</span>
              <span className={`font-semibold ${isAboveThreshold ? 'text-rose-600' : 'text-emerald-600'}`}>
                {stats.latest.toFixed(1)}{unit}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Moyenne</span>
              <span className="font-semibold text-slate-700">{stats.avg.toFixed(1)}{unit}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Max</span>
              <span className="font-semibold text-slate-700">{stats.max.toFixed(1)}{unit}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Min</span>
              <span className="font-semibold text-slate-700">{stats.min.toFixed(1)}{unit}</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className={`h-[${height}px] w-full`}>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="plagiatGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="dangerZoneGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15}/>
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              
              <YAxis 
                domain={[0, 'auto']}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                tickFormatter={(v) => `${v}${unit}`}
              />
              
              <Tooltip 
                content={
                  <ChartTooltipContent 
                    indicator="dot"
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)}${unit}`,
                      chartConfig[name as keyof typeof chartConfig]?.label || name
                    ]}
                  />
                }
              />
              
              <Legend content={<ChartLegendContent />} />
              
              {/* Zone de danger au-dessus du seuil */}
              <ReferenceLine 
                y={threshold} 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Seuil (${threshold}${unit})`,
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 10,
                }}
              />
              
              {/* Zone colorée sous la courbe */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#plagiatGradient)"
                dot={{ r: 3, fill: 'hsl(var(--chart-1))', strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: 'hsl(var(--chart-1))', strokeWidth: 2, fill: '#fff' }}
              />
              
              {/* Moyenne mobile 7j */}
              {showMovingAverages && (
                <Line
                  type="monotone"
                  dataKey="ma7"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  connectNulls
                />
              )}
              
              {/* Moyenne mobile 30j */}
              {showMovingAverages && (
                <Line
                  type="monotone"
                  dataKey="ma30"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={1.5}
                  strokeDasharray="10 5"
                  dot={false}
                  connectNulls
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Fonctions Utilitaires
// ============================================================

function calculateMA(data: TrendDataPoint[], index: number, window: number): number | undefined {
  if (index < window - 1) return undefined;
  
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < window; i++) {
    const val = data[index - i]?.value;
    if (val !== undefined && !isNaN(val)) {
      sum += val;
      count++;
    }
  }
  
  return count > 0 ? sum / count : undefined;
}

export default PlagiatTrendChart;
