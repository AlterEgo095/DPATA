'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Globe, Plus, Search, Loader2, Trash2, AlertCircle, CheckCircle2, Network, ShieldCheck,
  RefreshCw, Settings, Activity, Users, Database, Clock, ArrowUpDown, ExternalLink,
  Wifi, WifiOff, AlertTriangle, BarChart3, History, Send, Eye, XCircle, Zap
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

interface University {
  id: string;
  code: string;
  name: string;
  apiUrl: string;
  isActive: boolean;
  createdAt: string;
  // Extended fields (from API)
  country?: string;
  city?: string;
  contactEmail?: string;
  logoUrl?: string;
  documentCount?: number;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
}

interface UniversityStats {
  universityId: string;
  totalDocuments: number;
  sharedDocuments: number;
  lastSyncAt: Date | null;
  lastSyncDuration: number;
  avgResponseTime: number;
  searchCountToday: number;
  searchCountTotal: number;
  matchRate: number;
  status: 'active' | 'inactive';
  uptimePercentage: number;
}

interface FederationMatch {
  id: string;
  universityCode: string;
  universityName: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  segmentIndex: number;
  segmentHash: string;
  semanticScore: number;
  lexicalScore: number;
  combinedScore: number;
  matchType: string;
  confidence: 'high' | 'medium' | 'low';
}

interface FederatedSearchResult {
  universityName: string;
  universityCode: string;
  matches: FederationMatch[];
  responseTimeMs: number;
  timestamp: string;
  status: 'success' | 'timeout' | 'error' | 'rate_limited';
  error?: string;
}

interface FederationStats {
  totalUniversities: number;
  activeUniversities: number;
  inactiveUniversities: number;
  totalDocuments: number;
}

interface SyncTask {
  id: string;
  operation: string;
  status: string;
  progress: number;
  createdAt: string;
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function FederationPage() {
  // États principaux
  const [universities, setUniversities] = useState<University[]>([]);
  const [federationStats, setFederationStats] = useState<FederationStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [selectedUniStats, setSelectedUniStats] = useState<UniversityStats | null>(null);
  
  // Formulaire d'ajout
  const [form, setForm] = useState({
    code: '', name: '', country: 'RDC', city: '',
    contactEmail: '', apiUrl: '', apiKey: '', status: 'pending' as const
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Recherche fédérée
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    matches: FederationMatch[];
    resultsByUniversity: FederatedSearchResult[];
    totalMatches: number;
    universitiesQueried: number;
    universitiesResponded: number;
    processingTimeMs: number;
  } | null>(null);
  const [searchOptions, setSearchOptions] = useState({
    threshold: 0.15,
    sortBy: 'relevance' as 'relevance' | 'score' | 'university',
    scope: 'all' as 'faculty' | 'department' | 'all'
  });
  
  // Actions en cours
  const [syncingUnis, setSyncingUnis] = useState<Set<string>>(new Set());
  const [testingUnis, setTestingUnis] = useState<Set<string>>(new Set());
  
  // Historique des syncs (simulé)
  const [syncHistory, setSyncHistory] = useState<SyncTask[]>([]);

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  const loadFederationData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/federation/universities?stats=true');
      const data = await res.json();
      setUniversities(data.universities || []);
      setFederationStats(data.stats || null);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFederationData(); }, [loadFederationData]);

