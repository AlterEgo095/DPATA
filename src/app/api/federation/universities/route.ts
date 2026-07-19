// GET /api/federation/universities — liste des universités partenaires
// POST /api/federation/universities — ajouter une université
// DELETE /api/federation/universities?id=xxx — supprimer
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getUniversities, addUniversity, removeUniversity } from '@/lib/federation/store';
import { z } from 'zod';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const unis = await getUniversities();
  return NextResponse.json({ universities: unis });
}

const AddSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(3).max(200),
  apiUrl: z.string().url(),
  apiKey: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }
  const uni = await addUniversity(parsed.data);
  return NextResponse.json({ university: uni }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });
  await removeUniversity(id);
  return NextResponse.json({ success: true });
}
