// Module de confidentialité et d'anonymisation pour la fédération
// Garantit qu'aucune donnée sensible n'est transmise en clair

import type {
  AnonymizedDocument,
  AnonymizationLevel,
  DocumentMetadata,
  SharingConsent,
} from './types';

// ============================================================
// CONFIGURATION
// ============================================================

interface PrivacyConfig {
  defaultAnonymizationLevel: AnonymizationLevel;
  hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512';
  dataTTLHours: number; // Durée de vie des données partagées
  requireConsent: boolean;
  minHashLength: number;
}

const DEFAULT_CONFIG: PrivacyConfig = {
  defaultAnonymizationLevel: 'FULL',
  hashAlgorithm: 'SHA-256',
  dataTTLHours: 24, // 24 heures par défaut
  requireConsent: true,
  minHashLength: 64, // SHA-256 = 64 chars hex
};

// ============================================================
// HASHING UTILITAIRES
// ============================================================

/**
 * Calcule le hash d'une chaîne avec l'algorithme spécifié
 * Utilise l'API Web Crypto (disponible dans Node.js 19+ et Edge/Next.js)
 */
async function hashString(text: string, algorithm: string = 'SHA-256'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Génère une empreinte unique pour un document basée sur ses métadonnées
 */
async function generateFingerprint(metadata: {
  title: string;
  abstract?: string;
  year: string;
  author?: string;
}): Promise<string> {
  const combined = [
    metadata.title,
    metadata.abstract || '',
    metadata.year,
    metadata.author || '',
  ].join('|');
  
  return hashString(combined);
}

/**
 * Extrait les initiales d'un nom complet
 */
function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .join('.')
    .toUpperCase();
}

// ============================================================
// ANONYMISATION DES DOCUMENTS
// ============================================================

/** Document source avant anonymisation */
export interface SourceDocument {
  id: string;
  title: string;
  abstract?: string;
  content?: string; // Texte complet (NE JAMAIS être transmis)
  author: string;
  authorEmail?: string;
  year: string;
  faculty: string;
  department: string;
  language: string;
  type: string;
  keywords?: string[];
  pageCount?: number;
  segments?: string[]; // Segments de texte (pour hash uniquement)
  createdAt: Date;
  updatedAt: Date;
}

/** Résultat de l'anonymisation avec métadonnées */
export interface AnonymizationResult {
  success: boolean;
  document: AnonymizedDocument | null;
  warnings: string[];
  processingTimeMs: number;
  originalDataSize: number;
  anonymizedDataSize: number;
  dataReductionPercent: number;
}

export class PrivacyManager {
  private config: PrivacyConfig;
  private consentStore = new Map<string, SharingConsent>();
  
