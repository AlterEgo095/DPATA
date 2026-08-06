// lib/api/auth/api-key-auth.ts — P1 MIGRATION: Prisma -> JSON store
//
// WHY: Original used db.apiKey.* (Prisma), which fails with
// PrismaClientInitializationError because SQLite file is unavailable,
// causing HTTP 500 on /api/keys dashboard route.
//
// FIX: Migrate to JSON store (@/lib/store/db). Adds `apiKeys` and
// `apiAccessLogs` arrays to db.json (via store_db_patch). All bcrypt
// hashing preserved — no security regression.
//
// This is a drop-in replacement. Same public API:
//   - apiKeyAuth.validate(key, ip)
//   - apiKeyAuth.generate(options)
//   - apiKeyAuth.revoke(keyId)
//   - apiKeyAuth.incrementUsage(keyId)
//   - apiKeyAuth.getUserKeys(userId)
//   - apiKeyAuth.getKeyById(keyId)
//   - apiKeyAuth.getKeyStats(keyId, days)
//   - apiKeyAuth.checkRateLimit(apiKey)
//   - extractApiKeyFromHeaders(headers)
//   - extractIpAddress(headers, forwardedFor?)

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { loadDB, saveDB, genId, now } from '@/lib/store/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api-auth')

// ============================================================
// Types (unchanged from original)
// ============================================================

export type ApiKeyPermission = 'read' | 'write' | 'admin'

export interface ApiKeyInfo {
  id: string
  name: string
  prefix: string
  permissions: ApiKeyPermission[]
  rateLimit: number
  ipAddressWhitelist?: string[]
  isValid: boolean
  expiresAt?: Date
  lastUsedAt?: Date
  usageCount: number
  createdBy: string
  createdAt: Date
}

export interface CreateKeyOptions {
  name: string
  permissions?: ApiKeyPermission[]
  rateLimit?: number
  ipAddressWhitelist?: string[]
  expiresAt?: Date
  isTest?: boolean
  createdBy: string
}

export interface GeneratedApiKey {
  id: string
  key: string
  prefix: string
  name: string
  permissions: ApiKeyPermission[]
  createdAt: Date
}

export interface ValidationResult {
  valid: boolean
  apiKey?: ApiKeyInfo
  error?: { code: string; message: string; details?: any }
}

// ============================================================
// Constants
// ============================================================

const KEY_PREFIX_LIVE = 'pk_live_'
const KEY_PREFIX_TEST = 'pk_test_'
const KEY_LENGTH = 32
const SALT_ROUNDS = 12

// ============================================================
// Helpers
// ============================================================

interface ApiKeyRecord {
  id: string
  name: string
  keyHash: string
  prefix: string
  permissions: string
  rateLimit: number
  ipWhitelist: string | null
  isValid: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  usageCount: number
  createdBy: string
  createdAt: string
}

interface ApiAccessLogRecord {
  id: string
  apiKeyId: string
  method: string
  path: string
  statusCode: number
  responseTimeMs: number
  ipAddress: string
  createdAt: string
}

function recordToInfo(k: ApiKeyRecord): ApiKeyInfo {
  let permissions: ApiKeyPermission[] = ['read']
  try {
    permissions = JSON.parse(k.permissions) as ApiKeyPermission[]
  } catch {
    /* keep default */
  }
  let ipWhitelist: string[] | undefined
  if (k.ipWhitelist) {
    try {
      ipWhitelist = JSON.parse(k.ipWhitelist) as string[]
    } catch {
      ipWhitelist = undefined
    }
  }
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    permissions,
    rateLimit: k.rateLimit,
    ipAddressWhitelist: ipWhitelist,
    isValid: k.isValid,
    expiresAt: k.expiresAt ? new Date(k.expiresAt) : undefined,
    lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : undefined,
    usageCount: k.usageCount,
    createdBy: k.createdBy,
    createdAt: new Date(k.createdAt),
  }
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  try {
    return new Date() > new Date(expiresAt)
  } catch {
    return false
  }
}

