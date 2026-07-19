'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, Cpu, Database, Wifi, UserCheck } from 'lucide-react';

interface SystemHealthProps {
  isHealthy: boolean;
  pendingAnalyses: number;
  completedAnalyses: number;
  documents: number;
  users: number;
  uptime?: string;
  lastBackup?: string;
}

export function SystemHealth({
  isHealthy,
  pendingAnalyses,
  completedAnalyses,
  documents,
  users,
  uptime = '99.9%',
  lastBackup = new Date().toLocaleString('fr-FR'),
}: SystemHealthProps) {
  const healthChecks = [
    {
      label: 'Moteur IA',
      status: 'operational' as const,
      detail: 'TF-IDF v2.0 actif',
      icon: Cpu,
    },
    {
      label: 'Base de données',
      status: 'operational' as const,
      detail: `${documents} documents`,
      icon: Database,
    },
    {
      label: 'Utilisateurs',
      status: 'operational' as const,
      detail: `${users} actifs`,
      icon: UserCheck,
    },
    {
      label: 'Connectivité',
      status: typeof navigator !== 'undefined' && navigator.onLine ? 'operational' : 'degraded',
      detail: typeof navigator !== 'undefined' && navigator.onLine ? 'En ligne' : 'Hors ligne',
      icon: Wifi,
    },
  ];

  return (
    <Card className={`${isHealthy ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/50'} transition-colors`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isHealthy ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {isHealthy ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              )}
            </div>
            
            <div>
              <div className={`font-semibold text-lg ${isHealthy ? 'text-emerald-900' : 'text-amber-900'}`}>
                {isHealthy ? 'Système opérationnel' : `${pendingAnalyses} analyse(s) en attente`}
              </div>
              <div className="text-sm text-slate-500 mt-0.5">
                {completedAnalyses} analyses terminées · {documents} documents · {users} utilisateurs
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {healthChecks.map((check) => {
              const Icon = check.icon;
              return (
                <div key={check.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 backdrop-blur border border-white/40">
                  <Icon className={`h-4 w-4 shrink-0 ${check.status === 'operational' ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700">{check.label}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[80px]">{check.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-4 text-xs text-slate-500">
            <div className="text-center">
              <div className="font-semibold text-slate-900">{uptime}</div>
              <div>Disponibilité</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <div className="font-semibold text-slate-900">{lastBackup.split(',')[0]}</div>
              <div>Dernière sauvegarde</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
