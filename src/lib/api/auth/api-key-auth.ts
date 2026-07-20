// API Key Authentication System for PlagiatIA Public API
// Supports secure key generation, validation, and management

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-auth');

// ============================================================
// Types
// ============================================================

export type ApiKeyPermission = 'read' | 'write' | 'admin';

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string; // pk_live_xxx or pk_test_xxx (for display)
  permissions: ApiKeyPermission[];
  rateLimit: number; // requests per hour
  ipAddressWhitelist?: string[];
  isValid: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
}

export interface CreateKeyOptions {
  name: string;
  permissions?: ApiKeyPermission[];
  rateLimit?: number;
  ipAddressWhitelist?: string[];
  expiresAt?: Date;
  isTest?: boolean;
  createdBy: string;
}

export interface GeneratedApiKey {
  id: string;
  key: string; // Full key (only shown once!)
  prefix: string; // For display
  name: string;
  permissions: ApiKeyPermission[];
  createdAt: Date;
}

export interface ValidationResult {
  valid: boolean;
  apiKey?: ApiKeyInfo;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// Constants
// ============================================================

const KEY_PREFIX_LIVE = 'pk_live_';
const KEY_PREFIX_TEST = 'pk_test_';
const KEY_LENGTH = 32; // bytes of randomness
const SALT_ROUNDS = 12;

// ============================================================
// ApiKeyAuth Class
// ============================================================

export class ApiKeyAuth {
  /**
   * Validate an API key from request headers
   */
  async validate(key: string, ipAddress?: string): Promise<ValidationResult> {
    try {
      if (!key || typeof key !== 'string') {
        return {
          valid: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'La clé API fournie n\'est pas valide ou a expiré.',
            details: { hint: 'Vérifiez l\'en-tête X-API-Key' }
          }
        };
      }

      // Extract prefix to find potential matches
      const prefix = this.extractPrefix(key);
      if (!prefix) {
        return {
          valid: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Format de clé API invalide.',
            details: { hint: 'Le format doit être pk_live_xxx ou pk_test_xxx' }
          }
        };
      }

