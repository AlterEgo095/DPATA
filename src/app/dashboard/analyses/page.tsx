'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FlaskConical, Loader2, Clock, CheckCircle2, AlertCircle, FileText,
  Copy, FileWarning, Languages, RefreshCw, Cpu, Activity, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface AnalysisItem {
  id: string;
  documentId: string;
  documentTitle: string;
  documentStatus: string;
  author: string;
  faculty: string;
  status: string;
  globalScore: number;
  matchedSegments: number;
  totalSegments: number;
  byType?: Record<string, number>;
  completedAt: string;
  createdAt: string;
}

const MATCH_TYPES = {
  COPY_PASTE: { label: 'Copier-coller', icon: Copy, color: 'text-rose-600 bg-rose-50' },
  PARAPHRASE: { label: 'Paraphrase', icon: FileWarning, color: 'text-orange-600 bg-orange-50' },
  REFORMULATION: { label: 'Reformulation', icon: RefreshCw, color: 'text-amber-600 bg-amber-50' },
  TRANSLATION: { label: 'Traduction', icon: Languages, color: 'text-blue-600 bg-blue-50' },
  WEAK_MATCH: { label: 'Similarité faible', icon: FileText, color: 'text-slate-600 bg-slate-50' },
};

function getScoreColor(score: number): string {
  if (score >= 0.5) return 'text-rose-600';
  if (score >= 0.3) return 'text-orange-600';
  if (score >= 0.15) return 'text-amber-600';
  return 'text-emerald-600';
}

