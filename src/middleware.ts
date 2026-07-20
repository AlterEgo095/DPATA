// Security & i18n Middleware for PlagiatIA - Edge-compatible version
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, cookieName, isValidLocale } from '@/lib/i18n/config';

// Simple in-memory rate limiting (Edge-compatible)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Cleanup old entries every minute
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
}

/**
 * Détecte la langue préférée de l'utilisateur
 * Ordre de priorité:
 * 1. Cookie `plagiatia-locale`
 * 2. Header `Accept-Language`
 * 3. Default: `fr`
 */
function detectLocale(request: NextRequest): string {
  // 1. Vérifier le cookie d'abord
  const cookieLocale = request.cookies.get(cookieName)?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Analyser le header Accept-Language
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    // Parser les langues acceptées (ex: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [code, qPart] = lang.trim().split(';');
        const quality = qPart ? parseFloat(qPart.split('=')[1]) : 1;
        return { code: code.split('-')[0].toLowerCase(), quality };
      })
      .sort((a, b) => b.quality - a.quality);

    // Trouver la première langue supportée
    for (const { code } of languages) {
      if (isValidLocale(code)) {
        return code;
      }
    }

    // Mapper les variantes de langues
    const languageMapping: Record<string, string> = {
      'fr': 'fr',
      'en': 'en',
      'sw': 'sw',
      'tz': 'sw',  // Swahili/Tanzania
      'cd': 'fr',  // Congo -> Français
      'ke': 'en',  // Kenya -> English
    };

    for (const { code } of languages) {
      const mapped = languageMapping[code];
      if (mapped && isValidLocale(mapped)) {
        return mapped;
      }
    }
  }

  // 3. Retourner la langue par défaut
  return defaultLocale;
}

/**
 * Middleware principal - Combine sécurité et i18n
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Ignorer les routes statiques et API internes
  const ignoredPaths = [
    '/_next/',
    '/api/health',
    '/icons/',
    '/favicon.ico',
    '/manifest.json',
    '/sw.js',
  ];
  
  if (ignoredPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // === Détection i18n ===
  const detectedLocale = detectLocale(request);
  const response = NextResponse.next();

  // Définir le cookie de locale s'il n'existe pas ou est invalide
  const existingCookie = request.cookies.get(cookieName)?.value;
  if (!existingCookie || !isValidLocale(existingCookie)) {
    response.cookies.set(cookieName, detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 an
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  // Ajouter le header de langue pour les composants serveur
  response.headers.set('x-locale', detectedLocale);

  // === Security Headers ===
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // === Rate Limiting pour API routes ===
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown';

    // Auth routes ont des limites plus strictes (5 requêtes / 15 min)
    if (pathname.startsWith('/api/auth/')) {
      if (!checkRateLimit(`auth:${ip}`, 5, 900000)) {
        return NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
          { status: 429 }
        );
      }
    }

    // Rate limiting général API (100 req/min)
    if (!checkRateLimit(`api:${ip}`, 100, 60000)) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez ralentir.' },
        { status: 429 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js).*)',
  ],
};
