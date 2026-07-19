'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Lightbulb, Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles,
  FileSearch, Copy, ArrowRight, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

interface SimilarSubject {
  subjectId: string;
  title: string;
  similarity: number;
  explanation: string;
  sharedKeywords: string[];
}

interface ValidationResult {
  isOriginal: boolean;
  similarityScore: number;
  threshold: number;
  report: string;
  recommendation: string;
  similarSubjects: SimilarSubject[];
  alternatives: string[];
}

export default function ValidateSubjectPage() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    domain: '',
    keywords: '',
    objectives: '',
    problemStatement: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    if (form.title.length < 5) {
      toast.error('Le titre doit faire au moins 5 caractères');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/subjects/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setResult(data.result);
      if (data.result.isOriginal) {
        toast.success('Sujet validé — il est original !');
      } else {
        toast.info(`${data.result.alternatives.length} alternative(s) générée(s)`);
      }
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const scorePct = result ? (result.similarityScore * 100).toFixed(1) : '0';
  const thresholdPct = result ? (result.threshold * 100).toFixed(0) : '20';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileSearch className="h-6 w-6 text-purple-600" /> Validation intelligente d'un sujet
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Soumettez votre sujet pour vérifier son originalité. Si un doublon est détecté, des alternatives vous seront proposées.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations du sujet</CardTitle>
            <CardDescription>Renseignez un maximum d'informations pour une analyse précise</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleValidate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre du sujet <span className="text-rose-500">*</span></Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Développement d'une plateforme de gestion..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domaine</Label>
                <Input
                  id="domain"
                  value={form.domain}
                  onChange={e => setForm({ ...form, domain: e.target.value })}
                  placeholder="Ex: Informatique, Droit, Médecine..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description / Résumé</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Décrivez brièvement votre sujet..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">Mots-clés (séparés par virgules)</Label>
                <Input
                  id="keywords"
                  value={form.keywords}
                  onChange={e => setForm({ ...form, keywords: e.target.value })}
                  placeholder="IA, plagiat, NLP, éducation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objectives">Objectifs de recherche</Label>
                <Textarea
                  id="objectives"
                  value={form.objectives}
                  onChange={e => setForm({ ...form, objectives: e.target.value })}
                  rows={2}
                  placeholder="Quels sont les objectifs de votre travail ?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="problemStatement">Problématique</Label>
                <Textarea
                  id="problemStatement"
                  value={form.problemStatement}
                  onChange={e => setForm({ ...form, problemStatement: e.target.value })}
                  rows={2}
                  placeholder="Quelle est la problématique de votre recherche ?"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyse en cours...</>
                ) : (
                  <><FileSearch className="h-4 w-4 mr-2" />Valider le sujet</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Résultats */}
        <div className="space-y-6">
          {loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-purple-400 mb-4" />
                <p className="text-sm text-slate-500">Analyse sémantique en cours...</p>
                <p className="text-xs text-slate-400 mt-1">Comparaison avec la base de connaissances</p>
              </CardContent>
            </Card>
          )}

          {!loading && !result && (
            <Card>
              <CardContent className="p-12 text-center">
                <FileSearch className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-500">Soumettez un sujet pour lancer l'analyse</p>
                <p className="text-xs text-slate-400 mt-1">Le système comparera votre sujet avec tous les travaux existants</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* Verdict */}
              <Card className={result.isOriginal ? 'border-emerald-300' : 'border-rose-300'}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {result.isOriginal ? (
                      <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Sujet original</>
                    ) : (
                      <><XCircle className="h-5 w-5 text-rose-600" /> Doublon détecté</>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Score */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500">Score de similarité</span>
                      <span className={`font-bold ${result.isOriginal ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {scorePct}%
                      </span>
                    </div>
                    <Progress
                      value={parseFloat(scorePct)}
                      className={`h-3 ${result.isOriginal ? '[&>*]:bg-emerald-500' : '[&>*]:bg-rose-500'}`}
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      Seuil de rejet : {thresholdPct}% — {result.recommendation}
                    </div>
                  </div>

                  {/* Rapport */}
                  {result.report && (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-line max-h-40 overflow-y-auto">
                      {result.report}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sujets similaires */}
              {result.similarSubjects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Sujets similaires ({result.similarSubjects.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px] pr-2">
                      <div className="space-y-3">
                        {result.similarSubjects.map((s, i) => (
                          <div key={i} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-900">{s.title}</span>
                              <Badge variant="outline" className={s.similarity >= 0.5 ? 'text-rose-600 border-rose-200' : 'text-amber-600 border-amber-200'}>
                                {(s.similarity * 100).toFixed(1)}%
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">{s.explanation}</p>
                            {s.sharedKeywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {s.sharedKeywords.map((k, j) => (
                                  <Badge key={j} variant="secondary" className="text-[10px]">{k}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Alternatives (Mission 2) */}
              {!result.isOriginal && result.alternatives.length > 0 && (
                <Card className="border-purple-200 bg-purple-50/30">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      Sujets alternatifs générés ({result.alternatives.length})
                    </CardTitle>
                    <CardDescription>
                      Ces sujets conservent votre domaine et problématique avec un angle différent
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.alternatives.map((alt, i) => (
                        <div key={i} className="rounded-lg border border-purple-200 bg-white p-3 hover:border-purple-400 transition group">
                          <div className="flex items-start gap-2">
                            <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-slate-800 leading-relaxed">{alt}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(alt);
                                toast.success('Sujet copié dans le presse-papier');
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
