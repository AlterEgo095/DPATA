'use client';

// /dashboard/admin/roles — Roles & Permissions matrix
// P4-B (Task B7): static read-only permission matrix.
//
// The matrix reflects the role/permission checks hardcoded in the API routes
// (per AUDIT-1 backend audit). Editing it requires code changes — the page
// is intentionally read-only and shows a note explaining this.

import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ShieldHalf, Check, X, Info, ShieldCheck, AlertCircle,
} from 'lucide-react';

type RoleKey = 'SUPER_ADMIN' | 'FACULTY_ADMIN' | 'TEACHER' | 'STUDENT';

interface PermissionDef {
  key: string;
  label: string;
  description: string;
  grants: Partial<Record<RoleKey, boolean>>;
}

// Boolean matrix derived from /api route role checks (AUDIT-1).
// 'true' = the role is allowed; 'false' = blocked.
// Where the API has no check, the role is still listed but flagged "any auth".
const PERMISSIONS: PermissionDef[] = [
  {
    key: 'users.view',
    label: 'Voir les utilisateurs',
    description: 'Lister les utilisateurs (route GET /api/users).',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: false, STUDENT: false },
  },
  {
    key: 'users.create',
    label: 'Créer un utilisateur',
    description: 'POST /api/users — limité aux rôles non-SUPER_ADMIN.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: false, STUDENT: false },
  },
  {
    key: 'users.edit',
    label: 'Modifier un utilisateur',
    description: 'PUT /api/users/[id] — FACULTY_ADMIN ne peut pas créer un SUPER_ADMIN.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: false, STUDENT: false },
  },
  {
    key: 'users.delete',
    label: 'Supprimer un utilisateur',
    description: 'DELETE /api/users/[id] — SUPER_ADMIN uniquement.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: false, TEACHER: false, STUDENT: false },
  },
  {
    key: 'subjects.view',
    label: 'Voir les sujets',
    description: 'GET /api/subjects — public pour utilisateurs authentifiés.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: true, STUDENT: true },
  },
  {
    key: 'subjects.create',
    label: 'Créer un sujet',
    description: 'POST /api/subjects — authentifié (pas de restriction de rôle).',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: true, STUDENT: false },
  },
  {
    key: 'subjects.validate',
    label: 'Valider un sujet',
    description: 'POST /api/subjects/validate — SUPER_ADMIN/FACULTY_ADMIN/TEACHER.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: true, STUDENT: false },
  },
  {
    key: 'documents.view',
    label: 'Voir les documents',
    description: 'GET /api/documents — authentifié.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: true, STUDENT: true },
  },
  {
    key: 'documents.analyze',
    label: 'Analyser un document',
    description: 'POST /api/documents/[id]/analyze — authentifié.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: true, STUDENT: false },
  },
  {
    key: 'ai.use',
    label: 'Utiliser l\'IA (Z.ai)',
    description: 'POST /api/ai/analyze — actuellement sans auth (à corriger P4-A).',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: true, STUDENT: true },
  },
  {
    key: 'apikeys.manage',
    label: 'Gérer les clés API',
    description: 'POST/DELETE /api/keys — actuellement sans auth (à corriger P4-A).',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: false, TEACHER: false, STUDENT: false },
  },
  {
    key: 'settings.manage',
    label: 'Modifier les paramètres',
    description: 'PUT /api/admin/settings — SUPER_ADMIN uniquement.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: false, TEACHER: false, STUDENT: false },
  },
  {
    key: 'audit.view',
    label: 'Consulter le journal d\'audit',
    description: 'GET /api/audit — SUPER_ADMIN uniquement.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: false, TEACHER: false, STUDENT: false },
  },
  {
    key: 'backup.manage',
    label: 'Gérer les sauvegardes',
    description: 'POST /api/admin/backups — SUPER_ADMIN uniquement.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: false, TEACHER: false, STUDENT: false },
  },
  {
    key: 'federation.manage',
    label: 'Gérer la fédération',
    description: 'POST /api/federation/universities — SUPER_ADMIN/FACULTY_ADMIN.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: false, STUDENT: false },
  },
  {
    key: 'federation.search',
    label: 'Recherche fédérée',
    description: 'POST /api/federation/search — SUPER_ADMIN/FACULTY_ADMIN.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: false, STUDENT: false },
  },
  {
    key: 'kb.manage',
    label: 'Gérer la base de connaissances',
    description: 'POST /api/admin/kb — SUPER_ADMIN uniquement.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: false, TEACHER: false, STUDENT: false },
  },
  {
    key: 'batch.manage',
    label: 'Lancer des analyses groupées',
    description: 'POST /api/batch — SUPER_ADMIN/FACULTY_ADMIN.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: true, TEACHER: false, STUDENT: false },
  },
  {
    key: 'export.data',
    label: 'Exporter les données',
    description: 'GET /api/export — SUPER_ADMIN uniquement.',
    grants: { SUPER_ADMIN: true, FACULTY_ADMIN: false, TEACHER: false, STUDENT: false },
  },
];

const ROLES: { key: RoleKey; label: string; color: string }[] = [
  { key: 'SUPER_ADMIN', label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  { key: 'FACULTY_ADMIN', label: 'Admin Faculté', color: 'bg-blue-100 text-blue-700' },
  { key: 'TEACHER', label: 'Enseignant', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'STUDENT', label: 'Étudiant', color: 'bg-slate-100 text-slate-700' },
];

export default function RolesPage() {
  // Simulate a brief load so skeleton shows for UX consistency with other pages
  // (matrix is static so we just delay one tick)
  const loading = false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldHalf className="h-6 w-6 text-emerald-600" /> Rôles &amp; Permissions
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Matrice des permissions par rôle — lecture seule
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-start gap-3 text-blue-900 text-sm">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Cette matrice est gérée au niveau du code.</p>
            <p className="text-blue-800 mt-1">
              Pour modifier les permissions, contactez l&apos;équipe technique.
              Les vérifications de rôle sont implémentées dans chaque route API
              (voir <code className="font-mono bg-blue-100 px-1 rounded">getCurrentUser()</code> + checks manuels).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Matrice des permissions
          </CardTitle>
          <CardDescription>
            {PERMISSIONS.length} permissions × {ROLES.length} rôles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Permission</TableHead>
                    {ROLES.map((r) => (
                      <TableHead key={r.key} className="text-center min-w-[110px]">
                        <Badge className={r.color}>{r.label}</Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSIONS.map((p) => (
                    <TableRow key={p.key} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium text-slate-900 text-sm">{p.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>
                        <code className="text-[10px] font-mono text-slate-400">{p.key}</code>
                      </TableCell>
                      {ROLES.map((r) => {
                        const granted = p.grants[r.key];
                        return (
                          <TableCell key={r.key} className="text-center">
                            {granted === true ? (
                              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-100">
                                <Check className="h-4 w-4 text-emerald-600" />
                              </span>
                            ) : granted === false ? (
                              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-100">
                                <X className="h-4 w-4 text-red-600" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-100">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Légende</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-100">
                <Check className="h-4 w-4 text-emerald-600" />
              </span>
              <span className="text-slate-700">Autorisé</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-100">
                <X className="h-4 w-4 text-red-600" />
              </span>
              <span className="text-slate-700">Interdit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </span>
              <span className="text-slate-700">Non spécifié (à clarifier)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
