// Route API: POST /api/auth/login
import { NextRequest, NextResponse } from 'next/server';
import { loadDB, audit } from '@/lib/store/db';
import { signToken, setAuthCookie } from '@/lib/auth/jwt';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const db = await loadDB();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
    if (!user || user.passwordHash !== password) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
    }
    const token = await signToken(user);
    await setAuthCookie(token);
    await audit(user.id, `${user.firstName} ${user.lastName}`, 'LOGIN', 'User', user.id, undefined, req.headers.get('x-forwarded-for') || undefined);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erreur serveur', message: e.message }, { status: 500 });
  }
}
