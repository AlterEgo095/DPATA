'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Network, Users, FileText, FlaskConical,
  ScrollText, Settings, LogOut, Loader2, ShieldCheck, ChevronRight,
  GraduationCap, UserCog, BookOpen, Library, Globe, Lightbulb, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  matricule?: string;
}

const NAV_SECTIONS = [
  {
    label: 'Pilotage',
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER', 'STUDENT'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/dashboard/faculties', label: 'Facultés', icon: Building2, roles: ['SUPER_ADMIN'] },
      { href: '/dashboard/departments', label: 'Départements', icon: Network, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/promotions', label: 'Promotions', icon: GraduationCap, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/users', label: 'Utilisateurs', icon: Users, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/students', label: 'Étudiants', icon: BookOpen, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER'] },
      { href: '/dashboard/teachers', label: 'Enseignants', icon: UserCog, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
    ],
  },
  {
    label: 'Académique',
    items: [
      { href: '/dashboard/documents', label: 'Travaux & mémoires', icon: FileText, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER', 'STUDENT'] },
      { href: '/dashboard/analyses', label: 'Analyses plagiat', icon: FlaskConical, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER'] },
      { href: '/dashboard/validate-subject', label: 'Valider un sujet', icon: Lightbulb, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER', 'STUDENT'] },
      { href: '/dashboard/subjects', label: 'Base de sujets', icon: Database, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/federation', label: 'Fédération inter-univ.', icon: Globe, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
    ],
  },
  {
    label: 'Système',
    items: [
      { href: '/dashboard/audit', label: "Journal d'audit", icon: ScrollText, roles: ['SUPER_ADMIN'] },
      { href: '/dashboard/settings', label: 'Paramètres', icon: Settings, roles: ['SUPER_ADMIN'] },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  FACULTY_ADMIN: 'Administrateur Faculté',
  TEACHER: 'Enseignant',
  STUDENT: 'Étudiant',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  FACULTY_ADMIN: 'bg-blue-100 text-blue-700',
  TEACHER: 'bg-emerald-100 text-emerald-700',
  STUDENT: 'bg-slate-100 text-slate-700',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data?.user) {
        router.replace('/');
      } else {
        setUser(data.user);
      }
      setLoading(false);
    }).catch(() => {
      router.replace('/');
      setLoading(false);
    });
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Déconnexion réussie');
    router.replace('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) return null;

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 z-30">
        {/* Logo */}
        <div className="h-16 px-5 flex items-center gap-2 border-b border-slate-200">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-none">PlagiatIA</div>
            <div className="text-[10px] text-slate-500 mt-0.5">UNIKIN · Fac. Sciences & Technologies</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV_SECTIONS.map(section => {
            const visibleItems = section.items.filter(item => item.roles.includes(user.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label}>
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition group',
                          active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        )}
                      >
                        <Icon className={cn('h-4 w-4', active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600')} />
                        {item.label}
                        {active && <ChevronRight className="h-3 w-3 ml-auto text-emerald-600" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User card en bas */}
        <div className="p-3 border-t border-slate-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-slate-100 transition text-left">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={cn('text-xs font-semibold', ROLE_COLORS[user.role])}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs text-slate-500">Connecté en tant que</div>
                <div className="text-sm font-medium mt-0.5">{user.firstName} {user.lastName}</div>
                <div className={cn('inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold', ROLE_COLORS[user.role])}>
                  {ROLE_LABELS[user.role]}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                <LogOut className="h-4 w-4 mr-2" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {NAV_SECTIONS.flatMap(s => s.items).find(i =>
                i.href === pathname || (i.href !== '/dashboard' && pathname.startsWith(i.href))
              )?.label || 'Tableau de bord'}
            </h2>
            <p className="text-xs text-slate-500">
              Année académique 2025-2026 · {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              Système opérationnel
            </div>
            <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
              <Link href="/dashboard/documents">
                <FileText className="h-4 w-4 mr-1.5" />
                Déposer un travail
              </Link>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
