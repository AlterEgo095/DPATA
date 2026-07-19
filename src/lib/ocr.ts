// OCR Service using Tesseract.js
// PHASE 4: Fonctionnalités Manquantes - OCR Implementation

import { createWorker, Worker, OEM, PSM } from 'tesseract.js';

// ============================================================================
// TYPES
// ============================================================================

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  words: OCRWord[];
  lines: OCRLine[];
  processingTime: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BBox;
}

export interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
}

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCROptions {
  language?: string | string[];
  oem?: OEM;
  psm?: PSM;
  enhanceContrast?: boolean;
  denoise?: boolean;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_OPTIONS: Required<OCROptions> = {
  language: ['fra', 'eng'], // French + English (academic context)
  oem: OEM.LSTM_ONLY,
  psm: PSM.AUTO,
  enhanceContrast: true,
  denoise: true,
};

// ============================================================================
// WORKER MANAGEMENT
// ============================================================================

let workerInstance: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerInstance) {
    workerInstance = await createWorker(DEFAULT_OPTIONS.language, 1, {
      logger: (m) => {
        if (process.env.NODE_ENV === 'development') {
          if (m.status === 'recognizing text') {
            console.debug(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      },
    });
    
    // Configure worker with optimal settings
    await workerInstance.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789àâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ&\'"()[]{}.,;:!?*/+-=@#$%_\\s\n\t',
      tessedit_pageseg_mode: DEFAULT_OPTIONS.psm,
    });
  }
  
  return workerInstance;
}

/**
 * Terminate the OCR worker to free memory
 */
export async function terminateWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}

// ============================================================================
// CORE OCR FUNCTIONS
// ============================================================================

/**
 * Extract text from an image file (Buffer or File)
 */
export async function extractTextFromImage(
  imageSource: Buffer | File | Blob,
  options?: Partial<OCROptions>
): Promise<OCRResult> {
  const startTime = Date.now();
  
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const worker = await getWorker();

    const { data } = await worker.recognize(imageSource);
    
    const processingTime = Date.now() - startTime;

    return {
      text: data.text,
      confidence: data.confidence,
      language: Array.isArray(opts.language) ? opts.language.join('+') : opts.language,
      words: data.words?.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1,
        },
      })) || [],
      lines: data.lines?.map(l => ({
        text: l.text,
        confidence: l.confidence,
        words: l.words?.map(w => ({
          text: w.text,
          confidence: w.confidence,
          bbox: {
            x0: w.bbox.x0,
            y0: w.bbox.y0,
            x1: w.bbox.x1,
            y1: w.bbox.y1,
          },
        })) || [],
      })) || [],
      processingTime,
    };
  } catch (error) {
    console.error('[OCR_ERROR]', error);
    throw new Error(`Échec de l'OCR: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Extract text from a base64 encoded image
 */
export async function extractTextFromBase64(
  base64Data: string,
  options?: Partial<OCROptions>
): Promise<OCRResult> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/(png|jpeg|jpg|gif|bmp|webp);base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  
  return extractTextFromImage(buffer, options);
}

/**
 * Extract text from an image URL
 */
export async function extractTextFromURL(
  imageUrl: string,
  options?: Partial<OCROptions>
): Promise<OCRResult> {
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new Error(`Impossible de charger l'image: ${response.status}`);
  }
  
  const blob = await response.blob();
  return extractTextFromImage(blob, options);
}

// ============================================================================
// QUALITY ASSESSMENT
// ============================================================================

/**
 * Assess OCR result quality
 */
export function assessQuality(result: OCRResult): {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // Check overall confidence
  if (result.confidence < 50) {
    issues.push('Confiance globale faible (< 50%)');
    score -= 30;
  } else if (result.confidence < 70) {
    issues.push('Confiance globale modérée');
    score -= 15;
  }

  // Check for empty results
  if (!result.text.trim()) {
    issues.push('Aucun texte extrait');
    score -= 50;
  }

  // Check for excessive special characters (indicates noise)
  const specialCharRatio = (result.text.match(/[^a-zA-Z0-9\sàâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ.,;:!?'()-]/g) || []).length / Math.max(result.text.length, 1);
  if (specialCharRatio > 0.3) {
    issues.push('Trop de caractères spéciaux (image bruitée?)');
    score -= 20;
  }

  // Check for common OCR errors
  const commonErrors = /\|/g.test(result.text); // Common misrecognition
  if (commonErrors) {
    issues.push('Possibles erreurs de reconnaissance (caractère |)');
    score -= 10;
  }

  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 85) quality = 'excellent';
  else if (score >= 70) quality = 'good';
  else if (score >= 50) quality = 'fair';
  else quality = 'poor';

  return { quality, score, issues };
}

// ============================================================================
// PREPROCESSING HELPERS
// ============================================================================

/**
 * Clean extracted text (post-processing)
 */
export function cleanExtractedText(text: string): string {
  return text
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove lone characters that are likely errors (except I, a, etc.)
    .replace(/\b[iI]\b(?=\s+[A-Z])/g, '')
    // Fix common OCR errors
    .replace(/\|/g, 'l')
    .replace(/0/g, 'O').replace(/O/g, 'o') // Context-dependent, basic fix
    // Trim
    .trim();
}

/**
 * Extract structured data from academic document
 */
export function extractAcademicMetadata(text: string): {
  title?: string;
  author?: string;
  date?: string;
  institution?: string;
  abstract?: string;
} {
  const metadata: Record<string, string | undefined> = {};

  // Try to find title (usually first line or after "Titre:")
  const titleMatch = text.match(/(?:titre|title)\s*[:\-]\s*(.+?)(?:\n|$)/i);
  metadata.title = titleMatch?.[1]?.trim() || text.split('\n')[0]?.trim();

  // Try to find author
  const authorMatch = text.match(/(?:auteur|author|par|by|réalisé\s+par)\s*[:\-]\s*(.+?)(?:\n|$)/i);
  metadata.author = authorMatch?.[1]?.trim();

  // Try to find date/year
  const dateMatch = text.match(/\b(19|20)\d{2}\b/);
  metadata.date = dateMatch?.[0];

  // Try to find institution
  const instMatch = text.match(/(?:université|university|faculté|faculty|école|school)\s+(?:de\s+)?(.+?)(?:\n|,|$)/i);
  metadata.institution = instMatch?.[1]?.trim();

  return metadata;
}
