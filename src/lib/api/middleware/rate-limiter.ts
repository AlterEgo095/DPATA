// Advanced Rate Limiting for PlagiatIA Public API
// Implements sliding window algorithm with per-endpoint and per-key limits

import { createLogger } from '@/lib/logger';

const logger = createLogger('rate-limiter');

// ============================================================
// Types
// ============================================================

interface RateLimitEntry {
  count: number;
  windowStart: number; // Timestamp in ms
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Sliding window duration in ms
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp
  limit: number;
  retryAfter?: number; // Seconds to wait before retry
}

// ============================================================
// Default configurations per endpoint
// ============================================================

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { maxRequests: 1000, windowMs: 3600000 }, // 1000/hour
  auth: { maxRequests: 10, windowMs: 60000 }, // 10/minute (sensitive)
  documents: { maxRequests: 200, windowMs: 3600000 }, // 200/hour
  analyze: { maxRequests: 50, windowMs: 3600000 }, // 50/hour (expensive)
  statistics: { maxRequests: 300, windowMs: 3600000 }, // 300/hour
  subjects: { maxRequests: 300, windowMs: 3600000 }, // 300/hour
};

// Global rate limit for all requests
export const GLOBAL_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5000,
  windowMs: 3600000, // 5000/hour total
};

// ============================================================
// In-memory storage (for production, use Redis)
// ============================================================

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval - remove expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.windowStart + DEFAULT_RATE_LIMITS.default.windowMs) {
          rateLimitStore.delete(key);
        }
      }
    }, CLEANUP_INTERVAL);

    // Don't prevent process exit
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

startCleanup();

// ============================================================
// RateLimiter Class
// ============================================================

export class RateLimiter {
  private store: Map<string, RateLimitEntry>;
  private defaultConfig: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.store = rateLimitStore;
    this.defaultConfig = {
      maxRequests: config?.maxRequests || DEFAULT_RATE_LIMITS.default.maxRequests,
      windowMs: config?.windowMs || DEFAULT_RATE_LIMITS.default.windowMs,
    };
  }

  /**
   * Check rate limit using sliding window algorithm
   */
  check(
    identifier: string,
    config?: Partial<RateLimitConfig>
  ): RateLimitResult {
    const effectiveConfig: RateLimitConfig = config
      ? { ...this.defaultConfig, ...config }
      : this.defaultConfig;

    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.windowStart + effectiveConfig.windowMs) {
      // New window or expired entry
      this.store.set(identifier, {
        count: 1,
        windowStart: now,
      });

      return {
        allowed: true,
        remaining: effectiveConfig.maxRequests - 1,
        resetTime: Math.ceil((now + effectiveConfig.windowMs) / 1000),
        limit: effectiveConfig.maxRequests,
      };
    }

    // Calculate sliding window count
    const windowAge = now - entry.windowStart;
    const slideFraction = windowAge / effectiveConfig.windowMs;
    
    // Approximate sliding window count (decay old requests)
    const decayedCount = Math.ceil(entry.count * (1 - slideFraction * 0.5));
    const currentCount = Math.max(entry.count, decayedCount);

    if (currentCount >= effectiveConfig.maxRequests) {
      // Rate limited
      const resetIn = effectiveConfig.windowMs - windowAge;
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.ceil((now + resetIn) / 1000),
        limit: effectiveConfig.maxRequests,
        retryAfter: Math.ceil(resetIn / 1000),
      };
    }

    // Increment and allow
    entry.count++;
    
    return {
      allowed: true,
      remaining: effectiveConfig.maxRequests - entry.count,
      resetTime: Math.ceil((entry.windowStart + effectiveConfig.windowMs) / 1000),
      limit: effectiveConfig.maxRequests,
    };
  }

  /**
   * Check rate limit for a specific API key
   */
  checkApiKey(
    apiKeyId: string,
    customLimit?: number
  ): RateLimitResult {
    const limit = customLimit || this.defaultConfig.maxRequests;
    return this.check(`apikey:${apiKeyId}`, { maxRequests: limit });
  }

  /**
   * Check rate limit based on IP address
   */
  checkIp(ipAddress: string): RateLimitResult {
    return this.check(`ip:${ipAddress}`);
  }

  /**
   * Check global rate limit
   */
  checkGlobal(): RateLimitResult {
    return this.check('global', GLOBAL_RATE_LIMIT);
  }

  /**
   * Check combined rate limits (IP + API Key + Global)
   */
  checkCombined(
    ipAddress: string,
    apiKeyId?: string,
    apiKeyCustomLimit?: number
  ): RateLimitResult & { limitedBy: string } {
    // Check all limits
    const ipResult = this.checkIp(ipAddress);
    const apiKeyResult = apiKeyId 
      ? this.checkApiKey(apiKeyId, apiKeyCustomLimit)
      : { allowed: true, remaining: Infinity, resetTime: 0, limit: Infinity };
    const globalResult = this.checkGlobal();

    // Find most restrictive limit
    const results = [
      { ...ipResult, limitedBy: 'ip' },
      { ...apiKeyResult, limitedBy: 'apiKey' },
      { ...globalResult, limitedBy: 'global' },
    ];

    // Return first failing result or most restrictive passing result
    const failing = results.find(r => !r.allowed);
    if (failing) {
      return failing as RateLimitResult & { limitedBy: string };
    }

    // Return result with lowest remaining
    return results.reduce((min, curr) => 
      curr.remaining < min.remaining ? curr : min
    ) as RateLimitResult & { limitedBy: string };
  }

  /**
   * Reset rate limit for an identifier (admin function)
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Get current status without incrementing
   */
  getStatus(identifier: string): RateLimitResult | null {
    const entry = this.store.get(identifier);
    if (!entry) return null;

    const now = Date.now();
    const remaining = Math.max(0, this.defaultConfig.maxRequests - entry.count);
    
    return {
      allowed: remaining > 0,
      remaining,
      resetTime: Math.ceil((entry.windowStart + this.defaultConfig.windowMs) / 1000),
      limit: this.defaultConfig.maxRequests,
    };
  }

  /**
   * Clean up all entries (for testing/admin)
   */
  cleanup(): void {
    this.store.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// ============================================================
// Helper functions for HTTP responses
// ============================================================

/**
 * Add rate limit headers to a Response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const newHeaders = new Headers(response.headers);
  
  newHeaders.set('X-RateLimit-Limit', String(result.limit));
  newHeaders.set('X-RateLimit-Remaining', String(result.remaining));
  newHeaders.set('X-RateLimit-Reset', String(result.resetTime));
  
  if (!result.allowed && result.retryAfter) {
    newHeaders.set('Retry-After', String(result.retryAfter));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Trop de requêtes. Veuillez ralentir.',
        details: {
          retryAfter: result.retryAfter,
          limit: result.limit,
          resetTime: result.resetTime,
        },
      },
      meta: {
        requestId: `req_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    }),
    {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetTime),
        'Retry-After': String(result.retryAfter || 60),
      },
    }
  );
}
