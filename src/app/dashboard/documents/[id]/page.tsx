// Détail d'un document avec analyse IA complète et visualisation
'use client';
import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, FileText, User, Building2, Calendar, FlaskConical, Loader2,
  AlertCircle, Play, CheckCircle2, Copy, FileWarning, Languages, RefreshCw, FileCheck, Download
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Match {
  id: string;
  querySegmentIndex: number;
  querySegmentText: string;
  sourceDocumentId: string;
  sourceSegmentIndex: number;
  sourceSegmentText: string;
  semanticScore: number;
  lexicalScore: number;
  matchType: 'COPY_PASTE' | 'PARAPHRASE' | 'REFORMULATION' | 'TRANSLATION' | 'WEAK_MATCH';
}

interface Analysis {
  id: string;
  status: string;
  globalScore?: number;
  matchedSegments?: number;
  totalSegments?: number;
  threshold: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

const MATCH_CONFIG = {
  COPY_PASTE: { label: 'Copier-coller', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: Copy, severity: 'Critique' },
  PARAPHRASE: { label: 'Paraphrase', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: FileWarning, severity: 'Élevé' },
  REFORMULATION: { label: 'Reformulation', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: RefreshCw, severity: 'Modéré' },
  TRANSLATION: { label: 'Traduction', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Languages, severity: 'Modéré' },
  WEAK_MATCH: { label: 'Similarité faible', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText, severity: 'Faible' },
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

function getScoreProgressColor(score: number): string {
  if (score >= 0.5) return 'bg-rose-500';
  if (score >= 0.3) return 'bg-orange-500';
  if (score >= 0.15) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${id}`).then(r => r.json()).then(d => setData(d)).finally(() => setLoading(false));
  }, [id]);

  async function launchAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/documents/${id}/analyze`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Erreur lors de l\'analyse');
        return;
      }
      const score = result.analysis?.globalScore || 0;
      const verdict = getScoreLabel(score);
      toast.success(`Analyse terminée — Score: ${(score * 100).toFixed(1)}% (${verdict})`);
      const refreshed = await fetch(`/api/documents/${id}`).then(r => r.json());
      setData(refreshed);
    } catch (e: any) {
      toast.error('Erreur réseau: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" /></div>;
  if (!data?.document) return <div className="text-center py-12"><AlertCircle className="h-10 w-10 text-rose-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Document introuvable.</p></div>;

  const doc = data.document;
  const analysis = data.analysis as Analysis | null;
  const matches = (data.matches || []) as Match[];
  const canAnalyze = doc.status === 'SUBMITTED' || doc.status === 'ANALYZED';
  const score = analysis?.globalScore || 0;
  const scorePct = (score * 100).toFixed(1);

  // Stats par type de match
  const matchesByType = matches.reduce((acc, m) => {
    acc[m.matchType] = (acc[m.matchType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/dashboard/documents"><ArrowLeft className="h-4 w-4 mr-1.5" />Retour à la liste</Link>
          </Button>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">{doc.type}</Badge>
            <Badge variant="outline" className="text-xs">
              {doc.status === 'ANALYZED' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
              {doc.status}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
          {doc.subject && <p className="text-sm text-slate-500 mt-1">{doc.subject}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {canAnalyze && (
            <Button onClick={launchAnalysis} disabled={analyzing} className="bg-purple-600 hover:bg-purple-700 min-w-[180px]">
              {analyzing ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analyse en cours...</>
              ) : analysis?.status === 'COMPLETED' ? (
                <><Play className="h-4 w-4 mr-1.5" />Relancer l'analyse</>
              ) : (
                <><Play className="h-4 w-4 mr-1.5" />Lancer l'analyse IA</>
              )}
            </Button>
          )}
          {analysis?.status === 'COMPLETED' && (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/documents/${id}/report`} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-1.5" />Rapport PDF
              </a>
            </Button>
          )}
          {analysis?.completedAt && (
            <span className="text-xs text-slate-400">Analysé le {new Date(analysis.completedAt).toLocaleString('fr-FR')}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : Métadonnées */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Auteur</div>
                  <div className="font-medium truncate">{doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : '—'}</div>
                </div>
              </div>
              {doc.supervisedBy && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">Encadrant</div>
                    <div className="font-medium truncate">{doc.supervisedBy.firstName} {doc.supervisedBy.lastName}</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Faculté / Département</div>
                  <div className="font-medium truncate">{doc.faculty?.name || '—'}</div>
                  {doc.department && <div className="text-xs text-slate-500 truncate">{doc.department.name}</div>}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Année académique</div>
                  <div className="font-medium">{doc.academicYear}</div>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Fichier</div>
                  <div className="font-medium text-xs truncate">{doc.fileName}</div>
                  <div className="text-xs text-slate-400">{(doc.fileSize / 1024).toFixed(1)} Ko</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Résumé */}
          {doc.abstract && (
            <Card>
              <CardHeader><CardTitle className="text-base">Résumé</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 leading-relaxed">{doc.abstract}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne droite : Analyse IA */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-purple-600" />
                Analyse IA de similarité
              </CardTitle>
              <CardDescription>
                Détection automatique du plagiat par vectorisation TF-IDF et similarité cosinus
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!analysis || analysis.status !== 'COMPLETED' ? (
                <div className="text-center py-12">
                  {analysis?.status === 'FAILED' ? (
                    <>
                      <AlertCircle className="h-12 w-12 text-rose-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-rose-700 mb-1">Échec de l'analyse</p>
                      <p className="text-xs text-slate-500 mb-4">{analysis?.error}</p>
                      {canAnalyze && (
                        <Button onClick={launchAnalysis} disabled={analyzing} className="bg-purple-600 hover:bg-purple-700">
                          <Play className="h-4 w-4 mr-1.5" />Réessayer l'analyse
                        </Button>
                      )}
                    </>
                  ) : analysis?.status === 'RUNNING' ? (
                    <>
                      <Loader2 className="h-12 w-12 text-purple-300 mx-auto mb-3 animate-spin" />
                      <p className="text-sm font-medium text-purple-700">Analyse en cours...</p>
                    </>
                  ) : (
                    <>
                      <FlaskConical className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 mb-1">Aucune analyse lancée</p>
                      <p className="text-xs text-slate-400 mb-4">Cliquez sur "Lancer l'analyse IA" pour démarrer</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Score global */}
                  <div className="rounded-lg border border-slate-200 p-4 bg-gradient-to-br from-slate-50 to-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-wider text-slate-500">Score global de similarité</span>
                      <Badge variant="outline" className="text-xs">
                        {getScoreLabel(score)}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{scorePct}%</span>
                      <span className="text-xs text-slate-500">
                        {analysis.matchedSegments} / {analysis.totalSegments} segments touchés
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getScoreProgressColor(score)} rounded-full transition-all duration-500`}
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats par type */}
                  {Object.keys(matchesByType).length > 0 && (
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Répartition par type de match</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {Object.entries(MATCH_CONFIG).map(([type, config]) => {
                          const count = matchesByType[type] || 0;
                          const Icon = config.icon;
                          return (
                            <div key={type} className={`rounded-lg border p-2 text-center ${count > 0 ? config.color : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                              <Icon className="h-3 w-3 mx-auto mb-1" />
                              <div className="text-lg font-bold">{count}</div>
                              <div className="text-[9px] leading-tight">{config.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Métadonnées analyse */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-slate-500">Seuil</div>
                      <div className="font-semibold">{analysis.threshold}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-slate-500">Statut</div>
                      <div className="font-semibold text-emerald-600">Terminé</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-slate-500">Date</div>
                      <div className="font-semibold">{analysis.completedAt ? new Date(analysis.completedAt).toLocaleDateString('fr-FR') : '—'}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Liste des correspondances */}
          {analysis?.status === 'COMPLETED' && matches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileWarning className="h-4 w-4 text-orange-600" />
                  Correspondances détectées ({matches.length})
                </CardTitle>
                <CardDescription>Passages du document présentant des similarités avec d'autres travaux</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {matches.map((match, idx) => {
                      const config = MATCH_CONFIG[match.matchType];
                      const Icon = config.icon;
                      return (
                        <div key={match.id} className="rounded-lg border border-slate-200 overflow-hidden">
                          {/* Header du match */}
                          <div className={`px-3 py-2 flex items-center justify-between ${config.color}`}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span className="font-medium text-sm">Match #{idx + 1}</span>
                              <Badge variant="outline" className="bg-white/80 text-xs">{config.label}</Badge>
                              <Badge variant="outline" className="bg-white/80 text-xs">{config.severity}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span title="Similarité sémantique (TF-IDF cosinus)">
                                Sem: <strong>{(match.semanticScore * 100).toFixed(1)}%</strong>
                              </span>
                              <span title="Similarité lexicale (Jaccard)">
                                Lex: <strong>{(match.lexicalScore * 100).toFixed(1)}%</strong>
                              </span>
                            </div>
                          </div>
                          {/* Texte query */}
                          <div className="p-3 space-y-2">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                Segment {match.querySegmentIndex + 1} du document analysé
                              </div>
                              <div className="text-sm bg-rose-50 border-l-4 border-rose-300 p-2 rounded-r text-slate-700 leading-relaxed">
                                {match.querySegmentText}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                                <Link href={`/dashboard/documents/${match.sourceDocumentId}`} className="text-purple-600 hover:underline">
                                  Source: segment {match.sourceSegmentIndex + 1}
                                </Link>
                              </div>
                              <div className="text-sm bg-amber-50 border-l-4 border-amber-300 p-2 rounded-r text-slate-700 leading-relaxed">
                                {match.sourceSegmentText}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Aucun match */}
          {analysis?.status === 'COMPLETED' && matches.length === 0 && (
            <Card className="border-emerald-200">
              <CardContent className="p-8 text-center">
                <FileCheck className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-emerald-700 mb-1">Aucune similarité détectée</h3>
                <p className="text-sm text-slate-500">
                  Le document ne présente pas de correspondances significatives avec les autres travaux du corpus.
                  Score global : <strong>{scorePct}%</strong>.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
