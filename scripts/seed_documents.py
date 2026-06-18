#!/usr/bin/env python3
"""Seed la DB avec des documents de test pour démontrer le pipeline IA."""
import json
import os
from datetime import datetime
from pathlib import Path

DB_FILE = '/home/z/my-project/data/db.json'

def gen_id(prefix):
    import uuid
    return f"{prefix}-{uuid.uuid4().hex[:12]}"

def now():
    return datetime.utcnow().isoformat() + 'Z'

# Documents de démonstration (mémoires académiques fictifs)
# Document 1 : source originale
doc_source = {
    "id": gen_id('doc'),
    "title": "Impact de l'IA sur l'enseignement supérieur en Afrique",
    "type": "MEMOIRE",
    "subject": "Intelligence artificielle et éducation",
    "abstract": "Analyse de l'impact de l'IA sur les pratiques pédagogiques.",
    "fileName": "memoire_source.pdf",
    "fileSize": 245678,
    "mimeType": "application/pdf",
    "textExtract": """L'intelligence artificielle transforme profondément l'enseignement supérieur en Afrique. Les universités congolaises intègrent progressivement ces technologies dans leurs cursus. Les plateformes d'apprentissage en ligne se multiplient, offrant aux étudiants un accès élargi aux ressources pédagogiques. Cette révolution numérique pose cependant des défis structurels importants.

La détection automatique du plagiat représente un enjeu majeur pour l'intégrité académique. Les outils traditionnels de comparaison lexicale montrent leurs limites face aux reformulations et aux traductions. L'approche basée sur les embeddings vectoriels offre une alternative prometteuse en capturant le sens des textes plutôt que leur forme superficielle.

Les universités africaines doivent investir dans la formation des enseignants aux nouvelles technologies. L'adoption des outils d'intelligence artificielle nécessite une réflexion pédagogique approfondie. Les défis incluent la connectivité Internet, le coût des équipements et la formation continue des personnels.""",
    "status": "SUBMITTED",
    "facultyId": "fac-dbac2e46-330",
    "departmentId": "dep-24a9fc88-219",
    "promotionId": None,
    "academicYear": "2024-2025",
    "uploadedById": "u-super-admin",
    "supervisedById": None,
    "createdAt": now(),
    "updatedAt": now(),
}

# Document 2 : plagiat évident (reformulation)
doc_plagiat = {
    "id": gen_id('doc'),
    "title": "L'IA dans les universités africaines : enjeux et perspectives",
    "type": "MEMOIRE",
    "subject": "Technologies éducatives en Afrique",
    "abstract": "Étude de l'intégration de l'IA dans le système éducatif africain.",
    "fileName": "memoire_plagiat.pdf",
    "fileSize": 198432,
    "mimeType": "application/pdf",
    "textExtract": """L'IA modifie de manière significative l'enseignement supérieur africain. Les établissements universitaires congolais adoptent graduellement ces innovations dans leurs programmes. Les plateformes d'e-learning se développent, donnant aux étudiants un accès plus large aux contenus pédagogiques. Cette mutation numérique présente toutefois des obstacles structurels considérables.

La lutte contre le plagiat automatisé constitue un défi crucial pour l'intégrité des diplômes. Les systèmes classiques de comparaison de texte révèlent leurs faiblesses face aux paraphrases et aux traductions. La méthode fondée sur les vecteurs sémantiques propose une solution intéressante en saisissant le sens des documents plutôt que leur apparence.

Les institutions africaines doivent investir dans la formation pédagogique aux technologies émergentes. L'utilisation des systèmes d'intelligence artificielle demande une réflexion didactique rigoureuse. Les obstacles concernent l'accès Internet, le prix des infrastructures et la formation permanente des enseignants.""",
    "status": "SUBMITTED",
    "facultyId": "fac-dbac2e46-330",
    "departmentId": "dep-24a9fc88-219",
    "promotionId": None,
    "academicYear": "2025-2026",
    "uploadedById": "u-super-admin",
    "supervisedById": None,
    "createdAt": now(),
    "updatedAt": now(),
}

# Document 3 : original (sans plagiat)
doc_original = {
    "id": gen_id('doc'),
    "title": "Étude de la biodiversité dans le bassin du Congo",
    "type": "TFC",
    "subject": "Biologie de conservation",
    "abstract": "Inventaire de la biodiversité forestière en RDC.",
    "fileName": "tfc_biodiversite.pdf",
    "fileSize": 312456,
    "mimeType": "application/pdf",
    "textExtract": """Le bassin du Congo abrite une biodiversité exceptionnelle, avec de nombreuses espèces endémiques. Cette étude présente un inventaire preliminaire de la faune et de la flore dans la région de Salonga. Les données ont été collectées sur une période de six mois, couvrant les saisons sèches et pluvieuses.

Les résultats montrent une grande diversité de mammifères, notamment des primates et des ongulés. La pression anthropique constitue la principale menace pour ces écosystèmes. La déforestation et le braconnage réduisent progressivement les habitats naturels des espèces emblematic.

Les recommandations incluent le renforcement des aires protégées et l'implication des communautés locales dans la conservation. Une approche participative est essentielle pour concilier développement humain et préservation de la biodiversité.""",
    "status": "SUBMITTED",
    "facultyId": "fac-dbac2e46-330",
    "departmentId": "dep-24a9fc88-219",
    "promotionId": None,
    "academicYear": "2025-2026",
    "uploadedById": "u-super-admin",
    "supervisedById": None,
    "createdAt": now(),
    "updatedAt": now(),
}

# Charger la DB existante
with open(DB_FILE, 'r') as f:
    db = json.load(f)

# Ajouter les documents (sans dupliquer)
existing_titles = {d['title'] for d in db['documents']}
for doc in [doc_source, doc_plagiat, doc_original]:
    if doc['title'] not in existing_titles:
        db['documents'].append(doc)

# Sauvegarder
with open(DB_FILE, 'w') as f:
    json.dump(db, f, indent=2)

print(f"✓ {len(db['documents'])} documents dans la DB")
for d in db['documents']:
    print(f"  - {d['title']} ({d['type']})")
