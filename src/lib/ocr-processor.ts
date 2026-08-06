// OCR Processor Module — Full document processing pipeline
// Task ID: 6 — PlagiatIA OCR Module
// Extracts text from PDF, DOCX, TXT, images and splits into subjects

// @ts-expect-error error TS1192: see P2-C audit
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// ============================================================================
// TYPES
// ============================================================================

export interface Subject {
  index: number;
  title: string;
  content: string;
  startChar: number;
  endChar: number;
  wordCount: number;
  language?: string;
}

export interface OCRResult {
  success: boolean;
  fullText: string;
  cleanedText: string;
  subjects: Subject[];
  detectedLanguage: string;
  languageConfidence: number;
  metadata: {
    mimeType: string;
    fileSize: number;
    extractionMethod: string;
    processingTimeMs: number;
    extractedAt: string;
  };
  subjectAnalyses?: SubjectAnalysis[];
}

export interface SubjectAnalysis {
  subjectIndex: number;
  subjectTitle: string;
  validationResult: {
    isOriginal: boolean;
    similarityScore: number;
    similarityPercent: number;
    classification: {
      label: string;
      level: string;
      color: string;
      description: string;
    };
    report?: string;
    recommendation?: string;
    similarSubjects?: any[];
    alternatives?: string[];
  };
  processingTimeMs: number;
  error?: string;
}

export interface ExtractionOptions {
  language?: string;
  ocrModel?: string;
  maxSubjects?: number;
  minSubjectWords?: number;
  analyzeSubjects?: boolean;
  analysisThreshold?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ZAI_API_KEY = process.env.ZAI_API_KEY || '';
const ZAI_API_BASE = 'https://api.z.ai/api/paas/v4';
const VLM_MODEL = 'glm-4.6v-flash';
const LLM_MODEL = 'glm-4.5-flash';

const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  language: 'auto',
  ocrModel: VLM_MODEL,
  maxSubjects: 20,
  minSubjectWords: 5,
  analyzeSubjects: false,
  analysisThreshold: 0.20,
};

const SUPPORTED_MIME_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt: ['text/plain', 'text/html', 'text/csv', 'text/markdown'],
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/tiff', 'image/bmp'],
};

// ============================================================================
// TEXT EXTRACTION
// ============================================================================

/**
 * Main dispatch: extract text from any supported file format
 */
export async function extractText(
  fileBuffer: Buffer,
  mimeType: string,
  options?: Partial<ExtractionOptions>
): Promise<{ text: string; method: string }> {
  // Normalize MIME type: strip charset, trim, lowercase
  const clean = mimeType.split(';')[0].trim().toLowerCase();
  
  if (SUPPORTED_MIME_TYPES.pdf.includes(clean)) {
    const text = await extractFromPDF(fileBuffer);
    return { text, method: 'pdf-parse' };
  }

  if (SUPPORTED_MIME_TYPES.docx.includes(clean)) {
    const text = await extractFromDOCX(fileBuffer);
    return { text, method: 'mammoth' };
  }

  if (SUPPORTED_MIME_TYPES.txt.includes(clean)) {
    return { text: fileBuffer.toString('utf-8'), method: 'direct-read' };
  }

  if (SUPPORTED_MIME_TYPES.image.includes(clean)) {
    const text = await extractFromImage(fileBuffer, options?.ocrModel);
    return { text, method: 'zai-vlm-ocr' };
  }

  throw new Error(`Format non supporté: ${clean}. Formats supportés: PDF, DOCX, TXT, PNG, JPG, WEBP, TIFF`);
}

/**
 * Extract text from PDF using pdf-parse
 */
async function extractFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    // pdf-parse returns pages array - concatenate all pages
    const fullText = data.text || '';
    if (!fullText.trim()) {
      // If text extraction fails, the PDF might be scanned
      throw new Error('PDF scanned — pas de texte extractible');
    }
    return fullText;
  } catch (error: any) {
    if (error.message?.includes('scanned') || error.message?.includes('extractible')) {
      // Attempt OCR on the first page rendered as image
      console.warn('[OCR] PDF seems scanned, would need image rendering for OCR');
      throw error;
    }
    throw new Error(`Extraction PDF échouée: ${error.message}`);
  }
}

