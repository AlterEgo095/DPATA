'use client';

// /dashboard/admin/sessions — Active JWT sessions viewer
// P4-B (Task B3): list active sessions with force-logout action.
//
// Calls /api/admin/sessions (POST/GET) — endpoint implemented by P4-A (Fix A10).
// While the endpoint returns 404 (before P4-A deploys), the page shows a
// graceful "endpoint not yet available" empty state instead of crashing.
// Force-logout calls POST /api/users/{id}/force-logout.

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Monitor, Loader2, RefreshCw, ShieldOff, WifiOff, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Session {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity?: string; // ISO
  createdAt?: string;
  status?: 'active' | 'idle' | 'expired';
}

function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '—';
  const diff = Date.now() - d;
  if (diff < 60_000) return 'il y a quelques secondes';
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

function truncate(s: string | undefined, n = 40): string {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Session | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sessions', { cache: 'no-store' });
      if (res.status === 404) {
        setEndpointMissing(true);
        setSessions([]);
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : (Array.isArray(data) ? data : []));
      setEndpointMissing(false);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      // Don't toast on every poll cycle — only set empty state
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  async function handleForceLogout(s: Session) {
    setRevoking(s.id);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(s.userId)}/force-logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 404) {
        toast.error('Endpoint de déconnexion forcée non disponible (P4-A requis)');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success(`Session de ${s.userName} révoquée`);
      setRevokeTarget(null);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error('Erreur lors de la révocation', { description: msg });
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Monitor className="h-6 w-6 text-emerald-600" /> Sessions Actives
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Surveillez et révoquez les sessions JWT actives
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            Auto-refresh 30s
          </label>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Actualiser
          </Button>
        </div>
      </div>

      {endpointMissing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3 text-amber-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Endpoint <code className="font-mono bg-amber-100 px-1 rounded">/api/admin/sessions</code> non disponible</p>
              <p className="mt-1 text-amber-700">
                Cette page est prête. L&apos;endpoint backend sera déployé par P4-A (Fix A10).
                En attendant, aucune session n&apos;est listée.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions actives ({sessions.length})</CardTitle>
          <CardDescription>Liste des utilisateurs connectés avec un JWT valide</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <WifiOff className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {endpointMissing
                  ? 'En attente du déploiement de l\'endpoint sessions (P4-A).'
                  : 'Aucune session active.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead>Adresse IP</TableHead>
                    <TableHead>User Agent</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{s.userName || '—'}</div>
                        {s.userEmail && (
                          <div className="text-xs text-slate-500">{s.userEmail}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {relativeTime(s.lastActivity || s.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-mono">{s.ipAddress || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-xs">
                        <span title={s.userAgent}>{truncate(s.userAgent, 40)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {(!s.status || s.status === 'active') ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                        ) : s.status === 'idle' ? (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Idle</Badge>
                        ) : (
                          <Badge variant="secondary">Expirée</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setRevokeTarget(s)}
                          disabled={revoking === s.id}
                        >
                          {revoking === s.id ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <ShieldOff className="h-4 w-4 mr-1.5" />
                          )}
                          Forcer déconnexion
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer la session ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez forcer la déconnexion de{' '}
              <strong>{revokeTarget?.userName}</strong>
              {revokeTarget?.userEmail ? ` (${revokeTarget.userEmail})` : ''}.
              L&apos;utilisateur devra se reconnecter. Action immédiate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && handleForceLogout(revokeTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              Forcer la déconnexion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
