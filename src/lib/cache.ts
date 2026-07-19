// Cache management with proper invalidation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in ms
  version: number;
}

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private version: number = 0;

  set<T>(key: string, data: T, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      version: this.version,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Check version (invalidated)
    if (entry.version < this.version) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      // Invalidate all - bump version
      this.version++;
      this.cache.clear();
    }
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      version: this.version,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Global cache instance
export const appCache = new DataCache();

// Cache keys constants
export const CACHE_KEYS = {
  SUBJECTS: 'subjects:list',
  SUBJECT_STATS: 'subjects:stats',
  DASHBOARD: 'dashboard:stats',
  FACULTIES: 'faculties:list',
  DEPARTMENTS: 'departments:list',
  USERS: 'users:list',
  DOCUMENTS: 'documents:list',
  VALIDATIONS: 'validations:list',
};
