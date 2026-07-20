// API v1 Documentation Endpoint
// Auto-generated OpenAPI 3.0 compatible documentation

import { NextResponse } from 'next/server';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    
    info: {
      title: 'PlagiatIA Public API',
      description: `API RESTful pour l'intégration des fonctionnalités anti-plagiat IA de PlagiatIA.

## Vue d'ensemble

PlagiatIA offre une API publique permettant aux systèmes tiers (universités, LMS, outils académiques) d'intégrer ses fonctionnalités de détection de plagiat.

## Authentification

Toutes les requêtes nécessitent une clé API valide dans l'en-tête \`X-API-Key\`.

\`\`\`
X-API-Key: pk_live_votre_clé_ici
\`\`\`

## Rate Limiting

L'API utilise un système de rate limiting par clé:
- **Par défaut**: 1000 requêtes/heure
- **Auth**: 10 requêtes/minute  
- **Documents**: 200 requêtes/heure
- **Analyses**: 50 requêtes/heure

Les headers suivants sont inclus dans chaque réponse:
- \`X-RateLimit-Limit\`: Limite maximale
- \`X-RateLimit-Remaining\`: Requêtes restantes
- \`X-RateLimit-Reset\`: Timestamp de réinitialisation

## Format de Réponse

Toutes les réponses suivent le format standard:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2025-01-20T10:30:00Z",
    "version": "1.0.0"
  }
}
\`\`\``,
      version: '1.0.0',
      contact: {
        name: 'Support Technique PlagiatIA',
        email: 'support@plagiatia.unikin.cd',
        url: 'https://plagiatia.unikin.cd/support',
      },
      license: {
        name: 'Propriétaire',
        url: 'https://plagiatia.unikin.cd/terms',
      },
    },

    servers: [
      {
        url: 'https://api.plagiatia.unikin.cd',
        description: 'Production',
      },
      {
        url: 'https://sandbox.api.plagiatia.unikin.cd',
        description: 'Sandbox / Test',
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Développement local',
      },
    ],

    tags: [
      { name: 'General', description: 'Informations générales sur l\'API' },
      { name: 'Authentification', description: 'Validation des clés API' },
      { name: 'Documents', description: 'Gestion des documents' },
      { name: 'Analyses', description: 'Analyses de plagiat' },
      { name: 'Sujets', description: 'Gestion et validation des sujets' },
      { name: 'Statistiques', description: 'Données statistiques (lecture seule)' },
    ],

    paths: {
      '/': {
        get: {
          tags: ['General'],
          summary: 'Informations sur l\'API',
          description: 'Retourne les informations générales, version, statut et liste des endpoints disponibles.',
          operationId: 'getApiInfo',
          responses: {
            '200': {
              description: 'Informations de l\'API récupérées avec succès',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiInfo' },
                  example: {
                    success: true,
                    data: {
                      name: 'PlagiatIA Public API',
                      version: '1.0.0',
                      status: 'operational',
                      endpoints: {},
                    },
                    meta: {
                      requestId: 'req_abc123',
                      timestamp: '2025-01-20T10:30:00Z',
                      version: '1.0.0',
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/auth': {
        post: {
          tags: ['Authentification'],
          summary: 'Valider une clé API',
          description: 'Vérifie la validité d\'une clé API et retourne ses informations.',
          operationId: 'validateApiKey',
          security: [{ apiKeyAuth: [] }],
          requestBody: {
            required: false,
            description: 'La clé API est fournie via l\'en-tête X-API-Key',
          },
          responses: {
            '200': {
              description: 'Clé API valide',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' },
                  example: {
                    success: true,
                    data: {
                      valid: true,
                      key: {
                        id: 'cl_abc123',
                        name: 'Ma Clé API',
                        prefix: 'pk_live_abc12345...',
                        permissions: ['read', 'write'],
                        isValid: true,
                        rateLimit: 1000,
                        usageCount: 42,
                      },
                      message: 'Clé API valide.',
                    },
                    meta: {
                      requestId: 'req_abc123',
                      timestamp: '2025-01-20T10:30:00Z',
                      version: '1.0.0',
                      rateLimit: {
                        remaining: 958,
                        reset: 1705789200,
                        limit: 1000,
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Clé API invalide ou manquante',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
        get: {
          tags: ['Authentification'],
          summary: 'Vérifier le statut d\'authentification',
          description: 'Retourne les informations d\'authentification actuelles.',
          operationId: 'getAuthStatus',
          security: [{ apiKeyAuth: [] }],
          responses: {
            '200': {
              description: 'Statut d\'authentification',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    data: {
                      authenticated: true,
                      keyId: 'cl_abc123',
                      keyName: 'Ma Clé API',
                      permissions: ['read', 'write'],
                    },
                    meta: {
                      requestId: 'req_def456',
                      timestamp: '2025-01-20T10:30:00Z',
                      version: '1.0.0',
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/documents': {
        get: {
          tags: ['Documents'],
          summary: 'Lister les documents',
          description: 'Retourne la liste des documents avec pagination et filtres.',
          operationId: 'listDocuments',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Numéro de page' },
            { name: 'perPage', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Résultats par page' },
            { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/DocumentStatus' }, description: 'Filtrer par statut' },
            { name: 'type', in: 'query', schema: { $ref: '#/components/schemas/DocumentType' }, description: 'Filtrer par type' },
            { name: 'facultyId', in: 'query', schema: { type: 'string' }, description: 'ID de la faculté' },
            { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'ID du département' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Recherche textuelle' },
            { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'title'], default: 'createdAt' } },
            { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          ],
          responses: {
            '200': {
              description: 'Liste des documents',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedDocuments' },
                },
              },
            },
          },
        },
        post: {
          tags: ['Documents'],
          summary: 'Créer un document',
          description: 'Crée un nouveau document dans le système.',
          operationId: 'createDocument',
          security: [{ apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateDocumentRequest' },
                example: {
                  title: 'Mémoire de fin de cycle',
                  type: 'MEMOIRE',
                  subject: 'Application de l\'IA dans l\'éducation',
                  abstract: 'Résumé du mémoire...',
                  facultyId: 'fac_001',
                  departmentId: 'dept_001',
                  academicYear: '2024-2025',
                  uploadedById: 'user_001',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Document créé avec succès',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Document' },
                },
              },
            },
            '400': {
              description: 'Données invalides',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '403': {
              description: 'Permissions insuffisantes',
            },
          },
        },
      },

      '/documents/{id}': {
        get: {
          tags: ['Documents'],
          summary: 'Détails d\'un document',
          description: 'Retourne les détails complets d\'un document spécifique.',
          operationId: 'getDocument',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID du document' },
          ],
          responses: {
            '200': {
              description: 'Détails du document',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DocumentDetail' },
                },
              },
            },
            '404': {
              description: 'Document non trouvé',
            },
          },
        },
      },

      '/documents/{id}/analyze': {
        post: {
          tags: ['Analyses'],
          summary: 'Lancer une analyse de plagiat',
          description: 'Démarre une analyse de plagiat pour le document spécifié.',
          operationId: 'createAnalysis',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID du document' },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateAnalysisRequest' },
                example: {
                  threshold: 0.80,
                  scope: 'faculty',
                  engine: 'hybrid',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Analyse créée et mise en file',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    data: {
                      id: 'anal_abc123',
                      documentId: 'doc_001',
                      status: 'PENDING',
                      threshold: 0.8,
                      scope: 'faculty',
                      message: 'Analyse mise en file d\'attente.',
                      estimatedTime: '2-5 minutes',
                    },
                    meta: { requestId: 'req_xyz', timestamp: '...', version: '1.0.0' },
                  },
                },
              },
            },
            '409': {
              description: 'Une analyse est déjà en cours',
            },
          },
        },
        get: {
          tags: ['Analyses'],
          summary: 'Lister les analyses d\'un document',
          description: 'Retourne toutes les analyses pour un document donné.',
          operationId: 'listAnalyses',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID du document' },
          ],
          responses: {
            '200': {
              description: 'Liste des analyses',
            },
          },
        },
      },

      '/documents/{id}/analyze/{analysisId}': {
        get: {
          tags: ['Analyses'],
          summary: 'Résultat d\'une analyse',
          description: 'Retourne le résultat détaillé d\'une analyse spécifique.',
          operationId: 'getAnalysisResult',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID du document' },
            { name: 'analysisId', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de l\'analyse' },
          ],
          responses: {
            '200': {
              description: 'Résultat de l\'analyse',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AnalysisResult' },
                  example: {
                    success: true,
                    data: {
                      id: 'anal_abc123',
                      documentId: 'doc_001',
                      status: 'COMPLETED',
                      globalScore: 0.15,
                      plagiarismPercentage: 15,
                      matchedSegments: 3,
                      totalSegments: 150,
                      matches: [],
                      totalMatches: 3,
                    },
                    meta: { requestId: 'req_xyz', timestamp: '...', version: '1.0.0' },
                  },
                },
              },
            },
            '404': {
              description: 'Analyse non trouvée',
            },
          },
        },
      },

      '/subjects': {
        get: {
          tags: ['Sujets'],
          summary: 'Lister les sujets',
          description: 'Retourne la liste des sujets avec pagination et filtres.',
          operationId: 'listSubjects',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'perPage', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
            { name: 'facultyId', in: 'query', schema: { type: 'string' } },
            { name: 'departmentId', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'isValidated', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: {
            '200': {
              description: 'Liste des sujets',
            },
          },
        },
        post: {
          tags: ['Sujets'],
          summary: 'Valider un sujet',
          description: 'Valide un sujet proposé et retourne un score de validation.',
          operationId: 'validateSubject',
          security: [{ apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidateSubjectRequest' },
                example: {
                  title: 'Application de l\'IA dans la détection de plagiat',
                  description: 'Ce mémoire explore l\'utilisation de l\'intelligence artificielle...',
                  type: 'MEMOIRE',
                  facultyId: 'fac_001',
                  departmentId: 'dept_001',
                  keywords: ['IA', 'plagiat', 'éducation', 'NLP'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Sujet validé',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    data: {
                      id: 'subj_001',
                      title: '...',
                      isValidated: true,
                      validationScore: 85,
                      validation: {
                        score: 85,
                        passed: true,
                        checks: {
                          titleLength: true,
                          descriptionLength: true,
                          hasKeywords: true,
                          titleNotAllCaps: true,
                          titleNotAllLower: true,
                        },
                        recommendation: 'Le sujet est valide et peut être utilisé.',
                      },
                    },
                    meta: { requestId: 'req_xyz', timestamp: '...', version: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },

      '/statistics/overview': {
        get: {
          tags: ['Statistiques'],
          summary: 'Vue d\'ensemble des statistiques',
          description: 'Retourne les statistiques globales de la plateforme.',
          operationId: 'getStatisticsOverview',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'period', in: 'query', schema: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' } },
            { name: 'facultyId', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Statistiques globales',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    data: {
                      period: '30d',
                      documents: { total: 150, byStatus: {} },
                      analyses: { total: 300, averagePlagiarismScore: 18.5 },
                      users: { total: 500, byRole: {} },
                    },
                    meta: { requestId: 'req_xyz', timestamp: '...', version: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },

      '/statistics/trends': {
        get: {
          tags: ['Statistiques'],
          summary: 'Données de tendances',
          description: 'Retourne les données de tendances pour différentes métriques.',
          operationId: 'getStatisticsTrends',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'period', in: 'query', schema: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' } },
            { name: 'metric', in: 'query', schema: { type: 'string', enum: ['documents', 'analyses', 'plagiarism_rate', 'users'], default: 'documents' } },
            { name: 'granularity', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' } },
          ],
          responses: {
            '200': {
              description: 'Données de tendances',
            },
          },
        },
      },

      '/statistics/faculties/{id}': {
        get: {
          tags: ['Statistiques'],
          summary: 'Statistiques par faculté',
          description: 'Retourne les statistiques détaillées pour une faculté spécifique.',
          operationId: 'getFacultyStatistics',
          security: [{ apiKeyAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de la faculté' },
          ],
          responses: {
            '200': {
              description: 'Statistiques de la faculté',
            },
            '404': {
              description: 'Faculté non trouvée',
            },
          },
        },
      },
    },

    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Clé API au format pk_live_xxx ou pk_test_xxx',
        },
      },

      schemas: {
        // Response wrappers
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            error: { $ref: '#/components/schemas/Error' },
            meta: { $ref: '#/components/schemas/Meta' },
          },
          required: ['success', 'meta'],
        },

        Error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'INVALID_API_KEY' },
            message: { type: 'string', example: 'La clé API fournie n\'est pas valide.' },
            details: { type: 'object' },
          },
        },

        ErrorResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                data: { type: 'object', nullable: true },
                error: { $ref: '#/components/schemas/Error' },
              },
            },
          ],
        },

        Meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string', example: 'req_abc123' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string', example: '1.0.0' },
            pagination: { $ref: '#/components/schemas/PaginationMeta' },
            rateLimit: { $ref: '#/components/schemas/RateLimitMeta' },
          },
        },

        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            perPage: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },

        RateLimitMeta: {
          type: 'object',
          properties: {
            remaining: { type: 'integer', example: 950 },
            reset: { type: 'integer', example: 1705789200 },
            limit: { type: 'integer', example: 1000 },
          },
        },

        // Domain schemas
        ApiInfo: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            version: { type: 'string' },
            status: { type: 'string' },
            endpoints: { type: 'object' },
            authentication: { type: 'object' },
            rateLimits: { type: 'object' },
          },
        },

        AuthResponse: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            key: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                prefix: { type: 'string' },
                permissions: { type: 'array', items: { type: 'string' } },
                isValid: { type: 'boolean' },
                rateLimit: { type: 'integer' },
                usageCount: { type: 'integer' },
              },
            },
            message: { type: 'string' },
          },
        },

        DocumentType: {
          type: 'string',
          enum: ['TFC', 'MEMOIRE', 'THESE', 'ARTICLE', 'AUTRE'],
        },

        DocumentStatus: {
          type: 'string',
          enum: ['DRAFT', 'SUBMITTED', 'ANALYZING', 'ANALYZED', 'REJECTED', 'VALIDATED'],
        },

        Document: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            type: { $ref: '#/components/schemas/DocumentType' },
            subject: { type: 'string' },
            status: { $ref: '#/components/schemas/DocumentStatus' },
            fileName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            faculty: { type: 'object' },
            department: { type: 'object' },
          },
        },

        DocumentDetail: {
          allOf: [
            { $ref: '#/components/schemas/Document' },
            {
              type: 'object',
              properties: {
                abstract: { type: 'string' },
                uploadedBy: { type: 'object' },
                supervisedBy: { type: 'object', nullable: true },
                analyses: { type: 'array', items: { type: 'object' } },
                keywords: { type: 'array', items: { type: 'string' } },
              },
            },
          ],
        },

        PaginatedDocuments: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Document' } },
            pagination: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },

        CreateDocumentRequest: {
          type: 'object',
          required: ['title', 'facultyId', 'departmentId', 'academicYear', 'uploadedById'],
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 500 },
            type: { $ref: '#/components/schemas/DocumentType', default: 'TFC' },
            subject: { type: 'string', maxLength: 1000 },
            abstract: { type: 'string', maxLength: 10000 },
            content: { type: 'string', maxLength: 10000000 },
            facultyId: { type: 'string' },
            departmentId: { type: 'string' },
            promotionId: { type: 'string' },
            academicYear: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string', maxLength: 100 }, maxItems: 20 },
            uploadedById: { type: 'string' },
          },
        },

        CreateAnalysisRequest: {
          type: 'object',
          properties: {
            threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.8 },
            scope: { type: 'string', enum: ['faculty', 'department', 'all'], default: 'faculty' },
            engine: { type: 'string', enum: ['tfidf', 'hybrid', 'semantic'], default: 'hybrid' },
          },
        },

        AnalysisResult: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            documentId: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] },
            globalScore: { type: 'number', nullable: true },
            plagiarismPercentage: { type: 'number', nullable: true },
            matchedSegments: { type: 'integer', nullable: true },
            totalSegments: { type: 'integer', nullable: true },
            threshold: { type: 'number' },
            scope: { type: 'string' },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            durationMs: { type: 'integer', nullable: true },
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  segmentIndex: { type: 'integer' },
                  segmentText: { type: 'string' },
                  sourceDocumentTitle: { type: 'string' },
                  semanticScore: { type: 'number' },
                  lexicalScore: { type: 'number' },
                  matchType: { type: 'string' },
                },
              },
            },
            totalMatches: { type: 'integer' },
          },
        },

        ValidateSubjectRequest: {
          type: 'object',
          required: ['title', 'description', 'type', 'facultyId', 'departmentId'],
          properties: {
            title: { type: 'string', minLength: 5, maxLength: 500 },
            description: { type: 'string', minLength: 20, maxLength: 10000 },
            type: { $ref: '#/components/schemas/DocumentType' },
            facultyId: { type: 'string' },
            departmentId: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/vnd.oai.openapi+json;version=3.0',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
