'use client';

import React from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/ui/stats-card';
import {
  Building2, Users, FileText, FlaskConical, Clock,
  Lightbulb
} from 'lucide-react';

interface StatsData {
  faculties: number;
  departments: number;
  promotions: number;
  users: number;
  students: number;
  teachers: number;
  admins: number;
  documents: number;
  analyses: number;
  pendingAnalyses: number;
  completedAnalyses: number;
  avgScore: number | null;
  subjects: number;
  validations: number;
  recentActivity: any[];
}

interface StatsOverviewProps {
  stats: StatsData;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const kpis = [
    {
      title: 'Facultés',
      value: stats.faculties,
      icon: Building2,
      color: 'emerald' as const,
      href: '/dashboard/faculties',
    },
    {
      title: 'Utilisateurs',
      value: stats.users,
      icon: Users,
      color: 'purple' as const,
      href: '/dashboard/users',
    },
    {
      title: 'Documents',
      value: stats.documents,
      icon: FileText,
      color: 'amber' as const,
      href: '/dashboard/documents',
    },
    {
      title: 'Analyses IA',
      value: stats.completedAnalyses,
      icon: FlaskConical,
      color: 'teal' as const,
      href: '/dashboard/analyses',
    },
    {
      title: 'En attente',
      value: stats.pendingAnalyses,
      icon: Clock,
      color: (stats.pendingAnalyses > 0 ? 'rose' : 'emerald') as 'rose' | 'emerald',
      href: '/dashboard/analyses',
    },
    {
      title: 'Sujets',
      value: stats.subjects || 0,
      icon: Lightbulb,
      color: 'blue' as const,
      href: '/dashboard/subjects',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
      {kpis.map((kpi) => (
        <Link key={kpi.title} href={kpi.href} className="block">
          <StatsCard
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
          />
        </Link>
      ))}
    </div>
  );
}
