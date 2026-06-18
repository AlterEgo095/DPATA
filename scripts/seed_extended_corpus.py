#!/usr/bin/env python3
"""
Étend le corpus de test avec 10 documents supplémentaires pour l'évaluation quantitative.
Comprend : plagiatats copier-coller, paraphrases, traductions, et documents originaux.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

DB_FILE = '/home/z/my-project/data/db.json'

def gen_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"

def now():
    return datetime.utcnow().isoformat() + 'Z'

# Documents pour évaluation
# Catégories : SOURCE, COPY_PASTE, PARAPHRASE, TRANSLATION, ORIGINAL
# On va créer plusieurs paires source/plagiat pour tester la détection

new_documents = [
    # === PAIRE 1 : IA et éducation ===
    {
        "title": "Les défis du numérique dans l'éducation africaine",
        "type": "MEMOIRE",
        "subject": "Transformations numériques éducatives",
        "text": """La transformation numérique bouleverse les systèmes éducatifs africains. L'intégration des technologies de l'information dans les établissements scolaires et universitaires représente un défi majeur pour les pays en développement. Les infrastructures de télécommunication restent inégales, avec une connectivité internet limitée dans les zones rurales.

Le coût des équipements informatiques constitue un obstacle important pour de nombreuses familles. Les universités africaines doivent repenser leurs modèles pédagogiques pour intégrer les outils numériques de manière pertinente. La formation des enseignants aux nouvelles technologies apparaît comme une priorité absolue.

