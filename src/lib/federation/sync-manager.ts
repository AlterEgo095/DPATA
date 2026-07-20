// Gestionnaire de synchronisation des métadonnées inter-universitaires
// Supporte: bidirectional sync, delta sync, queue management, detailed logging

import type {
  SyncQueueItem,
  SyncOperation,
  SyncStatus,
  SyncResult,
  SyncError,
  DocumentMetadata,
  University,
  FederationAuditLog,
  FederationAction,
} from './types';
import { getFederationClient } from './client';

// ============================================================
// CONFIGURATION
// ============================================================

interface SyncManagerConfig {
  maxConcurrentSyncs: number;
  defaultRetryDelay: number; // ms
  maxRetryAttempts: number;
  syncTimeout: number; // ms
  enableLogging: boolean;
  logRetentionDays: number;
}

const DEFAULT_CONFIG: SyncManagerConfig = {
  maxConcurrentSyncs: 3,
  defaultRetryDelay: 5000,
  maxRetryAttempts: 3,
  syncTimeout: 300000, // 5 minutes
  enableLogging: true,
  logRetentionDays: 30,
};

// ============================================================
// STOCKAGE EN MÉMOIRE (à remplacer par DB en production)
// ============================================================

class InMemoryStore<T> {
  private items: T[] = [];
  
  add(item: T): void {
    this.items.push(item);
  }
  
  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }
  
  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }
  
  update(id: string, updater: (item: T) => T, getId: (item: T) => string): void {
    const index = this.items.findIndex(item => getId(item) === id);
    if (index !== -1) {
      this.items[index] = updater(this.items[index]);
    }
  }
  
  remove(id: string, getId: (item: T) => string): void {
    this.items = this.items.filter(item => getId(item) !== id);
  }
  
  getAll(): T[] {
    return [...this.items];
  }
  
  clear(): void {
    this.items = [];
  }
  
  get count(): number {
    return this.items.length;
  }
}

// ============================================================
// FILE D'ATTENTE DE SYNCHRONISATION
// ============================================================

class SyncQueue {
  private queue = new InMemoryStore<SyncQueueItem>();
  private processing = new Set<string>();
  private listeners: Array<(item: SyncQueueItem) => void> = [];
  
