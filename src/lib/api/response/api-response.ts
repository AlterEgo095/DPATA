// Standardized API Response Formatter for PlagiatIA Public API
// Ensures consistent response format across all endpoints

import { randomUUID } from 'crypto';
import { RateLimitResult } from '../middleware/rate-limiter';

// ============================================================
// Types
// ============================================================

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface RateLimitMeta {
  remaining: number;
  reset: number;
  limit: number;
}

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  version: string;
  pagination?: PaginationMeta;
  rateLimit?: RateLimitMeta;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ApiResponseMeta;
}

// ============================================================
// Constants
// ============================================================

const API_VERSION = '1.0.0';

// Standard error codes
export const ErrorCodes = {
  // Authentication errors (4xx)
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  API_KEY_REVOKED: 'API_KEY_REVOKED',
  IP_NOT_ALLOWED: 'IP_NOT_ALLOWED',
  MISSING_API_KEY: 'MISSING_API_KEY',
  
  // Validation errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Resource errors (4xx)
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Rate limiting (4xx)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

// HTTP Status codes mapping
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error code to status mapping
const ERROR_STATUS_MAP: Record<string, number> = {
  [ErrorCodes.INVALID_API_KEY]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.API_KEY_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.API_KEY_REVOKED]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.IP_NOT_ALLOWED]: HttpStatus.FORBIDDEN,
  [ErrorCodes.MISSING_API_KEY]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.INVALID_PARAMETER]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.MISSING_PARAMETER]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.INVALID_FORMAT]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCodes.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCodes.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCodes.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCodes.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCodes.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.TIMEOUT]: HttpStatus.SERVICE_UNAVAILABLE,
};

// ============================================================
// Helper functions
// ============================================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${randomUUID().substring(0, 8)}`;
}

/**
 * Build base metadata object
 */
function buildMeta(options?: {
  pagination?: PaginationMeta;
  rateLimit?: RateLimitMeta;
}): ApiResponseMeta {
  return {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    ...options,
  };
}

/**
 * Get HTTP status for an error code
 */
function getStatusForError(code: string, customStatus?: number): number {
  if (customStatus) return customStatus;
  return ERROR_STATUS_MAP[code] || HttpStatus.INTERNAL_SERVER_ERROR;
}

// ============================================================
// Response builders
// ============================================================

/**
 * Create a successful response
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    pagination?: PaginationMeta;
    rateLimit?: RateLimitMeta;
  }
): { response: ApiResponse<T>; status: number } {
  return {
    response: {
      success: true,
      data,
      meta: buildMeta({
        pagination: options?.pagination,
        rateLimit: options?.rateLimit,
      }),
    },
    status: options?.status || HttpStatus.OK,
  };
}

/**
 * Create a paginated response
 */
export function apiPaginated<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
  options?: {
    rateLimit?: RateLimitMeta;
  }
): { response: ApiResponse<T[]>; status: number } {
  const totalPages = Math.ceil(total / perPage);
  const pagination: PaginationMeta = {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page * perPage < total,
    hasPrev: page > 1,
  };

  return {
    response: {
      success: true,
      data: items,
      meta: buildMeta({
        pagination,
        rateLimit: options?.rateLimit,
      }),
    },
    status: HttpStatus.OK,
  };
}

/**
 * Create an error response
 */
export function apiError(
  code: string,
  message: string,
  options?: {
    details?: any;
    status?: number;
    rateLimit?: RateLimitMeta;
  }
): { response: ApiResponse<never>; status: number } {
  const status = getStatusForError(code, options?.status);
  
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details: options?.details,
      },
      meta: buildMeta({
        rateLimit: options?.rateLimit,
      }),
    },
    status,
  };
}

/**
 * Create a "not found" error response
 */
export function apiNotFound(
  resource: string = 'Ressource',
  id?: string
): { response: ApiResponse<never>; status: number } {
  return apiError(ErrorCodes.NOT_FOUND, `${resource}${id ? ` (${id})` : ''} non trouvée(e).`, {
    details: id ? { id } : undefined,
  });
}

/**
 * Create a validation error response
 */
export function apiValidationError(
  message: string,
  details?: any
): { response: ApiResponse<never>; status: number } {
  return apiError(ErrorCodes.VALIDATION_ERROR, message, { details });
}

/**
 * Create a "created" response
 */
export function apiCreated<T>(
  data: T,
  options?: {
    rateLimit?: RateLimitMeta;
  }
): { response: ApiResponse<T>; status: number } {
  return apiSuccess(data, { 
    status: HttpStatus.CREATED, 
    ...options 
  });
}

/**
 * Create a "no content" response (for delete operations)
 */
export function apiNoContent(
  options?: {
    rateLimit?: RateLimitMeta;
  }
): { response: ApiResponse<null>; status: number } {
  return {
    response: {
      success: true,
      data: null,
      meta: buildMeta({ rateLimit: options?.rateLimit }),
    },
    status: HttpStatus.NO_CONTENT,
  };
}

// ============================================================
// Next.js Response helpers
// ============================================================

import { NextResponse } from 'next/server';

/**
 * Convert API response to NextResponse with proper headers
 */
export function toNextResponse<T>(
  result: { response: ApiResponse<T>; status: number },
  additionalHeaders?: Record<string, string>
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Version': API_VERSION,
    'X-Request-ID': result.response.meta.requestId,
    ...additionalHeaders,
  };

  // Add rate limit headers if present
  if (result.response.meta.rateLimit) {
    headers['X-RateLimit-Limit'] = String(result.response.meta.rateLimit.limit);
    headers['X-RateLimit-Remaining'] = String(result.response.meta.rateLimit.remaining);
    headers['X-RateLimit-Reset'] = String(result.response.meta.rateLimit.reset);
  }

  return NextResponse.json(result.response, {
    status: result.status,
    headers,
  });
}

/**
 * Quick success response helper
 */
export function jsonSuccess<T>(data: T, status?: number): NextResponse {
  return toNextResponse(apiSuccess(data, { status }));
}

/**
 * Quick error response helper
 */
export function jsonError(code: string, message: string, status?: number, details?: any): NextResponse {
  return toNextResponse(apiError(code, message, { status, details }));
}

/**
 * Quick not found response helper
 */
export function jsonNotFound(resource?: string, id?: string): NextResponse {
  return toNextResponse(apiNotFound(resource, id));
}

/**
 * Quick paginated response helper
 */
export function jsonPaginated<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number
): NextResponse {
  return toNextResponse(apiPaginated(items, total, page, perPage));
}
