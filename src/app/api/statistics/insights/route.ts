// GET /api/statistics/insights
// API pour les insights automatisés

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { DataAggregator } from '@/lib/statistics/aggregator';
import { InsightGenerator } from '@/lib/statistics/insights';

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
    
    // Options de configuration des insights (optionnel)
    const maxInsights = parseInt(searchParams.get('max') || '10', 10);
    const sensitivity = parseFloat(searchParams.get('sensitivity') || '0.3');

    // Récupérer les données agrégées
    const data = await DataAggregator.getDashboardStats({ period });

    // Générer les insights
    const generator = new InsightGenerator({
      maxInsights,
      trendSensitivity: Math.max(0, Math.min(1, sensitivity)),
    });

    const insights = generator.generateInsights(data);

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération des insights' },
      { status: 500 }
    );
  }
}
