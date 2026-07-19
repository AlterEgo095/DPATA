// Pagination Utilities for API Routes
// PHASE 2: Robustesse Backend

import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse and validate pagination parameters from URL search params
 */
export function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
  
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * Paginate an array of items
 */
export function paginateArray<T>(
  items: T[],
  params: PaginationParams,
  totalItems?: number
): PaginatedResponse<T> {
  const total = totalItems ?? items.length;
  const totalPages = Math.ceil(total / params.limit);
  const offset = params.offset;
  
  // Slice the array for current page
  const data = items.slice(offset, offset + params.limit);
  
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      totalItems: total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  };
}

/**
 * Create a paginated API response (NextResponse)
 */
export function createPaginatedResponse<T>(
  items: T[],
  params: PaginationParams,
  totalItems?: number,
  extraData?: Record<string, unknown>
) {
  const result = paginateArray(items, params, totalItems);
  
  return {
    ...result,
    ...extraData,
  };
}

/**
 * Filter array by search term (searches all string fields)
 */
export function filterBySearchTerm<T extends Record<string, unknown>>(
  items: T[],
  searchTerm: string,
  searchableFields?: (keyof T)[]
): T[] {
  if (!searchTerm || !searchTerm.trim()) return items;
  
  const term = searchTerm.toLowerCase().trim();
  
  return items.filter(item => {
    if (searchableFields && searchableFields.length > 0) {
      // Search only in specified fields
      return searchableFields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(term);
        }
        return false;
      });
    } else {
      // Search in all string fields
      return Object.values(item).some(value => 
        typeof value === 'string' && value.toLowerCase().includes(term)
      );
    }
  });
}

/**
 * Sort array by field
 */
export function sortArray<T>(items: T[], sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): T[] {
  if (!sortBy) return items;
  
  return [...items].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortBy];
    const bVal = (b as Record<string, unknown>)[sortBy];
    
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
}
