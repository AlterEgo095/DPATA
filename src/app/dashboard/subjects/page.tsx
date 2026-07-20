'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Search, Loader2, Pencil, Trash2, Upload, TrendingUp, Database,
  CheckCircle2, XCircle, Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';

interface Subject {
  id: string; title: string; description?: string; domain?: string;
  field?: string; level?: string; keywords?: string; objectives?: string;
  problemStatement?: string; academicYear?: string; authorName?: string;
  workType?: string; createdAt: string;
}

interface Stats {
  totalSubjects: number;
  totalValidations: number;
  originalCount: number;
  duplicateCount: number;
  avgSimilarity: number;
  topDomains: Array<{ domain: string; count: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ title: '', description: '', domain: '', keywords: '', objectives: '', problemStatement: '', level: '', workType: 'TFC' });
  const [submitting, setSubmitting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    const [res1, res2] = await Promise.all([
      fetch('/api/subjects'),
      fetch('/api/subjects/stats'),
    ]);
    const data1 = await res1.json();
    const data2 = await res2.json();
    setSubjects(data1.subjects || []);
    setStats(data2);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', description: '', domain: '', keywords: '', objectives: '', problemStatement: '', level: '', workType: 'TFC' });
    setDialogOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setForm({
      title: s.title, description: s.description || '', domain: s.domain || '',
      keywords: s.keywords || '', objectives: s.objectives || '',
      problemStatement: s.problemStatement || '', level: s.level || '', workType: s.workType || 'TFC'
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editing ? `/api/subjects/${editing.id}` : '/api/subjects';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(editing ? 'Sujet modifié' : 'Sujet ajouté à la base');
      setDialogOpen(false);
      load();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(s: Subject) {
    if (!confirm(`Supprimer "${s.title}" ?`)) return;
    await fetch(`/api/subjects/${s.id}`, { method: 'DELETE' });
    toast.success('Sujet supprimé');
    load();
  }

  async function handleImport() {
    if (!importText.trim()) { toast.error('Collez des données à importer'); return; }
    setImporting(true);
    try {
      // Parser CSV simple (une ligne = un titre, ou CSV avec virgules)
      const lines = importText.trim().split('\n').filter(l => l.trim());
      const subjectsToImport = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          title: parts[0] || line,
          domain: parts[1] || '',
          keywords: parts[2] || '',
          workType: parts[3] || 'AUTRE',
        };
      });
      const res = await fetch('/api/subjects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: subjectsToImport }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`${data.imported} sujet(s) importé(s)`);
      setImportText('');
      load();
    } finally { setImporting(false); }
  }

  const filtered = subjects.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.domain || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.keywords || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-600" /> Base de connaissances
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gestion des sujets académiques pour le moteur IA</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1.5" /> Ajouter un sujet
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4">
            <Database className="h-5 w-5 text-blue-500 mb-1" />
            <div className="text-2xl font-bold">{stats.totalSubjects}</div>
            <div className="text-xs text-slate-500">Sujets en base</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-1" />
            <div className="text-2xl font-bold text-emerald-600">{stats.originalCount}</div>
            <div className="text-xs text-slate-500">Sujets validés</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <XCircle className="h-5 w-5 text-rose-500 mb-1" />
            <div className="text-2xl font-bold text-rose-600">{stats.duplicateCount}</div>
            <div className="text-xs text-slate-500">Doublons détectés</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <Lightbulb className="h-5 w-5 text-purple-500 mb-1" />
            <div className="text-2xl font-bold text-purple-600">{stats.totalValidations}</div>
            <div className="text-xs text-slate-500">Validations</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <TrendingUp className="h-5 w-5 text-amber-500 mb-1" />
            <div className="text-2xl font-bold text-amber-600">{(stats.avgSimilarity * 100).toFixed(1)}%</div>
            <div className="text-xs text-slate-500">Similarité moyenne</div>
          </CardContent></Card>
        </div>
      )}

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Liste des sujets</TabsTrigger>
          <TabsTrigger value="import">Import massif</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        {/* Liste */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{subjects.length} sujet(s) en base</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
               filtered.length === 0 ? <div className="text-center py-8"><Database className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Aucun sujet. Ajoutez-en ou importez-en en masse.</p></div> :
               <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                 <Table>
                   <TableHeader><TableRow>
                     <TableHead>Titre</TableHead><TableHead>Domaine</TableHead><TableHead>Type</TableHead>
                     <TableHead>Mots-clés</TableHead><TableHead className="text-right">Actions</TableHead>
                   </TableRow></TableHeader>
                   <TableBody>
                     {filtered.map(s => (
                       <TableRow key={s.id}>
                         <TableCell className="font-medium max-w-xs">{s.title}</TableCell>
                         <TableCell><Badge variant="outline">{s.domain || '—'}</Badge></TableCell>
                         <TableCell><Badge variant="secondary">{s.workType || 'AUTRE'}</Badge></TableCell>
                         <TableCell className="text-xs text-slate-500 max-w-xs truncate">{s.keywords || '—'}</TableCell>
                         <TableCell>
                           <div className="flex justify-end gap-1">
                             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4" /></Button>
                           </div>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import */}
        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-blue-600" /> Import massif de sujets</CardTitle>
              <CardDescription>Collez vos sujets (une ligne par sujet). Format : titre, domaine, mots-clés, type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={10}
                placeholder={"Développement d'une plateforme de gestion des bibliothèques, Informatique, plateforme bibliothèque gestion, TFC\nSystème de recommandation de ressources documentaires, Informatique, recommandation IA, MEMOIRE\n..."}
              />
              <Button onClick={handleImport} disabled={importing} className="bg-blue-600 hover:bg-blue-700">
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Import...</> : <><Upload className="h-4 w-4 mr-2" />Importer</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Top domaines</CardTitle></CardHeader>
              <CardContent>
                {stats?.topDomains?.length ? (
                  <div className="space-y-2">
                    {stats.topDomains.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm w-40 truncate">{d.domain}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(d.count / stats.topDomains[0].count) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono w-8">{d.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-500">Aucune donnée</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Top mots-clés</CardTitle></CardHeader>
              <CardContent>
                {stats?.topKeywords?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {stats.topKeywords.map((k, i) => (
                      <Badge key={i} variant="secondary" className="text-sm">
                        {k.keyword} <span className="text-slate-400 ml-1">{k.count}</span>
                      </Badge>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-500">Aucune donnée</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le sujet' : 'Ajouter un sujet'}</DialogTitle>
            <DialogDescription>Enrichissez la base de connaissances du moteur IA</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Titre <span className="text-rose-500">*</span></Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Domaine</Label><Input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="Informatique" /></div>
              <div className="space-y-2"><Label>Niveau</Label><Input value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="L3, DEA..." /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Mots-clés</Label><Input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} placeholder="IA, plagiat, NLP" /></div>
            <div className="space-y-2"><Label>Objectifs</Label><Textarea value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Problématique</Label><Textarea value={form.problemStatement} onChange={e => setForm({ ...form, problemStatement: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Type de travail</Label>
              <Select value={form.workType} onValueChange={v => setForm({ ...form, workType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TFC">TFC</SelectItem>
                  <SelectItem value="TFE">TFE</SelectItem>
                  <SelectItem value="MEMOIRE">Mémoire</SelectItem>
                  <SelectItem value="THESE">Thèse</SelectItem>
                  <SelectItem value="ARTICLE">Article</SelectItem>
                  <SelectItem value="AUTRE">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing ? 'Modifier' : 'Ajouter'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
