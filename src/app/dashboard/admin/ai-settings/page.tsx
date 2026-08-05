'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Brain, Zap, Settings, Play, CheckCircle2, XCircle, Clock, AlertTriangle, Activity, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ModelInfo {
  id: string; name: string; provider: string; isFree: boolean;
  capabilities: string[]; maxTokens: number; priority: number; enabled: boolean;
}

interface AIStats {
  total: number; successes: number; errors: number; fallbacks: number;
  avgResponseTime: number; totalTokens: number;
  byModel: Record<string, { calls: number; success: number }>;
}

interface EngineStatus {
  name: string; version: string; type: string; status: string; details: string;
}

interface CallLog {
  id: string; timestamp: string; model: string; provider: string;
  function: string; inputTokens: number; outputTokens: number; totalTokens: number;
  responseTimeMs: number; status: string; error?: string;
  fallbackFrom?: string; fallbackTo?: string;
}

export default function AISettingsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [stats, setStats] = useState<AIStats | null>(null);
  const [engines, setEngines] = useState<Record<string, EngineStatus>>({});
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testPrompt, setTestPrompt] = useState('Réponds OK en français.');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [aiRes, settingsRes] = await Promise.all([
        fetch('/api/admin/ai').then(r => r.json()),
        fetch('/api/admin/settings?section=ai').then(r => r.json()).catch(() => ({ ai: {} })),
      ]);
      setModels(aiRes.models || []);
      setStats(aiRes.stats || null);
      setEngines(aiRes.engines || {});
      setLogs(aiRes.recentLogs || []);
      setSettings(settingsRes.ai || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const testModel = async (modelId: string) => {
    setTesting(modelId);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, prompt: testPrompt }),
      });
      const data = await res.json();
      setTestResult(data);
      toast.success(data.success ? `Modèle ${modelId} fonctionnel (${data.responseTimeMs}ms)` : `Échec: ${data.error}`);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
      toast.error('Erreur de test');
    } finally {
      setTesting(null);
    }
  };

  const saveSettings = async (key: string, value: any) => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai: { ...settings, [key]: value } }),
      });
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Paramètre sauvegardé');
    } catch {
      toast.error('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const refreshLogs = async () => {
    const res = await fetch('/api/admin/ai?view=logs');
    const data = await res.json();
    setLogs(data.logs || []);
    toast.success('Logs actualisés');
  };

  if (loading) {
    return <div className="space-y-4"><div className="h-64 bg-slate-100 animate-pulse rounded-xl" /></div>;
  }

  const successRate = stats ? Math.round((stats.successes / Math.max(stats.total, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6" /> Configuration IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez les modèles, paramètres et surveillez les performances</p>
        </div>
        <Button variant="outline" onClick={refreshLogs} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </Button>
      </div>

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="models" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Modèles</TabsTrigger>
          <TabsTrigger value="engines" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Moteurs</TabsTrigger>
          <TabsTrigger value="params" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Paramètres</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Logs</TabsTrigger>
        </TabsList>

        {/* TAB: Models */}
        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Modèles disponibles</CardTitle>
              <CardDescription>Modèles gratuits détectés avec votre clé API Z.ai</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {models.map(m => (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.isFree && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">GRATUIT</Badge>}
                        {m.enabled && <Badge variant="default" className="text-xs">Actif</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{m.provider} · {m.id} · Max {m.maxTokens} tokens · Priorité {m.priority}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.capabilities.map(c => (
                          <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testModel(m.id)}
                      disabled={testing === m.id}
                      className="gap-1.5 shrink-0"
                    >
                      {testing === m.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Tester
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Test Result Dialog */}
          {testResult && (
            <Card className={testResult.success ? 'border-emerald-200' : 'border-red-200'}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {testResult.success ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                  <CardTitle className="text-base">Résultat du test</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Modèle:</span><span className="font-mono">{testResult.model}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Temps:</span><span>{testResult.responseTimeMs}ms</span></div>
                {testResult.success ? (
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded text-sm">{testResult.response}</div>
                ) : (
                  <div className="text-red-600">{testResult.error}</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Taux succès</p><p className="text-2xl font-bold text-emerald-600">{successRate}%</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Temps moyen</p><p className="text-2xl font-bold">{stats?.avgResponseTime ?? 0}ms</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Erreurs</p><p className="text-2xl font-bold text-red-600">{stats?.errors ?? 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tokens</p><p className="text-2xl font-bold">{stats?.totalTokens?.toLocaleString() ?? 0}</p></CardContent></Card>
          </div>
        </TabsContent>

        {/* TAB: Engines */}
        <TabsContent value="engines" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Statut des moteurs d'analyse</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(engines).map(([key, eng]) => (
                <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${eng.status === 'healthy' ? 'bg-emerald-500' : eng.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="font-medium">{eng.name || key}</p>
                      <p className="text-xs text-muted-foreground">{eng.type} · v{eng.version} · {eng.details}</p>
                    </div>
                  </div>
                  <Badge variant={eng.status === 'healthy' ? 'default' : 'destructive'}>{eng.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Parameters */}
        <TabsContent value="params" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Paramètres du moteur IA</CardTitle><CardDescription>Configurez le comportement de l'intelligence artificielle</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Modèle principal</Label>
                <Select value={settings.primaryModel || 'glm-4.5-flash'} onValueChange={v => saveSettings('primaryModel', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {models.filter(m => m.isFree).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Température: {settings.temperature ?? 0.3}</Label>
                <Slider value={[settings.temperature ?? 0.3]} min={0} max={1} step={0.1} onValueChange={([v]) => saveSettings('temperature', v)} />
                <p className="text-xs text-muted-foreground">Plus basse = plus précis, plus haute = plus créatif</p>
              </div>
              <div className="space-y-2">
                <Label>Max Tokens: {settings.maxTokens ?? 4096}</Label>
                <Input type="number" value={settings.maxTokens ?? 4096} onChange={e => saveSettings('maxTokens', Number(e.target.value))} min={256} max={8192} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label>Fallback automatique</Label><p className="text-xs text-muted-foreground">Basculer vers un autre modèle si le principal échoue</p></div>
                <Switch checked={settings.fallbackEnabled !== false} onCheckedChange={v => saveSettings('fallbackEnabled', v)} />
              </div>
              <div className="space-y-2">
                <Label>Timeout (ms): {settings.timeoutMs ?? 60000}</Label>
                <Input type="number" value={settings.timeoutMs ?? 60000} onChange={e => saveSettings('timeoutMs', Number(e.target.value))} min={5000} max={120000} step={5000} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Paramètres de détection hybride</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Seuil de détection par défaut: {settings.defaultThreshold ?? 0.15}</Label>
                <Slider value={[settings.defaultThreshold ?? 0.15]} min={0.05} max={0.5} step={0.01} onValueChange={([v]) => saveSettings('defaultThreshold', v)} />
              </div>
              <div className="space-y-2">
                <Label>Poids TF-IDF: {settings.hybridWeightTfidf ?? 0.4}</Label>
                <Slider value={[settings.hybridWeightTfidf ?? 0.4]} min={0} max={1} step={0.05} onValueChange={([v]) => saveSettings('hybridWeightTfidf', v)} />
              </div>
              <div className="space-y-2">
                <Label>Poids LLM: {settings.hybridWeightLlm ?? 0.6}</Label>
                <Slider value={[settings.hybridWeightLlm ?? 0.6]} min={0} max={1} step={0.05} onValueChange={([v]) => saveSettings('hybridWeightLlm', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Journal des appels IA</CardTitle><CardDescription>{logs.length} appels récents</CardDescription></CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Heure</TableHead>
                      <TableHead className="text-xs">Modèle</TableHead>
                      <TableHead className="text-xs">Fonction</TableHead>
                      <TableHead className="text-xs">Statut</TableHead>
                      <TableHead className="text-xs">Temps</TableHead>
                      <TableHead className="text-xs">Tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun appel enregistré</TableCell></TableRow>}
                    {[...logs].reverse().map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono">{new Date(log.timestamp).toLocaleTimeString('fr-FR')}</TableCell>
                        <TableCell className="text-xs font-mono">{log.model}</TableCell>
                        <TableCell className="text-xs">{log.function}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'success' ? 'default' : log.status === 'fallback' ? 'secondary' : 'destructive'} className="text-xs">
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{log.responseTimeMs}ms</TableCell>
                        <TableCell className="text-xs">{log.totalTokens}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
