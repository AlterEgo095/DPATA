// PDF Templates for PlagiatIA Professional Reports
// Module v0.3 - Multiple Report Templates

import PDFDocument from 'pdfkit';
import {
  Colors,
  Typography,
  Layout,
  ComponentStyles,
  getVerdictInfo,
  MatchTypeLabels,
  DocumentTypeLabels,
  formatDate,
  truncateText,
  type AnalysisData,
} from './styles';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface MatchData {
  id: string;
  querySegmentIndex: number;
  querySegmentText: string;
  sourceDocumentId: string;
  sourceDocumentTitle?: string;
  sourceSegmentIndex: number;
  sourceSegmentText: string;
  semanticScore: number;
  lexicalScore: number;
  matchType: 'COPY_PASTE' | 'PARAPHRASE' | 'REFORMULATION' | 'TRANSLATION' | 'WEAK_MATCH' | 'AI_GENERATED';
}

export interface AnalysisData {
  // Document info
  documentId: string;
  documentTitle: string;
  documentType: string;
  documentSubject?: string;
  documentAbstract?: string;
  fileName: string;
  fileSize: number;
  
  // Author info
  authorName: string;
  authorEmail?: string;
  facultyName?: string;
  departmentName?: string;
  promotionName?: string;
  academicYear: string;
  
  // Analysis results
  analysisId: string;
  globalScore: number; // 0-1
  matchedSegments: number;
  totalSegments: number;
  threshold: number;
  scope: string;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
  
  // Matches
  matches: MatchData[];
  
  // Engine info
  engineType?: string;
  engineVersion?: string;
  modelVersion?: string;
  
  // Analyst (who triggered)
  analystName: string;
  analystRole?: string;
}

export type ReportFormat = 'full' | 'summary' | 'certificate';
export type ReportLanguage = 'fr' | 'en';

export interface TemplateOptions {
  format: ReportFormat;
  language: ReportLanguage;
  includeRecommendations?: boolean;
  includeMetadata?: boolean;
  maxMatches?: number;
}

// ============================================================
// TRANSLATIONS
// ============================================================