Les partenaires internationaux jouent un rôle crucial dans le financement des projets numériques éducatifs. Les investissements doivent privilégier la pérennité plutôt que les effets d'annonce. Une stratégie nationale cohérente est indispensable pour éviter la prolifération de projets isolés.""",
        "category": "ORIGINAL",
    },
    {
        "title": "Numérisation de l'enseignement : enjeux et perspectives africaines",
        "type": "MEMOIRE",
        "subject": "Technologies éducatives",
        "text": """La révolution numérique transforme profondément les systèmes éducatifs du continent africain. L'adoption des technologies de l'information au sein des écoles et universités constitue un challenge significatif pour les nations en développement. Les infrastructures de communication demeurent hétérogènes, avec un accès internet restreint en milieu rural.

Le prix du matériel informatique représente une barrière considérable pour beaucoup de foyers. Les institutions universitaires africaines doivent repenser leurs approches pédagogiques afin d'intégrer les outils numériques de façon adéquate. La formation pédagogique des enseignants face aux technologies émergentes apparaît comme une urgence absolue.

Les bailleurs internationaux jouent un rôle essentiel dans le financement des initiatives numériques éducatives. Les investissements doivent favoriser la durabilité plutôt que les communications politiciennes. Une vision nationale cohérente est nécessaire pour éviter la multiplication de projets dispersés.""",
        "category": "PARAPHRASE",
    },
    # === PAIRE 2 : Économie informelle ===
    {
        "title": "L'économie informelle en Afrique subsaharienne",
        "type": "MEMOIRE",
        "subject": "Économie du développement",
        "text": """L'économie informelle occupe une place prépondérante en Afrique subsaharienne, représentant plus de 60% du PIB dans de nombreux pays. Ce secteur absorbe la majorité de la population active urbaine et rurale, constituant un filet de sécurité sociale essentiel en l'absence de systèmes de protection formels.

Les activités informelles couvrent un spectre large : commerce de rue, artisanat, petits services, agriculture familiale, transport. Cette diversité reflète l'ingéniosité des populations face aux difficultés économiques. Toutefois, l'informalité limite la collecte des recettes fiscales et complique la mise en œuvre de politiques publiques efficaces.

La formalisation progressive de l'économie informelle constitue un objectif majeur des gouvernements. Les approches coercitives se sont révélées inefficaces. Les programmes d'accompagnement, combinant incitations fiscales, accès au crédit et formation, offrent des résultats plus prometteurs.""",
        "category": "ORIGINAL",
    },
    {
        "title": "Le secteur informel en Afrique de l'Ouest : analyse économique",
        "type": "MEMOIRE",
        "subject": "Économie informelle",
        "text": """L'économie informelle occupe une place prépondérante en Afrique subsaharienne, représentant plus de 60% du PIB dans de nombreux pays. Ce secteur absorbe la majorité de la population active urbaine et rurale, constituant un filet de sécurité sociale essentiel en l'absence de systèmes de protection formels.

Les activités informelles couvrent un spectre large : commerce de rue, artisanat, petits services, agriculture familiale, transport. Cette diversité reflète l'ingéniosité des populations face aux difficultés économiques. Toutefois, l'informalité limite la collecte des recettes fiscales et complique la mise en œuvre de politiques publiques efficaces.

La formalisation progressive de l'économie informelle constitue un objectif majeur des gouvernements. Les approches coercitives se sont révélées inefficaces. Les programmes d'accompagnement, combinant incitations fiscales, accès au crédit et formation, offrent des résultats plus prometteurs.""",
        "category": "COPY_PASTE",
    },
    # === PAIRE 3 : Changement climatique ===
    {
        "title": "Impacts du changement climatique sur l'agriculture congolaise",
        "type": "TFC",
        "subject": "Climat et agriculture",
        "text": """Le changement climatique affecte durablement l'agriculture en République Démocratique du Congo. Les variations de précipitations bouleversent les calendriers de semis traditionnels. Les petits agriculteurs, qui représentent 70% de la population active, font face à une insécurité alimentaire croissante.

Les températures en hausse modifient la répartition géographique des cultures. Le manioc, aliment de base de millions de Congolais, voit ses rendements diminuer dans certaines régions. Les variétés résistantes à la sécheresse doivent être développées et diffusées rapidement.

Les stratégies d'adaptation incluent l'agroforesterie, la diversification des cultures et l'irrigation. Ces solutions nécessitent des investissements significatifs et un accompagnement technique des paysans. La coopération régionale permettrait de mutualiser les connaissances et les ressources.""",
        "category": "ORIGINAL",
    },
    {
        "title": "Changements climatiques et sécurité alimentaire en RDC",
        "type": "TFC",
        "subject": "Climat et agriculture",
        "text": """Les bouleversements climatiques impactent fortement l'agriculture de la République Démocratique du Congo. Les modifications du régime des pluies perturbent les cycles de plantation ancestraux. Les petits exploitants, qui constituent 70% de la population active, subissent une précarité alimentaire grandissante.

L'augmentation des températures change la géographie des cultures. Le manioc, denrée essentielle pour des millions de Congolais, connaît des baisses de productivité dans plusieurs zones. Des variétés tolérantes à la sécheresse doivent être créées et distribuées urgemment.

Les approches d'adaptation comprennent l'agroforesterie, la pluralité des cultures et l'irrigation. Ces réponses exigent des financements importants et un support technique aux agriculteurs. La collaboration sous-régionale permettrait de partager les savoirs et les moyens.""",
        "category": "PARAPHRASE",
    },
    # === Documents originaux supplémentaires (sujets différents) ===
    {
        "title": "Histoire de l'enseignement supérieur au Congo",
        "type": "MEMOIRE",
        "subject": "Histoire de l'éducation",
        "text": """L'enseignement supérieur au Congo a une histoire riche qui remonte à l'époque coloniale. La création de l'Université de Lovanium en 1954 marque le début de l'enseignement universitaire moderne dans le pays. Cette institution, devenue Université de Kinshasa après l'indépendance, a formé plusieurs générations de cadres congolais.

L'Université Officielle du Congo à Lubumbashi, fondée en 1955, constitue un autre pilier historique. Ces deux établissements ont joué un rôle central dans la formation des élites nationales. Le mouvement étudiant de 1969 a marqué un tournant dans l'histoire universitaire congolaise.

L'expansion de l'enseignement supérieur s'est accélérée dans les années 1980 avec la création de nouvelles universités publiques. Les années 1990 ont vu l'émergence d'universités privées. Aujourd'hui, le paysage de l'enseignement supérieur congolais est diversifié mais fait face à des défis de qualité et d'accessibilité.""",
        "category": "ORIGINAL",
    },
    {
        "title": "La musique congolaise et son influence internationale",
        "type": "TFC",
        "subject": "Musicologie",
        "text": """La musique congolaise occupe une place unique dans le paysage musical africain et mondial. Le style soukous, né dans les années 1960, a conquis le continent grâce à des artistes emblématiques comme Franco Luambo et Papa Wemba. La rumba congolaise, inscrite au patrimoine culturel immatériel de l'UNESCO, témoigne de la richesse de cette tradition musicale.

Les orchestres comme OK Jazz et Afrisa International ont défini le son congolais classique. L'innovation technique, notamment l'utilisation de la guitare électrique, a créé un style distinctif. Les paroles abordent des thèmes sociaux, politiques et amoureux, reflétant la société congolaise.

L'influence de la musique congolaise s'étend bien au-delà des frontières nationales. De nombreux artistes africains s'inspirent de ce style. La diaspora congolaise a contribué à diffuser cette musique à travers le monde, notamment en Europe et en Amérique du Nord.""",
        "category": "ORIGINAL",
    },
    {
        "title": "Les minerais de conflit dans l'est du Congo",
        "type": "MEMOIRE",
        "subject": "Géopolitique des ressources",
        "text": """L'exploitation des minerais de conflit dans l'est de la République Démocratique du Congo représente un défi majeur pour la stabilité régionale. Le coltan, l'or, l'étain et le tungstène financent les groupes armés qui sévissent dans les provinces du Nord-Kivu et du Sud-Kivu depuis des décennies.

La chaîne d'approvisionnement des minerais congolais est complexe et opaque. Les minerais extraits artisanalement passent par de multiples intermédiaires avant d'atteindre les marchés internationaux. Cette opacité complique la traçabilité et le contrôle des flux financiers.

Les initiatives internationales comme le mécanisme de certification de la Conférence internationale sur la région des Grands Lacs visent à assainir le commerce. Les entreprises technologiques sont de plus en plus pressées de vérifier l'origine de leurs minerais. Toutefois, l'application effective de ces régulations reste limitée sur le terrain.""",
        "category": "ORIGINAL",
    },
    {
        "title": "Télémedicine et accès aux soins en Afrique rurale",
        "type": "TFC",
        "subject": "Santé numérique",
        "text": """La télémédecine émerge comme une solution prometteuse pour améliorer l'accès aux soins dans les zones rurales africaines. Les consultations à distance permettent de connecter les patients isolés avec des médecins spécialistes situés dans les centres urbains. Cette approche réduit les déplacements coûteux et améliore la prise en charge.

Les technologies mobiles jouent un rôle central dans le déploiement de la télémédecine. L'utilisation des smartphones pour transmettre des images médicales, des résultats d'analyses et des données vitales s'est généralisée. Les applications de santé mobile couvrent désormais le suivi prénatal, la gestion du diabète et la prévention du paludisme.

Les défis de la télémédecine en Afrique incluent la connectivité, la formation du personnel et la réglementation. Les aspects éthiques liés à la confidentialité des données médicales nécessitent un cadre juridique adapté. L'intégration avec les systèmes de santé traditionnels reste un travail en cours.""",
        "category": "ORIGINAL",
    },
]

