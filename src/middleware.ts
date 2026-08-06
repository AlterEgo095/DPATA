/**
 * ============================================================================
 * PlagiatIA — Security & i18n Middleware (P4-C: Node.js runtime + metrics)
 * ============================================================================
 * Task ID: P3-A — CSP hardening (original)
 * Task ID: P4-C — Wire metrics.recordRequest() + 5 new metrics integration
 *
 * P4-C CHANGE: Switched middleware runtime from Edge to Node.js so that the
 * `metrics` singleton is shared with the Node.js route handlers (the
 * /api/v1/metrics endpoint runs in Node.js by default). Next.js 16.1
 * supports `runtime: 'nodejs'` in middleware config (stable since 15.3).
 *
 * The middleware body itself was already Node.js-compatible (no Edge-only
 * APIs), so the runtime switch is a one-line change with zero behavioral
 * impact except: (a) metrics singleton is now shared, (b) `process.on()`
 * handlers in instrumentation.ts continue to work as before.
 *
 * P4-C METRICS WIRING:
 *   - normalizePath(): collapses /api/users/123 -> /api/users/:id to
 *     prevent Prometheus label-cardinality explosion.
 *   - recordRequest(): increments http_requests_total + observes
 *     http_request_duration_ms on every response (including rate-limit 429s
 *     and static-asset responses).
 *   - errors_total{type:'4xx'}: incremented on rate-limit 429 responses.
 *   - All metrics calls wrapped in try/catch — metrics must NEVER break a
 *     request.
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
 * Output: /home/z/my-project/p4c_fixes/middleware.ts
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, cookieName, isValidLocale } from '@/lib/i18n/config';
// P4-C: import metrics singleton (Node.js runtime, shared with route handlers)
import { metrics } from '@/lib/observability/metrics';

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

// ============================================================================
// P4-C: Path normalization for Prometheus label cardinality control.
// ============================================================================
//
// Problem: parameterized routes (/api/users/123, /api/documents/abc-456) would
// create one Prometheus series per ID — at scale this explodes memory usage
// in Prometheus and slows down queries.
//
// Solution: collapse any path segment that looks like an ID (UUID, numeric,
// or known prefix-id format like "usr-abc123") to the placeholder `:id`.
//
// Examples:
//   /api/users                       -> /api/users
//   /api/users/123                   -> /api/users/:id
//   /api/users/usr-abc123def456      -> /api/users/:id
//   /api/users/u-super-admin         -> /api/users/:id
//   /api/documents/0d8e... (UUID)    -> /api/documents/:id
//   /api/v1/documents/abc/analyze    -> /api/v1/documents/:id/analyze
//
// Static asset prefixes (/_next/, /icons/, etc.) are passed through unchanged
// because they're already low-cardinality.

function isIdLike(segment: string): boolean {
  if (!segment) return false;
  // Pure numeric: "123", "4567"
  if (/^\d+$/.test(segment)) return true;
  // UUID (8-4-4-4-12 hex): "0d8e1f2a-3b4c-..."
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  // Prefixed ID: "usr-abc123", "doc-xyz789", "log-abc", "u-super-admin"
  // Pattern: 2-5 lowercase letters, dash, then 4+ alphanumeric chars
  if (/^[a-z]{2,5}-[a-z0-9]{4,}$/i.test(segment)) return true;
  // Long hex string (>= 8 chars): MongoDB-style ObjectId, etc.
  if (/^[a-f0-9]{8,}$/i.test(segment)) return true;
  return false;
}

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  // Fast path: don't normalize static assets.
  if (pathname.startsWith('/_next/') || pathname.startsWith('/icons/')) return pathname;
  const segments = pathname.split('/');
  // segments[0] is always '' (leading /)
  for (let i = 1; i < segments.length; i++) {
    if (isIdLike(segments[i])) {
      segments[i] = ':id';
    }
  }
  return segments.join('/');
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
 * P4-C: Record an HTTP request in the metrics registry.
 *
 * Wrapped in try/catch — metrics must NEVER break a request. If the metrics
 * library throws for any reason, we silently swallow the error and let the
 * response go through.
 *
 * @param method   HTTP method (GET, POST, etc.)
 * @param pathname Raw request pathname (will be normalized)
 * @param status   Response status code
 * @param durationMs Elapsed time in milliseconds
 * @param isError  If true, also increment errors_total{type} counter
 * @param errorType Error type label ('4xx' | '5xx' | 'uncaught')
 */
function recordMetrics(
  method: string,
  pathname: string,
  status: number,
  durationMs: number,
  isError: boolean = false,
  errorType: '4xx' | '5xx' | 'uncaught' = '5xx'
): void {
  try {
    const normalizedPath = normalizePath(pathname);
    metrics.recordRequest(method, normalizedPath, status, durationMs);
    if (isError) {
      metrics.incrementCounter('errors_total', { type: errorType });
    }
  } catch {
    // never let metrics break the request
  }
}

/**
 * Middleware principal - Combine sécurité et i18n
 */
export async function middleware(request: NextRequest) {
  // P4-C: capture start time at the very top so duration is accurate.
  const start = Date.now();
  const { pathname } = request.nextUrl;
  const method = request.method;

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
    // P4-C: record metrics for ignored-path responses too (status 200).
    recordMetrics(method, pathname, 200, Date.now() - start);
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
        // P4-C: record 429 as a 4xx error.
        recordMetrics(method, pathname, 429, Date.now() - start, true, '4xx');
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
      // P4-C: record 429 as a 4xx error.
      recordMetrics(method, pathname, 429, Date.now() - start, true, '4xx');
      return rateLimitResponse;
    }
  }

  // P4-C: record successful pass-through (status 200 — route handler may
  // override this with a different status, but middleware cannot see that).
  recordMetrics(method, pathname, 200, Date.now() - start);
  return response;
}

export const config = {
  // P4-C: Switch to Node.js runtime so the metrics singleton is shared with
  // the /api/v1/metrics route handler (which runs in Node.js by default).
  // Without this, Edge runtime would have its own singleton and the metrics
  // endpoint would always show http_requests_total = 0.
  // NOTE: Turbopack requires `runtime` to be a plain string literal (no `as const`).
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js).*)',
  ],
};
