'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2, Network, Users, FileText, FlaskConical, ShieldCheck,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, ArrowRight,
  Cpu, Database, Activity, Copy, FileWarning, Languages, RefreshCw,
  ChevronRight, FileCheck
} from 'lucide-react';
import Link from 'next/link';

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
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats) return <div>Erreur de chargement</div>;

  const kpis = [
    { label: 'Facultés', value: stats.faculties, icon: Building2, color: 'text-emerald-600 bg-emerald-50', href: '/dashboard/faculties' },
    { label: 'Départements', value: stats.departments, icon: Network, color: 'text-blue-600 bg-blue-50', href: '/dashboard/departments' },
    { label: 'Utilisateurs', value: stats.users, icon: Users, color: 'text-purple-600 bg-purple-50', href: '/dashboard/users' },
    { label: 'Travaux déposés', value: stats.documents, icon: FileText, color: 'text-amber-600 bg-amber-50', href: '/dashboard/documents' },
    { label: 'Analyses IA', value: stats.analyses, icon: FlaskConical, color: 'text-teal-600 bg-teal-50', href: '/dashboard/analyses' },
    { label: 'En attente', value: stats.pendingAnalyses, icon: Clock, color: 'text-rose-600 bg-rose-50', href: '/dashboard/analyses' },
  ];

  // État du système
  const systemHealthy = stats.pendingAnalyses === 0;
  const avgScorePct = stats.avgScore !== null ? stats.avgScore * 100 : 0;
  const avgScoreColor = avgScorePct > 30 ? 'text-rose-600' : avgScorePct > 15 ? 'text-amber-600' : 'text-emerald-600';
  const avgScoreProgressColor = avgScorePct > 30 ? 'bg-rose-500' : avgScorePct > 15 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vue d'ensemble de la plateforme PlagiatIA — Université de Kinshasa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/audit">
              <Activity className="h-4 w-4 mr-1.5" />
              Journal d'activité
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} href={kpi.href}>
              <Card className="hover:shadow-md transition cursor-pointer border-slate-200 group">
                <CardContent className="p-4">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${kpi.color} group-hover:scale-110 transition`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* État global du système */}
      <Card className={systemHealthy ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {systemHealthy ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              )}
              <div>
                <div className={`font-semibold ${systemHealthy ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {systemHealthy ? 'Système opérationnel' : `${stats.pendingAnalyses} analyse(s) en attente`}
                </div>
                <div className="text-xs text-slate-500">
                  {stats.completedAnalyses} analyses terminées · {stats.documents} documents · {stats.users} utilisateurs actifs
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <div className="font-bold text-slate-900">{stats.faculties}</div>
                <div className="text-slate-500">facultés</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-900">{stats.departments}</div>
                <div className="text-slate-500">départements</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-900">{stats.promotions}</div>
                <div className="text-slate-500">promotions</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deux colonnes principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* État du moteur IA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-600" />
                État du moteur IA
              </CardTitle>
              <CardDescription>Indicateurs du pipeline de détection automatique</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Modèle</div>
                  <div className="text-xs font-semibold text-slate-900 truncate">TF-IDF</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">cosinus + Jaccard</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Seuil</div>
                  <div className="text-xs font-semibold text-slate-900">0.15</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">similarité min</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Classification</div>
                  <div className="text-xs font-semibold text-slate-900">5 types</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">copy, paraphrase...</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Périmètre</div>
                  <div className="text-xs font-semibold text-slate-900">Faculté</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">scope par défaut</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-900">Moteur IA opérationnel</span>
                </div>
                <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-700">
                  {stats.completedAnalyses} analyses terminées
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Documents par faculté */}
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

        {/* Colonne droite (1/3) */}
        <div className="space-y-6">
          {/* Score moyen */}
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
                      style={{ width: `${avgScorePct}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 text-center">
                    {avgScorePct > 30 ? '⚠️ Plagiat fréquent détecté' : avgScorePct > 15 ? 'Similarités modérées' : '✓ Travaux majoritairement originaux'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activité récente */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  Activité récente
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/audit" className="text-xs">Tout voir <ChevronRight className="h-3 w-3" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats.recentAudit.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500">
                  Aucune activité récente.
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-2">
                  <div className="space-y-3">
                    {stats.recentAudit.slice(0, 12).map((log: any) => {
                      const actionType = log.action.split('_')[0];
                      const colorClass = actionType === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                                        actionType === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                        actionType === 'DELETE' ? 'bg-rose-100 text-rose-700' :
                                        'bg-slate-100 text-slate-700';
                      return (
                        <div key={log.id} className="flex items-start gap-2 text-xs">
                          <div className={`h-7 w-7 rounded-full ${colorClass} flex items-center justify-center shrink-0 mt-0.5`}>
                            <ShieldCheck className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {log.action.replace(/_/g, ' ').toLowerCase()}
                            </div>
                            <div className="text-slate-500">
                              {log.userName || 'Système'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Raccourcis supervision admin */}
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
