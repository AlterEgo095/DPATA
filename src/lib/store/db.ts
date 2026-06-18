// Store local JSON pour la plateforme anti-plagiat
// Persistance simple basée sur fichiers JSON (suffisante pour démo / Chapitre IV)

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export type UserRole = 'SUPER_ADMIN' | 'FACULTY_ADMIN' | 'TEACHER' | 'STUDENT';

export interface Faculty {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  facultyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  level: string;
  academicYear: string;
  isActive: boolean;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string; // simple hash for demo
  firstName: string;
  lastName: string;
  matricule?: string;
  role: UserRole;
  isActive: boolean;
  facultyId?: string;
  departmentId?: string;
  promotionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  type: 'TFC' | 'MEMOIRE' | 'THESE' | 'ARTICLE' | 'AUTRE';
  subject?: string;
  abstract?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  textExtract?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'ANALYZING' | 'ANALYZED' | 'REJECTED' | 'VALIDATED';
  facultyId: string;
  departmentId: string;
  promotionId?: string;
  academicYear: string;
  uploadedById: string;
  supervisedById?: string;
  keywords?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Analysis {
  id: string;
  documentId: string;
  triggeredById: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  globalScore?: number;
  matchedSegments?: number;
  totalSegments?: number;
  threshold: number;
  scope: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
}

export interface Match {
  id: string;
  analysisId: string;
  querySegmentIndex: number;
  querySegmentText: string;
  sourceDocumentId: string;
  sourceSegmentIndex: number;
  sourceSegmentText: string;
  semanticScore: number;
  lexicalScore: number;
  matchType: 'COPY_PASTE' | 'PARAPHRASE' | 'REFORMULATION' | 'TRANSLATION' | 'WEAK_MATCH';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface DB {
  faculties: Faculty[];
  departments: Department[];
  promotions: Promotion[];
  users: User[];
  documents: Document[];
  analyses: Analysis[];
  matches: Match[];
  auditLogs: AuditLog[];
  settings: Record<string, string>;
}

// ============================================================
// Initial state with super admin
// ============================================================

const DEFAULT_DB: DB = {
  faculties: [],
  departments: [],
  promotions: [],
  users: [
    {
      id: 'u-super-admin',
      email: 'admin@unikin.ac.cd',
      passwordHash: 'admin123', // en clair pour démo — à hasher en prod
      firstName: 'Super',
      lastName: 'Administrateur',
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  documents: [],
  analyses: [],
  matches: [],
  auditLogs: [],
  settings: {
    'ia.threshold': '0.80',
    'ia.model': 'distiluse-base-multilingual-cased-v1',
    'ia.scope': 'faculty',
    'app.name': 'PlagiatIA — UNIKIN',
    'app.university': 'Université de Kinshasa',
  },
};

// ============================================================
// File-based persistence
// ============================================================

let cache: DB | null = null;
let writeLock = false;

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

export async function loadDB(): Promise<DB> {
  if (cache) return cache;
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    cache = JSON.parse(raw);
  } catch {
    cache = { ...DEFAULT_DB };
    await saveDB(cache);
  }
  return cache!;
}

export async function saveDB(db: DB): Promise<void> {
  if (writeLock) {
    // wait
    while (writeLock) await new Promise(r => setTimeout(r, 50));
  }
  writeLock = true;
  try {
    await ensureDataDir();
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    cache = db;
  } finally {
    writeLock = false;
  }
}

// ============================================================
// Helpers CRUD
// ============================================================

export function genId(prefix: string = 'id'): string {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export async function audit(
  userId: string | undefined,
  userName: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  details?: any,
  ipAddress?: string
) {
  const db = await loadDB();
  db.auditLogs.unshift({
    id: genId('log'),
    userId,
    userName,
    action,
    entity,
    entityId,
    details: details ? JSON.stringify(details) : undefined,
    ipAddress,
    createdAt: now(),
  });
  // Garde les 1000 derniers logs
  if (db.auditLogs.length > 1000) db.auditLogs = db.auditLogs.slice(0, 1000);
  await saveDB(db);
}
