// Route API: GET /api/auth/me — retourne l'utilisateur courant
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB } from '@/lib/store/db';

export async function GET() {
  const payload = await getCurrentUser();
  if (!payload) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const db = await loadDB();
  const user = db.users.find(u => u.id === payload.sub);
  if (!user || !user.isActive) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      matricule: user.matricule,
      role: user.role,
      facultyId: user.facultyId,
      departmentId: user.departmentId,
      promotionId: user.promotionId,
    },
  });
}
