'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Network, Users, FileText, FlaskConical, ShieldCheck,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, ArrowRight,
  Cpu, Database, Activity
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  faculties: number;
  departments: number;
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
              <Card className="hover:shadow-md transition cursor-pointer border-slate-200">
                <CardContent className="p-4">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${kpi.color}`}>
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
                  <div className="text-xs font-semibold text-slate-900 truncate">Sentence-BERT</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">distiluse multilingual</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Seuil</div>
                  <div className="text-xs font-semibold text-slate-900">0.80</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">cosinus threshold</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Dimensions</div>
                  <div className="text-xs font-semibold text-slate-900">512</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">vector size</div>
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
                  <span className="text-sm font-medium text-emerald-900">Système opérationnel</span>
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
            </CardHeader>
            <CardContent>
              {stats.avgScore === null ? (
                <div className="text-center py-6">
                  <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm text-slate-500">Aucune analyse disponible</div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className={`text-4xl font-bold ${stats.avgScore > 0.3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {(stats.avgScore * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Moyenne sur {stats.completedAnalyses} analyses
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activité récente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-600" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentAudit.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500">
                  Aucune activité récente.
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {stats.recentAudit.slice(0, 8).map((log: any) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="h-3 w-3 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900">{log.action.replace(/_/g, ' ')}</div>
                        <div className="text-slate-500">
                          {log.userName || 'Système'} · {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
