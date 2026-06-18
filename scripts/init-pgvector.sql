-- Initialisation PostgreSQL pour PlagiatIA
-- Active l'extension pgvector pour la recherche vectorielle

-- Créer l'extension pgvector (si pas déjà présente)
CREATE EXTENSION IF NOT EXISTS vector;

-- Créer l'extension pour la génération d'UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vérification
SELECT 'pgvector extension installed' AS status, extversion FROM pg_extension WHERE extname = 'vector';

-- Fonction utilitaire pour calculer la similarité cosinus
-- (déjà fournie par pgvector avec l'opérateur <=>)
-- Exemple : SELECT 1 - (embedding <=> query_vec) AS similarity FROM documents;

-- Création d'un index HNSW par défaut pour la table embeddings (sera créé par Prisma)
-- CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
-- ON document_embeddings
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);
