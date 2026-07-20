'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Cpu, Zap, Target, Layers, CheckCircle2, Settings } from 'lucide-react';

interface EngineStatusProps {
  modelVersion?: string;
  threshold?: number;
  totalAnalyses?: number;
  avgProcessingTime?: number;
  corpusSize?: number;
}

export function EngineStatus({
  modelVersion = 'TF-IDF v2.0',
  threshold = 15,
  totalAnalyses = 0,
  avgProcessingTime = 120,
  corpusSize = 49,
}: EngineStatusProps) {
  const engineMetrics = [
    {
      label: 'Modèle',
      value: modelVersion,
      sublabel: 'TF-IDF + Cosinus + Jaccard',
      icon: Cpu,
    },
    {
      label: 'Seuil de détection',
      value: `${threshold}%`,
      sublabel: 'similarité minimale',
      icon: Target,
    },
    {
      label: 'Classification',
      value: '5 types',
      sublabel: 'copy → weak match',
      icon: Layers,
    },
    {
      label: 'Performances',
      value: `${avgProcessingTime}ms`,
      sublabel: "temps moyen d'analyse",
      icon: Zap,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-600" />
              Moteur d&apos;analyse IA
            </CardTitle>
            <CardDescription className="mt-1">Pipeline de détection automatique du plagiat</CardDescription>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Opérationnel
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {engineMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="rounded-lg border border-slate-200 p-3 hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    {metric.label}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{metric.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{metric.sublabel}</div>
              </div>
            );
          })}
        </div>

        {/* Performance bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Capacité du corpus</span>
            <span className="font-medium text-slate-700">{corpusSize} sujets indexés</span>
          </div>
          <Progress value={Math.min(corpusSize * 2, 100)} className="h-2" />
        </div>

        {/* Engine info */}
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Settings className="h-3 w-3" />
            <span>{totalAnalyses} analyses réalisées</span>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            v2.0.0
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
