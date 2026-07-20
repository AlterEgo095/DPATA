// Types pour l'API fédératrice interuniversitaire - Module complet

// ============================================================
// ENTITÉS PRINCIPALES
// ============================================================

/** Statut d'une université dans la fédération */
export type UniversityStatus = 'active' | 'inactive' | 'pending' | 'suspended';

/** Université partenaire de la fédération */
export interface University {
  id: string;
  name: string;
  code: string; // UNIKIN, UNILU, UNIKIS, UCB, etc.
  country: string;
  city: string;
  logoUrl?: string;
  contactEmail: string;
  status: UniversityStatus;
  apiEndpoint: string;
  apiKey: string; // hashed (bcrypt)
  documentCount: number;
  lastSyncAt: Date | null;
  lastSyncStatus: 'success' | 'failed' | 'pending' | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Configuration globale de la fédération */
export interface FederationConfig {
  enableCrossUniversitySearch: boolean;
  shareAnonymizedData: boolean;
  syncIntervalHours: number;
  maxExternalResults: number;
  participatingUniversities: string[];
  rateLimitRequestsPerMinute: number;
  cacheTTLSeconds: number;
  requireConsentForSharing: boolean;
  autoApproveNewUniversities: boolean;
}

// ============================================================
// RECHERCHE FÉDÉRÉE
// ============================================================

/** Type de correspondance détectée */
export type MatchType = 'COPY_PASTE' | 'PARAPHRASE' | 'REFORMULATION' | 'TRANSLATION' | 'WEAK_MATCH';

/** Correspondance fédérée individuelle */
export interface FederatedMatch {
  id: string;
  universityCode: string;
  universityName: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  segmentIndex: number;
  segmentHash: string; // SHA-256 hash du segment (pas le texte en clair)
  semanticScore: number; // 0.0 à 1.0
  lexicalScore: number; // 0.0 à 1.0
  combinedScore: number; // Score agrégé
  matchType: MatchType;
  confidence: 'high' | 'medium' | 'low';
}

/** Résultat de recherche pour une université spécifique */
export interface FederatedSearchResult {
  universityName: string;
  universityCode: string;
  matches: FederatedMatch[];
  responseTimeMs: number;
  timestamp: Date;
  status: 'success' | 'timeout' | 'error' | 'rate_limited';
  error?: string;
}

/** Requête de recherche fédérée */
export interface FederationSearchRequest {
  text: string;
  textHash: string; // Hash du texte query
  threshold?: number;
  universities: string[];
  scope?: 'faculty' | 'department' | 'all';
  maxResultsPerUniversity?: number;
  includeAnonymizedOnly?: boolean;
}

/** Réponse complète de recherche fédérée */
export interface FederationSearchResponse {
  queryId: string;
  queryUniversity: string;
  totalMatches: number;
  matches: FederatedMatch[];
  resultsByUniversity: FederatedSearchResult[];
  universitiesQueried: number;
  universitiesResponded: number;
  processingTimeMs: number;
  timestamp: Date;
}

// ============================================================
// SYNCHRONISATION
// ============================================================

/** Types d'opérations de sync */
export type SyncOperation = 'PUSH' | 'PULL' | 'DELTA' | 'FULL' | 'METADATA_ONLY';

/** Statut d'une tâche de synchronisation */
export type SyncStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIAL';

/** Entrée dans la file d'attente de sync */
export interface SyncQueueItem {
  id: string;
  universityId: string;
  operation: SyncOperation;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: SyncStatus;
  documentIds?: string[]; // Documents concernés (vide = full sync)
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  documentsProcessed: number;
  documentsTotal: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/** Résultat d'une opération de sync */
export interface SyncResult {
  success: boolean;
  operation: SyncOperation;
  universityId: string;
  documentsSynced: number;
  documentsFailed: number;
  errors: SyncError[];
  durationMs: number;
  timestamp: Date;
}

/** Erreur détaillée de sync */
export interface SyncError {
  documentId: string;
  errorType: 'NETWORK' | 'AUTH' | 'VALIDATION' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

/** Métadonnées de document pour la sync */
export interface DocumentMetadata {
  id: string;
  externalId?: string; // ID chez le partenaire
  title: string;
  type: string;
  abstractHash: string; // Hash du résumé
  keywordsHash: string; // Hash des mots-clés
  authorHash: string; // Hash de l'auteur
  faculty: string;
  department: string;
  year: string;
  language: string;
  pageCount: number;
  segmentCount: number;
  fingerprint: string; // Empreinte unique du document
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// PRIVACY & ANONYMISATION
// ============================================================

/** Niveau d'anonymisation */
export type AnonymizationLevel = 'FULL' | 'PARTIAL' | 'MINIMAL';

/** Document anonymisé prêt au partage */
export interface AnonymizedDocument {
  id: string; // ID interne
  sourceUniversityCode: string;
  originalDocumentId: string; // ID original (hash)
  
