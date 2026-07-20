// Scalability Utilities: Advanced Cache, Queue System, Connection Pooling
// PHASE 5: SCALABILITÉ - Performance & Haute Disponibilité

import { rateLimiters } from './security';

// ============================================================================
// ADVANCED LRU CACHE (Redis-like)
// ============================================================================

interface LRUCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;      // Max entries
  defaultTTL: number;   // Default TTL in ms
  cleanupInterval: number; // Cleanup cycle in ms
  enableStats: boolean;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 1000,
  defaultTTL: 300000, // 5 minutes
  cleanupInterval: 60000, // 1 minute
  enableStats: true,
};

/**
 * Advanced LRU Cache with:
 * - Automatic eviction (LRU policy)
 * - TTL-based expiration
 * - Memory-efficient cleanup
 * - Statistics tracking
 * - Pattern-based invalidation
 */
export class AdvancedCache<T = any> {
  private cache: Map<string, LRUCacheEntry<T>> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    invalidations: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Get item from cache (updates access time for LRU)
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update LRU metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.data;
  }

  /**
   * Set item in cache with optional custom TTL
   */
  set(key: string, data: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) this.stats.invalidations++;
    return existed;
  }

  /**
   * Invalidate by pattern (regex)
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
        this.stats.invalidations++;
      }
    }
    
    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
  }

  /**
   * Evict Least Recently Used item
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : 'N/A',
      evictions: this.stats.evictions,
      invalidations: this.stats.invalidations,
      memoryUsage: `${(JSON.stringify([...this.cache.entries()]).length / 1024).toFixed(2)} KB`,
    };
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// ============================================================================
// TASK QUEUE SYSTEM (Background Job Processing)
// ============================================================================

type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface Task<T = any> {
  id: string;
  type: string;
  payload: T;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  retries: number;
  maxRetries: number;
}

interface TaskHandler<T = any, R = any> {
  (payload: T): Promise<R>;
}

/**
 * In-memory task queue for background processing
 * Supports: OCR, AI Analysis, PDF Generation, etc.
 */
export class TaskQueue {
  private queue: Map<string, Task> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private concurrency: number;
  private processing: Set<string> = new Set();
  private isRunning: boolean = false;
  private processTimer: NodeJS.Timeout | null = null;
  
  // Statistics
  private stats = {
    processed: 0,
    failed: 0,
    avgProcessingTime: 0,
  };

  constructor(concurrency: number = 3) {
    this.concurrency = concurrency;
  }

