// Health Check & Performance Monitoring API
// PHASE 5: SCALABILITÉ - Observability

import { NextRequest, NextResponse } from 'next/server';
import { getHealthStatus, perfMonitor } from '@/lib/performance';

/**
 * GET /api/health - Health check endpoint
 * Returns system status, memory usage, cache stats, and performance metrics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authorization (optional for health)
    const authHeader = request.headers.get('authorization');
    const isDetailed = authHeader?.startsWith('Bearer ');
    
    const health = getHealthStatus();
    
    // Basic health check (no auth required)
    if (!isDetailed) {
      return NextResponse.json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
      }, { 
        status: health.status === 'healthy' ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache',
          'X-Response-Time': `${Date.now() - startTime}ms`,
        }
      });
    }

    // Detailed health check (requires auth)
    return NextResponse.json(health, {
      status: health.status === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Response-Time': `${Date.now() - startTime}ms`,
      },
    });

  } catch (error) {
    console.error('[Health] Error:', error);
    
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
