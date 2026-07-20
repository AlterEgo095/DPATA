// GET /api/export - Export data as CSV or JSON
// PHASE 4: Fonctionnalités Manquantes - Export API

import { NextRequest, NextResponse } from 'next/server';
import { loadDB } from '@/lib/store/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSecurityHeaders, sanitizeError, sanitizeInput } from '@/lib/security';

type ExportFormat = 'csv' | 'json';
type ExportType = 'audit' | 'users' | 'subjects' | 'documents' | 'analyses';

/**
 * Convert data to CSV format
 */
function toCSV(data: Record<string, unknown>[], columns?: string[]): string {
  if (data.length === 0) return '';
  
  const cols = columns || Object.keys(data[0]);
  const header = cols.join(',');
  const rows = data.map(row => 
    cols.map(col => {
      let value = row[col];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') value = JSON.stringify(value);
      // Escape quotes and wrap in quotes
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

/**
 * Generate filename for export
 */
function getFilename(type: ExportType, format: ExportFormat): string {
  const date = new Date().toISOString().split('T')[0];
  return `dpata_${type}_${date}.${format}`;
}

export async function GET(req: NextRequest) {
  try {
    // Authentication check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'AUTH_REQUIRED' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    // Only SUPER_ADMIN can export
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Permissions insuffisantes', code: 'FORBIDDEN' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    const { searchParams } = new URL(req.url);
    
    // Parse parameters
    const type = (searchParams.get('type') || 'audit').toLowerCase() as ExportType;
    const format = (searchParams.get('format') || 'csv').toLowerCase() as ExportFormat;
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez csv ou json', code: 'INVALID_FORMAT' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Validate type
    const validTypes: ExportType[] = ['audit', 'users', 'subjects', 'documents', 'analyses'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type non valide. Types disponibles: ${validTypes.join(', ')}`, code: 'INVALID_TYPE' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Load database
    const db = await loadDB();

    // Get data based on type
    let data: Record<string, unknown>[];
    let columns: string[];

    switch (type) {
      case 'audit':
        data = (db.auditLogs || []).map(log => ({
          Date: log.createdAt,
          Utilisateur: log.userName,
          Action: log.action,
          Entité: log.entity,
          ID_Entité: log.entityId,
          Détails: log.details || '',
          IP: log.ipAddress || '',
        }));
        columns = ['Date', 'Utilisateur', 'Action', 'Entité', 'ID_Entité', 'Détails', 'IP'];
        
        // Apply filters
        if (search) {
          data = data.filter(d => 
            Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
          );
        }
        if (dateFrom) {
          data = data.filter(d => new Date(String(d.Date)) >= new Date(dateFrom));
        }
        if (dateTo) {
          data = data.filter(d => new Date(String(d.Date)) <= new Date(dateTo));
        }
        break;

      case 'users':
        data = db.users.filter(u => u.role !== 'SUPER_ADMIN').map(u => ({
          Email: u.email,
          Prénom: u.firstName,
          Nom: u.lastName,
          Rôle: u.role,
          Matricule: u.matricule || '',
          Actif: u.isActive ? 'Oui' : 'Non',
          'Date création': u.createdAt,
        }));
        columns = ['Email', 'Prénom', 'Nom', 'Rôle', 'Matricule', 'Actif', 'Date création'];
        break;

      case 'subjects':
        data = (db.academicSubjects || []).map(s => ({
          Titre: s.title,
          Domaine: s.domain || '',
          Spécialité: s.specialty || '',
          Niveau: s.level || '',
          Type: s.workType || '',
          Statut: s.status || '',
          Original: s.isOriginal ? 'Oui' : 'Non',
          'Date création': s.createdAt,
        }));
        columns = ['Titre', 'Domaine', 'Spécialité', 'Niveau', 'Type', 'Statut', 'Original', 'Date création'];
        
        if (search) {
          data = data.filter(d =>
            d.Titre.toLowerCase().includes(search.toLowerCase()) ||
            d.Domaine.toLowerCase().includes(search.toLowerCase())
          );
        }
        break;

      case 'documents':
        data = db.documents.map(d => ({
          Titre: d.title,
          Type: d.type,
          Statut: d.status || '',
          Auteur: d.uploadedById || '',
          Faculté: d.facultyId || '',
          Département: d.departmentId || '',
          Taille: `${(d.fileSize / 1024).toFixed(1)} KB`,
          'Date dépôt': d.createdAt,
        }));
        columns = ['Titre', 'Type', 'Statut', 'Auteur', 'Faculté', 'Département', 'Taille', 'Date dépôt'];
        break;

      case 'analyses':
        data = (db.analyses || []).map(a => ({
          ID_Document: a.documentId || '',
          Score_Global: a.globalScore?.toFixed(2) || '',
          Couverture: a.coverage?.toFixed(2) || '',
          Matches: a.matchCount || 0,
          Statut: a.status || '',
          'Date analyse': a.analyzedAt || a.createdAt || '',
        }));
        columns = ['ID_Document', 'Score_Global', 'Couverture', 'Matches', 'Statut', 'Date analyse'];
        break;

      default:
        return NextResponse.json(
          { error: 'Type non implémenté', code: 'NOT_IMPLEMENTED' },
          { status: 501, headers: getSecurityHeaders() }
        );
    }

    // Generate response based on format
    const filename = getFilename(type, format);

    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...getSecurityHeaders(),
        },
      });
    }

    // CSV format
    const csv = toCSV(data, columns);
    
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...getSecurityHeaders(),
      },
    });

  } catch (e) {
    console.error('[EXPORT_ERROR]', e);
    const error = sanitizeError(e);
    return NextResponse.json(error, { status: 500, headers: getSecurityHeaders() });
  }
}
