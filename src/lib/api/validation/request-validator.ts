// Request Validation System for PlagiatIA Public API
// Uses Zod for schema validation with sanitization

import { z } from 'zod';
import { ErrorCodes, apiValidationError } from '../response/api-response';

// ============================================================
// Sanitization helpers
// ============================================================

/**
 * Sanitize string input - remove potential XSS and injection patterns
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Limit length to prevent DoS
    .slice(0, 10000);
}

/**
 * Sanitize HTML entities (basic XSS prevention)
 */
export function escapeHtml(input: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
}

/**
 * Validate and sanitize a value against a Zod schema
 */
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options?: { sanitizeStrings?: boolean }
): { success: true; data: T } | { success: false; error: ReturnType<typeof apiValidationError>['response'] } {
  try {
    let processedData = data;
    
    // Pre-sanitize if requested
    if (options?.sanitizeStrings && typeof data === 'object' && data !== null) {
      processedData = sanitizeObject(data as Record<string, unknown>);
    }

    const result = schema.safeParse(processedData);
    
    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      return {
        success: false,
        error: apiValidationError(
          'Les données fournies ne sont pas valides.',
          { errors: formattedErrors }
        ).response,
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: apiValidationError(
        'Erreur lors de la validation des données.',
        { error: String(error) }
      ).response,
    };
  }
}

/**
 * Recursively sanitize object strings
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[sanitizeString(key)] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[sanitizeString(key)] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : 
        (typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : item)
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizeString(key)] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[sanitizeString(key)] = value;
    }
  }
  
  return sanitized;
}

// ============================================================
// Common validation schemas
// ============================================================

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
}).optional();

// ID parameter
export const idParamSchema = z.object({
  id: z.string().min(1),
});

// Date range filter
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true}, {
  message: "La date de fin doit être postérieure à la date de début.",
});

// Sort parameters
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
}).optional();

// ============================================================
// API v1 Endpoint Schemas
// ============================================================

// Auth endpoints
export const validateApiKeySchema = z.object({
  apiKey: z.string().min(1, 'La clé API est requise.'),
});

// Documents endpoints
export const listDocumentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'SUBMITTED', 'ANALYZING', 'ANALYZED', 'REJECTED', 'VALIDATED']).optional(),
  type: z.enum(['TFC', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE']).optional(),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createDocumentSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères.').max(500),
  type: z.enum(['TFC', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE']).default('TFC'),
  subject: z.string().max(1000).optional(),
  abstract: z.string().max(10000).optional(),
  content: z.string().max(10000000).optional(), // Text content for analysis
  facultyId: z.string().min(1, 'La faculté est requise.'),
  departmentId: z.string().min(1, 'Le département est requis.'),
  promotionId: z.string().optional(),
  academicYear: z.string().min(4).max(10),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  uploadedById: z.string().min(1, 'L\'utilisateur est requis.'),
});

export const documentIdParamSchema = z.object({
  id: z.string().min(1),
});

// Analysis endpoints
export const createAnalysisSchema = z.object({
  threshold: z.number().min(0).max(1).optional().default(0.80),
  scope: z.enum(['faculty', 'department', 'all']).optional().default('faculty'),
  engine: z.enum(['tfidf', 'hybrid', 'semantic']).optional().default('hybrid'),
});

export const analysisIdParamSchema = z.object({
  analysisId: z.string().min(1),
});

// Subjects endpoints
export const listSubjectsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  facultyId: z.string().optional(),
  departmentId: z.string().optional(),
  search: z.string().max(200).optional(),
  isValidated: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
});

export const validateSubjectSchema = z.object({
  title: z.string().min(5, 'Le titre doit contenir au moins 5 caractères.').max(500),
  description: z.string().min(20, 'La description doit contenir au moins 20 caractères.').max(10000),
  type: z.enum(['TFC', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE']),
  facultyId: z.string().min(1),
  departmentId: z.string().min(1),
  keywords: z.array(z.string()).max(10).optional(),
});

// Statistics endpoints
export const statisticsOverviewSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
  facultyId: z.string().optional(),
});

export const statisticsTrendsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
  metric: z.enum(['documents', 'analyses', 'plagiarism_rate', 'users']).optional().default('documents'),
  granularity: z.enum(['day', 'week', 'month']).optional().default('day'),
});

export const facultyStatsParamSchema = z.object({
  id: z.string().min(1),
});

// API Key management (internal)
export const createApiKeySchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.').max(100),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read']),
  rateLimit: z.number().int().min(10).max(10000).optional().default(1000),
  ipAddressWhitelist: z.array(z.string().ip()).optional(),
  expiresAt: z.coerce.date().optional(),
  isTest: z.boolean().optional().default(false),
});

// ============================================================
// Query parameter parser
// ============================================================

/**
 * Parse and validate query parameters from URLSearchParams
 */
export function parseQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; error: ReturnType<typeof apiValidationError>['response'] } {
  const params: Record<string, any> = {};
  
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  return validateAndSanitize(schema, params);
}

/**
 * Parse and validate JSON body from request
 */
export async function parseJsonBody<T>(
  schema: z.ZodSchema<T>,
  request: Request
): Promise<{ success: true; data: T } | { success: false; error: ReturnType<typeof apiValidationError>['response'] }> {
  try {
    const body = await request.json();
    return validateAndSanitize(schema, body, { sanitizeStrings: true });
  } catch (error) {
    return {
      success: false,
      error: apiValidationError(
        'Corps de la requête JSON invalide.',
        { hint: 'Vérifiez que le Content-Type est application/json' }
      ).response,
    };
  }
}
