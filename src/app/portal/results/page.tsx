'use client';

// Portal Results Page - Vue statistique des résultats
// Graphiques et métriques personnelles

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle,
  BookOpen, Target, Calendar, Award, PieChart, Activity
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface StatsData {
  totalValidations: number;
  validatedCount: number;
  alternativesCount: number;
  rejectedCount: number;
  avgSimilarity: number;
  topDomains: Array<{ domain: string; count: number }>;
  recentActivity: Array<{ date: string; title: string; status: string }>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export default function PortalResultsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      // Charger les validations
      const res = await fetch('/api/subjects/validate');
      if (res.ok) {
        const data = await res.json();
        const validations = Array.isArray(data) ? data : (data.validation ? [data.validation] : []);
        
        // Calculer les stats
        const totalValidations = validations.length;
        const validatedCount = validations.filter((v: any) => v.status === 'VALIDATED').length;
        const alternativesCount = validations.filter((v: any) => v.status === 'ALTERNATIVES_GENERATED').length;
        const rejectedCount = validations.filter((v: any) => v.status === 'REJECTED').length;
        
        // Similarité moyenne
        const similarities = validations.map((v: any) => v.similarityScore || 0);
        const avgSimilarity = similarities.length > 0 
          ? similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length 
          : 0;

        // Top domaines
        const domainCounts: Record<string, number> = {};
        validations.forEach((v: any) => {
          if (v.submittedDomain) {
            domainCounts[v.submittedDomain] = (domainCounts[v.submittedDomain] || 0) + 1;
          }
        });
        const topDomains = Object.entries(domainCounts)
          .map(([domain, count]) => ({ domain, count }))
          .sort((a, b) => b.count - a.count)
          .slice(5);

        // Activité récente
        const recentActivity = validations.slice(0, 10).map((v: any) => ({
          date: v.createdAt,
          title: v.submittedTitle,
          status: v.status,
        }));

        // Tendances mensuelles (simulation basée sur les données)
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'];
        const monthlyTrend = monthNames.map(month => ({
          month,
          count: Math.floor(Math.random() * 5), // À remplacer avec vraies données
        }));

        setStats({
          totalValidations,
          validatedCount,
          alternativesCount,
          rejectedCount,
          avgSimilarity,
          topDomains,
          recentActivity,
          monthlyTrend,
        });
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-10 bg-slate-100 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const validationRate = stats && stats.totalValidations > 0 
    ? (stats.validatedCount / stats.totalValidations * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-orange-600" />
          Mes résultats
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Statistiques et analyses de vos validations
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats?.totalValidations || 0}</p>
                <p className="text-xs text-slate-500">Total validations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{stats?.validatedCount || 0}</p>
                <p className="text-xs text-slate-500">Sujets validés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-600">{stats?.alternativesCount || 0}</p>
                <p className="text-xs text-slate-500">Alternatives générées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats ? (stats.avgSimilarity * 100).toFixed(0) : 0}%</p>
                <p className="text-xs text-slate-500">Similarité moyenne</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Validation Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Taux de réussite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative h-40 flex items-center justify-center">
                <svg className="h-36 w-36 -rotate-90">
                  <circle cx="72" cy="72" r="60" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                  <circle 
                    cx="72" cy="72" r="60" fill="none" stroke="#22c55e" strokeWidth="12"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    strokeDashoffset={`${2 * Math.PI * 60 * (1 - validationRate / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-3xl font-bold">{validationRate.toFixed(0)}%</p>
                  <p className="text-xs text-slate-500">Validés</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Validés
                  </span>
                  <span className="font-medium">{stats?.validatedCount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Alternatives
                  </span>
                  <span className="font-medium">{stats?.alternativesCount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600 flex items-center gap-1">
                    <TrendingDown className="h-4 w-4" /> Rejetés
                  </span>
                  <span className="font-medium">{stats?.rejectedCount || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Domains */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-5 w-5 text-indigo-500" />
              Domaines étudiés
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topDomains && stats.topDomains.length > 0 ? (
              <div className="space-y-3">
                {stats.topDomains.map((d, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate mr-2">{d.domain}</span>
                      <span className="font-medium shrink-0">{d.count}</span>
                    </div>
                    <Progress value={(d.count / (stats.totalValidations || 1)) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <PieChart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-500" />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {stats.recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`h-2 w-2 mt-2 rounded-full shrink-0 ${
                      activity.status === 'VALIDATED' ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{activity.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(activity.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune activité récente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-0">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <TrendingUp className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-semibold text-slate-900">Continuez à valider vos sujets !</h3>
            <p className="text-sm text-slate-600 mt-1">
              Plus vous validez, plus vous aurez de données pour suivre votre progression académique.
            </p>
          </div>
          <Link href="/portal/submit">
            <Button className="gap-2 shrink-0">
              Nouvelle validation
              <TrendingUp className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
