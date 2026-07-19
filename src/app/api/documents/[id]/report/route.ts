// GET /api/documents/[id]/report
// Génère un rapport HTML imprimable (convertible en PDF via navigateur)
import { NextRequest, NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const db = await loadDB();
  const doc = db.documents.find(d => d.id === id);
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });

  const analysis = db.analyses.find(a => a.documentId === id && a.status === 'COMPLETED');
  const matches = analysis ? db.matches.filter(m => m.analysisId === analysis.id) : [];

  const score = analysis?.globalScore || 0;
  const scorePct = (score * 100).toFixed(1);
  const verdict = score >= 0.5 ? 'Plagiat probable' : score >= 0.3 ? 'Similarité élevée' : score >= 0.15 ? 'Similarité modérée' : 'Faible similarité';
  const verdictColor = score >= 0.5 ? '#dc2626' : score >= 0.3 ? '#ea580c' : score >= 0.15 ? '#d97706' : '#16a34a';

  const matchesByType: Record<string, number> = {};
  for (const m of matches) {
    matchesByType[m.matchType] = (matchesByType[m.matchType] || 0) + 1;
  }

  const matchTypeLabels: Record<string, string> = {
    COPY_PASTE: 'Copier-coller strict',
    PARAPHRASE: 'Paraphrase',
    REFORMULATION: 'Reformulation',
    TRANSLATION: 'Traduction',
    WEAK_MATCH: 'Similarité faible',
  };

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport d'analyse - ${escapeHtml(doc.title)}</title>
<style>
  @page { size: A4; margin: 2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1e293b; line-height: 1.5; font-size: 12pt; }
  .header { text-align: center; padding-bottom: 20px; border-bottom: 3px solid #059669; margin-bottom: 30px; }
  .header h1 { color: #059669; font-size: 18pt; margin-bottom: 5px; }
  .header .subtitle { color: #64748b; font-size: 10pt; }
  .header .institution { font-size: 11pt; font-weight: bold; margin-top: 5px; }
  .section { margin-bottom: 25px; }
  .section-title { color: #1e293b; font-size: 14pt; border-left: 4px solid #059669; padding-left: 10px; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 11pt; }
  .info-item { padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
  .info-label { color: #64748b; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-weight: 600; }
  .score-block { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px solid ${verdictColor}; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
  .score-value { font-size: 36pt; font-weight: bold; color: ${verdictColor}; }
  .score-label { color: #475569; font-size: 11pt; margin-top: 5px; }
  .score-verdict { display: inline-block; background: ${verdictColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 10pt; margin-top: 8px; }
  .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 15px 0; }
  .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
  .stat-num { font-size: 18pt; font-weight: bold; color: #1e293b; }
  .stat-label { font-size: 9pt; color: #64748b; margin-top: 3px; }
  .match { margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .match-header { background: #f1f5f9; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10pt; }
  .match-type { font-weight: bold; padding: 2px 8px; border-radius: 3px; background: #fef3c7; color: #92400e; }
  .match-scores { color: #475569; }
  .match-segment { padding: 10px 12px; }
  .match-segment-query { background: #fef2f2; border-left: 3px solid #dc2626; padding: 8px 12px; margin: 5px 0; font-size: 10pt; }
  .match-segment-source { background: #fffbeb; border-left: 3px solid #d97706; padding: 8px 12px; margin: 5px 0; font-size: 10pt; }
  .match-segment-label { font-size: 8pt; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 9pt; color: #64748b; }
  .no-match { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 30px; text-align: center; }
  .no-match h3 { color: #16a34a; font-size: 16pt; margin-bottom: 8px; }
  @media print { .no-print { display: none; } body { font-size: 10pt; } }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 11pt; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-btn:hover { background: #047857; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer / PDF</button>

<div class="header">
  <h1>Plateforme PlagiatIA</h1>
  <div class="subtitle">Rapport d'analyse automatique du plagiat</div>
  <div class="institution">Université de Kinshasa — Faculté des Sciences</div>
</div>

<div class="section">
  <div class="section-title">Informations du document</div>
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Titre</div>
      <div class="info-value">${escapeHtml(doc.title)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Type</div>
      <div class="info-value">${doc.type}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Auteur</div>
      <div class="info-value">${doc.uploadedBy ? escapeHtml(`${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`) : '—'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Année académique</div>
      <div class="info-value">${doc.academicYear}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Faculté</div>
      <div class="info-value">${escapeHtml(doc.faculty?.name || '—')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Département</div>
      <div class="info-value">${escapeHtml(doc.department?.name || '—')}</div>
    </div>
    ${doc.subject ? `<div class="info-item" style="grid-column: 1 / -1;"><div class="info-label">Sujet</div><div class="info-value">${escapeHtml(doc.subject)}</div></div>` : ''}
  </div>
</div>

${analysis ? `
<div class="section">
  <div class="section-title">Résultats de l'analyse IA</div>
  <div class="score-block">
    <div class="score-value">${scorePct}%</div>
    <div class="score-label">Score global de similarité</div>
    <div class="score-verdict">${verdict}</div>
  </div>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-num">${analysis.matchedSegments || 0}</div>
      <div class="stat-label">Segments matchés</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${analysis.totalSegments || 0}</div>
      <div class="stat-label">Segments total</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${matches.length}</div>
      <div class="stat-label">Correspondances</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${analysis.threshold}</div>
      <div class="stat-label">Seuil cosinus</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${(analysis.metadata as any)?.processingTimeMs ?? '—'}</div>
      <div class="stat-label">Temps (ms)</div>
    </div>
  </div>
  ${Object.keys(matchesByType).length > 0 ? `
  <div style="margin-top: 15px;">
    <strong>Répartition par type :</strong>
    ${Object.entries(matchesByType).map(([type, count]) => `<span style="display: inline-block; margin: 3px 5px; padding: 3px 10px; background: #f1f5f9; border-radius: 12px; font-size: 10pt;">${matchTypeLabels[type] || type}: ${count}</span>`).join('')}
  </div>` : ''}
</div>

${matches.length > 0 ? `
<div class="section">
  <div class="section-title">Détail des correspondances (${matches.length})</div>
  ${matches.map((m, i) => `
  <div class="match">
    <div class="match-header">
      <span><strong>Match #${i + 1}</strong> — <span class="match-type">${matchTypeLabels[m.matchType] || m.matchType}</span></span>
      <span class="match-scores">Sémantique: <strong>${(m.semanticScore * 100).toFixed(1)}%</strong> | Lexical: <strong>${(m.lexicalScore * 100).toFixed(1)}%</strong></span>
    </div>
    <div class="match-segment">
      <div class="match-segment-label">Segment analysé #${m.querySegmentIndex + 1}</div>
      <div class="match-segment-query">${escapeHtml(m.querySegmentText)}</div>
      <div class="match-segment-label">Source #${m.sourceSegmentIndex + 1}</div>
      <div class="match-segment-source">${escapeHtml(m.sourceSegmentText)}</div>
    </div>
  </div>`).join('')}
</div>` : `
<div class="section">
  <div class="no-match">
    <h3>✓ Aucune similarité détectée</h3>
    <p>Le document ne présente pas de correspondances significatives avec les autres travaux du corpus.</p>
  </div>
</div>`}
` : `
<div class="section">
  <div class="no-match">
    <h3>Aucune analyse disponible</h3>
    <p>Veuillez lancer l'analyse IA depuis la plateforme pour générer ce rapport.</p>
  </div>
</div>`}

<div class="footer">
  Rapport généré le ${new Date().toLocaleString('fr-FR')} par PlagiatIA<br>
  Université de Kinshasa — Année académique ${doc.academicYear}
</div>

</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="rapport_${id}.html"`,
    },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
