// Advanced Knowledge Base Management System for DPATA
// Provides comprehensive subject management, import, categorization, and analytics

import { loadDB, saveDB, genId, now, audit, type DB, type AcademicSubject } from './store/db';
import { logger } from './logger';
import { appCache, CACHE_KEYS } from './cache';

// ============================================================
// Type Definitions
// ============================================================

export interface KnowledgeBaseStats {
  totalSubjects: number;
  byDomain: Record<string, number>;
  byLevel: Record<string, number>;
  byWorkType: Record<string, number>;
  byFaculty: Record<string, number>;
  byStatus: Record<string, number>;
  recentAdditions: AcademicSubject[];
  topKeywords: Array<{ keyword: string; count: number }>;
  originalityDistribution: { original: number; suspicious: number; duplicate: number };
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
  subjects: AcademicSubject[];
}

export interface CategorizationOptions {
  facultyId?: string;
  departmentId?: string;
  domain?: string;
  level?: string;
  workType?: string;
  academicYear?: string;
  tags?: string[];
}

export interface SubjectSearchOptions {
  limit?: number;
  offset?: number;
  domains?: string[];
  faculties?: string[];
}

export interface SubjectFilters {
  domain?: string;
  facultyId?: string;
  workType?: string;
  level?: string;
  status?: string;
  search?: string;
}

// ============================================================
// Core CRUD Operations
// ============================================================

/**
 * Get all subjects with optional filtering and sorting
 */
export async function getSubjects(filters?: SubjectFilters): Promise<AcademicSubject[]> {
  const db = await loadDB();
  let subjects = db.academicSubjects || [];

  // Apply filters
  if (filters?.domain) {
    subjects = subjects.filter(s => 
      s.domain?.toLowerCase().includes(filters.domain!.toLowerCase())
    );
  }
  if (filters?.facultyId) {
    subjects = subjects.filter(s => s.facultyId === filters.facultyId);
  }
  if (filters?.workType) {
    subjects = subjects.filter(s => s.workType === filters.workType);
  }
  if (filters?.level) {
    subjects = subjects.filter(s => s.level === filters.level);
  }
  if (filters?.status) {
    subjects = subjects.filter(s => s.status === filters.status);
  }
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    subjects = subjects.filter(s => 
      s.title.toLowerCase().includes(searchLower) ||
      s.description?.toLowerCase().includes(searchLower) ||
      s.keywords?.toLowerCase().includes(searchLower)
    );
  }

  return subjects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get a single subject by ID
 */
export async function getSubjectById(id: string): Promise<AcademicSubject | null> {
  const db = await loadDB();
  return db.academicSubjects?.find(s => s.id === id) || null;
}

/**
 * Create a new subject with full validation and categorization options
 */
export async function createSubject(
  data: Partial<AcademicSubject>,
  userId: string,
  userName: string,
  options?: CategorizationOptions
): Promise<AcademicSubject> {
  const db = await loadDB();
  
  const subject: AcademicSubject = {
    id: genId('sub'),
    title: data.title || 'Sans titre',
    description: data.description,
    domain: data.domain || options?.domain,
    field: data.field,
    specialty: data.specialty || options?.tags?.join(', '),
    level: data.level || options?.level,
    keywords: data.keywords,
    objectives: data.objectives,
    problemStatement: data.problemStatement,
    facultyId: data.facultyId || options?.facultyId,
    departmentId: data.departmentId || options?.departmentId,
    academicYear: data.academicYear || options?.academicYear || new Date().getFullYear().toString(),
    authorName: data.authorName,
    workType: data.workType || options?.workType || 'MEMOIRE',
    status: 'PENDING',
    synonyms: data.synonyms,
    createdAt: now(),
    updatedAt: now(),
  };

  if (!db.academicSubjects) db.academicSubjects = [];
  db.academicSubjects.push(subject);
  
  await saveDB(db);
  appCache.invalidate(CACHE_KEYS.SUBJECTS);
  
  await audit(userId, userName, 'CREATE_SUBJECT', 'AcademicSubject', subject.id, { title: subject.title });
  logger.info('Subject created', { subjectId: subject.id, title: subject.title });

  return subject;
}

