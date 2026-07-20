// GET /api/statistics/trends
// API pour les tendances temporelles

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
    const metric = (searchParams.get('metric') as 'plagiarism_rate' | 'documents' | 'analyses' | 'avg_score') || 'plagiarism_rate';
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'year') || 'month';

    // Récupérer les tendances
    const trendData = await DataAggregator.getTrends(metric, period);

    // Calculer des statistiques supplémentaires sur la tendance
    let trendAnalysis = null;
    
    if (trendData.length >= 5) {
      const values = trendData.map(p => p.value);
      const n = values.length;
      
      // Moyenne mobile simple (7 points)
      const movingAverages = [];
      for (let i = 6; i < n; i++) {
        const window = values.slice(i - 6, i + 1);
        const avg = window.reduce((a, b) => a + b, 0) / 7;
        movingAverages.push({
          date: trendData[i].date,
          value: avg,
          label: trendData[i].label,
        });
      }
      
      // Pente de la régression linéaire
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
      }
      
      const denominator = n * sumX2 - sumX * sumX;
      const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
      
      // Direction de la tendance
      const firstHalfAvg = values.slice(0, Math.floor(n / 2)).reduce((a, b) => a + b, 0) / Math.floor(n / 2);
      const secondHalfAvg = values.slice(Math.floor(n / 2)).reduce((a, b) => a + b, 0) / Math.ceil(n / 2);
      const direction = secondHalfAvg > firstHalfAvg ? 'increasing' : 
                        secondHalfAvg < firstHalfAvg ? 'decreasing' : 'stable';
      
      trendAnalysis = {
        direction,
        slope,
        movingAverages: movingAverages.slice(-10), // Derniers 10 points
        current: values[n - 1],
        previous: values[0],
        changePercent: values[0] !== 0 ? ((values[n - 1] - values[0]) / values[0]) * 100 : 0,
      };
    }

    return NextResponse.json({
      metric,
      period,
      data: trendData,
      analysis: trendAnalysis,
    });
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des tendances' },
      { status: 500 }
    );
  }
}
