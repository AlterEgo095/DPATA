// Engine Factory Enhanced - Gestion Centralisée des Moteurs IA
// v0.3 — Factory Pattern avec Auto-sélection et Cache Intégré
// 
// Ce module fournit une interface unifiée pour créer, configurer et utiliser
// les différents moteurs d'analyse de PlagiatIA.
//
// Fonctionnalités:
// - Factory pattern pour instanciation des moteurs
// - Auto-sélection du moteur optimal selon le contexte
// - Cache des modèles et vecteurs pour performances
// - Métriques de performance intégrées
// - Health monitoring des moteurs

import {
  IAnalysisEngine,
  EngineType,
  AnalysisOptions,
  AnalysisResult,
  SubjectValidationResult,
  SubjectAnalysisInput,
} from './types';
import { HybridEngine } from './engines/hybrid-engine';
import { TfidfEngine } from './engines/tfidf-engine';
import { SemanticEmbeddingEngine } from './engines/semantic-engine';
import { SentenceBert } from './sentence-bert';

// ============================================================================
// TYPES POUR LA FACTORY
// ============================================================================

/** Contexte d'utilisation pour l'auto-sélection du moteur */
export type AnalysisContext =
  | 'general'        // Usage général (défaut)
  | 'academic'       // Document académique (thèse, mémoire)
  | 'web_content'    // Contenu web / blog
  | 'code'           // Code source
  | 'legal'          // Document juridique
  | 'medical'        // Document médical/scientifique
  | 'quick_check'    // Vérification rapide
  | 'deep_analysis'  // Analyse approfondie
  | 'batch';         // Traitement par lot

/** Configuration d'un moteur dans la factory */
export interface EngineConfig {
  /** Type de moteur */
  type: EngineType;
  /** Instance du moteur */
  engine: IAnalysisEngine;
  /** Priorité pour auto-sélection (plus élevé = prioritaire) */
  priority: number;
  /** Contextes optimisés */
  optimalContexts: AnalysisContext[];
  /** Est-ce que le moteur est actif? */
  enabled: boolean;
  /** Dernier health check */
  lastHealthCheck?: Date;
  /** Statut de santé */
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  /** Statistiques d'utilisation */
  stats: EngineUsageStats;
}

/** Statistiques d'utilisation d'un moteur */
export interface EngineUsageStats {
  /** Nombre total d'analyses */
  totalAnalyses: number;
  /** Temps moyen de traitement (ms) */
  avgProcessingTimeMs: number;
  /** Temps min de traitement */
  minProcessingTimeMs: number;
  /** Temps max de traitement */
  maxProcessingTimeMs: number;
  /** Nombre de succès */
  successCount: number;
  /** Nombre d'échecs */
  errorCount: number;
  /** Dernière utilisation */
  lastUsed?: Date;
}

/** Configuration globale de la factory */
export interface FactoryConfig {
  /** Activer le cache d'embeddings */
  enableCache: boolean;
  /** Taille max du cache */
  maxCacheSize: number;
  /** Auto-sélection activée */
  autoSelectEnabled: boolean;
  /** Health check interval (ms) */
  healthCheckInterval: number;
  /** Logging activé */
  logging: boolean;
  /** Moteur par défaut si auto-sélection désactivée */
  defaultEngine: EngineType;
  /** Timeout par défaut pour les analyses (ms) */
  analysisTimeout: number;
}

/** Résultat avec métadonnées de la factory */
export interface FactoryAnalysisResult<T = AnalysisResult> extends T {
  /** Moteur utilisé */
  engineUsed: EngineType;
  /** Temps de sélection du moteur */
  selectionTimeMs: number;
  /** Cache hit? */
  cacheHit: boolean;
  /** Timestamp */
  timestamp: string;
}

/** Information sur un moteur disponible */
export interface EngineInfo {
  type: EngineType;
  name: string;
  version: string;
  enabled: boolean;
  healthy: boolean;
  priority: number;
  optimalContexts: AnalysisContext[];
  stats: EngineUsageStats;
}

// ============================================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================================

const DEFAULT_FACTORY_CONFIG: FactoryConfig = {
  enableCache: true,
  maxCacheSize: 500,
  autoSelectEnabled: true,
  healthCheckInterval: 5 * 60 * 1000, // 5 minutes
  logging: true,
  defaultEngine: 'HYBRID',
  analysisTimeout: 30000, // 30 secondes
};

// ============================================================================
// CACHE VECTORIEL PARTAGÉ
// ============================================================================

/**
 * Cache partagé pour les embeddings et résultats d'analyse
 * Optimisé pour réduire les calculs redondants
 */
