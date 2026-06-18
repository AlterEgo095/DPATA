'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { BookOpen, Loader2, Search, Users, FileText } from 'lucide-react';
import Link from 'next/link';

interface Student {
  id: string; firstName: string; lastName: string; email: string; matricule?: string;
  faculty?: string | null; department?: string | null; promotion?: string | null;
  isActive: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/users?role=STUDENT').then(r => r.json()).then(d => setStudents(d.users || [])).finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.matricule || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><BookOpen className="h-6 w-6 text-slate-700" /> Étudiants</h1>
        <p className="text-sm text-slate-500 mt-1">Liste des étudiants inscrits sur la plateforme</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Total étudiants</div><div className="text-2xl font-bold">{students.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Actifs</div><div className="text-2xl font-bold text-emerald-600">{students.filter(s => s.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500 uppercase mb-1">Avec matricule</div><div className="text-2xl font-bold text-blue-600">{students.filter(s => s.matricule).length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Liste des étudiants</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
           filtered.length === 0 ? <div className="text-center py-12"><Users className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Aucun étudiant inscrit.</p></div> :
           <Table>
             <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Matricule</TableHead><TableHead>Faculté</TableHead><TableHead>Département</TableHead><TableHead>Promotion</TableHead><TableHead className="text-center">Statut</TableHead></TableRow></TableHeader>
             <TableBody>
               {filtered.map(s => (
                 <TableRow key={s.id}>
                   <TableCell><div className="font-medium">{s.firstName} {s.lastName}</div><div className="text-xs text-slate-500">{s.email}</div></TableCell>
                   <TableCell>{s.matricule ? <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{s.matricule}</code> : <span className="text-xs text-slate-400">—</span>}</TableCell>
                   <TableCell className="text-xs">{s.faculty || '—'}</TableCell>
                   <TableCell className="text-xs">{s.department || '—'}</TableCell>
                   <TableCell className="text-xs">{s.promotion || '—'}</TableCell>
                   <TableCell className="text-center">{s.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>}
        </CardContent>
      </Card>
      <div className="text-xs text-slate-500 text-center">
        💡 Pour créer/modifier des étudiants, rendez-vous sur la <Link href="/dashboard/users" className="underline">page Utilisateurs</Link>.
      </div>
    </div>
  );
}
