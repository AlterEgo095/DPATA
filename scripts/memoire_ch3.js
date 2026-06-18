// memoire_ch3.js - Chapitre 3 : Conception de la plateforme web IA
const { Paragraph, PageBreak } = require("docx");

function buildChapter3(h) {
  const { H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_image, P_empty, threeLineTable } = h;
  return [
    H1("CHAPITRE III — CONCEPTION D'UNE PLATEFORME WEB INTELLIGENTE BASÉE SUR L'IA"),

    H2("III.1. Introduction"),
    P_body("Ce chapitre est consacré à la conception de la plateforme web intelligente objet du présent mémoire. Il opère la transition entre les fondements théoriques posés au chapitre I et l'état de l'art dressé au chapitre II d'une part, et l'implémentation concrète qui fera l'objet du chapitre IV d'autre part. Il présente successivement le cadre pilote d'expérimentation, l'analyse des besoins fonctionnels et non fonctionnels, l'architecture générale et modulaire de la plateforme, l'architecture multicouche universitaire, le pipeline de traitement IA, la modélisation des données relationnelles et vectorielles, ainsi que les principaux diagrammes UML et schémas d'architecture."),
    P_body("La conception obéit à trois exigences majeures. Premièrement, la plateforme doit être intelligente, c'est-à-dire s'appuyer sur les techniques modernes d'IA décrites au chapitre I pour produire des analyses sémantiques pertinentes. Deuxièmement, elle doit être modulaire, afin de permettre son extension progressive à d'autres facultés, départements et universités sans refonte majeure. Troisièmement, elle doit être opérationnelle, c'est-à-dire déployable sur une infrastructure réaliste dans le contexte congolais, en tenant compte des contraintes de connectivité, de ressources matérielles et de compétences disponibles. Le positionnement retenu est celui d'une plateforme universitaire intelligente de gestion des travaux académiques, intégrant un moteur IA de détection automatique du plagiat comme l'un de ses services clés, aux côtés de la gestion des étudiants, des enseignants, des départements, des facultés, du dépôt et de l'archivage des travaux, et de la production de rapports automatiques."),

    H2("III.2. Présentation du cadre pilote : la Faculté des Sciences"),
    P_body("La Faculté des Sciences de l'Université de Kinshasa constitue le cadre pilote d'expérimentation de la plateforme. Sa création remonte à celle de l'Université de Lovanium, devenue Université de Kinshasa, en 1951. La pose de la première pierre du bâtiment de cette faculté, premier bâtiment de l'Université, a eu lieu le 26 septembre 1954. L'ouverture officielle de la Faculté des Sciences a eu lieu en 1957 avec des cycles d'études variés : sciences mathématiques, physiques, chimiques, biologiques, géologiques et minéralogiques. Au fil des décennies, la faculté a élargi son offre de formation pour inclure les études d'ingénieur civil et agronome, la candidature en pharmacie, les licences en sciences et un certificat en météorologie."),
    P_body("Aujourd'hui, la Faculté des Sciences comporte cinq départements : biologie, chimie, mathématiques et informatique, physique, et sciences de la terre. Elle organise une propédeutique en physique-mathématique, un diplôme spécial en gestion de l'environnement, et dispose d'un centre de formation en informatique. Elle mène, malgré des moyens matériels limités, des études tant fondamentales qu'appliquées, contribuant ainsi au développement de la science et à l'amélioration de l'environnement. Pour l'année académique en cours, la faculté compte une soixantaine de professeurs, plus de trente chefs de travaux, une soixantaine d'assistants et chargés de pratiques professionnelles, et environ quatre-vingts agents administratifs. Sur les dix facultés que renferme l'Université de Kinshasa, la Faculté des Sciences assure également les enseignements dans neuf autres facultés."),
    P_body("Le choix de la Faculté des Sciences comme cadre pilote se justifie par plusieurs facteurs : la disponibilité d'un corps professoral sensibilisé aux enjeux technologiques, l'existence d'un département d'informatique disposant de compétences techniques mobilisables, l'accessibilité d'un corpus documentaire suffisant (mémoires et TFC antérieurs), et la proximité institutionnelle facilitant l'expérimentation. Toutefois, ce choix ne limite en rien la portée de la solution : la plateforme est conçue dès l'origine comme une solution générique, applicable à toute faculté ou université, et le cadre pilote sert uniquement à valider la pertinence de l'approche dans des conditions réelles."),

    H2("III.3. Analyse des besoins fonctionnels"),
    P_body("L'analyse des besoins fonctionnels a été conduite à partir des interviews menées auprès du doyen de la Faculté des Sciences, des chefs de départements et de plusieurs enseignants, complétées par l'observation directe des procédures actuelles de dépôt et d'évaluation des travaux. Elle a permis d'identifier l'ensemble des fonctionnalités que la plateforme doit offrir pour répondre aux besoins exprimés."),
    H3("III.3.1. Gestion des utilisateurs et authentification"),
    P_body("La plateforme doit gérer plusieurs types d'utilisateurs avec des rôles et des permissions distincts. Les étudiants constituent le premier type d'utilisateurs : ils peuvent s'authentifier, déposer leurs travaux (TFC ou mémoires), consulter l'historique de leurs dépôts et accéder aux rapports d'analyse qui les concernent. Les enseignants constituent le second type : ils peuvent s'authentifier, accéder aux travaux déposés par les étudiants qu'ils encadrent, consulter les rapports d'analyse, valider ou rejeter les travaux, et laisser des commentaires. Les administrateurs de faculté constituent le troisième type : ils gèrent les comptes utilisateurs, les départements, les promotions, et disposent d'un tableau de bord global. Enfin, un super-administrateur a la responsabilité de l'ensemble de la plateforme, de la gestion des facultés et des paramètres techniques."),
    H3("III.3.2. Gestion académique"),
    P_body("La plateforme doit permettre la gestion structurée de l'organisation académique : facultés, départements, promotions, options, années académiques. Cette gestion est hiérarchique : une faculté contient plusieurs départements, un département contient plusieurs promotions, une promotion est rattachée à une option. Cette structuration conditionne la portée des comparaisons effectuées lors de la détection de plagiat : un travail est par défaut comparé aux travaux de la même faculté, avec possibilité d'étendre la comparaison à d'autres facultés ou à l'ensemble de la plateforme."),
    H3("III.3.3. Dépôt et gestion des travaux"),
    P_body("La plateforme doit offrir une interface de dépôt des travaux académiques, avec les fonctionnalités suivantes : téléversement de fichiers au format PDF, DOCX ou TXT ; extraction automatique du texte à partir des fichiers PDF (avec OCR pour les PDF scannés) ; métadonnées associées (type de travail, sujet, étudiant, encadrant, année académique, promotion) ; contrôle de conformité (taille maximale, formats acceptés) ; archivage sécurisé du fichier original et du texte extrait. Le dépôt peut être effectué par l'étudiant lui-même, par l'enseignant encadrant, ou par un administrateur."),
    H3("III.3.4. Analyse IA et détection"),
    P_body("Le cœur fonctionnel de la plateforme est l'analyse automatique des travaux par IA. Cette analyse doit :"),
    P_bullet("Prétraiter le texte extrait (nettoyage, segmentation en phrases et en paragraphes, normalisation)."),
    P_bullet("Générer des embeddings vectoriels pour chaque segment significatif du travail analysé."),
    P_bullet("Rechercher dans la base vectorielle les segments les plus similaires parmi les travaux antérieurs."),
    P_bullet("Calculer un score de similarité global et des scores par segment."),
    P_bullet("Identifier les passages potentiellement plagiés, en indiquant la source correspondante et le type de similarité (lexicale, sémantique, paraphrase)."),
    P_bullet("Produire un rapport détaillé, consultable en ligne et exportable au format PDF."),
    H3("III.3.5. Rapports et tableau de bord"),
    P_body("La plateforme doit générer automatiquement un rapport d'analyse pour chaque travail traité. Ce rapport doit comporter : un score global de similarité (pourcentage), une liste des passages identifiés comme potentiellement plagiés avec le texte source correspondant, une visualisation des segments concernés dans le document original, et des métadonnées (date d'analyse, corpus de comparaison, modèle utilisé). Un tableau de bord administratif doit offrir une vision agrégée : nombre de travaux analysés, distribution des scores de similarité, évolutions temporelles, taux de plagiat par faculté, département ou promotion."),
    H3("III.3.6. Historique et traçabilité"),
    P_body("L'ensemble des analyses effectuées doit être conservé dans un historique consultable, permettant de retracer l'évolution d'un travail, de comparer des analyses successives et d'assurer la traçabilité des décisions pédagogiques. Chaque analyse est datée, associée à l'utilisateur qui l'a déclenchée, et conserve une référence aux versions des modèles et des paramètres utilisés, afin de garantir la reproductibilité."),

    H2("III.4. Analyse des besoins non fonctionnels"),
    P_body("Au-delà des fonctionnalités attendues, la plateforme doit satisfaire un ensemble d'exigences non fonctionnelles qui conditionnent sa qualité d'usage et sa pérennité."),
    ...threeLineTable(
      ["Exigence", "Description", "Cible"],
      [
        ["Performance", "Temps de réponse acceptable pour les opérations utilisateur", "Dépôt < 5s, consultation < 2s"],
        ["Performance IA", "Temps d'analyse d'un mémoire de 50 pages", "< 10 minutes"],
        ["Scalabilité", "Capacité à traiter un volume croissant de travaux", "Architecture modulaire horizontale"],
        ["Disponibilité", "Taux de service de la plateforme", "≥ 99 % en heures ouvrables"],
        ["Sécurité", "Protection des données et des accès", "Authentification JWT, chiffrement, RBAC"],
        ["Confidentialité", "Respect de la vie privée des étudiants", "Hébergement local, anonymisation possible"],
        ["Modularité", "Capacité à étendre à d'autres facultés", "Architecture en modules indépendants"],
        ["Maintenabilité", "Facilité de maintenance et d'évolution", "Code structuré, tests, documentation"],
        ["Portabilité", "Indépendance vis-à-vis de l'infrastructure", "Conteneurisation Docker"],
        ["Accessibilité", "Utilisation depuis un navigateur standard", "Interface web responsive"],
      ],
      "Tableau III.1 — Exigences non fonctionnelles de la plateforme"
    ),

    H2("III.5. Architecture générale de la plateforme"),
    P_body("La plateforme est conçue selon une architecture multi-tiers classique, qui sépare clairement les responsabilités entre les couches de présentation, d'application, de services IA et de données. Cette séparation favorise la maintenabilité, l'évolutivité et la testabilité du système. Elle permet également de faire évoluer indépendamment chaque couche en fonction des besoins (par exemple, augmenter la puissance de calcul de la couche IA sans modifier l'interface utilisateur)."),
    H3("III.5.1. Couche présentation (frontend)"),
    P_body("La couche présentation est constituée d'une application web développée en React. Elle est accessible depuis un navigateur moderne, sans installation préalable côté client. Elle assure l'affichage des interfaces utilisateur, la gestion des interactions, et la communication avec la couche application via des appels d'API REST. L'interface est conçue en mode responsive, pour s'adapter à différents types d'écrans (ordinateur de bureau, tablette, smartphone), ce qui est particulièrement important dans un contexte où les étudiants accèdent souvent à Internet depuis des appareils mobiles."),
    H3("III.5.2. Couche application (backend)"),
    P_body("La couche application est développée en Python avec le framework FastAPI. Elle expose une API REST qui sera consommée par le frontend. Elle gère l'authentification et l'autorisation (JWT), la validation des entrées, la coordination entre les modules métier, et l'orchestration des appels aux services IA. Le choix de Python s'impose pour plusieurs raisons : écosystème IA mature (Sentence Transformers, FAISS, scikit-learn), performance suffisante pour un usage académique, syntaxe lisible facilitant la maintenance, large communauté de développeurs."),
    H3("III.5.3. Couche services IA"),
    P_body("La couche services IA regroupe les composants responsables du traitement intelligent des documents. Elle intègre : le module OCR (Tesseract) pour l'extraction de texte depuis les PDF scannés ; le module NLP (spaCy, NLTK) pour le prétraitement linguistique ; le module d'embeddings (Sentence Transformers) pour la vectorisation des segments ; le module de recherche vectorielle (pgvector) pour l'identification des plus proches voisins ; le module de calcul de similarité et de génération de rapports. Ces modules communiquent avec la couche application via des appels internes, et peuvent être déployés sur la même machine ou sur des serveurs dédiés en cas de besoin de scalabilité."),
    H3("III.5.4. Couche données"),
    P_body("La couche données regroupe l'ensemble des composants de persistance. Elle se compose de : une base relationnelle PostgreSQL pour les données structurées (utilisateurs, facultés, départements, travaux, analyses) ; une extension pgvector dans la même base PostgreSQL pour le stockage et la recherche des embeddings vectoriels ; un système de fichiers (ou un stockage objet) pour la conservation des fichiers originaux des travaux déposés. Le choix de regrouper le relationnel et le vectoriel dans une même base PostgreSQL simplifie l'architecture, évite l'introduction d'un système supplémentaire, et permet d'exprimer des requêtes combinant critères relationnels et similarité vectorielle en SQL."),

    H2("III.6. Architecture modulaire"),
    P_body("L'architecture de la plateforme est conçue de manière modulaire, chaque module couvrant un domaine fonctionnel cohérent et pouvant être développé, testé et déployé indépendamment. Cette modularité conditionne la capacité de la plateforme à s'étendre à d'autres facultés et universités."),
    ...threeLineTable(
      ["Module", "Responsabilité", "Principales entités"],
      [
        ["Authentification", "Gestion des comptes, JWT, RBAC", "User, Role, Permission"],
        ["Organisation", "Facultés, départements, promotions", "Faculty, Department, Promotion"],
        ["Utilisateurs", "Étudiants, enseignants, administrateurs", "Student, Teacher, Admin"],
        ["Documents", "Dépôt, extraction, stockage", "Document, TextExtract, File"],
        ["Pipeline IA", "NLP, embeddings, recherche vectorielle", "Embedding, Segment, Job"],
        ["Analyse", "Similarité, détection, scoring", "Analysis, Match, Score"],
        ["Rapports", "Génération PDF, visualisation", "Report, Section"],
        ["Tableau de bord", "Statistiques, agrégations", "Stats, KPI"],
        ["Historique", "Journalisation, traçabilité", "AuditLog, Event"],
      ],
      "Tableau III.2 — Modules fonctionnels de la plateforme"
    ),
    P_body("Cette modularité présente plusieurs avantages. Elle permet l'extension progressive de la plateforme : un nouveau module peut être ajouté sans impacter les modules existants. Elle facilite la répartition du travail entre développeurs. Elle autorise des stratégies de déploiement différenciées (certains modules sur des serveurs dédiés, d'autres sur une infrastructure partagée). Enfin, elle ouvre la voie à une interconnexion future avec d'autres systèmes universitaires (systèmes de gestion scolaire, ENT, bibliothèques numériques) via des API."),

    H2("III.7. Architecture multicouche universitaire"),
    P_body("Au-delà de la modularité fonctionnelle, la plateforme est conçue selon une architecture multicouche hiérarchique qui reflète la structure organisationnelle de l'université. Cette vision multicouche est essentielle pour comprendre le potentiel d'extension de la plateforme à l'échelle institutionnelle et nationale. Chaque couche correspond à un niveau d'organisation académique et bénéficie d'un niveau d'autonomie fonctionnelle, tout en s'inscrivant dans un ensemble cohérent. La figure III.1 ci-dessous présente cette architecture de manière synthétique."),
    P_image("/home/z/my-project/download/fig_III_1_architecture_multicouche.png", 540),
    P_caption("Figure III.1 — Architecture multicouche universitaire de la plateforme"),
    P_body("Cette architecture multicouche présente plusieurs propriétés essentielles. Au sommet, l'Université (UNIKIN) constitue l'autorité de tutelle et l'entité juridique de référence. La plateforme centrale IA héberge les services partagés (gestion des utilisateurs, base documentaire centralisée, moteur IA anti-plagiat, API et tableaux de bord). Les facultés constituent les modules de premier niveau : Sciences, Droit, Médecine, etc. Chaque faculté dispose de ses propres utilisateurs, de son propre référentiel de travaux et de sa propre configuration d'analyse, tout en bénéficiant des services centraux. Les départements constituent les sous-modules de chaque faculté. Enfin, les étudiants et leurs travaux remontent via les départements et facultés vers le moteur IA central, qui produit les rapports consultés par les jurys et enseignants."),
    P_body("Cette structuration autorise plusieurs stratégies de déploiement. Dans un scénario centralisé, l'ensemble des facultés est hébergé sur une infrastructure unique administrée par l'université. Dans un scénario fédéré, chaque faculté dispose de son propre serveur, synchronisé périodiquement avec la plateforme centrale. Dans un scénario interuniversitaire, plusieurs universités partagent une plateforme commune via une API fédératrice, ouvrant la voie à la détection interuniversitaire du plagiat. Cette flexibilité de déploiement est un atout majeur pour l'adoption progressive de la solution à l'échelle nationale."),
    P_body("Le tableau suivant synthétise les responsabilités de chaque couche :"),
    ...threeLineTable(
      ["Couche", "Niveau", "Responsabilités principales", "Données gérées"],
      [
        ["Université", "Stratégique", "Politique académique, gouvernance, supervision", "Cadre réglementaire"],
        ["Plateforme centrale IA", "Fédération", "Services partagés, moteur IA, API, sécurité", "Utilisateurs, embeddings, travaux"],
        ["Faculté", "Module", "Gestion facultaire, configuration des analyses", "Travaux de la faculté, enseignants"],
        ["Département", "Sous-module", "Organisation pédagogique, promotions", "Étudiants du département"],
        ["Étudiant", "Utilisateur final", "Dépôt de travaux, consultation rapports", "Ses propres travaux"],
        ["Moteur IA", "Service", "Analyse automatique, scoring, rapports", "Embeddings, matches, analyses"],
        ["Jury / Enseignant", "Utilisateur final", "Évaluation, validation, décision", "Rapports, annotations"],
      ],
      "Tableau III.3 — Responsabilités par couche de l'architecture multicouche"
    ),

    H2("III.8. Pipeline de traitement IA"),
    P_body("Le pipeline de traitement IA constitue le cœur fonctionnel de la plateforme. Il décrit l'enchaînement des opérations réalisées depuis la soumission d'un travail académique jusqu'à la production du rapport de similarité. Chaque étape est conçue pour être autonome, testable et remplaçable, ce qui permet d'améliorer progressivement les performances du système en substituant un composant par une version plus efficace."),
    H3("III.8.1. Soumission du document"),
    P_body("Le pipeline démarre lorsqu'un utilisateur dépose un travail académique via l'interface web. Le fichier (PDF, DOCX ou TXT) est téléversé vers le serveur, où il est stocké de manière sécurisée. Les métadonnées associées (type de travail, étudiant, encadrant, promotion, année académique) sont enregistrées dans la base relationnelle. Un identifiant unique est attribué au travail, qui sera utilisé tout au long du pipeline."),
    H3("III.8.2. Extraction du texte"),
    P_body("L'étape suivante consiste à extraire le texte du document déposé. Pour les fichiers DOCX et TXT, l'extraction est directe. Pour les fichiers PDF, plusieurs cas sont possibles : si le PDF contient une couche de texte sélectionnable, l'extraction est réalisée par une bibliothèque comme PyPDF2 ou pdfplumber ; si le PDF est scanné (image), une étape d'OCR avec Tesseract est nécessaire. Le texte extrait est nettoyé (suppression des en-têtes et pieds de page, normalisation des caractères) et stocké dans la base, associé au travail."),
    H3("III.8.3. Prétraitement NLP"),
    P_body("Le texte extrait est ensuite soumis à un prétraitement NLP. Cette étape comprend : la segmentation en phrases (sentence splitting), la tokenisation, la normalisation (mise en minuscules, suppression de la ponctuation excédentaire), la suppression des stop words pour certaines analyses, et éventuellement la lemmatisation. Le résultat est une liste de segments (phrases ou groupes de phrases) prêts à être vectorisés. La taille des segments est un paramètre important : des segments trop courts produisent des embeddings peu informatifs, des segments trop longs diluent l'information sémantique. Une taille de 1 à 3 phrases est généralement retenue."),
    H3("III.8.4. Génération des embeddings"),
    P_body("Chaque segment est ensuite converti en un vecteur d'embedding par le modèle Sentence-BERT. Le modèle utilisé (distiluse-base-multilingual-cased-v1) produit des vecteurs de dimension 512, capables de capturer le sens des phrases en français et en anglais. Les embeddings générés sont stockés dans la base vectorielle (pgvector), associés à l'identifiant du travail et à la position du segment dans le document original."),
    H3("III.8.5. Recherche vectorielle"),
    P_body("Pour chaque segment du travail analysé, la plateforme recherche dans la base vectorielle les segments les plus similaires parmi l'ensemble des travaux antérieurs. Cette recherche est effectuée à l'aide de l'index HNSW de pgvector, qui permet une recherche approximative des k plus proches voisins en quelques millisecondes, même sur des bases de plusieurs millions de vecteurs. La recherche peut être filtrée par faculté, département ou promotion, selon la configuration choisie."),
    H3("III.8.6. Calcul de similarité"),
    P_body("Pour chaque paire de segments identifiés comme proches, la similarité cosinus est calculée précisément. Les paires dont la similarité dépasse un seuil prédéfini (par défaut 0,80) sont retenues comme des correspondances potentielles. Un score global de similarité est calculé pour le travail, en agrégeant les correspondances : ce score représente la proportion du travail qui présente des similarités significatives avec des sources existantes."),
    H3("III.8.7. Détection et classification"),
    P_body("Les correspondances identifiées sont ensuite classées par type : copier-coller strict (similarité lexicale très élevée), paraphrase (similarité sémantique élevée avec similarité lexicale plus faible), reformulation (similarité sémantique élevée avec structure syntaxique différente). Cette classification aide l'enseignant à évaluer la gravité des similarités détectées. Les faux positifs potentiels (citations correctement référencées, passages standards comme les définitions) sont signalés pour révision humaine."),
    H3("III.8.8. Génération du rapport"),
    P_body("Enfin, un rapport détaillé est généré automatiquement. Il comporte : un résumé exécutif (score global, nombre de correspondances, classification), une liste détaillée des passages identifiés avec leur source et le type de similarité, une visualisation du document original avec surlignage des passages concernés, et des recommandations pour l'évaluation. Le rapport est consultable en ligne dans l'interface et exportable au format PDF."),

    H2("III.9. Base documentaire relationnelle"),
    P_body("La base documentaire relationnelle est structurée autour des entités principales suivantes : Faculty (faculté), Department (département), Promotion, User (utilisateur, avec sous-types Student, Teacher, Admin), Document (travail académique), Analysis (analyse), Match (correspondance détectée). Les relations entre ces entités modélisent l'organisation académique et le cycle de vie des travaux."),
    P_body("Le schéma relationnel simplifié est le suivant : une Faculty contient plusieurs Departments, un Department contient plusieurs Promotions, une Promotion contient plusieurs Students. Un Document est rattaché à un Student, à un Teacher (encadrant), à une Promotion et à une Faculty. Une Analysis est associée à un Document et à un User (celui qui a déclenché l'analyse). Plusieurs Matchs sont associés à une Analysis, chaque Match liant un segment du travail analysé à un segment d'un travail antérieur."),
    P_body("Des contraintes d'intégrité garantissent la cohérence des données : clés étrangères entre les tables, unicité des identifiants, contraintes de domaine (par exemple, le score de similarité doit être compris entre 0 et 1). Des index sont créés sur les champs les plus sollicités pour optimiser les performances (par exemple, index sur l'identifiant de l'étudiant, sur la date d'analyse, sur le score de similarité)."),

    H2("III.10. Base vectorielle"),
    P_body("La base vectorielle est intégrée à la base relationnelle via l'extension pgvector. Une table spécifique, DocumentEmbeddings, stocke les embeddings de tous les segments de tous les travaux. Cette table contient les champs suivants : identifiant unique de l'embedding, identifiant du document source, position du segment dans le document, texte du segment, vecteur d'embedding (type vector(512)), date de création."),
    P_body("Un index HNSW (Hierarchical Navigable Small World) est créé sur le champ vectoriel pour permettre une recherche rapide des plus proches voisins. Les paramètres de l'index (m, ef_construction, ef_search) sont choisis pour offrir un bon compromis entre vitesse de recherche et précision. Des requêtes SQL spécifiques permettent de rechercher les segments les plus similaires à un vecteur donné, en filtrant éventuellement par faculté ou département."),
    P_body("L'avantage d'intégrer la base vectorielle à PostgreSQL est triple : pas de système supplémentaire à maintenir, cohérence transactionnelle entre les données relationnelles et vectorielles, possibilité d'exprimer des requêtes combinant les deux types de données. L'inconvénient est une performance potentiellement inférieure à des systèmes vectoriels dédiés (FAISS, Milvus) pour des volumes très importants, mais ce compromis est acceptable dans le contexte d'une plateforme universitaire nationale où le volume de documents reste maîtrisé."),

    H2("III.11. Conception de l'API REST"),
    P_body("L'API REST constitue l'interface entre le frontend et le backend. Elle expose un ensemble d'endpoints organisés par ressource, suivant les principes REST. Les principaux endpoints sont les suivants :"),
    ...threeLineTable(
      ["Endpoint", "Méthode", "Description", "Authentification"],
      [
        ["/api/auth/login", "POST", "Authentification et génération JWT", "Publique"],
        ["/api/students", "GET/POST", "Liste et création d'étudiants", "Admin"],
        ["/api/teachers", "GET/POST", "Liste et création d'enseignants", "Admin"],
        ["/api/faculties", "GET/POST", "Liste et création de facultés", "Super-admin"],
        ["/api/documents", "GET/POST", "Liste et dépôt de travaux", "Étudiant/Enseignant"],
        ["/api/documents/{id}/analyze", "POST", "Déclenchement d'une analyse", "Enseignant/Admin"],
        ["/api/analyses/{id}", "GET", "Récupération d'un rapport", "Enseignant/Admin"],
        ["/api/analyses/{id}/pdf", "GET", "Export PDF d'un rapport", "Enseignant/Admin"],
        ["/api/dashboard/stats", "GET", "Statistiques agrégées", "Admin"],
      ],
      "Tableau III.4 — Principaux endpoints de l'API REST"
    ),
    P_body("L'authentification est gérée par JWT (JSON Web Tokens). À la connexion, l'utilisateur reçoit un token signé, qu'il doit inclure dans l'en-tête Authorization des requêtes suivantes. Les autorisations sont gérées par un mécanisme RBAC (Role-Based Access Control), qui associe à chaque rôle un ensemble de permissions. Les réponses de l'API sont au format JSON, et les erreurs suivent les codes HTTP standards (200 pour succès, 400 pour erreur client, 401 pour non authentifié, 403 pour non autorisé, 404 pour introuvable, 500 pour erreur serveur)."),

    H2("III.12. Modélisation UML"),
    H3("III.12.1. Diagramme de cas d'utilisation"),
    P_body("Le diagramme de cas d'utilisation identifie les principaux acteurs du système (Étudiant, Enseignant, Administrateur, Système IA) et les cas d'utilisation associés. L'Étudiant peut : s'authentifier, déposer un travail, consulter ses rapports. L'Enseignant peut : s'authentifier, consulter les travaux de ses étudiants, déclencher une analyse, consulter les rapports, valider ou rejeter un travail. L'Administrateur peut : gérer les utilisateurs, gérer l'organisation académique, consulter le tableau de bord. Le Système IA intervient automatiquement lors du dépôt (extraction du texte) et lors du déclenchement d'une analyse (pipeline complet)."),
    H3("III.12.2. Diagramme de classes"),
    P_body("Le diagramme de classes modélise les entités principales du système et leurs relations. Les classes identifiées sont : User (avec ses sous-classes Student, Teacher, Admin), Faculty, Department, Promotion, Document, TextExtract, Segment, Embedding, Analysis, Match, Report. Les associations entre ces classes traduisent les relations identifiées dans le schéma relationnel : une Faculty contient plusieurs Departments, un Document a plusieurs Segments, une Analysis a plusieurs Matchs, etc. Les attributs et méthodes de chaque classe sont définis selon les principes de la programmation orientée objet."),
    H3("III.12.3. Diagramme de séquences"),
    P_body("Le diagramme de séquences décrit l'enchaînement des interactions lors du dépôt et de l'analyse d'un travail. La séquence principale est la suivante : l'Étudiant dépose un travail via le Frontend ; le Frontend envoie une requête POST /api/documents au Backend ; le Backend stocke le fichier, crée l'entrée en base, et déclenche l'extraction du texte via le module OCR/NLP ; le texte extrait est stocké ; un message de succès est renvoyé à l'utilisateur. Lorsqu'une analyse est déclenchée par l'Enseignant, le Backend orchestre le pipeline : prétraitement NLP, génération des embeddings, recherche vectorielle, calcul de similarité, génération du rapport. Le rapport est stocké en base et notifié à l'enseignant."),

    H2("III.13. Diagrammes d'architecture logicielle"),
    P_body("Au-delà des diagrammes UML classiques, l'architecture de la plateforme est décrite par des diagrammes d'architecture logicielle qui mettent en évidence la répartition des composants et les flux de données. Le diagramme d'architecture globale présente les quatre couches (présentation, application, services IA, données) et leurs interactions. Le diagramme de déploiement décrit la répartition des composants sur les serveurs (serveur web, serveur d'application, serveur de base de données, éventuellement serveur IA dédié). Le diagramme de flux de données illustre le parcours d'un travail depuis le dépôt jusqu'au rapport final."),
    P_body("Ces diagrammes ne sont pas de simples illustrations : ils constituent la référence technique du projet, à partir de laquelle les développements sont organisés et les évolutions sont planifiées. Ils sont versionnés et mis à jour à chaque évolution significative de l'architecture."),

    H2("III.14. Conclusion"),
    P_body("Ce chapitre a présenté la conception détaillée de la plateforme web intelligente. L'architecture multi-tiers, la modularité fonctionnelle, le pipeline IA en huit étapes, la base relationnelle PostgreSQL étendue par pgvector, et l'API REST constituent les piliers techniques de la solution. La modélisation UML et les diagrammes d'architecture logicielle fournissent une représentation rigoureuse du système, à la fois pour la communication avec les parties prenantes et pour l'orientation des développements."),
    P_body("Le chapitre suivant sera consacré à l'implémentation concrète de cette conception, à l'expérimentation de la plateforme sur un corpus pilote de travaux académiques de la Faculté des Sciences, et à l'évaluation quantitative de ses performances. Il présentera la stack technique effectivement mise en œuvre, les extraits de code clés du pipeline (modèles de données, endpoints API, fonctions de scoring), et l'analyse des résultats d'évaluation."),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

module.exports = { buildChapter3 };
