'use client';

// PDF Export Button Component for PlagiatIA
// Module v0.3 - Professional UI for PDF Export

import React, { useState, useCallback } from 'react';
import { Loader2, Download, FileText, Award, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

export type PdfExportFormat = 'full' | 'summary' | 'certificate';

interface PdfExportButtonProps {
  /** Document ID to export */
  documentId: string;
  
  /** Optional: Document title (for toast messages) */
  documentTitle?: string;
  
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  
  /** Show format selector in dropdown */
  showFormatSelector?: boolean;
  
  /** Default export format */
  defaultFormat?: PdfExportFormat;
  
  /** Language preference */
  language?: 'fr' | 'en';
  
  /** Additional CSS class */
  className?: string;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Callback on successful export */
  onExportComplete?: (format: PdfExportFormat) => void;
  
  /** Callback on error */
  onError?: (error: Error) => void;
}

// ============================================================
// FORMAT CONFIG
// ============================================================

const FORMAT_CONFIG = {
  full: {
    icon: FileText,
    label: { fr: 'Rapport Complet', en: 'Full Report' },
    description: { 
      fr: 'Rapport détaillé avec toutes les correspondances', 
      en: 'Detailed report with all matches' 
    },
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  summary: {
    icon: FileBarChart,
    label: { fr: 'Synthèse', en: 'Summary' },
    description: { 
      fr: 'Vue synthétique sur une page', 
      en: 'One-page summary view' 
    },
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  certificate: {
    icon: Award,
    label: { fr: "Certificat d'Originalité", en: 'Originality Certificate' },
    description: { 
      fr: 'Certificat officiel d\'originalité', 
      en: 'Official originality certificate' 
    },
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
} as const;

// ============================================================
// MAIN COMPONENT
// ============================================================

export function PdfExportButton({
  documentId,
  documentTitle,
  variant = 'outline',
  size = 'default',
  showFormatSelector = true,
  defaultFormat = 'full',
  language = 'fr',
  className = '',
  disabled = false,
  onExportComplete,
  onError,
}: PdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<PdfExportFormat>(defaultFormat);

  /**
   * Handle PDF download
   */
  const handleExport = useCallback(async (format: PdfExportFormat) => {
    if (isExporting || disabled) return;

    setIsExporting(true);
    
    try {
      // Build URL with parameters
      const params = new URLSearchParams({
        format,
        lang: language,
      });

      const response = await fetch(
        `/api/documents/${documentId}/export-pdf?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/pdf',
          },
        }
      );

      // Check for errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Get filename from headers or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `plagiata_report_${documentId}.pdf`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      // Get blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success toast
      const formatLabel = FORMAT_CONFIG[format].label[language];
      toast.success(language === 'fr' ? 'PDF généré avec succès' : 'PDF generated successfully', {
        description: `${formatLabel}${documentTitle ? ` - ${documentTitle}` : ''}`,
        duration: 4000,
      });

      // Callback
      onExportComplete?.(format);

    } catch (error) {
      console.error('[PDF_EXPORT_ERROR]', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Show error toast
      toast.error(language === 'fr' ? 'Erreur de génération PDF' : 'PDF generation error', {
        description: errorMessage,
        duration: 5000,
      });

      // Callback
      onError?.(error instanceof Error ? error : new Error(errorMessage));

    } finally {
      setIsExporting(false);
    }
  }, [documentId, documentTitle, isExporting, disabled, language, onExportComplete, onError]);

  // If no format selector, simple button
  if (!showFormatSelector) {
    const FormatIcon = FORMAT_CONFIG[selectedFormat].icon;

    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport(selectedFormat)}
        disabled={disabled || isExporting}
        className={className}
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {language === 'fr' ? 'Génération...' : 'Generating...'}
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {language === 'fr' ? 'Exporter PDF' : 'Export PDF'}
          </>
        )}
      </Button>
    );
  }

  // With format selector - dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {language === 'fr' ? 'Génération...' : 'Generating...'}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {language === 'fr' ? 'Exporter PDF' : 'Export PDF'}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          {language === 'fr' ? 'Choisir le format' : 'Choose format'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(Object.keys(FORMAT_CONFIG) as PdfExportFormat[]).map((format) => {
          const config = FORMAT_CONFIG[format];
          const Icon = config.icon;

          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format)}
              className="flex items-start gap-3 p-3 cursor-pointer"
              disabled={isExporting}
            >
              <div className={`p-2 rounded-md ${config.bgColor}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm ${config.color}`}>
                  {config.label[language]}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {config.description[language]}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Quick select */}
        <div className="px-3 py-2">
          <label className="text-xs text-muted-foreground mb-1.5 block">
            {language === 'fr' ? 'Format par défaut :' : 'Default format:'}
          </label>
          <Select
            value={selectedFormat}
            onValueChange={(value) => setSelectedFormat(value as PdfExportFormat)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FORMAT_CONFIG) as PdfExportFormat[]).map((format) => (
                <SelectItem key={format} value={format} className="text-xs">
                  {FORMAT_CONFIG[format].label[language]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// SIMPLIFIED EXPORT BUTTON (Direct Download)
// ============================================================

interface SimplePdfExportButtonProps extends Omit<PdfExportButtonProps, 'showFormatSelector'> {
  format: PdfExportFormat;
}

export function SimplePdfExportButton({
  format,
  ...props
}: SimplePdfExportButtonProps) {
  return (
    <PdfExportButton
      {...props}
      showFormatSelector={false}
      defaultFormat={format}
    />
  );
}

// ============================================================
// EXPORT BUTTON GROUP (Multiple Formats Visible)
// ============================================================

export function PdfExportButtonGroup(props: Omit<PdfExportButtonProps, 'showFormatSelector' | 'className'>) {
  const { language = 'fr', disabled } = props;

  return (
    <div className="flex items-center gap-2">
      {(Object.keys(FORMAT_CONFIG) as PdfExportFormat[]).map((format) => {
        const config = FORMAT_CONFIG[format];
        const Icon = config.icon;

        return (
          <SimplePdfExportButton
            key={format}
            {...props}
            format={format}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{config.label[language]}</span>
          </SimplePdfExportButton>
        );
      })}
    </div>
  );
}

// ============================================================
// DEFAULT EXPORTS
// ============================================================

export default PdfExportButton;
