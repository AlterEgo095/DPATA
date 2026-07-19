// Knowledge Base API endpoints for DPATA
// Provides comprehensive REST API for subject management, search, stats, and export

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getSubjects,
  searchSubjects,
  getKnowledgeBaseStats,
  exportSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  importSubjects,
  batchUpdateStatus,
  findSimilarSubjects,
} from '@/lib/knowledge-base';

/**
 * GET /api/kb - List subjects, search, get stats, or export
 * 
 * Query parameters:
 * - action: 'stats' | 'export' | 'search' | 'similar' | (default: list)
 * - q: search query (for search action)
 * - title: title to find similar subjects (for similar action)
 * - domain, facultyId, workType, level, status, search: filters
 * - format: 'json' | 'csv' (for export action)
 * - limit, offset: pagination (for search action)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats': {
        // Get comprehensive knowledge base statistics
        const stats = await getKnowledgeBaseStats();
        return NextResponse.json(stats);
      }

      case 'export': {
        // Export subjects in JSON or CSV format
        const format = (searchParams.get('format') as 'json' | 'csv') || 'json';
        const data = await exportSubjects(format, {
          domain: searchParams.get('domain') || undefined,
          facultyId: searchParams.get('facultyId') || undefined,
          status: searchParams.get('status') || undefined,
        });
        
        if (format === 'csv') {
          return new NextResponse(data, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="subjects-${new Date().toISOString().split('T')[0]}.csv"`,
            },
          });
        }
        
        return new NextResponse(data, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="subjects-${new Date().toISOString().split('T')[0]}.json"`,
          },
        });
      }

      case 'search': {
        // Advanced search with relevance scoring
        const query = searchParams.get('q') || '';
        const results = await searchSubjects(query, {
          limit: parseInt(searchParams.get('limit') || '50'),
          offset: parseInt(searchParams.get('offset') || '0'),
          domains: searchParams.get('domains')?.split(',').filter(Boolean),
          faculties: searchParams.get('faculties')?.split(',').filter(Boolean),
        });
        return NextResponse.json(results);
      }

      case 'similar': {
        // Find similar subjects to a given title
        const title = searchParams.get('title');
        if (!title) {
          return NextResponse.json({ error: 'Le paramètre "title" est requis' }, { status: 400 });
        }
        
        const threshold = parseFloat(searchParams.get('threshold') || '0.3');
        const limit = parseInt(searchParams.get('limit') || '10');
        const similar = await findSimilarSubjects(title, threshold, limit);
        return NextResponse.json(similar);
      }

      default: {
        // List all subjects with optional filtering
        const subjects = await getSubjects({
          domain: searchParams.get('domain') || undefined,
          facultyId: searchParams.get('facultyId') || undefined,
          workType: searchParams.get('workType') || undefined,
          level: searchParams.get('level') || undefined,
          status: searchParams.get('status') || undefined,
          search: searchParams.get('search') || undefined,
        });
        return NextResponse.json({ subjects, total: subjects.length });
      }
    }
  } catch (error: any) {
    console.error('Knowledge Base API GET error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kb - Create a new subject or import multiple subjects
 * 
 * Body for single creation:
 * - data: Partial<AcademicSubject>
 * - options?: CategorizationOptions
 * 
 * Body for import:
 * - action: 'import'
 * - data: Array<Record<string, any>>
 * - format: 'csv' | 'json' | 'excel'
 * - options?: CategorizationOptions
 * 
 * Body for batch operations:
 * - action: 'batch-status'
 * - ids: string[]
 * - status: 'VALIDATED' | 'PENDING' | 'REJECTED'
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    switch (action) {
      case 'import': {
        // Import subjects from CSV/JSON/Excel data
        if (!Array.isArray(body.data)) {
          return NextResponse.json(
            { error: 'Le champ "data" doit être un tableau' },
            { status: 400 }
          );
        }

        const format = body.format || 'json';
        if (!['csv', 'json', 'excel'].includes(format)) {
          return NextResponse.json(
            { error: 'Format non supporté. Utilisez: csv, json, ou excel' },
            { status: 400 }
          );
        }

        const result = await importSubjects(
          body.data,
          format,
          user.sub,
          `${user.firstName} ${user.lastName}`,
          body.options
        );
        return NextResponse.json(result, { status: result.success ? 201 : 400 });
      }

      case 'batch-status': {
        // Batch update status of multiple subjects
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return NextResponse.json(
            { error: 'Le champ "ids" doit être un tableau non vide' },
            { status: 400 }
          );
        }

        const validStatuses = ['VALIDATED', 'PENDING', 'REJECTED'];
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json(
            { error: `Statut invalide. Valeurs acceptées: ${validStatuses.join(', ')}` },
            { status: 400 }
          );
        }

        const result = await batchUpdateStatus(
          body.ids,
          body.status,
          user.sub,
          `${user.firstName} ${user.lastName}`
        );
        return NextResponse.json(result);
      }

      default: {
        // Create a single new subject
        const { data, options } = body;
        if (!data || !data.title) {
          return NextResponse.json(
            { error: 'Le titre est obligatoire pour créer un sujet' },
            { status: 400 }
          );
        }

        const subject = await createSubject(
          data,
          user.sub,
          `${user.firstName} ${user.lastName}`,
          options
        );
        return NextResponse.json(subject, { status: 201 });
      }
    }
  } catch (error: any) {
    console.error('Knowledge Base API POST error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/kb - Update an existing subject
 * 
 * Body:
 * - id: string (required)
 * - data: Partial<AcademicSubject> (required)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json(
        { error: 'Les champs "id" et "data" sont obligatoires' },
        { status: 400 }
      );
    }

    const updated = await updateSubject(
      id,
      data,
      user.sub,
      `${user.firstName} ${user.lastName}`
    );

    if (!updated) {
      return NextResponse.json(
        { error: 'Sujet non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Knowledge Base API PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kb - Delete a subject (soft or hard delete)
 * 
 * Query parameters:
 * - id: string (required)
 * - hard: 'true' | 'false' (optional, default: false)
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'Le paramètre "id" est obligatoire' },
        { status: 400 }
      );
    }

    const success = await deleteSubject(
      id,
      user.sub,
      `${user.firstName} ${user.lastName}`,
      hardDelete
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Sujet non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Sujet supprimé définitivement' : 'Sujet archivé',
    });
  } catch (error: any) {
    console.error('Knowledge Base API DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur', message: error.message },
      { status: 500 }
    );
  }
}
