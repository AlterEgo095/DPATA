// GET /api/statistics/export
// API pour l'export des données (CSV/JSON)

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
    const format = (searchParams.get('format') as 'csv' | 'json') || 'csv';
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'year') || 'month';

    // Récupérer les données à exporter
    const exportData = await DataAggregator.exportData(format, { period });

    // Définir les headers appropriés
    const contentType = format === 'json' 
      ? 'application/json; charset=utf-8'
      : 'text/csv; charset=utf-8';
    
    const filename = `plagiatia-statistics-${new Date().toISOString().split('T')[0]}.${format}`;

    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'export des données' },
      { status: 500 }
    );
  }
}