class SharedVectorCache {
  private embeddingCache: Map<string, Float64Array> = new Map();
  private resultCache: Map<string, { result: any; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number; // Time-to-live en ms
  
  constructor(maxSize = 500, ttl = 15 * 60 * 1000) { // 15 min TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  /** Récupère un embedding du cache */
  getEmbedding(key: string): Float64Array | null {
    return this.embeddingCache.get(key) || null;
  }
  
  /** Stocke un embedding dans le cache */
  setEmbedding(key: string, vector: Float64Array): void {
    if (this.embeddingCache.size >= this.maxSize && !this.embeddingCache.has(key)) {
      // Éviction LRU simple: supprimer le premier élément
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey !== undefined) {
        this.embeddingCache.delete(firstKey);
      }
    }
    this.embeddingCache.set(key, vector);
  }
  
  /** Récupère un résultat d'analyse du cache */
  getResult(key: string): any | null {
    const entry = this.resultCache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.resultCache.delete(key);
      return null;
    }
    
    return entry.result;
  }
  
  /** Stocke un résultat d'analyse */
  setResult(key: string, result: any): void {
    if (this.resultCache.size >= this.maxSize && !this.resultCache.has(key)) {
      const firstKey = this.resultCache.keys().next().value;
      if (firstKey !== undefined) {
        this.resultCache.delete(firstKey);
      }
    }
    this.resultCache.set(key, { result, timestamp: Date.now() });
  }
  
  /** Vide tous les caches */
  clear(): void {
    this.embeddingCache.clear();
    this.resultCache.clear();
  }
  
  /** Retourne les statistiques du cache */
  getStats(): { embeddingCacheSize: number; resultCacheSize: number } {
    return {
      embeddingCacheSize: this.embeddingCache.size,
      resultCacheSize: this.resultCache.size,
    };
  }
}

// ============================================================================
// COLLECTEUR DE MÉTRIQUES
// ============================================================================

/**
 * Collecteur de métriques de performance pour la factory
 * Permet de suivre l'utilisation et les performances des moteurs
 */
class MetricsCollector {
  private metrics: Map<string, {
    callCount: number;
    totalTimeMs: number;
    errors: number;
    lastCall?: Date;
  }> = new Map();
  
  /** Enregistre un appel à un moteur */
  record(engineType: string, durationMs: number, error: boolean): void {
    const existing = this.metrics.get(engineType) || {
      callCount: 0,
      totalTimeMs: 0,
      errors: 0,
    };
    
    existing.callCount++;
    existing.totalTimeMs += durationMs;
    if (error) existing.errors++;
    existing.lastCall = new Date();
    
    this.metrics.set(engineType, existing);
  }
  
  /** Récupère les métriques d'un moteur */
  getMetrics(engineType: string): {
    callCount: number;
    avgTimeMs: number;
    errorRate: number;
    lastCall?: Date;
  } | null {
    const m = this.metrics.get(engineType);
    if (!m) return null;
    
    return {
      callCount: m.callCount,
      avgTimeMs: m.callCount > 0 ? m.totalTimeMs / m.callCount : 0,
      errorRate: m.callCount > 0 ? m.errors / m.callCount : 0,
      lastCall: m.lastCall,
    };
  }
  
  /** Récupère toutes les métriques */
  getAllMetrics(): Record<string, ReturnType<MetricsCollector['getMetrics']>> {
    const result: Record<string, any> = {};
    for (const [key] of this.metrics) {
      result[key] = this.getMetrics(key);
    }
    return result;
  }
  
  /** Réinitialise les métriques */
  reset(): void {
    this.metrics.clear();
  }
}

// ============================================================================
// ENGINE FACTORY ENHANCED - IMPLEMENTATION PRINCIPALE
// ============================================================================

/**
 * Enhanced Engine Factory
 * 
 * Point d'entrée centralisé pour toutes les opérations d'analyse IA.
 * Gère le cycle de vie des moteurs, le cache, et les métriques.
 * 
 * @example
 * ```typescript
 * // Initialisation
 * const factory = await EngineFactoryEnhanced.create();
 * 
 * // Analyse avec auto-sélection
 * const result = await factory.analyze(text, corpus, { context: 'academic' });
 * 
 * // Liste des moteurs disponibles
 * const engines = factory.listEngines();
 * ```
 */
export class EngineFactoryEnhanced {
  private static instance: EngineFactoryEnhanced | null = null;
  
