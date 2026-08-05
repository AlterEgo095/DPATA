// CORS Configuration - Restricted to PlagiatIA domain
const ALLOWED_ORIGINS = [
  'https://plagiat.hpph.net',
  'http://localhost:3004',  // Dev only
];

/**
 * CORS Utility Module - PlagiatIA
 * 🔒 Sécurité: Configuration CORS centralisée et restrictive
 */

// Origines autorisées (configurables via variable d'environnement)
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  
  if (!envOrigins || envOrigins === '*') {
    // En production, ne jamais retourner *
    if (process.env.NODE_ENV === 'production') {
      return [
        'https://plagiatia.unikin.ac.cd',
        'https://www.plagiatia.unikin.ac.cd',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
    }
    // En développement, autoriser localhost
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:19006', // Expo
    ];
  }
  
  return envOrigins.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

const allowedOrigins = getAllowedOrigins();

/**
 * Vérifie si une origine est autorisée
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false; // Requêtes directes (non-browser) non autorisées pour API
  return allowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith('.' + allowed.replace(/^https?:\/\//, ''))
  );
}

/**
 * Retourne les headers CORS pour une origine donnée
 * @param origin L'origine de la requête
 * @param additionalMethods Méthodes HTTP supplémentaires à autoriser
 */
export function getCorsHeaders(
  origin: string | null | undefined,
  additionalMethods: string[] = []
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24h cache preflight
    'Access-Control-Allow-Headers': 
      'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Request-ID, Accept-Language',
  };
  
  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Vary'] = 'Origin';
  }
  
  // Méthodes autorisées
  const methods = ['GET, POST, PUT, DELETE, PATCH, OPTIONS', ...additionalMethods];
  headers['Access-Control-Allow-Methods'] = methods.join(', ');
  
  return headers;
}

/**
 * Génère une réponse OPTIONS (preflight) CORS
 */
export function corsPreflightResponse(origin: string | null | undefined): Response {
  const headers = getCorsHeaders(origin);
  return new Response(null, { status: 204, headers });
}

/**
 * Ajoute les headers CORS à une réponse existante
 */
export function addCorsHeaders(response: Response, origin: string | null | undefined): Response {
  const headers = getCorsHeaders(origin);
  
  const newHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Middleware CORS pour Next.js API routes
 */
export function withCorsHandler(handler: (req: Request, ...args: any[]) => Promise<Response>) {
  return async (req: Request, ...args: any[]) => {
    const origin = req.headers.get('origin');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return corsPreflightResponse(origin);
    }
    
    // Vérifier l'origine pour les autres méthodes
    if (origin && !isOriginAllowed(origin)) {
      return Response.json(
        { error: 'Origin not allowed' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const response = await handler(req, ...args);
    return addCorsHeaders(response, origin);
  };
}

export default {
  isOriginAllowed,
  getCorsHeaders,
  corsPreflightResponse,
  addCorsHeaders,
  withCorsHandler,
  allowedOrigins,
};

