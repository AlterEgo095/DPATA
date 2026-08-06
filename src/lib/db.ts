// lib/db.ts — P1 HARDENING: Graceful Prisma fallback
//
// WHY: The app uses the JSON store (@/lib/store/db) as its runtime database.
// A subset of legacy routes (/api/keys, /api/v1/*) still import @/lib/db
// (Prisma), which crashes with PrismaClientInitializationError when the
// SQLite file is unavailable — surfacing as HTTP 500 to users.
//
// FIX: Wrap PrismaClient init in try/catch. If it fails, export a Proxy stub
// that returns empty results for read operations and rejects writes with a
// descriptive error. This keeps legacy routes responding (200 with empty
// data, or 503 with a clear message) instead of crashing the process.
//
// LONG-TERM: Migrate remaining @/lib/db consumers to @/lib/store/db.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prismaClient: PrismaClient | null = null
let prismaInitError: string | null = null

try {
  prismaClient = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient
} catch (e: any) {
  prismaInitError = e?.message || String(e)
  console.warn('[DB] Prisma initialization failed. Legacy routes will return empty results.', prismaInitError)
  prismaClient = null
}

// Stub method: returns sensible empty defaults per Prisma method semantics.
function stubMethod(prop: string): (...args: any[]) => Promise<any> {
  return async (..._args: any[]) => {
    // Read-like operations -> empty results (keeps legacy endpoints responding 200)
    if (prop === 'findMany' || prop === 'groupBy') return []
    if (prop === 'findUnique' || prop === 'findFirst') return null
    if (prop === 'count') return 0
    if (prop === 'aggregate') return { _count: 0, _sum: null, _avg: null, _min: null, _max: null }
    if (prop === 'deleteMany' || prop === 'updateMany') return { count: 0 }

    // Write operations -> reject with descriptive error so callers can surface it
    if (prop === 'create' || prop === 'createMany' || prop === 'update' || prop === 'upsert' || prop === 'delete') {
      const err = new Error(
        'Base de données Prisma non disponible. Cette opération doit utiliser le store JSON (@/lib/store/db).'
      )
      ;(err as any).code = 'PRISMA_UNAVAILABLE'
      throw err
    }

    // Unknown method -> empty array as safest default
    return []
  }
}

// Proxy that delegates to real Prisma when available, else uses stub.
const dbProxy = new Proxy(
  // Empty target; all access goes through the handler.
  {},
  {
    get(_target, prop: string) {
      if (prismaClient) {
        const val = (prismaClient as any)[prop]
        return typeof val === 'function' ? val.bind(prismaClient) : val
      }
      // Prisma unavailable — return stub method for known model accessors
      // (e.g., db.apiKey.findMany -> prisma.apiKey.findMany).
      // We return a function that itself returns the stubbed result,
      // so callers can chain: db.apiKey.findMany({...})
      return new Proxy(
        {},
        {
          get(_t2, p2: string) {
            return stubMethod(p2)
          },
        }
      )
    },
  }
) as unknown as PrismaClient

export const db = dbProxy

// Helper for health checks / monitoring
export function getPrismaStatus(): { available: boolean; error: string | null } {
  return { available: prismaClient !== null, error: prismaInitError }
}
