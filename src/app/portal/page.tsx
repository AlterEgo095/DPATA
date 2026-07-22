'use client';

// Portal Dashboard - Tableau de bord personnel utilisateur
// Vue simplifiée centrée sur les actions rapides et le suivi

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles, FileText, FolderOpen, BarChart3, ArrowRight,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Zap,
  BookOpen, Lightbulb, Upload, History, Star
} from 'lucide-react';

interface UserStats {
  totalSubjects: number;
  validatedSubjects: number;
  pendingSubjects: number;
  rejectedSubjects: number;
  totalDocuments: number;
  totalAnalyses: number;
  recentValidations: any[];
}

export default function PortalDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger les statistiques personnelles
    Promise.all([
      fetch('/api/subjects/validate').catch(() => null),
      fetch('/api/documents').catch(() => null),
    ]).then(([valRes, docRes]) => {
      const validations = valRes?.ok ? awaitSafeJson(valRes) : [];
      const documents = docRes?.ok ? awaitSafeJson(docRes) : { documents: [] };
      
      // Filtrer par utilisateur (côté client pour l'instant)
      const userValidations = Array.isArray(validations) ? validations : [];
      const userDocs = documents?.documents || [];
      
      setStats({
        totalSubjects: userValidations.length,
        validatedSubjects: userValidations.filter((v: any) => v.status === 'VALIDATED').length,
        pendingSubjects: userValidations.filter((v: any) => v.status === 'PENDING').length,
        rejectedSubjects: userValidations.filter((v: any) => v.status === 'REJECTED').length,
        totalDocuments: userDocs.length,
        totalAnalyses: 0, // À implémenter avec API filtrée
        recentValidations: userValidations.slice(0, 5),
      });
    }).finally(() => setLoading(false));
  }, []);

  async function awaitSafeJson(res: Response) {
    try {
      return await res.json();
    } catch {
      return [];
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  const validationRate = stats && stats.totalSubjects > 0 
    ? (stats.validatedSubjects / stats.totalSubjects * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Bienvenue sur votre espace ! 👋
          </h1>
          <p className="text-emerald-100 max-w-lg">
            Validez vos sujets de mémoire, vérifiez leur originalité et suivez vos travaux académiques.
          </p>
          
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/portal/submit">
              <Button size="lg" className="gap-2 bg-white text-emerald-600 hover:bg-emerald-50 shadow-lg">
                <Sparkles className="h-5 w-5" />
                Nouvelle validation
              </Button>
            </Link>
            <Link href="/portal/my-work">
              <Button size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10">
                <FolderOpen className="h-5 w-5" />
                Mes travaux
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-600">
                {stats?.totalSubjects || 0}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-slate-900">Sujets soumis</p>
            <p className="text-xs text-slate-500 mt-1">Total de validations</p>
          </CardContent>
        </Card>

        <Card className="border-green-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <Badge variant="secondary" className="bg-green-50 text-green-600">
                {stats?.validatedSubjects || 0}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-slate-900">Validés ✅</p>
            <p className="text-xs text-slate-500 mt-1">Sujets originaux</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <Badge variant="secondary" className="bg-amber-50 text-amber-600">
                {stats?.pendingSubjects || 0}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-slate-900">En attente</p>
            <p className="text-xs text-slate-500 mt-1">En cours d'analyse</p>
          </CardContent>
        </Card>

        <Card className="border-blue-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <Badge variant="secondary" className="bg-blue-50 text-blue-600">
                {stats?.totalDocuments || 0}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-slate-900">Documents</p>
            <p className="text-xs text-slate-500 mt-1">Fichiers uploadés</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/portal/submit">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3 px-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Valider un sujet</p>
                  <p className="text-xs text-slate-500">Vérifier l&apos;originalité</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-slate-400" />
              </Button>
            </Link>

            <Link href="/portal/my-work">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3 px-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                  <FolderOpen className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Mes travaux</p>
                  <p className="text-xs text-slate-500">Voir mon historique</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-slate-400" />
              </Button>
            </Link>

            <Link href="/dashboard/documents">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3 px-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Uploader un document</p>
                  <p className="text-xs text-slate-500">Analyser le plagiat</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-slate-400" />
              </Button>
            </Link>

            <Link href="/portal/results">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3 px-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Résultats</p>
                  <p className="text-xs text-slate-500">Statistiques détaillées</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-slate-400" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity & Progress */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Activité récente
            </CardTitle>
            <Link href="/portal/my-work">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Voir tout
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.recentValidations && stats.recentValidations.length > 0 ? (
              <div className="space-y-3">
                {stats.recentValidations.map((v: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      v.isOriginal ? 'bg-green-100' : 'bg-amber-100'
                    }`}>
                      {v.isOriginal ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{v.submittedTitle || 'Sujet sans titre'}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(v.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <Badge 
                      variant="secondary"
                      className={v.isOriginal ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}
                    >
                      {v.isOriginal ? 'Original' : `${(v.similarityScore * 100).toFixed(0)}% sim.`}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Lightbulb className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <h3 className="font-medium text-slate-900 mb-1">Aucune activité récente</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Commencez par valider votre premier sujet !
                </p>
                <Link href="/portal/submit">
                  <Button className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Valider un sujet
                  </Button>
                </Link>
              </div>
            )}

            {/* Progress Overview */}
            {stats && stats.totalSubjects > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Taux de validation</span>
                  <span className="text-sm font-bold text-emerald-600">{validationRate.toFixed(0)}%</span>
                </div>
                <Progress value={validationRate} className="h-2" />
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>{stats.validatedSubjects} validés</span>
                  <span>{stats.totalSubjects} totaux</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <Star className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">💡 Conseil du jour</h3>
              <p className="text-sm text-slate-600">
                Plus votre sujet est spécifique et bien détaillé (description, objectifs, problématique), 
                plus notre IA pourra vous donner une analyse précise et des alternatives pertinentes. 
                N&apos;hésitez pas à ajouter des mots-clés !
              </p>
            </div>
            <Link href="/portal/submit">
              <Button variant="outline" size="sm" className="shrink-0 gap-1">
                Essayer
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
