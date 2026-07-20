// POST /api/batch - Créer un nouveau job batch
// GET /api/batch - Lister les jobs (avec pagination/filtres)
import { NextRequest, NextResponse } from 'next/server';
import { batchManager } from '@/lib/batch/batch-manager';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB } from '@/lib/store/db';
import { logger } from '@/lib/logger';

// ============================================================
// POST - Créer un job batch
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (user.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Les étudiants ne peuvent pas créer de jobs batch' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, documentIds, config } = body;

    // Validation des champs requis
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le nom du job est requis' },
        { status: 400 }
      );
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un document doit être sélectionné' },
        { status: 400 }
      );
    }

    // Validation de la config
    const validEngines = ['tfidf', 'hybrid', 'semantic'];
    const validScopes = ['faculty', 'department', 'promotion', 'all'];
    const validPriorities = ['low', 'normal', 'high'];

    if (config?.engine && !validEngines.includes(config.engine)) {
      return NextResponse.json(
        { error: `Moteur invalide. Valeurs acceptées: ${validEngines.join(', ')}` },
        { status: 400 }
      );
    }

    if (config?.scope && !validScopes.includes(config.scope)) {
      return NextResponse.json(
        { error: `Portée invalide. Valeurs acceptées: ${validScopes.join(', ')}` },
        { status: 400 }
      );
    }

    if (config?.priority && !validPriorities.includes(config.priority)) {
      return NextResponse.json(
        { error: `Priorité invalide. Valeurs acceptées: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    // Créer le job
    const job = await batchManager.createJob({
      name: name.trim(),
      documentIds,
      config: {
        threshold: config?.threshold ?? 0.15,
        scope: config?.scope ?? 'faculty',
        engine: config?.engine ?? 'tfidf',
        priority: config?.priority ?? 'normal',
        notifyOnComplete: config?.notifyOnComplete ?? true,
        maxConcurrent: config?.maxConcurrent,
        timeout: config?.timeout,
      },
      userId: user.sub,
    });

    logger.info('Batch job created via API', { 
      jobId: job.id, 
      userId: user.sub,
      docCount: documentIds.length 
    });

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        name: job.name,
        status: job.status,
        totalDocs: job.documentIds.length,
        config: job.config,
        createdAt: job.createdAt.toISOString(),
      },
    }, { status: 201 });

  } catch (error: any) {
    logger.error('Error creating batch job', { error: error.message });
    
    if (error.message.includes('Maximum') || error.message.includes('requis')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Erreur lors de la création du job batch' },
      { status: 500 }
    );
  }
}

// ============================================================
// GET - Lister les jobs batch
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Paramètres de requête
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Récupérer tous les jobs (depuis le store pour persistance complète)
    const db = await loadDB();
    let jobs = db.batchJobs || [];

    // Filtrer par statut
    if (status) {
      jobs = jobs.filter((j: any) => j.status === status);
    }

    // Filtrer par recherche
    if (search) {
      const searchLower = search.toLowerCase();
      jobs = jobs.filter((j: any) => 
        j.name.toLowerCase().includes(searchLower) ||
        j.id.toLowerCase().includes(searchLower)
      );
    }

    // Trier par date décroissante
    jobs.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Pagination
    const total = jobs.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedJobs = jobs.slice(startIndex, startIndex + limit);

    // Enrichir avec les infos créateur
    const enrichedJobs = paginatedJobs.map((job: any) => {
      const creator = db.users.find(u => u.id === job.createdBy);
      let results = [];
      try { results = JSON.parse(job.results || '[]'); } catch {}
      
      return {
        ...job,
        creatorName: creator ? `${creator.firstName} ${creator.lastName}` : 'Inconnu',
        resultsCount: results.length,
        completedCount: results.filter((r: any) => r.status === 'completed').length,
        failedCount: results.filter((r: any) => r.status === 'failed' || r.status === 'timeout').length,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedJobs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });

  } catch (error: any) {
    logger.error('Error listing batch jobs', { error: error.message });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des jobs batch' },
      { status: 500 }
    );
  }
}
