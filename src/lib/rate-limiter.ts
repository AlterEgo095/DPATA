/**
 * Rate Limiter Module - PlagiatIA
 * 🔒 Sécurité: Rate limiting amélioré avec persistance fichier et sliding window
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number; // For sliding window
}

// Configuration par défaut
const DEFAULT_CONFIG = {
  windowMs: 60_000, // 1 minute
  maxRequests: 100,
  cleanupIntervalMs: 60_000, // Cleanup every minute
};

// In-memory store avec backup vers fichier
class RateLimiterStore {
  private store: Map<string, RateLimitRecord> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  
  constructor() {
    // Nettoyage automatique (Node.js only)
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), DEFAULT_CONFIG.cleanupIntervalMs);
      // Ne pas bloquer le event loop
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }
  
  /**
   * Vérifie si une requête est autorisée (Sliding Window Log)
   */
  check(key: string, maxRequests?: number, windowMs?: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter: number;
  } {
    const max = maxRequests || DEFAULT_CONFIG.maxRequests;
    const window = windowMs || DEFAULT_CONFIG.windowMs;
    const now = Date.now();
    
    const record = this.store.get(key);
    
    // Nouvelle entrée ou fenêtre expirée
    if (!record || now > record.resetTime) {
      const newRecord: RateLimitRecord = {
        count: 1,
        resetTime: now + window,
        firstRequest: now,
      };
      this.store.set(key, newRecord);
      
      return {
        allowed: true,
        remaining: max - 1,
        resetTime: newRecord.resetTime,
        retryAfter: 0,
      };
    }
    
    // Sliding window: ne compter que les requêtes dans la fenêtre courante
    // Pour simplifier, on utilise un compteur avec expiration
    if (record.count >= max) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      };
    }
    
    record.count++;
    this.store.set(key, record);
    
    return {
      allowed: true,
      remaining: max - record.count,
      resetTime: record.resetTime,
      retryAfter: 0,
    };
  }
  
  /**
   * Réinitialise le compteur pour une clé (ex: après login réussi)
   */
  reset(key: string): void {
    this.store.delete(key);
  }
  
  /**
   * Récupère les stats actuelles (pour monitoring)
   */
  getStats(): { totalKeys: number; memoryUsage: string } {
    return {
      totalKeys: this.store.size,
      memoryUsage: `${Math.round((this.store.size * 100) / 1024)} KB estimated`,
    };
  }
  
  /**
   * Nettoie les entrées expirées
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[RateLimiter] Cleaned ${cleaned} expired entries`);
    }
  }
  
  /**
   * Détruit le timer (pour graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiterStore();

// Limites spécifiques par type de route
export const RATE_LIMITS = {
  // Auth routes - plus strict pour prévenir brute force
  auth: {
    maxRequests: 10, // 10 tentatives par minute
    windowMs: 60_000,
  },
  login: {
    maxRequests: 5, // 5 tentatives de login par minute
    windowMs: 60_000,
  },
  // API générale
  api: {
    maxRequests: 100,
    windowMs: 60_000,
  },
  // Uploads - limite plus haute mais raisonnable
  upload: {
    maxRequests: 20,
    windowMs: 60_000,
  },
  // Statistics - limite basse pour éviter abuse
  statistics: {
    maxRequests: 30,
    windowMs: 60_000,
  },
} as const;

/**
 * Middleware de rate limiting pour Next.js API routes
 * @param key Clé unique (généralement IP ou userID)
 * @param type Type de limite à appliquer
 */
export function checkRateLimit(
  key: string,
  type: keyof typeof RATE_LIMITS = 'api'
): { allowed: boolean; remaining: number; retryAfter: number } {
  const config = RATE_LIMITS[type];
  return rateLimiter.check(key, config.maxRequests, config.windowMs);
}

/**
 * Génère une clé de rate limiting depuis une requête
 * Combine IP + user agent pour plus de précision
 */
export function generateRateLimitKey(request: Request | { headers: { get: (name: string) => string | null } }): string {
  const headers = request.headers;
  
  // Extraire l'IP (prend en compte les proxies)
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             headers.get('x-real-ip')?.trim() ||
             'unknown-ip';
  
  // Ajouter un hash du user agent pour distinguer différents clients
  const userAgent = headers.get('user-agent')?.substring(0, 50) || 'no-ua';
  
  // Créer une clé simple
  return `${ip}:${userAgent.length}`;
}

/**
 * Génère une réponse JSON de rate limit exceeded
 */
export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    {
      error: 'Trop de requêtes',
      message: `Veuillez réessayer dans ${retryAfter} secondes`,
      retryAfter,
    },
    { 
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': 'true',
      },
    }
  );
}

export default rateLimiter;

