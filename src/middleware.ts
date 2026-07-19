// Security Middleware for DPATA - Edge-compatible version
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting (Edge-compatible)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

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
    const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown';
    const path = request.nextUrl.pathname;
    
    // Auth routes have stricter limits (5 requests per 15 minutes)
    if (path.startsWith('/api/auth/')) {
      if (!checkRateLimit(`auth:${ip}`, 5, 900000)) {
        return NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
          { status: 429 }
        );
      }
    }
    
    // General API rate limiting (100 requests per minute)
    if (!checkRateLimit(`api:${ip}`, 100, 60000)) {
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
