'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, GraduationCap, Pencil, Trash2, Search, Power, Loader2, Users, FileText, Network } from 'lucide-react';
import { toast } from 'sonner';

interface Department { id: string; name: string; code: string; facultyId: string; faculty: string; }
interface Promotion {
  id: string; code: string; name: string; level: string; academicYear: string;
  isActive: boolean; departmentId: string; department: string; faculty: string;
  studentsCount: number; documentsCount: number; createdAt: string;
}

const LEVELS = ['L1', 'L2', 'L3', 'G1', 'G2', 'G3', 'M1', 'M2', 'Doctorat', 'Propédeutique'];

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [form, setForm] = useState({ code: '', name: '', level: 'L1', academicYear: '2025-2026', departmentId: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/promotions');
    const data = await res.json();
    setPromotions(data.promotions || []);
    setDepartments(data.departments || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', level: 'L1', academicYear: '2025-2026', departmentId: departments[0]?.id || '' });
    setDialogOpen(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({ code: p.code, name: p.name, level: p.level, academicYear: p.academicYear, departmentId: p.departmentId });
    setDialogOpen(true);
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.departmentId) { toast.error('Sélectionnez un département'); return; }
    setSubmitting(true);
    try {
      const url = editing ? `/api/promotions/${editing.id}` : '/api/promotions';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(editing ? 'Promotion modifiée' : 'Promotion créée');
      setDialogOpen(false); load();
    } finally { setSubmitting(false); }
  }
  async function handleDelete(p: Promotion) {
    const res = await fetch(`/api/promotions/${p.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    toast.success('Promotion supprimée');
    setDeleteTarget(null); load();
  }
  async function toggleActive(p: Promotion) {
    const res = await fetch(`/api/promotions/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !p.isActive }) });
    if (res.ok) { toast.success(p.isActive ? 'Désactivée' : 'Activée'); load(); }
  }
  const filtered = promotions.filter(p =>
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())) &&
    (filterDept === 'all' || p.departmentId === filterDept)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><GraduationCap className="h-6 w-6 text-purple-600" /> Promotions</h1>
          <p className="text-sm text-slate-500 mt-1">Niveaux académiques et années</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700" disabled={departments.length === 0}><Plus className="h-4 w-4 mr-1.5" /> Nouvelle promotion</Button>
      </div>

      {departments.length === 0 && (
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4 flex items-center gap-3 text-amber-800 text-sm">
          <Network className="h-5 w-5 shrink-0" />
          <div>Aucun département n'existe. <a href="/dashboard/departments" className="font-semibold underline">Créez d'abord un département</a>.</div>
        </CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Liste des promotions</CardTitle>
            <div className="flex gap-2">
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Tous les départements" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.faculty})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
           filtered.length === 0 ? <div className="text-center py-12"><GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Aucune promotion.</p></div> :
           <div className="overflow-x-auto"><Table>
             <TableHeader><TableRow>
               <TableHead>Code</TableHead><TableHead>Nom</TableHead><TableHead>Niveau</TableHead>
               <TableHead>Année</TableHead><TableHead>Département</TableHead><TableHead>Faculté</TableHead>
               <TableHead className="text-center">Étudiants</TableHead><TableHead className="text-center">Travaux</TableHead>
               <TableHead className="text-center">Statut</TableHead><TableHead className="text-right">Actions</TableHead>
             </TableRow></TableHeader>
             <TableBody>
               {filtered.map(p => (
                 <TableRow key={p.id}>
                   <TableCell><code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{p.code}</code></TableCell>
                   <TableCell><div className="font-medium">{p.name}</div></TableCell>
                   <TableCell><Badge variant="outline">{p.level}</Badge></TableCell>
                   <TableCell><span className="text-xs font-mono">{p.academicYear}</span></TableCell>
                   <TableCell className="text-sm">{p.department}</TableCell>
                   <TableCell className="text-xs text-slate-500">{p.faculty}</TableCell>
                   <TableCell className="text-center"><Badge variant="outline" className="font-mono"><Users className="h-3 w-3 mr-1" />{p.studentsCount}</Badge></TableCell>
                   <TableCell className="text-center"><Badge variant="outline" className="font-mono"><FileText className="h-3 w-3 mr-1" />{p.documentsCount}</Badge></TableCell>
                   <TableCell className="text-center">{p.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                   <TableCell>
                     <div className="flex items-center justify-end gap-1">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(p)}><Power className={`h-4 w-4 ${p.isActive ? 'text-emerald-600' : 'text-slate-400'}`} /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(p)}><Trash2 className="h-4 w-4" /></Button>
                     </div>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table></div>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la promotion' : 'Nouvelle promotion'}</DialogTitle>
            <DialogDescription>{editing ? 'Mettez à jour les informations.' : 'Créez une nouvelle promotion.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Département</Label>
              <Select value={form.departmentId} onValueChange={v => setForm({ ...form, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un département" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} — {d.faculty}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="L2-INFO-2025" required /></div>
              <div className="space-y-2"><Label>Niveau</Label>
                <Select value={form.level} onValueChange={v => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Nom</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="L2 Informatique" required /></div>
            <div className="space-y-2"><Label>Année académique</Label><Input value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })} placeholder="2025-2026" required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer la promotion ?</AlertDialogTitle>
            <AlertDialogDescription>Vous allez supprimer <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