function getScoreLabel(score: number): string {
  if (score >= 0.5) return 'Plagiat probable';
  if (score >= 0.3) return 'Similarité élevée';
  if (score >= 0.15) return 'Similarité modérée';
  return 'Faible similarité';
}

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        const docs = data.documents || [];
        // Filtrer uniquement les documents qui ont une analyse
        const analyzed = docs.filter((d: any) => d.analysis).map((d: any) => ({
          id: d.analysis.id,
          documentId: d.id,
          documentTitle: d.title,
          documentStatus: d.status,
          author: d.uploadedBy ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}` : '—',
          faculty: d.faculty || '—',
          status: d.analysis.status,
          globalScore: d.analysis.globalScore || 0,
          matchedSegments: d.analysis.matchedSegments || 0,
          totalSegments: d.analysis.totalSegments || 0,
          completedAt: d.analysis.completedAt || d.createdAt,
          createdAt: d.createdAt,
        }));
        // Trier par date de complétion décroissante
        analyzed.sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
        setAnalyses(analyzed);
      })
      .finally(() => setLoading(false));
  }, []);

  // Statistiques globales
  const totalAnalyses = analyses.length;
  const avgScore = totalAnalyses > 0 ? analyses.reduce((s, a) => s + a.globalScore, 0) / totalAnalyses : 0;
  const highRisk = analyses.filter(a => a.globalScore >= 0.3).length;
  const clean = analyses.filter(a => a.globalScore < 0.15).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-purple-600" /> Analyses IA
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Supervision des analyses du moteur de détection automatique du plagiat
        </p>
      </div>

      {/* KPIs supervision */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <FlaskConical className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold">{totalAnalyses}</div>
            <div className="text-xs text-slate-500">Analyses terminées</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-600">{highRisk}</div>
            <div className="text-xs text-slate-500">Risque élevé (≥30%)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">{clean}</div>
            <div className="text-xs text-slate-500">Travaux originaux (&lt;15%)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Activity className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>
              {(avgScore * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">Score moyen</div>
          </CardContent>
        </Card>
      </div>

      {/* État du moteur IA */}
      <Card className="border-purple-100">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-600" />
            Configuration du moteur IA
          </CardTitle>
          <CardDescription>Pipeline de détection automatique du plagiat</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Algorithme</div>
              <div className="font-semibold">TF-IDF</div>
              <div className="text-[10px] text-slate-400 mt-1">unigrams + bigrams</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Similarité</div>
              <div className="font-semibold">Cosinus</div>
              <div className="text-[10px] text-slate-400 mt-1">+ Jaccard lexical</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Seuil</div>
              <div className="font-semibold">0.15</div>
              <div className="text-[10px] text-slate-400 mt-1">cosinus minimum</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Classification</div>
              <div className="font-semibold">5 types</div>
              <div className="text-[10px] text-slate-400 mt-1">copy, paraphrase...</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Périmètre</div>
              <div className="font-semibold">Faculté</div>
              <div className="text-[10px] text-slate-400 mt-1">corpus par faculté</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {Object.entries(MATCH_TYPES).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <div key={type} className={`rounded-lg p-2 text-center ${config.color}`}>
                  <Icon className="h-3 w-3 mx-auto mb-1" />
                  <div className="text-[9px] font-medium leading-tight">{config.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historique des analyses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Historique des analyses</CardTitle>
              <CardDescription>{analyses.length} analyse(s) au total</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12">
              <FlaskConical className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-4">
                Aucune analyse lancée. Déposez des documents puis lancez les analyses depuis leur page de détail.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard/documents">
                  <FileText className="h-4 w-4 mr-1.5" />
                  Voir les documents
                </Link>
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-2">
                {analyses.map(a => {
                  const scorePct = (a.globalScore * 100).toFixed(1);
                  const scoreColor = getScoreColor(a.globalScore);
                  const scoreLabel = getScoreLabel(a.globalScore);
                  return (
                    <Link
                      key={a.id}
                      href={`/dashboard/documents/${a.documentId}`}
                      className="block rounded-lg border border-slate-200 p-3 hover:border-purple-300 hover:shadow-sm transition group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">{a.documentStatus}</Badge>
                            <span className="text-xs text-slate-500">{a.faculty}</span>
                          </div>
                          <div className="font-medium text-slate-900 text-sm group-hover:text-purple-700 transition truncate">
                            {a.documentTitle}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Par {a.author} · Analysé le {new Date(a.completedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-2xl font-bold ${scoreColor}`}>{scorePct}%</div>
                          <Badge variant="outline" className="text-[10px] mt-1">{scoreLabel}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500">
                          Segments: <strong className="text-slate-700">{a.matchedSegments}/{a.totalSegments}</strong>
                        </span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${a.globalScore >= 0.5 ? 'bg-rose-500' : a.globalScore >= 0.3 ? 'bg-orange-500' : a.globalScore >= 0.15 ? 'bg-amber-500' : 'bg-emerald-500'} rounded-full`}
                            style={{ width: `${scorePct}%` }}
                          />
                        </div>
                        <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-purple-600 transition" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Pipeline IA détaillé */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-600" />
            Pipeline IA (8 étapes)
          </CardTitle>
          <CardDescription>Étapes du traitement automatique</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { num: 1, label: 'Soumission', desc: 'Réception du document' },
              { num: 2, label: 'Extraction', desc: 'Texte depuis PDF/DOCX' },
              { num: 3, label: 'Prétraitement NLP', desc: 'Normalisation + segmentation' },
              { num: 4, label: 'Tokenisation', desc: 'Mots + filtrage stop words' },
              { num: 5, label: 'Vectorisation TF-IDF', desc: 'Représentation vectorielle' },
              { num: 6, label: 'Recherche cosinus', desc: 'Top 3 matches par segment' },
              { num: 7, label: 'Classification', desc: 'Type de similarité' },
              { num: 8, label: 'Rapport', desc: 'Score global + détails' },
            ].map(step => (
              <div key={step.num} className="rounded-lg border border-slate-200 p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-5 w-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {step.num}
                  </div>
                  <div className="font-medium text-slate-900 text-xs">{step.label}</div>
                </div>
                <div className="text-[10px] text-slate-500">{step.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