/**
 * Update an existing subject
 */
export async function updateSubject(
  id: string,
  data: Partial<AcademicSubject>,
  userId: string,
  userName: string
): Promise<AcademicSubject | null> {
  const db = await loadDB();
  const index = db.academicSubjects?.findIndex(s => s.id === id) ?? -1;
  
  if (index === -1) return null;

  const existing = db.academicSubjects![index];
  const updated: AcademicSubject = {
    ...existing,
    ...data,
    id, // Prevent ID changes
    updatedAt: now(),
  };

  db.academicSubjects![index] = updated;
  await saveDB(db);
  appCache.invalidate(CACHE_KEYS.SUBJECTS);

  await audit(userId, userName, 'UPDATE_SUBJECT', 'AcademicSubject', id, { title: updated.title });
  logger.info('Subject updated', { subjectId: id });

  return updated;
}

/**
 * Delete a subject (soft delete or hard delete)
 */
export async function deleteSubject(
  id: string,
  userId: string,
  userName: string,
  hardDelete: boolean = false
): Promise<boolean> {
  const db = await loadDB();
  const index = db.academicSubjects?.findIndex(s => s.id === id) ?? -1;
  
  if (index === -1) return false;

  if (hardDelete) {
    db.academicSubjects?.splice(index, 1);
  } else {
    // Soft delete - mark as rejected
    db.academicSubjects![index].status = 'REJECTED';
    db.academicSubjects![index].updatedAt = now();
  }

  await saveDB(db);
  appCache.invalidate(CACHE_KEYS.SUBJECTS);

  await audit(userId, userName, hardDelete ? 'DELETE_SUBJECT' : 'ARCHIVE_SUBJECT', 'AcademicSubject', id);
  logger.info('Subject deleted', { subjectId: id, hardDelete });

  return true;
}

// ============================================================
// Import Operations
// ============================================================

/**
 * Import subjects from various formats (CSV, JSON, Excel data)
 * Supports flexible field mapping for different source formats
 */
export async function importSubjects(
  data: Array<Record<string, any>>,
  format: 'csv' | 'json' | 'excel',
  userId: string,
  userName: string,
  options?: CategorizationOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    subjects: [],
  };

  const db = await loadDB();
  if (!db.academicSubjects) db.academicSubjects = [];

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i];
      
      // Validate required fields
      if (!row.title || typeof row.title !== 'string' || row.title.trim().length < 5) {
        result.errors.push({ row: i + 1, reason: 'Titre invalide (minimum 5 caractères)' });
        result.skipped++;
        continue;
      }

      const subject: AcademicSubject = {
        id: genId('sub'),
        title: row.title.trim(),
        description: row.description || row.description_fr || '',
        domain: row.domain || row.field || options?.domain,
        field: row.field || row.specialty,
        specialty: row.specialty || row.filiere,
        level: row.level || row.niveau || row.cycle || options?.level,
        keywords: row.keywords || row.mots_cles || row.tags,
        objectives: row.objectives || row.objectifs,
        problemStatement: row.problemStatement || row.problematique || row.question_recherche,
        facultyId: row.facultyId || row.faculte_id || options?.facultyId,
        departmentId: row.departmentId || row.departement_id || options?.departmentId,
        academicYear: row.academicYear || row.annee || row.annee_academique || options?.academicYear || new Date().getFullYear().toString(),
        authorName: row.authorName || row.auteur || row.etudiant,
        workType: row.workType || row.type_travail || row.type || options?.workType || 'MEMOIRE',
        status: 'VALIDATED',
        synonyms: row.synonyms || row.synonymes,
        createdAt: now(),
        updatedAt: now(),
      };

      db.academicSubjects.push(subject);
      result.subjects.push(subject);
      result.imported++;

    } catch (error: any) {
      result.errors.push({ row: i + 1, reason: error.message || 'Erreur inconnue' });
      result.skipped++;
    }
  }

  await saveDB(db);
  appCache.invalidate(CACHE_KEYS.SUBJECTS);

  await audit(userId, userName, 'IMPORT_SUBJECTS', 'AcademicSubject', undefined, {
    count: result.imported,
    format,
  });

  logger.info('Subjects imported', { count: result.imported, format, errors: result.errors.length });

  return result;
}

