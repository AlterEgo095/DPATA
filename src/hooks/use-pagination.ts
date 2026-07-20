// usePagination Hook
// PHASE 3: Améliorations Frontend - Helper pagination

import { useState, useCallback, useRouter, usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

interface UsePaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  totalItems?: number;
}

interface PaginationState {
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  offset: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { defaultPage = 1, defaultLimit = 20, totalItems = 0 } = options;
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get current values from URL or defaults
  const currentPage = parseInt(searchParams.get('page') || String(defaultPage));
  const currentLimit = parseInt(searchParams.get('limit') || String(defaultLimit));

  const [page, setPage] = useState(currentPage);
  const [limit, setLimit] = useState(currentLimit);

  const totalPages = Math.ceil(totalItems / limit);
  const offset = (page - 1) * limit;

  const paginationState: PaginationState = {
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    offset,
  };

  const updateURL = useCallback((newPage: number, newLimit?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    
    params.set('page', String(newPage));
    
    if (newLimit && newLimit !== defaultLimit) {
      params.set('limit', String(newLimit));
    }
    
    // Reset to page 1 when changing limit
    if (newLimit && newLimit !== limit) {
      params.set('page', '1');
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router, limit, defaultLimit]);

  const goToPage = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    updateURL(newPage);
  }, [totalPages, updateURL]);

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      goToPage(page + 1);
    }
  }, [page, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      goToPage(page - 1);
    }
  }, [page, goToPage]);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page
    updateURL(1, newLimit);
  }, [updateURL]);

  return {
    ...paginationState,
    setPage: goToPage,
    nextPage,
    prevPage,
    changeLimit,
    setLimit,
  };
}

/**
 * Generate array of page numbers for pagination display
 * Shows ellipsis for large page counts
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const halfVisible = Math.floor(maxVisible / 2);

  // Always show first page
  pages.push(1);

  if (currentPage <= halfVisible + 2) {
    // Near the start
    for (let i = 2; i <= Math.min(maxVisible - 1, totalPages - 1); i++) {
      pages.push(i);
    }
    pages.push('ellipsis');
  } else if (currentPage >= totalPages - halfVisible - 1) {
    // Near the end
    pages.push('ellipsis');
    for (let i = totalPages - maxVisible + 3; i < totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Middle
    pages.push('ellipsis');
    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
      pages.push(i);
    }
    pages.push('ellipsis');
  }

  // Always show last page
  pages.push(totalPages);

  return pages;
}
