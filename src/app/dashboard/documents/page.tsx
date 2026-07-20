// Page liste + dépôt de documents
'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Search, Loader2, Upload, Trash2, Eye, CheckCircle2, AlertCircle, Clock, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface DocumentItem {
  id: string; title: string; type: string; subject?: string; abstract?: string;
  fileName: string; fileSize: number; status: string; academicYear: string;
  faculty?: string | null; department?: string | null; promotion?: string | null;
  uploadedBy?: { firstName: string; lastName: string };
  supervisedBy?: { firstName: string; lastName: string } | null;
  analysis?: { status: string; globalScore?: number } | null;
  createdAt: string;
}
interface Faculty { id: string; name: string; }
interface Department { id: string; name: string; facultyId: string; }
interface Promotion { id: string; name: string; departmentId: string; }
interface Teacher { id: string; firstName: string; lastName: string; }

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700', icon: Clock },
  SUBMITTED: { label: 'Soumis', color: 'bg-blue-100 text-blue-700', icon: Upload },
  ANALYZING: { label: 'En analyse', color: 'bg-amber-100 text-amber-700', icon: Loader2 },
  ANALYZED: { label: 'Analysé', color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
  VALIDATED: { label: 'Validé', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rejeté', color: 'bg-rose-100 text-rose-700', icon: AlertCircle },
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', type: 'TFC', subject: '', abstract: '',
    facultyId: '', departmentId: '', promotionId: '', academicYear: '2025-2026',
    supervisedById: '', fileName: '', fileSize: 0, mimeType: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocs(data.data || []);
    setFaculties(data.faculties || []);
    setDepartments(data.departments || []);
    setPromotions(data.promotions || []);
    setTeachers(data.teachers || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({ title: '', type: 'TFC', subject: '', abstract: '', facultyId: '', departmentId: '', promotionId: '', academicYear: '2025-2026', supervisedById: '', fileName: '', fileSize: 0, mimeType: '' });
    setDialogOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 50 Mo)');
      return;
    }
    setForm(f => ({ ...f, fileName: file.name, fileSize: file.size, mimeType: file.type, title: f.title || file.name.replace(/\.[^.]+$/, '') }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fileName) { toast.error('Sélectionnez un fichier'); return; }
    setSubmitting(true);
    try {
      // Pour démo : on simule l'extraction du texte (en production : upload + OCR)
      const fakeText = `Mémoire: ${form.title}\n\nSujet: ${form.subject}\n\nRésumé: ${form.abstract}\n\n[Contenu extrait du fichier ${form.fileName}]`;
      const payload = { ...form, textExtract: fakeText };
      const res = await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Document déposé avec succès');
      setDialogOpen(false); load();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(d: DocumentItem) {
    if (!confirm(`Supprimer "${d.title}" ?`)) return;
    const res = await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Document supprimé'); load(); }
  }

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.subject || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.uploadedBy && `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: docs.length,
    submitted: docs.filter(d => d.status === 'SUBMITTED').length,
    analyzed: docs.filter(d => d.status === 'ANALYZED').length,
    validated: docs.filter(d => d.status === 'VALIDATED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><FileText className="h-6 w-6 text-amber-600" /> Travaux & mémoires</h1>
          <p className="text-sm text-slate-500 mt-1">Dépôt et suivi des travaux académiques</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1.5" /> Déposer un travail</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Soumis</div><div className="text-2xl font-bold text-blue-600">{stats.submitted}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Analysés</div><div className="text-2xl font-bold text-purple-600">{stats.analyzed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Validés</div><div className="text-2xl font-bold text-emerald-600">{stats.validated}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Liste des travaux</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
           filtered.length === 0 ? <div className="text-center py-12"><FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500 mb-4">{search ? 'Aucun travail trouvé.' : 'Aucun travail déposé.'}</p>
             {!search && <Button onClick={openCreate} variant="outline"><Plus className="h-4 w-4 mr-1.5" />Déposer le premier travail</Button>}
           </div> :
           <div className="overflow-x-auto"><Table>
             <TableHeader><TableRow>
               <TableHead>Titre</TableHead><TableHead>Type</TableHead><TableHead>Auteur</TableHead>
               <TableHead>Faculté</TableHead><TableHead className="text-center">Statut</TableHead>
               <TableHead className="text-center">Score IA</TableHead><TableHead className="text-right">Actions</TableHead>
             </TableRow></TableHeader>
             <TableBody>
               {filtered.map(d => {
                 const st = STATUS_LABELS[d.status] || STATUS_LABELS.DRAFT;
                 const StIcon = st.icon;
                 return (
                   <TableRow key={d.id}>
                     <TableCell><div className="font-medium">{d.title}</div>{d.subject && <div className="text-xs text-slate-500 line-clamp-1">{d.subject}</div>}</TableCell>
                     <TableCell><Badge variant="outline">{d.type}</Badge></TableCell>
                     <TableCell className="text-sm">{d.uploadedBy ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}` : '—'}</TableCell>
                     <TableCell className="text-xs">{d.faculty || '—'}</TableCell>
                     <TableCell className="text-center"><Badge className={st.color}><StIcon className={`h-3 w-3 mr-1 ${d.status === 'ANALYZING' ? 'animate-spin' : ''}`} />{st.label}</Badge></TableCell>
                     <TableCell className="text-center">
                       {d.analysis?.globalScore !== undefined ? (
                         <Badge variant="outline" className={`font-mono ${(d.analysis.globalScore || 0) > 0.3 ? 'text-rose-600 border-rose-200' : 'text-emerald-600 border-emerald-200'}`}>
                           {((d.analysis.globalScore || 0) * 100).toFixed(1)}%
                         </Badge>
                       ) : <span className="text-xs text-slate-400">—</span>}
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center justify-end gap-1">
                         <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Détails">
                           <Link href={`/dashboard/documents/${d.id}`}><Eye className="h-4 w-4" /></Link>
                         </Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDelete(d)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                       </div>
                     </TableCell>
                   </TableRow>
                 );
               })}
             </TableBody>
           </Table></div>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Déposer un travail académique</DialogTitle>
            <DialogDescription>Renseignez les métadonnées et téléversez le fichier</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Upload zone */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-emerald-400 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileSelect} className="hidden" />
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              {form.fileName ? (
                <div>
                  <div className="text-sm font-medium text-slate-900">{form.fileName}</div>
                  <div className="text-xs text-slate-500">{(form.fileSize / 1024).toFixed(1)} Ko · {form.mimeType}</div>
                  <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0">Changer de fichier</Button>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-slate-700">Cliquez pour téléverser</div>
                  <div className="text-xs text-slate-500 mt-1">PDF, DOCX ou TXT (max 50 Mo)</div>
                </div>
              )}
            </div>

            <div className="space-y-2"><Label>Titre du travail</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Ex: Conception d'une plateforme..." /></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TFC">TFC (Travail de Fin de Cycle)</SelectItem>
                    <SelectItem value="MEMOIRE">Mémoire</SelectItem>
                    <SelectItem value="THESE">Thèse</SelectItem>
                    <SelectItem value="ARTICLE">Article scientifique</SelectItem>
                    <SelectItem value="AUTRE">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Année académique</Label><Input value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })} required /></div>
            </div>

            <div className="space-y-2"><Label>Sujet</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Sujet du travail" /></div>
            <div className="space-y-2"><Label>Résumé / Abstract</Label><Textarea value={form.abstract} onChange={e => setForm({ ...form, abstract: e.target.value })} rows={3} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Faculté</Label>
                <Select value={form.facultyId || 'none'} onValueChange={v => setForm({ ...form, facultyId: v === 'none' ? '' : v, departmentId: '', promotionId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Département</Label>
                <Select value={form.departmentId || 'none'} onValueChange={v => setForm({ ...form, departmentId: v === 'none' ? '' : v, promotionId: '' })} disabled={!form.facultyId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {departments.filter(d => d.facultyId === form.facultyId).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Promotion</Label>
                <Select value={form.promotionId || 'none'} onValueChange={v => setForm({ ...form, promotionId: v === 'none' ? '' : v })} disabled={!form.departmentId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {promotions.filter(p => p.departmentId === form.departmentId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Enseignant encadrant</Label>
                <Select value={form.supervisedById || 'none'} onValueChange={v => setForm({ ...form, supervisedById: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Déposer le travail</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