  constructor(config: Partial<PrivacyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================================
  // ANONYMISATION PRINCIPALE
  // ============================================================
  
  /**
   * Anonymise un document complet pour partage inter-universitaire
   * Le document résultant ne contient AUCUNE information personnelle en clair
   */
  async anonymizeDocument(
    source: SourceDocument,
    sourceUniversityCode: string,
    options: {
      level?: AnonymizationLevel;
      customTTL?: number; // heures
      includeSegments?: boolean;
    } = {}
  ): Promise<AnonymizationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    
    const {
      level = this.config.defaultAnonymizationLevel,
      customTTL,
      includeSegments = true,
    } = options;
    
    try {
      // Vérifier le consentement si requis
      if (this.config.requireConsent) {
        const consent = this.consentStore.get(source.id);
        if (!consent || !consent.granted) {
          warnings.push(`No valid consent for document ${source.id}`);
          return {
            success: false,
            document: null,
            warnings: ['Sharing consent required but not granted'],
            processingTimeMs: Date.now() - startTime,
            originalDataSize: 0,
            anonymizedDataSize: 0,
            dataReductionPercent: 0,
          };
        }
      }
      
      // Calculer la taille des données originales (estimation)
      const originalSize = JSON.stringify(source).length;
      
      // Hash des différents champs
      const titleHash = await hashString(source.title, this.config.hashAlgorithm);
      const abstractHash = source.abstract 
        ? await hashString(source.abstract, this.config.hashAlgorithm) 
        : '';
      const authorInitials = getInitials(source.author);
      
      // Hash des segments (jamais le texte en clair!)
      const segmentHashes: string[] = [];
      if (includeSegments && source.segments) {
        for (const segment of source.segments) {
          const segmentHash = await hashString(segment.trim(), this.config.hashAlgorithm);
          segmentHashes.push(segmentHash);
        }
      }
      
      // Empreinte globale du document
      const fingerprint = await generateFingerprint({
        title: source.title,
        abstract: source.abstract,
        year: source.year,
        author: source.author,
      });
      
      // Hash des mots-clés s'ils existent
      let keywordsHash = '';
      if (source.keywords && source.keywords.length > 0) {
        keywordsHash = await hashString(
          source.keywords.sort().join(','), 
          this.config.hashAlgorithm
        );
      }
      
      // Calcul du TTL
      const ttlHours = customTTL || this.config.dataTTLHours;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);
      
      // Construction du document anonymisé
      const anonymized: AnonymizedDocument = {
        id: `anon-${await hashString(source.id + sourceUniversityCode, this.config.hashAlgorithm).then(h => h.slice(0, 16))}`,
        sourceUniversityCode,
        originalDocumentId: await hashString(source.id, this.config.hashAlgorithm),
        
        // Métadonnées partiellement anonymisées
        titleHash,
        abstractHash,
        authorInitials,
        year: parseInt(source.year) || new Date().getFullYear(),
        faculty: this.anonymizeFaculty(source.faculty),
        department: this.anonymizeDepartment(source.department),
        language: source.language,
        
        // Contenu haché uniquement
        segmentHashes,
        fingerprint,
        
        // Métadonnées techniques
        anonymizationLevel: level,
        anonymizedAt: new Date(),
        expiresAt,
        version: 1,
      };
      
      // Ajouter des infos supplémentaires selon le niveau
      if (level === 'MINIMAL') {
        // Niveau minimal: seulement l'empreinte
        anonymized.segmentHashes = [];
        anonymized.abstractHash = '';
      }
      
      if (level === 'PARTIAL') {
        // Niveau partiel: garder quelques métadonnées agrégées
        warnings.push('Partial anonymization: some metadata may be inferable');
      }
      
      // Calcul de la réduction de données
      const anonymizedSize = JSON.stringify(anonymized).length;
      const reductionPercent = ((originalSize - anonymizedSize) / originalSize) * 100;
      
      return {
        success: true,
        document: anonymized,
        warnings,
        processingTimeMs: Date.now() - startTime,
        originalDataSize: originalSize,
        anonymizedDataSize: anonymizedSize,
        dataReductionPercent: Math.max(0, reductionPercent),
      };
      
    } catch (error) {
      console.error('[PrivacyManager] Anonymization error:', error);
      return {
        success: false,
        document: null,
        warnings: [`Anonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        processingTimeMs: Date.now() - startTime,
        originalDataSize: 0,
        anonymizedDataSize: 0,
        dataReductionPercent: 0,
      };
    }
  }
  
  /**
   * Anonymise plusieurs documents en batch
   */
  async anonymizeDocuments(
    sources: SourceDocument[],
    sourceUniversityCode: string,
    options?: Parameters<PrivacyManager['anonymizeDocument']>[2]
  ): Promise<AnonymizationResult[]> {
    return Promise.all(
      sources.map(source => this.anonymizeDocument(source, sourceUniversityCode, options))
    );
  }
  
  // ============================================================
  // HASH DE TEXTE POUR COMPARAISON
  // ============================================================
  
  /**
   * Hash un texte pour comparaison sans exposer le contenu
   * Utilisé pour la recherche fédérée
   */
  async hashTextForComparison(text: string): Promise<{
    fullHash: string;
    segmentHashes: { index: number; hash: string }[];
    length: number;
    estimatedWords: number;
  }> {
    const segments = this.splitIntoSegments(text, 500); // 500 caractères par segment
    
    const segmentHashes = await Promise.all(
      segments.map(async (segment, index) => ({
        index,
        hash: await hashString(segment.trim(), this.config.hashAlgorithm),
      }))
    );
    
    return {
      fullHash: await hashString(text, this.config.hashAlgorithm),
      segmentHashes,
      length: text.length,
      estimatedWords: text.split(/\s+/).filter(Boolean).length,
    };
  }
  
  /**
   * Compare deux hashes de documents pour détecter la similarité
   * Retourne un score de similarité estimé (basé sur les segments communs)
   */
  async compareDocumentHashes(
    hashA: { segmentHashes: string[] },
    hashB: { segmentHashes: string[] }
  ): Promise<{
    similarityScore: number;
    commonSegments: number;
    totalSegmentsA: number;
    totalSegmentsB: number;
  }> {
    const setA = new Set(hashA.segmentHashes);
    const setB = new Set(hashB.segmentHashes);
    
    let common = 0;
    for (const hash of setA) {
      if (setB.has(hash)) {
        common++;
      }
    }
    
    // Score de Jaccard
    const unionSize = new Set([...setA, ...setB]).size;
    const similarityScore = unionSize > 0 ? common / unionSize : 0;
    
    return {
      similarityScore,
      commonSegments: common,
      totalSegmentsA: setA.size,
      totalSegmentsB: setB.size,
    };
  }
  
  // ============================================================
  // GESTION DU CONSENTEMENT
  // ============================================================
  
  /**
   * Enregistre un consentement de partage
   */
  grantConsent(
    documentId: string,
    universityId: string,
    grantedBy: string,
    scope: SharingConsent['scope'] = 'hashes_only'
  ): SharingConsent {
    const consent: SharingConsent = {
      id: `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      universityId,
      granted: true,
      grantedBy,
      grantedAt: new Date(),
      scope,
      revocable: true,
    };
    
    this.consentStore.set(documentId, consent);
    return consent;
  }
  
  /**
   * Révoque un consentement de partage
   */
  revokeConsent(documentId: string, revokedBy: string): SharingConsent | null {
    const existing = this.consentStore.get(documentId);
    if (!existing) {
      return null;
    }
    
    if (!existing.revocable) {
      throw new Error('This consent cannot be revoked');
    }
    
    const revoked: SharingConsent = {
      ...existing,
      granted: false,
      revokedAt: new Date(),
    };
    
    this.consentStore.set(documentId, revoked);
    return revoked;
  }
  
  /**
   * Vérifie si un consentement est valide
   */
  checkConsent(documentId: string): SharingConsent | undefined {
    return this.consentStore.get(documentId);
  }
  
  /**
   * Révoque tous les consentements d'un utilisateur
   */
  revokeAllUserConsents(userId: string): number {
    let count = 0;
    for (const [docId, consent] of this.consentStore.entries()) {
      if (consent.grantedBy === userId && consent.revocable) {
        this.revokeConsent(docId, userId);
        count++;
      }
    }
    return count;
  }
  
  // ============================================================
  // MÉTADONNÉES ANONYMISÉES
  // ============================================================
  
  /**
   * Crée des métadonnées anonymisées pour synchronisation
   */
  async createAnonymousMetadata(
    source: SourceDocument
  ): Promise<DocumentMetadata> {
    return {
      id: await hashString(source.id, this.config.hashAlgorithm),
      title: `[HASHED] ${(await hashString(source.title, this.config.hashAlgorithm)).slice(0, 16)}...`,
      type: source.type,
      abstractHash: source.abstract 
        ? await hashString(source.abstract, this.config.hashAlgorithm) 
        : '',
      keywordsHash: source.keywords?.length 
        ? await hashString(source.keywords.sort().join(','), this.config.hashAlgorithm)
        : '',
      authorHash: await hashString(source.author, this.config.hashAlgorithm),
      faculty: this.anonymizeFaculty(source.faculty),
      department: this.anonymizeDepartment(source.department),
      year: source.year,
      language: source.language,
      pageCount: source.pageCount || 0,
      segmentCount: source.segments?.length || 0,
      fingerprint: await generateFingerprint(source),
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }
  
  // ============================================================
  // UTILITAIRES PRIVÉS
  // ============================================================
  
  private splitIntoSegments(text: string, maxLength: number): string[] {
    const segments: string[] = [];
    const sentences = text.split(/[.!?]+/);
    
    let currentSegment = '';
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      
      if ((currentSegment + ' ' + trimmed).length > maxLength && currentSegment) {
        segments.push(currentSegment.trim());
        currentSegment = trimmed;
      } else {
        currentSegment += (currentSegment ? ' ' : '') + trimmed;
      }
    }
    
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }
    
    return segments;
  }
  
