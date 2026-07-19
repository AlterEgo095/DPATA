'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Users, FileText, FlaskConical, ShieldCheck,
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Cpu, Database, Activity
} from 'lucide-react';
import Link from 'next/link';

// Dashboard components
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { SystemHealth } from '@/components/dashboard/system-health';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { EngineStatus } from '@/components/dashboard/engine-status';

interface Stats {
  faculties: number;
  departments: number;
  promotions: number;
  users: number;
  students: number;
  teachers: number;
  admins: number;
  documents: number;
  analyses: number;
  pendingAnalyses: number;
  completedAnalyses: number;
  avgScore: number | null;
  recentAudit: any[];
  documentsByFaculty: { faculty: string; count: number }[];
  subjects?: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats) return <div>Erreur de chargement</div>;

  // System health state
  const systemHealthy = stats.pendingAnalyses === 0;
  
  // Average score calculations
  const avgScorePct = stats.avgScore !== null ? stats.avgScore * 100 : 0;
  const avgScoreColor = avgScorePct > 30 ? 'text-rose-600' : avgScorePct > 15 ? 'text-amber-600' : 'text-emerald-600';
  const avgScoreProgressColor = avgScorePct > 30 ? 'bg-rose-500' : avgScorePct > 15 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vue d&apos;ensemble de la plateforme PlagiatIA — Université de Kinshasa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/audit">
              <Activity className="h-4 w-4 mr-1.5" />
              Journal d&apos;activité
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/dashboard/faculties">
              <Building2 className="h-4 w-4 mr-1.5" />
              Gérer les facultés
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview - New Component */}
      <StatsOverview stats={{ ...stats, recentActivity: stats.recentAudit }} />

      {/* System Health Monitor - New Component */}
      <SystemHealth
        isHealthy={systemHealthy}
        pendingAnalyses={stats.pendingAnalyses}
        completedAnalyses={stats.completedAnalyses}
        documents={stats.documents}
        users={stats.users}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Engine Status Panel - New Enhanced Component */}
          <EngineStatus
            modelVersion="TF-IDF v2.0"
            threshold={15}
            totalAnalyses={stats.completedAnalyses}
            avgProcessingTime={120}
            corpusSize={stats.subjects || stats.documents || 49}
          />

          {/* Documents by Faculty Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600" />
                Répartition des travaux par faculté
              </CardTitle>
              <CardDescription>Volume documentaire supervisé</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.documentsByFaculty.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Aucun document déposé pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.documentsByFaculty.map(item => {
                    const max = Math.max(...stats.documentsByFaculty.map(d => d.count), 1);
                    const pct = (item.count / max) * 100;
                    return (
                      <div key={item.faculty}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">{item.faculty}</span>
                          <span className="text-slate-500">{item.count} travaux</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          {/* Average Similarity Score */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                Score moyen de similarité
              </CardTitle>
              <CardDescription>Indicateur global de plagiat détecté</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.avgScore === null ? (
                <div className="text-center py-6">
                  <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm text-slate-500">Aucune analyse disponible</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center py-2">
                    <div className={`text-4xl font-bold ${avgScoreColor}`}>
                      {avgScorePct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Moyenne sur {stats.completedAnalyses} analyses
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${avgScoreProgressColor} rounded-full transition-all`}
                      style={{ width: `${Math.min(avgScorePct, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 text-center">
                    {avgScorePct > 30 
                      ? '⚠️ Plagiat fréquent détecté' 
                      : avgScorePct > 15 
                        ? 'Similarités modérées' 
                        : '✓ Travaux majoritairement originaux'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Real-time Activity Feed - New Component */}
          <ActivityFeed activities={stats.recentAudit} maxItems={10} showViewAll={true} />
        </div>
      </div>

      {/* Admin Supervision Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            Supervision administrative
          </CardTitle>
          <CardDescription>Accès rapide aux modules de gestion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/dashboard/faculties" className="group">
              <div className="rounded-lg border border-slate-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/50 transition">
                <Building2 className="h-5 w-5 text-emerald-600 mb-2" />
                <div className="text-sm font-medium text-slate-900">Facultés</div>
                <div className="text-xs text-slate-500">{stats.faculties} module(s)</div>
              </div>
            </Link>
            <Link href="/dashboard/users" className="group">
              <div className="rounded-lg border border-slate-200 p-3 hover:border-purple-300 hover:bg-purple-50/50 transition">
                <Users className="h-5 w-5 text-purple-600 mb-2" />
                <div className="text-sm font-medium text-slate-900">Utilisateurs</div>
                <div className="text-xs text-slate-500">{stats.users} compte(s)</div>
              </div>
            </Link>
            <Link href="/dashboard/documents" className="group">
              <div className="rounded-lg border border-slate-200 p-3 hover:border-amber-300 hover:bg-amber-50/50 transition">
                <FileText className="h-5 w-5 text-amber-600 mb-2" />
                <div className="text-sm font-medium text-slate-900">Documents</div>
                <div className="text-xs text-slate-500">{stats.documents} travail(s)</div>
              </div>
            </Link>
            <Link href="/dashboard/analyses" className="group">
              <div className="rounded-lg border border-slate-200 p-3 hover:border-teal-300 hover:bg-teal-50/50 transition">
                <FlaskConical className="h-5 w-5 text-teal-600 mb-2" />
                <div className="text-sm font-medium text-slate-900">Analyses</div>
                <div className="text-xs text-slate-500">{stats.completedAnalyses} terminée(s)</div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