  private engines: Map<EngineType, EngineConfig> = new Map();
  private config: FactoryConfig;
  private cache: SharedVectorCache;
  private metrics: MetricsCollector;
  private sentenceBert: SentenceBert;
  private initialized: boolean = false;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor(config?: Partial<FactoryConfig>) {
    this.config = { ...DEFAULT_FACTORY_CONFIG, ...config };
    this.cache = new SharedVectorCache(this.config.maxCacheSize);
    this.metrics = new MetricsCollector();
    this.sentenceBert = new SentenceBert({
      cacheEnabled: this.config.enableCache,
    });
  }

  /**
   * Crée et initialise une instance de la factory (Singleton)
   */
  static async create(config?: Partial<FactoryConfig>): Promise<EngineFactoryEnhanced> {
    if (!EngineFactoryEnhanced.instance) {
      const factory = new EngineFactoryEnhanced(config);
      await factory.initialize();
      EngineFactoryEnhanced.instance = factory;
    }
    return EngineFactoryEnhanced.instance;
  }

  /**
   * Récupère l'instance existante ou lance une erreur
   */
  static getInstance(): EngineFactoryEnhanced {
    if (!EngineFactoryEnhanced.instance) {
      throw new Error('Factory non initialisée. Utilisez create() d\'abord.');
    }
    return EngineFactoryEnhanced.instance;
  }

  /**
   * Réinitialise complètement la factory (pour tests)
   */
  static resetInstance(): void {
    if (EngineFactoryEnhanced.instance) {
      EngineFactoryEnhanced.instance.destroy();
      EngineFactoryEnhanced.instance = null;
    }
  }

  /**
   * Initialise tous les moteurs enregistrés
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Enregistrer et initialiser les moteurs
      await this.registerDefaultEngines();
      
      // Démarrer le health check périodique
      if (this.config.healthCheckInterval > 0) {
        this.startHealthCheckLoop();
      }
      
      this.initialized = true;
      this.log('Factory initialisée avec succès');
    } catch (error) {
      console.error('[EngineFactory] Erreur d\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Détruit proprement la factory
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.cache.clear();
    this.engines.clear();
    this.metrics.reset();
    this.initialized = false;
  }

  // ============================================================
  // GESTION DES MOTEURS
  // ============================================================

  /**
   * Enregistre un moteur personnalisé
   */
  registerEngine(
    type: EngineType,
    engine: IAnalysisEngine,
    options?: {
      priority?: number;
      optimalContexts?: AnalysisContext[];
      enabled?: boolean;
    }
  ): void {
    this.engines.set(type, {
      type,
      engine,
      priority: options?.priority ?? 1,
      optimalContexts: options?.optimalContexts ?? ['general'],
      enabled: options?.enabled ?? true,
      stats: this.createEmptyStats(),
    });
    
    this.log(`Moteur enregistré: ${type} (priority: ${options?.priority ?? 1})`);
  }

  /**
   * Désenregistre un moteur
   */
  unregisterEngine(type: EngineType): boolean {
    return this.engines.delete(type);
  }

  /**
   * Récupère un moteur par son type
   */
  getEngine(type: EngineType): IAnalysisEngine | null {
    const config = this.engines.get(type);
    return config?.engine || null;
  }

  /**
   * Active/désactive un moteur
   */
  setEngineEnabled(type: EngineType, enabled: boolean): void {
    const config = this.engines.get(type);
    if (config) {
      config.enabled = enabled;
      this.log(`Moteur ${type} ${enabled ? 'activé' : 'désactivé'}`);
    }
  }

