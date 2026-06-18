// Générateur du mémoire recadré
// Sujet : Développement d'une plateforme web IA pour la détection du plagiat
// Auteur : Moïse Kasombo
// Cas pilote : Faculté des Sciences, Université de Kinshasa

const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, NumberFormat,
  SectionType, PageBreak, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, TabStopType,
  TableOfContents, StyleLevel, LevelFormat, Break,
} = require("docx");
const fs = require("fs");
const path = require("path");

// =========================================================================
// PALETTE & CONFIG
// =========================================================================
const P = {
  primary: "000000",   // titre / H1
  body: "000000",      // corps pur noir (academic)
  secondary: "333333", // header / caption
  accent: "8B7E5A",    // ligne décorative cover only
  surface: "F5F7FA",   // fond table header (trois lignes)
};
const FONT_BODY = { ascii: "Times New Roman", eastAsia: "SimSun" };
const FONT_HEAD = { ascii: "Times New Roman", eastAsia: "SimHei" };
const NB = { style: BorderStyle.NONE };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

function safeText(v, ph) {
  if (v === undefined || v === null || v === "" || String(v) === "NaN" || String(v) === "undefined") {
    return ph || "【à compléter】";
  }
  return String(v);
}

// =========================================================================
// HELPERS PARAGRAPHES
// =========================================================================
function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360, line: 360 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: FONT_HEAD })],
  });
}
function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 240, line: 360 },
    children: [new TextRun({ text, bold: true, size: 30, color: P.primary, font: FONT_HEAD })],
  });
}
function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120, line: 360 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: FONT_HEAD })],
  });
}
function P_body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 360, after: 0 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT_BODY, ...opts })],
  });
}
function P_quote(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 720, right: 720 },
    spacing: { line: 360, before: 120, after: 120 },
    children: [new TextRun({ text, size: 22, italics: true, color: P.secondary, font: FONT_BODY })],
  });
}
function P_bullet(text, level = 0) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 720 + level * 360, hanging: 360 },
    spacing: { line: 360, after: 60 },
    children: [
      new TextRun({ text: "•  ", size: 24, color: P.body, font: FONT_BODY }),
      new TextRun({ text, size: 24, color: P.body, font: FONT_BODY }),
    ],
  });
}
function P_caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200, line: 280 },
    children: [new TextRun({ text, size: 21, italics: true, color: P.secondary, font: FONT_BODY })],
  });
}
function P_centered(text, bold = false, size = 24) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, after: 120 },
    children: [new TextRun({ text, bold, size, color: P.body, font: bold ? FONT_HEAD : FONT_BODY })],
  });
}
function P_empty() {
  return new Paragraph({ spacing: { line: 360 }, children: [] });
}

// =========================================================================
// TABLE TROIS LIGNES
// =========================================================================
function threeLineTable(headers, rows, captionText) {
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map(h => new TableCell({
      borders: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" }, top: NB, left: NB, right: NB },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: h, bold: true, size: 21, color: P.primary, font: FONT_BODY })],
      })],
    })),
  });
  const dataRows = rows.map((row, idx) => new TableRow({
    cantSplit: true,
    children: row.map(cell => new TableCell({
      borders: { top: NB, bottom: NB, left: NB, right: NB },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: 300 },
        children: [new TextRun({ text: String(cell), size: 21, color: P.body, font: FONT_BODY })],
      })],
    })),
  }));
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: NB, right: NB, insideHorizontal: NB, insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
  const parts = [];
  if (captionText) parts.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 120, after: 60, line: 280 },
    children: [new TextRun({ text: captionText, size: 21, italics: true, color: P.secondary, font: FONT_BODY })],
  }));
  parts.push(table);
  parts.push(P_empty());
  return parts;
}

