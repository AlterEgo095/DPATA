// POST /api/ocr - Extract text from images using OCR
// PHASE 4: Fonctionnalités Manquantes - OCR API
//
// P4-D D6: Added audit() call (ocr.process) — captures IP + UA + result
// metadata (text length, confidence, language). No PII in the audit entry.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';
import { extractTextFromImage, assessQuality, cleanExtractedText } from '@/lib/ocr';
import { audit } from '@/lib/store/db';
import { getRequestMeta } from '@/lib/request-meta';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const { ip, userAgent } = getRequestMeta(req);

    const contentType = req.headers.get('content-type') || '';
    
    let imageBuffer: Buffer;
    let inputMeta: { sourceType: string; mimeType?: string; sizeBytes?: number } = {
      sourceType: 'unknown',
    };
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('image') as File | null;
      
      if (!file) {
        return NextResponse.json(
          { error: 'Aucune image fournie', code: 'NO_IMAGE' },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { 
            error: 'Format d\'image non supporté', 
            code: 'INVALID_FORMAT',
            supportedFormats: allowedTypes 
          },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image trop volumineuse (max 10MB)', code: 'FILE_TOO_LARGE' },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      inputMeta = { sourceType: 'multipart', mimeType: file.type, sizeBytes: file.size };
      
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      const { imageData, mimeType } = body;
      
      if (!imageData) {
        return NextResponse.json(
          { error: 'Aucune image fournie (imageData requis)', code: 'NO_IMAGE_DATA' },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      const base64Data = imageData.replace(/^data:image\/.+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      inputMeta = { sourceType: 'base64', mimeType: mimeType || 'unknown', sizeBytes: imageBuffer.length };
      
    } else {
      return NextResponse.json(
        { error: 'Content-Type non supporté. Utilisez multipart/form-data ou application/json', code: 'UNSUPPORTED_CONTENT_TYPE' },
        { status: 415, headers: getSecurityHeaders() }
      );
    }

    const ocrResult = await extractTextFromImage(imageBuffer);
    const cleanedText = cleanExtractedText(ocrResult.text);
    const quality = assessQuality(ocrResult);

    // ---------------------------------------------------------------
    // P4-D D6: audit log entry — ocr.process
    // ---------------------------------------------------------------
    try {
      await audit(
        user.sub,
        `${user.firstName} ${user.lastName}`,
        'OCR_PROCESS',
        'OCR',
        undefined,
        {
          inputSource: inputMeta.sourceType,
          inputMime: inputMeta.mimeType,
          inputSize: inputMeta.sizeBytes,
          textLength: cleanedText.length,
          wordCount: ocrResult.words.length,
          confidence: Math.round(ocrResult.confidence * 100) / 100,
          language: ocrResult.language,
          processingTimeMs: ocrResult.processingTime,
          qualityLevel: (quality as any)?.level || 'unknown',
        },
        ip,
        { userAgent, method: 'POST', path: '/api/ocr' }
      );
    } catch (auditErr) {
      console.error('[OCR] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({
      success: true,
      result: {
        text: cleanedText,
        rawText: ocrResult.text,
        confidence: Math.round(ocrResult.confidence * 100) / 100,
        language: ocrResult.language,
        wordCount: ocrResult.words.length,
        lineCount: ocrResult.lines.length,
        processingTime: ocrResult.processingTime,
      },
      quality,
      metadata: {
        extractedAt: new Date().toISOString(),
        extractedBy: user.sub,
      },
    }, { headers: getSecurityHeaders() });

  } catch (e) {
    console.error('[OCR_API_ERROR]', e);
    const error = sanitizeError(e);
    
    return NextResponse.json(
      { 
        ...error,
        hint: "Assurez-vous que l'image est claire et contient du texte lisible" 
      }, 
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}

// GET /api/ocr - Get OCR status/capabilities
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    return NextResponse.json({
      service: 'Tesseract.js',
      version: '7.0.0',
      status: 'operational',
      capabilities: {
        languages: ['fra', 'eng'],
        formats: ['png', 'jpeg', 'jpg', 'gif', 'bmp', 'webp'],
        maxSize: '10MB',
        features: [
          'text_extraction',
          'confidence_scores',
          'word_bounding_boxes',
          'line_detection',
          'quality_assessment',
          'text_cleaning',
        ],
      },
      options: {
        defaultLanguage: 'fra+eng',
        oem: 'LSTM_ONLY',
        psm: 'AUTO',
      },
    }, { headers: getSecurityHeaders() });
  } catch (e) {
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
