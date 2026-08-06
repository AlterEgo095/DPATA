// lib/api/response/api-response.ts — P1 FIX: jsonError signature
//
// BUG: Callers like /api/keys/route.ts invoke jsonError as:
//   jsonError(ErrorCodes.INVALID_PARAMETER, 'msg', { hint: '...' })
// expecting the 3rd arg to be an options object. But the old signature was:
//   jsonError(code, message, status?: number, details?: any)
// so { hint: '...' } became `status` -> NextResponse.json(body, { status: {...} })
// -> RangeError: The status provided (0) must be 101 or in [200, 599].
//
// FIX: Accept either form:
//   jsonError(code, message, options?: { status?, details? })  // preferred
//   jsonError(code, message, status?: number, details?: any)   // legacy
// Backward compatible with all existing callers.
//
// FULL FILE (drop-in replacement).

import { randomUUID } from 'crypto'

// ============================================================
// Types
// ============================================================

export interface ApiError {
  code: string
  message: string
  details?: any
}

export interface PaginationMeta {
  page: number
  perPage: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface RateLimitMeta {
  remaining: number
  reset: number
  limit: number
}

export interface ApiResponseMeta {
  requestId: string
  timestamp: string
  version: string
  pagination?: PaginationMeta
  rateLimit?: RateLimitMeta
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  meta: ApiResponseMeta
}

// ============================================================
// Constants
// ============================================================

const API_VERSION = '1.0.0'

export const ErrorCodes = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  API_KEY_REVOKED: 'API_KEY_REVOKED',
  IP_NOT_ALLOWED: 'IP_NOT_ALLOWED',
  MISSING_API_KEY: 'MISSING_API_KEY',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_FORMAT: 'INVALID_FORMAT',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
} as const

export type ErrorCode = keyof typeof ErrorCodes

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
} as const

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
}

// ============================================================
// Helpers
// ============================================================

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${randomUUID().substring(0, 8)}`
}

function buildMeta(options?: { pagination?: PaginationMeta; rateLimit?: RateLimitMeta }): ApiResponseMeta {
  return {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    ...options,
  }
}

function getStatusForError(code: string, customStatus?: number): number {
  if (typeof customStatus === 'number' && customStatus > 0) return customStatus
  return ERROR_STATUS_MAP[code] || HttpStatus.INTERNAL_SERVER_ERROR
}

// ============================================================
// Builders
// ============================================================

export function apiSuccess<T>(
  data: T,
  options?: { status?: number; pagination?: PaginationMeta; rateLimit?: RateLimitMeta }
): { response: ApiResponse<T>; status: number } {
  return {
    response: {
      success: true,
      data,
      meta: buildMeta({ pagination: options?.pagination, rateLimit: options?.rateLimit }),
    },
    status: options?.status || HttpStatus.OK,
  }
}

export function apiPaginated<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
  options?: { rateLimit?: RateLimitMeta }
): { response: ApiResponse<T[]>; status: number } {
  const totalPages = Math.ceil(total / perPage)
  const pagination: PaginationMeta = {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page * perPage < total,
    hasPrev: page > 1,
  }
  return {
    response: {
      success: true,
      data: items,
      meta: buildMeta({ pagination, rateLimit: options?.rateLimit }),
    },
    status: HttpStatus.OK,
  }
}

export function apiError(
  code: string,
  message: string,
  options?: { details?: any; status?: number; rateLimit?: RateLimitMeta }
): { response: ApiResponse<never>; status: number } {
  const status = getStatusForError(code, options?.status)
  return {
    response: {
      success: false,
      error: { code, message, details: options?.details },
      meta: buildMeta({ rateLimit: options?.rateLimit }),
    },
    status,
  }
}

export function apiNotFound(resource: string = 'Ressource', id?: string): { response: ApiResponse<never>; status: number } {
  return apiError(ErrorCodes.NOT_FOUND, `${resource}${id ? ` (${id})` : ''} non trouvée(e).`, {
    details: id ? { id } : undefined,
  })
}

export function apiValidationError(message: string, details?: any): { response: ApiResponse<never>; status: number } {
  return apiError(ErrorCodes.VALIDATION_ERROR, message, { details })
}

export function apiCreated<T>(data: T, options?: { rateLimit?: RateLimitMeta }): { response: ApiResponse<T>; status: number } {
  return apiSuccess(data, { status: HttpStatus.CREATED, ...options })
}

export function apiNoContent(options?: { rateLimit?: RateLimitMeta }): { response: ApiResponse<null>; status: number } {
  return {
    response: { success: true, data: null, meta: buildMeta({ rateLimit: options?.rateLimit }) },
    status: HttpStatus.NO_CONTENT,
  }
}

// ============================================================
// Next.js Response helpers
// ============================================================

import { NextResponse } from 'next/server'

export function toNextResponse<T>(
  result: { response: ApiResponse<T>; status: number },
  additionalHeaders?: Record<string, string>
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Version': API_VERSION,
    'X-Request-ID': result.response.meta.requestId,
    ...additionalHeaders,
  }

  if (result.response.meta.rateLimit) {
    headers['X-RateLimit-Limit'] = String(result.response.meta.rateLimit.limit)
    headers['X-RateLimit-Remaining'] = String(result.response.meta.rateLimit.remaining)
    headers['X-RateLimit-Reset'] = String(result.response.meta.rateLimit.reset)
  }

  // Defensive: ensure status is always a valid HTTP code (200-599 or 101).
  const safeStatus =
    typeof result.status === 'number' && result.status >= 200 && result.status <= 599
      ? result.status
      : HttpStatus.INTERNAL_SERVER_ERROR

  return NextResponse.json(result.response, { status: safeStatus, headers })
}

export function jsonSuccess<T>(data: T, status?: number): NextResponse {
  return toNextResponse(apiSuccess(data, { status }))
}

/**
 * P1 FIX: Accept either form:
 *   jsonError(code, message, options?: { status?, details? })   // preferred
 *   jsonError(code, message, status?: number, details?: any)    // legacy
 */
export function jsonError(
  code: string,
  message: string,
  statusOrOptions?: number | { status?: number; details?: any },
  details?: any
): NextResponse {
  const opts =
    typeof statusOrOptions === 'number'
      ? { status: statusOrOptions, details }
      : statusOrOptions || {}
  return toNextResponse(apiError(code, message, opts))
}

export function jsonNotFound(resource?: string, id?: string): NextResponse {
  return toNextResponse(apiNotFound(resource, id))
}

export function jsonPaginated<T>(items: T[], total: number, page: number, perPage: number): NextResponse {
  return toNextResponse(apiPaginated(items, total, page, perPage))
}
