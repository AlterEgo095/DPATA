// /api/admin/settings - Fixed: handles both dict and array formats
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { loadDB, saveDB } from '@/lib/store/db';

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

function deepMerge(target: any, source: any): any {
  const output: Record<string, any> = { ...target };
  for (const key of Object.keys(source || {})) {
    const sv = source[key];
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

async function saveSettingsToDB(db: any, updates: Record<string, any>) {
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) {
    db.settings = {};
  }
  for (const [section, values] of Object.entries(updates)) {
    if (!db.settings[section]) db.settings[section] = {};
    db.settings[section] = { ...db.settings[section], ...values };
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
    const db = await loadDB();
    await saveSettingsToDB(db, body);
    await saveDB(db);
    return NextResponse.json({ success: true, message: 'Parametres mis a jour' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
