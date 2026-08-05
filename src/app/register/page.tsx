'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, GraduationCap, ArrowLeft, UserPlus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    matricule: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validation côté client
    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          matricule: formData.matricule || undefined,
          password: formData.password,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.details?.fieldErrors) {
          Object.entries(data.details.fieldErrors).forEach(([, msgs]) => {
            toast.error(Array.isArray(msgs) ? msgs[0] : 'Erreur de validation');
          });
        } else {
          toast.error(data.error || "Erreur lors de l'inscription");
        }
        return;
      }
      
      setSuccess(true);
      toast.success('Compte créé avec succès !');
      
      // Redirection vers login après 2 secondes
      setTimeout(() => {
        router.push('/login');
      }, 2000);
      
    } catch (err: any) {
      toast.error(`Erreur réseau: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-20 w-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Compte créé avec succès !</h2>
            <p className="text-slate-600">
              Bienvenue {formData.firstName} ! Votre compte étudiant a été créé.
              <br /><br />
              <span className="text-emerald-600 font-medium">Redirection vers la connexion...</span>
            </p>
          </CardContent>
        </Card>
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
              Rejoignez la communauté PlagiatIA
            </h2>
            <p className="text-emerald-100/80 text-lg leading-relaxed">
              Créez votre compte étudiant et commencez à valider l&apos;originalité 
              de vos sujets de recherche dès aujourd&apos;hui.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-3 text-emerald-100/80">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span>Accès gratuit aux outils d&apos;analyse</span>
            </div>
            <div className="flex items-center gap-3 text-emerald-100/80">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span>Suggestions de sujets par IA</span>
            </div>
            <div className="flex items-center gap-3 text-emerald-100/80">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span>Suivi de vos travaux académiques</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-emerald-200/60">
          © 2024 PlagiatIA — UNIKIN
        </div>
      </div>

      {/* Panneau droit — Formulaire */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center bg-white relative">
        {/* Lien retour */}
        <Link 
          href="/" 
          className="absolute top-6 left-6 flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>

        <Card className="w-full max-w-md border-0 shadow-none mt-8">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-8 w-8 text-emerald-600" />
              <div>
                <CardTitle className="text-2xl">Inscription</CardTitle>
                <CardDescription>Créez votre compte étudiant</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Jean"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    minLength={2}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Dupont"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    minLength={2}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Adresse email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="jean@unikin.cd"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="matricule">Matricule (optionnel)</Label>
                <Input
                  id="matricule"
                  name="matricule"
                  type="text"
                  placeholder="2024INF001"
                  value={formData.matricule}
                  onChange={handleChange}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimum 8 caractères"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="h-11"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all mt-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Création du compte...
                  </>
                ) : (
                  <>
                    <GraduationCap className="mr-2 h-5 w-5" />
                    Créer mon compte
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-4">
              <p className="text-sm text-slate-500">
                Vous avez déjà un compte ?
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full border-slate-300 hover:bg-slate-50">
                  Se connecter
                </Button>
              </Link>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 text-center">
                En créant un compte, vous acceptez nos conditions d&apos;utilisation. 
                Votre compte sera soumis à validation par l&apos;administration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