// ============================================================
// Statistics & Analytics
// ============================================================

/**
 * Get comprehensive statistics about the knowledge base
 * Results are cached for 5 minutes to improve performance
 */
export async function getKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
  // Check cache first
  const cached = appCache.get<KnowledgeBaseStats>(CACHE_KEYS.SUBJECT_STATS);
  if (cached) return cached;

  const db = await loadDB();
  const subjects = db.academicSubjects || [];

  // Initialize counters
  const byDomain: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  const byWorkType: Record<string, number> = {};
  const byFaculty: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const keywordCount: Record<string, number> = {};
  let original = 0, suspicious = 0, duplicate = 0;

  // Process each subject
  for (const s of subjects) {
    // Domain distribution
    const domain = s.domain || 'Non spécifié';
    byDomain[domain] = (byDomain[domain] || 0) + 1;

    // Level distribution
    const level = s.level || 'Non spécifié';
    byLevel[level] = (byLevel[level] || 0) + 1;

    // Work type distribution
    const wt = s.workType || 'AUTRE';
    byWorkType[wt] = (byWorkType[wt] || 0) + 1;

    // Faculty distribution
    const fac = s.facultyId || 'Non assigné';
    byFaculty[fac] = (byFaculty[fac] || 0) + 1;

    // Status distribution
    const status = s.status || 'PENDING';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Originality analysis
    if (s.isOriginal === false || (s.similarityScore && s.similarityScore > 0.5)) {
      duplicate++;
    } else if (s.similarityScore && s.similarityScore > 0.2) {
      suspicious++;
    } else {
      original++;
    }

    // Keyword extraction and counting
    if (s.keywords) {
      const kws = s.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 2);
      for (const kw of kws) {
        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
      }
    }
  }

  // Extract top 20 keywords
  const topKeywords = Object.entries(keywordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));

  // Recent additions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentAdditions = subjects
    .filter(s => new Date(s.createdAt) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const stats: KnowledgeBaseStats = {
    totalSubjects: subjects.length,
    byDomain,
    byLevel,
    byWorkType,
    byFaculty,
    byStatus,
    recentAdditions,
    topKeywords,
    originalityDistribution: { original, suspicious, duplicate },
  };

  // Cache for 5 minutes
  appCache.set(CACHE_KEYS.SUBJECT_STATS, stats, 300000);

  return stats;
}

// ============================================================
// Search Operations
// ============================================================

/**
 * Advanced search with relevance scoring
 * Returns paginated results sorted by relevance
 */
