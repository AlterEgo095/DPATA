// GET /api/federation/universities — Liste des universités fédérées
// POST /api/federation/universités — Ajouter/inviter une université
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getUniversities, addUniversity, saveUniversities } from '@/lib/federation/store';
import type { University, FederationConfig } from '@/lib/federation/types';
import { z } from 'zod';

// ============================================================
// SCHÉMAS DE VALIDATION
// ============================================================

const AddUniversitySchema = z.object({
  name: z.string().min(3).max(200),
  code: z.string().min(2).max(20).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
  country: z.string().min(2).max(100).default('RDC'),
  city: z.string().min(2).max(100),
  logoUrl: z.string().url().optional(),
  contactEmail: z.string().email(),
  apiEndpoint: z.string().url(),
  apiKey: z.string().min(16).optional(), // Will be hashed before storage
  status: z.enum(['active', 'inactive', 'pending']).default('pending'),
});

const UpdateConfigSchema = z.object({
  enableCrossUniversitySearch: z.boolean().optional(),
  shareAnonymizedData: z.boolean().optional(),
  syncIntervalHours: z.number().min(1).max(168).optional(),
  maxExternalResults: z.number().min(10).max(500).optional(),
  participatingUniversities: z.array(z.string()).optional(),
  rateLimitRequestsPerMinute: z.number().min(10).max(1000).optional(),
  cacheTTLSeconds: z.number().min(60).max(86400).optional(),
});

// ============================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================

const DEFAULT_CONFIG: FederationConfig = {
  enableCrossUniversitySearch: true,
  shareAnonymizedData: true,
  syncIntervalHours: 6,
  maxExternalResults: 50,
  participatingUniversities: [],
  rateLimitRequestsPerMinute: 60,
  cacheTTLSeconds: 300,
  requireConsentForSharing: true,
  autoApproveNewUniversities: false,
};

// GET - Lister les universités fédérées
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';
    const statusFilter = searchParams.get('status') as University['status'] | null;

    let universities = await getUniversities();

    // Filtrer par statut si demandé
    if (statusFilter) {
      universities = universities.filter(u => 
        u.isActive === (statusFilter === 'active')
      );
    }

    // Enrichir avec des statistiques de base si demandé
    let stats = null;
    if (includeStats) {
      const activeCount = universities.filter(u => u.isActive).length;
      const totalDocs = universities.reduce((sum, u) => sum + (u as any).documentCount || 0, 0);
      
      stats = {
        totalUniversities: universities.length,
        activeUniversities: activeCount,
        inactiveUniversities: universities.length - activeCount,
        totalDocuments: totalDocs,
        config: DEFAULT_CONFIG,
      };
    }

    return NextResponse.json({
      universities,
      stats,
    });
  } catch (error) {
    console.error('[Federation/API] GET error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// POST - Ajouter une université (invitation)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = AddUniversitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Données invalides',
        details: parsed.error.flatten(),
      }, { status: 400 });
    }

    const data = parsed.data;

    // Vérifier que le code n'existe pas déjà
    const existingUnis = await getUniversities();
    if (existingUnis.some(u => u.code === data.code)) {
      return NextResponse.json({
        error: 'Une université avec ce code existe déjà',
        field: 'code',
      }, { status: 409 });
    }

    // Hasher la API key si fournie (simulation - en production utiliser bcrypt)
    const hashedApiKey = data.apiKey 
      ? `hashed_${Buffer.from(data.apiKey).toString('base64').slice(0, 32)}`
      : '';

    const university = await addUniversity({
      code: data.code,
      name: data.name,
      apiUrl: data.apiEndpoint,
      apiKey: hashedApiKey,
      isActive: data.status === 'active',
    });

    // Retourner la réponse sans la API key hashée
    const responseUniversity = {
      ...university,
      apiKey: undefined, // Ne jamais exposer la clé API
      documentCount: 0,
      lastSyncAt: null,
      lastSyncStatus: null,
    };

    return NextResponse.json({
      success: true,
      university: responseUniversity,
      message: `Université ${data.name} ajoutée avec succès. Statut: ${data.status}`,
    }, { status: 201 });

  } catch (error) {
    console.error('[Federation/API] POST error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour la configuration globale de la fédération
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const parsed = UpdateConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Données de configuration invalides',
        details: parsed.error.flatten(),
      }, { status: 400 });
    }

    // En production: sauvegarder en DB
    // Pour l'instant, on retourne la config mise à jour
    const updatedConfig = { ...DEFAULT_CONFIG, ...parsed.data };

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      message: 'Configuration de la fédération mise à jour',
    });

  } catch (error) {
    console.error('[Federation/API] PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
