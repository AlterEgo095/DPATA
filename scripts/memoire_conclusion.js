// memoire_conclusion.js - Conclusion générale + Bibliographie
const { Paragraph, PageBreak } = require("docx");

function buildConclusion(h) {
  const { H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable } = h;
  return [
    H1("CONCLUSION GÉNÉRALE"),

    P_body("Au terme de cette première phase du travail consacrée à la conception d'une plateforme web basée sur l'Intelligence Artificielle pour la détection automatique du plagiat dans les travaux académiques, il convient de revenir sur les acquis de la présente étape, les limites identifiées et les perspectives qu'ouvre la suite du projet. L'ambition initiale était de proposer une alternative moderne aux outils classiques de détection du plagiat, en s'appuyant sur les techniques récentes d'Intelligence Artificielle et en tenant compte des spécificités du contexte universitaire congolais, avec la Faculté des Sciences de l'Université de Kinshasa comme cadre pilote. Le présent document a couvert les trois premiers chapitres correspondant à la phase de conception ; le quatrième chapitre, consacré à l'implémentation et à l'évaluation, sera intégré ultérieurement à l'issue du développement effectif de la plateforme."),

    H2("Acquis de la phase de conception"),
    P_body("Le premier acquis majeur de ce travail est la maîtrise des fondements théoriques et techniques nécessaires à la conception d'une plateforme intelligente de détection du plagiat. Le premier chapitre a permis de poser les bases conceptuelles de l'Intelligence Artificielle, du machine learning, du deep learning, du traitement automatique du langage naturel, des embeddings vectoriels, de la similarité sémantique, de la recherche vectorielle et de l'IA générative. Ces fondements constituent le socle technique sur lequel reposent les choix de conception opérés par la suite, et garantissent la cohérence scientifique de la solution proposée."),
    P_body("Le deuxième acquis est l'établissement d'un état de l'art complet du plagiat académique, intégrant les formes classiques (copier-coller, paraphrase, traduction, auto-plagiat) et les formes émergentes (plagiat par IA générative, paraphrase automatique par LLM). Cet état de l'art, complété par une analyse comparative des solutions commerciales existantes (Turnitin, Compilatio, Urkund), a permis de positionner clairement la valeur ajoutée de la plateforme proposée : hébergement local des données, adaptation au contexte linguistique francophone, maîtrise du coût, architecture modulaire extensible à d'autres facultés et universités."),
    P_body("Le troisième acquis, et probablement le plus structurant, est la conception détaillée d'une plateforme universitaire intelligente articulée autour de cinq piliers : une architecture multi-tiers (présentation, application, services IA, données) ; une modularité fonctionnelle permettant l'extension progressive ; une architecture multicouche universitaire reflétant la structure organisationnelle (université, facultés, départements, étudiants) ; un pipeline IA en huit étapes allant de la soumission à la génération du rapport ; une base de données PostgreSQL étendue par pgvector pour la recherche vectorielle. La modélisation UML et la conception de l'API REST fournissent une feuille de route claire pour la phase de développement."),
    P_body("Le quatrième acquis est la formalisation d'une vision stratégique : la plateforme n'est pas conçue comme un simple logiciel anti-plagiat, mais comme un écosystème universitaire intelligent dont le moteur de détection du plagiat constitue l'un des services clés, aux côtés de la gestion des étudiants, des enseignants, des facultés, des départements, du dépôt et de l'archivage des travaux, et de la production de rapports automatiques. Cette vision ouvre la voie à une extension future vers d'autres services IA (correction automatique des citations, suggestion de reformulation, assistant de rédaction scientifique, index national des mémoires, détection interuniversitaire du plagiat)."),

    H2("Limites de la phase actuelle"),
    P_body("Plusieurs limites doivent être reconnues pour situer correctement la portée du travail accompli à ce stade. La première limite est que la plateforme demeure à l'état de conception : aucune implémentation effective n'a encore été réalisée, et les choix techniques opérés (Sentence-BERT multilingue, pgvector, FastAPI, React, Docker) restent à valider par la pratique. La phase de développement devra confirmer la faisabilité technique, mesurer les performances réelles et identifier les ajustements nécessaires."),
    P_body("La deuxième limite est l'absence d'évaluation quantitative. L'hypothèse formulée en introduction, selon laquelle l'approche sémantique fondée sur les embeddings surpasserait significativement l'approche lexicale classique, reste à valider expérimentalement. Cette validation, qui constitue l'objet du quatrième chapitre à venir, nécessitera la constitution d'un corpus pilote annoté de travaux académiques de la Faculté des Sciences, le déploiement du pipeline complet, et le calcul des métriques de performance (précision, rappel, F1-score, courbe ROC) sur ce corpus."),
    P_body("La troisième limite est l'absence de captures d'écran de l'interface utilisateur, qui ne pourront être produites qu'après le développement du frontend React. Ces captures constituent un élément essentiel du quatrième chapitre, car elles illustreront concrètement le fonctionnement de la plateforme et faciliteront l'évaluation de l'ergonomie par le jury."),
    P_body("La quatrième limite est d'ordre infrastructurel : le déploiement effectif de la plateforme à l'échelle d'une faculté suppose une infrastructure stable (connectivité Internet, serveurs, stockage, sauvegardes) qui n'est pas toujours garantie dans le contexte congolais. Des solutions de déploiement dégradé (mode hors ligne, synchronisation différée) pourront être étudiées lors de la phase d'implémentation."),
    P_body("La cinquième limite porte sur les questions éthiques et de confidentialité. Le traitement de travaux étudiants par une plateforme automatisée soulève des questions de protection des données, de consentement, de durée de conservation, de droit à l'effacement. Ces questions, abordées dans la conception, nécessiteront un cadre juridique et organisationnel plus complet lors du déploiement opérationnel."),

    H2("Suites immédiates du projet"),
    P_body("La suite immédiate du projet consistera à réaliser la phase de développement effectif de la plateforme, qui fera l'objet du quatrième chapitre du mémoire. Cette phase comportera plusieurs étapes successives. D'abord, la mise en place de l'environnement de développement : configuration de l'environnement Python, installation des dépendances (FastAPI, SQLAlchemy, Sentence Transformers, spaCy, Tesseract, ReportLab), déploiement d'une instance PostgreSQL avec l'extension pgvector, initialisation du projet React avec Vite et TypeScript, configuration de Docker pour la conteneurisation. Ensuite, le développement du backend : modèles de données SQLAlchemy, endpoints de l'API REST, authentification JWT, orchestration du pipeline IA asynchrone. Puis le développement du frontend : interfaces de dépôt, tableau de bord, visualisation des rapports, écrans d'administration. Ensuite, l'intégration du pipeline IA complet : extraction OCR, prétraitement NLP, génération des embeddings, recherche vectorielle pgvector, calcul de similarité, classification des correspondances, génération des rapports PDF."),
    P_body("Une fois la plateforme développée, l'expérimentation sera conduite sur un corpus pilote de travaux académiques de la Faculté des Sciences. Ce corpus comprendra un échantillon représentatif de mémoires et de TFC effectivement déposés au cours des dernières années académiques, complété par des travaux contenant des plagiatats artificiellement insérés (copier-coller, paraphrases, traductions) pour permettre l'évaluation quantitative. Une baseline lexicale sera implémentée pour servir de référence, et les deux approches seront comparées sur la base des métriques standard de l'apprentissage automatique. Les captures d'écran de l'interface, les extraits de code clés, les tableaux de résultats et l'analyse des performances constitueront le contenu du quatrième chapitre."),

    H2("Perspectives"),
    P_body("Au-delà de la phase d'implémentation à venir, les perspectives ouvertes par ce travail s'articulent autour de cinq axes complémentaires."),
    H3("Extension à l'échelle nationale"),
    P_body("La première perspective est l'extension progressive de la plateforme à l'ensemble des facultés de l'Université de Kinshasa, puis à d'autres universités congolaises. L'architecture modulaire et multicouche retenue facilite cette extension : chaque faculté ou université peut être ajoutée comme un module indépendant, avec sa propre base de travaux, tout en bénéficiant du cœur technique commun. La constitution d'un référentiel académique national, regroupant les travaux de plusieurs établissements, ouvrirait la voie à une détection interuniversitaire du plagiat, particulièrement utile pour identifier les étudiants qui soumettent le même travail dans plusieurs établissements."),
    H3("Amélioration de la détection"),
    P_body("La deuxième perspective concerne l'amélioration des performances de détection. Plusieurs pistes pourront être explorées : fine-tuning du modèle d'embeddings sur un corpus académique francophone, intégration d'approches spécialisées pour la détection du plagiat par IA générative (classificateurs supervisés, métriques de perplexité, analyse stylométrique), combinaison avec des approches citation analysis pour les travaux scientifiques, intégration de la détection multilingue au-delà du français et de l'anglais. L'évolution rapide du domaine imposera une veille technologique continue et des mises à jour régulières du pipeline IA."),
    H3("Enrichissement fonctionnel de la plateforme"),
    P_body("La troisième perspective porte sur l'enrichissement fonctionnel de la plateforme en tant qu'écosystème universitaire intelligent. Plusieurs évolutions sont envisageables : module de formation des étudiants à l'intégrité académique, avec auto-évaluation de leurs travaux avant dépôt ; intégration avec les systèmes de gestion scolaire existants (PGI, ENT) pour éviter la double saisie des métadonnées ; API ouverte aux établissements partenaires pour permettre l'interopérabilité ; module de tableau de bord avancé pour le pilotage institutionnel de l'intégrité académique ; application mobile pour faciliter le dépôt et la consultation par les étudiants."),
    H3("Recherche et publication"),
    P_body("La quatrième perspective est la poursuite de la recherche sur les thèmes abordés. Le présent mémoire constitue une première contribution, qui appelle des approfondissements : publication des résultats d'évaluation dans des revues scientifiques du domaine, participation aux campagnes d'évaluation internationales (PAN, SemEval), collaboration avec d'autres équipes de recherche africaines travaillant sur des problématiques similaires, encadrement de mémoires complémentaires sur des aspects spécifiques (détection du plagiat par IA générative, fine-tuning multilingue, etc.)."),

    H2("Perspectives IA : vers un écosystème universitaire intelligent"),
    P_body("Au-delà des extensions décrites ci-dessus, la plateforme est conçue pour évoluer vers un véritable écosystème universitaire intelligent, dont le moteur anti-plagiat ne serait qu'un service parmi un bouquet plus large de services IA au service de l'enseignement supérieur. Cette vision à long terme, que nous esquissons ici, vise à positionner la solution non comme un simple logiciel anti-plagiat, mais comme une plateforme universitaire intelligente de référence."),
    H3("Détection du plagiat par IA générative"),
    P_body("L'évolution la plus urgente concerne la détection des contenus produits par les grands modèles de langage (ChatGPT, Claude, Gemini, etc.). Le présent mémoire identifie cette problématique comme l'un des fronts de recherche les plus actifs du domaine. Les pistes à explorer incluent : classificateurs supervisés spécialisés dans la distinction texte humain / texte IA, métriques de perplexité adaptées aux modèles multilingues, analyse stylométrique fine des régularités syntaxiques des LLM, et watermarking collaboratif avec les fournisseurs de modèles. La collaboration avec les éditeurs de LLM, dans le cadre d'initiatives internationales, pourrait faciliter l'accès à des métadonnées signalant les contenus générés."),
    H3("Correction automatique des citations"),
    P_body("Un second service IA d'intérêt est la correction automatique des citations. À partir du texte d'un mémoire et de la liste des références bibliographiques déclarées, un modèle de langage spécialisé pourrait vérifier la conformité des citations aux normes académiques (APA, MLA, Chicago, IEEE), détecter les références manquantes, signaler les citations orphelines (références sans citation dans le texte), et proposer des corrections automatiques. Ce service compléterait utilement la détection du plagiat, en aidant l'étudiant à améliorer la rigueur formelle de son travail avant soumission."),
    H3("Suggestion de reformulation"),
    P_body("Un troisième service IA envisagé est la suggestion de reformulation pour les passages identifiés comme potentiellement plagiés. Lorsqu'un segment est signalé comme trop similaire à une source existante, la plateforme pourrait proposer à l'étudiant plusieurs reformulations alternatives, présentées comme des pistes à intégrer avec citation appropriée de la source. Ce service transforme la plateforme d'un outil purement répressif en un outil d'accompagnement pédagogique, aidant l'étudiant à développer ses compétences de paraphrase et de citation."),
    H3("Assistant de rédaction scientifique"),
    P_body("Un quatrième service IA, plus ambitieux, est la conception d'un assistant de rédaction scientifique intégré à la plateforme. Cet assistant, fondé sur un LLM spécialisé dans le domaine académique, pourrait : proposer des plans de travail en fonction du sujet, suggérer des références bibliographiques pertinentes, vérifier la cohérence argumentative, identifier les passages manquant de support empirique, suggérer des transitions entre sections, vérifier la conformité à un guide de rédaction. Cet assistant serait accessible aux étudiants tout au long de la rédaction, et non uniquement au moment du dépôt, pour favoriser une approche préventive plutôt que curative."),
    H3("Index national des mémoires"),
    P_body("Un cinquième service, à l'échelle institutionnelle, est la constitution d'un index national des mémoires et TFC, regroupant l'ensemble des travaux académiques déposés dans les universités congolaises. Cet index, accessible via une API fédératrice, permettrait : la recherche bibliographique transversale, l'identification des travaux apparentés, l'analyse statistique de la production académique nationale, et naturellement la détection interuniversitaire du plagiat. Ce service nécessiterait une gouvernance interuniversitaire et un cadre juridique approprié, mais son impact sur la visibilité de la recherche congolaise serait considérable."),
    H3("Détection interuniversitaire du plagiat"),
    P_body("Enfin, le service le plus stratégique est la détection interuniversitaire du plagiat, qui consiste à comparer un travail soumis dans une université donnée à l'ensemble des travaux déposés dans toutes les universités partenaires. Cette fonctionnalité, rendue possible par l'architecture multicouche de la plateforme (voir Chapitre III, section III.7), permettrait de détecter les cas où un étudiant soumet le même travail, ou une version modifiée, dans plusieurs établissements. Elle constituerait un saut qualitatif majeur dans la lutte contre le plagiat académique en RDC, et positionnerait la plateforme comme une infrastructure nationale de référence."),
    P_body("Au-delà de ces axes, le présent travail s'inscrit dans une dynamique plus large de renforcement des capacités numériques locales et de contribution de la recherche africaine aux grands défis technologiques contemporains. La détection du plagiat académique n'est qu'un exemple des nombreux domaines où l'application des techniques modernes d'Intelligence Artificielle peut apporter des solutions pertinentes aux défis spécifiques du contexte congolais et africain. Le développement de solutions locales, adaptées, maîtrisées et évolutives, constitue une alternative nécessaire à la dépendance technologique extérieure, et participe à la construction d'une souveraineté numérique nationale. La phase de conception achevée dans le cadre de ce mémoire pose les fondations solides sur lesquelles s'appuieront les prochaines étapes de développement, d'expérimentation et de déploiement de la plateforme."),
    new Paragraph({ children: [new PageBreak()] }),

    // ============================================================
    // BIBLIOGRAPHIE
    // ============================================================
    H1("BIBLIOGRAPHIE"),

    H2("Ouvrages et manuels"),
    P_body("Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. arXiv preprint arXiv:1810.04805.", { }),
    P_body("Goodfellow, I., Bengio, Y., & Courville, A. (2016). Deep Learning. MIT Press."),
    P_body("Jurafsky, D., & Martin, J. H. (2024). Speech and Language Processing (3rd ed., draft). https://web.stanford.edu/~jurafsky/slp3/"),
    P_body("Mikolov, T., Sutskever, I., Chen, K., Corrado, G., & Dean, J. (2013). Distributed Representations of Words and Phrases and their Compositionality. Advances in Neural Information Processing Systems, 26."),
    P_body("Pennington, J., Socher, R., & Manning, C. D. (2014). GloVe: Global Vectors for Word Representation. Proceedings of the 2014 Conference on Empirical Methods in Natural Language Processing (EMNLP), 1532–1543."),
    P_body("Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks. Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing (EMNLP), 3982–3992."),
    P_body("Sutton, R. S., & Barto, A. G. (2018). Reinforcement Learning: An Introduction (2nd ed.). MIT Press."),
    P_body("Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, L., & Polosukhin, I. (2017). Attention Is All You Need. Advances in Neural Information Processing Systems, 30."),

    H2("Articles et publications scientifiques"),
    P_body("Agarwal, B., et al. (2023). Detecting AI-Generated Text: Factors Influencing Human Accuracy. arXiv preprint arXiv:2306.03229."),
    P_body("Bensalem, I., et al. (2019). Plagiarism Detection in Academic Writings: A Systematic Review. Computing Reviews."),
    P_body("Gipp, B., & Beel, J. (2010). Citation Pattern Matching Algorithms for Citation-based Plagiarism Detection. Proceedings of the 5th International Plagiarism Conference."),
    P_body("Potthast, M., et al. (2010). Overview of the 1st International Competition on Plagiarism Detection. SEPLN."),
    P_body("Stein, B., & zu Eissen, S. M. (2006). Near Similarity Search and Plagiarism Analysis. Studies in Classification, Data Analysis, and Knowledge Organization."),
    P_body("Weber-Wulff, D. (2014). False Positives in Plagiarism Detection. Plagiarism Across Europe and Beyond Conference Proceedings."),

    H2("Documentation technique"),
    P_body("FastAPI Documentation. https://fastapi.tiangolo.com/"),
    P_body("pgvector: Open-source vector similarity search for PostgreSQL. https://github.com/pgvector/pgvector"),
    P_body("PostgreSQL Documentation (version 16). https://www.postgresql.org/docs/16/"),
    P_body("React Documentation. https://react.dev/"),
    P_body("Sentence-Transformers Documentation. https://www.sbert.net/"),
    P_body("Tesseract OCR Documentation. https://tesseract-ocr.github.io/"),
    P_body("spaCy Industrial-Strength Natural Language Processing. https://spacy.io/"),
    P_body("Docker Documentation. https://docs.docker.com/"),

    H2("Sources académiques et institutionnelles"),
    P_body("Université de Kinshasa. (2023). Règlement intérieur de la Faculté des Sciences."),
    P_body("UNESCO. (2023). L'éthique de l'intelligence artificielle. Recommandations."),
    P_body("Ministère de l'Enseignement Supérieur et Universitaire de la RDC. (2022). Cadre normatif des études supérieures."),

    H2("Ressources en ligne"),
    P_body("Copy, Shake, and Paste Blog. https://copy-shake-paste.blogspot.com/ (consulté en 2024)."),
    P_body("Hugging Face Model Hub. https://huggingface.co/models (consulté en 2024)."),
    P_body("PAN: Plagiarism, Authorship, and Social Software Misuse. https://pan.webis.de/ (consulté en 2024)."),
  ];
}

function buildBibliographie(h) {
  // Bibliographie déjà intégrée dans buildConclusion
  return [];
}

module.exports = { buildConclusion, buildBibliographie };
