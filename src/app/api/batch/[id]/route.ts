// GET /api/batch/[id] - Détails d'un job + progression
// DELETE /api/batch/[id] - Annuler un job
// GET /api/batch/[id]/results - Résultats complets
// GET /api/batch/[id]/export - Export CSV du batch
//
// P4-D D6: Added audit() call on DELETE (batch.cancel) — captures IP + UA +
// before snapshot of the cancelled job.

import { NextRequest, NextResponse } from 'next/server';
import { batchManager } from '@/lib/batch/batch-manager';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB, saveDB, audit } from '@/lib/store/db';
import { 
  exportToCSV, 
  exportStatsToCSV, 
  generateFullReport,
  calculateBatchStats 
} from '@/lib/batch/report-generator';
import type { BatchSummary } from '@/lib/batch/types';
import { logger } from '@/lib/logger';
import { getRequestMeta } from '@/lib/request-meta';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================
// GET - Détails d'un job
// ============================================================

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    const db = await loadDB();
    const batchJobs = db.batchJobs || [];
    const jobRecord = batchJobs.find((j: any) => j.id === id);

    if (!jobRecord) {
      return NextResponse.json({ error: 'Job non trouvé' }, { status: 404 });
    }

    if (action === 'results') {
      return handleGetResults(jobRecord);
    }

    if (action === 'export') {
      return handleExport(jobRecord, searchParams.get('format') || 'csv');
    }

    let config = {};
    let results = [];
    try { config = JSON.parse(jobRecord.config || '{}'); } catch {}
    try { results = JSON.parse(jobRecord.results || '[]'); } catch {}

    const creator = db.users.find(u => u.id === jobRecord.createdBy);

    let stats: ReturnType<typeof calculateBatchStats> | null = null;
    if (jobRecord.status === 'completed' && results.length > 0) {
      stats = calculateBatchStats(results);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...jobRecord,
        config,
        results,
        stats,
        creatorName: creator ? `${creator.firstName} ${creator.lastName}` : 'Inconnu',
      },
    });

  } catch (error: any) {
    logger.error('Error getting batch job', { error: error.message });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du job' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE - Annuler un job
// ============================================================

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') {
      return NextResponse.json(
        { error: 'Permission refusée. Seuls les administrateurs peuvent annuler des jobs.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // P4-D D6: capture before snapshot for audit (best-effort — may be null
    // if the job is in-memory only and not in the DB store).
    let beforeSnapshot: any = null;
    try {
      const dbSnap = await loadDB();
      const rec = (dbSnap.batchJobs || []).find((j: any) => j.id === id);
      if (rec) beforeSnapshot = { ...rec };
    } catch {}

    try {
      await batchManager.cancelJob(id, user.sub);
    } catch (e: any) {
      const db = await loadDB();
      const batchJobs = db.batchJobs || [];
      const jobIndex = batchJobs.findIndex((j: any) => j.id === id);
      
      if (jobIndex === -1) {
        return NextResponse.json({ error: 'Job non trouvé' }, { status: 404 });
      }

      const job = batchJobs[jobIndex];
      if (job.status !== 'pending' && job.status !== 'running') {
        return NextResponse.json(
          { error: `Impossible d'annuler un job avec le statut: ${job.status}` },
          { status: 400 }
        );
      }

      batchJobs[jobIndex] = {
        ...job,
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await saveDB(db);
    }

    logger.info('Batch job cancelled', { jobId: id, userId: user.sub });

    // ---------------------------------------------------------------
    // P4-D D6: audit log entry — batch.cancel
    // ---------------------------------------------------------------
    try {
      const { ip, userAgent } = getRequestMeta(req);
      await audit(
        user.sub,
        `${user.firstName} ${user.lastName}`,
        'BATCH_CANCEL',
        'BatchJob',
        id,
        {},
        ip,
        {
          userAgent,
          method: 'DELETE',
          path: `/api/batch/${id}`,
          before: beforeSnapshot,
          after: beforeSnapshot ? { ...beforeSnapshot, status: 'cancelled' } : null,
        }
      );
    } catch (auditErr) {
      console.error('[batch DELETE] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Job annulé avec succès',
    });

  } catch (error: any) {
    logger.error('Error cancelling batch job', { error: error.message });
    
    if (error.message.includes('non trouvé') || error.message.includes('Impossible')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Erreur lors de l\'annulation du job' },
      { status: 500 }
    );
  }
}

// ============================================================
// HANDLERS AUXILIAIRES
// ============================================================

async function handleGetResults(jobRecord: any): Promise<NextResponse> {
  let results = [];
  let config = {};
  
  try { results = JSON.parse(jobRecord.results || '[]'); } catch {}
  try { config = JSON.parse(jobRecord.config || '{}'); } catch {}

  const summary: BatchSummary = {
    jobId: jobRecord.id,
    jobName: jobRecord.name,
    status: jobRecord.status,
    config: config as any,
    stats: calculateBatchStats(results),
    createdAt: jobRecord.createdAt,
    startedAt: jobRecord.startedAt,
    completedAt: jobRecord.completedAt,
    results: results,
  };

  const fullReport = generateFullReport(summary);

  return NextResponse.json({
    success: true,
    report: fullReport,
  });
}

async function handleExport(jobRecord: any, format: string): Promise<NextResponse> {
  let results = [];
  let config = {};
  
  try { results = JSON.parse(jobRecord.results || '[]'); } catch {}
  try { config = JSON.parse(jobRecord.config || '{}'); } catch {}

  if (format === 'json') {
    const summary: BatchSummary = {
      jobId: jobRecord.id,
      jobName: jobRecord.name,
      status: jobRecord.status,
      config: config as any,
      stats: calculateBatchStats(results),
      createdAt: jobRecord.createdAt,
      startedAt: jobRecord.startedAt,
      completedAt: jobRecord.completedAt,
      results: results,
    };

    const jsonData = JSON.stringify(generateFullReport(summary), null, 2);
    
    return new NextResponse(jsonData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="batch-${jobRecord.id}.json"`,
      },
    });
  }

  const csvContent = exportToCSV(results);
  const statsCsv = exportStatsToCSV(calculateBatchStats(results), jobRecord.name);
  const fullCsv = `# Rapport Batch: ${jobRecord.name}\n# Généré le: ${new Date().toISOString()}\n\n## Statistiques\n${statsCsv}\n\n## Résultats Détaillés\n${csvContent}\n`;

  return new NextResponse(fullCsv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="batch-${jobRecord.id}.csv"`,
    },
  });
}
