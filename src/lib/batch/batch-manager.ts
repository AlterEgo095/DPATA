// Gestionnaire principal des analyses batch (Analyses Groupées)
// Orchestre la création, l'exécution et le suivi des jobs batch
// PlagiatIA - Mode Batch v0.3

import { 
  BatchJob, 
  BatchResult, 
  BatchConfig, 
  BatchJobStatus,
  CreateBatchJobOptions,
  BatchEvent,
  BATCH_CONSTANTS,
} from './types';
import { PriorityBatchQueue, getBatchQueue } from './queue';
import { calculateBatchStats } from './report-generator';
import { loadDB, saveDB, genId, now, audit } from '@/lib/store/db';
import { detectPlagiat } from '@/lib/ia/engine';
import { logger } from '@/lib/logger';

// ============================================================
// LISTENERS POUR LES ÉVÉNEMENTS TEMPS RÉEL
// ============================================================

type BatchEventListener = (event: BatchEvent) => void;

const eventListeners: Set<BatchEventListener> = new Set();

export function addBatchListener(listener: BatchEventListener): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

function emitEvent(type: BatchEvent['type'], jobId: string, data: Record<string, unknown> = {}): void {
  const event: BatchEvent = {
    type,
    jobId,
    data,
    timestamp: new Date().toISOString(),
  };
  
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch (e) {
      console.error('Error in batch event listener:', e);
    }
  }
}

// ============================================================
// BATCH MANAGER
// ============================================================

class BatchManagerClass {
  private activeJobs: Map<string, BatchJob> = new Map();
  private queue: PriorityBatchQueue;
  private isProcessing: boolean = false;

  constructor() {
    this.queue = getBatchQueue();
  }

  // ============================================================
  // CRÉATION DE JOB
  // ============================================================

