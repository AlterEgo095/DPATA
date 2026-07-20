'use client';

// Page Dashboard Batch - Analyses Groupées
// Interface complète pour gérer les analyses batch de plagiat
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Layers, RefreshCw, Plus, AlertCircle, CheckCircle2,
  Clock, XCircle, Loader2, ArrowLeft, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BatchCard } from '@/components/batch/batch-card';
import { BatchProgress } from '@/components/batch/batch-progress';
import { BatchResults } from '@/components/batch/batch-results';
import { CreateBatchForm } from '@/components/batch/create-batch-form';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

interface BatchJobData {
  id: string;
  name: string;
  status: string;
  progress: number;
  totalDocs: number;
  processedDocs?: number;
  failedDocs?: number;
  config: string;
  createdBy: string;
  creatorName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  results?: string;
  error?: string;
}

interface BatchResultItem {
  documentId: string;
  documentTitle: string;
  status: 'completed' | 'failed' | 'skipped' | 'timeout';
  globalScore?: number;
  matchedSegments?: number;
  totalSegments?: number;
  matchesCount?: number;
  processingTimeMs?: number;
  error?: string;
  analyzedAt?: string;
  matchTypes?: Record<string, number>;
}

type ViewMode = 'list' | 'create' | 'detail';

// ============================================================
// PAGE PRINCIPALE
// ============================================================

