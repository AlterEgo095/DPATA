'use client';

import React, { useState, useMemo } from 'react';
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Treemap,
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
import { Building2, BarChart3, Radar as RadarIcon, LayoutGrid } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface FacultyData {
  faculty: string;
  facultyId: string;
  count: number;
  percentage: number;
  metrics: {
    totalDocuments: number;
    totalAnalyses: number;
    completedAnalyses: number;
    avgScore: number; // en pourcentage
    maxScore: number;
    minScore: number;
    totalMatches: number;
    plagiarismRate: number;
  };
}

type ChartView = 'bar' | 'radar' | 'treemap';

interface FacultyComparisonChartProps {
  data: FacultyData[];
  title?: string;
  description?: string;
  defaultView?: ChartView;
  height?: number;
  showDetails?: boolean;
  className?: string;
}

// ============================================================
// Configuration
// ============================================================

const chartConfig = {
  avgScore: {
    label: 'Score moyen',
    color: 'hsl(var(--chart-1))',
  },
  plagiarismRate: {
    label: 'Taux plagiat',
    color: 'hsl(var(--chart-2))',
  },
  documents: {
    label: 'Documents',
    color: 'hsl(var(--chart-3))',
  },
};

// Couleurs basées sur le score
function getScoreColor(score: number): string {
  if (score <= 15) return '#22c55e'; // Vert
  if (score <= 25) return '#f59e0b'; // Amber
  if (score <= 35) return '#f97316'; // Orange
  return '#ef4444'; // Rouge
}

// ============================================================
// Composant Principal
// ============================================================

