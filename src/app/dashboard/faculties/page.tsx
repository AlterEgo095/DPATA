'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Building2, Pencil, Trash2, Search, Network, Users, FileText, Power, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Faculty {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  departmentsCount: number;
  usersCount: number;
  documentsCount: number;
}

export default function FacultiesPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Faculty | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/faculties');
    const data = await res.json();
    setFaculties(data.faculties || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', description: '' });
    setDialogOpen(true);
  }

  function openEdit(f: Faculty) {
    setEditing(f);
    setForm({ code: f.code, name: f.name, description: f.description || '' });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editing ? `/api/faculties/${editing.id}` : '/api/faculties';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erreur');
        return;
      }
      toast.success(editing ? 'Faculté modifiée' : 'Faculté créée avec succès');
      setDialogOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(f: Faculty) {
    const res = await fetch(`/api/faculties/${f.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Erreur');
      return;
    }
    toast.success('Faculté supprimée');
    setDeleteTarget(null);
    load();
  }

  async function toggleActive(f: Faculty) {
    const res = await fetch(`/api/faculties/${f.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !f.isActive }),
    });
    if (res.ok) {
      toast.success(f.isActive ? 'Faculté désactivée' : 'Faculté activée');
      load();
    }
  }

  const filtered = faculties.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-600" />
            Facultés
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gérez les facultés/modules de la plateforme universitaire intelligente
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvelle faculté
        </Button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Total facultés</div>
          <div className="text-2xl font-bold text-slate-900">{faculties.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Actives</div>
          <div className="text-2xl font-bold text-emerald-600">{faculties.filter(f => f.isActive).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Départements</div>
          <div className="text-2xl font-bold text-blue-600">{faculties.reduce((s, f) => s + f.departmentsCount, 0)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Utilisateurs</div>
          <div className="text-2xl font-bold text-purple-600">{faculties.reduce((s, f) => s + f.usersCount, 0)}</div>
        </CardContent></Card>
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Liste des facultés</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-4">
                {search ? 'Aucune faculté trouvée.' : 'Aucune faculté créée pour le moment.'}
              </p>
              {!search && (
                <Button onClick={openCreate} variant="outline">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Créer la première faculté
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="text-center">Départements</TableHead>
                    <TableHead className="text-center">Utilisateurs</TableHead>
                    <TableHead className="text-center">Travaux</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(f => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{f.code}</code>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{f.name}</div>
                        {f.description && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{f.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          <Network className="h-3 w-3 mr-1" />
                          {f.departmentsCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          <Users className="h-3 w-3 mr-1" />
                          {f.usersCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          <FileText className="h-3 w-3 mr-1" />
                          {f.documentsCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {f.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActive(f)}
                            title={f.isActive ? 'Désactiver' : 'Activer'}
                          >
                            <Power className={`h-4 w-4 ${f.isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(f)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(f)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Dialog création/édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la faculté' : 'Nouvelle faculté'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Mettez à jour les informations de la faculté.'
                : 'Créez un nouveau module faculté dans la plateforme.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Ex: FSC"
                required
                maxLength={20}
              />
              <p className="text-xs text-slate-500">Code court unique (2-20 caractères)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Faculté des Sciences"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Description courte de la faculté..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la faculté ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer la faculté <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}).
              Cette action est irréversible. Veuillez vous assurer qu'aucun département n'y est rattaché.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
