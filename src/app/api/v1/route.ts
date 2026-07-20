// API v1 Root Endpoint
// Returns API information, version, status, and available endpoints

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, toNextResponse } from '@/lib/api/response/api-response';

export async function GET(request: NextRequest) {
  const apiInfo = {
    name: 'PlagiatIA Public API',
    description: 'API RESTful pour l\'intégration des fonctionnalités anti-plagiat IA de PlagiatIA',
    version: '1.0.0',
    status: 'operational',
    documentation: '/api/v1/docs',
    
    endpoints: {
      auth: {
        path: '/api/v1/auth',
        methods: ['POST'],
        description: 'Valider une clé API',
      },
      documents: {
        path: '/api/v1/documents',
        methods: ['GET', 'POST'],
        description: 'Lister et créer des documents',
      },
      documentDetail: {
        path: '/api/v1/documents/{id}',
        methods: ['GET'],
        description: 'Détails d\'un document',
      },
      analyze: {
        path: '/api/v1/documents/{id}/analyze',
        methods: ['POST'],
        description: 'Lancer une analyse de plagiat',
      },
      analysisResult: {
        path: '/api/v1/documents/{id}/analyze/{analysisId}',
        methods: ['GET'],
        description: 'Résultat d\'une analyse',
      },
      subjects: {
        path: '/api/v1/subjects',
        methods: ['GET', 'POST'],
        description: 'Lister et valider des sujets',
      },
      statistics: {
        path: '/api/v1/statistics',
        methods: ['GET'],
        description: 'Statistiques (vue d\'ensemble, tendances, par faculté)',
      },
      docs: {
        path: '/api/v1/docs',
        methods: ['GET'],
        description: 'Documentation OpenAPI 3.0',
      },
    },

    authentication: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'Clé API au format pk_live_xxx ou pk_test_xxx',
    },

    rateLimits: {
      default: '1000 requests/hour per API key',
      auth: '10 requests/minute',
      documents: '200 requests/hour',
      analyze: '50 requests/hour',
    },

    responseFormat: {
      success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
              rateLimit: { type: 'object' },
            },
          },
        },
      },
      error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
            },
          },
        },
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
    ],

    contact: {
      name: 'Support Technique PlagiatIA',
      email: 'support@plagiatia.unikin.cd',
      url: 'https://plagiatia.unikin.cd/support',
    },
  };

  return toNextResponse(apiSuccess(apiInfo));
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
