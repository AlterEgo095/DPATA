// POST /api/detect-ai
// Détecte si un texte a été généré par IA (ChatGPT, Claude, etc.)
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { detectAIGenerated } from '@/lib/ia/ai_detector';
import { z } from 'zod';

const Schema = z.object({
  text: z.string().min(50, 'Le texte doit faire au moins 50 caractères'),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const result = detectAIGenerated(parsed.data.text);
  return NextResponse.json(result);
}
