'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, Flame, Activity } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface ActivityEvent {
  id: string;
  timestamp: Date | string;
  type: 'upload' | 'analysis' | 'validation' | 'alert' | 'login' | 'other';
  description: string;
  user?: string;
  faculty?: string;
}

export interface HeatmapDataPoint {
  day: number; // 0-6 (Dim-Sam)
  hour: number; // 0-23
  count: number;
}

export interface TimelineDataPoint {
  date: string;
  label: string;
  uploads: number;
  analyses: number;
  validations: number;
  total: number;
}

type ViewMode = 'timeline' | 'heatmap';

interface ActivityTimelineProps {
  timelineData?: TimelineDataPoint[];
  heatmapData?: HeatmapDataPoint[];
  recentEvents?: ActivityEvent[];
  title?: string;
  description?: string;
  defaultView?: ViewMode;
  height?: number;
  className?: string;
}

// ============================================================
// Configuration
// ============================================================

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const EVENT_COLORS = {
  upload: '#22c55e',
  analysis: '#3b82f6',
  validation: '#8b5cf6',
  alert: '#ef4444',
  login: '#f59e0b',
  other: '#64748b',
};

const EVENT_ICONS: Record<string, string> = {
  upload: '📄',
  analysis: '🔍',
  validation: '✅',
  alert: '⚠️',
  login: '👤',
  other: '📌',
};

const chartConfig = {
  total: { label: 'Total', color: 'hsl(var(--chart-1))' },
  uploads: { label: 'Envois', color: '#22c55e' },
  analyses: { label: 'Analyses', color: '#3b82f6' },
  validations: { label: 'Validations', color: '#8b5cf6' },
};

// ============================================================
// Composant Principal
// ============================================================