  private anonymizeFaculty(faculty: string): string {
    // Garder le nom de la faculté mais pas de détails sensibles
    // En production, utiliser un mapping codifié
    return faculty.replace(/\d/g, '[REDACTED]');
  }
  
  private anonymizeDepartment(department: string): string {
    // Garder le département mais anonymiser si nécessaire
    return department.replace(/\d/g, '[REDACTED]');
  }
  
  // ============================================================
  // NETTOYAGE & MAINTENANCE
  // ============================================================
  
  /**
   * Nettoie les données anonymisées expirées
   */
  cleanExpiredData(): { cleaned: number; remaining: number } {
    const now = new Date();
    // Dans une implémentation complète, on nettoierait un store de données
    // Pour l'instant, retourne des stats factices
    return { cleaned: 0, remaining: 0 };
  }
  
  /**
   * Retourne les statistiques du module de privacy
   */
  getStats(): {
    totalConsents: number;
    grantedConsents: number;
    revokedConsents: number;
    config: PrivacyConfig;
  } {
    let granted = 0;
    let revoked = 0;
    
    for (const consent of this.consentStore.values()) {
      if (consent.granted) granted++;
      else revoked++;
    }
    
    return {
      totalConsents: this.consentStore.size,
      grantedConsents: granted,
      revokedConsents: revoked,
      config: this.config,
    };
  }
}

// ============================================================
// INSTANCE SINGLETON
// ============================================================

let privacyInstance: PrivacyManager | null = null;

export function getPrivacyManager(config?: Partial<PrivacyConfig>): PrivacyManager {
  if (!privacyInstance) {
    privacyInstance = new PrivacyManager(config);
  }
  return privacyInstance;
}

export function resetPrivacyManager(): void {
  privacyInstance = null;
}
