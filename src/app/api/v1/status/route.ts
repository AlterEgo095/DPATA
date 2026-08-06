// app/api/v1/status/route.ts — P1 NEW: monitoring endpoint
//
// GET /api/v1/status
// Returns platform status, engine health, AI connectivity, DB stats.
// No auth required (public status page). Sensitive details omitted.
//
// Additive endpoint — zero risk to existing routes.

import { NextResponse } from 'next/server'
import { loadDB } from '@/lib/store/db'
import { getPrismaStatus } from '@/lib/db'

export async function GET() {
  const startedAt = Date.now()
  try {
    const db = await loadDB()
    const prismaStatus = getPrismaStatus()

    const users = (db.users || []).length
    const documents = (db.documents || []).length
    const analyses = (db.analyses || []).length
    const academicSubjects = (db.academicSubjects || []).length
    const apiKeys = ((db as any).apiKeys || []).length

    // AI engine availability (config-driven, not a live call to avoid cost)
    const aiConfigured = !!process.env.ZAI_API_KEY
    const aiModel = process.env.ZAI_MODEL || 'glm-4.5-flash'

    const status = {
      status: 'operational' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime ? Math.round(process.uptime()) : null,
      engines: {
        tfidf: { available: true, name: 'TF-IDF + Cosine + Jaccard', version: '2.0.0' },
        hybrid: { available: true, name: 'Hybrid (TF-IDF + LLM)', defaultEngine: true },
        llm: {
          available: aiConfigured,
          name: 'Z.ai Semantic Engine',
          model: aiModel,
          fallbackModel: 'glm-4.7-flash',
        },
      },
      database: {
        type: 'json-store',
        location: 'data/db.json',
        prisma: {
          available: prismaStatus.available,
          note: prismaStatus.available
            ? undefined
            : 'Prisma legacy routes return empty results. Use JSON store.',
        },
        counts: { users, documents, analyses, academicSubjects, apiKeys },
      },
      features: {
        pdfExport: process.env.ENABLE_PDF_EXPORT === 'true',
        batchProcessing: process.env.ENABLE_BATCH_PROCESSING === 'true',
        publicApi: process.env.ENABLE_PUBLIC_API === 'true',
        advancedStatistics: process.env.ENABLE_ADVANCED_STATISTICS === 'true',
        aiDetection: process.env.ENABLE_AI_DETECTION === 'true',
      },
      responseTimeMs: Date.now() - startedAt,
    }

    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Response-Time': `${status.responseTimeMs}ms`,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        status: 'degraded',
        error: e?.message || 'Status check failed',
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startedAt,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