  // ============================================================
  // ACTIONS UNIVERSITÉS
  // ============================================================

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/federation/universities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Université ${form.name} ajoutée avec succès`);
      setAddDialogOpen(false);
      resetForm();
      loadFederationData();
    } catch {
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Retirer ${name} de la fédération ?`)) return;
    try {
      const res = await fetch(`/api/federation/universities/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Erreur lors de la suppression'); return; }
      toast.success(`${name} retirée de la fédération`);
      loadFederationData();
    } catch {
      toast.error('Erreur réseau');
    }
  }

  async function handleToggleStatus(uni: University) {
    const newStatus = !uni.isActive;
    try {
      const res = await fetch(`/api/federation/universities/${uni.id}?action=toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus ? 'active' : 'inactive' }),
      });
      if (!res.ok) { toast.error('Erreur lors de la mise à jour'); return; }
      toast.success(`${uni.name} ${newStatus ? 'activée' : 'désactivée'}`);
      loadFederationData();
    } catch {
      toast.error('Erreur réseau');
    }
  }

  async function handleSync(uni: University) {
    setSyncingUnis(prev => new Set(prev).add(uni.id));
    try {
      const res = await fetch(`/api/federation/universities/${uni.id}?action=sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Synchronisation planifiée pour ${uni.name}`);
        setSyncHistory(prev => [{
          id: data.syncTask?.id || `sync-${Date.now()}`,
          operation: 'METADATA_ONLY',
          status: 'PENDING',
          progress: 0,
          createdAt: new Date().toISOString(),
        }, ...prev.slice(0, 9)]);
      } else {
        toast.error(data.error || 'Erreur de synchronisation');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSyncingUnis(prev => {
        const next = new Set(prev);
        next.delete(uni.id);
        return next;
      });
    }
  }

  async function handleTestConnection(uni: University) {
    setTestingUnis(prev => new Set(prev).add(uni.id));
    try {
      const res = await fetch(`/api/federation/universities/${uni.id}?action=test-connection`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.connection?.status === 'healthy') {
        toast.success(`${uni.name}: Connexion OK (${Math.round(data.connection.latency)}ms)`);
      } else {
        toast.error(`${uni.name}: Échec de connexion`);
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setTestingUnis(prev => {
        const next = new Set(prev);
        next.delete(uni.id);
        return next;
      });
    }
  }

  async function handleViewDetails(uni: University) {
    setSelectedUniversity(uni);
    setDetailDialogOpen(true);
    
    // Charger les stats détaillées
    try {
      const res = await fetch(`/api/federation/universities/${uni.id}?stats=true`);
      const data = await res.json();
      setSelectedUniStats(data.stats);
    } catch {
      setSelectedUniStats(null);
    }
  }

  // ============================================================
  // RECHERCHE FÉDÉRÉE
  // ============================================================

  async function handleSearch() {
    if (searchText.length < 50) {
      toast.error('Le texte doit faire au moins 50 caractères');
      return;
    }
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch('/api/federation/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: searchText,
          threshold: searchOptions.threshold,
          scope: searchOptions.scope,
          sortBy: searchOptions.sortBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      
      setSearchResults({
        matches: data.matches || [],
        resultsByUniversity: data.resultsByUniversity || [],
        totalMatches: data.totalMatches || 0,
        universitiesQueried: data.universitiesQueried || 0,
        universitiesResponded: data.universitiesResponded || 0,
        processingTimeMs: data.processingTimeMs || 0,
      });
      
      toast.success(
        `${data.totalMatches} correspondance(s) trouvée(s) dans ${data.universitiesResponded}/${data.universitiesQueried} universités`
      );
    } catch {
      toast.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  function resetForm() {
    setForm({ code: '', name: '', country: 'RDC', city: '', contactEmail: '', apiUrl: '', apiKey: '', status: 'pending' });
  }

  function getStatusBadge(uni: University) {
    if (!uni.isActive) {
      return <Badge variant="secondary" className="bg-slate-100 text-slate-600"><WifiOff className="h-3 w-3 mr-1" />Inactif</Badge>;
    }
    
    const lastSync = uni.lastSyncAt ? new Date(uni.lastSyncAt) : null;
    const hoursSinceSync = lastSync ? (Date.now() - lastSync.getTime()) / (1000 * 60 * 60) : Infinity;
    
    if (hoursSinceSync < 6) {
      return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Actif</Badge>;
    } else if (hoursSinceSync < 24) {
      return <Badge className="bg-amber-100 text-amber-700"><RefreshCw className="h-3 w-3 mr-1" />Sync</Badge>;
    } else {
      return <Badge className="bg-slate-100 text-slate-600"><AlertCircle className="h-3 w-3 mr-1" />Hors sync</Badge>;
    }
  }

  function getConfidenceColor(confidence: string) {
    switch (confidence) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }
  }

  function getMatchTypeLabel(type: string) {
    const labels: Record<string, string> = {
      COPY_PASTE: 'Copier-coller',
      PARAPHRASE: 'Paraphrase',
      REFORMULATION: 'Reformulation',
      TRANSLATION: 'Traduction',
      WEAK_MATCH: 'Faible',
    };
    return labels[type] || type;
  }

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-emerald-600" />
            Fédération Inter-Universitaire
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Réseau de détection du plagiat inter-établissements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadFederationData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1.5" /> Ajouter une université
          </Button>
        </div>
      </div>

      {/* Bannière info */}
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <strong>Confidentialité garantie :</strong> Les documents ne sont jamais transmis en clair.
              Seuls les empreintes cryptographiques (SHA-256) sont échangées entre les universités partenaires.
              Chaque établissement conserve le contrôle total de ses données.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques globales */}
      {federationStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Users className="h-5 w-5 text-blue-600" /></div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{federationStats.totalUniversities}</div>
                <div className="text-xs text-slate-500">Universités</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{federationStats.activeUniversities}</div>
                <div className="text-xs text-slate-500">Actives</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><Database className="h-5 w-5 text-purple-600" /></div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{federationStats.totalDocuments.toLocaleString()}</div>
                <div className="text-xs text-slate-500">Documents partagés</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100"><Activity className="h-5 w-5 text-amber-600" /></div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{federationStats.inactiveUniversities}</div>
                <div className="text-xs text-slate-500">Inactives</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cartes des universités partenaires */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-5 w-5 text-emerald-600" />
            Universités partenaires ({universities.length})
          </CardTitle>
          <CardDescription>Cliquez sur une carte pour voir les détails et les actions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : universities.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">Aucune université partenaire</p>
              <Button variant="outline" className="mt-3" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Ajouter une université
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {universities.map((uni) => (
                <Card 
                  key={uni.id} 
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-emerald-300 ${
                    uni.isActive ? 'border-emerald-200' : 'border-slate-200 opacity-75'
                  }`}
                  onClick={() => handleViewDetails(uni)}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                          uni.code === 'UNIKIN' ? 'bg-blue-600' :
                          uni.code === 'UNILU' ? 'bg-orange-600' :
                          uni.code === 'UCB' ? 'bg-green-600' : 'bg-slate-600'
                        }`}>
                          {uni.code.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{uni.name}</div>
                          <code className="text-xs text-slate-500">{uni.code}</code>
                        </div>
                      </div>
                      {getStatusBadge(uni)}
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Documents</span>
                        <span className="font-medium">{(uni as any).documentCount?.toLocaleString() || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dernière sync</span>
                        <span className="font-medium text-xs">
                          {(uni as any).lastSyncAt 
                            ? `${Math.round((Date.now() - new Date((uni as any).lastSyncAt).getTime()) / (1000 * 60 * 60))}h`
                            : '-'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ville</span>
                        <span className="font-medium">{(uni as any).city || '-'}</span>
                      </div>
                    </div>

                    {/* Actions rapides */}
                    <div className="flex gap-1 mt-3 pt-3 border-t border-slate-100">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-xs flex-1"
                        onClick={(e) => { e.stopPropagation(); handleSync(uni); }}
                        disabled={syncingUnis.has(uni.id)}
                      >
                        {syncingUnis.has(uni.id) 
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />
                        }
                        <span className="ml-1">Sync</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-xs flex-1"
                        onClick={(e) => { e.stopPropagation(); handleTestConnection(uni); }}
                        disabled={testingUnis.has(uni.id)}
                      >
                        {testingUnis.has(uni.id)
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Wifi className="h-3 w-3" />
                        }
                        <span className="ml-1">Test</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleDelete(uni.id, uni.name); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recherche fédérée */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-600" />
            Recherche fédérée de plagiat
          </CardTitle>
          <CardDescription>
            Analysez un texte contre tous les corpus des universités partenaires
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Options de recherche */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Seuil de similarité</Label>
              <Select 
                value={searchOptions.threshold.toString()} 
                onValueChange={(v) => setSearchOptions(prev => ({ ...prev, threshold: parseFloat(v) }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.10">Très sensible (10%)</SelectItem>
                  <SelectItem value="0.15">Sensible (15%)</SelectItem>
                  <SelectItem value="0.25">Normal (25%)</SelectItem>
                  <SelectItem value="0.40">Strict (40%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Tri des résultats</Label>
              <Select 
                value={searchOptions.sortBy} 
                onValueChange={(v) => setSearchOptions(prev => ({ ...prev, sortBy: v as any }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Pertinence</SelectItem>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="university">Université</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Portée</Label>
              <Select 
                value={searchOptions.scope} 
                onValueChange={(v) => setSearchOptions(prev => ({ ...prev, scope: v as any }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les sources</SelectItem>
                  <SelectItem value="faculty">Faculté uniquement</SelectItem>
                  <SelectItem value="department">Département</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Zone de texte */}
          <div className="space-y-2">
            <Label htmlFor="searchText">Texte à analyser</Label>
            <Textarea
              id="searchText"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              rows={5}
              placeholder="Collez ici le texte à vérifier contre le corpus interuniversitaire..."
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>{searchText.length} caractères (minimum 50)</span>
              <span>{Math.ceil(searchText.length / 1500)} page(s)</span>
            </div>
          </div>

          <Button 
            onClick={handleSearch} 
            disabled={searching || searchText.length < 50}
            className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Lancer la recherche fédérée
              </>
            )}
          </Button>

          {/* Résultats de recherche */}
          {searchResults && (
            <div className="space-y-4 mt-4 border-t pt-4">
              {/* Stats de recherche */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <div className="text-xl font-bold text-slate-900">{searchResults.totalMatches}</div>
                  <div className="text-xs text-slate-500">Correspondances</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <div className="text-xl font-bold text-blue-600">{searchResults.universitiesResponded}/{searchResults.universitiesQueried}</div>
                  <div className="text-xs text-slate-500">Universités</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <div className="text-xl font-bold text-emerald-600">{searchResults.processingTimeMs}</div>
                  <div className="text-xs text-slate-500">ms</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <div className="text-xl font-bold text-purple-600">
                    {searchResults.resultsByUniversity.filter(r => r.status === 'success').length}
                  </div>
                  <div className="text-xs text-slate-500">Succès</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <div className="text-xl font-bold text-red-600">
                    {searchResults.resultsByUniversity.filter(r => r.status !== 'success').length}
                  </div>
                  <div className="text-xs text-slate-500">Erreurs</div>
                </div>
              </div>

              {/* Résultats par université */}
              {searchResults.matches.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
                  <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <p className="font-medium text-emerald-700">Aucune correspondance trouvée</p>
                  <p className="text-sm text-slate-500 mt-1">Le texte ne présente pas de similarités avec les corpus partenaires.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {searchResults.matches.map((match, i) => (
                    <div key={match.id || i} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">
                            {getMatchTypeLabel(match.matchType)}
                          </Badge>
                          <Badge className={`text-xs ${getConfidenceColor(match.confidence)}`}>
                            {match.confidence === 'high' ? 'Élevée' : match.confidence === 'medium' ? 'Moyenne' : 'Faible'}
                          </Badge>
                          <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {match.universityCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs shrink-0">
                          <span className="text-purple-600 font-medium">
                            {(match.combinedScore * 100).toFixed(1)}%
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-blue-600">Sem: {(match.semanticScore * 100).toFixed(1)}%</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-amber-600">Lex: {(match.lexicalScore * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-slate-600 mb-2">
                        <span className="font-medium">Document :</span> {match.documentTitle}
                        <span className="text-slate-400 ml-2">({match.documentType})</span>
                      </div>
                      
                      {/* Barre de score */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-16">Score global</span>
                        <Progress value={match.combinedScore * 100} className="h-2 flex-1" />
                        <span className="text-xs font-medium w-12 text-right">{(match.combinedScore * 100).toFixed(0)}%</span>
                      </div>
                      
                      {/* Hash du segment (pas le texte!) */}
                      <div className="mt-2 text-xs text-slate-400 font-mono bg-slate-50 p-2 rounded truncate">
                        Hash segment: {match.segmentHash}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des synchronisations */}
      {syncHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-5 w-5 text-amber-600" />
              Activité récente
            </CardTitle>
            <CardDescription>Dernières opérations de synchronisation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {syncHistory.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    task.status === 'COMPLETED' ? 'bg-emerald-500' :
                    task.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' :
                    task.status === 'FAILED' ? 'bg-red-500' : 'bg-slate-400'
                  }`} />
                  <span className="font-mono text-xs text-slate-500">{task.operation}</span>
                  <span className="flex-1 text-slate-700">
                    {task.status === 'PENDING' ? 'En attente' :
                     task.status === 'RUNNING' ? 'En cours...' :
                     task.status === 'COMPLETED' ? 'Terminé' :
                     task.status === 'FAILED' ? 'Échoué' : task.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(task.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================= */}
      {/* DIALOGS                                  */}
      {/* ========================================= */}

      {/* Dialog Ajout Université */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Inviter une université
            </DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle université au réseau fédéré. Elle recevra une invitation pour configurer la connexion.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input 
                  value={form.code} 
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} 
                  placeholder="Ex: UNILU" 
                  required 
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label>Pays</Label>
                <Input 
                  value={form.country} 
                  onChange={e => setForm({ ...form, country: e.target.value })} 
                  placeholder="RDC"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder="Ex: Université de Lubumbashi" 
                required 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input 
                  value={form.city} 
                  onChange={e => setForm({ ...form, city: e.target.value })} 
                  placeholder="Lubumbashi"
                />
              </div>
              <div className="space-y-2">
                <Label>Email contact</Label>
                <Input 
                  type="email" 
                  value={form.contactEmail} 
                  onChange={e => setForm({ ...form, contactEmail: e.target.value })} 
                  placeholder="contact@unilu.ac.cd"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>URL de l&apos;API *</Label>
              <Input 
                type="url" 
                value={form.apiUrl} 
                onChange={e => setForm({ ...form, apiUrl: e.target.value })} 
                placeholder="https://unilu-plagiat.ac.cd/api" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Clé API (optionnel)</Label>
              <Input 
                type="password" 
                value={form.apiKey} 
                onChange={e => setForm({ ...form, apiKey: e.target.value })} 
                placeholder="Clé d'authentification sécurisée"
              />
              <p className="text-xs text-slate-500">La clé sera hashée avant stockage</p>
            </div>
            
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Inviter l&apos;université
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Détails Université */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              {selectedUniversity?.name}
            </DialogTitle>
            <DialogDescription>
              Détails et configuration de l&apos;université partenaire
            </DialogDescription>
          </DialogHeader>
          
          {selectedUniversity && (
            <div className="space-y-6">
              {/* Infos principales */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Code</Label>
                  <p className="font-mono text-sm bg-slate-100 px-2 py-1 rounded inline-block">
                    {selectedUniversity.code}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Statut</Label>
                  <div>{getStatusBadge(selectedUniversity)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Pays / Ville</Label>
                  <p className="text-sm">{(selectedUniversity as any).country}, {(selectedUniversity as any).city}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Contact</Label>
                  <p className="text-sm">{(selectedUniversity as any).contactEmail || '-'}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-slate-500">Endpoint API</Label>
                  <p className="text-sm font-mono break-all">{selectedUniversity.apiUrl}</p>
                </div>
              </div>

              {/* Stats détaillées */}
              {selectedUniStats && (
                <>
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                      Statistiques
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-slate-900">{selectedUniStats.totalDocuments}</div>
                        <div className="text-xs text-slate-500">Documents totaux</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-emerald-600">{selectedUniStats.sharedDocuments}</div>
                        <div className="text-xs text-slate-500">Partagés</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-blue-600">{selectedUniStats.searchCountToday}</div>
                        <div className="text-xs text-slate-500">Recherches aujourd&apos;hui</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-slate-900">{Math.round(selectedUniStats.avgResponseTime)}ms</div>
                        <div className="text-xs text-slate-500">Temps réponse moyen</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-amber-600">{(selectedUniStats.matchRate * 100).toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">Taux correspondance</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-emerald-600">{selectedUniStats.uptimePercentage.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">Disponibilité</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleToggleStatus(selectedUniversity)}
                >
                  {selectedUniversity.isActive ? (
                    <><WifiOff className="h-4 w-4 mr-1.5" /> Désactiver</>
                  ) : (
                    <><Wifi className="h-4 w-4 mr-1.5" /> Activer</>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleSync(selectedUniversity)}
                  disabled={syncingUnis.has(selectedUniversity.id)}
                >
                  {syncingUnis.has(selectedUniversity.id) 
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sync...</>
                    : <><RefreshCw className="h-4 w-4 mr-1.5" /> Synchroniser</>
                  }
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleTestConnection(selectedUniversity)}
                  disabled={testingUnis.has(selectedUniversity.id)}
                >
                  {testingUnis.has(selectedUniversity.id)
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Test...</>
                    : <><Zap className="h-4 w-4 mr-1.5" /> Tester connexion</>
                  }
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    handleDelete(selectedUniversity.id, selectedUniversity.name);
                    setDetailDialogOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Retirer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
