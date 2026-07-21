/**
 * Server-side only i18n utilities
 * Ce fichier ne doit être importé que dans les Server Components ou API routes
 */

import { cookies } from 'next/headers';
import { Locale, defaultLocale, cookieName, sanitizeLocale } from './config';
import { getDictionary, type Dictionary } from './index';

/**
 * Obtient le locale depuis les cookies (côté serveur uniquement)
 */
export async function getLocaleFromCookie(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(cookieName)?.value;
  return sanitizeLocale(cookieLocale);
}

/**
 * Obtient le dictionnaire basé sur le cookie de locale (côté serveur uniquement)
 */
export async function getServerDictionary(): Promise<Dictionary> {
  const locale = await getLocaleFromCookie();
  return getDictionary(locale);
}

/**
 * Crée un translator fonction côté serveur basé sur le cookie
 */
export async function getServerTranslator() {
  const dictionary = await getServerDictionary();
  return (key: string, params?: Record<string, string | number>) => {
    // Import de la fonction t pour éviter les dépendances circulaires
    const { t } = await import('./index');
    return t(key, dictionary, params);
  };
}