export function FacultyComparisonChart({
  data,
  title = 'Comparaison Inter-Facultés',
  description = 'Analyse comparative des taux de plagiat par faculté',
  defaultView = 'bar',
  height = 350,
  showDetails = true,
  className,
}: FacultyComparisonChartProps) {
  
  const [view, setView] = useState<ChartView>(defaultView);
  
  // Préparer les données pour chaque type de graphique
  const barData = useMemo(() => 
    data.map(f => ({
      name: f.faculty.length > 15 ? f.faculty.substring(0, 12) + '...' : f.faculty,
      fullName: f.faculty,
      avgScore: f.metrics.avgScore,
      plagiarismRate: f.metrics.plagiarismRate,
      documents: f.metrics.totalDocuments,
      analyses: f.metrics.completedAnalyses,
      facultyId: f.facultyId,
    })).sort((a, b) => b.avgScore - a.avgScore)
  , [data]);
  
  const radarData = useMemo(() => {
    const metrics = ['avgScore', 'plagiarismRate', 'documents', 'analyses'];
    
    return data.slice(0, 6).map(f => ({
      faculty: f.faculty.length > 10 ? f.faculty.substring(0, 8) + '...' : f.faculty,
      fullName: f.faculty,
      // Normaliser les valeurs pour le radar (0-100)
      'Taux plagiat': Math.min(f.metrics.avgScore, 100),
      'Risque': Math.min(f.metrics.plagiarismRate * 5, 100), // Échelle ajustée
      'Volume': Math.min((f.metrics.totalDocuments / Math.max(...data.map(d => d.metrics.totalDocuments))) * 100, 100),
      'Couverture': Math.min((f.metrics.completedAnalyses / Math.max(f.metrics.totalDocuments, 1)) * 100, 100),
    }));
  }, [data]);
  
  const treemapData = useMemo(() =>
    data.map(f => ({
      name: f.faculty,
      size: f.metrics.totalDocuments,
      avgScore: f.metrics.avgScore,
    })).filter(f => f.size > 0)
  , [data]);
  
  // Calculer la moyenne globale
  const globalAvg = useMemo(() => {
    if (!data.length) return 0;
    const scores = data.map(f => f.metrics.avgScore).filter(s => s > 0);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [data]);
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-600" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
            
            {/* Moyenne globale */}
            {globalAvg > 0 && (
              <div className="mt-2 text-sm">
                <span className="text-slate-500">Moyenne globale: </span>
                <span className={`font-semibold ${globalAvg > 25 ? 'text-rose-600' : globalAvg > 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {globalAvg.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          {/* Sélecteur de vue */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <Button
              variant={view === 'bar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('bar')}
              className="h-7 px-2 text-xs"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Barres
            </Button>
            <Button
              variant={view === 'radar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('radar')}
              className="h-7 px-2 text-xs"
            >
              <RadarIcon className="h-3.5 w-3.5 mr-1" />
              Radar
            </Button>
            <Button
              variant={view === 'treemap' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('treemap')}
              className="h-7 px-2 text-xs"
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Treemap
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ChartContainer config={chartConfig} className={`h-[${height}px] w-full`}>
          <ResponsiveContainer width="100%" height={height}>
            {view === 'bar' && (
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                
                <XAxis 
                  type="number"
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={120}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                
                <Tooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}%`,
                        barData.find(d => d[name as keyof typeof d] === value)?.fullName || name
                      ]}
                      labelFormatter={(label) => `Faculté: ${label}`}
                    />
                  }
                />
                
                <ReferenceLine 
                  x={globalAvg}
                  stroke="#6366f1"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Moy: ${globalAvg.toFixed(1)}%`,
                    position: 'insideTopRight',
                    fill: '#6366f1',
                    fontSize: 10,
                  }}
                />
                
                <Bar 
                  dataKey="avgScore" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={30}
                  name="avgScore"
                >
                  {barData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getScoreColor(entry.avgScore)}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
            
            {view === 'radar' && (
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis 
                  dataKey="faculty" 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 100]} 
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                />
                
                <Radar
                  name="Taux de plagiat"
                  dataKey="Taux plagiat"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Radar
                  name="Risque relatif"
                  dataKey="Risque"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                
                <Legend content={<ChartLegendContent />} />
                <Tooltip 
                  content={<ChartTooltipContent />}
                />
              </RadarChart>
            )}
            
            {view === 'treemap' && (
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                strokeWidth={2}
                content={({ x, y, width, height, name, avgScore }: any) => {
                  if (width < 30 || height < 20) return null;
                  return (
                    <g>
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={getScoreColor(avgScore)}
                        opacity={0.85}
                        rx={4}
                      />
                      {width > 60 && height > 30 && (
                        <>
                          <text
                            x={x + width / 2}
                            y={y + height / 2 - 6}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={Math.min(width / 10, 12)}
                            fontWeight={600}
                          >
                            {name.length > 15 ? name.substring(0, 13) + '...' : name}
                          </text>
                          <text
                            x={x + width / 2}
                            y={y + height / 2 + 10}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={Math.min(width / 12, 10)}
                            opacity={0.9}
                          >
                            {avgScore?.toFixed(1)}%
                          </text>
                        </>
                      )}
                    </g>
                  );
                }}
              />
            )}
          </ResponsiveContainer>
        </ChartContainer>
        
        {/* Tableau détaillé si activé */}
        {showDetails && view === 'bar' && (
          <div className="mt-4 pt-4 border-t border-slate-100 max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-600 font-medium">Faculté</th>
                  <th className="text-right py-2 px-2 text-slate-600 font-medium">Docs</th>
                  <th className="text-right py-2 px-2 text-slate-600 font-medium">Analyses</th>
                  <th className="text-right py-2 px-2 text-slate-600 font-medium">Score moy.</th>
                  <th className="text-right py-2 px-2 text-slate-600 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.sort((a, b) => b.metrics.avgScore - a.metrics.avgScore).map((faculty) => (
                  <tr key={faculty.facultyId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 font-medium text-slate-800">{faculty.faculty}</td>
                    <td className="text-right py-2 px-2 text-slate-600">{faculty.metrics.totalDocuments}</td>
                    <td className="text-right py-2 px-2 text-slate-600">{faculty.metrics.completedAnalyses}</td>
                    <td className={`text-right py-2 px-2 font-semibold ${
                      faculty.metrics.avgScore > 25 ? 'text-rose-600' :
                      faculty.metrics.avgScore > 15 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {faculty.metrics.avgScore.toFixed(1)}%
                    </td>
                    <td className="text-right py-2 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        faculty.metrics.avgScore > 25 ? 'bg-rose-100 text-rose-700' :
                        faculty.metrics.avgScore > 15 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {faculty.metrics.avgScore > 25 ? 'Critique' :
                         faculty.metrics.avgScore > 15 ? 'Attention' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FacultyComparisonChart;
