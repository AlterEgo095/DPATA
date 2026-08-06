// POST /api/detect-ai
// Détecte si un texte a été généré par IA (ChatGPT, Claude, etc.)
// 🔒 SÉCURITÉ: Validation Zod + gestion d'erreurs complète
//
// P4-D D6: Added audit() call (ai.detect) — captures IP + UA + result
// metadata (score, verdict). Text body is NOT logged (PII / large payload).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { detectAIGenerated } from '@/lib/ia/ai_detector';
import { sanitizeError, getSecurityHeaders } from '@/lib/security';
import { z } from 'zod';
import { audit } from '@/lib/store/db';
import { getRequestMeta } from '@/lib/request-meta';

const Schema = z.object({
  text: z.string().min(50, 'Le texte doit faire au moins 50 caractères'),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const result = detectAIGenerated(parsed.data.text);

    // ---------------------------------------------------------------
    // P4-D D6: audit log entry — ai.detect
    // ---------------------------------------------------------------
    // Note: we deliberately do NOT log the text body (could be PII or
    // hundreds of KB). We log only the verdict + scores.
    try {
      const { ip, userAgent } = getRequestMeta(req);
      await audit(
        user.sub,
        `${user.firstName} ${user.lastName}`,
        'AI_DETECT',
        'AIDetection',
        undefined,
        {
          textLength: parsed.data.text.length,
          textPreview: parsed.data.text.slice(0, 100),
          aiProbability: (result as any).aiProbability ?? (result as any).score ?? null,
          verdict: (result as any).verdict || (result as any).label || null,
        },
        ip,
        { userAgent, method: 'POST', path: '/api/detect-ai' }
      );
    } catch (auditErr) {
      console.error('[detect-ai] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
    }
    
    return NextResponse.json(result, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
