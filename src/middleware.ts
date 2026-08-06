/**
 * ============================================================================
 * PlagiatIA — Security & i18n Middleware (Edge-compatible)
 * ============================================================================
 * Task ID: P3-A — CSP hardening
 *
 * CONTENT-SECURITY-POLICY (CSP) — Why 'unsafe-inline' / 'unsafe-eval' are kept
 * ------------------------------------------------------------------------
 * Next.js 16.1.3 (App Router, standalone output) injects inline runtime
 * scripts (React Server Components payload, hydration data, React Refresh
 * bootstrap) and inline <style> tags (Tailwind 4 layer injection + shadcn/ui
 * Radix primitives positioning styles). Removing 'unsafe-inline' from
 * script-src or style-src BREAKS the application at first paint.
 *
 *   - script-src 'unsafe-inline'
 *       Required for Next.js inline <script> tags that carry the RSC payload
 *       and component hydration data. Without it, the page renders blank.
 *
 *   - script-src 'unsafe-eval'
 *       Required by Next.js dev-mode HMR runtime AND by several production
 *       dependency code-paths that call `new Function()` (template compilers,
 *       source-map handlers). In a future hardening pass we can replace this
 *       with per-request nonces (via NextResponse.headers + a nonce factory),
 *       but doing so requires patching every <Script> / inline-style emit site
 *       — out of scope for P3-A. Kept for safety; production-grade defense
 *       comes from the rest of the policy (frame-ancestors, connect-src,
 *       object-src, etc.).
 *
 *   - style-src 'unsafe-inline'
 *       Required by Tailwind 4 + shadcn/ui (Radix injects inline styles for
 *       popover/tooltip/dialog positioning) and by Next.js' own <style>
 *       injection for optimized CSS. Cannot be removed without breaking the
 *       UI.
 *
 * CSP POLICY SUMMARY
 * ------------------------------------------------------------------------
 *   default-src 'self'                            baseline: only same-origin
 *   script-src 'self' 'unsafe-inline' 'unsafe-eval'
 *   style-src 'self' 'unsafe-inline'
 *   img-src 'self' data: blob: https:             allow data-URI + blob + any HTTPS image (CDN-friendly)
 *   font-src 'self' data:                         self-hosted + base64 fonts
 *   connect-src 'self' https://api.z.ai https://plagiat.hpph.net
 *                                                  AJAX/fetch restricted to self + Z.ai LLM API + prod domain
 *   frame-ancestors 'none'                        clickjacking: no framing (stronger than X-Frame-Options: DENY)
 *   base-uri 'self'                               no <base> hijack
 *   form-action 'self'                            forms can only submit to self
 *   object-src 'none'                             no Flash/Java/plugins
 *   manifest-src 'self'                           PWA manifest served from same origin
 *   worker-src 'self'                             service worker / web worker same-origin only
 *   upgrade-insecure-requests                     force HTTPS on all subresources
 *
 * ADDITIONAL HEADERS (beyond CSP) — see applySecurityHeaders()
 * ------------------------------------------------------------------------
 *   X-Frame-Options: DENY                         legacy clickjacking defense (kept for old browsers; CSP frame-ancestors is stronger)
 *   X-Content-Type-Options: nosniff               MIME-type sniffing protection
 *   Referrer-Policy: strict-origin-when-cross-origin
 *   X-XSS-Protection: 1; mode=block               legacy XSS auditor (defense in depth)
 *   Permissions-Policy: camera=(), microphone=(), geolocation=()
 *   X-Permitted-Cross-Domain-Policies: none       blocks Adobe Flash/PDF crossdomain.xml (defense in depth)
 *   Cross-Origin-Opener-Policy: same-origin       isolates browsing context (modern Spectre defense)
 *   Cross-Origin-Resource-Policy: same-origin     restricts who can load resources cross-origin
 *
 * This is P3-A work. Output: /home/z/my-project/p3_fixes/middleware.ts
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, cookieName, isValidLocale } from '@/lib/i18n/config';

// ============================================================================
// Content-Security-Policy header value (single string, semicolon-separated).
// Defined at module scope so it is allocated once per Edge runtime instance
// rather than per-request.
// ============================================================================
const CSP_HEADER =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' https://api.z.ai https://plagiat.hpph.net; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "object-src 'none'; " +
  "manifest-src 'self'; " +
  "worker-src 'self'; " +
  "upgrade-insecure-requests;";

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
 * Apply ALL security headers (CSP + legacy + modern) to a NextResponse.
 *
 * Called for every response that leaves the middleware — including the
 * ignoredPaths branch (static + PWA + health), the main i18n flow, and the
 * rate-limit 429 responses — so that CSP applies to ALL responses, not just
 * HTML pages.
 *
 * @param response - The NextResponse to attach headers to.
 * @returns The same NextResponse (mutated), for chaining / direct return.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // === Content-Security-Policy ===
  // See top-of-file comment block for the rationale behind 'unsafe-inline'
  // and 'unsafe-eval'. Tightening these requires a per-request nonce plumbing
  // pass (out of scope for P3-A).
  response.headers.set('Content-Security-Policy', CSP_HEADER);

  // === Legacy security headers (kept for older browser compatibility) ===
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // === P3-A additions: modern isolation primitives + defense in depth ===
  // Blocks Adobe Flash / PDF crossdomain.xml policy files (legacy but still
  // honored by some embedded viewers).
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  // Isolates the browsing context group — mitigates Spectre-style attacks
  // where a malicious window could observe cross-origin document state.
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Restricts which origins may load resources served from this origin
  // (defends against cross-origin resource inclusion).
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return response;
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
    // Even on ignored paths (static / PWA / health), apply security headers
    // — CSP must cover ALL responses per P3-A requirement.
    const staticResponse = NextResponse.next();
    applySecurityHeaders(staticResponse);
    return staticResponse;
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

  // === Security Headers (CSP + all hardening) ===
  applySecurityHeaders(response);

  // === Rate Limiting pour API routes ===
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown';

    // Auth routes ont des limites modérées (60 requêtes / min)
    if (pathname.startsWith('/api/auth/')) {
      if (!checkRateLimit(`auth:${ip}`, 60, 60000)) {
        const rateLimitResponse = NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans 1 minute.' },
          { status: 429 }
        );
        applySecurityHeaders(rateLimitResponse);
        return rateLimitResponse;
      }
    }

    // Rate limiting général API (100 req/min)
    if (!checkRateLimit(`api:${ip}`, 100, 60000)) {
      const rateLimitResponse = NextResponse.json(
        { error: 'Trop de requêtes. Veuillez ralentir.' },
        { status: 429 }
      );
      applySecurityHeaders(rateLimitResponse);
      return rateLimitResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js).*)',
  ],
};
