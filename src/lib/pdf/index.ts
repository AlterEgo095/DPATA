// PDF Module - PlagiatIA Professional Reports
// Module v0.3 - Main Entry Point

// Generator
export {
  generateAnalysisReport,
  generateFilename,
  transformDbToAnalysisData,
  createSampleAnalysisData,
  createPDFStream,
  type GeneratePDFOptions,
} from './generator';

// Re-export types
export type {
  AnalysisData,
  MatchData,
  ReportFormat,
  ReportLanguage,
} from './generator';

// Templates
export {
  renderFullReport,
  renderSummaryReport,
  renderCertificate,
  type TemplateOptions,
} from './templates';

// Styles & Constants
export {
  Colors,
  Typography,
  Layout,
  ComponentStyles,
  getVerdictInfo,
  MatchTypeLabels,
  DocumentTypeLabels,
  getContrastColor,
  formatFileSize,
  formatDate as formatPdfDate,
  truncateText,
} from './styles';
