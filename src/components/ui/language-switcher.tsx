'use client';

/**
 * LanguageSwitcher - Composant de sélection de langue pour PlagiatIA
 * Support: Français (FR), English (EN), Kiswahili (SW)
 * 
 * Features:
 * - Toggle buttons avec drapeaux
 * - Animation de transition fluide
 * - Persistence dans cookie
 * - Design responsive
 */

import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Locale, locales, localeNames, localeFlags, cookieName } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n';

// ==========================================
// Système de notification global (Store-like)
// ==========================================

let globalLocaleListeners: Array<(locale: Locale) => void> = [];
let currentGlobalLocale: Locale = 'fr' as Locale;

/** Notifie tous les abonnés d'un changement de langue */
function notifyLocaleChange(locale: Locale) {
  currentGlobalLocale = locale;
  // Clone le tableau pour éviter les problèmes pendant l'itération
  const listeners = [...globalLocaleListeners];
  listeners.forEach(listener => listener(locale));
}

/** S'abonner aux changements de langue */
export function subscribeToLocaleChanges(listener: (locale: Locale) => void): () => void {
  globalLocaleListeners.push(listener);
  return () => {
    globalLocaleListeners = globalLocaleListeners.filter(l => l !== listener);
  };
}

/** Obtenir la langue actuelle (synchronisée) */
export function getCurrentLocale(): Locale {
  return currentGlobalLocale;
}

