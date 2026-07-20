// API Response helpers for consistent, performant responses
import { NextResponse } from 'next/server';

interface ApiResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

// Success response
export function successResponse(data: any, options?: ApiResponseOptions) {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  }, {
    status: options?.status || 200,
    headers: {
      'Cache-Control': 'no-cache',
      ...options?.headers,
    },
  });
}

// Error response
export function errorResponse(message: string, status: number = 500, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString(),
  }, { status });
}

// Paginated response
export function paginatedResponse(
  items: any[],
  total: number,
  page: number,
  pageSize: number,
  options?: ApiResponseOptions
) {
  return successResponse({
    items,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    },
  }, options);
}

// Cached response wrapper
export function cachedResponse(data: any, maxAge: number = 300) {
  return new NextResponse(JSON.stringify({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=60`,
      'Age': '0',
    },
  });
}
