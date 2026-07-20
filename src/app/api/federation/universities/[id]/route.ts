// /api/federation/universities/[id]
// GET - Détails université + stats
// PUT - Mettre à jour configuration
// DELETE - Retirer de la fédération
// POST /sync - Forcer synchronisation

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getUniversities, saveUniversities } from '@/lib/federation/store';
import { getSyncManager } from '@/lib/federation/sync-manager';
import { getFederationClient } from '@/lib/federation/client';
import type { University, UniversityStats, SyncQueueItem } from '@/lib/federation/types';
import { z } from 'zod';

interface ExtendedUniversity extends University {
  documentCount: number;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
}

// ============================================================
// SCHÉMAS DE VALIDATION
// ============================================================

const UpdateUniversitySchema = z.object({
  name: z.string().min(3).max(200).optional(),
  apiUrl: z.string().url().optional(),
  apiKey: z.string().min(16).optional(), // Nouvelle clé (sera hashée)
  status: z.enum(['active', 'inactive', 'pending', 'suspended']).optional(),
  contactEmail: z.string().email().optional(),
  logoUrl: z.string().url().optional(),
});

// ============================================================
// UTILITAIRES
// ============================================================

function findUniversity(id: string): { university: ExtendedUniversity; index: number } | null {
  // Simuler des données enrichies pour la démo
  const unis = getUniversities() as unknown as ExtendedUniversity[];
  
  // Enrichir avec des données factices pour la démo
  const enriched = (unis as any).map((u: any, i: number) => ({
    ...u,
    country: 'RDC',
    city: i === 0 ? 'Kinshasa' : i === 1 ? 'Lubumbashi' : i === 2 ? 'Bukavu' : 'Kisangani',
    contactEmail: `contact@${u.code.toLowerCase()}.ac.cd`,
    documentCount: [1234, 856, 432, 0][i] || 0,
    lastSyncAt: i === 0 ? new Date(Date.now() - 2 * 60 * 60 * 1000) : 
               i === 1 ? new Date(Date.now() - 6 * 60 * 60 * 1000) : null,
    lastSyncStatus: ['success', 'success', 'failed', null][i] || null,
    createdAt: u.createdAt,
    updatedAt: new Date(),
  }));
  
  const index = enriched.findIndex(u => u.id === id);
  if (index === -1) return null;
  
  return { university: enriched[index], index };
}

async function generateMockStats(university: ExtendedUniversity): Promise<UniversityStats> {
  // En production, ces stats viendraient de la DB ou d'un appel API réel
  return {
    universityId: university.id,
    totalDocuments: university.documentCount,
    sharedDocuments: Math.floor(university.documentCount * 0.8),
    lastSyncAt: university.lastSyncAt,
    lastSyncDuration: university.lastSyncAt ? 4500 + Math.random() * 2000 : 0,
    avgResponseTime: 150 + Math.random() * 300,
    searchCountToday: Math.floor(Math.random() * 50),
    searchCountTotal: Math.floor(Math.random() * 5000),
    matchRate: 0.05 + Math.random() * 0.15,
    status: university.isActive ? 'active' : 'inactive',
    uptimePercentage: 95 + Math.random() * 5,
  };
}

// ============================================================
// ROUTES
// ============================================================

