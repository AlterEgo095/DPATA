'use client';

// Portal Submit Page - Wizard de validation de sujet amélioré
// Interface en 3 étapes : Sujet → Détails → Résultats

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, ArrowLeft, Copy, Lightbulb, FileSearch, Target,
  BookOpen, Type, Hash, HelpCircle, ChevronRight, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface SimilarSubject {
  subjectId: string;
  title: string;
  similarity: number;
  explanation: string;
  sharedKeywords: string[];
}

interface ValidationResult {
  isOriginal: boolean;
  similarityScore: number;
  threshold: number;
  report: string;
  recommendation: string;
  similarSubjects: SimilarSubject[];
  alternatives: string[];
}

// Steps configuration
const STEPS = [
  { id: 1, title: 'Votre sujet', icon: Type, description: 'Décrivez votre sujet' },
  { id: 2, title: 'Détails', icon: BookOpen, description: 'Précisez votre contexte' },
  { id: 3, title: 'Résultats', icon: FileSearch, description: 'Analyse IA' },
];

export default function PortalSubmitPage() {
  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    description: '',
    domain: '',
    keywords: '',
    objectives: '',
    problemStatement: '',
  });
  
  // Result state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);

  // Update form field
  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Validate step before proceeding
  function canProceedToStep(step: number): boolean {
    switch (step) {
      case 2:
        return form.title.trim().length >= 5;
      case 3:
        return true; // Can submit with minimal info
      default:
        return true;
    }
  }

  // Handle validation submission
  async function handleValidate() {
    if (form.title.length < 5) {
      toast.error('Le titre doit faire au moins 5 caractères');
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      const res = await fetch('/api/subjects/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la validation');
        return;
      }
      
      setResult(data.result);
      setCurrentStep(3); // Go to results
      
      if (data.result.isOriginal) {
        toast.success('🎉 Sujet validé — il est original !');
      } else {
        toast.info(`💡 ${data.result.alternatives.length} alternative(s) proposée(s)`);
      }
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Use an alternative (pre-fill form)
  function useAlternative(alt: string) {
    setSelectedAlternative(alt);
    setForm(prev => ({ ...prev, title: alt, description: '', keywords: '' }));
    setCurrentStep(1);
    toast.success('Alternative sélectionnée — vous pouvez la modifier');
  }

  // Copy to clipboard
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copié dans le presse-papier');
    } catch {
      toast.error('Échec de la copie');
    }

  }

  // Reset everything
  function resetForm() {
    setForm({ title: '', description: '', domain: '', keywords: '', objectives: '', problemStatement: '' });
    setResult(null);
    setSelectedAlternative(null);
    setCurrentStep(1);
  }

  const progressPct = ((currentStep - 1) / (STEPS.length - 1)) * 100;
  const scorePct = result ? (result.similarityScore * 100).toFixed(1) : '0';
  const thresholdPct = result ? (result.threshold * 100).toFixed(0) : '20';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-purple-600" />
          Validation intelligente de sujet
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Vérifiez l&apos;originalité de votre sujet et recevez des alternatives si nécessaire
        </p>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {STEPS.map((step, idx) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    currentStep >= step.id 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    <step.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{step.title}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight className={`h-4 w-4 mx-1 ${currentStep > step.id ? 'text-emerald-500' : 'text-slate-300'}`} />
                  )}
                </div>
              ))}
            </div>
            {result && (
              <Badge variant={result.isOriginal ? "default" : "secondary"} 
                className={result.isOriginal ? "bg-green-500" : "bg-amber-500"}>
                {result.isOriginal ? '✅ Original' : '⚠️ Similaire'}
              </Badge>
            )}
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Step Content */}
      {/* STEP 1: Basic Info */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Type className="h-5 w-5 text-purple-500" />
              Étape 1 : Votre sujet
            </CardTitle>
            <CardDescription>
              Commencez par saisir le titre de votre sujet de mémoire ou TFC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                Titre du sujet <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={form.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="Ex: L'impact de l'intelligence artificielle sur l'éducation..."
                className="text-base"
                autoFocus
              />
              <p className="text-xs text-slate-500">
                {form.title.length}/5 caractères minimum
                {form.title.length >= 5 && <span className="text-emerald-600 ml-1">✓</span>}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Décrivez brièvement votre sujet, son contexte, ce que vous souhaitez explorer..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="domain">
                  <Hash className="h-4 w-4 inline mr-1" />
                  Domaine / Filière
                </Label>
                <Input
                  id="domain"
                  value={form.domain}
                  onChange={e => updateField('domain', e.target.value)}
                  placeholder="Ex: Informatique, Droit, Médecine..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="keywords">
                  <Hash className="h-4 w-4 inline mr-1" />
                  Mots-clés
                </Label>
                <Input
                  id="keywords"
                  value={form.keywords}
                  onChange={e => updateField('keywords', e.target.value)}
                  placeholder="IA, éducation, machine learning..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={() => setCurrentStep(2)} 
                disabled={!canProceedToStep(2)}
                size="lg"
                className="gap-2"
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Details */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Étape 2 : Détails supplémentaires
            </CardTitle>
            <CardDescription>
              Ces informations optionnelles permettent une analyse plus précise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="objectives">
                <Target className="h-4 w-4 inline mr-1" />
                Objectifs de recherche
              </Label>
              <Textarea
                id="objectives"
                value={form.objectives}
                onChange={e => updateField('objectives', e.target.value)}
                placeholder="Que voulez-vous démontrer, explorer ou analyser ?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="problemStatement">
                <HelpCircle className="h-4 w-4 inline mr-1" />
                Problématique
              </Label>
              <Textarea
                id="problemStatement"
                value={form.problemStatement}
                onChange={e => updateField('problemStatement', e.target.value)}
                placeholder="Quelle question principale votre travail cherche-t-il à répondre ?"
                rows={2}
              />
            </div>

            <div className="bg-blue-50 rounded-xl p-4 flex gap-3">
              <Lightbulb className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">💡 Astuce</p>
                <p className="text-xs text-blue-700 mt-1">
                  Plus vous fournissez de détails, plus notre IA pourra effectuer une analyse précise 
                  et vous proposer des alternatives pertinentes si besoin.
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleValidate} disabled={loading} size="lg" className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Valider mon sujet
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Results */}
      {currentStep === 3 && result && (
        <div className="space-y-6">
          {/* Score Card */}
          <Card className={`overflow-hidden ${
            result.isOriginal 
              ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' 
              : 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
          }`}>
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Score Circle */}
                <div className={`relative h-32 w-32 rounded-full flex items-center justify-center ${
                  result.isOriginal ? 'bg-green-100' : 'bg-amber-100'
                }`}>
                  <svg className="absolute inset-0 h-full w-full -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-white/30"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - parseFloat(scorePct) / 100)}`}
                      className={result.isOriginal ? 'text-green-500' : 'text-amber-500'}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center z-10">
                    <div className={`text-3xl font-bold ${result.isOriginal ? 'text-green-700' : 'text-amber-700'}`}>
                      {scorePct}%
                    </div>
                    <div className={`text-xs ${result.isOriginal ? 'text-green-600' : 'text-amber-600'}`}>
                      similarité
                    </div>
                  </div>
                </div>

                {/* Status Text */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    {result.isOriginal ? (
                      <>
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                        <h2 className="text-2xl font-bold text-green-800">Sujet Original !</h2>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-8 w-8 text-amber-500" />
                        <h2 className="text-2xl font-bold text-amber-800">Similarité détectée</h2>
                      </>
                    )}
                  </div>
                  
                  <p className="text-slate-600 mb-4">{result.recommendation}</p>
                  
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <Badge variant="outline" className="text-xs">
                      Seuil: {thresholdPct}%
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Base: 51 sujets
                    </Badge>
                    {result.isOriginal && (
                      <Badge className="bg-green-500 text-white text-xs">
                        Validé ✓
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Similar Subjects */}
            {result.similarSubjects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Sujets similaires trouvés
                  </CardTitle>
                  <CardDescription>
                    Ces sujets existent déjà dans notre base de connaissances
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[300px] pr-4">
                    <div className="space-y-3">
                      {result.similarSubjects.map((subject, i) => (
                        <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-sm line-clamp-2">{subject.title}</p>
                            <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-700">
                              {(subject.similarity * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{subject.explanation}</p>
                          {subject.sharedKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {subject.sharedKeywords.map((kw, j) => (
                                <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Alternatives */}
            {!result.isOriginal && result.alternatives.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-purple-500" />
                    Alternatives suggérées
                  </CardTitle>
                  <CardDescription>
                    Cliquez sur une alternative pour l&apos;utiliser
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[300px] pr-4">
                    <div className="space-y-2">
                      {result.alternatives.map((alt, i) => (
                        <button
                          key={i}
                          onClick={() => useAlternative(alt)}
                          className="w-full text-left p-3 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors group"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-bold text-purple-400 group-hover:text-purple-600">
                              {i + 1}.
                            </span>
                            <p className="text-sm text-slate-700 group-hover:text-purple-800 flex-1">
                              {alt}
                            </p>
                            <Copy 
                              className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(alt); }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Report (when original or no alternatives) */}
            {result.isOriginal && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSearch className="h-5 w-5 text-blue-500" />
                    Rapport d&apos;analyse détaillé
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 p-4 rounded-lg font-sans">
                      {result.report}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Modifier les détails
            </Button>
            <Button variant="outline" onClick={resetForm} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Nouvelle validation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