const Translations = {
  fr: {
    // Header
    platformName: 'PlagiatIA',
    reportTitle: "Rapport d'Analyse de Plagiat",
    certificateTitle: "Certificat d'Originalité",
    summaryReportTitle: "Synthèse d'Analyse",
    
    // Sections
    executiveSummary: 'Résumé Exécutif',
    documentInfo: 'Informations du Document',
    analysisResults: 'Résultats de l\'Analyse',
    matchDetails: 'Détail des Correspondances',
    statistics: 'Statistiques Détaillées',
    recommendations: 'Recommandations',
    auditMetadata: 'Métadonnées d\'Audit',
    
    // Labels
    documentTitle: 'Titre',
    documentType: 'Type',
    subject: 'Sujet',
    author: 'Auteur',
    academicYear: 'Année Académique',
    faculty: 'Faculté',
    department: 'Département',
    promotion: 'Promotion',
    
    globalScore: 'Score Global de Similarité',
    verdict: 'Verdict',
    matchedSegments: 'Segments Matchés',
    totalSegments: 'Segments Total',
    matchesCount: 'Correspondances',
    threshold: 'Seuil de Similarité',
    scope: 'Portée d\'Analyse',
    processingTime: 'Temps de Traitement',
    
    matchNumber: 'Correspondance #',
    matchType: 'Type',
    semanticScore: 'Score Sémantique',
    lexicalScore: 'Score Lexical',
    analyzedSegment: 'Segment Analysé',
    sourceSegment: 'Segment Source',
    
    engineUsed: 'Moteur Utilisé',
    engineVersion: 'Version du Moteur',
    modelVersion: 'Version du Modèle',
    analysisDate: 'Date d\'Analyse',
    analysisId: 'Identifiant d\'Analyse',
    generatedBy: 'Généré par',
    generatedAt: 'Généré le',
    
    // Verdicts
    original: 'Document Original',
    lowSimilarity: 'Faible Similarité',
    moderateSimilarity: 'Similarité Modérée',
    highSimilarity: 'Similarité Élevée',
    probablePlagiarism: 'Plagiat Probable',
    
    // Certificate
    certifiesThat: 'Certifie que le document',
    titled: 'intitulé',
    submittedBy: 'soumis par',
    hasBeenAnalyzed: 'a été analysé et présente un taux de similarité de',
    thisScoreIndicates: 'Ce score indique',
    originalContent: 'un contenu original, sans plagiat détecté.',
    lowSimilarityContent: 'une faible similarité avec les documents existants.',
    moderateSimilarityContent: 'une similarité modérée nécessitant une vérification manuelle.',
    highSimilarityContent: 'une similarité élevée requérant une attention particulière.',
    plagiarismContent: 'un taux de plagiat probable nécessitant une investigation approfondie.',
    issuedOn: 'Délivré le',
    validSignature: 'Signature Valide',
    verificationCode: 'Code de Vérification',
    
    // Footer
    institution: 'Université de Kinshasa — Faculté des Sciences',
    confidential: 'Confidentiel — Usage Académique Uniquement',
    page: 'Page',
    
    // Recommendations
    recommendationOriginal: 'Le document semble original. Aucune action requise.',
    recommendationLow: 'Quelques similarités mineures détectées. Vérification optionnelle suggérée.',
    recommendationModerate: 'Des sections présentent une similarité modérée. Une révision est recommandée.',
    recommendationHigh: 'Plusieurs sections à haut risque identifiées. Révision obligatoire recommandée.',
    recommendationPlagiarism: 'Plagiat probable détecté. Investigation approfondie et corrections nécessaires.',
  },
  en: {
    platformName: 'PlagiatIA',
    reportTitle: 'Plagiarism Analysis Report',
    certificateTitle: 'Certificate of Originality',
    summaryReportTitle: 'Analysis Summary',
    
    // Sections
    executiveSummary: 'Executive Summary',
    documentInfo: 'Document Information',
    analysisResults: 'Analysis Results',
    matchDetails: 'Match Details',
    statistics: 'Detailed Statistics',
    recommendations: 'Recommendations',
    auditMetadata: 'Audit Metadata',
    
    // Labels
    documentTitle: 'Title',
    documentType: 'Type',
    subject: 'Subject',
    author: 'Author',
    academicYear: 'Academic Year',
    faculty: 'Faculty',
    department: 'Department',
    promotion: 'Promotion',
    
    globalScore: 'Global Similarity Score',
    verdict: 'Verdict',
    matchedSegments: 'Matched Segments',
    totalSegments: 'Total Segments',
    matchesCount: 'Matches',
    threshold: 'Similarity Threshold',
    scope: 'Analysis Scope',
    processingTime: 'Processing Time',
    
    matchNumber: 'Match #',
    matchType: 'Type',
    semanticScore: 'Semantic Score',
    lexicalScore: 'Lexical Score',
    analyzedSegment: 'Analyzed Segment',
    sourceSegment: 'Source Segment',
    
    engineUsed: 'Engine Used',
    engineVersion: 'Engine Version',
    modelVersion: 'Model Version',
    analysisDate: 'Analysis Date',
    analysisId: 'Analysis ID',
    generatedBy: 'Generated by',
    generatedAt: 'Generated on',
    
    // Verdicts
    original: 'Original Document',
    lowSimilarity: 'Low Similarity',
    moderateSimilarity: 'Moderate Similarity',
    highSimilarity: 'High Similarity',
    probablePlagiarism: 'Probable Plagiarism',
    
    // Certificate
    certifiesThat: 'certifies that the document',
    titled: 'titled',
    submittedBy: 'submitted by',
    hasBeenAnalyzed: 'has been analyzed and presents a similarity score of',
    thisScoreIndicates: 'This score indicates',
    originalContent: 'original content, no plagiarism detected.',
    lowSimilarityContent: 'low similarity with existing documents.',
    moderateSimilarityContent: 'moderate similarity requiring manual verification.',
    highSimilarityContent: 'high similarity requiring special attention.',
    plagiarismContent: 'probable plagiarism rate requiring in-depth investigation.',
    issuedOn: 'Issued on',
    validSignature: 'Valid Signature',
    verificationCode: 'Verification Code',
    
    // Footer
    institution: 'University of Kinshasa — Faculty of Science',
    confidential: 'Confidential — Academic Use Only',
    page: 'Page',
    
    // Recommendations
    recommendationOriginal: 'The document appears original. No action required.',
    recommendationLow: 'Some minor similarities detected. Optional verification suggested.',
    recommendationModerate: 'Sections show moderate similarity. Revision is recommended.',
    recommendationHigh: 'Several high-risk sections identified. Mandatory revision recommended.',
    recommendationPlagiarism: 'Probable plagiarism detected. In-depth investigation and corrections required.',
  },
} as const;