// ============================================================
// ApiKeyAuth class
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
            message: "La clé API fournie n'est pas valide ou a expiré.",
            details: { hint: "Vérifiez l'en-tête X-API-Key" },
          },
        }
      }

      const prefix = this.extractPrefix(key)
      if (!prefix) {
        return {
          valid: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Format de clé API invalide.',
            details: { hint: 'Le format doit être pk_live_xxx ou pk_test_xxx' },
          },
        }
      }

      const db = await loadDB()
      const apiKeys = (db as any).apiKeys as ApiKeyRecord[] | undefined
      const candidates = (apiKeys || []).filter(
        (k) => k.prefix === prefix && k.isValid
      )

      for (const storedKey of candidates) {
        const isMatch = await bcrypt.compare(key, storedKey.keyHash)
        if (!isMatch) continue

        // Check expiration
        if (isExpired(storedKey.expiresAt)) {
          await this.revoke(storedKey.id)
          return {
            valid: false,
            error: {
              code: 'API_KEY_EXPIRED',
              message: 'Cette clé API a expiré.',
              details: { expiresAt: storedKey.expiresAt || undefined },
            },
          }
        }

        // Check IP whitelist
        if (storedKey.ipWhitelist && ipAddress) {
          let allowedIPs: string[] = []
          try {
            allowedIPs = JSON.parse(storedKey.ipWhitelist) as string[]
          } catch {
            allowedIPs = []
          }
          if (!allowedIPs.includes(ipAddress) && !allowedIPs.includes('0.0.0.0/0')) {
            logger.warn(`IP ${ipAddress} not in whitelist for key ${prefix}`, {
              apiKeyId: storedKey.id,
              allowedIPs,
            })
            return {
              valid: false,
              error: {
                code: 'IP_NOT_ALLOWED',
                message: "Votre adresse IP n'est pas autorisée pour cette clé API.",
                details: { ip: ipAddress },
              },
            }
          }
        }

        return { valid: true, apiKey: recordToInfo(storedKey) }
      }

      // No match found - constant-time dummy bcrypt compare to mitigate timing attacks
      await bcrypt.compare(key, '$2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')

      return {
        valid: false,
        error: {
          code: 'INVALID_API_KEY',
          message: "La clé API fournie n'est pas valide ou a expiré.",
          details: { hint: "Vérifiez l'en-tête X-API-Key" },
        },
      }
    } catch (error) {
      logger.error('Error validating API key', { error: String(error) })
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Erreur lors de la validation de la clé API.',
        },
      }
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
      createdBy,
    } = options

    const randomBytesBuffer = randomBytes(KEY_LENGTH)
    const keyString = randomBytesBuffer.toString('base64url')
    const prefix = isTest ? KEY_PREFIX_TEST : KEY_PREFIX_LIVE
    const fullKey = `${prefix}${keyString}`
    const hashedKey = await bcrypt.hash(fullKey, SALT_ROUNDS)
    const displayPrefix = `${prefix}${keyString.substring(0, 8)}...`

    const record: ApiKeyRecord = {
      id: genId('key'),
      name,
      keyHash: hashedKey,
      prefix: displayPrefix,
      permissions: JSON.stringify(permissions),
      rateLimit,
      ipWhitelist: ipAddressWhitelist ? JSON.stringify(ipAddressWhitelist) : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      lastUsedAt: null,
      usageCount: 0,
      isValid: true,
      createdBy,
      createdAt: now(),
    }

    const db = await loadDB()
    if (!Array.isArray((db as any).apiKeys)) (db as any).apiKeys = []
    ;(db as any).apiKeys.push(record)
    await saveDB(db)

    logger.info('API key created', {
      apiKeyId: record.id,
      name,
      createdBy,
      permissions,
      isTest,
    })

    return {
      id: record.id,
      key: fullKey,
      prefix: displayPrefix,
      name,
      permissions,
      createdAt: new Date(record.createdAt),
    }
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string): Promise<void> {
    const db = await loadDB()
    const apiKeys = (db as any).apiKeys as ApiKeyRecord[] | undefined
    if (!apiKeys) return
    const idx = apiKeys.findIndex((k) => k.id === keyId)
    if (idx !== -1) {
      apiKeys[idx].isValid = false
      await saveDB(db)
    }
    logger.info('API key revoked', { apiKeyId })
  }

  /**
   * Increment usage count and update last used timestamp
   */
  async incrementUsage(keyId: string): Promise<void> {
    const db = await loadDB()
    const apiKeys = (db as any).apiKeys as ApiKeyRecord[] | undefined
    if (!apiKeys) return
    const idx = apiKeys.findIndex((k) => k.id === keyId)
    if (idx !== -1) {
      apiKeys[idx].usageCount += 1
      apiKeys[idx].lastUsedAt = now()
      await saveDB(db)
    }
  }

  /**
   * Check rate limit (basic — actual enforcement in middleware)
   */
  async checkRateLimit(apiKey: ApiKeyInfo): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
  }> {
    const currentUsage = apiKey.usageCount
    const limit = apiKey.rateLimit
    return {
      allowed: currentUsage < limit,
      remaining: Math.max(0, limit - currentUsage),
      resetTime: Math.ceil(Date.now() / 1000) + 3600,
    }
  }

  /**
   * Get all API keys for a user
   */
  async getUserKeys(userId: string): Promise<ApiKeyInfo[]> {
    const db = await loadDB()
    const apiKeys = (db as any).apiKeys as ApiKeyRecord[] | undefined
    if (!apiKeys) return []
    return apiKeys
      .filter((k) => k.createdBy === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(recordToInfo)
  }

  /**
   * Get single API key by ID
   */
  async getKeyById(keyId: string): Promise<ApiKeyInfo | null> {
    const db = await loadDB()
    const apiKeys = (db as any).apiKeys as ApiKeyRecord[] | undefined
    if (!apiKeys) return null
    const rec = apiKeys.find((k) => k.id === keyId)
    return rec ? recordToInfo(rec) : null
  }

  /**
   * Get usage statistics for an API key
   */
  async getKeyStats(keyId: string, days: number = 30): Promise<{
    totalRequests: number
    successCount: number
    errorCount: number
    avgResponseTime: number
    requestsByDay: Record<string, number>
    requestsByEndpoint: Record<string, number>
  }> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceMs = since.getTime()

    const db = await loadDB()
    const logs = ((db as any).apiAccessLogs as ApiAccessLogRecord[] | undefined) || []
    const filtered = logs.filter(
      (l) => l.apiKeyId === keyId && new Date(l.createdAt).getTime() >= sinceMs
    )

    const stats = {
      totalRequests: filtered.length,
      successCount: filtered.filter((l) => l.statusCode >= 200 && l.statusCode < 400).length,
      errorCount: filtered.filter((l) => l.statusCode >= 400).length,
      avgResponseTime:
        filtered.length > 0
          ? Math.round(filtered.reduce((s, l) => s + l.responseTimeMs, 0) / filtered.length)
          : 0,
      requestsByDay: {} as Record<string, number>,
      requestsByEndpoint: {} as Record<string, number>,
    }

    for (const log of filtered) {
      const day = new Date(log.createdAt).toISOString().split('T')[0]
      stats.requestsByDay[day] = (stats.requestsByDay[day] || 0) + 1
      stats.requestsByEndpoint[log.path] = (stats.requestsByEndpoint[log.path] || 0) + 1
    }

    return stats
  }

  /**
   * Extract prefix from API key for lookup
   */
  private extractPrefix(key: string): string | null {
    if (key.startsWith(KEY_PREFIX_LIVE)) {
      return `${KEY_PREFIX_LIVE}${key.substring(KEY_PREFIX_LIVE.length, KEY_PREFIX_LIVE.length + 8)}...`
    }
    if (key.startsWith(KEY_PREFIX_TEST)) {
      return `${KEY_PREFIX_TEST}${key.substring(KEY_PREFIX_TEST.length, KEY_PREFIX_TEST.length + 8)}...`
    }
    return null
  }
}

export const apiKeyAuth = new ApiKeyAuth()

export function extractApiKeyFromHeaders(headers: Headers): string | null {
  return headers.get('x-api-key') || headers.get('X-API-Key') || null
}

export function extractIpAddress(headers: Headers, forwardedFor?: string): string {
  const xForwardedFor = headers.get('x-forwarded-for') || forwardedFor
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()
  const xRealIp = headers.get('x-real-ip')
  if (xRealIp) return xRealIp
  return 'unknown'
}
