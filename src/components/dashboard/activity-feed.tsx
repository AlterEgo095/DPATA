'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronRight, ShieldCheck, Plus, Pencil, Trash2, Search, Download, Upload } from 'lucide-react';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  userName?: string;
  details?: string;
  createdAt: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  maxItems?: number;
  showViewAll?: boolean;
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  CREATE: { icon: Plus, color: 'bg-emerald-100 text-emerald-700', label: 'Création' },
  UPDATE: { icon: Pencil, color: 'bg-blue-100 text-blue-700', label: 'Modification' },
  DELETE: { icon: Trash2, color: 'bg-rose-100 text-rose-700', label: 'Suppression' },
  LOGIN: { icon: ShieldCheck, color: 'bg-purple-100 text-purple-700', label: 'Connexion' },
  SEARCH: { icon: Search, color: 'bg-slate-100 text-slate-700', label: 'Recherche' },
  EXPORT: { icon: Download, color: 'bg-teal-100 text-teal-700', label: 'Export' },
  IMPORT: { icon: Upload, color: 'bg-amber-100 text-amber-700', label: 'Import' },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)} j`;
  return date.toLocaleDateString('fr-FR');
}

export function ActivityFeed({ activities, maxItems = 12, showViewAll = true }: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Activité récente
          </CardTitle>
          {showViewAll && (
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/dashboard/audit">
                Tout voir <ChevronRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displayActivities.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Aucune activité récente
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="divide-y divide-slate-100">
              {displayActivities.map((activity) => {
                const actionPrefix = activity.action.split('_')[0];
                const config = ACTION_CONFIG[actionPrefix] || { 
                  icon: ShieldCheck, 
                  color: 'bg-slate-100 text-slate-700', 
                  label: activity.action 
                };
                const Icon = config.icon;

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {activity.action.replace(/_/g, ' ').toLowerCase()}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {activity.userName || 'Système'} · {activity.entity}
                      </div>
                    </div>
                    <time className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                      {timeAgo(activity.createdAt)}
                    </time>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
