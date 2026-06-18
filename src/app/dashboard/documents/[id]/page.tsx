// Détail d'un document
'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, User, Building2, Calendar, FlaskConical, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/documents/${id}`).then(r => r.json()).then(d => setData(d)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" /></div>;
  if (!data?.document) return <div className="text-center py-12"><AlertCircle className="h-10 w-10 text-rose-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Document introuvable.</p></div>;

  const doc = data.document;
  const analysis = data.analysis;
  const matches = data.matches || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2"><Link href="/dashboard/documents"><ArrowLeft className="h-4 w-4 mr-1.5" />Retour</Link></Button>
          <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{doc.fileName}</p>
        </div>
        <Badge variant="outline" className="text-sm">{doc.type}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Métadonnées */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2"><User className="h-4 w-4 text-slate-400 mt-0.5" /><div><div className="text-xs text-slate-500">Auteur</div><div className="font-medium">{doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : '—'}</div></div></div>
            {doc.supervisedBy && <div className="flex items-start gap-2"><User className="h-4 w-4 text-slate-400 mt-0.5" /><div><div className="text-xs text-slate-500">Encadrant</div><div className="font-medium">{doc.supervisedBy.firstName} {doc.supervisedBy.lastName}</div></div></div>}
            <div className="flex items-start gap-2"><Building2 className="h-4 w-4 text-slate-400 mt-0.5" /><div><div className="text-xs text-slate-500">Faculté</div><div className="font-medium">{doc.faculty?.name || '—'}</div></div></div>
            {doc.department && <div className="flex items-start gap-2"><Building2 className="h-4 w-4 text-slate-400 mt-0.5" /><div><div className="text-xs text-slate-500">Département</div><div className="font-medium">{doc.department.name}</div></div></div>}
            <div className="flex items-start gap-2"><Calendar className="h-4 w-4 text-slate-400 mt-0.5" /><div><div className="text-xs text-slate-500">Année académique</div><div className="font-medium">{doc.academicYear}</div></div></div>
            <div className="flex items-start gap-2"><Calendar className="h-4 w-4 text-slate-400 mt-0.5" /><div><div className="text-xs text-slate-500">Déposé le</div><div className="font-medium">{new Date(doc.createdAt).toLocaleString('fr-FR')}</div></div></div>
          </CardContent>
        </Card>

        {/* Analyse IA */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FlaskConical className="h-4 w-4 text-purple-600" /> Analyse IA</CardTitle></CardHeader>
          <CardContent>
            {!analysis ? (
              <div className="text-center py-8">
                <FlaskConical className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-4">Aucune analyse lancée pour ce document.</p>
                <Button className="bg-purple-600 hover:bg-purple-700" disabled>
                  <FlaskConical className="h-4 w-4 mr-1.5" /> Lancer l'analyse (bientôt disponible)
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs text-slate-500 uppercase mb-1">Score global</div>
                    <div className={`text-2xl font-bold ${(analysis.globalScore || 0) > 0.3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {((analysis.globalScore || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs text-slate-500 uppercase mb-1">Segments matchés</div>
                    <div className="text-2xl font-bold text-slate-900">{analysis.matchedSegments || 0}</div>
                    <div className="text-[10px] text-slate-400">/ {analysis.totalSegments || 0}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs text-slate-500 uppercase mb-1">Statut</div>
                    <Badge className="mt-1">{analysis.status}</Badge>
                  </div>
                </div>
                {matches.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Correspondances détectées</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {matches.map((m: any, i: number) => (
                        <div key={m.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-xs">{m.matchType}</Badge>
                            <div className="flex gap-2 text-xs">
                              <span className="text-purple-600">Sem: {(m.semanticScore * 100).toFixed(0)}%</span>
                              <span className="text-blue-600">Lex: {(m.lexicalScore * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><div className="text-slate-500 mb-1">Segment analysé #{m.querySegmentIndex}</div><div className="bg-slate-50 p-2 rounded">{m.querySegmentText.slice(0, 200)}...</div></div>
                            <div><div className="text-slate-500 mb-1">Source #{m.sourceSegmentIndex}</div><div className="bg-amber-50 p-2 rounded">{m.sourceSegmentText.slice(0, 200)}...</div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {doc.abstract && (
        <Card>
          <CardHeader><CardTitle className="text-base">Résumé</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-slate-700">{doc.abstract}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
