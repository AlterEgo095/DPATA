// POST /api/detect-ai
// Détecte si un texte a été généré par IA (ChatGPT, Claude, etc.)
// 🔒 SÉCURITÉ: Validation Zod + gestion d'erreurs complète
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { detectAIGenerated } from '@/lib/ia/ai_detector';
import { sanitizeError, getSecurityHeaders } from '@/lib/security';
import { z } from 'zod';

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
    
    return NextResponse.json(result, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
