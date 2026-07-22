# PlagiatIA API Routes Documentation

## Architecture API

### 1. API Interne (`/api/*`)
- **Authentification**: JWT (cookies de session)
- **Usage**: Frontend React (Dashboard Admin + Portal User)
- **Sécurité**: RBAC complet, CSRF protection

### 2. API Publique v1 (`/api/v1/*`)
- **Authentification**: API Key (header `X-API-Key`)
- **Usage**: Intégrations tierces, webhooks, automatisation
- **Sécurité**: Rate limiting par clé API, audit trail

## Routes Publiques v1

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/v1` | GET | Information API (racine) |
| `/api/v1/auth` | POST | Validation clé API |
| `/api/v1/docs` | GET | Documentation OpenAPI |
| `/api/v1/documents` | GET/POST | Lister/créer documents |
| `/api/v1/documents/{id}` | GET | Détails document |
| `/api/v1/documents/{id}/analyze` | POST | Lancer analyse plagiat |
| `/api/v1/documents/{id}/analyze/{analysisId}` | GET | Résultat analyse |
| `/api/v1/subjects` | GET/POST | Sujets mémoire |
| `/api/v1/statistics` | GET | Statistiques globales |
| `/api/v1/statistics/trends` | GET | Tendances |
| `/api/v1/statistics/faculties/{id}` | GET | Stats par faculté |

## Note
Ces routes NE SONT PAS dupliquées - elles ont un but différent:
- API interne = Session utilisateur frontend
- API v1 = Intégration programme externe

