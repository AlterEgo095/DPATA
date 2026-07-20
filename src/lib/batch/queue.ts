// File d'attente prioritaire pour les analyses batch
// Implémentation FIFO avec priorités et gestion de concurrence (semaphore)
// PlagiatIA - Mode Batch v0.3

import { BatchJob, BatchConfig, BATCH_CONSTANTS, type BatchPriority } from './types';

// ============================================================
// INTERFACE DE LA QUEUE
// ============================================================

export interface QueueItem {
  job: BatchJob;
  priority: number;       // Plus élevé = plus prioritaire
  enqueuedAt: Date;
  resolve: (value: BatchJob) => void;
  reject: (reason?: Error) => void;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
}

// ============================================================
// SEMAPHORE POUR CONCURRENCE
// ============================================================

class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];

  constructor(count: number) {
    this.available = count;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.available++;
    if (this.queue.length > 0 && this.available > 0) {
      const next = this.queue.shift();
      this.available--;
      next?.();
    }
  }

  getAvailableSlots(): number {
    return this.available;
  }
}

// ============================================================
// FILE D'ATTENTE PRIORITAIRE
// ============================================================

export class PriorityBatchQueue {
  private queue: QueueItem[] = [];
  private semaphore: Semaphore;
  private processing: Set<string> = new Set();
  private stats: QueueStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalProcessed: 0,
  };
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(
    maxConcurrent: number = BATCH_CONSTANTS.DEFAULT_MAX_CONCURRENT,
    options?: { maxRetries?: number; retryDelayMs?: number }
  ) {
    this.semaphore = new Semaphore(maxConcurrent);
    this.maxRetries = options?.maxRetries ?? BATCH_CONSTANTS.RETRY_LIMIT;
    this.retryDelayMs = options?.retryDelayMs ?? BATCH_CONSTANTS.RETRY_DELAY_MS;
  }

  // ============================================================
  // GESTION DE LA QUEUE
  // ============================================================

  /**
   * Ajoute un job à la file d'attente avec sa priorité
   */
  enqueue(job: BatchJob): Promise<BatchJob> {
    return new Promise((resolve, reject) => {
      const priority = BATCH_CONSTANTS.PRIORITY_WEIGHTS[job.config.priority];
      
      const item: QueueItem = {
        job,
        priority,
        enqueuedAt: new Date(),
        resolve,
        reject,
      };

      // Insertion triée par priorité (décroissante), puis par temps (croissant)
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (priority > this.queue[i].priority) {
          this.queue.splice(i, 0, item);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.queue.push(item);
      }

      this.stats.pending = this.queue.length;
    });
  }

  /**
   * Récupère le prochain job de la file (bloquant si plein)
   */
  async dequeue(): Promise<{ job: BatchJob; release: () => void } | null> {
    if (this.queue.length === 0) {
      return null;
    }

    await this.semaphore.acquire();

    const item = this.queue.shift();
    if (!item) {
      this.semaphore.release();
      return null;
    }

    this.processing.add(item.job.id);
    this.stats.pending = this.queue.length;
    this.stats.processing = this.processing.size;

    const release = () => {
      this.processing.delete(item.job.id);
      this.semaphore.release();
      this.stats.processing = this.processing.size;
    };

    return { job: item.job, release };
  }

  /**
   * Marque un job comme complété
   */
  complete(jobId: string): void {
    this.processing.delete(jobId);
    this.semaphore.release();
    this.stats.processing = this.processing.size;
    this.stats.completed++;
    this.stats.totalProcessed++;
  }

  /**
   * Marque un job comme échoué
   */
  fail(jobId: string): void {
    this.processing.delete(jobId);
    this.semaphore.release();
    this.stats.processing = this.processing.size;
    this.stats.failed++;
    this.stats.totalProcessed++;
  }

  // ============================================================
  // RETRY LOGIC
  // ============================================================

  /**
   * Remet un job en queue avec retry (si limite non atteinte)
   */
  async retry(job: BatchJob, currentRetry: number = 0): Promise<boolean> {
    if (currentRetry >= this.maxRetries) {
      return false;
    }

    // Attendre avant de réessayer
    await this.delay(this.retryDelayMs * (currentRetry + 1));

    await this.enqueue(job);
    return true;
  }

  // ============================================================
  // TIMEOUT MANAGEMENT
  // ============================================================

  /**
   * Crée un wrapper avec timeout pour une opération
   */
  async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number = BATCH_CONSTANTS.DEFAULT_TIMEOUT_MS,
    jobId: string = 'unknown'
  ): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout après ${timeoutMs}ms pour le job ${jobId}`));
      }, timeoutMs);

      try {
        const result = await operation;
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  getQueueLength(): number {
    return this.queue.length;
  }

  getProcessingCount(): number {
    return this.processing.size;
  }

  getAvailableSlots(): number {
    return this.semaphore.getAvailableSlots();
  }

  getStats(): QueueStats {
    return { ...this.stats };
  }

  clearQueue(): void {
    // Rejeter tous les jobs en attente
    for (const item of this.queue) {
      item.reject(new Error('Queue vidée'));
    }
    this.queue = [];
    this.stats.pending = 0;
  }

  getPendingJobs(): BatchJob[] {
    return this.queue.map(item => item.job);
  }

  getProcessingJobIds(): string[] {
    return Array.from(this.processing);
  }

  isInQueue(jobId: string): boolean {
    return this.queue.some(item => item.job.id === jobId) || 
           this.processing.has(jobId);
  }

  removeJobFromQueue(jobId: string): boolean {
    const index = this.queue.findIndex(item => item.job.id === jobId);
    if (index !== -1) {
      const item = this.queue.splice(index, 1)[0];
      item.reject(new Error('Job annulé'));
      this.stats.pending = this.queue.length;
      return true;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// INSTANCE SINGLETON
// ============================================================

let queueInstance: PriorityBatchQueue | null = null;

export function getBatchQueue(): PriorityBatchQueue {
  if (!queueInstance) {
    queueInstance = new PriorityBatchQueue(BATCH_CONSTANTS.DEFAULT_MAX_CONCURRENT);
  }
  return queueInstance;
}

export function resetBatchQueue(): void {
  if (queueInstance) {
    queueInstance.clearQueue();
  }
  queueInstance = new PriorityBatchQueue(BATCH_CONSTANTS.DEFAULT_MAX_CONCURRENT);
}
