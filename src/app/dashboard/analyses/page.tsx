'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FlaskConical, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pour démo : on charge les analyses depuis le store via API dédiée (à créer si besoin)
    // Ici on simule en chargeant tous les documents avec leur analyse
    fetch('/api/documents').then(r => r.json()).then(data => {
      const an = (data.documents || []).filter((d: any) => d.analysis).map((d: any) => ({
        id: d.analysis.id,
        documentTitle: d.title,
        documentId: d.id,
        author: d.uploadedBy ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}` : '—',
        status: d.analysis.status,
        score: d.analysis.globalScore,
        matched: d.analysis.matchedSegments,
        total: d.analysis.totalSegments,
        createdAt: d.createdAt,
      }));
      setAnalyses(an);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><FlaskConical className="h-6 w-6 text-purple-600" /> Analyses IA</h1>
        <p className="text-sm text-slate-500 mt-1">Suivi des analyses du moteur de détection automatique</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique des analyses</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
           analyses.length === 0 ? <div className="text-center py-12"><FlaskConical className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Aucune analyse lancée. Le moteur IA sera disponible après développement complet du pipeline.</p></div> :
           <Table>
             <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Auteur</TableHead><TableHead className="text-center">Statut</TableHead><TableHead className="text-center">Score</TableHead><TableHead className="text-center">Matches</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
             <TableBody>
               {analyses.map(a => (
                 <TableRow key={a.id}>
                   <TableCell className="font-medium">{a.documentTitle}</TableCell>
                   <TableCell className="text-sm">{a.author}</TableCell>
                   <TableCell className="text-center">
                     {a.status === 'COMPLETED' ? <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Terminé</Badge> :
                      a.status === 'RUNNING' ? <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />En cours</Badge> :
                      <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />{a.status}</Badge>}
                   </TableCell>
                   <TableCell className="text-center font-mono">{a.score !== undefined ? `${(a.score * 100).toFixed(1)}%` : '—'}</TableCell>
                   <TableCell className="text-center font-mono">{a.matched || 0}/{a.total || 0}</TableCell>
                   <TableCell className="text-xs">{new Date(a.createdAt).toLocaleString('fr-FR')}</TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline IA (à venir)</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>Le moteur IA complet comprendra les étapes suivantes :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Extraction OCR du texte (Tesseract pour PDF scannés)</li>
            <li>Prétraitement NLP (spaCy — tokenisation, segmentation)</li>
            <li>Génération d'embeddings (Sentence-BERT multilingue)</li>
            <li>Recherche vectorielle (pgvector, similarité cosinus)</li>
            <li>Classification des correspondances (copier-coller, paraphrase, reformulation, traduction)</li>
            <li>Génération automatique du rapport PDF</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
