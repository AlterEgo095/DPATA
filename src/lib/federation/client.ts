// Client HTTP pour la communication inter-universitaire
// Gère l'authentification, le retry, le cache et le rate limiting

import type {
  University,
  FederationClientConfig,
  FederationClientResponse,
  FederationError,
  FederatedSearchResult,
  FederatedMatch,
  UniversityStats,
  DocumentMetadata,
} from './types';

// ============================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================

const DEFAULT_CONFIG: FederationClientConfig = {
  timeout: 30000, // 30 secondes
  retries: 3,
  retryDelay: 1000, // 1 seconde base (exponentiel)
  cacheEnabled: true,
  cacheTTL: 300, // 5 minutes
  rateLimitEnabled: true,
  rateLimitRpm: 60, // 60 requêtes/minute par université
};

// ============================================================
// CACHE MÉMOIRE AVEC TTL
// ============================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000; // en secondes
    
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  get size(): number {
    return this.cache.size;
  }
}

const globalCache = new ResponseCache();

// ============================================================
// RATE LIMITER
// ============================================================

class RateLimiter {
  private requests = new Map<string, number[]>(); // universityId -> timestamps
  
  canProceed(universityId: string, rpm: number): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    
    let timestamps = this.requests.get(universityId);
    if (!timestamps) {
      this.requests.set(universityId, [now]);
      return true;
    }
    
    // Nettoyer les anciennes entrées
    timestamps = timestamps.filter(t => now - t < windowMs);
    
    if (timestamps.length >= rpm) {
      this.requests.set(universityId, timestamps);
      return false;
    }
    
    timestamps.push(now);
    this.requests.set(universityId, timestamps);
    return true;
  }
  
  getRemainingRequests(universityId: string, rpm: number): number {
    const now = Date.now();
    const windowMs = 60000;
    const timestamps = this.requests.get(universityId) || [];
    const recentCount = timestamps.filter(t => now - t < windowMs).length;
    return Math.max(0, rpm - recentCount);
  }
  
  reset(universityId: string): void {
    this.requests.delete(universityId);
  }
}

const rateLimiter = new RateLimiter();

// ============================================================
// CLIENT FÉDÉRATION PRINCIPAL
// ============================================================

export class FederationClient {
  private config: FederationClientConfig;
  private cache: ResponseCache;
  
  constructor(config: Partial<FederationClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = globalCache;
  }
  
  // ============================================================
  // MÉTHODES PRIVÉES - UTILITAIRES
  // ============================================================
  
