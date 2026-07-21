// GET /api/documents/[id]/export-pdf
// Professional PDF Export for PlagiatIA Analysis Reports
// Module v0.3 - PDF Export API Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';
import {
  generateAnalysisReport,
  generateFilename,
  transformDbToAnalysisData,
  createSampleAnalysisData,
  type ReportFormat,
  type ReportLanguage,
} from '@/lib/pdf/generator';

// ============================================================
// TYPES
// ============================================================

type ExportFormat = ReportFormat; // 'full' | 'summary' | 'certificate'

// ============================================================
// VALIDATION
// ============================================================

const VALID_FORMATS: ExportFormat[] = ['full', 'summary', 'certificate'];
const VALID_LANGUAGES: ReportLanguage[] = ['fr', 'en'];

function validateFormat(format?: string | null): ExportFormat {
  const f = format?.toLowerCase();
  if (f && VALID_FORMATS.includes(f as ExportFormat)) {
    return f as ExportFormat;
  }
  return 'full'; // default
}

function validateLanguage(lang?: string | null): ReportLanguage {
  const l = lang?.toLowerCase();
  if (l && VALID_LANGUAGES.includes(l as ReportLanguage)) {
    return l as ReportLanguage;
  }
  return 'fr'; // default
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    // 1. Authentication check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    // 2. Parse parameters
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const format = validateFormat(searchParams.get('format'));
    const language = validateLanguage(searchParams.get('lang') || searchParams.get('language'));
    const maxMatches = parseInt(searchParams.get('maxMatches') || '50', 10);
    const includeMetadata = searchParams.get('metadata') !== 'false';
    const includeRecommendations = searchParams.get('recommendations') !== 'false';

    // Validate maxMatches
    const safeMaxMatches = Math.min(Math.max(maxMatches, 0), 200);

    console.log(`[PDF_EXPORT] Request: document=${id}, format=${format}, lang=${language}, user=${user.sub}`);

    // 3. Load document and analysis data
    const db = await loadDB();

    // Find document
    const doc = db.documents.find(d => d.id === id);
    if (!doc) {
      return NextResponse.json(
        { error: 'Document introuvable', code: 'DOCUMENT_NOT_FOUND' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // Find completed analysis
    const analysis = db.analyses.find(
      a => a.documentId === id && a.status === 'COMPLETED'
    );

    // Get matches if analysis exists
    const matches = analysis 
      ? db.matches.filter(m => m.analysisId === analysis.id)
      : [];

    // Get analyst info
    const analyst = db.users.find(u => u.id === analysis?.triggeredById);

    // 4. Transform to AnalysisData format
    let analysisData;

    if (analysis && matches.length > 0) {
      // Real data transformation
      analysisData = transformDbToAnalysisData({
        document: {
          ...doc,
          faculty: db.faculties.find(f => f.id === doc.facultyId),
          department: db.departments.find(d => d.id === doc.departmentId),
          promotion: doc.promotionId ? db.promotions.find(p => p.id === doc.promotionId) : undefined,
          uploadedBy: db.users.find(u => u.id === doc.uploadedById),
        },
        analysis: {
          ...analysis,
        },
        matches: matches.map(m => ({
          ...m,
          matchType: m.matchType,
        })),
        analyst: analyst ? {
          firstName: analyst.firstName,
          lastName: analyst.lastName,
          role: analyst.role,
        } : null,
        engineInfo: {
          type: 'HYBRID',
          version: '3.0.0',
          modelVersion: 'distiluse-base-multilingual-cased-v1',
        },
      });
    } else if (analysis) {
      // Analysis exists but no matches - use analysis data with empty matches
      analysisData = transformDbToAnalysisData({
        document: {
          ...doc,
          faculty: db.faculties.find(f => f.id === doc.facultyId),
          department: db.departments.find(d => d.id === doc.departmentId),
          promotion: doc.promotionId ? db.promotions.find(p => p.id === doc.promotionId) : undefined,
          uploadedBy: db.users.find(u => u.id === doc.uploadedById),
        },
        analysis: {
          ...analysis,
        },
        matches: [],
        analyst: analyst ? {
          firstName: analyst.firstName,
          lastName: analyst.lastName,
          role: analyst.role,
        } : null,
      });
    } else {
      // No analysis - generate sample/demo report with available document info
      console.log(`[PDF_EXPORT] No analysis found for document ${id}, generating demo report`);
      
      analysisData = createSampleAnalysisData({
        documentId: doc.id,
        documentTitle: doc.title,
        documentType: doc.type,
        documentSubject: doc.subject || undefined,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        authorName: doc.uploadedBy 
          ? `${db.users.find(u => u.id === doc.uploadedBy)?.firstName || ''} ${db.users.find(u => u.id === doc.uploadedBy)?.lastName || ''}`
          : 'Inconnu',
        facultyName: db.faculties.find(f => f.id === doc.facultyId)?.name,
        departmentName: db.departments.find(d => d.id === doc.departmentId)?.name,
        academicYear: doc.academicYear,
        globalScore: 0, // No score without analysis
        matchedSegments: 0,
        totalSegments: 0,
        matches: [],
        status: 'NO_ANALYSIS',
        analystName: `${user.firstName} ${user.lastName}`,
        analystRole: user.role,
      });
    }

    // 5. Generate PDF
    const pdfBuffer = await generateAnalysisReport({
      data: analysisData,
      format,
      language,
      includeRecommendations,
      includeMetadata,
      maxMatches: safeMaxMatches,
    });

    // Check size limit (2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (pdfBuffer.length > maxSize) {
      console.warn(`[PDF_EXPORT] PDF size (${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB) exceeds recommended limit`);
    }

    // 6. Generate filename
    const filename = generateFilename(format, analysisData, language);

    // 7. Log success
    const processingTime = Date.now() - startTime;
    console.log(`[PDF_EXPORT] Success: ${filename}, size=${(pdfBuffer.length / 1024).toFixed(1)}KB, time=${processingTime}ms`);

    // 8. Return PDF response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'X-Processing-Time': String(processingTime),
        'X-PDF-Format': format,
        'X-PDF-Language': language,
        ...getSecurityHeaders(),
      },
    });

  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    console.error('[PDF_EXPORT_ERROR]', error);
    
    const sanitizedError = sanitizeError(error);
    
    return NextResponse.json(
      {
        error: 'Erreur lors de la génération du PDF',
        message: sanitizedError.error || 'Unknown error',
        code: 'PDF_GENERATION_ERROR',
        processingTime,
      },
      { 
        status: 500, 
        headers: getSecurityHeaders() 
      }
    );
  }
}

// ============================================================
// HEAD method for preflight/check
// ============================================================

export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse(null, { status: 401, headers: getSecurityHeaders() });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = validateFormat(searchParams.get('format'));

    const db = await loadDB();
    const doc = db.documents.find(d => d.id === id);

    if (!doc) {
      return new NextResponse(null, { status: 404, headers: getSecurityHeaders() });
    }

    const analysis = db.analyses.find(a => a.documentId === id && a.status === 'COMPLETED');
    
    // Return metadata about what would be generated
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Accept-Ranges': 'none',
        'X-Document-Exists': 'true',
        'X-Analysis-Available': analysis ? 'true' : 'false',
        'X-Supported-Formats': VALID_FORMATS.join(','),
        'X-Default-Format': format,
        ...getSecurityHeaders(),
      },
    });

  } catch (error) {
    return new NextResponse(null, { 
      status: 500, 
      headers: getSecurityHeaders() 
    });
  }
}
