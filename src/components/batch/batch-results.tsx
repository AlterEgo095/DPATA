'use client';

// BatchResults - Tableau de résultats détaillés pour un job batch
import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, Download, Filter, AlertTriangle,
  CheckCircle2, XCircle, Clock, Search, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

interface BatchResultsProps {
  results: BatchResultItem[];
  threshold?: number;
  onExport?: (format: 'csv' | 'json') => void;
  onViewDocument?: (documentId: string) => void;
  className?: string;
}

type SortField = 'score' | 'title' | 'status' | 'time';
type SortDirection = 'asc' | 'desc';

export function BatchResults({ 
  results, 
  threshold = 0.15,
  onExport,
  onViewDocument,
  className 
}: BatchResultsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filtrer et trier les résultats
  const filteredResults = results
    .filter(result => {
      // Filtre de recherche
      if (searchQuery && !result.documentTitle.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filtre par statut
      if (statusFilter !== 'all' && result.status !== statusFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'score':
          comparison = (a.globalScore || 0) - (b.globalScore || 0);
          break;
        case 'title':
          comparison = a.documentTitle.localeCompare(b.documentTitle);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'time':
          comparison = (a.processingTimeMs || 0) - (b.processingTimeMs || 0);
          break;
      }
      
      return sortDir === 'asc' ? comparison : -comparison;
    });

  // Stats
  const stats = {
    total: results.length,
    completed: results.filter(r => r.status === 'completed').length,
    failed: results.filter(r => r.status === 'failed' || r.status === 'timeout').length,
    suspicious: results.filter(r => r.globalScore !== undefined && r.globalScore >= threshold).length,
    critical: results.filter(r => r.globalScore !== undefined && r.globalScore >= threshold + 0.2).length,
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Résultats d&apos;analyse
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {filteredResults.length} résultat(s) affiché(s) sur {stats.total}
            </p>
          </div>

          <div className="flex gap-2">
            {onExport && (
              <>
                <Button size="sm" variant="outline" onClick={() => onExport('csv')}>
                  <Download className="h-4 w-4 mr-1.5" />
                  CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => onExport('json')}>
                  <Download className="h-4 w-4 mr-1.5" />
                  JSON
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          <StatBadge label="Total" value={stats.total} color="slate" />
          <StatBadge label="Réussis" value={stats.completed} color="emerald" />
          <StatBadge label="Échoués" value={stats.failed} color="red" />
          <StatBadge label="Suspects" value={stats.suspicious} color="amber" showIcon />
          <StatBadge label="Critiques" value={stats.critical} color="red" showIcon />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher un document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="completed">Terminés</SelectItem>
              <SelectItem value="failed">Échoués</SelectItem>
              <SelectItem value="timeout">Timeout</SelectItem>
              <SelectItem value="skipped">Ignorés</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tableau des résultats */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('title')}
                >
                  Document
                  <SortIndicator field="title" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('status')}
                >
                  Statut
                  <SortIndicator field="status" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 text-right"
                  onClick={() => handleSort('score')}
                >
                  Score
                  <SortIndicator field="score" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="text-right hidden md:table-cell">Segments</TableHead>
                <TableHead className="text-right hidden lg:tableCell">
                  Temps
                  <SortIndicator field="time" current={sortField} dir={sortDir} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Aucun résultat trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredResults.map((result) => (
                  <React.Fragment key={result.documentId}>
                    <TableRow 
                      className={cn(
                        'cursor-pointer hover:bg-slate-50',
                        result.globalScore !== undefined && result.globalScore >= threshold + 0.2 && 'bg-red-50/50',
                        result.globalScore !== undefined && result.globalScore >= threshold && result.globalScore < threshold + 0.2 && 'bg-amber-50/50'
                      )}
                      onClick={() => toggleRow(result.documentId)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {expandedRows.has(result.documentId) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {result.documentTitle}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={result.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {result.globalScore !== undefined ? (
                          <span className={cn(
                            'font-mono font-medium',
                            result.globalScore >= threshold + 0.2 && 'text-red-600 font-bold',
                            result.globalScore >= threshold && result.globalScore < threshold + 0.2 && 'text-amber-600',
                            result.globalScore < threshold && 'text-emerald-600'
                          )}>
                            {(result.globalScore * 100).toFixed(1)}%
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {result.matchedSegments !== undefined && result.totalSegments !== undefined
                          ? `${result.matchedSegments}/${result.totalSegments}`
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        {result.processingTimeMs !== undefined
                          ? `${(result.processingTimeMs / 1000).toFixed(1)}s`
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                    
                    {/* Row étendue avec détails */}
                    {expandedRows.has(result.documentId) && (
                      <TableRow className="bg-slate-50/80">
                        <TableCell colSpan={6} className="p-4">
                          <div className="space-y-3">
                            {/* Types de correspondance */}
                            {result.matchTypes && Object.keys(result.matchTypes).length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-600 mb-1.5">
                                  Types de correspondance:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(result.matchTypes).map(([type, count]) => (
                                    <Badge key={type} variant="outline" className="text-xs">
                                      {getMatchTypeLabel(type)}: {count}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Erreur si échec */}
                            {result.error && (
                              <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                                <AlertTriangle className="inline h-4 w-4 mr-1" />
                                {result.error}
                              </div>
                            )}

                            {/* Date d'analyse */}
                            {result.analyzedAt && (
                              <p className="text-xs text-slate-500">
                                Analysé le: {new Date(result.analyzedAt).toLocaleString('fr-FR')}
                              </p>
                            )}

                            {/* Bouton voir détail */}
                            {onViewDocument && result.status === 'completed' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewDocument(result.documentId);
                                }}
                              >
                                Voir le rapport complet
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

function StatBadge({ 
  label, 
  value, 
  color, 
  showIcon = false 
}: { 
  label: string; 
  value: number; 
  color: string; 
  showIcon?: boolean;
}) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <Badge variant="outline" className={cn(colors[color], 'px-2.5 py-1')}>
      {showIcon && value > 0 && <AlertTriangle className="h-3 w-3 mr-1" />}
      {label}: <strong>{value}</strong>
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    completed: { 
      icon: CheckCircle2, 
      label: 'Terminé', 
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' 
    },
    failed: { 
      icon: XCircle, 
      label: 'Échoué', 
      className: 'bg-red-100 text-red-700 border-red-200' 
    },
    timeout: { 
      icon: Clock, 
      label: 'Timeout', 
      className: 'bg-amber-100 text-amber-700 border-amber-200' 
    },
    skipped: { 
      icon: Clock, 
      label: 'Ignoré', 
      className: 'bg-slate-100 text-slate-500 border-slate-200' 
    },
  };

  const c = config[status] || config.skipped;
  const Icon = c.icon;

  return (
    <Badge variant="outline" className={c.className}>
      <Icon className="h-3 w-3 mr-1" />
      {c.label}
    </Badge>
  );
}

function SortIndicator({ 
  field, 
  current, 
  dir 
}: { 
  field: SortField; 
  current: SortField; 
  dir: SortDirection;
}) {
  if (field !== current) return null;
  
  return (
    <span className="ml-1 inline-block">
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

function getMatchTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    COPY_PASTE: 'Copier-coller',
    PARAPHRASE: 'Paraphrase',
    REFORMULATION: 'Réformulation',
    TRANSLATION: 'Traduction',
    WEAK_MATCH: 'Faible',
  };
  return labels[type] || type;
}
