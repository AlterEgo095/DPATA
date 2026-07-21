// PDF Generator for PlagiatIA Professional Reports
// Module v0.3 - Main Generator Entry Point

import PDFDocument from 'pdfkit';
import {
  type AnalysisData,
  type ReportFormat,
  type ReportLanguage,
  type TemplateOptions,
  type MatchData,
  renderFullReport,
  renderSummaryReport,
  renderCertificate,
} from './templates';

// ============================================================
// EXPORTED TYPES
// ============================================================

export type { AnalysisData, MatchData, ReportFormat, ReportLanguage };
export type { TemplateOptions } from './templates';

// ============================================================
// GENERATOR OPTIONS
// ============================================================

export interface GeneratePDFOptions {
  // Data
  data: AnalysisData;
  
  // Format selection
  format?: ReportFormat;
  
  // Language (default: 'fr')
  language?: ReportLanguage;
  
  // Template options
  includeRecommendations?: boolean;
  includeMetadata?: boolean;
  maxMatches?: number; // Max matches to include (default: 50)
  
  // Output options
  bufferSize?: number; // Buffer size for streaming (default: 2MB)
}

// ============================================================
// MAIN GENERATOR FUNCTION
// ============================================================

/**
 * Generate a professional PDF analysis report
 * 
 * @param options - Generation options including analysis data and format preferences
 * @returns Promise<Buffer> - The generated PDF as a buffer
 * 
 * @example
 * ```typescript
 * const pdfBuffer = await generateAnalysisReport({
 *   data: analysisData,
 *   format: 'full',
 *   language: 'fr',
 * });
 * ```
 */
export async function generateAnalysisReport(options: GeneratePDFOptions): Promise<Buffer> {
  const {
    data,
    format = 'full',
    language = 'fr',
    includeRecommendations = true,
    includeMetadata = true,
    maxMatches = 50,
    bufferSize = 2 * 1024 * 1024, // 2MB default
  } = options;

  // Validate required data
  if (!data) {
    throw new Error('Analysis data is required');
  }
  
  if (!data.documentId || !data.documentTitle) {
    throw new Error('Document ID and title are required');
  }

  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: LayoutDefaults.margins.top,
          bottom: LayoutDefaults.margins.bottom,
          left: LayoutDefaults.margins.left,
          right: LayoutDefaults.margins.right,
        },
        info: {
          Title: getPDFTitle(format, data, language),
          Author: `PlagiatIA - ${data.analystName}`,
          Subject: `${format} report for ${data.documentTitle}`,
          Creator: 'PlagiatIA Professional v0.3',
          Producer: 'PlagiatIA Platform',
          CreationDate: new Date(),
          Keywords: `plagiarism,analysis,${data.documentType},${format}`,
        },
        bufferPages: true,
      });

      // Collect data chunks
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Build template options
      const templateOptions: TemplateOptions = {
        format,
        language,
        includeRecommendations,
        includeMetadata,
        maxMatches,
      };

      // Render based on format
      switch (format) {
        case 'full':
          renderFullReport(doc, data, templateOptions);
          break;
          
        case 'summary':
          renderSummaryReport(doc, data, templateOptions);
          break;
          
        case 'certificate':
          renderCertificate(doc, data, templateOptions);
          break;
          
        default:
          throw new Error(`Unknown format: ${format}`);
      }

      // Finalize the PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const LayoutDefaults = {
  margins: {
    top: 60,
    bottom: 60,
    left: 50,
    right: 50,
  },
};

function getPDFTitle(
  format: ReportFormat, 
  data: AnalysisData, 
  language: ReportLanguage
): string {
  const titles = {
    fr: {
      full: `Rapport d'Analyse - ${data.documentTitle}`,
      summary: `Synthèse - ${data.documentTitle}`,
      certificate: `Certificat - ${data.documentTitle}`,
    },
    en: {
      full: `Analysis Report - ${data.documentTitle}`,
      summary: `Summary - ${data.documentTitle}`,
      certificate: `Certificate - ${data.documentTitle}`,
    },
  };

  return titles[language][format];
}

/**
 * Generate filename for the PDF report
 */
export function generateFilename(
  format: ReportFormat,
  data: AnalysisData,
  language: ReportLanguage = 'fr'
): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toTimeString().split(':')[0] + now.toTimeString().split(':')[1];
  
  // Sanitize document title for filename
  const sanitizedTitle = data.documentTitle
    .substring(0, 40)
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
  
  const suffixes = {
    full: language === 'fr' ? 'rapport_complet' : 'full_report',
    summary: language === 'fr' ? 'synthese' : 'summary',
    certificate: language === 'fr' ? 'certificat' : 'certificate',
  };

  return `plagiata_${sanitizedTitle}_${suffixes[format]}_${dateStr}${timeStr}.pdf`;
}