  /**
   * Liste tous les moteurs disponibles avec leurs infos
   */
  listEngines(): EngineInfo[] {
    const infos: EngineInfo[] = [];
    
    for (const [, config] of this.engines) {
      infos.push({
        type: config.type,
        name: config.engine.name,
        version: config.engine.version,
        enabled: config.enabled,
        healthy: config.healthStatus === 'healthy',
        priority: config.priority,
        optimalContexts: config.optimalContexts,
        stats: { ...config.stats },
      });
    }
    
    return infos.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Récupère le statut détaillé d'un moteur
   */
  async getEngineStatus(type: EngineType): Promise<EngineInfo | null> {
    const config = this.engines.get(type);
    if (!config) return null;
    
    // Rafraîchir le health check
    const health = await config.engine.healthCheck();
    config.healthStatus = health.status;
    config.lastHealthCheck = new Date();
    
    return this.listEngines().find(e => e.type === type) || null;
  }

  // ============================================================
  // ANALYSE - MÉTHODES PRINCIPALES
  // ============================================================

  /**
   * Lance une analyse avec auto-sélection du moteur optimal
   * 
   * @param query - Texte à analyser
   * @param corpus - Corpus de référence
   * @param options - Options d'analyse + contexte
   * @returns Résultat enrichi avec métadonnées de la factory
   */
  async analyze(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: AnalysisOptions & { context?: AnalysisContext }
  ): Promise<FactoryAnalysisResult> {
    const startTime = Date.now();
    const context = options?.context || 'general';
    
    // Sélectionner le moteur optimal
    const selectionStart = Date.now();
    const engineType = this.selectOptimalEngine(context);
    const selectionTime = Date.now() - selectionStart;
    
    // Vérifier le cache
    const cacheKey = this.generateCacheKey(query, corpus, engineType, options);
    let cacheHit = false;
    
    if (this.config.enableCache) {
      const cached = this.cache.getResult(cacheKey);
      if (cached) {
        cacheHit = true;
        this.log(`Cache HIT pour analyse (${cacheKey.substring(0, 20)}...)`);
        return {
          ...cached,
          engineUsed: engineType,
          selectionTimeMs: selectionTime,
          cacheHit: true,
          timestamp: new Date().toISOString(),
        };
      }
    }
    
    // Récupérer le moteur
    const engineConfig = this.engines.get(engineType);
    if (!engineConfig || !engineConfig.enabled) {
      throw new Error(`Moteur ${engineType} non disponible`);
    }
    
    try {
      // Exécuter l'analyse avec timeout
      const result = await Promise.race([
        engineConfig.engine.analyze(query, corpus, options),
        this.createTimeout(this.config.analysisTimeout),
      ]);
      
      const processingTime = Date.now() - startTime;
      
      // Mettre à jour les statistiques
      this.updateEngineStats(engineType, processingTime, false);
      this.metrics.record(engineType, processingTime, false);
      
      // Mettre en cache le résultat
      if (this.config.enableCache) {
        this.cache.setResult(cacheKey, result);
      }
      
      this.log(`Analyse terminée: ${engineType} en ${processingTime}ms`);
      
      return {
        ...result,
        engineUsed: engineType,
        selectionTimeMs: selectionTime,
        cacheHit: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateEngineStats(engineType, processingTime, true);
      this.metrics.record(engineType, processingTime, true);
      throw error;
    }
  }

  /**
   * Analyse avec progression (utilise HybridEngine si disponible)
   */
  async analyzeWithProgress(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    options?: Parameters<HybridEngine['analyzeWithProgress']>[2]
  ) {
    const hybridConfig = this.engines.get('HYBRID');
    if (!hybridConfig?.enabled) {
      // Fallback vers analyse standard
      return this.analyze(query, corpus, options as any);
    }
    
    const hybridEngine = hybridConfig.engine as HybridEngine;
    return hybridEngine.analyzeWithProgress(query, corpus, options);
  }

  /**
   * Validation de sujet avec auto-sélection
   */
  async validateSubject(
    subject: SubjectAnalysisInput,
    existingSubjects: unknown[],
    engineType?: EngineType
  ): Promise<SubjectValidationResult> {
    const type = engineType || this.selectOptimalEngine('academic');
    const config = this.engines.get(type);
    
    if (!config?.enabled) {
      throw new Error(`Moteur ${type} non disponible`);
    }
    
    return config.engine.validateSubject(subject, existingSubjects);
  }

  /**
   * Génération d'alternatives
   */
  async generateAlternatives(
    subject: SubjectAnalysisInput,
    similarSubjects: unknown[],
    engineType?: EngineType
  ): Promise<string[]> {
    const type = engineType || this.selectOptimalEngine('academic');
    const config = this.engines.get(type);
    
    if (!config?.enabled) {
      throw new Error(`Moteur ${type} non disponible`);
    }
    
    return config.engine.generateAlternatives(subject, similarSubjects);
  }

  // ============================================================
  // ACCÈS AUX COMPOSANTS SPÉCIFIQUES
  // ============================================================

  /**
   * Accès direct à Sentence-BERT pour opérations vectorielles
   */
  getSentenceBert(): SentenceBert {
    return this.sentenceBert;
  }

  /**
   * Accès au cache partagé
   */
  getCache(): SharedVectorCache {
    return this.cache;
  }

  /**
   * Accès aux métriques
   */
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  // ============================================================
  // SANTÉ ET MONITORING
  // ============================================================

  /**
   * Vérifie la santé de tous les moteurs
   */
  async globalHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    engines: Array<{ type: EngineType; status: string; details: string }>;
  }> {
    const results: Array<{ type: EngineType; status: string; details: string }> = [];
    let hasUnhealthy = false;
    let hasDegraded = false;
    
    for (const [type, config] of this.engines) {
      try {
        const health = await config.engine.healthCheck();
        config.healthStatus = health.status;
        config.lastHealthCheck = new Date();
        
        results.push({
          type,
          status: health.status,
          details: health.details,
        });
        
        if (health.status === 'unhealthy') hasUnhealthy = true;
        else if (health.status === 'degraded') hasDegraded = true;
      } catch (error: any) {
        results.push({
          type,
          status: 'unhealthy',
          details: error.message,
        });
        hasUnhealthy = true;
      }
    }
    
    return {
      overall: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      engines: results,
    };
  }

  // ============================================================
  // MÉTHODES PRIVÉES
  // ============================================================

  /**
   * Enregistre les moteurs par défaut
   */
  private async registerDefaultEngines(): Promise<void> {
    // Moteur TF-IDF
    const tfidfEngine = new TfidfEngine();
    await tfidfEngine.initialize();
    this.registerEngine('TFIDF', tfidfEngine, {
      priority: 2,
      optimalContexts: ['quick_check', 'code', 'web_content'],
      enabled: true,
    });

    // Moteur Sémantique
    const semanticEngine = new SemanticEmbeddingEngine();
    await semanticEngine.initialize();
    this.registerEngine('EMBEDDING', semanticEngine, {
      priority: 3,
      optimalContexts: ['academic', 'medical', 'legal', 'deep_analysis'],
      enabled: true,
    });

    // Moteur Hybride (priorité maximale)
    const hybridEngine = new HybridEngine();
    await hybridEngine.initialize();
    this.registerEngine('HYBRID', hybridEngine, {
      priority: 5,
      optimalContexts: ['general', 'academic', 'deep_analysis', 'batch'],
      enabled: true,
    });
  }

  /**
   * Sélectionne le moteur optimal selon le contexte
   */
  private selectOptimalEngine(context: AnalysisContext): EngineType {
    if (!this.config.autoSelectEnabled) {
      return this.config.defaultEngine;
    }
    
    let bestMatch: EngineType = this.config.defaultEngine;
    let bestScore = -1;
    
    for (const [type, config] of this.engines) {
      if (!config.enabled) continue;
      if (config.healthStatus === 'unhealthy') continue;
      
      let score = config.priority;
      
      // Bonus si le contexte est optimal pour ce moteur
      if (config.optimalContexts.includes(context)) {
        score += 10;
      }
      
      // Bonus si le moteur est en bonne santé
      if (config.healthStatus === 'healthy') {
        score += 5;
      }
      
      // Légère pénalisation basée sur le temps moyen de traitement
      if (config.stats.avgProcessingTimeMs > 10000) {
        score -= 2;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }
    
    return bestMatch;
  }

  /**
   * Génère une clé de cache unique
   */
  private generateCacheKey(
    query: string,
    corpus: Array<{ id: string; text: string }>,
    engineType: EngineType,
    options?: AnalysisOptions
  ): string {
    const corpusHash = corpus.map(d => d.id).sort().join(',');
    const optsStr = JSON.stringify(options || {});
    return `${engineType}:${query.length}:${corpusHash}:${optsStr}`;
  }

  /**
   * Crée un objet de statistiques vide
   */
  private createEmptyStats(): EngineUsageStats {
    return {
      totalAnalyses: 0,
      avgProcessingTimeMs: 0,
      minProcessingTimeMs: Infinity,
      maxProcessingTimeMs: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  /**
   * Met à jour les statistiques d'un moteur après une analyse
   */
  private updateEngineStats(engineType: EngineType, durationMs: number, isError: boolean): void {
    const config = this.engines.get(engineType);
    if (!config) return;
    
    const stats = config.stats;
    stats.totalAnalyses++;
    stats.lastUsed = new Date();
    
    if (isError) {
      stats.errorCount++;
    } else {
      stats.successCount++;
      
      // Mise à jour temps moyen (moyenne mobile)
      const n = stats.successCount;
      stats.avgProcessingTimeMs = (
        (stats.avgProcessingTimeMs * (n - 1) + durationMs) / n
      );
      stats.minProcessingTimeMs = Math.min(stats.minProcessingTimeMs, durationMs);
      stats.maxProcessingTimeMs = Math.max(stats.maxProcessingTimeMs, durationMs);
    }
  }

  /**
   * Crée une promesse qui reject après un timeout
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms);
    });
  }

  /**
   * Démarre la boucle de health check
   */
  private startHealthCheckLoop(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.globalHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Logger interne
   */
  private log(message: string): void {
    if (this.config.logging) {
      console.log(`[EngineFactory] ${message}`);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EngineFactoryEnhanced;
export { DEFAULT_FACTORY_CONFIG, type FactoryConfig };
