// Types pour le système d'analyses batch (Analyses Groupées)
// PlagiatIA - Mode Batch v0.3

// ============================================================
// CONFIGURATION BATCH
// ============================================================

export type BatchEngine = 'tfidf' | 'hybrid' | 'semantic';
export type BatchScope = 'faculty' | 'department' | 'promotion' | 'all';
export type BatchPriority = 'low' | 'normal' | 'high';
export type BatchJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BatchConfig {
  threshold: number;      // Seuil de similarité (0-1)
  scope: BatchScope;      // Portée de l'analyse
  engine: BatchEngine;    // Moteur d'analyse
  priority: BatchPriority; // Priorité du job
  notifyOnComplete: boolean;
  maxConcurrent?: number;  // Max analyses parallèles (défaut: 3)
  timeout?: number;        // Timeout par document en ms (défaut: 300000 = 5min)
}

// ============================================================
// RÉSULTATS
// ============================================================

export interface BatchResult {
  documentId: string;
  documentTitle: string;
  status: 'completed' | 'failed' | 'skipped' | 'timeout';
  globalScore?: number;
  matchedSegments?: number;
  totalSegments?: number;
  matchesCount?: number;
  processingTimeMs?: number;
  error?: string;
  analyzedAt?: string;
  matchTypes?: Record<string, number>;
}

export interface BatchJobStats {
  totalDocs: number;
  processedDocs: number;
  completedDocs: number;
  failedDocs: number;
  pendingDocs: number;
  avgScore?: number;
  medianScore?: number;
  minScore?: number;
  maxScore?: number;
  stdDev?: number;
  topPlagiarists: BatchResult[];
  processingTimeMs: number;
}

export interface BatchSummary {
  jobId: string;
  jobName: string;
  status: BatchJobStatus;
  config: BatchConfig;
  stats: BatchJobStats;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  results: BatchResult[];
}

// ============================================================
// JOB BATCH
// ============================================================

export interface BatchJob {
  id: string;
  name: string;
  documentIds: string[];
  status: BatchJobStatus;
  progress: number;       // 0-100
  config: BatchConfig;
  results: BatchResult[];
  createdBy: string;
  creatorName?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// OPTIONS DE CRÉATION
// ============================================================

export interface CreateBatchJobOptions {
  name: string;
  documentIds: string[];
  config: Omit<BatchConfig, 'maxConcurrent' | 'timeout'> & {
    maxConcurrent?: number;
    timeout?: number;
  };
  userId: string;
}

// ============================================================
// CONSTANTES
// ============================================================

export const BATCH_CONSTANTS = {
  MAX_DOCUMENTS_PER_BATCH: 50,
  DEFAULT_MAX_CONCURRENT: 3,
  DEFAULT_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  PRIORITY_WEIGHTS: {
    low: 1,
    normal: 2,
    high: 3,
  },
  RETRY_LIMIT: 2,
  RETRY_DELAY_MS: 5000,
  PROGRESS_UPDATE_INTERVAL_MS: 1000,
} as const;

// ============================================================
// ÉVÉNEMENTS BATCH (pour WebSocket/real-time)
// ============================================================

export type BatchEventType = 
  | 'job:created'
  | 'job:started'
  | 'job:progress'
  | 'job:document_completed'
  | 'job:document_failed'
  | 'job:completed'
  | 'job:failed'
  | 'job:cancelled';

export interface BatchEvent {
  type: BatchEventType;
  jobId: string;
  data: Record<string, unknown>;
  timestamp: string;
}
