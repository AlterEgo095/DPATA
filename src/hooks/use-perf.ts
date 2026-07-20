'use client';

import { useEffect, useRef, useCallback } from 'react';

interface RenderMetrics {
  mountTime: number;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
}

export function usePerf(componentName: string) {
  const renderCount = useRef(0);
  const mountTime = useRef(performance.now());
  const lastRenderStart = useRef(performance.now());
  const renderTimes = useRef<number[]>([]);

  useEffect(() => {
    renderCount.current++;
    const now = performance.now();
    const duration = now - lastRenderStart.current;
    renderTimes.current.push(duration);
    
    // Keep only last 100 renders
    if (renderTimes.current.length > 100) {
      renderTimes.current = renderTimes.current.slice(-100);
    }

    // Log slow renders (> 100ms)
    if (duration > 100) {
      console.warn(`[PERF] Slow render in ${componentName}: ${duration.toFixed(2)}ms`);
    }

    lastRenderStart.current = now;
  });

  const getMetrics = useCallback((): RenderMetrics => {
    const times = renderTimes.current;
    return {
      mountTime: performance.now() - mountTime.current,
      renderCount: renderCount.current,
      lastRenderTime: times[times.length - 1] || 0,
      averageRenderTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    };
  }, []);

  return { getMetrics };
}