function t(key: keyof typeof Translations.fr, lang: ReportLanguage): string {
  return Translations[lang][key];
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Draw header on each page
 */
function drawHeader(doc: PDFDocument, lang: ReportLanguage): void {
  const { width, margin } = Layout.page;
  
  doc.save();
  
  // Background
  doc.rect(0, 0, width, ComponentStyles.header.height)
     .fill(Colors.primary[600]);
  
  // Platform name
  doc.fillColor('#ffffff')
     .font(Typography.fonts.secondary)
     .fontSize(12)
     .text(t('platformName', lang), margin.left, 12, { 
       width: width - margin.left - margin.right,
       align: 'left' 
     });
  
  // Subtitle
  doc.font(Typography.fonts.primary)
     .fontSize(8)
     .fillColor(Colors.primary[200])
     .text(t('reportTitle', lang), margin.left, 26, { 
       width: width - margin.left - margin.right,
       align: 'left' 
     });
  
  doc.restore();
}

/**
 * Draw footer on each page
 */
function drawFooter(doc: PDFDocument, lang: ReportLanguage): void {
  const { width, height, margin } = Layout.page;
  const footerY = height - ComponentStyles.footer.padding.y * 2 - 10;
  
  doc.save();
  
  // Top border line
  doc.moveTo(margin.left, footerY)
     .lineTo(width - margin.right, footerY)
     .strokeColor(Colors.slate[300])
     .lineWidth(0.5)
     .stroke();
  
  // Institution name
  doc.font(Typography.fonts.primary)
     .fontSize(ComponentStyles.footer.fontSize)
     .fillColor(ComponentStyles.footer.textColor)
     .text(t('institution', lang), margin.left, footerY + 6, {
       width: width - margin.left - margin.right - 100,
       align: 'left'
     });
  
  // Page number
  const pageNum = doc.bufferedPageRange().start + 1;
  doc.text(`${t('page', lang)} ${pageNum}`, margin.left, footerY + 6, {
    width: width - margin.left - margin.right,
    align: 'right'
  });
  
  doc.restore();
}

/**
 * Add a new page with header and footer
 */
function addPageWithHeaderFooter(doc: PDFDocument, lang: ReportLanguage): void {
  doc.addPage();
  drawHeader(doc, lang);
  // Footer will be drawn at the end
}

/**
 * Draw section title
 */
function drawSectionTitle(doc: PDFDocument, text: string, y: number): number {
  const { margin } = Layout.page;
  const contentWidth = Layout.page.contentWidth;
  
  doc.save();
  
  // Left accent bar
  doc.rect(margin.left, y, ComponentStyles.sectionTitle.borderLeftWidth, 18)
     .fill(ComponentStyles.sectionTitle.borderLeftColor);
  
  // Title text
  doc.font(Typography.fonts.secondary)
     .fontSize(ComponentStyles.sectionTitle.fontSize)
     .fillColor(ComponentStyles.sectionTitle.color)
     .text(text, margin.left + 14, y + 2, {
       width: contentWidth - 20,
     });
  
  doc.restore();
  
  return y + 28;
}

/**
 * Draw info grid item
 */
function drawInfoItem(
  doc: PDFDocument, 
  label: string, 
  value: string, 
  x: number, 
  y: number, 
  width: number
): number {
  doc.save();
  
  // Label
  doc.font(Typography.fonts.primary)
     .fontSize(Typography.sizes.small)
     .fillColor(Colors.slate[500])
     .text(label.toUpperCase(), x, y, { width });
  
  // Value
  doc.font(Typography.fonts.secondary)
     .fontSize(Typography.sizes.body)
     .fillColor(Colors.slate[800])
     .text(truncateText(value, 40), x, y + 12, { width });
  
  // Bottom border
  doc.moveTo(x, y + 28)
     .lineTo(x + width, y + 28)
     .strokeColor(Colors.slate[200])
     .lineWidth(0.5)
     .stroke();
  
  doc.restore();
  
  return y + 36;
}

// ============================================================
// TEMPLATE 1: FULL REPORT
// ============================================================

export function renderFullReport(
  doc: PDFDocument, 
  data: AnalysisData, 
  options: TemplateOptions
): void {
  const { language } = options;
  const { width, margin, contentWidth } = Layout.page;
  
  // Set initial page
  drawHeader(doc, language);
  
  let currentY = ComponentStyles.header.height + 20;
  
  // ========== COVER / TITLE SECTION ==========
  // Logo area (placeholder - using styled text)
  doc.save();
  doc.rect(margin.left, currentY, contentWidth, 80)
     .fillAndStroke(Colors.primary[50], Colors.primary[200]);
  
  doc.font(Typography.fonts.secondary)
     .fontSize(Typography.sizes.title)
     .fillColor(Colors.primary[700])
     .text(t('platformName', language), margin.left + 20, currentY + 15, {
       width: contentWidth - 40,
       align: 'center'
     });
  
  doc.font(Typography.fonts.primary)
     .fontSize(Typography.sizes.heading1)
     .fillColor(Colors.slate[600])
     .text(t('reportTitle', language), margin.left + 20, currentY + 48, {
       width: contentWidth - 40,
       align: 'center'
     });
  
  doc.restore();
  currentY += 100;
  
  // ========== EXECUTIVE SUMMARY ==========
  currentY = drawSectionTitle(doc, t('executiveSummary', language), currentY);
  
  // Score box
  const verdictInfo = getVerdictInfo(data.globalScore);
  const scorePercent = (data.globalScore * 100).toFixed(1);
  
  doc.save();
  doc.roundedRect(margin.left, currentY, contentWidth, 90, Layout.borderRadius.lg)
     .fillAndStroke(verdictInfo.bgColor, verdictInfo.color, 2);
  
  // Score value
  doc.font(Typography.fonts.secondary)
     .fontSize(36)
     .fillColor(verdictInfo.color)
     .text(`${scorePercent}%`, margin.left, currentY + 15, {
       width: contentWidth,
       align: 'center'
     });
  
  // Label
  doc.font(Typography.fonts.primary)
     .fontSize(Typography.sizes.heading3)
     .fillColor(Colors.slate[600])
     .text(t('globalScore', language), margin.left, currentY + 55, {
       width: contentWidth,
       align: 'center'
     });
  
  // Verdict badge
  const badgeText = verdictInfo.label;
  const badgeWidth = doc.widthOfString(badgeText) + 24;
  const badgeX = (width - badgeWidth) / 2;
  
  doc.roundedRect(badgeX, currentY + 72, badgeWidth, 20, 10)
     .fill(verdictInfo.color);
  
  doc.font(Typography.fonts.secondary)
     .fontSize(9)
     .fillColor('#ffffff')
     .text(badgeText, badgeX + 12, currentY + 76, { width: badgeWidth - 24, align: 'center' });
  
  doc.restore();
  currentY += 105;
  
  // Quick stats row
  const statWidth = (contentWidth - 32) / 4;
  const stats = [
    { label: t('matchedSegments', language), value: String(data.matchedSegments) },
    { label: t('totalSegments', language), value: String(data.totalSegments) },
    { label: t('matchesCount', language), value: String(data.matches.length) },
    { label: t('threshold', language), value: `${(data.threshold * 100).toFixed(0)}%` },
  ];
  
  stats.forEach((stat, i) => {
    const x = margin.left + i * (statWidth + 10);
    
    doc.save();
    doc.roundedRect(x, currentY, statWidth, 50, Layout.borderRadius.md)
       .fillAndStroke(Colors.slate[50], Colors.slate[200]);
    
    doc.font(Typography.fonts.secondary)
       .fontSize(18)
       .fillColor(Colors.slate[800])
       .text(stat.value, x, currentY + 8, { width: statWidth, align: 'center' });
    
    doc.font(Typography.fonts.primary)
       .fontSize(Typography.sizes.small)
       .fillColor(Colors.slate[500])
       .text(stat.label, x, currentY + 32, { width: statWidth, align: 'center' });
    
    doc.restore();
  });
  
  currentY += 65;
  
  // ========== DOCUMENT INFO ==========
  currentY = drawSectionTitle(doc, t('documentInfo', language), currentY);
  
  const colWidth = (contentWidth - 20) / 2;
  const docInfos = [
    [t('documentTitle', language), data.documentTitle],
    [t('documentType', language), DocumentTypeLabels[language][data.documentType as keyof typeof DocumentTypeLabels.fr] || data.documentType],
    [t('author', language), data.authorName],
    [t('academicYear', language), data.academicYear],
    [t('faculty', language), data.facultyName || '—'],
    [t('department', language), data.departmentName || '—'],
  ];
  
  if (data.subject) {
    docInfos.push([t('subject', language), data.subject]);
  }
  
  let infoY = currentY;
  docInfos.forEach((info, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin.left + col * (colWidth + 20);
    const y = infoY + row * 36;
    
    if (y < Layout.page.height - Layout.page.margin.bottom - 60) {
      drawInfoItem(doc, info[0], info[1], x, y, colWidth);
    }
  });
  
  currentY = infoY + Math.ceil(docInfos.length / 2) * 36 + 15;
  
  // Check if we need a new page before matches
  if (currentY > Layout.page.height - 200) {
    addPageWithHeaderFooter(doc, language);
    currentY = ComponentStyles.header.height + 20;
  }
  
  // ========== MATCH DETAILS ==========
  if (data.matches.length > 0) {
    currentY = drawSectionTitle(doc, 
      `${t('matchDetails', language)} (${data.matches.length})`, 
      currentY
    );
    
    const maxMatches = options.maxMatches || 50;
    const matchesToShow = data.matches.slice(0, maxMatches);
    
    matchesToShow.forEach((match, index) => {
      // Check space
      if (currentY > Layout.page.height - 120) {
        addPageWithHeaderFooter(doc, language);
        currentY = ComponentStyles.header.height + 20;
      }
      
      const matchHeight = 85;
      const matchColor = Colors.matchType[match.matchType] || Colors.slate[500];
      const matchLabel = MatchTypeLabels[language][match.matchType] || match.matchType;
      
      doc.save();
      
      // Card background
      doc.roundedRect(margin.left, currentY, contentWidth, matchHeight, Layout.borderRadius.md)
         .fillAndStroke('#ffffff', Colors.slate[200]);
      
      // Type color bar
      doc.rect(margin.left, currentY, 4, matchHeight)
         .fill(matchColor);
      
      // Header row
      const headerY = currentY + 8;
      doc.font(Typography.fonts.secondary)
         .fontSize(10)
         .fillColor(Colors.slate[800])
         .text(`${t('matchNumber', language)}${index + 1}`, margin.left + 14, headerY);
      
      // Type badge
      const typeBadgeWidth = doc.widthOfString(matchLabel) + 16;
      doc.roundedRect(margin.left + contentWidth - typeBadgeWidth - 10, headerY, typeBadgeWidth, 18, 4)
         .fill(matchColor);
      doc.font(Typography.fonts.primary)
         .fontSize(8)
         .fillColor('#ffffff')
         .text(matchLabel, margin.left + contentWidth - typeBadgeWidth - 4, headerY + 4, { width: typeBadgeWidth - 8, align: 'center' });
      
      // Scores
      doc.font(Typography.fonts.primary)
         .fontSize(9)
         .fillColor(Colors.slate[500])
         .text(`${t('semanticScore', language)}: ${(match.semanticScore * 100).toFixed(1)}%  |  ${t('lexicalScore', language)}: ${(match.lexicalScore * 100).toFixed(1)}%`, 
           margin.left + 14, headerY + 22, { width: contentWidth - 30 }
         );
      
      // Query segment
      const queryY = headerY + 38;
      doc.rect(margin.left + 14, queryY, contentWidth - 28, 18)
         .fill('#fef2f2');
      doc.font(Typography.fonts.primary)
         .fontSize(8)
         .fillColor(Colors.slate[700])
         .text(truncateText(match.querySegmentText, 80), margin.left + 18, queryY + 4, { width: contentWidth - 36 });
      
      // Source segment
      const sourceY = queryY + 22;
      doc.rect(margin.left + 14, sourceY, contentWidth - 28, 18)
         .fill('#fffbeb');
      doc.font(Typography.fonts.primary)
         .fontSize(8)
         .fillColor(Colors.slate[700])
         .text(truncateText(match.sourceSegmentText, 80), margin.left + 18, sourceY + 4, { width: contentWidth - 36 });
      
      doc.restore();
      currentY += matchHeight + 8;
    });
    
    currentY += 10;
  }
  
  // ========== RECOMMENDATIONS ==========
  if (options.includeRecommendations !== false) {
    if (currentY > Layout.page.height - 150) {
      addPageWithHeaderFooter(doc, language);
      currentY = ComponentStyles.header.height + 20;
    }
    
    currentY = drawSectionTitle(doc, t('recommendations', language), currentY);
    
    const verdictInfoRec = getVerdictInfo(data.globalScore);
    let recKey: string;
    
    switch (verdictInfoRec.severity) {
      case 'original': recKey = 'recommendationOriginal'; break;
      case 'low': recKey = 'recommendationLow'; break;
      case 'moderate': recKey = 'recommendationModerate'; break;
      case 'high': recKey = 'recommendationHigh'; break;
      default: recKey = 'recommendationPlagiarism';
    }
    
    const recommendation = t(recKey as keyof typeof Translations.fr, language);
    
    doc.save();
    doc.roundedRect(margin.left, currentY, contentWidth, 60, Layout.borderRadius.md)
       .dash(3, { space: 3 })
       .strokeColor(Colors.info)
       .fillAndStroke('#eff6ff', Colors.info);
    doc.undash();
    
    doc.font(Typography.fonts.primary)
       .fontSize(10)
       .fillColor(Colors.slate[700])
       .text(recommendation, margin.left + 15, currentY + 15, { width: contentWidth - 30 });
    
    doc.restore();
    currentY += 75;
  }
  
  // ========== AUDIT METADATA ==========
  if (options.includeMetadata !== false) {
    if (currentY > Layout.page.height - 150) {
      addPageWithHeaderFooter(doc, language);
      currentY = ComponentStyles.header.height + 20;
    }
    
    currentY = drawSectionTitle(doc, t('auditMetadata', language), currentY);
    
    const metadataItems = [
      [t('analysisId', language), data.analysisId],
      [t('analysisDate', language), data.completedAt ? formatDate(data.completedAt, language) : '—'],
      [t('engineUsed', language), data.engineType || 'Hybrid'],
      [t('engineVersion', language), data.engineVersion || 'v3.0'],
      [t('generatedBy', language), data.analystName],
      [t('generatedAt', language), formatDate(new Date(), language)],
    ];
    
    const metaColWidth = (contentWidth - 20) / 2;
    metadataItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin.left + col * (metaColWidth + 20);
      const y = currentY + row * 32;
      
      doc.font(Typography.fonts.primary)
         .fontSize(8)
         .fillColor(Colors.slate[500])
         .text(item[0] + ':', x, y, { width: metaColWidth });
      
      doc.font(Typography.fonts.secondary)
         .fontSize(9)
         .fillColor(Colors.slate[700])
         .text(item[1], x, y + 12, { width: metaColWidth });
    });
    
    currentY += Math.ceil(metadataItems.length / 2) * 32 + 20;
  }
  
  // Draw footers on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, language);
  }
}