  /** Ajoute une tâche à la file */
  enqueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'status' | 'progress' | 'documentsProcessed' | 'retryCount'>): SyncQueueItem {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'PENDING',
      progress: 0,
      documentsProcessed: 0,
      retryCount: 0,
      createdAt: new Date(),
    };
    
    this.queue.add(queueItem);
    this.notifyListeners(queueItem);
    
    return queueItem;
  }
  
  /** Récupère la prochaine tâche à traiter */
  dequeue(maxConcurrent: number): SyncQueueItem | null {
    // Trier par priorité puis par date
    const pending = this.queue.filter(
      item => item.status === 'PENDING' && !this.processing.has(item.id)
    );
    
    if (this.processing.size >= maxConcurrent) {
      return null;
    }
    
    // Priorité: critical > high > normal > low
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    if (pending.length === 0) {
      return null;
    }
    
    const item = pending[0];
    this.processing.add(item.id);
    
    // Mettre à jour le statut
    this.updateStatus(item.id, 'RUNNING');
    
    return item;
  }
  
  /** Met à jour le statut d'une tâche */
  updateStatus(id: string, status: SyncStatus, error?: string): void {
    this.queue.update(id, (item) => ({
      ...item,
      status,
      error: error || item.error,
      ...(status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED'
        ? { completedAt: new Date() }
        : {}),
      ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
    }), (item) => item.id);
    
    const updated = this.queue.find(i => i.id === id);
    if (updated) {
      this.notifyListeners(updated);
    }
  }
  
  /** Met à jour la progression d'une tâche */
  updateProgress(id: string, progress: number, documentsProcessed?: number): void {
    this.queue.update(id, (item) => ({
      ...item,
      progress: Math.min(100, Math.max(0, progress)),
      documentsProcessed: documentsProcessed ?? item.documentsProcessed,
    }), (item) => item.id);
  }
  
  /** Marque une tâche comme terminée et libère le slot */
  complete(id: string, success: boolean): void {
    this.updateStatus(id, success ? 'COMPLETED' : 'FAILED');
    this.processing.delete(id);
  }
  
  /** Incrémente le compteur de retry */
  incrementRetry(id: string): { retryCount: number; maxRetries: number; canRetry: boolean } {
    let result: { retryCount: number; maxRetries: number; canRetry: boolean } = {
      retryCount: 0,
      maxRetries: DEFAULT_CONFIG.maxRetryAttempts,
      canRetry: false,
    };
    
    this.queue.update(id, (item) => {
      const newRetryCount = item.retryCount + 1;
      result = {
        retryCount: newRetryCount,
        maxRetries: item.maxRetries,
        canRetry: newRetryCount <= item.maxRetries,
      };
      
      return {
        ...item,
        retryCount: newRetryCount,
        status: newRetryCount <= item.maxRetries ? 'PENDING' : 'FAILED',
      };
    }, (item) => item.id);
    
    if (result.canRetry) {
      this.processing.delete(id);
    }
    
    return result;
  }
  
  /** Récupère toutes les tâches */
  getAll(filters?: { status?: SyncStatus; universityId?: string }): SyncQueueItem[] {
    let items = this.queue.getAll();
    
    if (filters?.status) {
      items = items.filter(item => item.status === filters.status);
    }
    
    if (filters?.universityId) {
      items = items.filter(item => item.universityId === filters.universityId);
    }
    
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /** Récupère une tâche par ID */
  getById(id: string): SyncQueueItem | undefined {
    return this.queue.find(item => item.id === id);
  }
  
  /** Annule une tâche en attente */
  cancel(id: string): boolean {
    const item = this.getById(id);
    if (!item || (item.status !== 'PENDING' && item.status !== 'RUNNING')) {
      return false;
    }
    
    this.updateStatus(id, 'CANCELLED', 'Annulé par l\'utilisateur');
    this.processing.delete(id);
    return true;
  }
  
  /** S'abonner aux changements */
  onChange(listener: (item: SyncQueueItem) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  private notifyListeners(item: SyncQueueItem): void {
    for (const listener of this.listeners) {
      try {
        listener(item);
      } catch (error) {
        console.error('Sync queue listener error:', error);
      }
    }
  }
  
  get stats() {
    const all = this.queue.getAll();
    return {
      total: all.length,
      pending: all.filter(i => i.status === 'PENDING').length,
      running: all.filter(i => i.status === 'RUNNING').length,
      completed: all.filter(i => i.status === 'COMPLETED').length,
      failed: all.filter(i => i.status === 'FAILED').length,
      processing: this.processing.size,
    };
  }
}

// ============================================================
// SYSTÈME DE LOGS D'AUDIT
// ============================================================

class AuditLogger {
  private logs = new InMemoryStore<FederationAuditLog>();
  private config: SyncManagerConfig;
  
  constructor(config: SyncManagerConfig) {
    this.config = config;
  }
  
  log(action: FederationAction, details: Record<string, unknown>, context?: {
    userId?: string;
    universityId?: string;
    targetUniversityId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): FederationAuditLog {
    const logEntry: FederationAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      userId: context?.userId,
      universityId: context?.universityId,
      targetUniversityId: context?.targetUniversityId,
      details,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      timestamp: new Date(),
    };
    
    if (this.config.enableLogging) {
      this.logs.add(logEntry);
      
      // Nettoyer les vieux logs
      this.purgeOldLogs();
    }
    
    return logEntry;
  }
  
  getLogs(filters?: {
    action?: FederationAction;
    universityId?: string;
    since?: Date;
    until?: Date;
    limit?: number;
  }): FederationAuditLog[] {
    let logs = this.logs.getAll();
    
    if (filters?.action) {
      logs = logs.filter(l => l.action === filters.action);
    }
    
    if (filters?.universityId) {
      logs = logs.filter(l => 
        l.universityId === filters.universityId || 
        l.targetUniversityId === filters.universityId
      );
    }
    
    if (filters?.since) {
      logs = logs.filter(l => l.timestamp >= filters.since!);
    }
    
    if (filters?.until) {
      logs = logs.filter(l => l.timestamp <= filters.until!);
    }
    
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }
    
    return logs;
  }
  
  private purgeOldLogs(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.logRetentionDays);
    
    const all = this.logs.getAll();
    const filtered = all.filter(l => l.timestamp > cutoff);
    
    this.logs.clear();
    filtered.forEach(l => this.logs.add(l));
  }
  
  getStats(): { totalLogs: number; actionsToday: number } {
    const all = this.logs.getAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      totalLogs: all.length,
      actionsToday: all.filter(l => l.timestamp >= today).length,
    };
  }
}

// ============================================================
// SYNC MANAGER PRINCIPAL
// ============================================================

