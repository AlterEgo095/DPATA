'use client';

// CreateBatchForm - Formulaire de création d'un job batch
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Check, Loader2, FileText, AlertCircle,
  Settings, Zap, Target, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface DocumentOption {
  id: string;
  title: string;
  type: string;
  status: string;
  facultyName?: string;
  authorName?: string;
}

interface BatchConfigForm {
  name: string;
  threshold: number;
  scope: string;
  engine: string;
  priority: string;
  notifyOnComplete: boolean;
}

interface CreateBatchFormProps {
  onSubmit: (data: {
    name: string;
    documentIds: string[];
    config: Omit<BatchConfigForm, 'name'>;
  }) => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

const SCOPE_OPTIONS = [
  { value: 'faculty', label: 'Faculté', description: 'Documents de la même faculté', icon: Layers },
  { value: 'department', label: 'Département', description: 'Documents du même département', icon: Target },
  { value: 'promotion', label: 'Promotion', description: 'Documents de la même promotion', icon: Zap },
  { value: 'all', label: 'Global', description: 'Tous les documents du système', icon: Settings },
];

const ENGINE_OPTIONS = [
  { value: 'tfidf', label: 'TF-IDF', description: 'Rapide et efficace' },
  { value: 'hybrid', label: 'Hybride', description: 'Équilibré précision/vitesse' },
  { value: 'semantic', label: 'Sémantique', description: 'Plus précis, plus lent' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Basse', color: 'text-slate-600' },
  { value: 'normal', label: 'Normale', color: 'text-blue-600' },
  { value: 'high', label: 'Haute', color: 'text-red-600' },
];

export function CreateBatchForm({ onSubmit, isSubmitting = false, className }: CreateBatchFormProps) {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  
  const [config, setConfig] = useState<BatchConfigForm>({
    name: '',
    threshold: 15,
    scope: 'faculty',
    engine: 'tfidf',
    priority: 'normal',
    notifyOnComplete: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Charger les documents disponibles
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const response = await fetch('/api/documents?limit=200&status=ANALYZED,SUBMITTED,DRAFT');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Filtrer les documents par recherche
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle sélection document
  const toggleDocument = useCallback((docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        // Limite à 50 documents
        if (next.size >= 50) {
          setErrors(prev => ({ ...prev, docs: 'Maximum 50 documents par batch' }));
          return prev;
        }
        next.add(docId);
        setErrors(prev => ({ ...prev, docs: undefined }));
      }
      return next;
    });
  }, []);

  // Sélectionner tout / désélectionner tout
  const toggleSelectAll = () => {
    if (selectedDocIds.size === filteredDocuments.length && filteredDocuments.length > 0) {
      setSelectedDocIds(new Set());
    } else {
      const limitedSelection = filteredDocuments.slice(0, 50).map(d => d.id);
      if (limitedSelection.length > 50) {
        setErrors({ docs: 'Maximum 50 documents par batch' });
        return;
      }
      setSelectedDocIds(new Set(limitedSelection));
      setErrors({});
    }
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.name.trim()) {
      newErrors.name = 'Le nom du job est requis';
    }

    if (selectedDocIds.size === 0) {
      newErrors.docs = 'Sélectionnez au moins un document';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Soumission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    try {
      await onSubmit({
        name: config.name.trim(),
        documentIds: Array.from(selectedDocIds),
        config: {
          threshold: config.threshold / 100,
          scope: config.scope,
          engine: config.engine,
          priority: config.priority,
          notifyOnComplete: config.notifyOnComplete,
        },
      });

      // Reset form
      setConfig(prev => ({ ...prev, name: '' }));
      setSelectedDocIds(new Set());
    } catch (error: any) {
      setSubmitError(error.message || 'Erreur lors de la création du job');
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nouvelle analyse groupée
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Sélectionnez les documents à analyser et configurez les paramètres
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nom du job */}
          <div className="space-y-2">
            <Label htmlFor="batch-name">
              Nom du job <span className="text-red-500">*</span>
            </Label>
            <Input
              id="batch-name"
              placeholder="Ex: Analyse promotion L2 Info 2025"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              className={cn(errors.name && 'border-red-300 focus:border-red-500')}
            />
            {errors.name && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Sélection des documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                Documents à analyser 
                <span className="text-red-500">*</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {selectedDocIds.size}/50
                </Badge>
              </Label>
              
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                onClick={toggleSelectAll}
                disabled={filteredDocuments.length === 0}
              >
                {selectedDocIds.size === filteredDocuments.length && selectedDocIds.size > 0
                  ? 'Tout désélectionner'
                  : 'Tout sélectionner'}
              </Button>
            </div>

            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Liste des documents */}
            <div className={cn(
              'max-h-[280px] overflow-y-auto rounded-md border space-y-1 p-2',
              errors.docs ? 'border-red-300' : 'border-slate-200'
            )}>
              {loadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-sm text-slate-500">Chargement des documents...</span>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun document trouvé</p>
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    isSelected={selectedDocIds.has(doc.id)}
                    onToggle={() => toggleDocument(doc.id)}
                  />
                ))
              )}
            </div>

            {errors.docs && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.docs}
              </p>
            )}
          </div>

          {/* Configuration avancée */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration de l&apos;analyse
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Seuil de similarité */}
              <div className="space-y-2">
                <Label className="text-xs">
                  Seuil de similarité: {config.threshold}%
                </Label>
                <Slider
                  value={[config.threshold]}
                  onValueChange={([v]) => setConfig(prev => ({ ...prev, threshold: v }))}
                  min={5}
                  max={80}
                  step={5}
                  className="py-2"
                />
                <p className="text-[11px] text-slate-500">
                  Score minimum pour détecter une correspondance
                </p>
              </div>

              {/* Moteur d'analyse */}
              <div className="space-y-2">
                <Label className="text-xs">Moteur d&apos;analyse</Label>
                <Select 
                  value={config.engine} 
                  onValueChange={(v) => setConfig(prev => ({ ...prev, engine: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-slate-500 ml-2 text-xs">{opt.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Portée */}
              <div className="space-y-2">
                <Label className="text-xs">Portée de comparaison</Label>
                <Select 
                  value={config.scope} 
                  onValueChange={(v) => setConfig(prev => ({ ...prev, scope: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priorité */}
              <div className="space-y-2">
                <Label className="text-xs">Priorité</Label>
                <Select 
                  value={config.priority} 
                  onValueChange={(v) => setConfig(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={opt.color}>{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notification */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <Label className="text-sm">Notifier à la fin</Label>
                <p className="text-xs text-slate-500">Recevoir une notification quand l&apos;analyse est terminée</p>
              </div>
              <Switch
                checked={config.notifyOnComplete}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, notifyOnComplete: checked }))}
              />
            </div>
          </div>

          {/* Erreur de soumission */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Bouton soumission */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || selectedDocIds.size === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création en cours...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Lancer l&apos;analyse groupée
                {selectedDocIds.size > 0 && ` (${selectedDocIds.size} documents)`}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// SOUS-COMPOSANT: Document Row
// ============================================================

function DocumentRow({ 
  doc, 
  isSelected, 
  onToggle 
}: { 
  doc: DocumentOption; 
  isSelected: boolean; 
  onToggle: () => void;
}) {
  const typeColors: Record<string, string> = {
    TFC: 'bg-purple-100 text-purple-700',
    MEMOIRE: 'bg-blue-100 text-blue-700',
    THESE: 'bg-emerald-100 text-emerald-700',
    ARTICLE: 'bg-amber-100 text-amber-700',
    AUTRE: 'bg-slate-100 text-slate-700',
  };

  return (
    <div
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors',
        isSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
      )}
    >
      {/* Checkbox personnalisée */}
      <div className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        isSelected 
          ? 'bg-emerald-500 border-emerald-500 text-white' 
          : 'border-slate-300'
      )}>
        {isSelected && <Check className="h-3 w-3" />}
      </div>

      {/* Infos document */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isSelected ? 'text-emerald-900' : 'text-slate-900'
        )}>
          {doc.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', typeColors[doc.type])}>
            {doc.type}
          </Badge>
          {doc.authorName && (
            <span className="text-[11px] text-slate-500 truncate">{doc.authorName}</span>
          )}
        </div>
      </div>
    </div>
  );
}
