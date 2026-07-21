/**
 * Configuration i18n pour PlagiatIA
 * Support: Français (FR), English (EN), Kiswahili (SW)
 */

export const locales = ['fr', 'en', 'sw'] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  sw: 'Kiswahili',
};

export const localeFlags: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  sw: '🇹🇿',
};

export const defaultLocale: Locale = 'fr';
export const cookieName = 'plagiatia-locale';

/**
 * Vérifie si une chaîne est un locale valide
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * Obtient le locale depuis la liste, ou retourne le défaut
 */
export function sanitizeLocale(locale: string | null | undefined): Locale {
  if (!locale) return defaultLocale;
  return isValidLocale(locale) ? locale : defaultLocale;
}
