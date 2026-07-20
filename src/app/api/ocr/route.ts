// POST /api/ocr - Extract text from images using OCR
// PHASE 4: Fonctionnalités Manquantes - OCR API

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSecurityHeaders, sanitizeError } from '@/lib/security';
import { extractTextFromImage, assessQuality, cleanExtractedText } from '@/lib/ocr';

export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    // Check content type
    const contentType = req.headers.get('content-type') || '';
    
    let imageBuffer: Buffer;
    
    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await req.formData();
      const file = formData.get('image') as File | null;
      
      if (!file) {
        return NextResponse.json(
          { error: 'Aucune image fournie', code: 'NO_IMAGE' },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      // Validate file type
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

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image trop volumineuse (max 10MB)', code: 'FILE_TOO_LARGE' },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      
    } else if (contentType.includes('application/json')) {
      // Base64 encoded image
      const body = await req.json();
      const { imageData, mimeType } = body;
      
      if (!imageData) {
        return NextResponse.json(
          { error: 'Aucune image fournie (imageData requis)', code: 'NO_IMAGE_DATA' },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      // Remove data URL prefix if present
      const base64Data = imageData.replace(/^data:image\/.+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      
    } else {
      return NextResponse.json(
        { error: 'Content-Type non supporté. Utilisez multipart/form-data ou application/json', code: 'UNSUPPORTED_CONTENT_TYPE' },
        { status: 415, headers: getSecurityHeaders() }
      );
    }

    // Perform OCR
    const ocrResult = await extractTextFromImage(imageBuffer);
    
    // Clean the extracted text
    const cleanedText = cleanExtractedText(ocrResult.text);
    
    // Assess quality
    const quality = assessQuality(ocrResult);

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
