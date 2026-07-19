'use client';

// Settings Page - Editable Configuration
// PHASE 3: Améliorations Frontend - Settings Functionnel

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Cpu,
  Database,
  Shield,
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemSettings {
  // IA Engine
  aiModel: string;
  similarityThreshold: number;
  maxResults: number;
  
  // Detection
  enableAIDetection: boolean;
  enablePlagiarismDetection: boolean;
  classificationTypes: string[];
  
  // Security
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  
  // General
  institutionName: string;
  academicYear: string;
  defaultLanguage: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  aiModel: 'tfidf-v2',
  similarityThreshold: 0.80,
  maxResults: 10,
  enableAIDetection: true,
  enablePlagiarismDetection: true,
  classificationTypes: ['COPY_PASTE', 'PARAPHRASE', 'REFORMULATION', 'TRANSLATION', 'WEAK_MATCH'],
  sessionTimeout: 7, // days
  maxLoginAttempts: 5,
  lockoutDuration: 15, // minutes
  institutionName: 'Université de Kinshasa',
  academicYear: '2025-2026',
  defaultLanguage: 'fr',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load settings from API (or localStorage for demo)
    const saved = localStorage.getItem('dpata_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to parse settings');
      }
    }
    setLoading(false);
  }, []);

  function updateSetting<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }

  async function handleSave() {
    setSaving(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Save to localStorage (in production, save to /api/settings)
      localStorage.setItem('dpata_settings', JSON.stringify(settings));
      
      setHasChanges(false);
      toast.success('Paramètres sauvegardés avec succès', {
        description: 'Les nouvelles configurations ont été appliquées.',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde', {
        description: 'Veuillez réessayer plus tard.',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
    toast.info('Paramètres réinitialisés aux valeurs par défaut');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-slate-700" />
            Paramètres
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configuration du moteur IA et de la plateforme
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Réinitialiser
          </Button>
          
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-1.5" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* AI Model Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-600" />
              Modèle IA
            </CardTitle>
            <CardDescription>Configuration du moteur d'analyse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aiModel">Algorithme principal</Label>
              <Select
                value={settings.aiModel}
                onValueChange={(v) => updateSetting('aiModel', v)}
              >
                <SelectTrigger id="aiModel">
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tfidf-v2">TF-IDF v2 (actuel)</SelectItem>
                  <SelectItem value="sentence-bert">Sentence-BERT (recommandé)</SelectItem>
                  <SelectItem value="openai-embeddings">OpenAI Embeddings</SelectItem>
                  <SelectItem value="custom">Modèle personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">
                Seuil de similarité: {(settings.similarityThreshold * 100).toFixed(0)}%
              </Label>
              <Input
                id="threshold"
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.similarityThreshold}
                onChange={(e) => updateSetting('similarityThreshold', parseFloat(e.target.value))}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Moins strict</span>
                <span>Plus strict</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxResults">Résultats maximum</Label>
              <Input
                id="maxResults"
                type="number"
                min="5"
                max="50"
                value={settings.maxResults}
                onChange={(e) => updateSetting('maxResults', parseInt(e.target.value) || 10)}
              />
            </div>

            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-purple-700">
                💡 Pour de meilleurs résultats, utilisez Sentence-BERT avec un seuil entre 70% et 85%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Detection Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-amber-600" />
              Paramètres de détection
            </CardTitle>
            <CardDescription>Options d'analyse et classification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="plagiarism">Détection de plagiat</Label>
                <p className="text-xs text-slate-500">Analyse TF-IDF + similarité cosinus</p>
              </div>
              <Switch
                id="plagiarism"
                checked={settings.enablePlagiarismDetection}
                onCheckedChange={(v) => updateSetting('enablePlagiarismDetection', v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="aidetect">Détection IA générée</Label>
                <p className="text-xs text-slate-500">Analyse stylométrique</p>
              </div>
              <Switch
                id="aidetect"
                checked={settings.enableAIDetection}
                onCheckedChange={(v) => updateSetting('enableAIDetection', v)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Types de classification</Label>
              <div className="flex flex-wrap gap-1.5">
                {settings.classificationTypes.map((type) => (
                  <Badge key={type} variant="secondary" className="font-mono text-xs">
                    {type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Sécurité
            </CardTitle>
            <CardDescription>Authentification et protection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Durée de session (jours)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min="1"
                max="30"
                value={settings.sessionTimeout}
                onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 7)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAttempts">Tentatives login max</Label>
              <Input
                id="maxAttempts"
                type="number"
                min="3"
                max="20"
                value={settings.maxLoginAttempts}
                onChange={(e) => updateSetting('maxLoginAttempts', parseInt(e.target.value) || 5)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lockout">Blocage IP (minutes)</Label>
              <Input
                id="lockout"
                type="number"
                min="5"
                max="120"
                value={settings.lockoutDuration}
                onChange={(e) => updateSetting('lockoutDuration', parseInt(e.target.value) || 15)}
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Sécurité active
              </div>
              <ul className="text-xs text-emerald-600 space-y-0.5 ml-6">
                <li>• Passwords hashés avec bcrypt</li>
                <li>• JWT avec httpOnly cookies</li>
                <li>• Rate limiting par IP</li>
                <li>• Protection CSRF activée</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              Général
            </CardTitle>
            <CardDescription>Informations institutionnelles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="institution">Nom de l'institution</Label>
              <Input
                id="institution"
                value={settings.institutionName}
                onChange={(e) => updateSetting('institutionName', e.target.value)}
                placeholder="Nom de l'université"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Année académique</Label>
              <Input
                id="academicYear"
                value={settings.academicYear}
                onChange={(e) => updateSetting('academicYear', e.target.value)}
                placeholder="2025-2026"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Langue par défaut</Label>
              <Select
                value={settings.defaultLanguage}
                onValueChange={(v) => updateSetting('defaultLanguage', v)}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sw">Kiswahili</SelectItem>
                  <SelectItem value="ln">Lingála</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>État de la base de données</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">JSON (démo)</Badge>
                <span className="text-xs text-slate-500">→ PostgreSQL pour production</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status indicator */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-800">Modifications non sauvegardées</p>
              <p className="text-xs text-amber-600">N'oubliez pas de sauvegarder vos changements</p>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              Sauvegarder maintenant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