// ============================================================
// DATA TRANSFORMATION HELPERS
// ============================================================

/**
 * Transform Prisma/DB analysis data to AnalysisData format
 * Use this when converting from database models
 */
export function transformDbToAnalysisData(dbData: {
  document: {
    id: string;
    title: string;
    type: string;
    subject?: string | null;
    abstract?: string | null;
    fileName: string;
    fileSize: number;
    faculty?: { name: string } | null;
    department?: { name: string } | null;
    promotion?: { name: string } | null;
    academicYear: string;
    uploadedBy?: {
      firstName: string;
      lastName: string;
      email?: string | null;
    } | null;
  };
  analysis: {
    id: string;
    globalScore: number | null;
    matchedSegments: number | null;
    totalSegments: number | null;
    threshold: number;
    scope: string;
    status: string;
    startedAt?: Date | null;
    completedAt?: Date | null;
    error?: string | null;
  };
  matches: Array<{
    id: string;
    querySegmentIndex: number;
    querySegmentText: string;
    sourceDocumentId: string;
    sourceSegmentIndex: number;
    sourceSegmentText: string;
    semanticScore: number;
    lexicalScore: number;
    matchType: string;
  }>;
  analyst?: {
    firstName: string;
    lastName: string;
    role?: string;
  } | null;
  engineInfo?: {
    type?: string;
    version?: string;
    modelVersion?: string;
  } | null;
}): AnalysisData {
  const { document, analysis, matches, analyst, engineInfo } = dbData;

  return {
    // Document info
    documentId: document.id,
    documentTitle: document.title,
    documentType: document.type,
    documentSubject: document.subject || undefined,
    documentAbstract: document.abstract || undefined,
    fileName: document.fileName,
    fileSize: document.fileSize,

    // Author info
    authorName: document.uploadedBy 
      ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`
      : 'Inconnu',
    authorEmail: document.uploadedBy?.email || undefined,
    facultyName: document.faculty?.name || undefined,
    departmentName: document.department?.name || undefined,
    promotionName: document.promotion?.name || undefined,
    academicYear: document.academicYear,

    // Analysis results
    analysisId: analysis.id,
    globalScore: analysis.globalScore || 0,
    matchedSegments: analysis.matchedSegments || 0,
    totalSegments: analysis.totalSegments || 0,
    threshold: analysis.threshold,
    scope: analysis.scope,
    status: analysis.status,
    startedAt: analysis.startedAt || undefined,
    completedAt: analysis.completedAt || undefined,

    // Matches
    matches: matches.map(m => ({
      id: m.id,
      querySegmentIndex: m.querySegmentIndex,
      querySegmentText: m.querySegmentText,
      sourceDocumentId: m.sourceDocumentId,
      sourceSegmentIndex: m.sourceSegmentIndex,
      sourceSegmentText: m.sourceSegmentText,
      semanticScore: m.semanticScore,
      lexicalScore: m.lexicalScore,
      matchType: m.matchType as MatchData['matchType'],
    })),

    // Engine info
    engineType: engineInfo?.type || 'HYBRID',
    engineVersion: engineInfo?.version || '3.0.0',
    modelVersion: engineInfo?.modelVersion || 'distiluse-v1',

    // Analyst
    analystName: analyst 
      ? `${analyst.firstName} ${analyst.lastName}`
      : 'Système',
    analystRole: analyst?.role || undefined,
  };
}

/**
 * Create sample/dummy data for testing
 */
export function createSampleAnalysisData(overrides?: Partial<AnalysisData>): AnalysisData {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);

  return {
    documentId: 'doc_sample_001',
    documentTitle: "Mémoire de fin d'études - Analyse des algorithmes de machine learning",
    documentType: 'MEMOIRE',
    documentSubject: 'Intelligence Artificielle et Machine Learning',
    documentAbstract: 'Ce mémoire présente une analyse comparative des algorithmes de machine learning...',
    fileName: 'memoire_ml_2024.pdf',
    fileSize: 2458624,

    authorName: 'Jean Dupont',
    authorEmail: 'jean.dupont@unikin.ac.cd',
    facultyName: 'Faculté des Sciences',
    departmentName: 'Département d\'Informatique',
    promotionName: 'Master 2 Informatique',
    academicYear: '2024-2025',

    analysisId: 'ana_sample_001',
    globalScore: 0.234,
    matchedSegments: 12,
    totalSegments: 45,
    threshold: 0.15,
    scope: 'faculty',
    status: 'COMPLETED',
    startedAt: hourAgo,
    completedAt: now,
    processingTimeMs: 2340,

    matches: [
      {
        id: 'mtc_001',
        querySegmentIndex: 5,
        querySegmentText: 'Le machine learning est un sous-domaine de l\'intelligence artificielle qui permet aux systèmes d\'apprendre à partir de données.',
        sourceDocumentId: 'doc_ref_001',
        sourceDocumentTitle: 'Introduction au Machine Learning',
        sourceSegmentIndex: 2,
        sourceSegmentText: 'Le machine learning est un sous-domaine de l\'intelligence artificielle qui permet aux systèmes d\'apprendre à partir de données.',
        semanticScore: 0.87,
        lexicalScore: 0.95,
        matchType: 'COPY_PASTE',
      },
      {
        id: 'mtc_002',
        querySegmentIndex: 12,
        querySegmentText: 'Les réseaux de neurones profonds ont révolutionné le traitement automatique du langage naturel.',
        sourceDocumentId: 'doc_ref_002',
        sourceDocumentTitle: 'Deep Learning Applications',
        sourceSegmentIndex: 8,
        sourceSegmentText: 'Les réseaux de neurones convolutionnels ont transformé le domaine du traitement du langage naturel.',
        semanticScore: 0.64,
        lexicalScore: 0.42,
        matchType: 'PARAPHRASE',
      },
      {
        id: 'mtc_003',
        querySegmentIndex: 18,
        querySegmentText: 'L\'algorithme de rétropropagation du gradient est essentiel pour l\'entraînement des réseaux multicouches.',
        sourceDocumentId: 'doc_ref_003',
        sourceDocumentTitle: 'Neural Networks Fundamentals',
        sourceSegmentIndex: 15,
        sourceSegmentText: 'La méthode de backpropagation est fondamentale pour entraîner les réseaux de neurones à couches multiples.',
        semanticScore: 0.72,
        lexicalScore: 0.55,
        matchType: 'REFORMULATION',
      },
      {
        id: 'mtc_004',
        querySegmentIndex: 24,
        querySegmentText: 'Deep learning has revolutionized natural language processing with transformer architectures.',
        sourceDocumentId: 'doc_ref_004',
        sourceDocumentTitle: 'NLP Survey Paper',
        sourceSegmentIndex: 3,
        sourceSegmentText: 'Le deep learning a révolutionné le traitement du langage naturel grâce aux architectures transformer.',
        semanticScore: 0.78,
        lexicalScore: 0.35,
        matchType: 'TRANSLATION',
      },
      {
        id: 'mtc_005',
        querySegmentIndex: 31,
        querySegmentText: 'Les modèles pré-entraînés comme BERT ont montré des performances remarquables.',
        sourceDocumentId: 'doc_ref_005',
        sourceDocumentTitle: 'Pre-trained Models Review',
        sourceSegmentIndex: 7,
        sourceSegmentText: 'BERT et autres modèles pré-entraînés obtiennent d\'excellents résultats sur les benchmarks NLP.',
        semanticScore: 0.45,
        lexicalScore: 0.28,
        matchType: 'WEAK_MATCH',
      },
    ],

    engineType: 'HYBRID',
    engineVersion: '3.0.0',
    modelVersion: 'distiluse-base-multilingual-cased-v1',

    analystName: 'Dr. Marie Curie',
    analystRole: 'TEACHER',

    ...overrides,
  };
}

// ============================================================
// STREAMING GENERATOR (for large reports)
// ============================================================

/**
 * Generate PDF as a readable stream (for large files or direct response)
 * 
 * @param options - Same as generateAnalysisReport
 * @returns Readable stream of PDF data
 */
export function createPDFStream(options: Omit<GeneratePDFOptions, 'bufferSize'>): PDFDocument.PDFDocument {
  const {
    data,
    format = 'full',
    language = 'fr',
    includeRecommendations = true,
    includeMetadata = true,
    maxMatches = 50,
  } = options;

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: LayoutDefaults.margins.top,
      bottom: LayoutDefaults.margins.bottom,
      left: LayoutDefaults.margins.left,
      right: LayoutDefaults.margins.right,
    },
    info: {
      Title: getPDFTitle(format, data, language),
      Author: `PlagiatIA - ${data.analystName}`,
      Subject: `${format} report for ${data.documentTitle}`,
      Creator: 'PlagiatIA Professional v0.3',
    },
    bufferPages: true,
  });

  // Render based on format (async, will stream as it generates)
  setImmediate(() => {
    try {
      const templateOptions: TemplateOptions = {
        format,
        language,
        includeRecommendations,
        includeMetadata,
        maxMatches,
      };

      switch (format) {
        case 'full':
          renderFullReport(doc, data, templateOptions);
          break;
        case 'summary':
          renderSummaryReport(doc, data, templateOptions);
          break;
        case 'certificate':
          renderCertificate(doc, data, templateOptions);
          break;
      }

      doc.end();
    } catch (error) {
      doc.emit('error', error);
    }
  });

  return doc;
}