/**
 * Extract text from DOCX using mammoth
 */
async function extractFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error: any) {
    throw new Error(`Extraction DOCX échouée: ${error.message}`);
  }
}

/**
 * Extract text from images using ZAI VLM (Vision Language Model)
 */
async function extractFromImage(buffer: Buffer, model?: string): Promise<string> {
  const startTime = Date.now();

  if (!ZAI_API_KEY) {
    throw new Error('ZAI_API_KEY non configurée — impossible d\'utiliser le modèle VLM pour OCR');
  }

  const base64Image = buffer.toString('base64');
  const mimeGuess = guessImageMime(buffer);

  const systemPrompt = `You are an expert OCR system. Extract ALL text from the provided image exactly as it appears.
Rules:
- Preserve the original structure, paragraphs, and line breaks
- Do NOT translate, summarize, or modify any text
- Keep all numbers, symbols, and special characters (accents, punctuation)
- If the image contains a list of academic subjects/topics, preserve the numbering
- If text is in French, English, or Swahili, keep it in that language
- Return ONLY the extracted text, nothing else`;

  const userPrompt = 'Extract all text from this image. Preserve structure and formatting.';

  try {
    const response = await fetch(`${ZAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || VLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeGuess};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(90000), // 90s for VLM
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`VLM API ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    const elapsed = Date.now() - startTime;
    console.log(`[OCR-VLM] Image processed in ${elapsed}ms, extracted ${text.length} chars`);

    if (!text.trim()) {
      throw new Error('Aucun texte extrait de l\'image par le VLM');
    }

    return text;
  } catch (error: any) {
    console.error('[OCR-VLM] Error:', error.message);
    throw new Error(`OCR image échoué: ${error.message}`);
  }
}

// ============================================================================
// TEXT CLEANING & NORMALIZATION
// ============================================================================

/**
 * Clean and normalize extracted text
 */
export function cleanAndNormalize(text: string): string {
  return text
    // Replace multiple newlines with double newline (paragraph separator)
    .replace(/\n{3,}/g, '\n\n')
    // Replace multiple spaces with single space
    .replace(/[^\S\n]{2,}/g, ' ')
    // Remove page headers/footers patterns (common in PDFs)
    .replace(/^Page\s+\d+\s*$/gm, '')
    // Remove common PDF artifacts
    .replace(/\f/g, '\n') // Form feed -> newline
    .replace(/\r\n/g, '\n') // CRLF -> LF
    .replace(/\r/g, '\n')   // CR -> LF
    // Clean up OCR artifacts
    .replace(/\|/g, 'l')    // Common misrecognition
    // Remove trailing whitespace per line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    // Trim overall
    .trim();
}

/**
 * Guess image MIME type from magic bytes
 */
function guessImageMime(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
  if (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) return 'image/tiff';
  if (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A) return 'image/tiff';
  return 'image/png'; // default fallback
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect language of text using pattern-based heuristics + LLM fallback
 */
export async function detectLanguage(text: string): Promise<{
  language: string;
  confidence: number;
}> {
  // Fast heuristic detection
  const sample = text.substring(0, 2000);

  // Count language indicators
  const frenchIndicators = /\b(le|la|les|de|des|du|et|est|dans|pour|avec|une|sur|que|qui|par|au|aux|pas|plus|sont|été|étant|cette|Cette|l'|d'|n'|s')\b/g;
  const englishIndicators = /\b(the|is|are|and|of|in|to|a|for|that|with|this|from|by|at|an|be|was|were|been|has|have|had|not|but|or|their|which)\b/g;
  const swahiliIndicators = /\b(na|ya|wa|ni|kwa|katika|hii|haya|wetu|yake|mimi|wewe|yeye|tupu|kubwa|ndogo|sasa|kazi|taifa|elimu|chuo|soma|andika|kwenye)\b/g;

  const frenchScore = (sample.match(frenchIndicators) || []).length;
  const englishScore = (sample.match(englishIndicators) || []).length;
  const swahiliScore = (sample.match(swahiliIndicators) || []).length;

  const total = frenchScore + englishScore + swahiliScore;

  if (total > 5) {
    // Enough signal for heuristic detection
    const frConf = frenchScore / total;
    const enConf = englishScore / total;
    const swConf = swahiliScore / total;

    if (frConf > 0.4) return { language: 'fr', confidence: Math.round(frConf * 100) };
    if (enConf > 0.4) return { language: 'en', confidence: Math.round(enConf * 100) };
    if (swConf > 0.3) return { language: 'sw', confidence: Math.round(swConf * 100) };
  }

  // Fallback to LLM for ambiguous cases
  try {
    const detected = await detectLanguageWithLLM(sample);
    return detected;
  } catch {
    // Default to French (primary academic language at UNIKIN)
    return { language: 'fr', confidence: 50 };
  }
}

async function detectLanguageWithLLM(text: string): Promise<{
  language: string;
  confidence: number;
}> {
  if (!ZAI_API_KEY) return { language: 'fr', confidence: 50 };

  const sample = text.substring(0, 500);
  try {
    const response = await fetch(`${ZAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a language detection tool. Respond with ONLY a JSON object: {"language":"fr"|"en"|"sw","confidence":0-100}',
          },
          {
            role: 'user',
            content: `Detect the language of this text (French, English, or Swahili):\n\n"${sample}"`,
          },
        ],
        temperature: 0,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error('LLM language detection failed');

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const lang = parsed.language === 'sw' ? 'sw' : parsed.language === 'en' ? 'en' : 'fr';
      return { language: lang, confidence: Math.min(100, Math.max(0, parsed.confidence || 50)) };
    }
  } catch (error) {
    console.warn('[OCR] LLM language detection failed:', error);
  }

  return { language: 'fr', confidence: 50 };
}

// ============================================================================
// SUBJECT SPLITTING
// ============================================================================

/**
 * Split full text into distinct academic subjects
 * Detects: numbered lists, titled sections, separators, line breaks
 */
export function splitIntoSubjects(
  text: string,
  options?: Partial<ExtractionOptions>
): Subject[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const subjects: Subject[] = [];

  // Strategy 1: Try numbered/bulleted list patterns
  const numberedSubjects = trySplitByNumbering(text, opts.minSubjectWords);
  if (numberedSubjects.length > 0) {
    return numberedSubjects;
  }

  // Strategy 2: Try titled sections (e.g., "Subject 1: Title" or "1. Title")
  const titledSubjects = trySplitByTitles(text, opts.minSubjectWords);
  if (titledSubjects.length > 1) {
    return titledSubjects;
  }

  // Strategy 3: Split by double newlines (paragraphs)
  const paragraphSubjects = trySplitByParagraphs(text, opts.minSubjectWords);
  if (paragraphSubjects.length > 1) {
    return paragraphSubjects;
  }

  // Fallback: Return entire text as single subject
  return [{
    index: 0,
    title: text.substring(0, 80).replace(/\n/g, ' ').trim(),
    content: text,
    startChar: 0,
    endChar: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  }];
}

function trySplitByNumbering(text: string, minWords: number): Subject[] {
  const subjects: Subject[] = [];
  const lines = text.split('\n');
  let currentSubject: { title: string; lines: string[]; startLine: number } | null = null;

  // Match numbered/bulleted patterns: "1.", "1)", "I.", "A.", "•", etc.
  const numberPattern = /^[\s]*((?:\d+|[IVXivx]+)\s*[.\)\-\u2013\u2014]\s*|[\u2022\*\u25CF\u25CB\u25AA\u25AB]\s*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(numberPattern);

    if (match) {
      // Save previous subject
      if (currentSubject) {
        const content_ = currentSubject.lines.join('\n').trim();
        if (content_.split(/\s+/).length >= minWords) {
          const startChar = lines.slice(0, currentSubject.startLine).join('\n').length + 1;
          subjects.push({
            index: subjects.length,
            title: currentSubject.title,
            content: content_,
            startChar,
            endChar: startChar + content_.length,
            wordCount: content_.split(/\s+/).length,
          });
        }
      }

      // Start new subject — strip numbering prefix
      const title = line.replace(numberPattern, '').trim();
      currentSubject = {
        title: title || `Sujet ${subjects.length + 1}`,
        lines: [line],
        startLine: i,
      };
    } else if (currentSubject && line.trim()) {
      // Non-empty line after a numbered item: it's part of the same subject
      currentSubject.lines.push(line);
    }
    // Skip blank lines before any numbered item (headers/preamble)
  }

  // Save last subject
  if (currentSubject) {
    const content_ = currentSubject.lines.join('\n').trim();
    if (content_.split(/\s+/).length >= minWords) {
      const startChar = lines.slice(0, currentSubject.startLine).join('\n').length + 1;
      subjects.push({
        index: subjects.length,
        title: currentSubject.title,
        content: content_,
        startChar,
        endChar: startChar + content_.length,
        wordCount: content_.split(/\s+/).length,
      });
    }
  }

  return subjects;
}

function trySplitByTitles(text: string, minWords: number): Subject[] {
  const subjects: Subject[] = [];
  const lines = text.split('\n');

  // Pattern: lines that are all caps, or underlined (preceded/followed by ---, ===, ___)
  const titlePattern = /^(?:[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ\s&,\-']{5,})$|^(?:-{3,}|={3,}|_{3,})$/;

  let currentTitle = 'Sujet sans titre';
  let currentLines: string[] = [];
  let charOffset = 0;

  for (const line of lines) {
    charOffset += line.length + 1; // +1 for \n

    if (titlePattern.test(line.trim()) && !line.trim().startsWith('-') && line.trim().length > 5) {
      // This is a title
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content.split(/\s+/).length >= minWords) {
          subjects.push({
            index: subjects.length,
            title: currentTitle,
            content,
            startChar: charOffset - content.length - currentLines.length - 1,
            endChar: charOffset - 1,
            wordCount: content.split(/\s+/).length,
          });
        }
      }
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Last subject
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content.split(/\s+/).length >= minWords) {
      subjects.push({
        index: subjects.length,
        title: currentTitle,
        content,
        startChar: charOffset - content.length - currentLines.length - 1,
        endChar: charOffset - 1,
        wordCount: content.split(/\s+/).length,
      });
    }
  }

  return subjects;
}

function trySplitByParagraphs(text: string, minWords: number): Subject[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  if (paragraphs.length <= 1) return [];

  const subjects: Subject[] = [];
  let charOffset = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount >= minWords) {
      const title = trimmed.split('\n')[0].substring(0, 80).trim();
      const start = text.indexOf(trimmed, charOffset);
      subjects.push({
        index: subjects.length,
        title,
        content: trimmed,
        startChar: Math.max(0, start),
        endChar: Math.max(0, start) + trimmed.length,
        wordCount,
      });
    }
    charOffset += para.length + 2;
  }

  return subjects;
}

// ============================================================================
// SUBJECT VALIDATION (via internal pipeline)
// ============================================================================

/**
 * Analyze a single subject through the validation pipeline
 * Uses internal imports to avoid HTTP round-trip
 */
export async function analyzeSubject(
  subject: Subject,
  threshold: number = 0.20
): Promise<SubjectAnalysis> {
  const startTime = Date.now();

  try {
    // Dynamically import to avoid issues if module not available
    const { validateSubject } = await import('@/lib/ia/subjectEngine');
    const { loadDB } = await import('@/lib/store/db');

    const db = await loadDB();
    const knowledgeBase = (db.academicSubjects || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      domain: s.domain,
      keywords: s.keywords,
      objectives: s.objectives,
      problemStatement: s.problemStatement,
    }));

    // Use first line as title, rest as description
    const lines = subject.content.split('\n').filter(l => l.trim());
    const title = subject.title || lines[0] || 'Sujet sans titre';
    const description = lines.length > 1 ? lines.slice(1).join(' ') : subject.content;

    const result = validateSubject(
      { title, description },
      knowledgeBase,
      threshold
    );

    // Classification
    const classification = classifySubject(result.similarityScore);

    return {
      subjectIndex: subject.index,
      subjectTitle: title,
      validationResult: {
        isOriginal: result.isOriginal,
        similarityScore: result.similarityScore,
        similarityPercent: Math.round(result.similarityScore * 100),
        classification,
        report: result.report,
        recommendation: result.recommendation,
        similarSubjects: result.similarSubjects,
        alternatives: result.alternatives,
      },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      subjectIndex: subject.index,
      subjectTitle: subject.title,
      validationResult: {
        isOriginal: false,
        similarityScore: 0,
        similarityPercent: 0,
        classification: {
          label: 'Erreur d\'analyse',
          level: 'ERROR',
          color: 'gray',
          description: error.message,
        },
      },
      processingTimeMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

function classifySubject(score: number) {
  if (score >= 0.80) return { label: 'Déjà existant', level: 'EXISTING', color: 'red', description: 'Un sujet identique ou quasi-identique existe déjà.' };
  if (score >= 0.60) return { label: 'Fortement similaire', level: 'STRONGLY_SIMILAR', color: 'orange', description: 'Sujet très proche de sujets existants.' };
  if (score >= 0.30) return { label: 'Sujet proche', level: 'CLOSE', color: 'yellow', description: 'Sujet partageant des thématiques communes.' };
  return { label: 'Sujet original', level: 'ORIGINAL', color: 'green', description: 'Sujet semblant original.' };
}

// ============================================================================
// FULL PIPELINE
// ============================================================================

/**
 * Process a complete document through the full OCR pipeline
 * 1. Extract text based on MIME type
 * 2. Clean and normalize
 * 3. Detect language
 * 4. Split into subjects
 * 5. Optionally analyze each subject
 */
export async function processDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileSize: number,
  options?: Partial<ExtractionOptions>
): Promise<OCRResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log(`[OCR-Processor] Processing document: ${mimeType}, size: ${fileSize} bytes`);

  // Step 1: Extract text
  const { text, method } = await extractText(fileBuffer, mimeType, opts);
  if (!text.trim()) {
    throw new Error('Aucun texte extrait du document');
  }

  // Step 2: Clean and normalize
  const cleanedText = cleanAndNormalize(text);

  // Step 3: Detect language
  const { language, confidence } = await detectLanguage(cleanedText);

  // Step 4: Split into subjects
  const subjects = splitIntoSubjects(cleanedText, opts)
    .slice(0, opts.maxSubjects);

  // Step 5: Optionally analyze each subject
  let subjectAnalyses: SubjectAnalysis[] | undefined;
  if (opts.analyzeSubjects) {
    console.log(`[OCR-Processor] Analyzing ${subjects.length} subjects...`);
    subjectAnalyses = [];
    for (const subject of subjects) {
      const analysis = await analyzeSubject(subject, opts.analysisThreshold);
      subjectAnalyses.push(analysis);
    }
  }

  const processingTimeMs = Date.now() - startTime;

  console.log(`[OCR-Processor] Done in ${processingTimeMs}ms: ${cleanedText.length} chars, ${subjects.length} subjects, lang=${language}`);

  return {
    success: true,
    fullText: text,
    cleanedText,
    subjects,
    detectedLanguage: language,
    languageConfidence: confidence,
    metadata: {
      mimeType,
      fileSize,
      extractionMethod: method,
      processingTimeMs,
      extractedAt: new Date().toISOString(),
    },
    subjectAnalyses,
  };
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  // Strip charset parameter (e.g., "text/plain;charset=utf-8" -> "text/plain")
  const clean = mimeType.split(';')[0].trim().toLowerCase();
  return Object.values(SUPPORTED_MIME_TYPES).some(types => types.includes(clean));
}

/**
 * Get list of supported MIME types
 */
export function getSupportedMimeTypes(): string[] {
  return Object.values(SUPPORTED_MIME_TYPES).flat();
}

/**
 * Validate file before processing
 */
export function validateFile(
  fileBuffer: Buffer,
  mimeType: string,
  maxSizeBytes: number = 20 * 1024 * 1024 // 20MB
): { valid: boolean; error?: string } {
  if (!isSupportedMimeType(mimeType)) {
    const clean = mimeType.split(';')[0].trim().toLowerCase();
    return {
      valid: false,
      error: `Format non supporté: ${clean}. Formats supportés: PDF, DOCX, TXT, PNG, JPG, WEBP, TIFF`,
    };
  }

  if (fileBuffer.length === 0) {
    return { valid: false, error: 'Fichier vide' };
  }

  if (fileBuffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `Fichier trop volumineux (${Math.round(fileBuffer.length / 1024 / 1024)}MB, max ${Math.round(maxSizeBytes / 1024 / 1024)}MB)`,
    };
  }

  return { valid: true };
}
