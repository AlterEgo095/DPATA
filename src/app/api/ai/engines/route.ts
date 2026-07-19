// AI Engine Status & Management API
// PHASE 6: IA AVANCÉE - Engine Monitoring

import { NextRequest, NextResponse } from 'next/server';
import { getAllEnginesStatus, getAvailableEngines, getEngine } from '@/lib/ia/engine-factory';

/**
 * GET /api/ai/engines - Get all available AI engines and their status
 */
export async function GET(request: NextRequest) {
  try {
    const engines = await getAllEnginesStatus();
    
    return NextResponse.json({
      success: true,
      engines,
      defaultEngine: 'HYBRID',
      availableTypes: getAvailableEngines(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AI Engines] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve engine status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/engines - Test an engine with sample data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { engineType, query, testType } = body;

    const type = engineType || 'HYBRID';
    const engine = getEngine(type as any);
    
    // Initialize the engine
    await engine.initialize();

    if (testType === 'health') {
      const health = await engine.healthCheck();
      return NextResponse.json({
        success: true,
        test: 'health',
        engine: type,
        result: health,
      });
    }

    if (testType === 'analyze' && query) {
      // Test with sample corpus
      const sampleCorpus = [
        { id: '1', text: 'Les robots dans l\'industrie automobile moderne' },
        { id: '2', text: 'L\'intelligence artificielle et ses applications' },
        { id: '3', text: 'La biométrie et la sécurité des systèmes informatiques' },
      ];

      const result = await engine.analyze(query, sampleCorpus, { threshold: 0.1 });
      
      return NextResponse.json({
        success: true,
        test: 'analyze',
        engine: type,
        query,
        result: {
          overallScore: result.overallScore,
          matchesCount: result.matches.length,
          processingTimeMs: result.processingTimeMs,
          engineUsed: result.engineUsed,
          summary: result.summary,
        },
      });
    }

    if (testType === 'validate' && query) {
      const validation = await engine.validateSubject(
        { title: query, domain: 'Test' },
        []
      );

      return NextResponse.json({
        success: true,
        test: 'validate',
        engine: type,
        query,
        result: validation,
      });
    }

    // Default: return engine info
    return NextResponse.json({
      success: true,
      engine: type,
      name: engine.name,
      version: engine.version,
      type: engine.type,
    });

  } catch (error: any) {
    console.error('[AI Engines] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Engine test failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
