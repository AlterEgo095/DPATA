'use client';

// BatchCard - Composant de carte résumé pour un job batch
import React from 'react';
import { 
  Clock, CheckCircle2, XCircle, AlertTriangle, Loader2,
  FileText, ChevronRight, Calendar, User
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface BatchJobData {
  id: string;
  name: string;
  status: string;
  progress: number;
  totalDocs: number;
  processedDocs?: number;
  failedDocs?: number;
  config: string; // JSON
  createdBy: string;
  creatorName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  resultsCount?: number;
  completedCount?: number;
  failedCount?: number;
}

interface BatchCardProps {
  job: BatchJobData;
  onViewDetails: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onExport?: (jobId: string) => void;
}

const STATUS_CONFIG: Record<string, { 
  label: string; 
  icon: React.ElementType; 
  color: string; 
  bgClass: string;
}> = {
  pending: {
    label: 'En attente',
    icon: Clock,
    color: 'text-amber-600',
    bgClass: 'bg-amber-50 border-amber-200',
  },
  running: {
    label: 'En cours',
    icon: Loader2,
    color: 'text-blue-600',
    bgClass: 'bg-blue-50 border-blue-200',
  },
  completed: {
    label: 'Terminé',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgClass: 'bg-emerald-50 border-emerald-200',
  },
  failed: {
    label: 'Échoué',
    icon: XCircle,
    color: 'text-red-600',
    bgClass: 'bg-red-50 border-red-200',
  },
  cancelled: {
    label: 'Annulé',
    icon: XCircle,
    color: 'text-slate-500',
    bgClass: 'bg-slate-50 border-slate-200',
  },
};

export function BatchCard({ job, onViewDetails, onCancel, onExport }: BatchCardProps) {
  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  
  let config = {};
  try { config = JSON.parse(job.config || '{}'); } catch {}

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDuration = () => {
    if (!job.startedAt) return '-';
    const end = job.completedAt ? new Date(job.completedAt) : new Date();
    const start = new Date(job.startedAt);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
    if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}min`;
    return `${(diffMs / 3600000).toFixed(1)}h`;
  };

  return (
    <Card className={cn(
      'transition-all hover:shadow-md cursor-pointer group',
      statusConfig.bgClass
    )} onClick={() => onViewDetails(job.id)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <StatusIcon className={cn('h-5 w-5 flex-shrink-0', statusConfig.color, 
              job.status === 'running' && 'animate-spin')} />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900 truncate">{job.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ID: {job.id.slice(0, 8)}...
              </p>
            </div>
          </div>
          <Badge variant="secondary" className={cn(statusConfig.color, 'font-medium')}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progression */}
        {(job.status === 'running' || job.status === 'pending') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Progression</span>
              <span className="font-medium">{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="h-2" />
            <p className="text-xs text-slate-500">
              {job.processedDocs ?? 0}/{job.totalDocs} documents traités
            </p>
          </div>
        )}

        {/* Stats pour jobs terminés */}
        {job.status === 'completed' && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-lg font-bold text-emerald-600">{job.completedCount ?? job.totalDocs}</p>
              <p className="text-xs text-slate-500">Réussis</p>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-lg font-bold text-red-500">{job.failedCount ?? 0}</p>
              <p className="text-xs text-slate-500">Échoués</p>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-lg font-bold text-slate-700">{getDuration()}</p>
              <p className="text-xs text-slate-500">Durée</p>
            </div>
          </div>
        )}

        {/* Métadonnées */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {job.totalDocs} docs
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {job.creatorName || 'Inconnu'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(job.createdAt)}
          </span>
        </div>

        {/* Config badge */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs">
            {(config as any)?.engine?.toUpperCase() || 'TFIDF'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {(config as any)?.scope || 'faculty'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Seuil: {((config as any)?.threshold * 100)?.toFixed(0) || 15}%
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs"
            onClick={(e) => { e.stopPropagation(); onViewDetails(job.id); }}
          >
            Voir détails
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
          
          {(job.status === 'completed') && onExport && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs"
              onClick={(e) => { e.stopPropagation(); onExport(job.id); }}
            >
              Exporter
            </Button>
          )}
          
          {(job.status === 'running' || job.status === 'pending') && onCancel && (
            <Button 
              size="sm" 
              variant="destructive" 
              className="text-xs"
              onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
            >
              Annuler
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
