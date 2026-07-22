'use client';

// Portal My Work Page - Historique personnel des validations
// Permet de voir tous les sujets soumis et leur statut

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FolderOpen, Search, Filter, Calendar, CheckCircle2, XCircle,
  Clock, AlertTriangle, Sparkles, FileText, ExternalLink, Trash2,
  Eye, Download, RefreshCw, BookOpen
} from 'lucide-react';
import Link from 'next/link';

interface SubjectValidation {
  id: string;
  submittedTitle: string;
  submittedDescription?: string;
  submittedDomain?: string;
  status: 'PENDING' | 'VALIDATED' | 'REJECTED' | 'ALTERNATIVES_GENERATED';
  similarityScore: number;
  isOriginal: boolean;
  alternatives?: string[];
  createdAt: string;
  completedAt?: string;
}

export default function PortalMyWorkPage() {
  const [validations, setValidations] = useState<SubjectValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadValidations();
  }, []);

  async function loadValidations() {
    setLoading(true);
    try {
      const res = await fetch('/api/subjects/validate');
      if (res.ok) {
        // L'API retourne la liste complète - filtrer côté client pour l'instant
        const data = await res.json();
        // Si c'est une seule validation, mettre dans un tableau
        const items = Array.isArray(data) ? data : (data.validation ? [data.validation] : []);
        setValidations(items.reverse()); // Plus récent d'abord
      }
    } catch (err) {
      console.error('Failed to load validations:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter validations
  const filtered = validations.filter(v => {
    const matchesSearch = v.submittedTitle.toLowerCase().includes(search.toLowerCase()) ||
      (v.submittedDomain || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || v.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Stats
  const stats = {
    total: validations.length,
    validated: validations.filter(v => v.status === 'VALIDATED').length,
    alternatives: validations.filter(v => v.status === 'ALTERNATIVES_GENERATED').length,
    rejected: validations.filter(v => v.status === 'REJECTED').length,
  };

  function getStatusBadge(status: string) {
    switch (status) {
      case 'VALIDATED':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Validé</Badge>;
      case 'ALTERNATIVES_GENERATED':
        return <Badge className="bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3 mr-1" />Alternatives</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Rejeté</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="h-7 w-7 text-blue-600" />
            Mes travaux
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Historique de vos validations de sujets
          </p>
        </div>
        <Link href="/portal/submit">
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Nouvelle validation
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.validated}</p>
              <p className="text-xs text-slate-500">Validés</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.alternatives}</p>
              <p className="text-xs text-slate-500">Avec alternatives</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs text-slate-500">Rejetés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un sujet..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Tabs value={filterStatus} onValueChange={setFilterStatus}>
              <TabsList>
                <TabsTrigger value="all">Tous ({stats.total})</TabsTrigger>
                <TabsTrigger value="VALIDATED">Validés ({stats.validated})</TabsTrigger>
                <TabsTrigger value="ALTERNATIVES_GENERATED">Alternatives ({stats.alternatives})</TabsTrigger>
                <TabsTrigger value="REJECTED">Rejetés ({stats.rejected})</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" size="icon" onClick={loadValidations} title="Rafraîchir">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-slate-100 rounded-full w-20" />
                    <div className="h-6 bg-slate-100 rounded-full w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderOpen className="h-16 w-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {search ? 'Aucun résultat trouvé' : 'Aucun travail pour le moment'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {search 
                ? 'Essayez avec d\'autres termes de recherche'
                : 'Commencez par valider votre premier sujet !'
              }
            </p>
            {!search && (
              <Link href="/portal/submit">
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Valider un sujet
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((validation) => (
            <Card key={validation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Icon */}
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                    validation.isOriginal ? 'bg-green-100' : 'bg-amber-100'
                  }`}>
                    {validation.isOriginal ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {validation.submittedTitle}
                      </h3>
                      {getStatusBadge(validation.status)}
                    </div>

                    {validation.submittedDescription && (
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                        {validation.submittedDescription}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(validation.createdAt)}
                      </span>
                      {validation.submittedDomain && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100">
                          {validation.submittedDomain}
                        </span>
                      )}
                      <span className={`font-medium ${
                        validation.similarityScore > 0.2 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        Similarité: {(validation.similarityScore * 100).toFixed(1)}%
                      </span>
                      {validation.alternatives && validation.alternatives.length > 0 && (
                        <span className="text-purple-600">
                          {validation.alternatives.length} alternative(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
