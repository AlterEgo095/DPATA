'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Cpu, Database, Shield, Sliders } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Settings className="h-6 w-6 text-slate-700" /> Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">Configuration du moteur IA et de la plateforme</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4 text-purple-600" /> Modèle IA</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Modèle d'embeddings</span><Badge variant="outline">Sentence-BERT</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">Variant</span><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">distiluse-base-multilingual-cased-v1</code></div>
            <div className="flex justify-between"><span className="text-slate-500">Dimensions</span><span className="font-medium">512</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Langues</span><span className="font-medium">FR, EN (+ 50)</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sliders className="h-4 w-4 text-amber-600" /> Paramètres de détection</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Seuil de similarité</span><span className="font-medium">0.80</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Périmètre par défaut</span><Badge variant="outline">Faculté</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">Classification</span><span className="font-medium">5 types</span></div>
            <div className="text-xs text-slate-500 mt-2">Types : copier-coller, paraphrase, reformulation, traduction, similarité faible</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-blue-600" /> Base de données</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Type</span><Badge variant="outline">JSON (démo)</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">Production cible</span><span className="font-medium">PostgreSQL + pgvector</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Index vectoriel</span><span className="font-medium">HNSW</span></div>
            <div className="text-xs text-slate-500 mt-2">⚠️ Passez à PostgreSQL en production pour la scalabilité</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-600" /> Sécurité</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Authentification</span><Badge variant="outline">JWT HS256</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">Cookies</span><span className="font-medium">httpOnly, 7 jours</span></div>
            <div className="flex justify-between"><span className="text-slate-500">RBAC</span><span className="font-medium">4 rôles</span></div>
            <div className="text-xs text-slate-500 mt-2">⚠️ Hachez les mots de passe avec bcrypt en production</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
