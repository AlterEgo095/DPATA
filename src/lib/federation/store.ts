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
  const uni: University = {
    ...data,
    id: genId('uni'),
    createdAt: now(),
  };
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
  ];
}