  async createJob(options: CreateBatchJobOptions): Promise<BatchJob> {
    const db = await loadDB();

    // Validation
    if (!options.name || options.name.trim().length === 0) {
      throw new Error('Le nom du job est requis');
    }

    if (!options.documentIds || options.documentIds.length === 0) {
      throw new Error('Au moins un document doit être sélectionné');
    }

    if (options.documentIds.length > BATCH_CONSTANTS.MAX_DOCUMENTS_PER_BATCH) {
      throw new Error(
        `Maximum ${BATCH_CONSTANTS.MAX_DOCUMENTS_PER_BATCH} documents par batch (reçu: ${options.documentIds.length})`
      );
    }

    // Vérifier que les documents existent
    const validDocIds: string[] = [];
    for (const docId of options.documentIds) {
      const doc = db.documents.find(d => d.id === docId);
      if (doc) {
        validDocIds.push(docId);
      }
    }

    if (validDocIds.length === 0) {
      throw new Error('Aucun document valide trouvé');
    }

    // Config complète avec valeurs par défaut
    const config: BatchConfig = {
      threshold: options.config.threshold ?? 0.15,
      scope: options.config.scope ?? 'faculty',
      engine: options.config.engine ?? 'tfidf',
      priority: options.config.priority ?? 'normal',
      notifyOnComplete: options.config.notifyOnComplete ?? true,
      maxConcurrent: options.config.maxConcurrent ?? BATCH_CONSTANTS.DEFAULT_MAX_CONCURRENT,
      timeout: options.config.timeout ?? BATCH_CONSTANTS.DEFAULT_TIMEOUT_MS,
    };

    // Créer le job
    const job: BatchJob = {
      id: genId('batch'),
      name: options.name.trim(),
      documentIds: validDocIds,
      status: 'pending',
      progress: 0,
      config,
      results: [],
      createdBy: options.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Récupérer le nom du créateur
    const creator = db.users.find(u => u.id === options.userId);
    job.creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Inconnu';

    // Stocker en mémoire
    this.activeJobs.set(job.id, job);

    // Persister dans le store
    const batchJobRecord = {
      id: job.id,
      name: job.name,
      status: job.status,
      config: JSON.stringify(config),
      progress: 0,
      totalDocs: validDocIds.length,
      processedDocs: 0,
      failedDocs: 0,
      createdBy: options.userId,
      startedAt: null,
      completedAt: null,
      results: JSON.stringify([]),
      createdAt: now(),
      updatedAt: now(),
    };

    // Ajouter au store si pas encore existant
    if (!db.batchJobs) {
      (db as any).batchJobs = [];
    }
    (db.batchJobs as any[]).push(batchJobRecord);
    await saveDB(db);

    // Audit log
    await audit(
      options.userId,
      job.creatorName,
      'BATCH_JOB_CREATED',
      'BatchJob',
      job.id,
      { 
        name: job.name, 
        documentCount: validDocIds.length, 
        config 
      }
    );

    // Émettre l'événement
    emitEvent('job:created', job.id, { job });

    logger.info('Batch job created', { jobId: job.id, name: job.name, docCount: validDocIds.length });

    return job;
  }

  // ============================================================
  // EXÉCUTION DU JOB
  // ============================================================

  async startJob(jobId: string): Promise<BatchJob> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} non trouvé`);
    }

    if (job.status !== 'pending') {
      throw new Error(`Le job ${jobId} n'est pas en attente (status: ${job.status})`);
    }

    // Mettre à jour le statut
    job.status = 'running';
    job.startedAt = new Date();
    job.updatedAt = new Date();

    emitEvent('job:started', jobId, { job });

    // Mettre à jour dans le store
    await this.updateJobInStore(job);

    // Lancer le traitement asynchrone
    this.processJob(job).catch(error => {
      logger.error('Error processing batch job', { jobId, error: error.message });
    });

    return job;
  }

  private async processJob(job: BatchJob): Promise<void> {
    const db = await loadDB();
    
    try {
      const totalDocs = job.documentIds.length;
      
      for (let i = 0; i < totalDocs; i++) {
        // Vérifier si le job a été annulé
        const currentJob = this.activeJobs.get(job.id);
        if (!currentJob || currentJob.status === 'cancelled') {
          break;
        }

        const docId = job.documentIds[i];
        
        try {
          // Analyser le document avec timeout
          const result = await this.queue.withTimeout(
            this.analyzeDocument(db, docId, job),
            job.config.timeout,
            job.id
          );

          job.results.push(result);
          
          emitEvent('job:document_completed', job.id, {
            documentId: docId,
            result,
          });

        } catch (error: any) {
          // Document échoué ou timeout
          const failedResult: BatchResult = {
            documentId: docId,
            documentTitle: this.getDocumentTitle(db, docId),
            status: error.message?.includes('Timeout') ? 'timeout' : 'failed',
            error: error.message || 'Erreur inconnue',
          };
          
          job.results.push(failedResult);
          
          emitEvent('job:document_failed', job.id, {
            documentId: docId,
            error: error.message,
          });
        }

        // Mettre à jour la progression
        job.processedDocs = i + 1;
        job.progress = Math.round(((i + 1) / totalDocs) * 100);
        job.updatedAt = new Date();

        // Sauvegarder périodiquement
        if ((i + 1) % 5 === 0 || i === totalDocs - 1) {
          await this.updateJobInStore(job);
        }

        emitEvent('job:progress', job.id, {
          processed: i + 1,
          total: totalDocs,
          progress: job.progress,
        });
      }

      // Finaliser le job
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;
      job.updatedAt = new Date();

      // Calculer les stats finales
      const failedCount = job.results.filter(r => r.status === 'failed' || r.status === 'timeout').length;
      job.failedDocs = failedCount;

      emitEvent('job:completed', job.id, {
        results: job.results,
        stats: calculateBatchStats(job.results, job.startedAt),
      });

      // Audit
      await audit(
        job.createdBy,
        job.creatorName,
        'BATCH_JOB_COMPLETED',
        'BatchJob',
        job.id,
        { 
          totalDocs: job.documentIds.length,
          completedDocs: job.processedDocs - job.failedDocs,
          failedDocs: job.failedDocs,
        }
      );

    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message || 'Erreur inconnue lors du traitement';
      job.completedAt = new Date();
      job.updatedAt = new Date();

      emitEvent('job:failed', job.id, { error: job.error });

      await audit(
        job.createdBy,
        job.creatorName,
        'BATCH_JOB_FAILED',
        'BatchJob',
        job.id,
        { error: job.error }
      );

    } finally {
      // Sauvegarder final
      await this.updateJobInStore(job);
      
      logger.info('Batch job finished', {
        jobId: job.id,
        status: job.status,
        processedDocs: job.processedDocs,
        totalDocs: job.documentIds.length,
      });
    }
  }

  private async analyzeDocument(
    db: Awaited<ReturnType<typeof loadDB>>,
    documentId: string,
    job: BatchJob
  ): Promise<BatchResult> {
    const doc = db.documents.find(d => d.id === documentId);
    if (!doc) {
      return {
        documentId,
        documentTitle: 'Document inconnu',
        status: 'skipped',
        error: 'Document non trouvé',
      };
    }

    // Préparer le texte du document
    const documentText = doc.textExtract || `[Document: ${doc.title}]\n\n${doc.abstract || ''}`;
    
    if (!documentText.trim()) {
      return {
        documentId,
        documentTitle: doc.title,
        status: 'skipped',
        error: 'Pas de texte extrait pour ce document',
      };
    }

    // Construire le corpus selon la scope
    let corpusDocs = db.documents
      .filter(d => {
        if (d.id === documentId) return false;
        if (!d.textExtract) return false;
        
        switch (job.config.scope) {
          case 'all':
            return true;
          case 'faculty':
            return d.facultyId === doc.facultyId;
          case 'department':
            return d.departmentId === doc.departmentId;
          case 'promotion':
            return d.promotionId === doc.promotionId;
          default:
            return d.facultyId === doc.facultyId;
        }
      })
      .map(d => ({
        documentId: d.id,
        text: d.textExtract!,
      }));

    // Exécuter l'analyse IA
    const startTime = Date.now();
    const iaResult = detectPlagiat(documentText, corpusDocs, job.config.threshold);
    const processingTimeMs = Date.now() - startTime;

    return {
      documentId,
      documentTitle: doc.title,
      status: 'completed',
      globalScore: iaResult.globalScore,
      matchedSegments: iaResult.matchedSegments,
      totalSegments: iaResult.totalSegments,
      matchesCount: iaResult.matches.length,
      processingTimeMs,
      analyzedAt: new Date().toISOString(),
      matchTypes: iaResult.byType,
    };
  }

  // ============================================================
  // ANNULATION DE JOB
  // ============================================================

  async cancelJob(jobId: string, userId?: string): Promise<BatchJob> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} non trouvé`);
    }

    if (job.status !== 'pending' && job.status !== 'running') {
      throw new Error(`Impossible d'annuler un job avec le statut: ${job.status}`);
    }

    // Retirer de la queue si en attente
    this.queue.removeJobFromQueue(jobId);

    job.status = 'cancelled';
    job.completedAt = new Date();
    job.updatedAt = new Date();

    await this.updateJobInStore(job);

    emitEvent('job:cancelled', job.id, { cancelledBy: userId });

    await audit(
      userId || job.createdBy,
      job.creatorName,
      'BATCH_JOB_CANCELLED',
      'BatchJob',
      job.id,
      { progress: job.progress, processedDocs: job.processedDocs }
    );

    return job;
  }

  // ============================================================
  // RÉCUPÉRATION DES JOBS
  // ============================================================

  getJob(jobId: string): BatchJob | undefined {
    return this.activeJobs.get(jobId);
  }

  getAllJobs(): BatchJob[] {
    return Array.from(this.activeJobs.values());
  }

  getActiveJobs(): BatchJob[] {
    return Array.from(this.activeJobs.values()).filter(
      j => j.status === 'running' || j.status === 'pending'
    );
  }

  getCompletedJobs(): BatchJob[] {
    return Array.from(this.activeJobs.values()).filter(
      j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled'
    );
  }

  // ============================================================
  // PERSISTANCE
  // ============================================================

  private async updateJobInStore(job: BatchJob): Promise<void> {
    const db = await loadDB();
    
    if (!db.batchJobs) {
      (db as any).batchJobs = [];
    }

    const batchJobs = db.batchJobs as any[];
    const existingIndex = batchJobs.findIndex(bj => bj.id === job.id);

    const updateData = {
      status: job.status,
      progress: job.progress,
      processedDocs: job.processedDocs,
      failedDocs: job.failedDocs,
      startedAt: job.startedAt?.toISOString() || null,
      completedAt: job.completedAt?.toISOString() || null,
      results: JSON.stringify(job.results),
      error: job.error || null,
      updatedAt: now(),
    };

    if (existingIndex !== -1) {
      Object.assign(batchJobs[existingIndex], updateData);
    } else {
      batchJobs.push({
        id: job.id,
        name: job.name,
        config: JSON.stringify(job.config),
        totalDocs: job.documentIds.length,
        createdBy: job.createdBy,
        createdAt: job.createdAt.toISOString(),
        ...updateData,
      });
    }

    await saveDB(db);
  }

  // ============================================================
  // RESTAURATION depuis le store
  // ============================================================

  async restoreFromStore(): Promise<void> {
    const db = await loadDB();
    
    if (!db.batchJobs || !Array.isArray(db.batchJobs)) return;

    for (const record of db.batchJobs) {
      if (!this.activeJobs.has(record.id)) {
        try {
          const config: BatchConfig = JSON.parse(record.config);
          const results: BatchResult[] = record.results ? JSON.parse(record.results) : [];

          const job: BatchJob = {
            id: record.id,
            name: record.name,
            documentIds: [], // Les IDs ne sont pas stockés séparément
            status: record.status,
            progress: record.progress,
            config,
            results,
            createdBy: record.createdBy,
            startedAt: record.startedAt ? new Date(record.startedAt) : undefined,
            completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
            error: record.error || undefined,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          };

          this.activeJobs.set(record.id, job);
        } catch (e) {
          console.error(`Error restoring batch job ${record.id}:`, e);
        }
      }
    }

    logger.info(`Restored ${this.activeJobs.size} batch jobs from store`);
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  private getDocumentTitle(db: Awaited<ReturnType<typeof loadDB>>, docId: string): string {
    const doc = db.documents.find(d => d.id === docId);
    return doc?.title || 'Document inconnu';
  }

  clearCompletedJobs(olderThanHours: number = 24): number {
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    let removed = 0;

    for (const [id, job] of this.activeJobs) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt && 
        job.completedAt.getTime() < cutoff
      ) {
        this.activeJobs.delete(id);
        removed++;
      }
    }

    return removed;
  }

  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const jobs = Array.from(this.activeJobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length,
    };
  }
}

// ============================================================
// INSTANCE SINGLETON
// ============================================================

export const batchManager = new BatchManagerClass();

// Auto-restore on import
batchManager.restoreFromStore().catch(console.error);