export default function BatchDashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [jobs, setJobs] = useState<BatchJobData[]>([]);
  const [selectedJob, setSelectedJob] = useState<BatchJobData | null>(null);
  const [jobResults, setJobResults] = useState<BatchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Charger les jobs
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      
      const response = await fetch(`/api/batch?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching batch jobs:', error);
      toast.error('Erreur lors du chargement des jobs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Auto-refresh pour les jobs en cours
  useEffect(() => {
    fetchJobs();
    
    let interval: NodeJS.Timeout | undefined;
    if (autoRefresh) {
      interval = setInterval(fetchJobs, 5000); // Refresh toutes les 5s
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchJobs, autoRefresh]);

  // Détecter s'il y a des jobs actifs pour auto-refresh
  useEffect(() => {
    const hasActiveJobs = jobs.some(j => j.status === 'running');
    setAutoRefresh(hasActiveJobs);
  }, [jobs]);

  // Voir détails d'un job
  const handleViewDetails = async (jobId: string) => {
    try {
      const response = await fetch(`/api/batch/${jobId}?action=results`);
      if (response.ok) {
        const data = await response.json();
        const job = jobs.find(j => j.id === jobId) || null;
        
        if (job) {
          setSelectedJob(job);
          setJobResults(data.report?.detailedResults || []);
          setViewMode('detail');
        }
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('Erreur lors du chargement des détails');
    }
  };

  // Annuler un job
  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce job ?')) return;

    try {
      const response = await fetch(`/api/batch/${jobId}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Job annulé avec succès');
        fetchJobs();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erreur lors de l\'annulation');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  // Exporter un job
  const handleExport = async (jobId: string, format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await fetch(`/api/batch/${jobId}?action=export&format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch-${jobId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Export ${format.toUpperCase()} téléchargé`);
      }
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  // Créer un nouveau job
  const handleCreateBatch = async (data: {
    name: string;
    documentIds: string[];
    config: any;
  }) => {
    setCreating(true);
    try {
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Job "${result.job.name}" créé avec succès !`);
        setViewMode('list');
        fetchJobs();

        // Optionnel: démarrer le job automatiquement
        // Pour l'instant, on laisse l'utilisateur le lancer depuis la liste
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du job');
    } finally {
      setCreating(false);
    }
  };

  // Stats globales
  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            {viewMode !== 'list' && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => { setViewMode('list'); setSelectedJob(null); }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Layers className="h-7 w-7 text-emerald-600" />
            Analyses Groupées
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Lancez des analyses de plagiat sur plusieurs documents simultanément
          </p>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'list' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchJobs}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                Actualiser
              </Button>
              
              <Button
                onClick={() => setViewMode('create')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Batch
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Vue Liste */}
      {viewMode === 'list' && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total" value={stats.total} icon={<Layers className="h-5 w-5" />} color="slate" />
            <StatCard label="En attente" value={stats.pending} icon={<Clock className="h-5 w-5" />} color="amber" />
            <StatCard label="En cours" value={stats.running} icon={<Loader2 className="h-5 w-5 animate-spin" />} color="blue" pulse={stats.running > 0} />
            <StatCard label="Terminés" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
            <StatCard label="Échoués" value={stats.failed} icon={<XCircle className="h-5 w-5" />} color="red" />
            <StatCard label="Annulés" value={stats.cancelled} icon={<XCircle className="h-5 w-5" />} color="slate" />
          </div>

          {/* Filtres */}
          <div className="flex items-center justify-between">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les jobs</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="running">En cours</SelectItem>
                <SelectItem value="completed">Terminés</SelectItem>
                <SelectItem value="failed">Échoués</SelectItem>
                <SelectItem value="cancelled">Annulés</SelectItem>
              </SelectContent>
            </Select>

            {autoRefresh && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Auto-refresh actif
              </Badge>
            )}
          </div>

          {/* Liste des jobs */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="ml-3 text-slate-500">Chargement des jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState onCreateNew={() => setViewMode('create')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map(job => (
                <BatchCard
                  key={job.id}
                  job={job}
                  onViewDetails={handleViewDetails}
                  onCancel={handleCancelJob}
                  onExport={(id) => handleExport(id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Vue Création */}
      {viewMode === 'create' && (
        <CreateBatchForm onSubmit={handleCreateBatch} isSubmitting={creating} />
      )}

      {/* Vue Détail */}
      {viewMode === 'detail' && selectedJob && (
        <div className="space-y-6">
          {/* Header du job */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedJob.name}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  ID: {selectedJob.id} · Créé par {selectedJob.creatorName || 'Inconnu'}
                </p>
              </div>
              <Badge variant="secondary" className={
                selectedJob.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                selectedJob.status === 'running' ? 'bg-blue-100 text-blue-700' :
                selectedJob.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-700'
              }>
                {selectedJob.status.toUpperCase()}
              </Badge>
            </div>

            {/* Progression si en cours ou terminé */}
            {(selectedJob.status === 'running' || selectedJob.status === 'pending' || selectedJob.status === 'completed') && (
              <BatchProgress
                progress={selectedJob.progress}
                totalDocs={selectedJob.totalDocs}
                processedDocs={selectedJob.processedDocs ?? 0}
                failedDocs={selectedJob.failedDocs ?? 0}
                status={selectedJob.status}
                startedAt={selectedJob.startedAt}
              />
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => handleExport(selectedJob.id, 'csv')}>
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport(selectedJob.id, 'json')}>
                <Download className="h-4 w-4 mr-2" />
                Exporter JSON
              </Button>
              {(selectedJob.status === 'running' || selectedJob.status === 'pending') && (
                <Button 
                  variant="destructive" 
                  onClick={() => handleCancelJob(selectedJob.id)}
                >
                  Annuler le job
                </Button>
              )}
            </div>
          </div>

          {/* Résultats détaillés */}
          {jobResults.length > 0 && (
            <BatchResults
              results={jobResults}
              threshold={(() => {
                try { return JSON.parse(selectedJob.config).threshold; } catch { return 0.15; }
              })()}
              onExport={(format) => handleExport(selectedJob.id, format)}
            />
          )}

          {/* Message d'erreur si échec */}
          {selectedJob.status === 'failed' && selectedJob.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Le job a échoué</p>
                <p className="text-sm text-red-600 mt-1">{selectedJob.error}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

function StatCard({ 
  label, 
  value, 
  icon, 
  color,
  pulse = false 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode; 
  color: string;
  pulse?: boolean;
}) {
  const colors: Record<string, string> = {
    slate: 'bg-white border-slate-200',
    amber: 'bg-amber-50 border-amber-200',
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    red: 'bg-red-50 border-red-200',
  };

  const textColors: Record<string, string> = {
    slate: 'text-slate-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
  };

  return (
    <div className={cn('rounded-lg border p-4', colors[color])}>
      <div className={cn('flex items-center gap-2 mb-2', textColors[color])}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide opacity-70 relative">
          {label}
          {pulse && (
            <span className="absolute -right-2 -top-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
        </span>
      </div>
      <p className={cn('text-3xl font-bold', textColors[color])}>{value}</p>
    </div>
  );
}

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
      <Layers className="h-16 w-16 mx-auto text-slate-300 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucune analyse groupée</h3>
      <p className="text-slate-500 max-w-md mx-auto mb-6">
        Commencez par créer votre première analyse groupée pour traiter plusieurs documents simultanément.
      </p>
      <Button onClick={onCreateNew} className="bg-emerald-600 hover:bg-emerald-700">
        <Plus className="h-4 w-4 mr-2" />
        Créer une analyse groupée
      </Button>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
