// GET /api/statistics
// API principale pour les statistiques avancées

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { DataAggregator } from '@/lib/statistics/aggregator';

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Extraire les paramètres
    const { searchParams } = request.nextUrl;
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'year') || 'month';
    const groupBy = searchParams.get('group') as 'faculty' | 'department' | 'promotion' | undefined;
    const facultyId = searchParams.get('faculty') || undefined;

    // Récupérer les statistiques
    const stats = await DataAggregator.getDashboardStats({
      period,
      groupBy,
      facultyId,
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Statistics API error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    );
  }
}
