'use client';

// Dashboard Page - API Keys Management
// List, create, and manage API keys for third-party integrations

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeyCard, type ApiKeyData } from '@/components/api/api-key-card';
import {
  Key,
  Plus,
  BookOpen,
  Terminal,
  BarChart3,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

// Types
interface CreateKeyForm {
  name: string;
  permissions: string[];
  rateLimit: number;
  ipAddressWhitelist: string;
  expiresAt: string;
  isTest: boolean;
}

interface KeyStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  requestsByDay: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
}

// Mock user ID (in real app, this would come from auth session)
const CURRENT_USER_ID = 'user_admin_001';

export default function ApiKeysDashboardPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ id: string; key: string; prefix: string; name: string } | null>(null);
  const [selectedKeyStats, setSelectedKeyStats] = useState<KeyStats | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Form state
  const [form, setForm] = useState<CreateKeyForm>({
    name: '',
    permissions: ['read'],
    rateLimit: 1000,
    ipAddressWhitelist: '',
    expiresAt: '',
    isTest: true,
  });

  // Fetch API keys
  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/keys?userId=${CURRENT_USER_ID}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setApiKeys(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Handle create new key
  const handleCreateKey = async () => {
    if (!form.name.trim()) return;

    try {
      setCreating(true);
      const payload = {
        name: form.name,
        permissions: form.permissions,
        rateLimit: form.rateLimit,
        ipAddressWhitelist: form.ipAddressWhitelist ? form.ipAddressWhitelist.split(',').map(ip => ip.trim()).filter(Boolean) : undefined,
        expiresAt: form.expiresAt || undefined,
        isTest: form.isTest,
        createdBy: CURRENT_USER_ID,
      };

      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNewKey({
            id: data.data.id,
            key: data.data.key,
            prefix: data.data.prefix,
            name: data.data.name,
          });
          setShowCreateDialog(false);
          // Reset form
          setForm({
            name: '',
            permissions: ['read'],
            rateLimit: 1000,
            ipAddressWhitelist: '',
            expiresAt: '',
            isTest: true,
          });
          // Refresh list
          fetchKeys();
        }
      }
    } catch (error) {
      console.error('Error creating API key:', error);
    } finally {
      setCreating(false);
    }
  };

  // Handle revoke key
  const handleRevokeKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchKeys();
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
    }
  };

  // Handle view stats
  const handleViewStats = async (keyId: string) => {
    setSelectedKeyId(keyId);
    try {
      const response = await fetch(`/api/keys/${keyId}/stats?days=30`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedKeyStats(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching key stats:', error);
    }
  };

  // Toggle permission in form
  const togglePermission = (perm: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Key className="w-8 h-8" />
            Clés API
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les clés d&apos;accès pour les intégrations tierces
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle Clé
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle clé API</DialogTitle>
              <DialogDescription>
                Générez une clé API pour permettre à un système tiers d&apos;accéder à l&apos;API PlagiatIA.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="name">Nom de la clé *</Label>
                <Input
                  id="name"
                  placeholder="ex: Intégration LMS Moodle"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Permissions */}
              <div className="grid gap-2">
                <Label>Permissions</Label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'read', label: 'Lecture', desc: 'Accès aux données' },
                    { value: 'write', label: 'Écriture', desc: 'Créer/modifier' },
                    { value: 'admin', label: 'Admin', desc: 'Droits complets' },
                  ].map((perm) => (
                    <label
                      key={perm.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                        form.permissions.includes(perm.value)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={form.permissions.includes(perm.value)}
                        onCheckedChange={() => togglePermission(perm.value)}
                      />
                      <div>
                        <span className="text-sm font-medium">{perm.label}</span>
                        <span className="text-xs text-muted-foreground block">{perm.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rate Limit */}
              <div className="grid gap-2">
                <Label htmlFor="rateLimit">Limite de requêtes (par heure)</Label>
                <Select
                  value={String(form.rateLimit)}
                  onValueChange={(v) => setForm(prev => ({ ...prev, rateLimit: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100/h (Limitée)</SelectItem>
                    <SelectItem value="500">500/h (Modérée)</SelectItem>
                    <SelectItem value="1000">1000/h (Standard)</SelectItem>
                    <SelectItem value="5000">5000/h (Élevée)</SelectItem>
                    <SelectItem value="10000">10000/h (Max)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* IP Whitelist */}
              <div className="grid gap-2">
                <Label htmlFor="ipWhitelist">Liste blanche IP (optionnel)</Label>
                <Input
                  id="ipWhitelist"
                  placeholder="192.168.1.1, 10.0.0.0/8 (séparées par des virgules)"
                  value={form.ipAddressWhitelist}
                  onChange={(e) => setForm(prev => ({ ...prev, ipAddressWhitelist: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour autoriser toutes les adresses IP
                </p>
              </div>

              {/* Expiration */}
              <div className="grid gap-2">
                <Label htmlFor="expiresAt">Date d&apos;expiration (optionnel)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>

              {/* Test Mode */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.isTest}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, isTest: !!checked }))}
                />
                <Label>Clé de test (pk_test_*)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleCreateKey} 
                disabled={!form.name.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer la clé'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Key Display */}
      {newKey && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    Clé API créée avec succès !
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Sauvegardez cette clé maintenant. Elle ne sera plus affichée.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded-md font-mono text-sm border">
                  <code className="flex-1 break-all">{newKey.key}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(newKey.key)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewKey(null)}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="w-4 h-4" />
            Mes Clés
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Documentation
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="gap-2">
            <Terminal className="w-4 h-4" />
            Sandbox
          </TabsTrigger>
        </TabsList>

        {/* Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Aucune clé API</h3>
                <p className="text-muted-foreground mb-4">
                  Créez votre première clé API pour commencer à utiliser l&apos;API PlagiatIA.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une clé
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {apiKeys.map((key) => (
                <ApiKeyCard
                  key={key.id}
                  apiKey={key}
                  fullKey={newKey?.id === key.id ? newKey.key : undefined}
                  onRevoke={handleRevokeKey}
                  onViewStats={handleViewStats}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Documentation de l&apos;API
              </CardTitle>
              <CardDescription>
                Spécification OpenAPI 3.0 complète de l&apos;API PlagiatIA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Endpoint de documentation</p>
                  <code className="text-sm text-muted-foreground">GET /api/v1/docs</code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/api/v1/docs', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Voir la doc
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Authentification
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>Clés API sécurisées (bcrypt hashage)</li>
                    <li>Format: pk_live_xxx ou pk_test_xxx</li>
                    <li>Header: X-API-Key</li>
                    <li>Liste blanche IP optionnelle</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    Rate Limiting
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>1000 req/h par défaut</li>
                    <li>Sliding window algorithm</li>
                    <li>Headers X-RateLimit-*</li>
                    <li>429 avec Retry-After</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-3">Endpoints disponibles</h4>
                <div className="grid gap-2 text-sm font-mono">
                  {[
                    { method: 'GET', path: '/v1', desc: 'Info API' },
                    { method: 'POST', path: '/v1/auth', desc: 'Valider clé' },
                    { method: 'GET', path: '/v1/documents', desc: 'Lister documents' },
                    { method: 'POST', path: '/v1/documents', desc: 'Créer document' },
                    { method: 'GET', path: '/v1/documents/{id}', desc: 'Détails document' },
                    { method: 'POST', path: '/v1/documents/{id}/analyze', desc: 'Lancer analyse' },
                    { method: 'GET', path: '/v1/subjects', desc: 'Lister sujets' },
                    { method: 'POST', path: '/v1/subjects', desc: 'Valider sujet' },
                    { method: 'GET', path: '/v1/statistics/overview', desc: 'Stats globales' },
                    { method: 'GET', path: '/v1/statistics/trends', desc: 'Tendances' },
                  ].map((endpoint) => (
                    <div key={endpoint.path} className="flex items-center gap-3 p-2 hover:bg-muted rounded">
                      <Badge 
                        variant={endpoint.method === 'GET' ? 'secondary' : 'default'}
                        className="shrink-0"
                      >
                        {endpoint.method}
                      </Badge>
                      <code className="flex-1">{endpoint.path}</code>
                      <span className="text-muted-foreground hidden sm:inline">{endpoint.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sandbox Tab */}
        <TabsContent value="sandbox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Sandbox de Test
              </CardTitle>
              <CardDescription>
                Testez les endpoints de l&apos;API directement depuis votre navigateur
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-sm overflow-x-auto">
                <pre>{`# Exemple de requête curl

curl -X GET "http://localhost:3000/api/v1" \\
  -H "X-API-Key: pk_live_votre_clé_ici"

# Réponse attendue:
{
  "success": true,
  "data": {
    "name": "PlagiatIA Public API",
    "version": "1.0.0",
    "status": "operational"
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2025-01-20T10:30:00Z",
    "version": "1.0.0"
  }
}`}</pre>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg space-y-3">
                  <h4 className="font-semibold">Tester l&apos;authentification</h4>
                  <p className="text-sm text-muted-foreground">
                    Validez votre clé API et vérifiez ses permissions.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      // This would open a sandbox interface
                      alert('Sandbox en développement - Utilisez Postman ou curl pour tester');
                    }}
                  >
                    <Terminal className="w-4 h-4 mr-2" />
                    Ouvrir le tester
                  </Button>
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <h4 className="font-semibold">Importer dans Postman</h4>
                  <p className="text-sm text-muted-foreground">
                    Téléchargez la collection Postman pour tester tous les endpoints.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      // Download OpenAPI spec
                      fetch('/api/v1/docs')
                        .then(r => r.json())
                        .then(spec => {
                          const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'plagiatia-openapi.json';
                          a.click();
                        });
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Télécharger OpenAPI
                  </Button>
                </div>
              </div>

              {/* Stats Panel */}
              {selectedKeyStats && selectedKeyId && (
                <div className="mt-6 p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Statistiques de la clé sélectionnée
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedKeyStats(null); setSelectedKeyId(null); }}
                    >
                      Fermer
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{selectedKeyStats.totalRequests}</div>
                      <div className="text-xs text-muted-foreground">Total requêtes</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded">
                      <div className="text-2xl font-bold text-green-600">{selectedKeyStats.successCount}</div>
                      <div className="text-xs text-muted-foreground">Succès</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded">
                      <div className="text-2xl font-bold text-red-600">{selectedKeyStats.errorCount}</div>
                      <div className="text-xs text-muted-foreground">Erreurs</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded">
                      <div className="text-2xl font-bold text-blue-600">{selectedKeyStats.avgResponseTime}ms</div>
                      <div className="text-xs text-muted-foreground">Temps moyen</div>
                    </div>
                  </div>

                  {/* Requests by endpoint */}
                  <div>
                    <h5 className="text-sm font-medium mb-2">Requêtes par endpoint</h5>
                    <div className="space-y-2">
                      {Object.entries(selectedKeyStats.requestsByEndpoint)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([endpoint, count]) => (
                          <div key={endpoint} className="flex items-center gap-2 text-sm">
                            <code className="truncate max-w-[200px]">{endpoint}</code>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${(count / selectedKeyStats.totalRequests) * 100}%` }}
                                  />
                                </div>
                                <span className="text-muted-foreground w-12 text-right">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
