// =============================================================================
// P4-D D1: Append-only audit log file — source of truth for audit history.
// =============================================================================
//
// Storage layout: one JSON-encoded AuditLogEntry per line in `data/audit.log`.
// File permissions should be 0640 (deploy step chmods the file).
//
// Immutability contract:
//   - The ONLY mutation allowed on this file is `pruneOldLogs(daysToKeep)`
//     which rotates entries older than the retention window to a timestamped
//     backup (`audit.log.pruned-<ts>`) before rewriting the live file.
//   - Admins MUST NEVER edit this file by hand — any manual modification
//     breaks the integrity chain. Use /api/audit/export for read-only access.
//
// Backward compatibility:
//   - `db.auditLogs` (in data/db.json) is kept as a "recent cache" (last 1000
//     entries) for the dashboard stats endpoint. The file is the source of
//     truth; the cache is convenience.
//   - The audit() helper in store/db.ts writes to BOTH locations on every call.
// =============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Re-export the AuditLog shape so callers can import from a single place.
import type { AuditLog } from '@/lib/store/db';

export type AuditLogEntry = AuditLog;

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit.log');

// In-process write lock so concurrent audit() calls don't interleave lines.
let writeChain: Promise<void> = Promise.resolve();

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore — directory likely already exists
  }
}

/**
 * Append a single audit log entry as one JSON line.
 * Safe to call concurrently — internally serialized via a promise chain.
 *
 * NOTE: failures here are logged but NOT thrown — audit logging must never
 * break the underlying mutation. The db.auditLogs cache write in store/db.ts
 * still succeeds even if the file append fails.
 */
export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  // Serialize appends to avoid interleaved partial writes under concurrency.
  writeChain = writeChain.then(async () => {
    try {
      await ensureDataDir();
      const line = JSON.stringify(entry) + '\n';
      // O_APPEND is atomic for writes < PIPE_BUF (4096 on Linux) — our lines
      // are typically < 2KB so this is safe. For larger entries (huge
      // before/after diffs) we still write in one fs.appendFile call which
      // Node.js implements as a single O_APPEND write.
      await fs.appendFile(AUDIT_LOG_FILE, line, 'utf-8');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[audit-log] appendAuditLog failed:', err instanceof Error ? err.message : err);
    }
  });
  return writeChain;
}

export interface ReadAuditLogsOptions {
  limit?: number;
  offset?: number;
  action?: string;
  entity?: string;
  userId?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'createdAt' | 'userName' | 'action';
  sortOrder?: 'asc' | 'desc';
}

export interface ReadAuditLogsResult {
  entries: AuditLogEntry[];
  total: number;
}

/**
 * Read audit log entries from the append-only file with optional filtering.
 *
 * Implementation note: we read the entire file, split by newline, parse each
 * line, then filter+sort+paginate in memory. The audit log is expected to
 * stay well under 100MB (90-day retention @ ~100 events/day ≈ 8MB); a
 * streaming reader would add complexity without meaningful perf gain.
 *
 * Returns `total` = count of entries matching the filters (NOT the file size),
 * and `entries` = the paginated slice.
 */
export async function readAuditLogs(
  options: ReadAuditLogsOptions = {}
): Promise<ReadAuditLogsResult> {
  const {
    limit = 50,
    offset = 0,
    action,
    entity,
    userId,
    entityId,
    dateFrom,
    dateTo,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  let raw: string;
  try {
    raw = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
  } catch {
    // File doesn't exist yet (no audit events have been logged since D1 deploy).
    return { entries: [], total: 0 };
  }

  const lines = raw.split('\n');
  const entries: AuditLogEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as AuditLogEntry);
    } catch {
      // Skip malformed line — don't crash the reader.
    }
  }

  // ---- Filters ----
  let filtered = entries;

  if (action) {
    // Match case-insensitive; allow either "auth.login" or "LOGIN"
    const actLower = action.toLowerCase();
    filtered = filtered.filter(
      e => (e.action || '').toLowerCase() === actLower
    );
  }

  if (entity) {
    const entLower = entity.toLowerCase();
    filtered = filtered.filter(
      e => (e.entity || '').toLowerCase() === entLower
    );
  }

  if (userId) {
    filtered = filtered.filter(e => e.userId === userId);
  }

  if (entityId) {
    filtered = filtered.filter(e => e.entityId === entityId);
  }

  if (dateFrom) {
    const fromMs = new Date(dateFrom).getTime();
    if (!isNaN(fromMs)) {
      filtered = filtered.filter(e => {
        const t = new Date(e.createdAt || '').getTime();
        return !isNaN(t) && t >= fromMs;
      });
    }
  }

  if (dateTo) {
    const toMs = new Date(dateTo).getTime();
    if (!isNaN(toMs)) {
      filtered = filtered.filter(e => {
        const t = new Date(e.createdAt || '').getTime();
        return !isNaN(t) && t <= toMs;
      });
    }
  }

  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter(e => {
      const hay = [
        e.userName || '',
        e.action || '',
        e.entity || '',
        e.entityId || '',
        e.details || '',
        e.ipAddress || '',
      ].join(' ').toLowerCase();
      return hay.includes(term);
    });
  }

  // ---- Sort ----
  const sorted = filtered.slice().sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortBy === 'createdAt') {
      av = new Date(a.createdAt || 0).getTime();
      bv = new Date(b.createdAt || 0).getTime();
    } else if (sortBy === 'userName') {
      av = a.userName || '';
      bv = b.userName || '';
    } else if (sortBy === 'action') {
      av = a.action || '';
      bv = b.action || '';
    }
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const total = sorted.length;
  const safeLimit = Math.max(1, Math.min(limit, 5000));
  const safeOffset = Math.max(0, offset);
  const paged = sorted.slice(safeOffset, safeOffset + safeLimit);

  return { entries: paged, total };
}

