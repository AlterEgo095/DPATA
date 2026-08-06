'use client';

// /dashboard/admin/health — Health checks dashboard
// P4-B (Task B5): three health probe cards (Liveness, Readiness, Status)
// + collapsible JSON viewer. Auto-refresh every 30 seconds.

import { useEffect, useState, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HeartPulse, Activity, CheckCircle2, XCircle, RefreshCw, Loader2,
  ChevronDown, AlertTriangle,
} from 'lucide-react';

interface ProbeState {
  loading: boolean;
  ok: boolean | null; // null = unknown/not run
  status: number | null;
  data: unknown;
  error?: string;
  fetchedAt?: string;
}

const INITIAL: ProbeState = { loading: true, ok: null, status: null, data: null };

function HealthCard({
  icon: Icon,
  title,
  description,
  endpoint,
  state,
  onRefresh,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  endpoint: string;
  state: ProbeState;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-1 truncate">{description}</CardDescription>
              <code className="text-xs font-mono text-slate-500 break-all">{endpoint}</code>
            </div>
          </div>
          <div className="shrink-0">
            {state.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : state.ok === true ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : state.ok === false ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono">
            HTTP {state.status ?? '—'}
          </Badge>
          <Badge
            className={
              state.ok === true
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                : state.ok === false
                ? 'bg-red-100 text-red-700 hover:bg-red-100'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-100'
            }
          >
            {state.ok === true ? 'OK' : state.ok === false ? 'Erreur' : 'En attente'}
          </Badge>
          {state.fetchedAt && (
            <span className="text-xs text-slate-500">
              {new Date(state.fetchedAt).toLocaleTimeString('fr-FR')}
            </span>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onRefresh} disabled={state.loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {state.error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
            {state.error}
          </div>
        )}

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              <span>Réponse JSON</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 p-3 rounded-md bg-slate-900 text-slate-100 text-xs overflow-auto max-h-72">
              {state.data === null
                ? '(aucune donnée)'
                : JSON.stringify(state.data, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function HealthPage() {
  const [live, setLive] = useState<ProbeState>(INITIAL);
  const [ready, setReady] = useState<ProbeState>(INITIAL);
  const [status, setStatus] = useState<ProbeState>(INITIAL);

  const fetchProbe = useCallback(
    async (
      endpoint: string,
      setter: (s: ProbeState) => void
    ): Promise<void> => {
      setter({ loading: true, ok: null, status: null, data: null });
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        const text = await res.text();
        let parsed: unknown = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep raw text
        }
        setter({
          loading: false,
          ok: res.ok,
          status: res.status,
          data: parsed,
          fetchedAt: new Date().toISOString(),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur réseau';
        setter({
          loading: false,
          ok: false,
          status: null,
          data: null,
          error: msg,
          fetchedAt: new Date().toISOString(),
        });
      }
    },
    []
  );

  const refreshAll = useCallback(() => {
    fetchProbe('/api/v1/health/live', setLive);
    fetchProbe('/api/v1/health/ready', setReady);
    fetchProbe('/api/v1/status', setStatus);
  }, [fetchProbe]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
  }, [refreshAll]);

  const allOk =
    !live.loading && !ready.loading && !status.loading &&
    live.ok === true && ready.ok === true && status.ok === true;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-emerald-600" /> Health Checks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sondes Kubernetes: liveness, readiness, status — rafraîchi toutes les 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              allOk
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
            }
          >
            <Activity className="h-3 w-3 mr-1" />
            {allOk ? 'Tous sains' : 'Vérification…'}
          </Badge>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {live.loading && ready.loading && status.loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <HealthCard
            icon={HeartPulse}
            title="Liveness"
            description="Le processus répond-il ?"
            endpoint="/api/v1/health/live"
            state={live}
            onRefresh={() => fetchProbe('/api/v1/health/live', setLive)}
          />
          <HealthCard
            icon={CheckCircle2}
            title="Readiness"
            description="L&apos;app est-elle prête à servir ?"
            endpoint="/api/v1/health/ready"
            state={ready}
            onRefresh={() => fetchProbe('/api/v1/health/ready', setReady)}
          />
          <HealthCard
            icon={Activity}
            title="Status"
            description="Statut global de la plateforme"
            endpoint="/api/v1/status"
            state={status}
            onRefresh={() => fetchProbe('/api/v1/status', setStatus)}
          />
        </div>
      )}
    </div>
  );
}
