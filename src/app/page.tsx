'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    fetch('/api/auth/me', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data?.user) {
          // Redirection selon le rôle
          const role = data.user.role;
          if (role === 'SUPER_ADMIN' || role === 'FACULTY_ADMIN') {
            router.replace('/dashboard');
          } else {
            router.replace('/portal');
          }
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(err => {
        console.error('Auth check failed:', err);
        setCheckingAuth(false);
      });
    
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
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
      
      toast.success(`Bienvenue ${data.user.firstName} !`);
      
      // Redirection selon le rôle
      const role = data.user.role;
      if (role === 'SUPER_ADMIN' || role === 'FACULTY_ADMIN') {
        router.replace('/dashboard');
      } else {
        router.replace('/portal');
      }
    } catch (err: any) {
      toast.error(`Erreur réseau: ${err.message}`);
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
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-12 w-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">PlagiatIA</h1>
              <p className="text-sm text-emerald-200/80">Plateforme Anti-Plagiat Intelligente</p>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="space-y-4">
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight">
              Protégez vos travaux académiques avec l&apos;IA
            </h2>
            <p className="text-emerald-100/80 text-lg leading-relaxed">
              Validez l&apos;originalité de vos sujets de mémoire, détectez les similarités 
              et recevez des suggestions intelligentes en quelques secondes.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-2xl mb-1">🔍</div>
              <p className="text-xs text-emerald-100/70">Détection intelligente</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-2xl mb-1">⚡</div>
              <p className="text-xs text-emerald-100/70">Résultats instantanés</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-2xl mb-1">💡</div>
              <p className="text-xs text-emerald-100/70">Alternatives IA</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-emerald-200/60">
          © 2024 PlagiatIA — UNIKIN
        </div>
      </div>

      {/* Panneau droit — Formulaire */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center bg-white">
        <Card className="w-full max-w-md border-0 shadow-none">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-emerald-600" />
              <div>
                <CardTitle className="text-2xl">Connexion</CardTitle>
                <CardDescription>Accédez à votre espace personnel</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Plateforme de validation académique propulsée par l&apos;intelligence artificielle
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
