'use client';

// BatchProgress - Barre de progression détaillée pour un job batch en cours
import React from 'react';
import { 
  Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  FileText, Timer
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DocumentProgress {
  documentId: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
  score?: number;
}

interface BatchProgressProps {
  progress: number; // 0-100
  totalDocs: number;
  processedDocs: number;
  failedDocs: number;
  status: string;
  documents?: DocumentProgress[];
  startedAt?: string | null;
  estimatedTimeRemaining?: number; // en secondes
  className?: string;
}

export function BatchProgress({
  progress,
  totalDocs,
  processedDocs,
  failedDocs,
  status,
  documents = [],
  startedAt,
  estimatedTimeRemaining,
  className,
}: BatchProgressProps) {
  const isActive = status === 'running' || status === 'pending';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  // Calculer le temps écoulé
  const getElapsedTime = () => {
    if (!startedAt) return null;
    const elapsed = Date.now() - new Date(startedAt!).getTime();
    return formatDuration(elapsed);
  };

  // Formater la durée
  const formatDuration = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  // Déterminer la couleur de progression
  const getProgressColor = () => {
    if (isCompleted) return '[&>div]:bg-emerald-500';
    if (isFailed) return '[&>div]:bg-red-500';
    return '[&>div]:bg-blue-500';
  };

  // Stats des documents par statut
  const docStats = {
    completed: documents.filter(d => d.status === 'completed').length,
    failed: documents.filter(d => d.status === 'failed').length,
    processing: documents.filter(d => d.status === 'processing').length,
    pending: documents.filter(d => d.status === 'pending').length,
    timeout: documents.filter(d => d.status === 'timeout').length,
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {isActive && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
            {status === 'cancelled' && <XCircle className="h-4 w-4 text-slate-400" />}
            {status === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
            
            Progression de l&apos;analyse
          </CardTitle>
          
          <Badge variant={isCompleted ? 'default' : 'secondary'} 
                 className={cn(
                   isCompleted && 'bg-emerald-100 text-emerald-700 border-emerald-200',
                   isFailed && 'bg-red-100 text-red-700 border-red-200',
                   isActive && 'bg-blue-100 text-blue-700 border-blue-200'
                 )}>
            {progress}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Barre de progression principale */}
        <div className="space-y-3">
          <Progress value={progress} className={cn('h-3', getProgressColor())} />
          
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              <FileText className="inline h-4 w-4 mr-1 -mt-0.5" />
              {processedDocs}/{totalDocs} documents
            </span>
            
            <div className="flex items-center gap-4 text-slate-500">
              {startedAt && (
                <span className="flex items-center gap-1 text-xs">
                  <Timer className="h-3 w-3" />
                  Écoulé: {getElapsedTime()}
                </span>
              )}
              
              {estimatedTimeRemaining && isActive && (
                <span className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  Restant: ~{formatDuration(estimatedTimeRemaining * 1000)}
                </span>
              )}
              
              {failedDocs > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {failedDocs} échec(s)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-5 gap-2">
          <StatPill 
            label="Terminés" 
            value={docStats.completed} 
            color="emerald"
            icon={<CheckCircle2 className="h-3 w-3" />}
          />
          <StatPill 
            label="En cours" 
            value={docStats.processing} 
            color="blue"
            icon={<Loader2 className="h-3 w-3 animate-spin" />}
          />
          <StatPill 
            label="En attente" 
            value={docStats.pending} 
            color="slate"
            icon={<Clock className="h-3 w-3" />}
          />
          <StatPill 
            label="Échoués" 
            value={docStats.failed} 
            color="red"
            icon={<XCircle className="h-3 w-3" />}
          />
          <StatPill 
            label="Timeout" 
            value={docStats.timeout} 
            color="amber"
            icon={<AlertCircle className="h-3 w-3" />}
          />
        </div>

        {/* Liste des documents (si fournie) */}
        {documents.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-md border border-slate-200 p-2">
            {documents.map((doc, index) => (
              <div 
                key={doc.documentId}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-sm',
                  doc.status === 'completed' && 'bg-emerald-50',
                  doc.status === 'processing' && 'bg-blue-50',
                  doc.status === 'failed' && 'bg-red-50',
                  doc.status === 'timeout' && 'bg-amber-50',
                  doc.status === 'pending' && 'bg-slate-50'
                )}
              >
                <DocStatusIcon status={doc.status} />
                <span className="flex-1 truncate">{doc.title}</span>
                {doc.score !== undefined && (
                  <Badge variant="outline" className={cn(
                    'text-xs font-mono',
                    doc.score > 0.3 ? 'text-red-600 border-red-200' : 'text-emerald-600 border-emerald-200'
                  )}>
                    {(doc.score * 100).toFixed(1)}%
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message de complétion */}
        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
            <p className="font-medium text-emerald-800">Analyse terminée avec succès</p>
            <p className="text-sm text-emerald-600 mt-1">
              {processedDocs - failedDocs}/{totalDocs} documents analysés correctement
            </p>
          </div>
        )}

        {/* Message d'échec */}
        {isFailed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
            <p className="font-medium text-red-800">L&apos;analyse a rencontré une erreur</p>
            <p className="text-sm text-red-600 mt-1">
              Certains documents n&apos;ont pas pu être traités
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

function StatPill({ 
  label, 
  value, 
  color, 
  icon 
}: { 
  label: string; 
  value: number; 
  color: string; 
  icon: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  };

  return (
    <div className={cn('rounded-lg border p-2 text-center', colors[color])}>
      <div className="flex justify-center mb-0.5">{icon}</div>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function DocStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    case 'timeout':
      return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />;
  }
}
