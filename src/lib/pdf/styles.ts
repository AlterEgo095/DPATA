// PDF Styles & Colors for PlagiatIA Professional Reports
// Module v0.3 - Corporate Design System

// ============================================================
// COLOR PALETTE - PlagiatIA Brand
// ============================================================

export const Colors = {
  // Primary - Emerald (PlagiatIA brand)
  primary: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981', // Main emerald
    600: '#059669', // Darker emerald
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  
  // Neutral - Slate
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  
  // Semantic colors
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  
  // Match type colors
  matchType: {
    COPY_PASTE: '#dc2626',     // Red
    PARAPHRASE: '#d97706',      // Amber
    REFORMULATION: '#9333ea',   // Purple
    TRANSLATION: '#0891b2',     // Cyan
    WEAK_MATCH: '#64748b',      // Slate
    AI_GENERATED: '#ec4899',    // Pink
  },
  
  // Verdict colors (based on score)
  verdict: {
    original: '#16a34a',        // Green - <15%
    lowSimilarity: '#84cc16',   // Lime - 15-30%
    moderateSimilarity: '#d97706', // Amber - 30-50%
    highSimilarity: '#ea580c',  // Orange - 50-70%
    plagiarism: '#dc2626',      // Red - >70%
  },
} as const;

// ============================================================
// TYPOGRAPHY
// ============================================================

export const Typography = {
  fonts: {
    // Font families (using built-in PDFKit fonts)
    primary: 'Helvetica',
    secondary: 'Helvetica-Bold',
    mono: 'Courier',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
  },
  
  sizes: {
    title: 24,
    heading1: 18,
    heading2: 14,
    heading3: 12,
    body: 10,
    small: 8,
    caption: 7,
  },
  
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

// ============================================================
// SPACING & LAYOUT
// ============================================================

export const Layout = {
  page: {
    width: 595.28, // A4 width in points
    height: 841.89, // A4 height in points
    margin: {
      top: 60,
      right: 50,
      bottom: 60,
      left: 50,
    },
    contentWidth: 495.28, // width - margins
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 2,
    md: 4,
    lg: 8,
    xl: 12,
    full: 9999,
  },
} as const;

// ============================================================
// COMPONENT STYLES
// ============================================================

export const ComponentStyles = {
  // Header bar at top of pages
  header: {
    backgroundColor: Colors.primary[600],
    textColor: '#ffffff',
    height: 40,
    padding: { x: Layout.page.margin.left, y: 10 },
  },
  
  // Footer at bottom of pages
  footer: {
    backgroundColor: Colors.slate[100],
    textColor: Colors.slate[500],
    fontSize: Typography.sizes.small,
    padding: { x: Layout.page.margin.left, y: 8 },
  },
  
  // Score display box
  scoreBox: {
    borderColor: Colors.primary[500],
    borderWidth: 2,
    borderRadius: Layout.borderRadius.lg,
    padding: 20,
    backgroundColor: Colors.primary[50],
  },
  
  // Match item card
  matchCard: {
    borderColor: Colors.slate[200],
    borderWidth: 1,
    borderRadius: Layout.borderRadius.md,
    marginBottom: Layout.spacing.md,
    padding: { x: 12, y: 10 },
  },
  
  // Stat card for statistics grid
  statCard: {
    borderColor: Colors.slate[200],
    borderWidth: 1,
    borderRadius: Layout.borderRadius.md,
    padding: 10,
    textAlign: 'center' as const,
  },
  
  // Section title with left border accent
  sectionTitle: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary[600],
    paddingLeft: 10,
    fontSize: Typography.sizes.heading2,
    fontWeight: 'bold',
    color: Colors.slate[800],
    marginBottom: Layout.spacing.md,
  },
  
  // Info grid item
  infoItem: {
    borderBottomColor: Colors.slate[200],
    borderBottomWidth: 1,
    paddingBottom: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
  },
  
  // Recommendation box
  recommendationBox: {
    borderColor: Colors.info,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: '#eff6ff',
    padding: { x: 12, y: 10 },
  },
  
  // Certificate border (for certificate template)
  certificateBorder: {
    outerBorder: {
      color: Colors.primary[600],
      width: 3,
    },
    innerBorder: {
      color: Colors.primary[300],
      width: 1,
    },
    cornerSize: 20,
  },
} as const;

