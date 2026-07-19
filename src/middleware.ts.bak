import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters } from '@/lib/security';
import { logger } from '@/lib/logger';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Apply rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const path = request.nextUrl.pathname;
    
    // Auth routes have stricter limits
    if (path.startsWith('/api/auth/')) {
      try {
        await rateLimiters.auth.consume(ip);
      } catch {
        logger.warn('Rate limit exceeded for auth', { ip });
        return NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
          { status: 429 }
        );
      }
    }
    
    // General API rate limiting
    try {
      await rateLimiters.api.consume(ip);
    } catch {
      logger.warn('Rate limit exceeded for API', { ip, path });
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez ralentir.' },
        { status: 429 }
      );
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
  ],
};
