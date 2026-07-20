'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  Line,
  ComposedChart,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface DistributionBin {
  start: number;
  end: number;
  count: number;
  frequency: number;
  density: number;
  mid: number;
  label: string;
}

interface DistributionChartProps {
  data: DistributionBin[];
  title?: string;
  description?: string;
  showNormalCurve?: boolean;
  normalCurveData?: Array<{ x: number; y: number }>;
  height?: number;
  thresholds?: {
    low?: number;      // Seuil zone verte (défaut: 15%)
    medium?: number;   // Seuil zone jaune (défaut: 30%)
    high?: number;     // Seuil zone rouge (défaut: 50%)
  };
  stats?: {
    mean: number;
    median: number;
    mode: number[];
    stdDev: number;
  };
  className?: string;
}

// ============================================================
// Configuration
// ============================================================

const chartConfig = {
  count: {
    label: 'Nombre de documents',
    color: 'hsl(var(--chart-1))',
  },
  density: {
    label: 'Densité',
    color: 'hsl(var(--chart-2))',
  },
};

// Couleurs par zone
function getBarColor(value: number, thresholds?: { low?: number; medium?: number; high?: number }): string {
  const low = thresholds?.low ?? 15;
  const medium = thresholds?.medium ?? 30;
  
  if (value <= low) return '#22c55e'; // Vert - faible plagiat
  if (value <= medium) return '#f59e0b'; // Jaune - modéré
  return '#ef4444'; // Rouge - élevé
}

// ============================================================
// Composant Principal
// ============================================================

export function DistributionChart({
  data,
  title = 'Distribution des Scores de Plagiat',
  description = 'Répartition des taux de similarité détectés',
  showNormalCurve = false,
  normalCurveData,
  height = 300,
  thresholds,
  stats,
  className,
}: DistributionChartProps) {
  
  // Préparer les données pour le graphique combiné
  const chartData = useMemo(() => {
    if (!showNormalCurve || !normalCurveData) {
      return data.map(bin => ({
        ...bin,
        normalDensity: null,
      }));
    }
    
    return data.map(bin => {
      // Trouver la valeur de densité normale pour ce point
      const normalPoint = normalCurveData.find(p => Math.abs(p.x - bin.mid) < (bin.end - bin.start) / 2);
      return {
        ...bin,
        normalDensity: normalPoint?.y ? normalPoint.y * data.length * 0.8 : null, // Normaliser pour l'échelle
      };
    });
  }, [data, showNormalCurve, normalCurveData]);
  
  // Calculer le max pour l'axe Y
  const maxY = useMemo(() => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return Math.ceil(maxCount * 1.2); // 20% de marge
  }, [data]);
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          {title}
        </CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
        
        {/* Stats si fournies */}
        {stats && (
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Moyenne</span>
              <span className="font-semibold text-slate-700">{stats.mean.toFixed(1)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Médiane</span>
              <span className="font-semibold text-slate-700">{stats.median.toFixed(1)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Mode</span>
              <span className="font-semibold text-slate-700">
                {stats.mode.length > 0 ? stats.mode.map(m => `${m}%`).join(', ') : 'N/A'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs">Écart-type</span>
              <span className="font-semibold text-slate-700">{stats.stdDev.toFixed(1)}%</span>
            </div>
          </div>
        )}
        
        {/* Légende des zones */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-slate-600">≤{thresholds?.low ?? 15}% (Faible)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-slate-600">{thresholds?.low ?? 15}-{thresholds?.medium ?? 30}% (Modéré)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-rose-500" />
            <span className="text-slate-600">&gt;{thresholds?.medium ?? 30}% (Élevé)</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ChartContainer config={chartConfig} className={`h-[${height}px] w-full`}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              
              <XAxis 
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              
              <YAxis 
                domain={[0, maxY]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              
              <Tooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value: number, name: string) => {
                      if (name === 'density') {
                        return [`${(value * 100).toFixed(1)}%`, 'Densité'];
                      }
                      return [value, 'Documents'];
                    }}
                  />
                }
              />
              
              {/* Ligne de moyenne */}
              {stats && (
                <ReferenceLine 
                  y={0} // Sera ajusté visuellement
                  stroke="#6366f1"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Moy: ${stats.mean.toFixed(1)}%`,
                    position: 'insideTopRight',
                    fill: '#6366f1',
                    fontSize: 10,
                  }}
                  segment={[
                    { x: stats.mean - stats.stdDev, y: 0 },
                    { x: stats.mean + stats.stdDev, y: maxY }
                  ]}
                  ifOverflow="extendDomain"
                />
              )}
              
              {/* Barres avec couleur par zone */}
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.mid, thresholds)}
                    opacity={0.85}
                  />
                ))}
              </Bar>
              
              {/* Courbe normale superposée */}
              {showNormalCurve && (
                <Line
                  type="monotone"
                  dataKey="normalDensity"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
        
        {/* Résumé des zones */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="text-center p-2 rounded-lg bg-emerald-50">
            <div className="text-lg font-bold text-emerald-700">
              {data.filter(d => d.mid <= (thresholds?.low ?? 15)).reduce((a, b) => a + b.count, 0)}
            </div>
            <div className="text-xs text-emerald-600">Faible risque</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50">
            <div className="text-lg font-bold text-amber-700">
              {data.filter(d => d.mid > (thresholds?.low ?? 15) && d.mid <= (thresholds?.medium ?? 30)).reduce((a, b) => a + b.count, 0)}
            </div>
            <div className="text-xs text-amber-600">Risque modéré</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-rose-50">
            <div className="text-lg font-bold text-rose-700">
              {data.filter(d => d.mid > (thresholds?.medium ?? 30)).reduce((a, b) => a + b.count, 0)}
            </div>
            <div className="text-xs text-rose-600">Risque élevé</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DistributionChart;
