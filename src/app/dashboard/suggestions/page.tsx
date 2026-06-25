'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Search, Loader2, CheckCircle2, AlertTriangle, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface SimilarSubject {
  documentId: string;
  title: string;
  subject: string;
  similarity: number;
  verdict: string;
}

export default function SuggestionsPage() {
  const [subject, setSubject] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [topics, setTopics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/suggestions/topics').then(r => r.json()).then(d => setTopics(d)).catch(() => {});
  }, []);

  async function handleCheck() {
    if (subject.length < 10) {
      toast.error('Le sujet doit faire au moins 10 caractères');
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch('/api/suggestions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setResult(data);
    } finally { setChecking(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-amber-600" /> Suggestion de sujets de mémoire
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Vérifiez l'originalité de votre sujet et explorez les thématiques sous-exploitées
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vérification de sujet */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-600" /> Vérifier un sujet
            </CardTitle>
            <CardDescription>Saisissez votre sujet pour vérifier son originalité</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Sujet de mémoire proposé</Label>
              <Textarea
                id="subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                rows={3}
                placeholder="Ex: Détection automatique du plagiat par IA dans les travaux académiques..."
              />
              <p className="text-xs text-slate-500">{subject.length} caractères (minimum 10)</p>
            </div>
            <Button onClick={handleCheck} disabled={checking || subject.length < 10} className="bg-purple-600 hover:bg-purple-700">
              {checking ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analyse...</> : <><Search className="h-4 w-4 mr-1.5" />Vérifier l'originalité</>}
            </Button>

            {result && (
              <div className="space-y-4 mt-4">
                {/* Verdict */}
                <div className={`rounded-lg p-4 border-2 ${result.isOriginal ? 'border-emerald-300 bg-emerald-50' : result.globalScore >= 0.50 ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {result.isOriginal ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> :
                     result.globalScore >= 0.50 ? <AlertTriangle className="h-5 w-5 text-rose-600" /> :
                     <Info className="h-5 w-5 text-amber-600" />}
                    <span className="font-semibold text-sm">{result.recommendation}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Score de similarité : <strong>{(result.globalScore * 100).toFixed(1)}%</strong> · {result.totalChecked} travaux comparés
                  </div>
                </div>

                {/* Sujets similaires */}
                {result.similarSubjects?.length > 0 && (
                  <div>
                    <h4 className="text-xs uppercase text-slate-500 mb-2">Travaux similaires détectés</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {result.similarSubjects.map((s: SimilarSubject, i: number) => (
                        <div key={i} className="rounded-lg border border-slate-200 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <Link href={`/dashboard/documents/${s.documentId}`} className="text-sm font-medium text-purple-700 hover:underline truncate">
                              {s.title}
                            </Link>
                            <Badge variant="outline" className={`text-xs ml-2 shrink-0 ${s.similarity >= 0.50 ? 'text-rose-600' : s.similarity >= 0.30 ? 'text-amber-600' : 'text-slate-500'}`}>
                              {(s.similarity * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          {s.subject && <p className="text-xs text-slate-500">{s.subject}</p>}
                          <p className="text-[10px] text-slate-400 mt-1">{s.verdict}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Thématiques */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" /> Carte thématique du corpus
            </CardTitle>
            <CardDescription>Identifiez les zones sous-exploitées pour un sujet original</CardDescription>
          </CardHeader>
          <CardContent>
            {!topics ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <div className="text-2xl font-bold text-slate-900">{topics.totalDocuments}</div>
                    <div className="text-xs text-slate-500">Documents analysés</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <div className="text-2xl font-bold text-slate-900">{topics.totalKeywords}</div>
                    <div className="text-xs text-slate-500">Mots-clés uniques</div>
                  </div>
                </div>

                {topics.underexploredTopics?.length > 0 && (
                  <div>
                    <h4 className="text-xs uppercase text-emerald-600 mb-2 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> Thématiques sous-exploitées (pistes originales)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {topics.underexploredTopics.map((t: string, i: number) => (
                        <Badge key={i} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 cursor-pointer" onClick={() => setSubject(s => s ? s : `Étude de ${t} dans le contexte congolais`)}>
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {topics.saturatedTopics?.length > 0 && (
                  <div>
                    <h4 className="text-xs uppercase text-rose-600 mb-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Thématiques saturées (à éviter)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {topics.saturatedTopics.map((t: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-rose-600 border-rose-200">
                          {t.word} ({t.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {topics.topKeywords?.length > 0 && (
                  <div>
                    <h4 className="text-xs uppercase text-slate-500 mb-2">Top mots-clés du corpus</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {topics.topKeywords.map((t: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {t.word} <span className="text-slate-400 ml-1">{t.count}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
