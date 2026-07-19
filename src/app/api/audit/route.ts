// GET /api/audit — Journal d'audit
import { NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const db = await loadDB();
  return NextResponse.json({ logs: db.auditLogs.slice(0, 200) });
}
