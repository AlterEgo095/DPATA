'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText, Loader2, ShieldCheck } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-rose-100 text-rose-700',
  LOGIN: 'bg-slate-100 text-slate-700',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/audit').then(r => r.json()).then(d => setLogs(d.logs || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ScrollText className="h-6 w-6 text-slate-700" /> Journal d'audit</h1>
        <p className="text-sm text-slate-500 mt-1">Traçabilité complète des actions sur la plateforme</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{logs.length} entrées (200 plus récentes)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div> :
           logs.length === 0 ? <div className="text-center py-12"><ScrollText className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Aucune activité enregistrée.</p></div> :
           <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
             <Table>
               <TableHeader className="sticky top-0 bg-white">
                 <TableRow><TableHead>Action</TableHead><TableHead>Entité</TableHead><TableHead>Utilisateur</TableHead><TableHead>Détails</TableHead><TableHead>Date</TableHead></TableRow>
               </TableHeader>
               <TableBody>
                 {logs.map(log => {
                   const actionType = log.action.split('_')[0];
                   return (
                     <TableRow key={log.id}>
                       <TableCell><Badge className={ACTION_COLORS[actionType] || 'bg-slate-100'}>{log.action.replace(/_/g, ' ')}</Badge></TableCell>
                       <TableCell className="text-sm">{log.entity}</TableCell>
                       <TableCell className="text-sm flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-slate-400" />{log.userName || 'Système'}</TableCell>
                       <TableCell className="text-xs text-slate-500 max-w-xs truncate">{log.details || '—'}</TableCell>
                       <TableCell className="text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString('fr-FR')}</TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
           </div>}
        </CardContent>
      </Card>
    </div>
  );
}