def main():
    with open(DB_FILE) as f:
        db = json.load(f)

    # Récupérer la faculté et le département par défaut
    fac_id = db['faculties'][0]['id'] if db['faculties'] else None
    dep_id = db['departments'][0]['id'] if db['departments'] else None
    admin_id = db['users'][0]['id']  # super-admin

    if not fac_id or not dep_id:
        print("❌ Aucune faculté/département trouvé. Créez-les d'abord via la plateforme.")
        return

    existing_titles = {d['title'] for d in db['documents']}
    added = 0

    for doc_data in new_documents:
        if doc_data['title'] in existing_titles:
            print(f"  ⏭️  Skip (existe): {doc_data['title']}")
            continue

        doc = {
            "id": gen_id('doc'),
            "title": doc_data['title'],
            "type": doc_data['type'],
            "subject": doc_data.get('subject'),
            "abstract": doc_data.get('text', '')[:200] + '...',
            "fileName": f"{doc_data['title'][:30].replace(' ', '_')}.pdf",
            "fileSize": len(doc_data['text']) * 2,  # Approximation
            "mimeType": "application/pdf",
            "textExtract": doc_data['text'],
            "status": "SUBMITTED",
            "facultyId": fac_id,
            "departmentId": dep_id,
            "promotionId": None,
            "academicYear": "2025-2026",
            "uploadedById": admin_id,
            "supervisedById": None,
            "createdAt": now(),
            "updatedAt": now(),
            # Champ supplémentaire pour l'évaluation
            "_category": doc_data['category'],
        }
        db['documents'].append(doc)
        added += 1
        print(f"  ✓ Ajouté [{doc_data['category']:12s}] : {doc_data['title']}")

    with open(DB_FILE, 'w') as f:
        json.dump(db, f, indent=2)

    print(f"\n✓ {added} documents ajoutés au corpus")
    print(f"  Total documents : {len(db['documents'])}")

    # Statistiques par catégorie
    categories = {}
    for d in db['documents']:
        cat = d.get('_category', 'ORIGINAL')
        categories[cat] = categories.get(cat, 0) + 1
    print("\nRépartition par catégorie :")
    for cat, n in sorted(categories.items()):
        print(f"  {cat}: {n}")

if __name__ == '__main__':
    main()
