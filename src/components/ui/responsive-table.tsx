/**
 * ResponsiveTable Component - PlagiatIA
 * 📱 Wrapper pour rendre les tables responsives sur mobile
 */

'use client';

import React from 'react';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Point de rupture pour le scroll horizontal
   * @default "md" (768px)
   */
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Afficher une indication de scroll sur mobile
   * @default true
   */
  showScrollHint?: boolean;
}

/**
 * Table responsive avec overflow horizontal sur mobile
 * Utilise des breakpoints Tailwind pour le comportement responsive
 */
export function ResponsiveTable({
  children,
  className = '',
  breakpoint = 'md',
  showScrollHint = true,
}: ResponsiveTableProps) {
  // Classes de overflow basées sur le breakpoint
  const overflowClasses = {
    sm: 'overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0',
    md: 'overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0',
    lg: 'overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0',
    xl: 'overflow-x-auto -mx-4 xl:mx-0 px-4 xl:px-0',
  };

  return (
    <div className={`relative ${className}`}>
      {/* Container avec overflow horizontal */}
      <div className={overflowClasses[breakpoint]}>
        {/* Style personnalisé pour le scrollbar */}
        <style jsx global>{`
          .responsive-table-container::-webkit-scrollbar {
            height: 6px;
          }
          .responsive-table-container::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 3px;
          }
          .responsive-table-container::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 3px;
          }
          .responsive-table-container::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
        `}</style>
        
        <div className="responsive-table-container min-w-full">
          {children}
        </div>
      </div>
      
      {/* Indication de swipe sur mobile */}
      {showScrollHint && (
        <div className="md:hidden flex items-center justify-center gap-1 mt-2 text-xs text-slate-400">
          <svg 
            className="w-4 h-4 animate-pulse" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M14 5l7 7m0 0l-7 7m7-7H3" 
            />
          </svg>
          <span>Swipez pour voir plus →</span>
        </div>
      )}
    </div>
  );
}

/**
 * Composant pour les cellules de tableau qui s'adaptent sur mobile
 * Sur mobile, affiche le label avant la valeur (card-like)
 */
interface MobileCellProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileCell({ label, children, className = '' }: MobileCellProps) {
  return (
    <>
      {/* Label visible uniquement sur mobile */}
      <td 
        className={`before:content-[attr(data-label)] md:before:content-none before:block before:text-xs before:text-slate-500 before:font-medium before:mb-1 before:md:hidden ${className}`}
        data-label={label}
      >
        {children}
      </td>
    </>
  );
}

export default ResponsiveTable;

