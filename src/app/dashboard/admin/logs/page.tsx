'use client';

// /dashboard/admin/logs — Audit log viewer with filters + export
// P4-B (Task B6): Filters bar (action, entity, user, date range, search) +
// CSV/JSON export buttons + pagination + auto-refresh toggle.
//
// Calls GET /api/audit?action=...&entity=...&userId=...&dateFrom=...&dateTo=...&sortBy=...&limit=50&offset=0
// (endpoint already supports all these filters as of P2-B).
// Export uses GET /api/export?type=audit&format=csv|json&search=...&dateFrom=...&dateTo=...
// (existing endpoint, SUPER_ADMIN only).

import { useEffect, useState, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileSearch, Loader2, RefreshCw, Download, ChevronLeft, ChevronRight,
  ChevronDown, Search, Filter, RotateCcw, AlertCircle, Inbox,
} from 'lucide-react';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

interface AuditResponse {
  data?: AuditLog[];
  logs?: AuditLog[];
  meta?: {
    availableActions?: string[];
    availableEntities?: string[];
    totalLogs?: number;
    total?: number;
    page?: number;
    totalPages?: number;
    limit?: number;
    offset?: number;
  };
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    offset?: number;
  };
  filters?: Record<string, string | null>;
}

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  UPDATE: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  DELETE: 'bg-rose-100 text-rose-700 hover:bg-rose-100',
  LOGIN: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  LOGOUT: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
};

function actionColor(action: string): string {
  const prefix = action.split('_')[0].toUpperCase();
  return ACTION_COLORS[prefix] || 'bg-slate-100 text-slate-700 hover:bg-slate-100';
}

function buildQuery(params: {
  action: string;
  entity: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  offset: number;
  limit: number;
}): string {
  const q = new URLSearchParams();
  q.set('limit', String(params.limit));
  q.set('offset', String(params.offset));
  q.set('sortBy', 'createdAt');
  q.set('sortOrder', 'desc');
  if (params.action && params.action !== 'all') q.set('action', params.action);
  if (params.entity && params.entity !== 'all') q.set('entity', params.entity);
  if (params.userId) q.set('userId', params.userId);
  if (params.dateFrom) q.set('dateFrom', params.dateFrom);
  if (params.dateTo) q.set('dateTo', params.dateTo);
  if (params.search) q.set('search', params.search);
  return q.toString();
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);

  // Filter form state (committed on "Apply")
  const [action, setAction] = useState('all');
  const [entity, setEntity] = useState('all');
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Committed filters
  const [committed, setCommitted] = useState({
    action: 'all',
    entity: 'all',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery({ ...committed, offset, limit: PAGE_SIZE });
      const res = await fetch(`/api/audit?${qs}`, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: AuditResponse = await res.json();
      const list = data.data || data.logs || [];
      setLogs(list);
      const t =
        data.meta?.total ??
        data.pagination?.total ??
        data.meta?.totalLogs ??
        list.length;
      setTotal(t);
      if (data.meta?.availableActions) setAvailableActions(data.meta.availableActions);
      if (data.meta?.availableEntities) setAvailableEntities(data.meta.availableEntities);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [committed, offset]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  function applyFilters() {
    setCommitted({ action, entity, userId, dateFrom, dateTo, search });
    setOffset(0);
  }

  function resetFilters() {
    setAction('all');
    setEntity('all');
    setUserId('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setCommitted({ action: 'all', entity: 'all', userId: '', dateFrom: '', dateTo: '', search: '' });
    setOffset(0);
  }

  function exportUrl(format: 'csv' | 'json'): string {
    const q = new URLSearchParams();
    q.set('type', 'audit');
    q.set('format', format);
    if (committed.search) q.set('search', committed.search);
    if (committed.dateFrom) q.set('dateFrom', committed.dateFrom);
    if (committed.dateTo) q.set('dateTo', committed.dateTo);
    return `/api/export?${q.toString()}`;
  }

  async function handleExport(format: 'csv' | 'json') {
    try {
      const url = exportUrl(format);
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      const filename = `audit_export.${format}`;
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success(`Export ${format.toUpperCase()} téléchargé`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error('Erreur lors de l\'export', { description: msg });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-emerald-600" /> Journaux d&apos;Audit
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Recherche filtrée dans les {total.toLocaleString('fr-FR')} entrées d&apos;audit
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="h-4 w-4 mr-1.5" /> Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtres
          </CardTitle>
          <CardDescription>Affinez la liste par action, entité, utilisateur ou plage de dates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-action" className="text-xs">Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="filter-action"><SelectValue placeholder="Toutes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les actions</SelectItem>
                  {availableActions.length > 0
                    ? availableActions.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)
                    : ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-entity" className="text-xs">Entité</Label>
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger id="filter-entity"><SelectValue placeholder="Toutes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les entités</SelectItem>
                  {availableEntities.length > 0
                    ? availableEntities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)
                    : ['user', 'faculty', 'department', 'promotion', 'subject', 'document', 'analysis', 'batch', 'apiKey'].map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-userId" className="text-xs">ID utilisateur</Label>
              <Input
                id="filter-userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_xxx"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-from" className="text-xs">Date de</Label>
              <Input
                id="filter-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-to" className="text-xs">Date jusqu&apos;à</Label>
              <Input
                id="filter-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-search" className="text-xs">Recherche texte</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="filter-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="nom, action, détails…"
                  className="pl-8 h-9"
                  onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              Auto-refresh 30s
            </label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Réinitialiser
              </Button>
              <Button size="sm" onClick={applyFilters} className="bg-emerald-600 hover:bg-emerald-700">
                <Filter className="h-3.5 w-3.5 mr-1.5" /> Appliquer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3 text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Erreur lors du chargement</p>
              <p className="text-red-700 text-xs mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {logs.length} entrée{logs.length > 1 ? 's' : ''} — page {currentPage} / {totalPages}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Aucune entrée trouvée pour ces filtres.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Horodatage</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && logs.length > 0 && (
            <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
              <span className="text-xs text-slate-500">
                {offset + 1}–{Math.min(offset + logs.length, total)} sur {total.toLocaleString('fr-FR')}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Suivant <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  return (
    <TableRow>
      <TableCell className="text-xs whitespace-nowrap text-slate-600">
        {new Date(log.createdAt).toLocaleString('fr-FR')}
      </TableCell>
      <TableCell className="text-sm">{log.userName || 'Système'}</TableCell>
      <TableCell>
        <Badge className={actionColor(log.action)}>{log.action.replace(/_/g, ' ')}</Badge>
      </TableCell>
      <TableCell className="text-sm">{log.entity || '—'}</TableCell>
      <TableCell className="text-xs font-mono text-slate-500">{log.ipAddress || '—'}</TableCell>
      <TableCell className="text-xs text-slate-600 max-w-xs">
        {log.details ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <div className="flex items-center gap-1">
              <span className={open ? '' : 'truncate'}>{log.details}</span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-5 px-1 shrink-0">
                  <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <pre className="mt-1 p-2 rounded bg-slate-100 text-[10px] whitespace-pre-wrap break-all">
                {log.details}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  );
}