// ============================================================
// TEMPLATE 2: SUMMARY REPORT (1 PAGE)
// ============================================================

export function renderSummaryReport(
  doc: PDFDocument, 
  data: AnalysisData, 
  options: TemplateOptions
): void {
  const { language } = options;
  const { width, margin, contentWidth } = Layout.page;
  
  drawHeader(doc, language);
  
  let y = ComponentStyles.header.height + 15;
  
  // Compact title section
  doc.save();
  doc.rect(margin.left, y, contentWidth, 45)
     .fill(Colors.primary[50]);
  
  doc.font(Typography.fonts.secondary)
     .fontSize(16)
     .fillColor(Colors.primary[800])
     .text(`PlagiatIA — ${t('summaryReportTitle', language)}`, margin.left + 15, y + 12, {
       width: contentWidth - 30,
       align: 'center'
     });
  
  doc.restore();
  y += 55;
  
  // Two-column layout: Info left, Score right
  const leftColWidth = contentWidth * 0.55 - 10;
  const rightColWidth = contentWidth * 0.45 - 10;
  
  // Left column - Document info
  doc.font(Typography.fonts.secondary)
     .fontSize(11)
     .fillColor(Colors.slate[800])
     .text(t('documentInfo', language), margin.left, y);
  
  y += 18;
  
  const compactInfos = [
    [t('documentTitle', language), truncateText(data.documentTitle, 35)],
    [t('author', language), data.authorName],
    [t('documentType', language), DocumentTypeLabels[language][data.documentType as keyof typeof DocumentTypeLabels.fr] || data.documentType],
    [t('academicYear', language), data.academicYear],
  ];
  
  compactInfos.forEach(([label, value]) => {
    doc.font(Typography.fonts.primary)
       .fontSize(8)
       .fillColor(Colors.slate[500])
       .text(`${label}:`, margin.left, y);
    
    doc.font(Typography.fonts.secondary)
       .fontSize(9)
       .fillColor(Colors.slate[700])
       .text(value, margin.left + 80, y, { width: leftColWidth - 90 });
    
    y += 16;
  });
  
  // Right column - Score box
  const scoreBoxX = margin.left + leftColWidth + 20;
  const scoreBoxY = ComponentStyles.header.height + 55;
  const verdictInfo = getVerdictInfo(data.globalScore);
  const scorePercent = (data.globalScore * 100).toFixed(1);
  
  doc.save();
  doc.roundedRect(scoreBoxX, scoreBoxY, rightColWidth, 80, Layout.borderRadius.lg)
     .fillAndStroke(verdictInfo.bgColor, verdictInfo.color, 2);
  
  doc.font(Typography.fonts.secondary)
     .fontSize(28)
     .fillColor(verdictInfo.color)
     .text(`${scorePercent}%`, scoreBoxX, scoreBoxY + 12, { width: rightColWidth, align: 'center' });
  
  doc.font(Typography.fonts.primary)
     .fontSize(9)
     .fillColor(Colors.slate[600])
     .text(t('globalScore', language), scoreBoxX, scoreBoxY + 45, { width: rightColWidth, align: 'center' });
  
  // Verdict
  doc.roundedRect(scoreBoxX + 15, scoreBoxY + 58, rightColWidth - 30, 18, 9)
     .fill(verdictInfo.color);
  doc.font(Typography.fonts.primary)
     .fontSize(8)
     .fillColor('#ffffff')
     .text(verdictInfo.label, scoreBoxX + 15, scoreBoxY + 61, { width: rightColWidth - 30, align: 'center' });
  
  doc.restore();
  
  // Stats row
  y = Math.max(y, scoreBoxY + 90) + 10;
  
  const statsCompact = [
    { value: String(data.matchedSegments), label: t('matchedSegments', language).substring(0, 15) },
    { value: String(data.totalSegments), label: t('totalSegments', language).substring(0, 15) },
    { value: String(data.matches.length), label: t('matchesCount', language) },
    { value: `${data.processingTimeMs || '—'}ms`, label: t('processingTime', language).substring(0, 12) },
  ];
  
  const statW = (contentWidth - 30) / 4;
  statsCompact.forEach((stat, i) => {
    const sx = margin.left + i * (statW + 10);
    
    doc.roundedRect(sx, y, statW, 40, Layout.borderRadius.sm)
       .fillAndStroke(Colors.slate[50], Colors.slate[200]);
    
    doc.font(Typography.fonts.secondary)
       .fontSize(14)
       .fillColor(Colors.slate[800])
       .text(stat.value, sx, y + 6, { width: statW, align: 'center' });
    
    doc.font(Typography.fonts.primary)
       .fontSize(7)
       .fillColor(Colors.slate[500])
       .text(stat.label, sx, y + 24, { width: statW, align: 'center' });
  });
  
  y += 55;
  
  // Top matches summary (compact table)
  if (data.matches.length > 0) {
    doc.font(Typography.fonts.secondary)
       .fontSize(11)
       .fillColor(Colors.slate[800])
       .text(`${t('matchDetails', language)} (${Math.min(data.matches.length, 10)} ${language === 'fr' ? 'premiers' : 'top'})`, margin.left, y);
    
    y += 16;
    
    // Table header
    doc.rect(margin.left, y, contentWidth, 18)
       .fill(Colors.slate[100]);
    
    const cols = [
      { label: '#', w: 25 },
      { label: t('matchType', language), w: 90 },
      { label: t('semanticScore', language), w: 70 },
      { label: t('lexicalScore', language), w: 70 },
      { label: t('analyzedSegment', language), w: contentWidth - 255 },
    ];
    
    let cx = margin.left;
    cols.forEach(col => {
      doc.font(Typography.fonts.secondary)
         .fontSize(7)
         .fillColor(Colors.slate[600])
         .text(col.label, cx + 4, y + 5, { width: col.w - 8 });
      cx += col.w + 5;
    });
    
    y += 20;
    
    // Table rows
    const topMatches = data.matches.slice(0, 10);
    topMatches.forEach((match, idx) => {
      if (y > Layout.page.height - Layout.page.margin.bottom - 30) return;
      
      const rowH = 22;
      const matchColor = Colors.matchType[match.matchType] || Colors.slate[400];
      const matchLabel = MatchTypeLabels[language][match.matchType] || match.matchType;
      
      // Row background (alternating)
      if (idx % 2 === 0) {
        doc.rect(margin.left, y, contentWidth, rowH)
           .fill(Colors.slate[50]);
      }
      
      // Color indicator
      doc.rect(margin.left, y, 3, rowH)
         .fill(matchColor);
      
      let rx = margin.left + 8;
      
      // #
      doc.font(Typography.fonts.primary)
         .fontSize(8)
         .fillColor(Colors.slate[600])
         .text(String(idx + 1), rx, y + 6, { w: 20 });
      rx += 30;
      
      // Type
      doc.font(Typography.fonts.primary)
         .fontSize(7)
         .fillColor(matchColor)
         .text(matchLabel.substring(0, 18), rx, y + 7, { w: 88 });
      rx += 95;
      
      // Semantic score
      doc.font(Typography.fonts.secondary)
         .fontSize(8)
         .fillColor(Colors.slate[700])
         .text(`${(match.semanticScore * 100).toFixed(0)}%`, rx, y + 6, { w: 68 });
      rx += 75;
      
      // Lexical score
      doc.font(Typography.fonts.secondary)
         .fontSize(8)
         .fillColor(Colors.slate[700])
         .text(`${(match.lexicalScore * 100).toFixed(0)}%`, rx, y + 6, { w: 68 });
      rx += 75;
      
      // Segment preview
      doc.font(Typography.fonts.primary)
         .fontSize(7)
         .fillColor(Colors.slate[600])
         .text(truncateText(match.querySegmentText, 45), rx, y + 7, { w: contentWidth - 260 });
      
      y += rowH;
    });
  }
  
  // Footer with date
  y = Layout.page.height - Layout.page.margin.bottom - 30;
  doc.moveTo(margin.left, y)
     .lineTo(width - margin.right, y)
     .strokeColor(Colors.slate[300])
     .lineWidth(0.5)
     .stroke();
  
  doc.font(Typography.fonts.primary)
     .fontSize(8)
     .fillColor(Colors.slate[500])
     .text(`${t('institution', language)} | ${t('generatedAt', language)}: ${formatDate(new Date(), language)}`, 
       margin.left, y + 8, { width: contentWidth, align: 'center' });
}

