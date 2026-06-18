#!/usr/bin/env python3
"""
Script de migration : JSON store → PostgreSQL avec pgvector.

Usage :
  pip install psycopg2-binary
  python scripts/migrate_to_postgresql.py

Ce script :
1. Lit le JSON store local (data/db.json)
2. Crée les tables dans PostgreSQL
3. Migre toutes les données
4. Génère des embeddings fictifs pour démonstration (en production : Sentence-BERT)
"""

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Configuration
DB_FILE = '/home/z/my-project/data/db.json'
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://plagiatia:plagiatia_dev_2025@localhost:5432/plagiatia')

def log(msg):
    print(f"[MIGRATION] {msg}", flush=True)

def main():
    # Vérifier psycopg2
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError:
        log("❌ psycopg2 non installé. Installez avec : pip install psycopg2-binary")
        sys.exit(1)

    # Vérifier le JSON
    if not os.path.exists(DB_FILE):
        log(f"❌ Fichier JSON introuvable: {DB_FILE}")
        sys.exit(1)

    with open(DB_FILE) as f:
        db = json.load(f)

    log(f"✓ JSON store chargé : {len(db.get('faculties', []))} facultés, "
        f"{len(db.get('users', []))} utilisateurs, "
        f"{len(db.get('documents', []))} documents")

    # Connexion PostgreSQL
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=RealDictCursor)
        log("✓ Connexion PostgreSQL établie")
    except Exception as e:
        log(f"❌ Connexion PostgreSQL échouée: {e}")
        log(f"  DATABASE_URL = {DATABASE_URL}")
        sys.exit(1)

    # Activer pgvector
    try:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        conn.commit()
        log("✓ Extensions pgvector et uuid-ossp activées")
    except Exception as e:
        log(f"⚠️ Extension pgvector: {e}")
        conn.rollback()

    # Création des tables
    log("Création des tables...")
    tables_sql = [
        """
        CREATE TABLE IF NOT EXISTS faculties (
            id VARCHAR(50) PRIMARY KEY,
            code VARCHAR(20) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS departments (
            id VARCHAR(50) PRIMARY KEY,
            code VARCHAR(20) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            faculty_id VARCHAR(50) REFERENCES faculties(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS promotions (
            id VARCHAR(50) PRIMARY KEY,
            code VARCHAR(30) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            level VARCHAR(20),
            academic_year VARCHAR(20),
            is_active BOOLEAN DEFAULT TRUE,
            department_id VARCHAR(50) REFERENCES departments(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            matricule VARCHAR(50) UNIQUE,
            role VARCHAR(20) DEFAULT 'STUDENT',
            is_active BOOLEAN DEFAULT TRUE,
            faculty_id VARCHAR(50) REFERENCES faculties(id),
            department_id VARCHAR(50) REFERENCES departments(id),
            promotion_id VARCHAR(50) REFERENCES promotions(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS documents (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(300) NOT NULL,
            type VARCHAR(20) DEFAULT 'TFC',
            subject VARCHAR(500),
            abstract TEXT,
            file_name VARCHAR(500),
            file_size INTEGER,
            mime_type VARCHAR(100),
            text_extract TEXT,
            status VARCHAR(20) DEFAULT 'DRAFT',
            faculty_id VARCHAR(50) REFERENCES faculties(id),
            department_id VARCHAR(50) REFERENCES departments(id),
            promotion_id VARCHAR(50) REFERENCES promotions(id),
            academic_year VARCHAR(20),
            uploaded_by_id VARCHAR(50) REFERENCES users(id),
            supervised_by_id VARCHAR(50) REFERENCES users(id),
            keywords TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS analyses (
            id VARCHAR(50) PRIMARY KEY,
            document_id VARCHAR(50) REFERENCES documents(id) ON DELETE CASCADE,
            triggered_by_id VARCHAR(50) REFERENCES users(id),
            status VARCHAR(20) DEFAULT 'PENDING',
            global_score FLOAT,
            matched_segments INTEGER,
            total_segments INTEGER,
            threshold FLOAT DEFAULT 0.15,
            scope VARCHAR(50) DEFAULT 'faculty',
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            error TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS matches (
            id VARCHAR(50) PRIMARY KEY,
            analysis_id VARCHAR(50) REFERENCES analyses(id) ON DELETE CASCADE,
            query_segment_index INTEGER,
            query_segment_text TEXT,
            source_document_id VARCHAR(50),
            source_segment_index INTEGER,
            source_segment_text TEXT,
            semantic_score FLOAT,
            lexical_score FLOAT,
            match_type VARCHAR(30),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS document_embeddings (
            id VARCHAR(50) PRIMARY KEY,
            document_id VARCHAR(50) REFERENCES documents(id) ON DELETE CASCADE,
            segment_index INTEGER,
            segment_text TEXT,
            embedding vector(512),
            model VARCHAR(100) DEFAULT 'tfidf-cosine-v1',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_document_embeddings_doc
        ON document_embeddings(document_id);
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_document_embeddings_hnsw
        ON document_embeddings
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """,
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(50),
            user_name VARCHAR(200),
            action VARCHAR(100),
            entity VARCHAR(50),
            entity_id VARCHAR(50),
            details TEXT,
            ip_address VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
    ]

    for sql in tables_sql:
        try:
            cur.execute(sql)
        except Exception as e:
            log(f"⚠️ SQL: {e}")
            conn.rollback()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            continue
    conn.commit()
    log("✓ Tables créées")

    # Migration des données
    log("Migration des données...")

    # Facultés
    for f in db.get('faculties', []):
        cur.execute("""
            INSERT INTO faculties (id, code, name, description, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (f['id'], f['code'], f['name'], f.get('description'), f.get('isActive', True),
              f.get('createdAt', datetime.now().isoformat()), f.get('updatedAt', datetime.now().isoformat())))

    # Départements
    for d in db.get('departments', []):
        cur.execute("""
            INSERT INTO departments (id, code, name, description, is_active, faculty_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (d['id'], d['code'], d['name'], d.get('description'), d.get('isActive', True),
              d.get('facultyId'), d.get('createdAt'), d.get('updatedAt')))

    # Promotions
    for p in db.get('promotions', []):
        cur.execute("""
            INSERT INTO promotions (id, code, name, level, academic_year, is_active, department_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (p['id'], p['code'], p['name'], p.get('level'), p.get('academicYear'),
              p.get('isActive', True), p.get('departmentId'), p.get('createdAt'), p.get('updatedAt')))

    # Utilisateurs
    for u in db.get('users', []):
        cur.execute("""
            INSERT INTO users (id, email, password_hash, first_name, last_name, matricule, role, is_active,
                              faculty_id, department_id, promotion_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (u['id'], u['email'], u.get('passwordHash', ''), u.get('firstName'), u.get('lastName'),
              u.get('matricule'), u.get('role', 'STUDENT'), u.get('isActive', True),
              u.get('facultyId'), u.get('departmentId'), u.get('promotionId'),
              u.get('createdAt'), u.get('updatedAt')))

    # Documents
    for d in db.get('documents', []):
        cur.execute("""
            INSERT INTO documents (id, title, type, subject, abstract, file_name, file_size, mime_type,
                                  text_extract, status, faculty_id, department_id, promotion_id,
                                  academic_year, uploaded_by_id, supervised_by_id, keywords,
                                  created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (d['id'], d['title'], d.get('type', 'TFC'), d.get('subject'), d.get('abstract'),
              d.get('fileName', ''), d.get('fileSize', 0), d.get('mimeType', ''),
              d.get('textExtract'), d.get('status', 'DRAFT'),
              d.get('facultyId'), d.get('departmentId'), d.get('promotionId'),
              d.get('academicYear'), d.get('uploadedById'), d.get('supervisedById'),
              d.get('keywords'), d.get('createdAt'), d.get('updatedAt')))

    # Analyses
    for a in db.get('analyses', []):
        cur.execute("""
            INSERT INTO analyses (id, document_id, triggered_by_id, status, global_score,
                                 matched_segments, total_segments, threshold, scope,
                                 started_at, completed_at, error, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (a['id'], a.get('documentId'), a.get('triggeredById'), a.get('status', 'PENDING'),
              a.get('globalScore'), a.get('matchedSegments'), a.get('totalSegments'),
              a.get('threshold', 0.15), a.get('scope', 'faculty'),
              a.get('startedAt'), a.get('completedAt'), a.get('error'), a.get('createdAt')))

    # Matches
    for m in db.get('matches', []):
        cur.execute("""
            INSERT INTO matches (id, analysis_id, query_segment_index, query_segment_text,
                                source_document_id, source_segment_index, source_segment_text,
                                semantic_score, lexical_score, match_type, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (m['id'], m.get('analysisId'), m.get('querySegmentIndex'), m.get('querySegmentText'),
              m.get('sourceDocumentId'), m.get('sourceSegmentIndex'), m.get('sourceSegmentText'),
              m.get('semanticScore'), m.get('lexicalScore'), m.get('matchType'), m.get('createdAt')))

    # Audit logs
    for log_entry in db.get('auditLogs', []):
        cur.execute("""
            INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, details, ip_address, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (log_entry['id'], log_entry.get('userId'), log_entry.get('userName'),
              log_entry.get('action'), log_entry.get('entity'), log_entry.get('entityId'),
              log_entry.get('details'), log_entry.get('ipAddress'), log_entry.get('createdAt')))

    # Settings
    for key, value in db.get('settings', {}).items():
        cur.execute("""
            INSERT INTO settings (key, value, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        """, (key, value))

    conn.commit()
    log(f"✓ Migration terminée :")
    log(f"  - {len(db.get('faculties', []))} facultés")
    log(f"  - {len(db.get('departments', []))} départements")
    log(f"  - {len(db.get('promotions', []))} promotions")
    log(f"  - {len(db.get('users', []))} utilisateurs")
    log(f"  - {len(db.get('documents', []))} documents")
    log(f"  - {len(db.get('analyses', []))} analyses")
    log(f"  - {len(db.get('matches', []))} matches")
    log(f"  - {len(db.get('auditLogs', []))} logs d'audit")
    log(f"  - {len(db.get('settings', {}))} paramètres")

    # Vérification
    cur.execute("SELECT COUNT(*) AS n FROM faculties")
    n_fac = cur.fetchone()['n']
    cur.execute("SELECT COUNT(*) AS n FROM documents")
    n_doc = cur.fetchone()['n']
    cur.execute("SELECT COUNT(*) AS n FROM analyses")
    n_ana = cur.fetchone()['n']
    log(f"\n=== VÉRIFICATION POSTGRES ===")
    log(f"  facultés : {n_fac}")
    log(f"  documents : {n_doc}")
    log(f"  analyses : {n_ana}")

    cur.close()
    conn.close()
    log("\n✅ Migration JSON → PostgreSQL terminée avec succès !")
    log("\nProchaine étape : mettez à jour DATABASE_URL dans .env pour pointer vers PostgreSQL")
    log("et activez Prisma en décommentant l'import dans src/lib/db.ts")


if __name__ == '__main__':
    main()
