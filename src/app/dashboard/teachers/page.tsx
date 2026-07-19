'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { UserCog, Loader2, Search, Users } from 'lucide-react';
import Link from 'next/link';

interface Teacher {
  id: string; firstName: string; lastName: string; email: string;
  faculty?: string | null; department?: string | null;
  isActive: boolean;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/users?role=TEACHER').then(r => r.json()).then(d => setTeachers(d.users || [])).finally(() => setLoading(false));
  }, []);

  const filtered = teachers.filter(t =>
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><UserCog className="h-6 w-6 text-emerald-600" /> Enseignants</h1>
        <p className="text-sm text-slate-500 mt-1">Corps enseignant de la plateforme</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Total enseignants</div><div className="text-2xl font-bold">{teachers.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Actifs</div><div className="text-2xl font-bold text-emerald-600">{teachers.filter(t => t.isActive).length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Liste des enseignants</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
           filtered.length === 0 ? <div className="text-center py-12"><Users className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Aucun enseignant inscrit.</p></div> :
           <Table>
             <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Faculté</TableHead><TableHead>Département</TableHead><TableHead className="text-center">Statut</TableHead></TableRow></TableHeader>
             <TableBody>
               {filtered.map(t => (
                 <TableRow key={t.id}>
                   <TableCell><div className="font-medium">{t.firstName} {t.lastName}</div><div className="text-xs text-slate-500">{t.email}</div></TableCell>
                   <TableCell className="text-sm">{t.faculty || '—'}</TableCell>
                   <TableCell className="text-sm">{t.department || '—'}</TableCell>
                   <TableCell className="text-center">{t.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>}
        </CardContent>
      </Card>
      <div className="text-xs text-slate-500 text-center">
        💡 Pour créer/modifier des enseignants, rendez-vous sur la <Link href="/dashboard/users" className="underline">page Utilisateurs</Link>.
      </div>
    </div>
  );
}
