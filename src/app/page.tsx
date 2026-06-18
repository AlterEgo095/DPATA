'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, GraduationCap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@unikin.ac.cd');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data?.user) {
        router.replace('/dashboard');
      } else {
        setCheckingAuth(false);
      }
    }).catch(() => setCheckingAuth(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erreur de connexion');
        return;
      }
      toast.success(`Bienvenue, ${data.user.firstName} ${data.user.lastName} !`);
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error('Erreur réseau : ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Panneau gauche — Branding */}
      <div className="lg:w-1/2 bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-800 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <ShieldCheck className="h-7 w-7 text-emerald-300" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">PlagiatIA</div>
              <div className="text-xs text-emerald-200/80">Plateforme anti-plagiat IA</div>
            </div>
          </div>

          <h1 className="text-3xl lg:text-5xl font-bold leading-tight mb-6">
            Détection automatique du plagiat par Intelligence Artificielle
          </h1>
          <p className="text-emerald-100/90 text-base lg:text-lg leading-relaxed max-w-lg">
            Plateforme universitaire intelligente pour la gestion et l'analyse des travaux académiques.
            Cas pilote : Faculté des Sciences — Université de Kinshasa.
          </p>
        </div>

        <div className="relative z-10 mt-12 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-white/5 backdrop-blur p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold text-emerald-300">IA</div>
            <div className="text-xs text-emerald-100/70 mt-1">Sentence-BERT</div>
          </div>
          <div className="rounded-lg bg-white/5 backdrop-blur p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold text-emerald-300">NLP</div>
            <div className="text-xs text-emerald-100/70 mt-1">Multilingue FR/EN</div>
          </div>
          <div className="rounded-lg bg-white/5 backdrop-blur p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold text-emerald-300">SQL</div>
            <div className="text-xs text-emerald-100/70 mt-1">pgvector ready</div>
          </div>
        </div>
      </div>

      {/* Panneau droit — Formulaire */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-16 bg-slate-50">
        <Card className="w-full max-w-md shadow-xl border-slate-200">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Connexion</CardTitle>
            <CardDescription className="text-center">
              Accédez à votre espace PlagiatIA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@unikin.ac.cd"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>

            <div className="mt-6 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <div className="font-semibold mb-1">Compte super-admin par défaut :</div>
                <div>Email : <code className="bg-amber-100 px-1 rounded">admin@unikin.ac.cd</code></div>
                <div>Mot de passe : <code className="bg-amber-100 px-1 rounded">admin123</code></div>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-slate-500">
              <Link href="#" className="hover:text-emerald-700 transition">
                Mot de passe oublié ?
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
