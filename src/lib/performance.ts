// Performance Monitoring & Compression Middleware
// PHASE 5: SCALABILITÉ - Performance Tracking

import { NextRequest, NextResponse } from 'next/server';
import { advancedCaches, globalQueue } from './scalability';

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  ip?: string;
  userAgent?: string;
}

class PerformanceMonitor {
  private metrics: RequestMetrics[] = [];
  private maxMetrics: number = 1000;

  /**
   * Record a request metric
   */
  record(metric: Omit<RequestMetrics, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get aggregated statistics
   */
  getStats(timeWindow?: number): {
    totalRequests: number;
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    requestsPerSecond: number;
    endpoints: Record<string, { count: number; avgTime: number; errorRate: number }>;
  } {
    const now = Date.now();
    let relevantMetrics = this.metrics;

    // Filter by time window if specified
    if (timeWindow) {
      relevantMetrics = this.metrics.filter(m => now - m.timestamp <= timeWindow);
    }

    if (relevantMetrics.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        endpoints: {},
      };
    }

    // Sort by response time for percentiles
    const sortedByTime = [...relevantMetrics].sort((a, b) => a.responseTime - b.responseTime);
    
    // Calculate percentiles
    const percentile = (p: number): number => {
      const idx = Math.ceil(sortedByTime.length * p / 100) - 1;
      return sortedByTime[Math.max(0, idx)]?.responseTime ?? 0;
    };

    // Error rate
    const errors = relevantMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errors / relevantMetrics.length) * 100;

    // Average response time
    const avgResponseTime = relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0) / relevantMetrics.length;

    // Requests per second
    const timeSpan = Math.max(1, (now - relevantMetrics[0].timestamp) / 1000);
    const rps = relevantMetrics.length / timeSpan;

    // Per-endpoint stats
    const endpoints: Record<string, { count: number; totalTime: number; errors: number }> = {};
    for (const m of relevantMetrics) {
      if (!endpoints[m.path]) {
        endpoints[m.path] = { count: 0, totalTime: 0, errors: 0 };
      }
      endpoints[m.path].count++;
      endpoints[m.path].totalTime += m.responseTime;
      if (m.statusCode >= 400) endpoints[m.path].errors++;
    }

    const endpointStats: Record<string, { count: number; avgTime: number; errorRate: number }> = {};
    for (const [path, stats] of Object.entries(endpoints)) {
      endpointStats[path] = {
        count: stats.count,
        avgTime: Math.round(stats.totalTime / stats.count),
        errorRate: Math.round((stats.errors / stats.count) * 10000) / 100,
      };
    }

    return {
      totalRequests: relevantMetrics.length,
      avgResponseTime: Math.round(avgResponseTime),
      p50ResponseTime: percentile(50),
      p95ResponseTime: percentile(95),
      p99ResponseTime: percentile(99),
      errorRate: Math.round(errorRate * 100) / 100,
      requestsPerSecond: Math.round(rps * 100) / 100,
      endpoints: endpointStats,
    };
  }

  /**
   * Get recent slow requests
   */
  getSlowRequests(threshold: number = 1000, limit: number = 10): RequestMetrics[] {
    return this.metrics
      .filter(m => m.responseTime > threshold)
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, limit);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

// ============================================================================
// RESPONSE COMPRESSION HELPERS
// ============================================================================

/**
 * Compress large JSON responses
 * Note: Next.js handles compression automatically in production,
 * but we can optimize our responses
 */
export function createOptimizedResponse(
  data: any,
  status: number = 200,
  init?: ResponseInit
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': getCacheControl(status),
    'X-Response-Time': `${Date.now()}ms`,
    ...init?.headers as Record<string, string>,
  };

  // Stringify efficiently
  const body = JSON.stringify(data);

  return new NextResponse(body, {
    status,
    headers,
  });
}

/**
 * Determine cache control header based on status and data type
 */
function getCacheControl(status: number): string {
  if (status >= 500) return 'no-store';
  if (status >= 400) return 'no-cache, must-revalidate';
  
  // Cache successful responses briefly
  return 'private, max-age=30, stale-while-revalidate=60';
}

/**
 * Create paginated optimized response
 */
export function createPaginatedOptimizedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  extra?: Record<string, any>
): NextResponse {
  const totalPages = Math.ceil(total / limit);

  return createOptimizedResponse({
    data,
    pagination: {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    ...extra,
  });
}

// ============================================================================
// REQUEST TIMING WRAPPER
// ============================================================================

/**
 * Wrap an async function with timing
 */
export async function withTiming<T>(
  fn: () => Promise<T>,
  context: { method: string; path: string },
  req?: NextRequest
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    
    // Record success metric
    perfMonitor.record({
      method: context.method,
      path: context.path,
      statusCode: 200,
      responseTime: Date.now() - startTime,
      ip: req?.headers.get('x-forwarded-for') ?? req?.headers.get('x-real-ip') ?? undefined,
      userAgent: req?.headers.get('user-agent') ?? undefined,
    });

    return result;
  } catch (error: any) {
    // Record error metric
    const statusCode = error.status || error.statusCode || 500;
    perfMonitor.record({
      method: context.method,
      path: context.path,
      statusCode,
      responseTime: Date.now() - startTime,
      ip: req?.headers.get('x-forwarded-for') ?? req?.headers.get('x-real-ip') ?? undefined,
    });

    throw error;
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cache: ReturnType<import('./scalability').AdvancedCache['getStats']>;
  queue: ReturnType<import('./scalability').TaskQueue['getStats']>;
  performance: ReturnType<PerformanceMonitor['getStats']>;
}

let startTime = Date.now();

/**
 * Get comprehensive health check
 */
export function getHealthStatus(): HealthStatus {
  const memUsage = process.memoryUsage();
  const memUsed = memUsage.heapUsed / 1024 / 1024;
  const memTotal = memUsage.heapTotal / 1024 / 1024;

  return {
    status: memUsed / memTotal > 0.9 ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version ?? '2.0.0',
    memory: {
      used: Math.round(memUsed),
      total: Math.round(memTotal),
      percentage: Math.round((memUsed / memTotal) * 10000) / 100,
    },
    cache: advancedCaches.api.getStats(),
    queue: globalQueue.getStats(),
    performance: perfMonitor.getStats(300000), // Last 5 minutes
  };
}

// Export singleton
export default perfMonitor;
