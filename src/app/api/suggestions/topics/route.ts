// GET /api/suggestions/topics
// Retourne les thématiques sous-exploitées d'un département
import { NextRequest, NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { tokenize } from '@/lib/ia/engine';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  const db = await loadDB();

  let docs = db.documents;
  if (departmentId) {
    docs = docs.filter(d => d.departmentId === departmentId);
  }

  // Extraire tous les mots-clés des documents
  const keywordCounts: Record<string, number> = {};
  for (const doc of docs) {
    const text = `${doc.title} ${doc.subject || ''} ${doc.abstract || ''}`;
    const tokens = tokenize(text);
    for (const t of tokens) {
      keywordCounts[t] = (keywordCounts[t] || 0) + 1;
    }
  }

  // Trier par fréquence
  const sortedKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }));

  // Thématiques sous-exploitées (mots apparaissant peu)
  const underexplored = Object.entries(keywordCounts)
    .filter(([_, count]) => count === 1)
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(([word]) => word);

  // Thématiques saturées (mots apparaissant beaucoup)
  const saturated = sortedKeywords.slice(0, 10);

  return NextResponse.json({
    totalDocuments: docs.length,
    totalKeywords: Object.keys(keywordCounts).length,
    topKeywords: sortedKeywords.slice(0, 20),
    saturatedTopics: saturated,
    underexploredTopics: underexplored,
  });
}
