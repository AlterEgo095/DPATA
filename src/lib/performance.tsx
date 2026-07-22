// Performance monitoring and optimization utilities

import React from 'react';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000;

  // Measure execution time of an async function
  async measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.record(name, performance.now() - start, { ...metadata, success: true });
      return result;
    } catch (error) {
      this.record(name, performance.now() - start, { ...metadata, success: false, error: String(error) });
      throw error;
    }
  }

  // Measure sync function
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const start = performance.now();
    try {
      const result = fn();
      this.record(name, performance.now() - start, { ...metadata, success: true });
      return result;
    } catch (error) {
      this.record(name, performance.now() - start, { ...metadata, success: false, error: String(error) });
      throw error;
    }
  }

  // Record a metric
  record(name: string, duration: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  // Get metrics filtered by name pattern
  getMetrics(pattern?: string): PerformanceMetric[] {
    if (!pattern) return [...this.metrics];
    const regex = new RegExp(pattern);
    return this.metrics.filter(m => regex.test(m.name));
  }

  // Get statistics for a metric name
  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const matching = this.metrics.filter(m => m.name === name);
    if (matching.length === 0) return null;

    const durations = matching.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: matching.length,
      avg: sum / matching.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
    };
  }

  // Get all metric names
  getMetricNames(): string[] {
    return [...new Set(this.metrics.map(m => m.name))];
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
  }
}

// Global instance
export const perfMonitor = new PerformanceMonitor();

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Memoize with TTL
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  ttl: number = 60000
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, timestamp: Date.now() });

    // Clean up old entries periodically
    if (cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp > ttl * 2) {
          cache.delete(k);
        }
      }
    }

    return result;
  }) as T;
}

// Lazy loader for heavy components
export function createLazyLoader<T>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  return {
    Component: React.lazy(importFn),
    fallback: fallback || (() => <div className="animate-pulse bg-slate-100 rounded-lg h-48" />),
  };
}


// Health status function for /api/health endpoint
export function getHealthStatus() {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    nodeVersion: process.version,
    platform: process.platform,
  };
}

