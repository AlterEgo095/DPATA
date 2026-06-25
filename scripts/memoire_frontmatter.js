// memoire_frontmatter.js - Pages liminaires : Épigraphe, Dédicace, Avant-propos, Listes
const { Paragraph, PageBreak, TextRun, AlignmentType } = require("docx");

function buildFrontMatter(h) {
  const { H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable } = h;
  return [
    // ============================================================
    // ÉPIGRAPHE
    // ============================================================
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 3600, after: 600, line: 480 },
      children: [new TextRun({
        text: "ÉPIGRAPHE",
        bold: true, size: 36, color: "000000",
        font: { ascii: "Times New Roman", eastAsia: "SimHei" },
      })],
    }),
    new Paragraph({ spacing: { after: 800 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, line: 400 },
      children: [new TextRun({
        text: "« Il n'y a pas de raccourci pour atteindre le sommet,",
        italics: true, size: 28, color: "333333",
        font: { ascii: "Times New Roman", eastAsia: "SimSun" },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, line: 400 },
      children: [new TextRun({
        text: "mais il y a qu'un ressort qui est le sacrifice ».",
        italics: true, size: 28, color: "333333",
        font: { ascii: "Times New Roman", eastAsia: "SimSun" },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200, line: 360 },
      children: [new TextRun({
        text: "— Westlepenseur",
        size: 24, color: "666666",
        font: { ascii: "Times New Roman", eastAsia: "SimSun" },
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),

    // ============================================================
    // DÉDICACE
    // ============================================================
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 800, line: 480 },
      children: [new TextRun({
        text: "DÉDICACE",
        bold: true, size: 36, color: "000000",
        font: { ascii: "Times New Roman", eastAsia: "SimHei" },
      })],
    }),
    P_body("À Dieu tout puissant, pour le souffle de vie, l'intelligence et la sagesse, vos précieux dons que je ne cesserai d'implorer de me gratifier,"),
    P_body("À mon père chéri Damien TSHIBANGU TSHA SHIBAY et à ma très chère mère Thérèse NGOMBA MWAMBA, qui se sont donnés beaucoup de peines, en me soutenant totalement,"),
    P_body("À mes frères et sœurs,"),
    P_body("À mes oncles et tantes,"),
    P_body("À mes cousins et cousines,"),
    P_body("À tous ceux de près ou de loin m'ont aidé."),
    P_body("Je vous dédie ce travail en particulier à ma très chère mère qui ne sait pas fatiguer de m'encourager."),
    new Paragraph({ children: [new PageBreak()] }),

    // ============================================================
    // AVANT-PROPOS
    // ============================================================
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 600, line: 480 },
      children: [new TextRun({
        text: "AVANT-PROPOS",
        bold: true, size: 36, color: "000000",
        font: { ascii: "Times New Roman", eastAsia: "SimHei" },
      })],
    }),
    P_body("Ce travail sanctionne la fin du deuxième cycle, cycle de spécialisation en vue de l'obtention du grade d'Ingénieur à l'Université de Kinshasa, plus particulièrement à la Faculté des Sciences et Technologies au Département de Mathématiques et Informatique. De ce fait, qu'il nous soit permis d'exprimer notre gratitude à tous ceux qui de loin ou de près nous ont assistés tant moralement que matériellement dans l'élaboration de ce travail."),
    P_body("Nos plus grands remerciements vont à l'endroit du Professeur MABELA ROSTIN qui a accepté de diriger ce travail depuis l'imagination de l'auteur jusqu'à la réalisation de cette œuvre avec un maximum d'attention, et cela malgré ses nombreuses occupations."),
    P_body("Nos remerciements s'adressent également à tous les professeurs de la Faculté des Sciences et Technologies, en particuliers du Département de Mathématiques et Informatique, pour leurs enseignements de qualité dont nous sommes bénéficiaires aujourd'hui."),
    P_body("Nous nous souvenons de tous nos compagnons de lutte et collègues : JOEL KISASA WINAS, NATHAN LUSANGA, SERGE NGANGU KAHUSU, DJODJO LUYINDULA MAVAMBU, ERIC MOKE ZONO, JEAN DE DIEU NSIMBA, qui ont partagé la même vivacité que moi."),
    P_body("Nos remerciements s'adressent aussi à :"),
    P_bullet("Notre père Damien TSHIBANGU SHA-TSHIBAY et à notre mère Thérèse NGOMBA MWAMBA pour m'avoir inculqué cette vérité que dans les études il y a un trésor caché ;"),
    P_bullet("Mes frères EMMANUEL KAZADI TSIBANGU, AARON MWAMBA TSHIBANGU, JOSEPH MUSASA TSHIBANGU, ELIE TSHIBANGU ;"),
    P_bullet("Mes cousins et cousines Olivier Ilunga, Nathan Ilunga Kazadi, Glody Ilunga Kazadi, Manace, Kerene Musasa, Nicklette Kabeya ;"),
    P_bullet("Mes oncles et tante : oncle Elie Tshibanda, oncle Samba, oncle Laurent, oncle Patrick, tantine Yvonne Musasa, tantine Angèle, tantine Julie ;"),
    P_bullet("Les amis et connaissances : Jérôme Samine, Alphonse Kabasele, Jean Jacques Lukusa, Christian Batiya Di Umba, Ben Tshikoji, Cedrick Nkonde."),
    new Paragraph({ children: [new PageBreak()] }),

    // ============================================================
    // LISTE DES FIGURES
    // ============================================================
    H1("LISTE DES FIGURES"),
    ...threeLineTable(
      ["Figure", "Désignation"],
      [
        ["Figure III.1", "Architecture multicouche universitaire de la plateforme"],
        ["Figure IV.1", "Page de connexion de la plateforme PlagiatIA"],
        ["Figure IV.2", "Tableau de bord administrateur principal"],
        ["Figure IV.3", "Gestion des facultés (CRUD complet)"],
        ["Figure IV.4", "Liste des travaux académiques déposés"],
        ["Figure IV.5", "Page de supervision des analyses IA"],
        ["Figure IV.6", "Page de détail d'un document avec résultats d'analyse IA"],
        ["Figure IV.7", "Rapport PDF imprimable généré automatiquement"],
        ["Figure IV.8", "Comparaison des métriques de performance"],
        ["Figure IV.9", "Matrices de confusion des deux approches"],
      ],
      ""
    ),
    new Paragraph({ children: [new PageBreak()] }),

    // ============================================================
    // LISTE DES TABLEAUX
    // ============================================================
    H1("LISTE DES TABLEAUX"),
    ...threeLineTable(
      ["Tableau", "Désignation"],
      [
        ["Tableau I.1", "Principaux modèles d'embeddings vectoriels"],
        ["Tableau I.2", "Évolution des approches de détection automatique du plagiat"],
        ["Tableau II.1", "Typologie des principaux types de plagiat académique"],
        ["Tableau II.2", "Comparaison entre plateformes anti-plagiat existantes et solution proposée"],
        ["Tableau III.1", "Exigences non fonctionnelles de la plateforme"],
        ["Tableau III.2", "Modules fonctionnels de la plateforme"],
        ["Tableau III.3", "Responsabilités par couche de l'architecture multicouche"],
        ["Tableau III.4", "Principaux endpoints de l'API REST"],
        ["Tableau IV.1", "Stack technique effectivement mise en œuvre"],
        ["Tableau IV.2", "Composition du corpus pilote étendu"],
        ["Tableau IV.3", "Résultats de l'évaluation quantitative (13 documents)"],
        ["Tableau IV.4", "Résultats détaillés par document"],
        ["Tableau IV.5", "Détail des correspondances détectées"],
        ["Tableau IV.6", "Performances mesurées sur l'environnement de démonstration"],
      ],
      ""
    ),
    new Paragraph({ children: [new PageBreak()] }),

    // ============================================================
    // LISTE DES ABRÉVIATIONS
    // ============================================================
    H1("LISTE DES ABRÉVIATIONS"),
    ...threeLineTable(
      ["Abréviation", "Désignation"],
      [
        ["AI / IA", "Artificial Intelligence / Intelligence Artificielle"],
        ["API", "Application Programming Interface"],
        ["AUC", "Area Under the Curve"],
        ["BERT", "Bidirectional Encoder Representations from Transformers"],
        ["CRISP-DM", "Cross-Industry Standard Process for Data Mining"],
        ["DL", "Deep Learning"],
        ["JWT", "JSON Web Token"],
        ["ML", "Machine Learning"],
        ["MLD", "Modèle Logique des Données"],
        ["NLP / TALN", "Natural Language Processing / Traitement Automatique du Langage Naturel"],
        ["OCR", "Optical Character Recognition"],
        ["RBAC", "Role-Based Access Control"],
        ["REST", "Representational State Transfer"],
        ["SBERT", "Sentence-BERT"],
        ["TF-IDF", "Term Frequency - Inverse Document Frequency"],
        ["TFC", "Travail de Fin de Cycle"],
        ["TFE", "Travail de Fin d'Études"],
        ["TTR", "Type-Token Ratio"],
        ["UML", "Unified Modeling Language"],
        ["UNIKIN", "Université de Kinshasa"],
      ],
      ""
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

module.exports = { buildFrontMatter };