/** Obtenir la langue depuis le cookie (côté client) */
function getCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null;
  
  try {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${cookieName}=`))
      ?.split('=')[1];
    
    if (cookieValue && locales.includes(cookieValue as Locale)) {
      return cookieValue as Locale;
    }
  } catch {
    // Cookie inaccessible
  }
  return null;
}

/** Store externe pour useSyncExternalStore */
const localeStore = {
  subscribe(listener: () => void) {
    return subscribeToLocaleChanges(listener);
  },
  getSnapshot() {
    return currentGlobalLocale;
  },
};

// ==========================================
// Composant LanguageSwitcher
// ==========================================

interface LanguageSwitcherProps {
  /** Classe CSS additionnelle */
  className?: string;
  /** Variante d'affichage */
  variant?: 'toggle' | 'dropdown' | 'compact';
  /** Taille */
  size?: 'sm' | 'md' | 'lg';
  /** Montrer les drapeaux */
  showFlags?: boolean;
  /** Montrer les noms complets */
  showFullNames?: boolean;
}

export function LanguageSwitcher({
  className,
  variant = 'toggle',
  size = 'sm',
  showFlags = true,
  showFullNames = false,
}: LanguageSwitcherProps) {
  // Utiliser useSyncExternalStore pour une synchronisation réactive sans re-renders globaux
  const storeLocale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    () => 'fr' as Locale // Valeur serveur par défaut
  );
  
  const [isOpen, setIsOpen] = useState(false);
  const initializedRef = useRef(false);

  // Initialisation au montage - lire le cookie et synchroniser
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const cookieLocale = getCookieLocale();
      if (cookieLocale && cookieLocale !== currentGlobalLocale) {
        currentGlobalLocale = cookieLocale;
        notifyLocaleChange(cookieLocale);
      }
    }
  }, []);

  const locale = storeLocale;

  // Fonction de changement de langue
  const changeLocale = useCallback(async (newLocale: Locale) => {
    if (newLocale === locale) return;
    
    // Mettre à jour le cookie (expiration 1 an)
    if (typeof document !== 'undefined') {
      document.cookie = `${cookieName}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
    
    // Mettre à jour l'état global
    notifyLocaleChange(newLocale);
    
    // Fermer le dropdown si ouvert
    setIsOpen(false);
  }, [locale]);

  // Tailles des boutons
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  // Variante Toggle (défaut)
  if (variant === 'toggle') {
    return (
      <div 
        className={cn(
          'flex items-center gap-0.5 border rounded-lg p-0.5 bg-slate-100/80',
          className
        )}
        role="radiogroup"
        aria-label="Sélection de la langue"
      >
        {locales.map((loc) => {
          const isActive = locale === loc;
          return (
            <button
              key={loc}
              onClick={() => changeLocale(loc)}
              className={cn(
                'flex items-center gap-1 rounded-md font-medium transition-all duration-200',
                sizeClasses[size],
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              )}
              role="radio"
              aria-checked={isActive}
              title={localeNames[loc]}
            >
              {showFlags && <span className="text-sm">{localeFlags[loc]}</span>}
              <span>{loc.toUpperCase()}</span>
              {isActive && <Check className={cn('h-3 w-3', size === 'sm' ? 'ml-0.5' : 'ml-1')} />}
            </button>
          );
        })}
      </div>
    );
  }

  // Variante Dropdown
  if (variant === 'dropdown') {
    const currentFlag = localeFlags[locale];
    const currentName = showFullNames ? localeNames[locale] : locale.toUpperCase();

    return (
      <div className={cn('relative', className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
            isOpen && 'ring-2 ring-emerald-500 ring-offset-1'
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <Globe className="h-4 w-4 text-slate-500" />
          {showFlags && <span>{currentFlag}</span>}
          <span>{currentName}</span>
          <svg
            className={cn(
              'h-4 w-4 text-slate-400 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            {/* Backdrop pour fermer au clic extérieur */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            {/* Menu dropdown */}
            <div
              className="absolute right-0 mt-2 w-44 rounded-lg border bg-white py-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-2"
              role="listbox"
              aria-label="Langues disponibles"
            >
              {locales.map((loc) => {
                const isActive = locale === loc;
                return (
                  <button
                    key={loc}
                    onClick={() => changeLocale(loc)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span className="text-lg">{localeFlags[loc]}</span>
                    <span className="flex-1">{localeNames[loc]}</span>
                    {isActive && <Check className="h-4 w-4 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Variante Compact (icône globe + popup)
  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-center rounded-lg border bg-white p-2 transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500',
          isOpen && 'ring-2 ring-emerald-500'
        )}
        aria-label={`Langue actuelle: ${localeNames[locale]}`}
        title={localeNames[locale]}
      >
        <Globe className="h-4 w-4 text-slate-600" />
        <span className="ml-1 text-xs font-medium text-slate-600">{locale.toUpperCase()}</span>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-36 rounded-lg border bg-white py-1 shadow-lg z-50">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => changeLocale(loc)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors',
                  locale === loc
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <span>{localeFlags[loc]}</span>
                <span>{localeNames[loc]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ==========================================
// Hook useTranslation
// ==========================================

/**
 * Hook client pour utiliser les traductions
 * @returns { t, locale, dictionary, changeLocale }
 */
export function useTranslation() {
  // Utiliser le store externe pour la locale
  const storeLocale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    () => 'fr' as Locale
  );
  
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const initializedRef = useRef(false);

  // Initialisation - lire le cookie et charger le dictionnaire
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      if (initializedRef.current) return;
      
      const cookieLocale = getCookieLocale();
      const effectiveLocale = cookieLocale || currentGlobalLocale;
      
      if (cookieLocale && cookieLocale !== currentGlobalLocale) {
        currentGlobalLocale = cookieLocale;
        notifyLocaleChange(cookieLocale);
      }
      
      initializedRef.current = true;
      
      if (isMounted) {
        const dict = await getDictionary(effectiveLocale);
        if (isMounted) {
          setDictionary(dict);
        }
      }
    };
    
    init();
    
    return () => { isMounted = false; };
  }, []);

  // Écouter les changements de langue pour mettre à jour le dictionnaire
  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = subscribeToLocaleChanges(async (newLocale) => {
      if (isMounted) {
        const newDict = await getDictionary(newLocale);
        if (isMounted) {
          setDictionary(newDict);
        }
      }
    });
    
    return () => { 
      isMounted = false; 
      unsubscribe(); 
    };
  }, []);

  const locale = storeLocale;

  const changeLocale = useCallback(async (newLocale: Locale) => {
    if (typeof document !== 'undefined') {
      document.cookie = `${cookieName}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
    notifyLocaleChange(newLocale);
    const newDict = await getDictionary(newLocale);
    setDictionary(newDict);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    if (!dictionary) return key;
    return translate(key, dictionary, params);
  }, [dictionary]);

  return { t, locale, dictionary, changeLocale };
}

// ==========================================
// Fonction de traduction utilitaire
// ==========================================

/**
 * Fonction de traduction standalone (utilisable sans hook)
 */
export function translate(
  key: string,
  dictionary: Dictionary,
  params?: Record<string, string | number>
): string {
  const keys = key.split('.');
  let value: unknown = dictionary;

  for (const k of keys) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return key;
    }
    value = (value as Record<string, unknown>)[k];
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Substitution des paramètres {{param}}
  if (params) {
    let result = value;
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      result = result.replace(`{{${paramKey}}}`, String(paramValue));
    });
    return result;
  }

  return value;
}

// Export par défaut
export default LanguageSwitcher;