export function ActivityTimeline({
  timelineData = [],
  heatmapData,
  recentEvents = [],
  title = "Activité de la Plateforme",
  description = "Vue d'ensemble de l'utilisation en temps réel",
  defaultView = 'timeline',
  height = 300,
  className,
}: ActivityTimelineProps) {
  
  const [view, setView] = useState<ViewMode>(defaultView);
  
  // Générer des données de démo si non fournies
  const processedTimelineData = useMemo(() => {
    if (timelineData.length > 0) return timelineData;
    return generateDemoTimelineData(30);
  }, [timelineData]);
  
  const processedHeatmapData = useMemo(() => {
    if (heatmapData && heatmapData.length > 0) return heatmapData;
    return generateDemoHeatmapData();
  }, [heatmapData]);
  
  // Calculer les stats d'activité
  const activityStats = useMemo(() => {
    const totalEvents = processedTimelineData.reduce((sum, d) => sum + d.total, 0);
    const avgDaily = processedTimelineData.length > 0 
      ? totalEvents / processedTimelineData.length 
      : 0;
    const peakDay = processedTimelineData.reduce((max, d) => 
      d.total > max.total ? d : max, 
      processedTimelineData[0] || { date: '', label: '', total: 0 }
    );
    
    // Trouver l'heure la plus active dans le heatmap
    let peakHour = 0;
    let maxHourCount = 0;
    for (let h = 0; h < 24; h++) {
      const hourTotal = processedHeatmapData
        .filter(d => d.hour === h)
        .reduce((sum, d) => sum + d.count, 0);
      if (hourTotal > maxHourCount) {
        maxHourCount = hourTotal;
        peakHour = h;
      }
    }
    
    return {
      totalEvents,
      avgDaily: Math.round(avgDaily),
      peakDay: peakDay.label || '-',
      peakHour: `${peakHour}h-${peakHour + 1}h`,
    };
  }, [processedTimelineData, processedHeatmapData]);
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-600" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
            
            {/* Stats rapides */}
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-slate-500">Total:</span>
                <span className="font-semibold text-slate-700">{activityStats.totalEvents}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-slate-500">Moy./jour:</span>
                <span className="font-semibold text-slate-700">{activityStats.avgDaily}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-500" />
                <span className="text-slate-500">Pic:</span>
                <span className="font-semibold text-slate-700">{activityStats.peakDay}</span>
              </div>
            </div>
          </div>
          
          {/* Sélecteur de vue */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <Button
              variant={view === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('timeline')}
              className="h-7 px-2 text-xs"
            >
              Timeline
            </Button>
            <Button
              variant={view === 'heatmap' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('heatmap')}
              className="h-7 px-2 text-xs"
            >
              Heatmap
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ChartContainer config={chartConfig} className={`h-[${height}px] w-full`}>
          <ResponsiveContainer width="100%" height={height}>
            {view === 'timeline' ? (
              <BarChart data={processedTimelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" vertical={false} />
                
                <XAxis 
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                
                <Tooltip content={<ChartTooltipContent />} />
                
                {/* Stacked bars pour montrer les différents types d'activité */}
                <Bar dataKey="uploads" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} maxBarSize={40}>
                  {processedTimelineData.map((entry, index) => (
                    <Cell key={`uploads-${index}`} fill="#22c55e" opacity={0.85} />
                  ))}
                </Bar>
                <Bar dataKey="analyses" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]}>
                  {processedTimelineData.map((entry, index) => (
                    <Cell key={`analyses-${index}`} fill="#3b82f6" opacity={0.85} />
                  ))}
                </Bar>
                <Bar dataKey="validations" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                  {processedTimelineData.map((entry, index) => (
                    <Cell key={`validations-${index}`} fill="#8b5cf6" opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              // Vue Heatmap
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${HOURS.length}, 1fr)` }}>
                  {/* En-tête des heures */}
                  {HOURS.filter(h => h % 3 === 0).map(h => (
                    <div key={`h-${h}`} className="text-[9px] text-slate-400 text-center col-span-3">
                      {h}h
                    </div>
                  ))}
                  
                  {/* Lignes jour/heure */}
                  {DAYS.map((day, dayIndex) => (
                    <React.Fragment key={day}>
                      <div className="text-[10px] text-slate-500 text-right pr-2 self-center row-span-1 -ml-14">
                        {day}
                      </div>
                      {HOURS.map(hour => {
                        const dataPoint = processedHeatmapData.find(
                          d => d.day === dayIndex && d.hour === hour
                        );
                        const count = dataPoint?.count || 0;
                        const intensity = Math.min(count / 10, 1); // Normaliser sur max ~10
                        
                        return (
                          <div
                            key={`${dayIndex}-${hour}`}
                            className="w-5 h-5 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-orange-400"
                            style={{
                              backgroundColor: getHeatmapColor(intensity),
                              title: `${day} ${hour}h: ${count} activités`,
                            }}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
                
                {/* Légende */}
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                  <span>Moins</span>
                  <div className="flex gap-0.5">
                    {[0, 0.25, 0.5, 0.75, 1].map(level => (
                      <div
                        key={level}
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: getHeatmapColor(level) }}
                      />
                    ))}
                  </div>
                  <span>Plus</span>
                </div>
              </div>
            )}
          </ResponsiveContainer>
        </ChartContainer>
        
        {/* Événements récents si disponibles */}
        {recentEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              Événements récents
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {recentEvents.slice(0, 5).map(event => (
                <div 
                  key={event.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="text-base">{EVENT_ICONS[event.type] || EVENT_ICONS.other}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{event.description}</p>
                    <p className="text-xs text-slate-400">
                      {formatEventTime(event.timestamp)}
                      {event.user && ` · ${event.user}`}
                    </p>
                  </div>
                  <div 
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: EVENT_COLORS[event.type] || EVENT_COLORS.other }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Fonctions Utilitaires
// ============================================================

function getHeatmapColor(intensity: number): string {
  if (intensity === 0) return '#f1f5f9'; // Très clair (vide)
  if (intensity <= 0.25) return '#fed7aa'; // Orange très clair
  if (intensity <= 0.5) return '#fb923c'; // Orange moyen
  if (intensity <= 0.75) return '#f97316'; // Orange foncé
  return '#ea580c'; // Orange très foncé
}

function formatEventTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function generateDemoTimelineData(days: number): TimelineDataPoint[] {
  const data: TimelineDataPoint[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Simuler une activité avec plus d'activité en semaine
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseActivity = isWeekend ? 3 : 8;
    
    const uploads = Math.max(0, Math.round(baseActivity * (0.5 + Math.random())));
    const analyses = Math.max(0, Math.round(baseActivity * (0.8 + Math.random() * 0.5)));
    const validations = Math.max(0, Math.round(baseActivity * 0.3 * Math.random()));
    
    data.push({
      date: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      uploads,
      analyses,
      validations,
      total: uploads + analyses + validations,
    });
  }
  
  return data;
}

function generateDemoHeatmapData(): HeatmapDataPoint[] {
  const data: HeatmapDataPoint[] = [];
  
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Simuler un pattern: plus d'activité en semaine, pendant les heures ouvrées
      const isWeekend = day === 0 || day === 6;
      const isWorkHours = hour >= 8 && hour <= 18;
      const isPeakHour = hour >= 10 && hour <= 15;
      
      let baseCount = isWeekend ? 1 : (isWorkHours ? 5 : 2);
      if (isPeakHour && !isWeekend) baseCount *= 1.5;
      
      // Ajouter de l'aléatoire
      const count = Math.max(0, Math.round(baseCount * (0.5 + Math.random())));
      
      data.push({ day, hour, count });
    }
  }
  
  return data;
}

export default ActivityTimeline;
