'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Globe, Plus, Search, Loader2, Trash2, AlertCircle, CheckCircle2, Network, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface University {
  id: string;
  code: string;
  name: string;
  apiUrl: string;
  isActive: boolean;
  createdAt: string;
}

interface FederationMatch {
  universityCode: string;
  universityName: string;
  documentTitle: string;
  documentId: string;
  segmentIndex: number;
  segmentText: string;
  semanticScore: number;
  lexicalScore: number;
  matchType: string;
}

export default function FederationPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', apiUrl: '', apiKey: '', isActive: true });
  const [submitting, setSubmitting] = useState(false);

  // Recherche fédérée
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FederationMatch[] | null>(null);
  const [searchMeta, setSearchMeta] = useState<any>(null);

  async function loadUnis() {
    setLoading(true);
    const res = await fetch('/api/federation/universities');
    const data = await res.json();
    setUniversities(data.universities || []);
    setLoading(false);
  }

  useEffect(() => { loadUnis(); }, []);

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
      toast.success('Université ajoutée');
      setDialogOpen(false);
      setForm({ code: '', name: '', apiUrl: '', apiKey: '', isActive: true });
      loadUnis();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette université ?')) return;
    await fetch(`/api/federation/universities?id=${id}`, { method: 'DELETE' });
    toast.success('Université supprimée');
    loadUnis();
  }

  async function handleSearch() {
    if (searchText.length < 50) {
      toast.error('Le texte doit faire au moins 50 caractères');
      return;
    }
    setSearching(true);
    setResults(null);
    try {
      const res = await fetch('/api/federation/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: searchText, threshold: 0.15 }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setResults(data.matches || []);
      setSearchMeta(data);
      toast.success(`${data.totalMatches} correspondance(s) trouvée(s) dans ${data.universitiesQueried} université(s)`);
    } finally { setSearching(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="h-6 w-6 text-blue-600" /> Fédération interuniversitaire
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Recherche de plagiat à travers les universités partenaires
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1.5" /> Ajouter une université
        </Button>
      </div>

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Network className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <strong>Fonctionnement :</strong> La recherche fédérée interroge simultanément les plateformes anti-plagiat des universités partenaires.
              Chaque université conserve le contrôle de ses données et ne renvoie que les segments correspondants (sans transmettre le texte complet de ses documents).
              Cette architecture protège la confidentialité tout en permettant la détection interuniversitaire du plagiat.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Universités partenaires */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Universités partenaires ({universities.length})</CardTitle>
          <CardDescription>Réseau fédéré de détection du plagiat</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>API URL</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {universities.map(u => (
                    <TableRow key={u.id}>
                      <TableCell><code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{u.code}</code></TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-xs text-slate-500 font-mono">{u.apiUrl}</TableCell>
                      <TableCell className="text-center">
                        {u.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDelete(u.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recherche fédérée */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-600" /> Recherche fédérée de plagiat
          </CardTitle>
          <CardDescription>
            Coller le texte à vérifier. La recherche interroge toutes les universités actives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="searchText">Texte à analyser</Label>
            <Textarea
              id="searchText"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              rows={6}
              placeholder="Collez ici le texte à vérifier contre le corpus interuniversitaire..."
            />
            <p className="text-xs text-slate-500">{searchText.length} caractères (minimum 50)</p>
          </div>
          <Button onClick={handleSearch} disabled={searching || searchText.length < 50} className="bg-purple-600 hover:bg-purple-700">
            {searching ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Recherche en cours...</>
            ) : (
              <><Search className="h-4 w-4 mr-1.5" />Lancer la recherche fédérée</>
            )}
          </Button>

          {/* Résultats */}
          {results !== null && (
            <div className="space-y-4 mt-4">
              {searchMeta && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3 text-center">
                    <div className="text-2xl font-bold text-slate-900">{searchMeta.totalMatches}</div>
                    <div className="text-xs text-slate-500">Correspondances</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{searchMeta.universitiesQueried}</div>
                    <div className="text-xs text-slate-500">Universités interrogées</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{searchMeta.processingTimeMs}</div>
                    <div className="text-xs text-slate-500">ms de traitement</div>
                  </div>
                </div>
              )}

              {results.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-emerald-700">Aucune correspondance trouvée</p>
                  <p className="text-xs text-slate-500 mt-1">Le texte ne présente pas de similarités avec les corpus des universités partenaires.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {results.map((m, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{m.matchType}</Badge>
                          <span className="text-xs font-medium text-slate-700">{m.universityName}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-purple-600">Sem: {(m.semanticScore * 100).toFixed(1)}%</span>
                          <span className="text-slate-400 mx-1">|</span>
                          <span className="text-blue-600">Lex: {(m.lexicalScore * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mb-1">Document source : {m.documentTitle}</div>
                      <div className="text-sm bg-amber-50 border-l-4 border-amber-300 p-2 rounded-r text-slate-700">
                        {m.segmentText.slice(0, 200)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog ajout université */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une université partenaire</DialogTitle>
            <DialogDescription>Renseignez les informations de connexion à l'API de l'université</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: UNILU" required maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Université de Lubumbashi" required />
            </div>
            <div className="space-y-2">
              <Label>URL de l'API</Label>
              <Input type="url" value={form.apiUrl} onChange={e => setForm({ ...form, apiUrl: e.target.value })} placeholder="https://unilu-plagiat.ac.cd/api" required />
            </div>
            <div className="space-y-2">
              <Label>Clé API (optionnel)</Label>
              <Input type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder="Clé d'authentification" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
