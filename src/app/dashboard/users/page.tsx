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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, Pencil, Trash2, Search, Power, Loader2, Mail, Shield, IdCard } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string; email: string; firstName: string; lastName: string; matricule?: string;
  role: string; isActive: boolean;
  facultyId?: string; departmentId?: string; promotionId?: string;
  faculty?: string | null; department?: string | null; promotion?: string | null;
  createdAt: string;
}
interface Faculty { id: string; name: string; code: string; }
interface Department { id: string; name: string; code: string; facultyId: string; }
interface Promotion { id: string; name: string; code: string; departmentId: string; }

const ROLE_LABELS: Record<string, string> = {
  FACULTY_ADMIN: 'Admin Faculté', TEACHER: 'Enseignant', STUDENT: 'Étudiant',
};
const ROLE_COLORS: Record<string, string> = {
  FACULTY_ADMIN: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  TEACHER: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  STUDENT: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tabRole, setTabRole] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', matricule: '',
    role: 'STUDENT', facultyId: '', departmentId: '', promotionId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
    setFaculties(data.faculties || []);
    setDepartments(data.departments || []);
    setPromotions(data.promotions || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate(role: string = 'STUDENT') {
    setEditing(null);
    setForm({ email: '', password: '', firstName: '', lastName: '', matricule: '', role, facultyId: '', departmentId: '', promotionId: '' });
    setDialogOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setForm({ email: u.email, password: '', firstName: u.firstName, lastName: u.lastName, matricule: u.matricule || '', role: u.role, facultyId: u.facultyId || '', departmentId: u.departmentId || '', promotionId: u.promotionId || '' });
    setDialogOpen(true);
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (payload.role !== 'STUDENT') { payload.promotionId = ''; payload.departmentId = ''; }
      if (payload.role === 'FACULTY_ADMIN') { payload.departmentId = ''; payload.promotionId = ''; }
      const url = editing ? `/api/users/${editing.id}` : '/api/users';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(editing ? 'Utilisateur modifié' : 'Utilisateur créé');
      setDialogOpen(false); load();
    } finally { setSubmitting(false); }
  }
  async function handleDelete(u: User) {
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    toast.success('Utilisateur supprimé');
    setDeleteTarget(null); load();
  }
  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !u.isActive }) });
    if (res.ok) { toast.success(u.isActive ? 'Désactivé' : 'Activé'); load(); }
  }

  const filtered = users.filter(u =>
    (u.firstName.toLowerCase().includes(search.toLowerCase()) ||
     u.lastName.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()) ||
     (u.matricule || '').toLowerCase().includes(search.toLowerCase())) &&
    (tabRole === 'all' || u.role === tabRole)
  );

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'STUDENT').length,
    teachers: users.filter(u => u.role === 'TEACHER').length,
    admins: users.filter(u => u.role === 'FACULTY_ADMIN').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Users className="h-6 w-6 text-purple-600" /> Utilisateurs</h1>
          <p className="text-sm text-slate-500 mt-1">Étudiants, enseignants et administrateurs</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openCreate('STUDENT')} variant="outline" className="border-slate-300"><Plus className="h-4 w-4 mr-1.5" /> Étudiant</Button>
          <Button onClick={() => openCreate('TEACHER')} variant="outline" className="border-emerald-300 text-emerald-700"><Plus className="h-4 w-4 mr-1.5" /> Enseignant</Button>
          <Button onClick={() => openCreate('FACULTY_ADMIN')} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-1.5" /> Admin Faculté</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Étudiants</div><div className="text-2xl font-bold text-slate-700">{stats.students}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Enseignants</div><div className="text-2xl font-bold text-emerald-600">{stats.teachers}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Admins</div><div className="text-2xl font-bold text-blue-600">{stats.admins}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs value={tabRole} onValueChange={setTabRole}>
              <TabsList>
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="STUDENT">Étudiants</TabsTrigger>
                <TabsTrigger value="TEACHER">Enseignants</TabsTrigger>
                <TabsTrigger value="FACULTY_ADMIN">Admins</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
           filtered.length === 0 ? <div className="text-center py-12"><Users className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Aucun utilisateur.</p></div> :
           <div className="overflow-x-auto"><Table>
             <TableHeader><TableRow>
               <TableHead>Nom</TableHead><TableHead>Email</TableHead><TableHead>Matricule</TableHead>
               <TableHead>Rôle</TableHead><TableHead>Faculté</TableHead><TableHead>Département</TableHead>
               <TableHead className="text-center">Statut</TableHead><TableHead className="text-right">Actions</TableHead>
             </TableRow></TableHeader>
             <TableBody>
               {filtered.map(u => (
                 <TableRow key={u.id}>
                   <TableCell><div className="font-medium">{u.firstName} {u.lastName}</div></TableCell>
                   <TableCell><div className="text-xs flex items-center gap-1 text-slate-600"><Mail className="h-3 w-3" />{u.email}</div></TableCell>
                   <TableCell>{u.matricule ? <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{u.matricule}</code> : <span className="text-xs text-slate-400">—</span>}</TableCell>
                   <TableCell><Badge className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge></TableCell>
                   <TableCell className="text-xs">{u.faculty || <span className="text-slate-400">—</span>}</TableCell>
                   <TableCell className="text-xs">{u.department || (u.role === 'STUDENT' ? <span className="text-slate-400">—</span> : '—')}</TableCell>
                   <TableCell className="text-center">{u.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                   <TableCell>
                     <div className="flex items-center justify-end gap-1">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(u)}><Power className={`h-4 w-4 ${u.isActive ? 'text-emerald-600' : 'text-slate-400'}`} /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(u)}><Trash2 className="h-4 w-4" /></Button>
                     </div>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table></div>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
            <DialogDescription>{editing ? 'Mettez à jour les informations.' : 'Créez un nouveau compte utilisateur.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Prénom</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Nom</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{editing ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe'}</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editing} minLength={6} /></div>
              <div className="space-y-2"><Label>Matricule (étudiants)</Label><Input value={form.matricule} onChange={e => setForm({ ...form, matricule: e.target.value })} placeholder="Ex: 21-INF-001" /></div>
            </div>
            <div className="space-y-2"><Label>Rôle</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Étudiant</SelectItem>
                  <SelectItem value="TEACHER">Enseignant</SelectItem>
                  <SelectItem value="FACULTY_ADMIN">Administrateur Faculté</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Faculté</Label>
              <Select value={form.facultyId || 'none'} onValueChange={v => setForm({ ...form, facultyId: v === 'none' ? '' : v, departmentId: '', promotionId: '' })}>
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.role === 'STUDENT' || form.role === 'TEACHER') && form.facultyId && (
              <div className="space-y-2"><Label>Département</Label>
                <Select value={form.departmentId || 'none'} onValueChange={v => setForm({ ...form, departmentId: v === 'none' ? '' : v, promotionId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {departments.filter(d => d.facultyId === form.facultyId).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.role === 'STUDENT' && form.departmentId && (
              <div className="space-y-2"><Label>Promotion</Label>
                <Select value={form.promotionId || 'none'} onValueChange={v => setForm({ ...form, promotionId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {promotions.filter(p => p.departmentId === form.departmentId).map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>Vous allez supprimer <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong> ({deleteTarget?.email}).</AlertDialogDescription>
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
