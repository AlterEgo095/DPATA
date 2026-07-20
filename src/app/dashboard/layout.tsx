'use client';

// Dashboard Layout with Responsive Sidebar
// PHASE 3: Améliorations Frontend - Responsive Design + i18n

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Network, Users, FileText, FlaskConical,
  ScrollText, Settings, LogOut, Loader2, ShieldCheck, ChevronRight,
  GraduationCap, UserCog, BookOpen, Library, Globe, Lightbulb, Database,
  Menu, X, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LanguageSwitcher, useTranslation } from '@/components/ui/language-switcher';

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
    labelKey: 'pilotage',
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER', 'STUDENT'] },
    ],
  },
  {
    labelKey: 'administration',
    items: [
      { href: '/dashboard/faculties', labelKey: 'nav.faculties', icon: Building2, roles: ['SUPER_ADMIN'] },
      { href: '/dashboard/departments', labelKey: 'nav.departments', icon: Network, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/promotions', labelKey: 'nav.promotions', icon: GraduationCap, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/users', labelKey: 'nav.users', icon: Users, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/students', labelKey: 'nav.students', icon: BookOpen, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER'] },
      { href: '/dashboard/teachers', labelKey: 'nav.teachers', icon: UserCog, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
    ],
  },
  {
    labelKey: 'academique',
    items: [
      { href: '/dashboard/documents', labelKey: 'nav.documents', icon: FileText, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER', 'STUDENT'] },
      { href: '/dashboard/analyses', labelKey: 'nav.analyses', icon: FlaskConical, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER'] },
      { href: '/dashboard/batch', labelKey: 'nav.batch', icon: Layers, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/validate-subject', labelKey: 'nav.validateSubject', icon: Lightbulb, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN', 'TEACHER', 'STUDENT'] },
      { href: '/dashboard/subjects', labelKey: 'nav.subjects', icon: Database, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
      { href: '/dashboard/federation', labelKey: 'nav.federation', icon: Globe, roles: ['SUPER_ADMIN', 'FACULTY_ADMIN'] },
    ],
  },
  {
    labelKey: 'systeme',
    items: [
      { href: '/dashboard/audit', labelKey: 'nav.audit', icon: ScrollText, roles: ['SUPER_ADMIN'] },
      { href: '/dashboard/settings', labelKey: 'nav.settings', icon: Settings, roles: ['SUPER_ADMIN'] },
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

// Sidebar Navigation Component (reusable for desktop + mobile)
function SidebarContent({ 
  user, 
  pathname, 
  onNavigate,
  t 
}: { 
  user: User; 
  pathname: string; 
  onNavigate?: () => void;
  t: (key: string) => string;
}) {
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 px-5 flex items-center gap-2 border-b border-slate-200">
        <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-slate-900 leading-none">{t('common.appName')}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">UNIKIN · Fac. Sciences & Technologies</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(user.role));
          if (visibleItems.length === 0) return null;
          
          return (
            <div key={section.labelKey}>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t(section.labelKey)}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition group',
                        active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600')} />
                      {t(item.labelKey)}
                      {active && <ChevronRight className="h-3 w-3 ml-auto text-emerald-600" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User card at bottom */}
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
              <div className="text-xs text-slate-500">{t('auth.loggedInAs')}</div>
              <div className="text-sm font-medium mt-0.5">{user.firstName} {user.lastName}</div>
              <div className={cn('inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold', ROLE_COLORS[user.role])}>
                {ROLE_LABELS[user.role]}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleLogout()} className="text-red-600 focus:text-red-700 focus:bg-red-50">
              <LogOut className="h-4 w-4 mr-2" />
              {t('auth.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fonction de déconnexion (définie ici pour être accessible dans SidebarContent)
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success(t('auth.logout') + ' réussie');
    router.replace('/');
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (!data?.user) {
          router.replace('/');
        } else {
          setUser(data.user);
        }
        setLoading(false);
      })
      .catch(() => {
        router.replace('/');
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) return null;

  // Trouver la page actuelle pour le titre
  const currentPage = NAV_SECTIONS.flatMap(s => s.items).find(i =>
    i.href === pathname || (i.href !== '/dashboard' && pathname.startsWith(i.href))
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar - Fixed */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col fixed inset-y-0 z-30">
        <SidebarContent user={user} pathname={pathname} t={t} />
      </aside>

      {/* Mobile Sidebar - Sheet/Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent 
            user={user} 
            pathname={pathname} 
            onNavigate={() => setSidebarOpen(false)}
            t={t}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Ouvrir le menu</span>
            </Button>
            
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {currentPage ? t(currentPage.labelKey) : t('nav.dashboard')}
              </h2>
              <p className="text-xs text-slate-500 hidden sm:block">
                {t('dashboard.academicYear')} · {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* System status indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              {t('dashboard.operational')}
            </div>
            
            {/* Language Switcher */}
            <LanguageSwitcher variant="toggle" size="sm" />
            
            <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
              <Link href="/dashboard/documents">
                <FileText className="h-4 w-4 mr-1.5" />
                {t('document.upload')}
              </Link>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