// ============================================================
// TEMPLATE 3: CERTIFICATE OF ORIGINALITY
// ============================================================

export function renderCertificate(
  doc: PDFDocument, 
  data: AnalysisData, 
  options: TemplateOptions
): void {
  const { language } = options;
  const { width, height, margin, contentWidth } = Layout.page;
  
  // Certificate has no standard header - uses decorative borders
  
  // Outer decorative border
  const borderMargin = 30;
  doc.save();
  doc.roundedRect(borderMargin, borderMargin, width - borderMargin * 2, height - borderMargin * 2, 10)
     .strokeColor(Colors.primary[600])
     .lineWidth(3)
     .stroke();
  
  // Inner decorative border
  doc.roundedRect(borderMargin + 8, borderMargin + 8, width - (borderMargin + 8) * 2, height - (borderMargin + 8) * 2, 8)
     .strokeColor(Colors.primary[300])
     .lineWidth(1)
     .stroke();
  doc.restore();
  
  // Corner decorations
  const cornerSize = 25;
  const corners = [
    { x: borderMargin + 15, y: borderMargin + 15 },
    { x: width - borderMargin - cornerSize - 15, y: borderMargin + 15 },
    { x: borderMargin + 15, y: height - borderMargin - cornerSize - 15 },
    { x: width - borderMargin - cornerSize - 15, y: height - borderMargin - cornerSize - 15 },
  ];
  
  corners.forEach(corner => {
    doc.save();
    doc.roundedRect(corner.x, corner.y, cornerSize, cornerSize, 3)
       .fillAndStroke(Colors.primary[100], Colors.primary[500]);
    doc.restore();
  });
  
  // Content area
  const contentX = borderMargin + 25;
  const contentW = width - (borderMargin + 25) * 2;
  let y = 100;
  
  // Platform name / Logo area
  doc.font(Typography.fonts.secondary)
     .fontSize(28)
     .fillColor(Colors.primary[700])
     .text(t('platformName', language), contentX, y, { width: contentW, align: 'center' });
  
  y += 40;
  
  // Decorative line
  doc.moveTo(contentX + contentW * 0.2, y)
     .lineTo(contentX + contentW * 0.8, y)
     .strokeColor(Colors.primary[400])
     .lineWidth(1)
     .stroke();
  
  y += 20;
  
  // Certificate title
  doc.font(Typography.fonts.secondary)
     .fontSize(22)
     .fillColor(Colors.slate[800])
     .text(t('certificateTitle', language), contentX, y, { width: contentW, align: 'center' });
  
  y += 50;
  
  // Certificate body text
  const verdictInfo = getVerdictInfo(data.globalScore);
  const scorePercent = (data.globalScore * 100).toFixed(1);
  
  const certLines = [
    t('certifiesThat', language),
    '',
    `"${truncateText(data.documentTitle, 60)}"`,
    '',
    `${t('submittedBy', language)}: ${data.authorName}`,
    '',
    `${t('hasBeenAnalyzed', language)} **${scorePercent}%**`,
    '',
    `${t('thisScoreIndicates', language)}:`,
  ];
  
  certLines.forEach(line => {
    if (line === '') {
      y += 10;
      return;
    }
    
    const isBold = line.includes('**');
    const cleanLine = line.replace(/\*\*/g, '');
    
    doc.font(isBold ? Typography.fonts.secondary : Typography.fonts.primary)
       .fontSize(line.startsWith('"') ? 13 : 11)
       .fillColor(isBold ? Colors.primary[700] : Colors.slate[700])
       .text(cleanLine, contentX + 30, y, { width: contentW - 60, align: line.startsWith('"') ? 'center' : 'left', lineGap: 4 });
    
    y += line.startsWith('"') ? 24 : 18;
  });
  
  // Verdict description
  let verdictDescKey: string;
  switch (verdictInfo.severity) {
    case 'original': verdictDescKey = 'originalContent'; break;
    case 'low': verdictDescKey = 'lowSimilarityContent'; break;
    case 'moderate': verdictDescKey = 'moderateSimilarityContent'; break;
    case 'high': verdictDescKey = 'highSimilarityContent'; break;
    default: verdictDescKey = 'plagiarismContent';
  }
  
  const verdictDesc = t(verdictDescKey as keyof typeof Translations.fr, language);
  
  doc.save();
  doc.roundedRect(contentX + 30, y, contentW - 60, 35, Layout.borderRadius.md)
     .fillAndStroke(verdictInfo.bgColor, verdictInfo.color);
  
  doc.font(Typography.fonts.primary)
     .fontSize(10)
     .fillColor(Colors.slate[700])
     .text(verdictDesc, contentX + 40, y + 10, { width: contentW - 80, align: 'center' });
  
  doc.restore();
  y += 50;
  
  // Verification code box
  const verifyCode = `PLG-${data.analysisId.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  
  doc.font(Typography.fonts.primary)
     .fontSize(9)
     .fillColor(Colors.slate[500])
     .text(t('verificationCode', language) + ':', contentX + 30, y, { width: contentW - 60, align: 'center' });
  
  y += 14;
  
  doc.save();
  doc.roundedRect(contentX + contentW/2 - 100, y, 200, 24, 4)
     .fillAndStroke(Colors.slate[100], Colors.slate[300]);
  
  doc.font(Typography.fonts.mono)
     .fontSize(10)
     .fillColor(Colors.slate[800])
     .text(verifyCode, contentX + contentW/2 - 95, y + 6, { width: 190, align: 'center' });
  doc.restore();
  
  y += 40;
  
  // Date and signature area
  doc.font(Typography.fonts.primary)
     .fontSize(10)
     .fillColor(Colors.slate[600])
     .text(`${t('issuedOn', language)}: ${formatDate(new Date(), language)}`, contentX + 30, y, { width: contentW - 60, align: 'center' });
  
  y += 30;
  
  // Signature line
  const sigX = contentX + contentW - 180;
  doc.moveTo(sigX, y + 25)
     .lineTo(sigX + 150, y + 25)
     .strokeColor(Colors.slate[400])
     .lineWidth(1)
     .stroke();
  
  doc.font(Typography.fonts.primary)
     .fontSize(9)
     .fillColor(Colors.slate[500])
     .text(t('validSignature', language), sigX, y + 30, { width: 150, align: 'center' });
  
  // Seal/stamp placeholder
  doc.save();
  doc.circle(width - borderMargin - 70, height - borderMargin - 70, 30)
     .fillColor(Colors.primary[100])
     .fill()
     .strokeColor(Colors.primary[600])
     .lineWidth(2)
     .stroke();
  
  doc.font(Typography.fonts.secondary)
     .fontSize(8)
     .fillColor(Colors.primary[700])
     .text('PLAGIATIA', width - borderMargin - 98, height - borderMargin - 74, { width: 56, align: 'center' });
  doc.restore();
}