  private generateCacheKey(endpoint: string, params: Record<string, unknown>): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('&');
    return `${endpoint}:${paramStr}`;
  }
  
  private createError(
    code: FederationError['code'],
    message: string,
    statusCode?: number,
    retryable = false
  ): FederationError {
    return { code, message, statusCode, retryable };
  }
  
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private isRetryableError(statusCode: number): boolean {
    return statusCode >= 500 || statusCode === 429 || statusCode === 408;
  }
  
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    universityId: string
  ): Promise<FederationClientResponse<T>> {
    const startTime = Date.now();
    let lastError: FederationError | undefined;
    
    // Vérifier rate limit
    if (this.config.rateLimitEnabled && !rateLimiter.canProceed(universityId, this.config.rateLimitRpm)) {
      return {
        success: false,
        error: this.createError('RATE_LIMITED', 'Rate limit exceeded', 429, true),
        cached: false,
        responseTime: Date.now() - startTime,
        fromCache: false,
        timestamp: new Date(),
      };
    }
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        // Timeout avec AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Si l'erreur est retryable et on a encore des tentatives
          if (this.isRetryableError(response.status) && attempt < this.config.retries) {
            const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
            await this.sleep(delay);
            continue;
          }
          
          return {
            success: false,
            error: this.createError(
              response.status === 429 ? 'RATE_LIMITED' : 
              response.status === 401 ? 'AUTH_FAILED' :
              response.status === 408 ? 'TIMEOUT' : 'SERVER_ERROR',
              `HTTP ${response.status}: ${response.statusText}`,
              response.status,
              this.isRetryableError(response.status)
            ),
            cached: false,
            responseTime: Date.now() - startTime,
            fromCache: false,
            timestamp: new Date(),
          };
        }
        
        const data = await response.json() as T;
        
        return {
          success: true,
          data,
          cached: false,
          responseTime: Date.now() - startTime,
          fromCache: false,
          timestamp: new Date(),
        };
        
      } catch (error) {
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';
        const isNetwork = error instanceof TypeError;
        
        lastError = this.createError(
          isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          isTimeout ? 'Request timeout' : `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          true
        );
        
        // Retry si on a encore des tentatives
        if (attempt < this.config.retries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }
    
    return {
      success: false,
      error: lastError,
      cached: false,
      responseTime: Date.now() - startTime,
      fromCache: false,
      timestamp: new Date(),
    };
  }
  
  private buildHeaders(apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Federation-Client': 'PlagiatIA/2.0',
      'X-Request-ID': crypto.randomUUID(),
    };
  }
  
  // ============================================================
  // API PUBLIQUE - RECHERCHE
  // ============================================================
  
  /**
   * Recherche des documents dans une ou plusieurs universités partenaires
   */
  async searchDocuments(
    query: string,
    universities: University[],
    options: {
      threshold?: number;
      maxResultsPerUniversity?: number;
      useCache?: boolean;
    } = {}
  ): Promise<FederationClientResponse<FederatedSearchResult[]>> {
    const {
      threshold = 0.15,
      maxResultsPerUniversity = 20,
      useCache = true,
    } = options;
    
    const results: FederatedSearchResult[] = [];
    const errors: string[] = [];
    
    // Paralléliser les requêtes vers chaque université
    const searchPromises = universities.map(async (uni) => {
      // Vérifier le cache d'abord
      const cacheKey = this.generateCacheKey('search', { query, uni: uni.id, threshold });
      
      if (useCache && this.config.cacheEnabled) {
        const cached = this.cache.get<FederatedSearchResult[]>(cacheKey);
        if (cached) {
          return cached[0]; // On stocke un résultat par uni
        }
      }
      
      try {
        const url = `${uni.apiEndpoint}/federation/search`;
        const response = await this.fetchWithRetry<{ matches: FederatedMatch[] }>(
          url,
          {
            method: 'POST',
            headers: this.buildHeaders(uni.apiKey),
            body: JSON.stringify({
              text: query,
              threshold,
              maxResults: maxResultsPerUniversity,
            }),
          },
          uni.id
        );
        
        if (response.success && response.data) {
          const result: FederatedSearchResult = {
            universityName: uni.name,
            universityCode: uni.code,
            matches: response.data.matches || [],
            responseTime: response.responseTime,
            timestamp: new Date(),
            status: 'success',
          };
          
          // Mettre en cache
          if (this.config.cacheEnabled) {
            this.cache.set(cacheKey, [result], this.config.cacheTTL);
          }
          
          return result;
        } else {
          const result: FederatedSearchResult = {
            universityName: uni.name,
            universityCode: uni.code,
            matches: [],
            responseTime: response.responseTime,
            timestamp: new Date(),
            status: response.error?.code === 'RATE_LIMITED' ? 'rate_limited' : 
                   response.error?.code === 'TIMEOUT' ? 'timeout' : 'error',
            error: response.error?.message,
          };
          errors.push(`${uni.code}: ${response.error?.message}`);
          return result;
        }
      } catch (error) {
        const result: FederatedSearchResult = {
          universityName: uni.name,
          universityCode: uni.code,
          matches: [],
          responseTime: 0,
          timestamp: new Date(),
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        errors.push(`${uni.code}: Unexpected error`);
        return result;
      }
    });
    
    const searchResults = await Promise.all(searchPromises);
    results.push(...searchResults.filter(Boolean));
    
    return {
      success: errors.length < universities.length, // Succès partiel OK
      data: results,
      error: errors.length === universities.length ? {
        code: 'SERVER_ERROR',
        message: 'All searches failed',
        retryable: true,
      } : undefined,
      cached: false,
      responseTime: 0, // Calculé côté appelant
      fromCache: false,
      timestamp: new Date(),
    };
  }
  
  // ============================================================
  // API PUBLIQUE - STATISTIQUES
  // ============================================================
  
  /**
   * Récupère les statistiques d'une université partenaire
   */
  async getUniversityStats(
    university: University,
    options: { useCache?: boolean } = {}
  ): Promise<FederationClientResponse<UniversityStats>> {
    const { useCache = true } = options;
    const cacheKey = this.generateCacheKey('stats', { uni: university.id });
    
    // Vérifier le cache
    if (useCache && this.config.cacheEnabled) {
      const cached = this.cache.get<UniversityStats>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          cached: true,
          responseTime: 0,
          fromCache: true,
          timestamp: new Date(),
        };
      }
    }
    
    const url = `${university.apiEndpoint}/federation/stats`;
    const response = await this.fetchWithRetry<UniversityStats>(
      url,
      {
        method: 'GET',
        headers: this.buildHeaders(university.apiKey),
      },
      university.id
    );
    
    if (response.success && response.data) {
      // Mettre en cache
      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, response.data, this.config.cacheTTL);
      }
    }
    
    return response;
  }
  
  /**
   * Récupère les statistiques de plusieurs universités en parallèle
   */
  async getMultipleUniversitiesStats(
    universities: University[]
  ): Promise<Map<string, FederationClientResponse<UniversityStats>>> {
    const results = new Map<string, FederationClientResponse<UniversityStats>>();
    
    const promises = universities.map(async (uni) => {
      const stats = await this.getUniversityStats(uni);
      results.set(uni.id, stats);
    });
    
    await Promise.all(promises);
    return results;
  }
  
  // ============================================================
  // API PUBLIQUE - SYNCHRONISATION
  // ============================================================
  
  /**
   * Synchronise les métadonnées avec une université partenaire
   */
  async syncMetadata(
    university: University,
    localMetadata: DocumentMetadata[],
    options: {
      lastSyncDate?: Date;
      fullSync?: boolean;
    } = {}
  ): Promise<FederationClientResponse<{
      received: DocumentMetadata[];
      sent: number;
      lastSyncAt: Date;
    }>> {
    const { lastSyncDate, fullSync = false } = options;
    
    const url = `${university.apiEndpoint}/federation/sync/metadata`;
    const response = await this.fetchWithRetry<{
      received: DocumentMetadata[];
      acknowledged: number;
      theirLatest: DocumentMetadata[];
    }>(
      url,
      {
        method: 'POST',
        headers: this.buildHeaders(university.apiKey),
        body: JSON.stringify({
          metadata: localMetadata,
          since: lastSyncDate?.toISOString(),
          fullSync,
        }),
      },
      university.id
    );
    
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          received: response.data.theirLatest || [],
          sent: localMetadata.length,
          lastSyncAt: new Date(),
        },
      };
    }
    
    return response as FederationClientResponse<{
      received: DocumentMetadata[];
      sent: number;
      lastSyncAt: Date;
    }>;
  }
  
  /**
   * Vérifie la connectivité avec une université (health check)
   */
  async healthCheck(university: University): Promise<FederationClientResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    latency: number;
  }>> {
    const startTime = Date.now();
    
    try {
      const url = `${university.apiEndpoint}/federation/health`;
      const response = await this.fetchWithRetry<{
        status: string;
        version: string;
      }>(
        url,
        {
          method: 'GET',
          headers: this.buildHeaders(university.apiKey),
        },
        university.id
      );
      
      if (response.success && response.data) {
        return {
          success: true,
          data: {
            status: response.data.status as 'healthy' | 'degraded' | 'unhealthy',
            version: response.data.version,
            latency: response.responseTime,
          },
          cached: false,
          responseTime: response.responseTime,
          fromCache: false,
          timestamp: new Date(),
        };
      }
      
      return response as FederationClientResponse<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        version: string;
        latency: number;
      }>;
    } catch (error) {
      return {
        success: false,
        error: this.createError('NETWORK_ERROR', 'Health check failed', undefined, true),
        cached: false,
        responseTime: Date.now() - startTime,
        fromCache: false,
        timestamp: new Date(),
      };
    }
  }
  
  // ============================================================
  // GESTION DU CACHE
  // ============================================================
  
  /** Invalide le cache pour une université spécifique */
  invalidateCache(universityId?: string): void {
    if (universityId) {
      this.cache.invalidate(universityId);
    } else {
      this.cache.invalidate();
    }
  }
  
  /** Retourne les stats du cache */
  getCacheStats(): { size: number } {
    return { size: this.cache.size };
  }
  
  /** Réinitialise le rate limiter pour une université */
  resetRateLimit(universityId: string): void {
    rateLimiter.reset(universityId);
  }
  
  /** Retourne les requêtes restantes pour une université */
  getRemainingRequests(universityId: string): number {
    return rateLimiter.getRemainingRequests(universityId, this.config.rateLimitRpm);
  }
}

// ============================================================
// INSTANCE SINGLETON
// ============================================================

let clientInstance: FederationClient | null = null;

export function getFederationClient(config?: Partial<FederationClientConfig>): FederationClient {
  if (!clientInstance) {
    clientInstance = new FederationClient(config);
  }
  return clientInstance;
}

export function resetFederationClient(): void {
  clientInstance = null;
}

// Export du cache et rate limiter pour tests
export { globalCache, rateLimiter };
export type { CacheEntry };
