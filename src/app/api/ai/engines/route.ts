// AI Engine Status & Management API
// PHASE 6: IA AVANCÉE - Engine Monitoring
//
// P4-D D6: Added audit() call on POST (ai.engine_test) — captures IP + UA +
// test type + result summary. The endpoint is currently anonymous (no auth
// check) — P4-A is responsible for adding auth. The audit log records the
// actor as undefined when no session is present.

import { NextRequest, NextResponse } from 'next/server';
import { getAllEnginesStatus, getAvailableEngines, getEngine } from '@/lib/ia/engine-factory';
import { audit } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getRequestMeta } from '@/lib/request-meta';

/**
 * GET /api/ai/engines - Get all available AI engines and their status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { engineType, query, testType } = body;

    const type = engineType || 'HYBRID';
    const engine = getEngine(type as any);
    
    // Initialize the engine
    await engine.initialize();

    if (testType === 'health') {
      const health = await engine.healthCheck();

      // ---------------------------------------------------------------
      // P4-D D6: audit log entry — ai.engine_test (health)
      // ---------------------------------------------------------------
      try {
        const currentUser = await getCurrentUser();
        const { ip, userAgent } = getRequestMeta(request);
        await audit(
          currentUser?.sub,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
          'AI_ENGINE_TEST',
          'AIEngine',
          undefined,
          { engine: type, testType: 'health', result: health },
          ip,
          { userAgent, method: 'POST', path: '/api/ai/engines' }
        );
      } catch (auditErr) {
        console.error('[ai/engines POST] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
      }

      return NextResponse.json({
        success: true,
        test: 'health',
        engine: type,
        result: health,
      });
    }

    if (testType === 'analyze' && query) {
      const sampleCorpus = [
        { id: '1', text: 'Les robots dans l\'industrie automobile moderne' },
        { id: '2', text: 'L\'intelligence artificielle et ses applications' },
        { id: '3', text: 'La biométrie et la sécurité des systèmes informatiques' },
      ];

      const result = await engine.analyze(query, sampleCorpus, { threshold: 0.1 });

      // ---------------------------------------------------------------
      // P4-D D6: audit log entry — ai.engine_test (analyze)
      // ---------------------------------------------------------------
      try {
        const currentUser = await getCurrentUser();
        const { ip, userAgent } = getRequestMeta(request);
        await audit(
          currentUser?.sub,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
          'AI_ENGINE_TEST',
          'AIEngine',
          undefined,
          {
            engine: type,
            testType: 'analyze',
            queryLength: String(query).length,
            overallScore: result.overallScore,
            matchesCount: result.matches.length,
            processingTimeMs: result.processingTimeMs,
            engineUsed: result.engineUsed,
          },
          ip,
          { userAgent, method: 'POST', path: '/api/ai/engines' }
        );
      } catch (auditErr) {
        console.error('[ai/engines POST] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
      }
      
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

      // ---------------------------------------------------------------
      // P4-D D6: audit log entry — ai.engine_test (validate)
      // ---------------------------------------------------------------
      try {
        const currentUser = await getCurrentUser();
        const { ip, userAgent } = getRequestMeta(request);
        await audit(
          currentUser?.sub,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
          'AI_ENGINE_TEST',
          'AIEngine',
          undefined,
          {
            engine: type,
            testType: 'validate',
            queryLength: String(query).length,
            isOriginal: (validation as any)?.isOriginal,
            similarityScore: (validation as any)?.similarityScore,
          },
          ip,
          { userAgent, method: 'POST', path: '/api/ai/engines' }
        );
      } catch (auditErr) {
        console.error('[ai/engines POST] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
      }

      return NextResponse.json({
        success: true,
        test: 'validate',
        engine: type,
        query,
        result: validation,
      });
    }

    // Default: return engine info — also audit.
    try {
      const currentUser = await getCurrentUser();
      const { ip, userAgent } = getRequestMeta(request);
      await audit(
        currentUser?.sub,
        currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
        'AI_ENGINE_TEST',
        'AIEngine',
        undefined,
        { engine: type, testType: testType || 'info', engineName: engine.name, engineVersion: engine.version },
        ip,
        { userAgent, method: 'POST', path: '/api/ai/engines' }
      );
    } catch {}

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
