// Structured logging system for DPATA
import { promises as fs } from 'fs';
import path from 'path';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  userId?: string;
  ip?: string;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

let logBuffer: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

async function ensureLogDir() {
  try { await fs.mkdir(LOG_DIR, { recursive: true }); } catch {}
}

async function flushLogs() {
  if (logBuffer.length === 0) return;
  const logsToWrite = [...logBuffer];
  logBuffer = [];
  
  try {
    await ensureLogDir();
    const lines = logsToWrite.map(l => JSON.stringify(l)).join('\n');
    await fs.appendFile(LOG_FILE, lines + '\n', 'utf-8');
  } catch (e) {
    console.error('Failed to write logs:', e);
  }
}

export function createLogger(moduleName: string) {
  return {
    debug(message: string, data?: any) {
      log('DEBUG', moduleName, message, data);
    },
    info(message: string, data?: any) {
      log('INFO', moduleName, message, data);
    },
    warn(message: string, data?: any) {
      log('WARN', moduleName, message, data);
    },
    error(message: string, data?: any) {
      log('ERROR', moduleName, message, data);
    },
    critical(message: string, data?: any) {
      log('CRITICAL', moduleName, message, data);
    },
  };
}

async function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: any,
  userId?: string,
  ip?: string
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data,
    userId,
    ip,
  };

  // Console output with colors
  const colors = { DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARN: '\x1b[33m', ERROR: '\x1b[31m', CRITICAL: '\x1b[35m' };
  const reset = '\x1b[0m';
  console.log(`${colors[level]}[${level}]\x1b[0m [${module}] ${message}`, data || '');

  // Buffer for file output
  logBuffer.push(entry);
  
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushLogs().finally(() => { flushTimeout = null; });
    }, 1000); // Flush every second
  }

  // Immediate flush for critical errors
  if (level === 'CRITICAL' || level === 'ERROR') {
    flushLogs();
  }
}

// Export default logger
export const logger = createLogger('app');

// Get recent logs (for dashboard)
export async function getRecentLogs(count: number = 100): Promise<LogEntry[]> {
  try {
    await ensureLogDir();
    const raw = await fs.readFile(LOG_FILE, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-count).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}
