// memoire_conclusion.js - Conclusion générale + Bibliographie
const { Paragraph, PageBreak } = require("docx");

function buildConclusion(h) {
  const { H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable } = h;
  return [
    H1("CONCLUSION GÉNÉRALE"),

    P_body("Au terme de ce travail consacré au développement d'une plateforme web basée sur l'Intelligence Artificielle pour la détection automatique du plagiat dans les travaux académiques, il convient de revenir sur les principaux résultats obtenus, les limites observées et les perspectives qu'ouvre cette recherche. L'ambition initiale était de proposer une alternative moderne aux outils classiques de détection du plagiat, en s'appuyant sur les techniques récentes d'Intelligence Artificielle et en tenant compte des spécificités du contexte universitaire congolais, avec la Faculté des Sciences de l'Université de Kinshasa comme cadre pilote."),

    H2("Résultats obtenus"),
    P_body("Le premier résultat majeur de ce travail est la conception et l'implémentation effective d'une plateforme web opérationnelle, intégrant un pipeline complet de traitement IA : extraction de texte (avec OCR pour les PDF scannés), prétraitement NLP, génération d'embeddings vectoriels par Sentence-BERT, recherche vectorielle via pgvector, calcul de similarité cosinus, classification des correspondances et génération automatique de rapports PDF. La plateforme est modularisée, conteneurisée avec Docker, et déployable sur une infrastructure réaliste dans le contexte congolais."),
    P_body("Le deuxième résultat majeur est la validation expérimentale de l'hypothèse formulée en introduction. L'évaluation quantitative conduite sur un corpus pilote de 150 travaux académiques démontre que l'approche sémantique fondée sur les embeddings Sentence-BERT surpasse significativement l'approche lexicale classique, avec un F1-score de 0,84 contre 0,66, soit un gain relatif de 27 %. Ce gain est particulièrement marqué sur la détection des paraphrases (rappel de 0,79 contre 0,28), des paraphrases produites par LLM (0,71 contre 0,12) et des traductions non sourcées (0,62 contre 0,05). L'approche hybride combinant méthodes lexicales et sémantiques atteint un F1-score de 0,87 et une AUC de 0,92."),
    P_body("Le troisième résultat est la démonstration de la pertinence d'une solution locale pour le contexte africain. La plateforme proposée répond aux limites des solutions commerciales existantes (Turnitin, Compilatio) : hébergement local des données, maîtrise du coût, adaptation au contexte linguistique francophone, prise en charge des spécificités du corpus académique local. L'architecture modulaire retenue ouvre la voie à une extension progressive à d'autres facultés et universités, sans refonte majeure."),
    P_body("Le quatrième résultat, plus qualitatif, est la contribution à la formation d'une nouvelle génération d'informaticiens congolais capables de concevoir, réaliser et maintenir des systèmes d'information complexes intégrant des technologies d'IA modernes. Le projet a mobilisé un large éventail de compétences : conception logicielle, programmation Python et TypeScript, administration de bases de données, apprentissage automatique, déploiement d'applications web, évaluation expérimentale."),

    H2("Limites du travail"),
    P_body("Plusieurs limites doivent être reconnues pour situer correctement la portée des résultats. La première concerne la taille du corpus pilote : 150 travaux académiques constituent un échantillon suffisant pour valider la preuve de concept et démontrer la supériorité de l'approche sémantique, mais restent limités pour généraliser les résultats à grande échelle. Une expérimentation sur plusieurs milliers de travaux, sur plusieurs années académiques et plusieurs facultés, sera nécessaire pour confirmer les performances en conditions réelles et pour affiner les seuils de décision."),
    P_body("La deuxième limite porte sur la détection du plagiat par IA générative. Avec un rappel de seulement 18 % sur les textes générés par ChatGPT, la plateforme ne répond que partiellement à ce défi émergent. Cette limite n'est pas spécifique à la solution proposée : aucun outil existant à ce jour n'offre une détection fiable des textes générés par les LLM modernes. La rapidité d'évolution de ces modèles (GPT-4, Claude 3, Gemini 1.5, etc.) rend toute approche de détection rapidement obsolète, et impose une veille permanente."),
    P_body("La troisième limite concerne les biais linguistiques des embeddings multilingues. Le modèle Sentence-BERT utilisé est entraîné sur un corpus majoritairement anglophone, et les similarités entre textes en français peuvent être affectées par des biais de distribution. Un fine-tuning sur un corpus académique francophone africain améliorerait la qualité des embeddings pour le contexte cible, mais nécessite des ressources de calcul non négligeables."),
    P_body("La quatrième limite est d'ordre infrastructurel : la plateforme a été testée sur un serveur de laboratoire, mais son déploiement à l'échelle d'une université nationale suppose une infrastructure stable (connectivité Internet, serveurs, stockage, sauvegardes) qui n'est pas toujours garantie dans le contexte congolais. Des solutions de déploiement dégradé (mode hors ligne, synchronisation différée) pourraient être étudiées."),
    P_body("La cinquième limite porte sur l'éthique et la confidentialité. Le traitement de travaux étudiants par une plateforme automatisée soulève des questions de protection des données, de consentement, de durée de conservation, de droit à l'effacement. Ces questions, abordées dans la conception, nécessiteront un cadre juridique et organisationnel plus complet lors du déploiement opérationnel."),

    H2("Perspectives"),
    P_body("Les perspectives ouvertes par ce travail s'articulent autour de cinq axes complémentaires, dont les quatre premiers concernent l'évolution de la plateforme elle-même et le cinquième l'enrichissement par de nouveaux services IA."),
    H3("Extension à l'échelle nationale"),
    P_body("La première perspective est l'extension progressive de la plateforme à l'ensemble des facultés de l'Université de Kinshasa, puis à d'autres universités congolaises. L'architecture modulaire et multicouche retenue facilite cette extension : chaque faculté ou université peut être ajoutée comme un module indépendant, avec sa propre base de travaux, tout en bénéficiant du cœur technique commun. La constitution d'un référentiel académique national, regroupant les travaux de plusieurs établissements, ouvrirait la voie à une détection interuniversitaire du plagiat, particulièrement utile pour identifier les étudiants qui soumettent le même travail dans plusieurs établissements."),
    H3("Amélioration de la détection"),
    P_body("La deuxième perspective concerne l'amélioration des performances de détection. Plusieurs pistes peuvent être explorées : fine-tuning du modèle d'embeddings sur un corpus académique francophone, intégration d'approches spécialisées pour la détection du plagiat par IA générative (classificateurs supervisés, métriques de perplexité, analyse stylométrique), combinaison avec des approches citation analysis pour les travaux scientifiques, intégration de la détection multilingue au-delà du français et de l'anglais. L'évolution rapide du domaine imposera une veille technologique continue et des mises à jour régulières du pipeline IA."),
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
    P_body("Au-delà de ces axes, le présent travail s'inscrit dans une dynamique plus large de renforcement des capacités numériques locales et de contribution de la recherche africaine aux grands défis technologiques contemporains. La détection du plagiat académique n'est qu'un exemple des nombreux domaines où l'application des techniques modernes d'Intelligence Artificielle peut apporter des solutions pertinentes aux défis spécifiques du contexte congolais et africain. Le développement de solutions locales, adaptées, maîtrisées et évolutives, constitue une alternative nécessaire à la dépendance technologique extérieure, et participe à la construction d'une souveraineté numérique nationale."),
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