// ============================================================
// VERDICT HELPERS
// ============================================================

export function getVerdictInfo(score: number): {
  label: string;
  labelEn: string;
  color: string;
  bgColor: string;
  severity: 'original' | 'low' | 'moderate' | 'high' | 'plagiarism';
} {
  const scorePercent = score * 100;
  
  if (scorePercent < 15) {
    return {
      label: 'Document Original',
      labelEn: 'Original Document',
      color: Colors.verdict.original,
      bgColor: '#f0fdf4',
      severity: 'original',
    };
  } else if (scorePercent < 30) {
    return {
      label: 'Faible Similarité',
      labelEn: 'Low Similarity',
      color: Colors.verdict.lowSimilarity,
      bgColor: '#f7fee7',
      severity: 'low',
    };
  } else if (scorePercent < 50) {
    return {
      label: 'Similarité Modérée',
      labelEn: 'Moderate Similarity',
      color: Colors.verdict.moderateSimilarity,
      bgColor: '#fffbeb',
      severity: 'moderate',
    };
  } else if (scorePercent < 70) {
    return {
      label: 'Similarité Élevée',
      labelEn: 'High Similarity',
      color: Colors.verdict.highSimilarity,
      bgColor: '#fff7ed',
      severity: 'high',
    };
  } else {
    return {
      label: 'Plagiat Probable',
      labelEn: 'Probable Plagiarism',
      color: Colors.verdict.plagiarism,
      bgColor: '#fef2f2',
      severity: 'plagiarism',
    };
  }
}

// ============================================================
// MATCH TYPE LABELS (Multilingual)
// ============================================================

export const MatchTypeLabels = {
  fr: {
    COPY_PASTE: 'Copier-Coller Strict',
    PARAPHRASE: 'Paraphrase',
    REFORMULATION: 'Reformulation',
    TRANSLATION: 'Traduction',
    WEAK_MATCH: 'Similarité Faible',
    AI_GENERATED: 'Contenu IA Généré',
  },
  en: {
    COPY_PASTE: 'Copy-Paste',
    PARAPHRASE: 'Paraphrase',
    REFORMULATION: 'Reformulation',
    TRANSLATION: 'Translation',
    WEAK_MATCH: 'Weak Match',
    AI_GENERATED: 'AI Generated Content',
  },
} as const;

// ============================================================
// DOCUMENT TYPE LABELS (Multilingual)
// ============================================================

export const DocumentTypeLabels = {
  fr: {
    TFC: 'Travail de Fin de Cycle',
    MEMOIRE: 'Mémoire',
    THESE: 'Thèse',
    ARTICLE: 'Article Scientifique',
    AUTRE: 'Autre Document',
  },
  en: {
    TFC: 'Final Year Project',
    MEMOIRE: "Master's Thesis",
    THESE: 'Doctoral Thesis',
    ARTICLE: 'Scientific Article',
    AUTRE: 'Other Document',
  },
} as const;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get contrast color (black or white) based on background
 */
export function getContrastColor(hexColor: string): string {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number, lang: 'fr' | 'en' = 'fr'): string {
  if (bytes === 0) return '0 B';
  
  const units = lang === 'fr' 
    ? ['o', 'Ko', 'Mo', 'Go'] 
    : ['B', 'KB', 'MB', 'GB'];
    
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format date according to locale
 */
export function formatDate(date: Date | string, lang: 'fr' | 'en' = 'fr'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', options);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