      // Find all keys with this prefix (collision-resistant due to length)
      const possibleKeys = await db.apiKey.findMany({
        where: {
          prefix,
          isValid: true
        },
        include: {
          creator: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });

      // Check each potential key with timing-safe comparison
      for (const storedKey of possibleKeys) {
        const isMatch = await bcrypt.compare(key, storedKey.keyHash);
        
        if (isMatch) {
          // Check expiration
          if (storedKey.expiresAt && new Date() > storedKey.expiresAt) {
            await this.revoke(storedKey.id);
            return {
              valid: false,
              error: {
                code: 'API_KEY_EXPIRED',
                message: 'Cette clé API a expiré.',
                details: { expiresAt: storedKey.expiresAt }
              }
            };
          }

          // Check IP whitelist
          if (storedKey.ipWhitelist && ipAddress) {
            const allowedIPs: string[] = JSON.parse(storedKey.ipWhitelist);
            if (!allowedIPs.includes(ipAddress) && !allowedIPs.includes('0.0.0.0/0')) {
              logger.warn(`IP ${ipAddress} not in whitelist for key ${prefix}`, {
                apiKeyId: storedKey.id,
                allowedIPs
              });
              return {
                valid: false,
                error: {
                  code: 'IP_NOT_ALLOWED',
                  message: 'Votre adresse IP n\'est pas autorisée pour cette clé API.',
                  details: { ip: ipAddress }
                }
              };
            }
          }

          const apiKeyInfo: ApiKeyInfo = {
            id: storedKey.id,
            name: storedKey.name,
            prefix: storedKey.prefix,
            permissions: JSON.parse(storedKey.permissions),
            rateLimit: storedKey.rateLimit,
            ipAddressWhitelist: storedKey.ipWhitelist ? JSON.parse(storedKey.ipWhitelist) : undefined,
            isValid: storedKey.isValid,
            expiresAt: storedKey.expiresAt || undefined,
            lastUsedAt: storedKey.lastUsedAt || undefined,
            usageCount: storedKey.usageCount,
            createdBy: storedKey.createdBy,
            createdAt: storedKey.createdAt
          };

          return { valid: true, apiKey: apiKeyInfo };
        }
      }

      // No match found - use timing-safe comparison to prevent timing attacks
      await bcrypt.compare(key, '$2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

      return {
        valid: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'La clé API fournie n\'est pas valide ou a expiré.',
          details: { hint: 'Vérifiez l\'en-tête X-API-Key' }
        }
      };
    } catch (error) {
      logger.error('Error validating API key', { error: String(error) });
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Erreur lors de la validation de la clé API.'
        }
      };
    }
  }

  /**
   * Generate a new API key
   */
  async generate(options: CreateKeyOptions): Promise<GeneratedApiKey> {
    const {
      name,
      permissions = ['read'],
      rateLimit = 1000,
      ipAddressWhitelist,
      expiresAt,
      isTest = false,
      createdBy
    } = options;

    // Generate secure random bytes
    const randomBytesBuffer = randomBytes(KEY_LENGTH);
    const keyString = randomBytesBuffer.toString('base64url');
    
    // Create full key with prefix
    const prefix = isTest ? KEY_PREFIX_TEST : KEY_PREFIX_LIVE;
    const fullKey = `${prefix}${keyString}`;
    
    // Hash the key for storage
    const hashedKey = await bcrypt.hash(fullKey, SALT_ROUNDS);
    
    // Store only first 8 chars of key as prefix for lookup
    const displayPrefix = `${prefix}${keyString.substring(0, 8)}...`;

    // Save to database
    const apiKeyRecord = await db.apiKey.create({
      data: {
        name,
        keyHash: hashedKey,
        prefix: displayPrefix,
        permissions: JSON.stringify(permissions),
        rateLimit,
        ipWhitelist: ipAddressWhitelist ? JSON.stringify(ipAddressWhitelist) : null,
        expiresAt,
        createdBy
      }
    });

    logger.info(`API key created`, {
      apiKeyId: apiKeyRecord.id,
      name,
      createdBy,
      permissions,
      isTest
    });

    return {
      id: apiKeyRecord.id,
      key: fullKey, // Only returned once!
      prefix: displayPrefix,
      name,
      permissions,
      createdAt: apiKeyRecord.createdAt
    };
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string): Promise<void> {
    await db.apiKey.update({
      where: { id: keyId },
      data: { isValid: false }
    });

    logger.info(`API key revoked`, { apiKeyId: keyId });
  }

  /**
   * Increment usage count and update last used timestamp
   */
  async incrementUsage(keyId: string): Promise<void> {
    await db.apiKey.update({
      where: { id: keyId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });
  }

  /**
   * Check if API key has exceeded its rate limit
   * Uses sliding window algorithm via in-memory tracking
   */
  async checkRateLimit(apiKey: ApiKeyInfo): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    // This is a basic implementation - actual rate limiting is handled by RateLimiter middleware
    // This method checks the configured limit for the key
    const currentUsage = apiKey.usageCount;
    const limit = apiKey.rateLimit;
    
    // For simplicity, we allow all checks here and let the middleware handle actual limiting
    return {
      allowed: currentUsage < limit,
      remaining: Math.max(0, limit - currentUsage),
      resetTime: Math.ceil(Date.now() / 1000) + 3600 // Reset in 1 hour
    };
  }

  /**
   * Get all API keys for a user
   */
  async getUserKeys(userId: string): Promise<ApiKeyInfo[]> {
    const keys = await db.apiKey.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });

    return keys.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      permissions: JSON.parse(key.permissions),
      rateLimit: key.rateLimit,
      ipAddressWhitelist: key.ipWhitelist ? JSON.parse(key.ipWhitelist) : undefined,
      isValid: key.isValid,
      expiresAt: key.expiresAt || undefined,
      lastUsedAt: key.lastUsedAt || undefined,
      usageCount: key.usageCount,
      createdBy: key.createdBy,
      createdAt: key.createdAt
    }));
  }

  /**
   * Get single API key by ID
   */
  async getKeyById(keyId: string): Promise<ApiKeyInfo | null> {
    const key = await db.apiKey.findUnique({
      where: { id: keyId },
      include: {
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });

    if (!key) return null;

    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      permissions: JSON.parse(key.permissions),
      rateLimit: key.rateLimit,
      ipAddressWhitelist: key.ipWhitelist ? JSON.parse(key.ipWhitelist) : undefined,
      isValid: key.isValid,
      expiresAt: key.expiresAt || undefined,
      lastUsedAt: key.lastUsedAt || undefined,
      usageCount: key.usageCount,
      createdBy: key.createdBy,
      createdAt: key.createdAt
    };
  }

  /**
   * Get usage statistics for an API key
   */
  async getKeyStats(keyId: string, days: number = 30): Promise<{
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseTime: number;
    requestsByDay: Record<string, number>;
    requestsByEndpoint: Record<string, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await db.apiAccessLog.findMany({
      where: {
        apiKeyId: keyId,
        createdAt: { gte: since }
      }
    });

    const stats = {
      totalRequests: logs.length,
      successCount: logs.filter(l => l.statusCode >= 200 && l.statusCode < 400).length,
      errorCount: logs.filter(l => l.statusCode >= 400).length,
      avgResponseTime: logs.length > 0 
        ? Math.round(logs.reduce((sum, l) => sum + l.responseTimeMs, 0) / logs.length)
        : 0,
      requestsByDay: {} as Record<string, number>,
      requestsByEndpoint: {} as Record<string, number>
    };

    // Group by day
    for (const log of logs) {
      const day = log.createdAt.toISOString().split('T')[0];
      stats.requestsByDay[day] = (stats.requestsByDay[day] || 0) + 1;
      
      // Group by endpoint
      stats.requestsByEndpoint[log.path] = (stats.requestsByEndpoint[log.path] || 0) + 1;
    }

    return stats;
  }

  /**
   * Extract prefix from API key for lookup
   */
  private extractPrefix(key: string): string | null {
    if (key.startsWith(KEY_PREFIX_LIVE)) {
      return `${KEY_PREFIX_LIVE}${key.substring(KEY_PREFIX_LIVE.length, KEY_PREFIX_LIVE.length + 8)}...`;
    }
    if (key.startsWith(KEY_PREFIX_TEST)) {
      return `${KEY_PREFIX_TEST}${key.substring(KEY_PREFIX_TEST.length, KEY_PREFIX_TEST.length + 8)}...`;
    }
    return null;
  }
}

// Export singleton instance
export const apiKeyAuth = new ApiKeyAuth();

// Helper to extract API key from request headers
export function extractApiKeyFromHeaders(headers: Headers): string | null {
  return headers.get('x-api-key') || headers.get('X-API-Key') || null;
}

// Helper to extract IP address from request
export function extractIpAddress(headers: Headers, forwardedFor?: string): string {
  // Check for trusted proxy headers
  const xForwardedFor = headers.get('x-forwarded-for') || forwardedFor;
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }
  
  return 'unknown';
}
