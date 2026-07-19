// Response Compression & Optimization Utilities
// PHASE 5: SCALABILITÉ - Compression & CDN Optimization

import { NextResponse } from 'next/server';

// ============================================================================
// COMPRESSION CONFIGURATION
// ============================================================================

interface CompressionConfig {
  enableCompression: boolean;
  minSize: number; // Minimum size to compress (bytes)
  level: number; // Compression level (1-9)
}

const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enableCompression: true,
  minSize: 1024, // Don't compress responses < 1KB
  level: 6, // Balanced compression
};

// ============================================================================
// RESPONSE OPTIMIZATION HELPERS
// ============================================================================

/**
 * Create an optimized API response with proper headers
 */
export function optimizedResponse(
  data: unknown,
  status: number = 200,
  options?: {
    revalidate?: number;
    tags?: string[];
    headers?: Record<string, string>;
  }
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...options?.headers,
  };

  // Cache control based on status and options
  if (options?.revalidate) {
    headers['Cache-Control'] = `s-maxage=${options.revalidate}, stale-while-revalidate`;
  } else if (status >= 400) {
    headers['Cache-Control'] = 'no-store';
  } else {
    headers['Cache-Control'] = 'private, no-cache';
  }

  // Add cache tags for on-demand revalidation
  if (options?.tags && options.tags.length > 0) {
    headers['Cache-Tags'] = options.tags.join(',');
  }

  const body = JSON.stringify(data);

  return new NextResponse(body, {
    status,
    headers,
  });
}

/**
 * Create a streaming response for large datasets
 */
export function createStreamResponse(
  generator: AsyncGenerator<unknown>,
  status: number = 200
): NextResponse {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('[\n'));
        let first = true;
        
        for await (const item of generator) {
          if (!first) {
            controller.enqueue(encoder.encode(',\n'));
          }
          controller.enqueue(encoder.encode(JSON.stringify(item)));
          first = false;
        }
        
        controller.enqueue(encoder.encode('\n]'));
        controller.close();
      } catch (error) {
        console.error('[Stream] Error:', error);
        controller.error(error);
      }
    },
  });

  return new NextResponse(stream, {
    status,
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Create a paginated response with optimization metadata
 */
export function createOptimizedPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  meta?: Record<string, unknown>
): NextResponse {
  return optimizedResponse({
    data,
    pagination,
    _meta: {
      generatedAt: new Date().toISOString(),
      ...meta,
    },
  });
}

/**
 * Create a cached response with ETag support
 */
export function createCachedResponse(
  data: unknown,
  etag: string,
  maxAge: number = 300
): NextResponse {
  return optimizedResponse(data, 200, {
    revalidate: maxAge,
    headers: {
      'ETag': `"${etag}"`,
      'Vary': 'Accept-Encoding',
    },
  });
}

// ============================================================================
// RESPONSE SIZE UTILITIES
// ============================================================================

/**
 * Estimate JSON response size in bytes
 */
function estimateSize(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf-8');
}

/**
 * Check if response should be compressed
 */
function shouldCompress(size: number): boolean {
  return size >= DEFAULT_COMPRESSION_CONFIG.minSize;
}

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

/**
 * Standardized error response
 */
export interface ApiError {
  error: string;
  code: string;
  statusCode: number;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  code: string,
  statusCode: number = 400,
  details?: unknown
): NextResponse {
  const errorBody: ApiError = {
    error,
    code,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
  };

  return optimizedResponse(errorBody, statusCode);
}

// Pre-defined error creators
export const errors = {
  badRequest: (message: string = 'Bad request', details?: unknown) =>
    createErrorResponse(message, 'BAD_REQUEST', 400, details),
  
  unauthorized: (message: string = 'Unauthorized') =>
    createErrorResponse(message, 'UNAUTHORIZED', 401),
  
  forbidden: (message: string = 'Forbidden') =>
    createErrorResponse(message, 'FORBIDDEN', 403),
  
  notFound: (resource: string = 'Resource') =>
    createErrorResponse(`${resource} not found`, 'NOT_FOUND', 404),
  
  conflict: (message: string = 'Conflict') =>
    createErrorResponse(message, 'CONFLICT', 409),
  
  tooManyRequests: (retryAfter: number = 60) =>
    createErrorResponse('Too many requests', 'RATE_LIMITED', 429, { retryAfter }),
  
  internal: (message: string = 'Internal server error') =>
    createErrorResponse(message, 'INTERNAL_ERROR', 500),
  
  serviceUnavailable: (message: string = 'Service unavailable') =>
    createErrorResponse(message, 'SERVICE_UNAVAILABLE', 503),
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  optimizedResponse,
  createStreamResponse,
  createOptimizedPaginatedResponse,
  createCachedResponse,
  createErrorResponse,
  errors,
};