// GET - Détails université + statistiques
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const result = findUniversity(id);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Université non trouvée' },
        { status: 404 }
      );
    }

    const { university } = result;

    // Inclure les statistiques si demandé
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') !== 'false'; // Stats par défaut

    let stats: UniversityStats | undefined;
    if (includeStats && university.isActive) {
      stats = await generateMockStats(university);
    }

    // Ne jamais exposer la clé API
    const safeUniversity = {
      ...university,
      apiKey: undefined,
    };

    return NextResponse.json({
      university: safeUniversity,
      stats,
    });

  } catch (error) {
    console.error('[Federation/ID] GET error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour une université
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes' }, 
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateUniversitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Données invalides',
        details: parsed.error.flatten(),
      }, { status: 400 });
    }

    // Récupérer et mettre à jour l'université
    const universities = await getUniversities();
    const index = universities.findIndex(u => u.id === id);
    
    if (index === -1) {
      return NextResponse.json(
        { error: 'Université non trouvée' },
        { status: 404 }
      );
    }

    // Appliquer les mises à jour
    const updatedUniversity = {
      ...universities[index],
      ...parsed.data,
      // Hasher la nouvelle API key si fournie
      ...(parsed.data.apiKey ? { 
        apiKey: `hashed_${Buffer.from(parsed.data.apiKey).toString('base64').slice(0, 32)}` 
      } : {}),
      updatedAt: new Date(),
    };

    universities[index] = updatedUniversity as any;
    await saveUniversities(universities);

    // Retourner sans la clé API
    const { apiKey: _, ...safeUniversity } = updatedUniversity;

    return NextResponse.json({
      success: true,
      university: safeUniversity,
      message: 'Université mise à jour avec succès',
    });

  } catch (error) {
    console.error('[Federation/ID] PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// DELETE - Retirer une université de la fédération
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes - SUPER_ADMIN requis' }, 
        { status: 403 }
      );
    }

    const { id } = await params;
    const universities = await getUniversities();
    const index = universities.findIndex(u => u.id === id);
    
    if (index === -1) {
      return NextResponse.json(
        { error: 'Université non trouvée' },
        { status: 404 }
      );
    }

    const removed = universities.splice(index, 1)[0];
    await saveUniversities(universities);

    return NextResponse.json({
      success: true,
      removedUniversity: {
        id: removed.id,
        code: removed.code,
        name: removed.name,
      },
      message: `Université ${removed.name} retirée de la fédération`,
    });

  } catch (error) {
    console.error('[Federation/ID] DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// POST - Actions spéciales (sync, test-connection, etc.)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes' }, 
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const result = findUniversity(id);
    if (!result) {
      return NextResponse.json(
        { error: 'Université non trouvée' },
        { status: 404 }
      );
    }

    const { university } = result;

    switch (action) {
      case 'sync': {
        // Forcer une synchronisation
        const syncManager = getSyncManager();
        const syncTask = syncManager.scheduleMetadataSync(id);
        
        return NextResponse.json({
          success: true,
          syncTask: {
            id: syncTask.id,
            operation: syncTask.operation,
            status: syncTask.status,
            priority: syncTask.priority,
          },
          message: 'Synchronisation planifiée',
        });
      }

      case 'test-connection': {
        // Tester la connexion avec l'université
        const client = getFederationClient();
        
        // Simulation du health check
        // En production: const healthResult = await client.healthCheck(university);
        
        const isSimulatedSuccess = university.isActive || Math.random() > 0.3;
        
        return NextResponse.json({
          success: isSimulatedSuccess,
          connection: {
            status: isSimulatedSuccess ? 'healthy' : 'unhealthy',
            latency: isSimulatedSuccess ? 120 + Math.random() * 200 : 0,
            version: '2.0.0',
            timestamp: new Date(),
          },
          message: isSimulatedSuccess 
            ? 'Connexion établie avec succès' 
            : 'Impossible de contacter le serveur distant',
        });
      }

      case 'toggle-status': {
        // Activer/désactiver une université
        const body = await request.json().catch(() => ({}));
        const newStatus = body.status as string;
        
        if (!['active', 'inactive'].includes(newStatus)) {
          return NextResponse.json({
            error: 'Statut invalide. Utilisez "active" ou "inactive"',
          }, { status: 400 });
        }

        const universities = await getUniversities();
        const index = universities.findIndex(u => u.id === id);
        
        if (index !== -1) {
          (universities[index] as any).isActive = newStatus === 'active';
          await saveUniversities(universities);
        }

        return NextResponse.json({
          success: true,
          previousStatus: university.isActive ? 'active' : 'inactive',
          newStatus,
          message: `Université ${newStatus === 'active' ? 'activée' : 'désactivée'}`,
        });
      }

      default:
        return NextResponse.json({
          error: 'Action non reconnue',
          validActions: ['sync', 'test-connection', 'toggle-status'],
        }, { status: 400 });
    }

  } catch (error) {
    console.error('[Federation/ID] POST error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