export class SyncManager {
  private config: SyncManagerConfig;
  private queue: SyncQueue;
  private auditLogger: AuditLogger;
  private client: ReturnType<typeof getFederationClient>;
  private isRunning = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private localMetadataCache = new Map<string, DocumentMetadata>();
  
  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queue = new SyncQueue();
    this.auditLogger = new AuditLogger(this.config);
    this.client = getFederationClient({
      timeout: this.config.syncTimeout,
      retries: this.config.maxRetryAttempts,
      retryDelay: this.config.defaultRetryDelay,
    });
  }
  
  // ============================================================
  // DÉMARRAGE / ARRÊT
  // ============================================================
  
  /**
   * Démarre le gestionnaire de sync (boucle de traitement)
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      console.warn('[SyncManager] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log(`[SyncManager] Started with interval ${intervalMs}ms`);
    
    // Traitement immédiat
    this.processQueue();
    
    // Boucle régulière
    this.intervalHandle = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }
  
  /**
   * Arrête le gestionnaire de sync
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    
    console.log('[SyncManager] Stopped');
  }
  
  // ============================================================
  // OPÉRATIONS DE SYNCHRONISATION
  // ============================================================
  
  /**
   * Planifie une synchronisation complète avec une université
   */
  scheduleFullSync(universityId: string, priority: SyncQueueItem['priority'] = 'normal'): SyncQueueItem {
    const item = this.queue.enqueue({
      universityId,
      operation: 'FULL',
      priority,
      documentsTotal: 0,
      maxRetries: this.config.maxRetryAttempts,
    });
    
    this.auditLogger.log('SYNC_INITIATED', {
      syncId: item.id,
      operation: 'FULL',
      universityId,
      priority,
    });
    
    return item;
  }
  
  /**
   * Planifie une synchronisation delta (modifications depuis dernière sync)
   */
  scheduleDeltaSync(
    universityId: string,
    since: Date,
    priority: SyncQueueItem['priority'] = 'normal'
  ): SyncQueueItem {
    const item = this.queue.enqueue({
      universityId,
      operation: 'DELTA',
      priority,
      documentsTotal: 0,
      maxRetries: this.config.maxRetryAttempts,
    });
    
    // Stocker la date de référence dans les métadonnées via details
    (item as Record<string, unknown>).since = since.toISOString();
    
    this.auditLogger.log('SYNC_INITIATED', {
      syncId: item.id,
      operation: 'DELTA',
      universityId,
      since: since.toISOString(),
      priority,
    });
    
    return item;
  }
  
  /**
   * Planifie une synchronisation de métadonnées uniquement
   */
  scheduleMetadataSync(universityId: string): SyncQueueItem {
    const item = this.queue.enqueue({
      universityId,
      operation: 'METADATA_ONLY',
      priority: 'normal',
      documentsTotal: 0,
      maxRetries: this.config.maxRetryAttempts,
    });
    
    this.auditLogger.log('SYNC_INITIATED', {
      syncId: item.id,
      operation: 'METADATA_ONLY',
      universityId,
    });
    
    return item;
  }
  
  /**
   * Planifie un push de documents spécifiques vers une université
   */
  schedulePush(
    universityId: string,
    documentIds: string[],
    priority: SyncQueueItem['priority'] = 'high'
  ): SyncQueueItem {
    const item = this.queue.enqueue({
      universityId,
      operation: 'PUSH',
      priority,
      documentIds,
      documentsTotal: documentIds.length,
      maxRetries: this.config.maxRetryAttempts,
    });
    
    this.auditLogger.log('SYNC_INITIATED', {
      syncId: item.id,
      operation: 'PUSH',
      universityId,
      documentCount: documentIds.length,
    });
    
    return item;
  }
  
  // ============================================================
  // TRAITEMENT DE LA FILE
  // ============================================================
  
  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      const item = this.queue.dequeue(this.config.maxConcurrentSyncs);
      
      if (!item) {
        break; // Plus rien à traiter
      }
      
      // Traiter la tâche de manière asynchrone
      this.processItem(item).catch(error => {
        console.error(`[SyncManager] Error processing ${item.id}:`, error);
        this.queue.updateStatus(item.id, 'FAILED', error instanceof Error ? error.message : 'Unknown error');
      });
    }
  }
  
  private async processItem(item: SyncQueueItem): Promise<void> {
    console.log(`[SyncManager] Processing ${item.operation} for ${item.universityId}`);
    
    try {
      // Simuler la récupération des métadonnées locales
      // En production, cela viendrait de la base de données
      const localMetadata = this.getLocalMetadata(item.universityId, item.operation);
      
      // Récupérer l'université (simulé)
      const university = await this.getUniversity(item.universityId);
      if (!university) {
        throw new Error(`University ${item.universityId} not found`);
      }
      
      // Mettre à jour le nombre total de documents
      this.queue.update(item.id, (i) => ({
        ...i,
        documentsTotal: localMetadata.length,
      }), (i) => i.id);
      
      // Effectuer la synchronisation via le client
      const since = (item as Record<string, unknown>).since as string | undefined;
      const result = await this.client.syncMetadata(university, localMetadata, {
        lastSyncDate: since ? new Date(since) : undefined,
        fullSync: item.operation === 'FULL',
      });
      
      if (result.success) {
        // Mettre à jour le cache local avec les données reçues
        if (result.data?.received) {
          this.updateLocalMetadata(item.universityId, result.data.received);
        }
        
        this.queue.updateProgress(item.id, 100, localMetadata.length);
        this.queue.complete(item.id, true);
        
        this.auditLogger.log('SYNC_COMPLETED', {
          syncId: item.id,
          operation: item.operation,
          universityId: item.universityId,
          documentsSent: localMetadata.length,
          documentsReceived: result.data?.received?.length || 0,
          duration: result.responseTime,
        });
      } else {
        throw new Error(result.error?.message || 'Sync failed');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SyncManager] Sync failed for ${item.id}:`, errorMessage);
      
      // Vérifier si on peut réessayer
      const retryInfo = this.queue.incrementRetry(item.id);
      
      if (retryInfo.canRetry) {
        console.log(`[SyncManager] Will retry ${item.id} (attempt ${retryInfo.retryCount}/${retryInfo.maxRetries})`);
        
        this.auditLogger.log('SYNC_FAILED', {
          syncId: item.id,
          operation: item.operation,
          universityId: item.universityId,
          error: errorMessage,
          willRetry: true,
          nextAttempt: retryInfo.retryCount + 1,
        });
      } else {
        this.queue.complete(item.id, false);
        
        this.auditLogger.log('SYNC_FAILED', {
          syncId: item.id,
          operation: item.operation,
          universityId: item.universityId,
          error: errorMessage,
          willRetry: false,
          finalFailure: true,
        });
      }
    }
  }
  
  // ============================================================
  // MÉTADONNÉES LOCALES (Simulation)
  // ============================================================
  
  setLocalMetadata(universityId: string, metadata: DocumentMetadata[]): void {
    this.localMetadataCache.set(universityId, metadata);
  }
  
  getLocalMetadata(universityId: string, _operation: SyncOperation): DocumentMetadata[] {
    return this.localMetadataCache.get(universityId) || [];
  }
  
  updateLocalMetadata(universityId: string, metadata: DocumentMetadata[]): void {
    const existing = this.localMetadataCache.get(universityId) || [];
    const merged = [...existing];
    
    for (const meta of metadata) {
      const index = merged.findIndex(m => m.id === meta.id);
      if (index !== -1) {
        merged[index] = meta;
      } else {
        merged.push(meta);
      }
    }
    
    this.localMetadataCache.set(universityId, merged);
  }
  
  // ============================================================
  // UTILITAIRES
  // ============================================================
  
  private async getUniversity(_universityId: string): Promise<University | null> {
    // En production, récupérer depuis la DB
    // Pour l'instant, retourne null pour forcer l'erreur en mode test
    return null;
  }
  
  // ============================================================
  // API PUBLIQUE - STATUT & LOGS
  // ============================================================
  
  /** Retourne les statistiques de la file d'attente */
  getQueueStats(): ReturnType<SyncQueue['stats']> {
    return this.queue.stats;
  }
  
  /** Retourne les tâches de la file */
  getQueueItems(filters?: { status?: SyncStatus; universityId?: string }): SyncQueueItem[] {
    return this.queue.getAll(filters);
  }
  
  /** Retourne une tâche spécifique */
  getQueueItem(id: string): SyncQueueItem | undefined {
    return this.queue.getById(id);
  }
  
  /** Annule une tâche */
  cancelTask(id: string): boolean {
    const success = this.queue.cancel(id);
    if (success) {
      this.auditLogger.log('SYNC_COMPLETED', {
        syncId: id,
        cancelled: true,
      });
    }
    return success;
  }
  
  /** Retourne les logs d'audit */
  getAuditLogs(filters?: Parameters<AuditLogger['getLogs']>[0]): FederationAuditLog[] {
    return this.auditLogger.getLogs(filters);
  }
  
  /** Retourne les statistiques des logs */
  getAuditStats(): ReturnType<AuditLogger['getStats']> {
    return this.auditLogger.getStats();
  }
  
  /** Force le traitement immédiat de la file */
  async forceProcess(): Promise<void> {
    await this.processQueue();
  }
  
  /** S'abonner aux changements de la file */
  onQueueChange(listener: (item: SyncQueueItem) => void): () => void {
    return this.queue.onChange(listener);
  }
}

// ============================================================
// INSTANCE SINGLETON
// ============================================================

let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(config?: Partial<SyncManagerConfig>): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager(config);
  }
  return syncManagerInstance;
}

export function resetSyncManager(): void {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
    syncManagerInstance = null;
  }
}
