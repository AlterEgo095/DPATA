// /api/admin/ai — AI monitoring and management API
// GET /api/admin/ai — Get AI stats, logs, model status
// POST /api/admin/ai/test — Test a specific model
// POST /api/admin/ai/test-prompt — Test with a custom prompt
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  chatCompletion, getAICallLogs, getAICallStats, AVAILABLE_MODELS,
  type AICallLog,
} from '@/lib/ia/zai-client';
import { getAllEnginesStatus } from '@/lib/ia/engine-factory';

// GET — AI stats and logs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN')) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'stats';
  if (view === 'logs') {
    const logs = getAICallLogs();
    return NextResponse.json({ logs, total: logs.length });
  }
  if (view === 'models') {
    return NextResponse.json({ models: AVAILABLE_MODELS });
  }
  if (view === 'engines') {
    const engines = await getAllEnginesStatus();
    return NextResponse.json({ engines });
  }
  // Default: stats
  const stats = getAICallStats();
  const engines = await getAllEnginesStatus();
  return NextResponse.json({
    stats,
    models: AVAILABLE_MODELS,
    engines,
    recentLogs: getAICallLogs().slice(-20),
  });
}

// POST /api/admin/ai/test — Test a model
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Accès réservé au super administrateur' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const model = body.model || 'glm-4.5-flash';
    const prompt = body.prompt || 'Réponds OK en français.';
    const start = Date.now();
    const response = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { model, maxTokens: 256, function: 'admin_test' }
    );
    const elapsed = Date.now() - start;
    return NextResponse.json({
      success: true,
      model,
      response,
      responseTimeMs: elapsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