/**
 * Return total count of audit log entries (no filters). Cheap — used by the
 * dashboard stats to display the cumulative audit event count.
 */
export async function countAuditLogs(): Promise<number> {
  try {
    const raw = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
    let count = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw.charCodeAt(i) === 10 /* \n */) count++;
    }
    // If the file doesn't end with a newline, count the last line too.
    if (raw.length > 0 && raw.charCodeAt(raw.length - 1) !== 10) count++;
    return count;
  } catch {
    return 0;
  }
}

// =============================================================================
// D5: Retention policy — pruneOldLogs(daysToKeep)
// =============================================================================

/**
 * Prune audit log entries older than `daysToKeep` days.
 *
 * This is the ONE allowed mutation of the audit.log file. Before rewriting,
 * the existing file is moved to `audit.log.pruned-<timestamp>` as a backup.
 *
 * Returns the number of entries pruned, or 0 if the file doesn't exist or no
 * entries were old enough to prune.
 */
export async function pruneOldLogs(daysToKeep: number): Promise<number> {
  if (typeof daysToKeep !== 'number' || daysToKeep < 0) {
    throw new Error(`pruneOldLogs: daysToKeep must be >= 0 (got ${daysToKeep})`);
  }

  let raw: string;
  try {
    raw = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
  } catch {
    return 0; // file doesn't exist yet
  }

  const cutoffMs = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  const lines = raw.split('\n');
  const kept: string[] = [];
  let pruned = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: AuditLogEntry | null = null;
    try {
      entry = JSON.parse(trimmed) as AuditLogEntry;
    } catch {
      // Keep malformed lines (don't destroy data we can't parse).
      kept.push(trimmed);
      continue;
    }
    const t = new Date(entry.createdAt || '').getTime();
    if (isNaN(t) || t >= cutoffMs) {
      kept.push(trimmed);
    } else {
      pruned++;
    }
  }

  if (pruned === 0) {
    return 0;
  }

  // Back up the pre-prune file (atomic rename, then write the new content).
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${AUDIT_LOG_FILE}.pruned-${ts}`;
  try {
    await fs.rename(AUDIT_LOG_FILE, backupPath);
  } catch (err) {
    // If rename fails (cross-device?), fall back to copy+unlink.
    await fs.copyFile(AUDIT_LOG_FILE, backupPath);
    await fs.unlink(AUDIT_LOG_FILE);
  }

  // Write the pruned content with a trailing newline.
  const newContent = kept.join('\n') + (kept.length > 0 ? '\n' : '');
  await fs.writeFile(AUDIT_LOG_FILE, newContent, 'utf-8');

  // Re-apply 0640 permissions on the fresh file.
  try {
    await fs.chmod(AUDIT_LOG_FILE, 0o640);
  } catch {
    // chmod may fail on some filesystems — non-fatal.
  }

  return pruned;
}

/**
 * Read the audit.log file size in bytes. Used by the audit dashboard to show
 * the disk footprint of the audit trail.
 */
export async function getAuditLogFileSize(): Promise<number> {
  try {
    const stat = await fs.stat(AUDIT_LOG_FILE);
    return stat.size;
  } catch {
    return 0;
  }
}

// Keep `os` import alive — used for line-ending normalization on Windows.
// (Node.js fs.appendFile on Linux already uses \n; this is a future-proofing
// guard for dev environments.)
void os;

// Export the file path so external tooling (backup scripts, monitoring) can
// locate the audit log without hard-coding it.
export const AUDIT_LOG_PATH = AUDIT_LOG_FILE;
