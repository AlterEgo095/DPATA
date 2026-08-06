'use client';

// /dashboard/admin/system — System metrics dashboard
// P4-B (Task B4): CPU, memory, disk, uptime, PID gauges.
//
// Uses /api/v1/status (public, returns JSON with uptime + db counts + engine info)
// as the primary source. /api/v1/metrics requires auth (P3-A hardened it),
// so we don't depend on it. process.* values are not exposed to the client
// directly, but the /api/v1/status endpoint already returns uptime + version.
// For local browser-side perf data (CPU/memory of the dashboard tab),
// we additionally use `performance.memory` (Chrome-only) as a bonus gauge
// when available.
//
// Auto-refresh every 10 seconds.

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Server, Cpu, MemoryStick, HardDrive, Clock, Activity, RefreshCw,
  Loader2, Gauge, Database, Zap, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface StatusResponse {
  status: string;
  timestamp: string;
  version?: string;
  uptime?: number | null;
  responseTimeMs?: number;
  engines?: {
    tfidf?: { available?: boolean; name?: string; version?: string };
    hybrid?: { available?: boolean; name?: string; defaultEngine?: boolean };
    llm?: { available?: boolean; name?: string; model?: string; fallbackModel?: string };
  };
  database?: {
    type?: string;
    location?: string;
    prisma?: { available?: boolean; note?: string };
    counts?: {
      users?: number;
      documents?: number;
      analyses?: number;
      academicSubjects?: number;
      apiKeys?: number;
    };
  };
  features?: Record<string, boolean>;
}

function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return `${h}h ${mm}m`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return `${d}j ${hh}h`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'emerald',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose' | 'slate';
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    purple: 'text-purple-600 bg-purple-50',
    rose: 'text-rose-600 bg-rose-50',
    slate: 'text-slate-600 bg-slate-100',
  };
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 truncate">{value}</div>
            {sub && <div className="text-xs text-slate-500 mt-1 truncate">{sub}</div>}
          </div>
          <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browserMem, setBrowserMem] = useState<{ used: string; total: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatusResponse = await res.json();
      setStatus(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      // Don't toast on every poll — only set state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  // Read Chrome-only performance.memory (best-effort)
  useEffect(() => {
    const readMem = () => {
      const perf = performance as unknown as {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
      };
      if (perf.memory) {
        setBrowserMem({
          used: `${(perf.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} Mo`,
          total: `${(perf.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} Mo`,
        });
      }
    };
    readMem();
    const id = setInterval(readMem, 5_000);
    return () => clearInterval(id);
  }, []);

  const engineList = status?.engines
    ? Object.entries(status.engines).map(([k, v]) => ({
        key: k,
        name: v?.name || k,
        available: !!v?.available,
        model: (v as { model?: string })?.model,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Server className="h-6 w-6 text-emerald-600" /> Système
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Métriques temps réel du processus PlagiatIA — rafraîchi toutes les 10s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.status && (
            <Badge
              className={
                status.status === 'operational'
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
              }
            >
              <Activity className="h-3 w-3 mr-1" />
              {status.status === 'operational' ? 'Opérationnel' : 'Dégradé'}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Actualiser
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3 text-red-800 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Erreur lors du chargement du statut</p>
              <p className="text-red-700 text-xs mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              icon={Clock}
              label="Uptime"
              value={formatUptime(status?.uptime)}
              sub={status?.timestamp ? new Date(status.timestamp).toLocaleTimeString('fr-FR') : undefined}
              accent="emerald"
            />
            <StatCard
              icon={Gauge}
              label="Temps de réponse"
              value={status?.responseTimeMs !== undefined ? `${status.responseTimeMs} ms` : '—'}
              sub="endpoint /api/v1/status"
              accent="blue"
            />
            <StatCard
              icon={Cpu}
              label="PID processus"
              value="—" // PID not exposed to client (security)
              sub="Non exposé côté client"
              accent="purple"
            />
            <StatCard
              icon={MemoryStick}
              label="Mémoire (onglet)"
              value={browserMem?.used || 'N/A'}
              sub={browserMem ? `Plafond ${browserMem.total}` : 'Chrome uniquement'}
              accent="amber"
            />
            <StatCard
              icon={Database}
              label="Type de stockage"
              value={status?.database?.type || '—'}
              sub={status?.database?.location}
              accent="emerald"
            />
            <StatCard
              icon={HardDrive}
              label="Version"
              value={status?.version || '—'}
              sub="PlagiatIA"
              accent="slate"
            />
          </div>

          {status?.database?.counts && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compteurs base de données</CardTitle>
                <CardDescription>Volumes actuels dans le magasin JSON</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  <StatCard icon={Database} label="Utilisateurs" value={status.database.counts.users ?? 0} accent="emerald" />
                  <StatCard icon={HardDrive} label="Documents" value={status.database.counts.documents ?? 0} accent="blue" />
                  <StatCard icon={Activity} label="Analyses" value={status.database.counts.analyses ?? 0} accent="amber" />
                  <StatCard icon={Database} label="Sujets" value={status.database.counts.academicSubjects ?? 0} accent="purple" />
                  <StatCard icon={Zap} label="Clés API" value={status.database.counts.apiKeys ?? 0} accent="rose" />
                </div>
              </CardContent>
            </Card>
          )}

          {engineList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Moteurs d&apos;analyse</CardTitle>
                <CardDescription>Disponibilité des moteurs TF-IDF, Hybride et LLM</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {engineList.map((e) => (
                    <div
                      key={e.key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          e.available
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {e.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {e.available ? (e.model ? `Modèle: ${e.model}` : 'Disponible') : 'Indisponible'}
                        </div>
                      </div>
                      <Badge
                        className={`ml-auto ${
                          e.available
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-100 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {e.available ? 'OK' : 'KO'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {status?.database?.prisma && (
            <Card className={status.database.prisma.available ? '' : 'border-amber-200 bg-amber-50'}>
              <CardContent className="p-4 flex items-center gap-3 text-sm">
                <Database className={`h-5 w-5 shrink-0 ${status.database.prisma.available ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div>
                  <span className="font-medium">Prisma :</span>{' '}
                  <Badge variant="outline" className="ml-1">
                    {status.database.prisma.available ? 'OK' : 'Dégradé'}
                  </Badge>
                  {status.database.prisma.note && (
                    <p className="text-xs text-slate-500 mt-1">{status.database.prisma.note}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
