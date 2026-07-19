// Security utilities: rate limiting, input sanitization, XSS prevention
import { RateLimiterMemory } from 'rate-limiter-flexible';
import crypto from 'crypto';

// Rate limiter instances
export const rateLimiters = {
  auth: new RateLimiterMemory({
    points: 5, // 5 attempts
    duration: 900, // 15 minutes
  }),
  api: new RateLimiterMemory({
    points: 100, // 100 requests
    duration: 60, // per minute
  }),
  upload: new RateLimiterMemory({
    points: 10,
    duration: 300, // 5 minutes
  }),
};

// Input sanitization - prevent XSS
export function sanitizeInput(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// Sanitize object recursively
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) : 
        typeof item === 'object' && item !== null ? sanitizeObject(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Simple password hashing (for demo - use bcrypt in production)
export async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password + process.env.PASSWORD_SALT || 'dpata-salt-2024').digest('hex');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

// Generate secure token
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// CSRF token validation
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  if (!token || !sessionToken) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken));
}
