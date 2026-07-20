/**
 * Fonctions utilitaires i18n pour PlagiatIA
 * Solution custom légère basée sur JSON dictionaries
 */

import { cookies } from 'next/headers';
import { Locale, defaultLocale, cookieName, sanitizeLocale, locales } from './config';
import frDictionary from './dictionaries/fr.json';
import enDictionary from './dictionaries/en.json';
import swDictionary from './dictionaries/sw.json';

// Type pour le dictionnaire
export type Dictionary = typeof frDictionary;

// Mapping des dictionnaires
const dictionaries: Record<Locale, Dictionary> = {
  fr: frDictionary as Dictionary,
  en: enDictionary as Dictionary,
  sw: swDictionary as Dictionary,
};

/**
 * Obtient le locale depuis les cookies (côté serveur)
 */
export async function getLocaleFromCookie(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(cookieName)?.value;
  return sanitizeLocale(cookieLocale);
}

/**
 * Obtient le locale par défaut ou depuis un paramètre
 * Utilisable côté client et serveur
 */
export function getLocale(locale?: string): Locale {
  if (locale) {
    return sanitizeLocale(locale);
  }
  return defaultLocale;
}

/**
 * Obtient le dictionnaire pour un locale donné
 */
export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale] || dictionaries[defaultLocale];
}

/**
 * Obtient une valeur imbriquée dans un objet à partir d'une clé dot-notation
 * Ex: 'common.appName' => dictionary.common.appName
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return typeof current === 'string' ? current : undefined;
}

/**
 * Fonction de traduction simple
 * @param key - Clé de traduction (ex: 'common.appName')
 * @param dictionary - Dictionnaire à utiliser
 * @param params - Paramètres de substitution (ex: { name: 'Jean' } pour '{{name}}')
 * @returns La traduction ou la clé si non trouvée
 */
export function t(
  key: string,
  dictionary: Dictionary,
  params?: Record<string, string | number>
): string {
  // Essayer de récupérer la valeur du dictionnaire
  let value = getNestedValue(dictionary as unknown as Record<string, unknown>, key);
  
  // Si pas trouvé, essayer le dictionnaire français comme fallback
  if (!value && dictionary !== dictionaries[fr]) {
    value = getNestedValue(dictionaries[fr] as unknown as Record<string, unknown>, key);
  }
  
  // Si toujours pas trouvé, retourner la clé
  if (!value) {
    return key;
  }
  
  // Substitution des paramètres {{param}}
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      value = value!.replace(`{{${paramKey}}}`, String(paramValue));
    });
  }
  
  return value;
}

/**
 * Crée une fonction de traduction liée à un dictionnaire spécifique
 * Utile pour éviter de passer le dictionnaire à chaque appel
 */
export function createTranslator(dictionary: Dictionary) {
  return (key: string, params?: Record<string, string | number>): string =>
    t(key, dictionary, params);
}

/**
 * Liste des locales disponibles avec leurs métadonnées
 */
export function getAvailableLocales() {
  return locales.map((locale) => ({
    code: locale,
    name: dictionaries[locale]?.common?.appName || locale,
  }));
}

/**
 * Vérifie si une clé existe dans le dictionnaire
 */
export function hasTranslation(key: string, locale: Locale = defaultLocale): boolean {
  const dictionary = dictionaries[locale];
  return getNestedValue(dictionary as unknown as Record<string, unknown>, key) !== undefined;
}

/**
 * Obtient toutes les clés d'un namespace donné
 */
export function getNamespaceKeys(namespace: string, locale: Locale = defaultLocale): string[] {
  const dictionary = dictionaries[locale];
  const ns = getNestedValue(dictionary as unknown as Record<string, unknown>, namespace);
  
  if (!ns || typeof ns !== 'object') {
    return [];
  }
  
  return Object.keys(ns as Record<string, unknown>).map(key => `${namespace}.${key}`);
}