// =========================================================================
// COVER ACADEMIQUE
// =========================================================================
function buildCover() {
  const infoRows = [
    ["Présenté par", "Moïse KASOMBO"],
    ["Travail de Fin d'Études", "Mémoire de Licence"],
    ["Département", "Mathématiques et Informatique"],
    ["Encadré par", "【Professeur encadreur】"],
    ["Cas pilote", "Faculté des Sciences — UNIKIN"],
    ["Année académique", "【2024 - 2025】"],
  ];
  const infoTable = new Table({
    width: { size: 70, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: allNoBorders,
    rows: infoRows.map(([label, value]) => new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          borders: { bottom: NB, top: NB, left: NB, right: NB },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: label + " :", size: 26, bold: true, color: P.primary, font: FONT_HEAD })],
          })],
        }),
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" }, top: NB, left: NB, right: NB },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: value, size: 26, color: P.body, font: FONT_BODY })],
          })],
        }),
      ],
    })),
  });

  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1400, after: 200, line: 480, lineRule: "atLeast" },
      children: [new TextRun({ text: "RÉPUBLIQUE DÉMOCRATIQUE DU CONGO", size: 28, bold: true, color: P.primary, font: FONT_HEAD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200, line: 400, lineRule: "atLeast" },
      children: [new TextRun({ text: "Université de Kinshasa", size: 36, bold: true, color: P.primary, font: FONT_HEAD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200, line: 360, lineRule: "atLeast" },
      children: [new TextRun({ text: "Faculté des Sciences", size: 32, bold: true, color: P.primary, font: FONT_HEAD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800, line: 320, lineRule: "atLeast" },
      children: [new TextRun({ text: "Département de Mathématiques et Informatique", size: 26, color: P.body, font: FONT_BODY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200, line: 320 },
      children: [new TextRun({ text: "—  Travail de Fin d'Études  —", size: 26, italics: true, color: P.secondary, font: FONT_BODY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360, line: 460, lineRule: "atLeast" },
      children: [new TextRun({ text: "Mémoire de Licence présenté en vue de l'obtention du grade de Licencié en Sciences Informatiques", size: 22, italics: true, color: P.body, font: FONT_BODY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200, line: 520, lineRule: "atLeast" },
      children: [new TextRun({ text: "Développement d'une plateforme web", size: 36, bold: true, color: P.primary, font: FONT_HEAD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200, line: 520, lineRule: "atLeast" },
      children: [new TextRun({ text: "basée sur l'Intelligence Artificielle", size: 36, bold: true, color: P.primary, font: FONT_HEAD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200, line: 520, lineRule: "atLeast" },
      children: [new TextRun({ text: "pour la détection automatique du plagiat", size: 32, bold: true, color: P.primary, font: FONT_HEAD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600, line: 520, lineRule: "atLeast" },
      children: [new TextRun({ text: "dans les travaux académiques", size: 32, bold: true, color: P.primary, font: FONT_HEAD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800, line: 360, lineRule: "atLeast" },
      children: [new TextRun({ text: "Cas pilote : Faculté des Sciences de l'Université de Kinshasa", size: 24, italics: true, color: P.secondary, font: FONT_BODY })] }),
    infoTable,
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1000, line: 320 },
      children: [new TextRun({ text: "Kinshasa, 【Année académique】", size: 26, color: P.body, font: FONT_BODY })] }),
  ];
}

// =========================================================================
// HEADER & FOOTER
// =========================================================================
function buildHeader() {
  return new Header({ children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } },
      children: [new TextRun({ text: "Mémoire de Licence — Moïse KASOMBO — UNIKIN / Faculté des Sciences",
        size: 18, color: P.secondary, italics: true, font: FONT_BODY })],
    }),
  ]});
}
function buildPageFooter() {
  return new Footer({ children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "- ", size: 21, font: FONT_BODY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 21, font: FONT_BODY }),
        new TextRun({ text: " -", size: 21, font: FONT_BODY }),
      ],
    }),
  ]});
}

// =========================================================================
// CONTENU - exporté depuis content modules
// =========================================================================
const content = require("./memoire_content.js");

// =========================================================================
// ASSEMBLAGE DOCUMENT
// =========================================================================
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: 24, color: P.body },
        paragraph: { spacing: { line: 360 } },
      },
      heading1: {
        run: { font: FONT_HEAD, size: 32, bold: true, color: P.primary },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360, line: 360 } },
      },
      heading2: {
        run: { font: FONT_HEAD, size: 30, bold: true, color: P.primary },
        paragraph: { spacing: { before: 360, after: 240, line: 360 } },
      },
      heading3: {
        run: { font: FONT_HEAD, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 360 } },
      },
    },
  },
  sections: [
    // Section 1 : Couverture (pas de numéro de page)
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } } },
      children: buildCover(),
    },
    // Section 2 : Table des matières (numéros romains)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417, header: 850, footer: 992 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      headers: { default: buildHeader() },
      footers: { default: buildPageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 480, line: 360 },
          children: [new TextRun({ text: "TABLE DES MATIÈRES", bold: true, size: 36, color: P.primary, font: FONT_HEAD })],
        }),
        new TableOfContents("Table des matières", {
          hyperlink: true,
          headingStyleRange: "1-3",
          stylesWithLevels: [
            new StyleLevel("Heading1", 1),
            new StyleLevel("Heading2", 2),
            new StyleLevel("Heading3", 3),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [new TextRun({
            text: "(Cliquez droit sur la table des matières puis « Mettre à jour les champs » pour actualiser la pagination.)",
            size: 18, italics: true, color: P.secondary, font: FONT_BODY,
          })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Section 3 : Corps (numéros arabes à partir de 1)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417, header: 850, footer: 992 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: buildHeader() },
      footers: { default: buildPageFooter() },
      children: [
        ...content.buildIntroduction({ H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable }),
        ...content.buildChapter1({ H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable }),
        ...content.buildChapter2({ H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable }),
        ...content.buildChapter3({ H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable }),
        ...content.buildChapter4({ H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable }),
        ...content.buildConclusion({ H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable }),
        ...content.buildBibliographie({ H1, H2, H3, P_body, P_quote, P_bullet, P_caption, P_centered, P_empty, threeLineTable }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  const out = "/home/z/my-project/download/Memoire_KASOMBO_recadre.docx";
  fs.writeFileSync(out, buf);
  console.log("✅ Document généré :", out);
  console.log("   Taille :", (buf.length / 1024).toFixed(1), "Ko");
}).catch(err => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});
