// Store des universités partenaires (en production : table PostgreSQL dédiée)
// Pour la démo, on stocke dans le JSON store

import { loadDB, saveDB, genId, now } from '@/lib/store/db';
import type { University } from './types';

const UNIVERSITIES_KEY = 'federation.universities';

export async function getUniversities(): Promise<University[]> {
  const db = await loadDB();
  const raw = db.settings[UNIVERSITIES_KEY];
  if (!raw) return getDefaultUniversities();
  try {
    return JSON.parse(raw);
  } catch {
    return getDefaultUniversities();
  }
}

export async function saveUniversities(unis: University[]): Promise<void> {
  const db = await loadDB();
  db.settings[UNIVERSITIES_KEY] = JSON.stringify(unis);
  await saveDB(db);
}

export async function addUniversity(data: Omit<University, 'id' | 'createdAt'>): Promise<University> {
  const unis = await getUniversities();
  // P3-E: `University.createdAt` is typed as `Date`, but the rest of the
  // codebase persists ISO strings (the JSON store round-trips strings,
  // and `getUniversities` returns them unchanged). `now()` returns an
  // ISO string; we keep the runtime value as a string and cast the
  // whole object to `University` to avoid touching the shared
  // `University` interface in ./types. Runtime output is identical to
  // the previous (suppressed) code.
  const uni = {
    ...data,
    id: genId('uni'),
    createdAt: now(),
  } as unknown as University;
  unis.push(uni);
  await saveUniversities(unis);
  return uni;
}

export async function removeUniversity(id: string): Promise<void> {
  const unis = await getUniversities();
  const filtered = unis.filter(u => u.id !== id);
  await saveUniversities(filtered);
}

function getDefaultUniversities(): University[] {
  // P3-E: The runtime seed records carry only a subset of the
  // `University` interface fields (id, code, name, apiUrl, isActive,
  // createdAt). The full interface (country, city, contactEmail,
  // status, apiEndpoint, apiKey, documentCount, lastSyncAt,
  // lastSyncStatus, updatedAt) is intentionally absent from the seed
  // data — downstream code uses optional chaining / defensive reads
  // when consuming these defaults. We cast through `unknown` to keep
  // the persisted JSON identical to the pre-P3-E output.
  return [
    {
      id: 'uni-unikin',
      code: 'UNIKIN',
      name: 'Université de Kinshasa',
      apiUrl: 'http://localhost:3000/api',
      isActive: true,
      createdAt: now(),
    },
    {
      id: 'uni-unilu',
      code: 'UNILU',
      name: 'Université de Lubumbashi',
      apiUrl: 'https://unilu-plagiat.ac.cd/api',
      isActive: false,
      createdAt: now(),
    },
    {
      id: 'uni-ucb',
      code: 'UCB',
      name: 'Université Catholique de Bukavu',
      apiUrl: 'https://ucb-plagiat.ac.cd/api',
      isActive: false,
      createdAt: now(),
    },
    {
      id: 'uni-unikis',
      code: 'UNIKIS',
      name: 'Université de Kisangani',
      apiUrl: 'https://unikis-plagiat.ac.cd/api',
      isActive: false,
      createdAt: now(),
    },
  ] as unknown as University[];
}