  // Métadonnées (partiellement anonymisées)
  titleHash: string;
  abstractHash: string;
  authorInitials: string; // Seules les initiales
  year: number;
  faculty: string;
  department: string;
  language: string;
  
  // Contenu haché (jamais en clair)
  segmentHashes: string[]; // SHA-256 par segment
  fingerprint: string; // Empreinte globale
  
  // Métadonnées techniques
  anonymizationLevel: AnonymizationLevel;
  anonymizedAt: Date;
  expiresAt: Date; // TTL pour les données partagées
  version: number;
}

/** Consentement de partage */
export interface SharingConsent {
  id: string;
  documentId: string;
  universityId: string;
  granted: boolean;
  grantedBy: string; // User ID
  grantedAt: Date;
  scope: 'metadata_only' | 'hashes_only' | 'full_anonymized';
  revocable: boolean;
  revokedAt?: Date;
}

// ============================================================
// STATISTIQUES & MÉTRIQUES
// ============================================================

/** Statistiques d'une université partenaire */
export interface UniversityStats {
  universityId: string;
  totalDocuments: number;
  sharedDocuments: number;
  lastSyncAt: Date | null;
  lastSyncDuration: number; // ms
  avgResponseTime: number; // ms
  searchCountToday: number;
  searchCountTotal: number;
  matchRate: number; // Taux de correspondance moyen
  status: UniversityStatus;
  uptimePercentage: number;
}

/** Statistiques globales de la fédération */
export interface FederationStats {
  totalUniversities: number;
  activeUniversities: number;
  totalSharedDocuments: number;
  searchesToday: number;
  searchesTotal: number;
  avgProcessingTime: number; // ms
  lastGlobalSync: Date | null;
  topPartnerUniversities: { code: string; name: string; matchCount: number }[];
}

// ============================================================
// AUDIT & LOGS
// ============================================================

/** Types d'actions auditables */
export type FederationAction =
  | 'UNIVERSITY_ADDED'
  | 'UNIVERSITY_REMOVED'
  | 'UNIVERSITY_STATUS_CHANGED'
  | 'SYNC_INITIATED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'SEARCH_PERFORMED'
  | 'SEARCH_RESULT_ACCESSED'
  | 'DATA_SHARED'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'CONFIG_UPDATED'
  | 'API_KEY_ROTATED'
  | 'RATE_LIMIT_EXCEEDED';

/** Entrée de log d'audit */
export interface FederationAuditLog {
  id: string;
  action: FederationAction;
  userId?: string;
  universityId?: string;
  targetUniversityId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// ============================================================
// CLIENT HTTP FÉDÉRATION
// ============================================================

/** Configuration du client fédération */
export interface FederationClientConfig {
  timeout: number; // ms
  retries: number;
  retryDelay: number; // ms base
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
  rateLimitEnabled: boolean;
  rateLimitRpm: number;
}

/** Réponse standardisée du client */
export interface FederationClientResponse<T> {
  success: boolean;
  data?: T;
  error?: FederationError;
  cached: boolean;
  responseTime: number;
  fromCache: boolean;
  timestamp: Date;
}

/** Erreur normalisée */
export interface FederationError {
  code: 'NETWORK_ERROR' | 'TIMEOUT' | 'AUTH_FAILED' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN';
  message: string;
  statusCode?: number;
  retryable: boolean;
}

// ============================================================
// INVITATIONS & ONBOARDING
// ============================================================

/** Statut d'invitation */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';

/** Invitation à rejoindre la fédération */
export interface FederationInvitation {
  id: string;
  inviteCode: string; // Code unique pour l'invitation
  invitedUniversityName: string;
  invitedEmail: string;
  invitedBy: string; // User ID
  status: InvitationStatus;
  message?: string;
  permissions: FederationPermissions;
  expiresAt: Date;
  respondedAt?: Date;
  createdAt: Date;
}

/** Permissions accordées à une université */
export interface FederationPermissions {
  canSearch: boolean;
  canShareData: boolean;
  canViewStats: boolean;
  canManageInvitations: boolean;
  maxDocumentsShareable: number; // -1 = illimité
  allowedScopes: ('faculty' | 'department' | 'all')[];
}
