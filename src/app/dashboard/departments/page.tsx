'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Network, Pencil, Trash2, Search, Power, Loader2, Building2, Users, FileText, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface Faculty { id: string; code: string; name: string; }
interface Department {
  id: string; code: string; name: string; description?: string;
  isActive: boolean; facultyId: string; faculty: string;
  promotionsCount: number; usersCount: number; documentsCount: number;
  createdAt: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', facultyId: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/departments');
    const data = await res.json();
    setDepartments(data.departments || []);
    setFaculties(data.faculties || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', description: '', facultyId: faculties[0]?.id || '' });
    setDialogOpen(true);
  }
  function openEdit(d: Department) {
    setEditing(d);
    setForm({ code: d.code, name: d.name, description: d.description || '', facultyId: d.facultyId });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.facultyId) { toast.error('Sélectionnez une faculté'); return; }
    setSubmitting(true);
    try {
      const url = editing ? `/api/departments/${editing.id}` : '/api/departments';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(editing ? 'Département modifié' : 'Département créé');
      setDialogOpen(false);
      load();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(d: Department) {
    const res = await fetch(`/api/departments/${d.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    toast.success('Département supprimé');
    setDeleteTarget(null);
    load();
  }

  async function toggleActive(d: Department) {
    const res = await fetch(`/api/departments/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !d.isActive }) });
    if (res.ok) { toast.success(d.isActive ? 'Désactivé' : 'Activé'); load(); }
  }

  const filtered = departments.filter(d =>
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())) &&
    (filterFaculty === 'all' || d.facultyId === filterFaculty)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-600" /> Départements
          </h1>
          <p className="text-sm text-slate-500 mt-1">Sous-modules rattachés aux facultés</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700" disabled={faculties.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" /> Nouveau département
        </Button>
      </div>

      {faculties.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3 text-amber-800 text-sm">
            <Building2 className="h-5 w-5 shrink-0" />
            <div>
              Aucune faculté n'a encore été créée. <a href="/dashboard/faculties" className="font-semibold underline">Créez d'abord une faculté</a> avant d'ajouter des départements.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Total départements</div><div className="text-2xl font-bold">{departments.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Actifs</div><div className="text-2xl font-bold text-emerald-600">{departments.filter(d => d.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Promotions</div><div className="text-2xl font-bold text-purple-600">{departments.reduce((s, d) => s + d.promotionsCount, 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Utilisateurs</div><div className="text-2xl font-bold text-amber-600">{departments.reduce((s, d) => s + d.usersCount, 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Liste des départements</CardTitle>
            <div className="flex gap-2">
              <Select value={filterFaculty} onValueChange={setFilterFaculty}>
                <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Toutes les facultés" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les facultés</SelectItem>
                  {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
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
          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Network className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">{search || filterFaculty !== 'all' ? 'Aucun département trouvé.' : 'Aucun département créé.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Faculté</TableHead>
                    <TableHead className="text-center">Promotions</TableHead>
                    <TableHead className="text-center">Utilisateurs</TableHead>
                    <TableHead className="text-center">Travaux</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(d => (
                    <TableRow key={d.id}>
                      <TableCell><code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{d.code}</code></TableCell>
                      <TableCell><div className="font-medium">{d.name}</div>{d.description && <div className="text-xs text-slate-500 line-clamp-1">{d.description}</div>}</TableCell>
                      <TableCell><Badge variant="outline">{d.faculty}</Badge></TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="font-mono"><GraduationCap className="h-3 w-3 mr-1" />{d.promotionsCount}</Badge></TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="font-mono"><Users className="h-3 w-3 mr-1" />{d.usersCount}</Badge></TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="font-mono"><FileText className="h-3 w-3 mr-1" />{d.documentsCount}</Badge></TableCell>
                      <TableCell className="text-center">{d.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(d)} title={d.isActive ? 'Désactiver' : 'Activer'}><Power className={`h-4 w-4 ${d.isActive ? 'text-emerald-600' : 'text-slate-400'}`} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(d)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le département' : 'Nouveau département'}</DialogTitle>
            <DialogDescription>{editing ? 'Mettez à jour les informations.' : 'Créez un nouveau sous-module département.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facultyId">Faculté</Label>
              <Select value={form.facultyId} onValueChange={v => setForm({ ...form, facultyId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une faculté" /></SelectTrigger>
                <SelectContent>{faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name} ({f.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: INFO" required maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Mathématiques et Informatique" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea id="description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}{editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le département ?</AlertDialogTitle>
            <AlertDialogDescription>Vous allez supprimer <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}). Action irréversible.</AlertDialogDescription>
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
