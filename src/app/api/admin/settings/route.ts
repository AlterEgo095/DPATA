// /api/admin/settings - Fixed: handles both dict and array formats
// P4-A FIX (A7): Added Zod validation, prototype-pollution sanitization
// in deepMerge, and audit logging on PUT.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB, saveDB, audit } from '@/lib/store/db';
import { z } from 'zod';

const DEFAULT_SETTINGS: Record<string, any> = {
  ai: {
    primaryModel: 'glm-4.5-flash',
    fallbackEnabled: true,
    fallbackModels: ['glm-4.7-flash'],
    temperature: 0.3,
    maxTokens: 4096,
    timeoutMs: 60000,
  },
  detection: {
    defaultThreshold: 0.15,
    maxCorpusDocuments: 15,
    maxSegmentsPerDoc: 100,
    minWordsPerSegment: 5,
    maxWordsPerSegment: 60,
    enableHybrid: true,
    hybridWeightTfidf: 0.4,
    hybridWeightLlm: 0.6,
  },
  platform: {
    name: 'PlagiatIA',
    institution: 'UNIKIN',
    academicYear: '2025-2026',
    maxFileSizeMB: 50,
    allowedFileTypes: ['pdf', 'docx', 'txt', 'md'],
    maintenanceMode: false,
  },
  security: {
    maxLoginAttempts: 5,
    sessionTimeoutMinutes: 480,
    passwordMinLength: 8,
    requireEmailVerification: false,
  },
};

// ============================================================
// P4-A (A7): Zod validation schema for settings PUT body.
// Only the 4 known top-level sections are allowed; within each section
// only primitive values (string/number/boolean) or arrays of primitives
// are accepted. This blocks unknown sections and arbitrary object nesting
// (which is where prototype pollution would be smuggled in).
// ============================================================

const primitiveValue = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(200)).max(50),
  z.array(z.number().finite()).max(50),
]);

const SettingsSectionSchema = z.record(z.string(), primitiveValue).default({});

const SettingsUpdateSchema = z
  .object({
    ai: SettingsSectionSchema.optional(),
    detection: SettingsSectionSchema.optional(),
    platform: SettingsSectionSchema.optional(),
    security: SettingsSectionSchema.optional(),
  })
  .strict() // reject unknown top-level keys
  .default({});

type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

/**
 * P4-A (A7): recursively strip prototype-pollution keys from any object.
 * Removes `__proto__`, `constructor`, and `prototype` at every level.
 * This is defense-in-depth on top of Zod validation.
 */
function sanitizeObject<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map(sanitizeObject) as unknown as T;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      // P4-A: strip prototype-pollution keys at every level
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      out[key] = sanitizeObject(value);
    }
    return out as unknown as T;
  }
  return input;
}

function deepMerge(target: any, source: any): any {
  // P4-A (A7): sanitize source before merge to strip __proto__/constructor/prototype.
  const safeSource = sanitizeObject(source);
  const output: Record<string, any> = { ...target };
  for (const key of Object.keys(safeSource || {})) {
    // Defense-in-depth: also skip dangerous keys here (already stripped but
    // be paranoid about future refactors).
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    const sv = safeSource[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)
        && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      output[key] = deepMerge(tv, sv);
    } else {
      output[key] = sv;
    }
  }
  return output;
}

async function getSettings(db: any): Promise<Record<string, any>> {
  const raw = db.settings;
  let result: Record<string, any> = {};

  if (Array.isArray(raw)) {
    for (const s of raw) {
      try { result[s.key] = JSON.parse(s.value); } catch { result[s.key] = s.value; }
    }
  } else if (raw && typeof raw === 'object') {
    result = { ...raw };
  }

  return deepMerge(DEFAULT_SETTINGS, result);
}

async function saveSettingsToDB(db: any, updates: SettingsUpdate) {
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) {
    db.settings = {};
  }
  // P4-A: sanitize each section before storing
  for (const [section, values] of Object.entries(updates)) {
    if (values === undefined) continue;
    const safeValues = sanitizeObject(values);
    if (!db.settings[section] || typeof db.settings[section] !== 'object') {
      db.settings[section] = {};
    }
    db.settings[section] = { ...db.settings[section], ...safeValues };
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'FACULTY_ADMIN')) {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const db = await loadDB();
    const settings = await getSettings(db);
    if (section) {
      return NextResponse.json({ [section]: settings[section] || {} });
    }
    return NextResponse.json(settings);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acces reserve au super administrateur' }, { status: 403 });
    }
    const body = await req.json();

    // P4-A (A7): validate body against the Zod schema.
    const parsed = SettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Données invalides',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const db = await loadDB();

    // P4-A (A7): capture before-state for audit log
    const oldSettings = await getSettings(db);

    await saveSettingsToDB(db, parsed.data);
    await saveDB(db);

    // P4-A (A7): capture after-state for audit log
    const newSettings = await getSettings(db);

    // P4-A (A7): audit log entry — settings update
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || undefined;
    await audit(
      user.sub,
      `${user.firstName} ${user.lastName}`,
      'SETTINGS_UPDATE',
      'Settings',
      undefined,
      {
        before: oldSettings,
        after: newSettings,
        diff: parsed.data,
      },
      ip
    );

    return NextResponse.json({ success: true, message: 'Parametres mis a jour' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
