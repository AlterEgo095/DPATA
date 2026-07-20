import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'teal' | 'rose';
  href?: string;
  onClick?: () => void;
  className?: string;
}

const colorClasses = {
  emerald: {
    bg: 'bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-600',
    text: 'text-emerald-700',
    border: 'border-emerald-200 hover:border-emerald-300',
  },
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-700',
    border: 'border-blue-200 hover:border-blue-300',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-700',
    border: 'border-purple-200 hover:border-purple-300',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    text: 'text-amber-700',
    border: 'border-amber-200 hover:border-amber-300',
  },
  teal: {
    bg: 'bg-teal-50',
    icon: 'bg-teal-100 text-teal-600',
    text: 'text-teal-700',
    border: 'border-teal-200 hover:border-teal-300',
  },
  rose: {
    bg: 'bg-rose-50',
    icon: 'bg-rose-100 text-rose-600',
    text: 'text-rose-700',
    border: 'border-rose-200 hover:border-rose-300',
  },
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'emerald',
  href,
  onClick,
  className,
}: StatsCardProps) {
  const colors = colorClasses[color];
  const Component = href ? 'a' : 'div';
  
  return (
    <Component
      href={href}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-white p-5 transition-all duration-300',
        colors.border,
        'hover:shadow-md hover:-translate-y-0.5',
        className
      )}
    >
      {/* Background decoration */}
      <div className={cn('absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity', colors.bg)} />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-lg', colors.icon)}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              trend.positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            )}>
              <span>{trend.positive ? '+' : ''}{trend.value}%</span>
              <span className="text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-0.5">
          <div className="text-2xl font-bold text-slate-900 tracking-tight animate-count-up">
            {value}
          </div>
          <div className="text-xs text-slate-500 font-medium">{title}</div>
        </div>
      </div>
    </Component>
  );
}
