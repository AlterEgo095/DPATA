'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ShieldCheck, Globe, Lock, Database, Save } from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(data);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const save = async (section: string, data: any) => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [section]: data }),
      });
      toast.success('Param\u00e8tres sauvegard\u00e9s');
    } catch {
      toast.error('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const update = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: value },
    }));
  };

  const saveSection = (section: string) => {
    save(section, settings[section]);
  };

  if (loading) return <div className="h-64 bg-slate-100 animate-pulse rounded-xl" />;

  const platform = settings.platform || {};
  const security = settings.security || {};
  const detection = settings.detection || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Param\u00e8tres de la plateforme</h1>
        <p className="text-muted-foreground text-sm mt-1">Configuration g\u00e9n\u00e9rale accessible sans intervention technique</p>
      </div>

      <Tabs defaultValue="platform" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="platform" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> Plateforme</TabsTrigger>
          <TabsTrigger value="detection" className="gap-1.5"><Database className="h-3.5 w-3.5" /> D\u00e9tection</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Lock className="h-3.5 w-3.5" /> S\u00e9curit\u00e9</TabsTrigger>
        </TabsList>

        <TabsContent value="platform">
          <Card>
            <CardHeader><CardTitle className="text-base">Param\u00e8tres de la plateforme</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nom de la plateforme</Label><Input value={platform.name || 'PlagiatIA'} onChange={e => update('platform', 'name', e.target.value)} /></div>
                <div className="space-y-2"><Label>Institution</Label><Input value={platform.institution || ''} onChange={e => update('platform', 'institution', e.target.value)} /></div>
                <div className="space-y-2"><Label>Ann\u00e9e acad\u00e9mique</Label><Input value={platform.academicYear || ''} onChange={e => update('platform', 'academicYear', e.target.value)} /></div>
                <div className="space-y-2"><Label>Taille max fichier (MB)</Label><Input type="number" value={platform.maxFileSizeMB || 50} onChange={e => update('platform', 'maxFileSizeMB', Number(e.target.value))} /></div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <div><Label>Mode maintenance</Label><p className="text-xs text-muted-foreground">D\u00e9sactive l'acc\u00e8s public temporairement</p></div>
                <Switch checked={platform.maintenanceMode || false} onCheckedChange={v => { update('platform', 'maintenanceMode', v); save('platform', { ...platform, maintenanceMode: v }); }} />
              </div>
              <div className="flex justify-end pt-4"><Button onClick={() => saveSection('platform')} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Sauvegarder</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detection">
          <Card>
            <CardHeader><CardTitle className="text-base">Param\u00e8tres de d\u00e9tection</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Seuil par d\u00e9faut</Label><Input type="number" step="0.01" value={detection.defaultThreshold ?? 0.15} onChange={e => update('detection', 'defaultThreshold', Number(e.target.value))} /><p className="text-xs text-muted-foreground">Score minimum pour signaler un match</p></div>
                <div className="space-y-2"><Label>Max documents corpus</Label><Input type="number" value={detection.maxCorpusDocuments ?? 15} onChange={e => update('detection', 'maxCorpusDocuments', Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Min mots par segment</Label><Input type="number" value={detection.minWordsPerSegment ?? 5} onChange={e => update('detection', 'minWordsPerSegment', Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Max mots par segment</Label><Input type="number" value={detection.maxWordsPerSegment ?? 60} onChange={e => update('detection', 'maxWordsPerSegment', Number(e.target.value))} /></div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <div><Label>Analyse hybride</Label><p className="text-xs text-muted-foreground">Combine TF-IDF et LLM pour de meilleurs r\u00e9sultats</p></div>
                <Switch checked={detection.enableHybrid !== false} onCheckedChange={v => update('detection', 'enableHybrid', v)} />
              </div>
              <div className="flex justify-end pt-4"><Button onClick={() => saveSection('detection')} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Sauvegarder</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle className="text-base">Param\u00e8tres de s\u00e9curit\u00e9</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tentatives max connexion</Label><Input type="number" value={security.maxLoginAttempts ?? 5} onChange={e => update('security', 'maxLoginAttempts', Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Timeout session (min)</Label><Input type="number" value={security.sessionTimeoutMinutes ?? 480} onChange={e => update('security', 'sessionTimeoutMinutes', Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Longueur min mot de passe</Label><Input type="number" value={security.passwordMinLength ?? 8} onChange={e => update('security', 'passwordMinLength', Number(e.target.value))} /></div>
              </div>
              <div className="flex justify-end pt-4"><Button onClick={() => saveSection('security')} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Sauvegarder</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