  /**
   * Register a handler for a task type
   */
  registerHandler(type: string, handler: TaskHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Add a new task to the queue
   */
  async addTask<T, R>(type: string, payload: T, options?: { maxRetries?: number }): Promise<string> {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task: Task = {
      id,
      type,
      payload,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
    };

    this.queue.set(id, task);
    this.processQueue();

    return id;
  }

  /**
   * Get task status and result
   */
  getTask(id: string): Task | undefined {
    return this.queue.get(id);
  }

  /**
   * Wait for task completion (polling with promise)
   */
  async waitForTask<R>(id: string, timeout: number = 60000): Promise<{ success: boolean; result?: R; error?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const task = this.queue.get(id);
      
      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      if (task.status === 'completed') {
        return { success: true, result: task.result as R };
      }

      if (task.status === 'failed') {
        return { success: false, error: task.error };
      }

      // Wait 100ms before polling again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { success: false, error: 'Timeout waiting for task' };
  }

  /**
   * Process the queue (respecting concurrency limit)
   */
  private async processQueue(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    while (true) {
      // Find pending tasks
      const pendingTasks = [...this.queue.values()]
        .filter(t => t.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt);

      if (pendingTasks.length === 0) {
        break;
      }

      // Check concurrency
      if (this.processing.size >= this.concurrency) {
        break;
      }

      // Process next task
      const task = pendingTasks[0];
      this.processTask(task);
    }

    this.isRunning = false;
  }

  /**
   * Process a single task
   */
  private async processTask(task: Task): Promise<void> {
    const handler = this.handlers.get(task.type);
    
    if (!handler) {
      task.status = 'failed';
      task.error = `No handler registered for type: ${task.type}`;
      this.stats.failed++;
      return;
    }

    task.status = 'processing';
    task.startedAt = Date.now();
    this.processing.add(task.id);

    try {
      const result = await handler(task.payload);
      task.status = 'completed';
      task.result = result;
      task.completedAt = Date.now();
      this.stats.processed++;

      // Update average processing time
      const processingTime = task.completedAt - task.startedAt!;
      this.stats.avgProcessingTime = (
        (this.stats.avgProcessingTime * (this.stats.processed - 1) + processingTime) /
        this.stats.processed
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Retry logic
      if (task.retries < task.maxRetries) {
        task.retries++;
        task.status = 'pending';
        console.log(`[Queue] Retrying task ${task.id} (${task.retries}/${task.maxRetries})`);
        
        // Exponential backoff
        setTimeout(() => this.processQueue(), Math.pow(2, task.retries) * 1000);
      } else {
        task.status = 'failed';
        task.error = errorMessage;
        task.completedAt = Date.now();
        this.stats.failed++;
        console.error(`[Queue] Task ${task.id} failed: ${errorMessage}`);
      }
    } finally {
      this.processing.delete(task.id);
      // Continue processing
      this.processQueue();
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const tasks = [...this.queue.values()];
    return {
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      totalProcessed: this.stats.processed,
      totalFailed: this.stats.failed,
      avgProcessingTime: `${Math.round(this.stats.avgProcessingTime)}ms`,
    };
  }

  /**
   * Clear completed/failed tasks older than specified age
   */
  cleanup(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, task] of this.queue.entries()) {
      if ((task.status === 'completed' || task.status === 'failed') &&
          now - (task.completedAt ?? task.createdAt) > maxAge) {
        this.queue.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ============================================================================
// CONNECTION POOL (Database Simulation)
// ============================================================================

interface PoolEntry<T> {
  resource: T;
  inUse: boolean;
  createdAt: number;
  lastUsed: number;
}

interface PoolConfig {
  min: number;
  max: number;
  acquireTimeout: number;
  idleTimeout: number;
  validationInterval: number;
}

/**
 * Generic connection pool for database or external service connections
 */
export class ConnectionPool<T> {
  private pool: PoolEntry<T>[] = [];
  private config: PoolConfig;
  private createResource: () => T | Promise<T>;
  private destroyResource: (resource: T) => void | Promise<void>;
  private validateResource?: (resource: T) => boolean | Promise<boolean>;

  constructor(
    createResource: () => T | Promise<T>,
    destroyResource: (resource: T) => void | Promise<void>,
    config?: Partial<PoolConfig>
  ) {
    this.config = {
      min: 2,
      max: 10,
      acquireTimeout: 5000,
      idleTimeout: 30000,
      validationInterval: 30000,
      ...config,
    };
    this.createResource = createResource;
    this.destroyResource = destroyResource;

    // Initialize minimum connections
    this.initializePool();
  }

  /**
   * Initialize pool with minimum connections
   */
  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.config.min; i++) {
      const resource = await this.createResource();
      this.pool.push({
        resource,
        inUse: false,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      });
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(timeout?: number): Promise<T> {
    const acquireTimeout = timeout ?? this.config.acquireTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < acquireTimeout) {
      // Find available connection
      const available = this.pool.find(p => !p.inUse);
      
      if (available) {
        // Validate if validator exists
        if (this.validateResource) {
          const isValid = await this.validateResource(available.resource);
          if (!isValid) {
            // Remove invalid connection and create new one
            await this.destroyResource(available.resource);
            available.resource = await this.createResource();
            available.createdAt = Date.now();
          }
        }

        available.inUse = true;
        available.lastUsed = Date.now();
        return available.resource;
      }

      // Check if we can create new connection
      if (this.pool.length < this.config.max) {
        const resource = await this.createResource();
        const entry: PoolEntry<T> = {
          resource,
          inUse: true,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };
        this.pool.push(entry);
        return resource;
      }

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error('Connection pool exhausted');
  }

  /**
   * Release a connection back to the pool
   */
  release(resource: T): void {
    const entry = this.pool.find(p => p.resource === resource);
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.pool.length,
      inUse: this.pool.filter(p => p.inUse).length,
      available: this.pool.filter(p => !p.inUse).length,
      config: this.config,
    };
  }

  /**
   * Destroy all connections (for shutdown)
   */
  async destroy(): Promise<void> {
    for (const entry of this.pool) {
      await this.destroyResource(entry.resource);
    }
    this.pool = [];
  }
}

// ============================================================================
// RATE LIMITER ENHANCEMENTS
// ============================================================================

/**
 * Enhanced rate limiter with adaptive throttling
 */
export function getAdaptiveRateLimit(ip: string, endpoint: 'auth' | 'api' | 'upload' | 'sensitive'): {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
} {
  const limiter = rateLimiters[endpoint];
  
  try {
    const result = limiter.consume(ip);
    return {
      allowed: true,
      remaining: result.remainingPoints,
    };
  } catch (rejRes: any) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: rejRes.msBeforeNext ? Math.ceil(rejRes.msBeforeNext / 1000) : undefined,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

// Global caches with different configurations
export const subjectCache = new AdvancedCache({ 
  maxSize: 500, 
  defaultTTL: 300000, // 5 minutes
});

export const dashboardCache = new AdvancedCache({ 
  maxSize: 100, 
  defaultTTL: 60000, // 1 minute
});

export const apiResponseCache = new AdvancedCache({ 
  maxSize: 1000, 
  defaultTTL: 120000, // 2 minutes
});

// Global task queue for background jobs
export const backgroundQueue = new TaskQueue(3); // 3 concurrent tasks

// Export singleton instances
export const advancedCaches = {
  subjects: subjectCache,
  dashboard: dashboardCache,
  api: apiResponseCache,
};

export const globalQueue = backgroundQueue;