export async function searchSubjects(
  query: string,
  options?: SubjectSearchOptions
): Promise<{ subjects: AcademicSubject[]; total: number }> {
  const db = await loadDB();
  let subjects = db.academicSubjects || [];

  if (query && query.trim()) {
    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    
    // Calculate relevance score for each subject
    subjects = subjects.map(s => {
      const searchText = [
        s.title,
        s.description,
        s.keywords,
        s.domain,
        s.objectives,
        s.problemStatement,
      ].filter(Boolean).join(' ').toLowerCase();

      let score = 0;
      
      for (const term of searchTerms) {
        // Title matches are most important
        if (s.title.toLowerCase().includes(term)) score += 10;
        // Other text matches
        else if (searchText.includes(term)) score += 3;
        
        // Exact phrase match bonus
        if (query.toLowerCase().includes(s.title.toLowerCase())) score += 20;
      }

      return { subject: s, relevanceScore: score };
    })
    .filter(({ relevanceScore }) => relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .map(({ subject }) => subject);
  }

  // Apply additional filters
  if (options?.domains?.length) {
    subjects = subjects.filter(s => s.domain && options.domains!.includes(s.domain));
  }
  if (options?.faculties?.length) {
    subjects = subjects.filter(s => s.facultyId && options.faculties!.includes(s.facultyId));
  }

  const total = subjects.length;
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const paginatedSubjects = subjects.slice(offset, offset + limit);

  return { subjects: paginatedSubjects, total };
}

// ============================================================
// Export Operations
// ============================================================

/**
 * Export subjects for backup or sharing
 * Supports JSON and CSV formats
 */
export async function exportSubjects(
  format: 'json' | 'csv' = 'json',
  filters?: SubjectFilters
): Promise<string> {
  const subjects = await getSubjects(filters);

  if (format === 'json') {
    return JSON.stringify(subjects, null, 2);
  }

  // CSV export with proper escaping
  const headers = [
    'id', 'title', 'description', 'domain', 'field', 'specialty',
    'level', 'keywords', 'workType', 'status', 'authorName', 'createdAt'
  ];
  
  const rows = subjects.map(s => headers.map(h => {
    const val = (s as any)[h];
    if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return String(val ?? '');
  }).join(','));
  
  return [headers.join(','), ...rows].join('\n');
}

// ============================================================
// Batch Operations
// ============================================================

/**
 * Update status of multiple subjects at once
 */
export async function batchUpdateStatus(
  ids: string[],
  status: 'VALIDATED' | 'PENDING' | 'REJECTED',
  userId: string,
  userName: string
): Promise<{ updated: number; failed: number }> {
  const db = await loadDB();
  let updated = 0;
  let failed = 0;

  for (const id of ids) {
    const index = db.academicSubjects?.findIndex(s => s.id === id) ?? -1;
    if (index !== -1) {
      db.academicSubjects![index].status = status;
      db.academicSubjects![index].updatedAt = now();
      updated++;
    } else {
      failed++;
    }
  }

  await saveDB(db);
  appCache.invalidate(CACHE_KEYS.SUBJECTS);
  appCache.invalidate(CACHE_KEYS.SUBJECT_STATS);

  await audit(userId, userName, 'BATCH_UPDATE_STATUS', 'AcademicSubject', undefined, {
    ids: ids.length,
    status,
    updated,
    failed,
  });

  logger.info('Batch status update completed', { total: ids.length, updated, failed, status });

  return { updated, failed };
}

/**
 * Find similar subjects based on title comparison
 */
export async function findSimilarSubjects(
  title: string,
  threshold: number = 0.3,
  limit: number = 10
): Promise<Array<{ subject: AcademicSubject; similarity: number }>> {
  const db = await loadDB();
  const subjects = db.academicSubjects || [];
  
  const titleLower = title.toLowerCase().trim();
  const titleWords = new Set(titleLower.split(/\s+/).filter(w => w.length > 3));

  const results: Array<{ subject: AcademicSubject; similarity: number }> = [];

  for (const subject of subjects) {
    const subjectTitle = subject.title.toLowerCase().trim();
    const subjectWords = new Set(subjectTitle.split(/\s+/).filter(w => w.length > 3));

    // Calculate Jaccard similarity on words
    let intersection = 0;
    for (const word of titleWords) {
      if (subjectWords.has(word)) intersection++;
    }
    
    const union = new Set([...titleWords, ...subjectWords]).size;
    const similarity = union > 0 ? intersection / union : 0;

    // Also check substring containment
    let containsBonus = 0;
    if (subjectTitle.includes(titleLower) || titleLower.includes(subjectTitle)) {
      containsBonus = 0.3;
    }

    const totalSimilarity = Math.min(1, similarity + containsBonus);

    if (totalSimilarity >= threshold) {
      results.push({ subject, similarity: totalSimilarity });
    }
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Get subjects history for a specific time range
 */
export async function getSubjectsHistory(
  startDate: Date,
  endDate: Date
): Promise<{
  created: AcademicSubject[];
  updated: AcademicSubject[];
}> {
  const db = await loadDB();
  const subjects = db.academicSubjects || [];

  const created = subjects.filter(s => {
    const created = new Date(s.createdAt);
    return created >= startDate && created <= endDate;
  });

  const updated = subjects.filter(s => {
    const updated = new Date(s.updatedAt);
    return updated >= startDate && updated <= endDate && 
           new Date(s.createdAt) < startDate; // Only those not newly created
  });

  return {
    created: created.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    updated: updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  };
}
