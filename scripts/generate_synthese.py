#!/usr/bin/env python3
"""
Synthèse du Mémoire de DEA — Version optimisée pour exposé oral.
3 pages A4, mise en page aérée, points clés mis en évidence.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

OUTPUT_PATH = "/home/z/my-project/download/Synthese_Memoire_DEA_KASOMBO.pdf"

# Couleurs
C_PRIMARY = HexColor("#0F3D2E")
C_ACCENT = HexColor("#059669")
C_BODY = HexColor("#1e293b")
C_LIGHT = HexColor("#64748b")
C_BG_LIGHT = HexColor("#f0fdf4")
C_BG_HIGHLIGHT = HexColor("#fef3c7")
C_BORDER = HexColor("#e2e8f0")

# Fonts
try:
    pdfmetrics.registerFont(TTFont('Sans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('Sans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Sans-Italic', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'))
    F, FB, FI = 'Sans', 'Sans-Bold', 'Sans-Italic'
except:
    F, FB, FI = 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'

styles = getSampleStyleSheet()

# Styles
s_title = ParagraphStyle('T', fontName=FB, fontSize=15, textColor=C_PRIMARY, alignment=TA_CENTER, spaceAfter=4, leading=18)
s_sub = ParagraphStyle('S', fontName=FI, fontSize=9, textColor=C_LIGHT, alignment=TA_CENTER, spaceAfter=8, leading=12)
s_section = ParagraphStyle('H', fontName=FB, fontSize=10.5, textColor=C_PRIMARY, spaceBefore=8, spaceAfter=3, leading=13)
s_body = ParagraphStyle('B', fontName=F, fontSize=9, textColor=C_BODY, alignment=TA_JUSTIFY, spaceAfter=4, leading=12.5)
s_bullet = ParagraphStyle('L', fontName=F, fontSize=9, textColor=C_BODY, alignment=TA_LEFT, spaceAfter=2, leading=12, leftIndent=16, bulletIndent=6)
s_highlight = ParagraphStyle('HL', fontName=F, fontSize=9, textColor=C_BODY, alignment=TA_LEFT, spaceAfter=2, leading=12, leftIndent=8)
s_small = ParagraphStyle('SM', fontName=FI, fontSize=7.5, textColor=C_LIGHT, alignment=TA_CENTER, spaceAfter=0)
s_keyword = ParagraphStyle('KW', fontName=FB, fontSize=8.5, textColor=C_ACCENT, alignment=TA_LEFT, spaceAfter=2, leading=11)

def section_bar(title):
    """Crée un titre de section avec barre colorée."""
    t = Table([[Paragraph(f'<font name="{FB}" color="#ffffff" size="10">{title}</font>', s_section)]], colWidths=[17*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_PRIMARY),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROUNDEDCORNERS', [3, 3, 3, 3]),
    ]))
    return t

def highlight_box(text):
    """Crée un encadré jaune pour les points clés."""
    t = Table([[Paragraph(text, s_highlight)]], colWidths=[16.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_BG_HIGHLIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, HexColor("#f59e0b")),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t

def info_box(title, content):
    """Crée un encadré vert clair."""
    t = Table([[Paragraph(f'<font name="{FB}" size="9" color="#0F3D2E">{title}</font><br/><font name="{F}" size="9" color="#1e293b">{content}</font>', s_highlight)]], colWidths=[16.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, C_ACCENT),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t

story = []

# ============================================================
# EN-TÊTE
# ============================================================
story.append(Paragraph("RÉPUBLIQUE DÉMOCRATIQUE DU CONGO", ParagraphStyle('H1', fontName=FB, fontSize=7.5, textColor=C_LIGHT, alignment=TA_CENTER, spaceAfter=1)))
story.append(Paragraph("Université de Kinshasa — Faculté des Sciences et Technologies", ParagraphStyle('H2', fontName=FB, fontSize=8.5, textColor=C_PRIMARY, alignment=TA_CENTER, spaceAfter=1)))
story.append(Paragraph("Département de Mathématiques et Informatique", ParagraphStyle('H3', fontName=F, fontSize=7.5, textColor=C_LIGHT, alignment=TA_CENTER, spaceAfter=6)))
story.append(HRFlowable(width="100%", thickness=1.5, color=C_ACCENT, spaceAfter=6))

story.append(Paragraph("SYNTHÈSE DU MÉMOIRE DE DEA", s_title))
story.append(Paragraph("Développement d'une plate-forme intelligente d'aide à la détection du plagiat<br/>et au choix d'un sujet de mémoire", s_sub))

# Tableau info compact
info = Table([
    [Paragraph(f'<font name="{FB}" size="8" color="#0F3D2E">Présenté par</font>', s_small),
     Paragraph(f'<font name="{F}" size="8" color="#1e293b">Moïse KASOMBO</font>', s_small),
     Paragraph(f'<font name="{FB}" size="8" color="#0F3D2E">Encadré par</font>', s_small),
     Paragraph(f'<font name="{F}" size="8" color="#1e293b">Prof. MABELA ROSTIN</font>', s_small)],
], colWidths=[2.8*cm, 4.2*cm, 2.8*cm, 7.2*cm])
info.setStyle(TableStyle([
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('LINEBELOW', (0, 0), (-1, -1), 0.3, C_BORDER),
]))
story.append(info)
story.append(Spacer(1, 6))

# ============================================================
# 1. DESCRIPTION SOMMAIRE
# ============================================================
story.append(section_bar("1. Description sommaire"))
story.append(Spacer(1, 3))
story.append(Paragraph(
    "Ce travail consiste à développer une <b>plate-forme intelligente</b> combinant deux services IA complémentaires "
    "pour la <b>Faculté des Sciences et Technologies de l'UNIKIN</b> :", s_body))
story.append(Paragraph(f'• <b>Service 1 — Détection du plagiat</b> : moteur TF-IDF + similarité cosinus identifiant les copier-coller, paraphrases et reformulations dans les travaux académiques.', s_bullet))
story.append(Paragraph(f'• <b>Service 2 — Recommandation de sujets</b> : analyse du corpus existant pour éviter les doublons et suggérer des thématiques sous-exploitées.', s_bullet))
story.append(Paragraph(f'• <b>Back-office complet</b> : gestion des facultés, départements, utilisateurs et documents sans toucher au code source.', s_bullet))

# ============================================================
# 2. PROBLÉMATIQUE
# ============================================================
story.append(section_bar("2. Problématique"))
story.append(Spacer(1, 3))
story.append(Paragraph(
    "Le plagiat académique a explosé avec <b>Internet</b> et les <b>IA génératives</b> (ChatGPT). À l'UNIKIN :", s_body))
story.append(Paragraph(f'• <b>Aucun système</b> de gestion et contrôle des TFC/mémoires', s_bullet))
story.append(Paragraph(f'• <b>Archivage dispersé</b>, sans indexation ni comparaison automatique', s_bullet))
story.append(Paragraph(f'• <b>Choix de sujets</b> : étudiants sans référentiel des travaux antérieurs → doublons fréquents', s_bullet))
story.append(Paragraph(f'• <b>Outils commerciaux</b> (Turnitin) : coûteux, serveurs étrangers, non adaptés au contexte local', s_bullet))
story.append(Spacer(1, 3))
story.append(highlight_box(
    f'<b><font name="{FB}" color="#92400e">Question centrale :</font></b> '
    f'Comment concevoir une solution locale, intelligente et modulaire, capable à la fois de '
    f'<b>détecter le plagiat</b> et d\'<b>assister le choix des sujets</b> de mémoire ?'
))

# ============================================================
# 3. OBJECTIFS
# ============================================================
story.append(section_bar("3. Objectifs (général et spécifiques)"))
story.append(Spacer(1, 3))
story.append(info_box(
    "Objectif général",
    "Concevoir une plate-forme web intelligente, fondée sur l'IA, capable d'aider à la détection du plagiat "
    "et d'assister le choix d'un sujet de mémoire, avec une architecture modulaire extensible."
))
story.append(Spacer(1, 3))
story.append(Paragraph(f'<b><font name="{FB}" color="#0F3D2E">Objectifs spécifiques :</font></b>', s_keyword))
objs = [
    "<b>Moteur IA</b> de détection du plagiat (TF-IDF + cosinus, classification en 5 types)",
    "<b>Module de recommandation</b> de sujets (analyse thématique, détection de doublons)",
    "<b>Back-office admin</b> complet (gestion facultés, départements, users, documents)",
    "<b>Rapports PDF</b> automatiques pour enseignants et jurys",
    "<b>Évaluation quantitative</b> des performances (précision, rappel, F1-score)",
]
for o in objs:
    story.append(Paragraph(f'• {o}', s_bullet))

# ============================================================
# 4. HYPOTHÈSE
# ============================================================
story.append(section_bar("4. Hypothèse"))
story.append(Spacer(1, 3))
story.append(highlight_box(
    f'La plate-forme fondée sur <b>TF-IDF + similarité cosinus</b> permettrait de détecter efficacement '
    f'le plagiat par paraphrase, tout en offrant une <b>assistance pertinente</b> au choix des sujets. '
    f'L\'<b>absence de faux positifs</b> sur les documents originaux validerait l\'approche.'
))

# ============================================================
# 5. MÉTHODE ET TECHNIQUE
# ============================================================
story.append(section_bar("5. Méthode et technique utilisée"))
story.append(Spacer(1, 3))
# Tableau 2 colonnes : Méthodes | Stack technique
method_data = [
    [Paragraph(f'<font name="{FB}" size="9" color="#ffffff">Méthodologie</font>', s_small),
     Paragraph(f'<font name="{FB}" size="9" color="#ffffff">Stack technique</font>', s_small)],
    [Paragraph(
        f'<font name="{F}" size="8.5">'
        f'• <b>Merise</b> : modélisation SI<br/>'
        f'• <b>CRISP-DM</b> : démarche data science<br/>'
        f'• <b>UML</b> : conception orientée objet<br/>'
        f'• <b>Interview</b>, <b>observation</b>, <b>documentaire</b>, <b>expérimentation</b>'
        f'</font>', s_highlight),
     Paragraph(
        f'<font name="{F}" size="8.5">'
        f'• <b>Next.js 16</b> + React + TypeScript<br/>'
        f'• <b>TF-IDF</b> natif + cosinus + Jaccard<br/>'
        f'• <b>JWT</b> (auth) + <b>Zod</b> (validation)<br/>'
        f'• <b>PostgreSQL + pgvector</b> (production)<br/>'
        f'• <b>Tesseract OCR</b> (PDF scannés)<br/>'
        f'• <b>API fédératrice</b> interuniversitaire'
        f'</font>', s_highlight)],
]
method_table = Table(method_data, colWidths=[8.25*cm, 8.25*cm])
method_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
    ('BACKGROUND', (0, 1), (-1, 1), HexColor("#f8fafc")),
    ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, C_BORDER),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
story.append(method_table)

# ============================================================
# 6. PRINCIPAUX RÉSULTATS
# ============================================================
story.append(section_bar("6. Principaux résultats obtenus"))
story.append(Spacer(1, 3))
story.append(Paragraph(
    "Évaluation sur un corpus pilote de <b>13 documents</b> (6 originaux, 4 sources plagiées, 2 paraphrases, 1 copier-coller) :", s_body))

# Tableau résultats compact
results_data = [
    ['Métrique', 'Moteur IA (TF-IDF)', 'Baseline (Jaccard)'],
    ['Précision', '87,5%', '87,5%'],
    ['Rappel', '100,0%', '100,0%'],
    ['F1-score', '93,3%', '93,3%'],
    ['Exactitude', '92,3%', '92,3%'],
]
rt = Table(results_data, colWidths=[4*cm, 6.5*cm, 6*cm])
rt.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, 0), FB),
    ('FONTNAME', (0, 1), (-1, -1), F),
    ('FONTSIZE', (0, 0), (-1, -1), 8.5),
    ('BACKGROUND', (0, 0), (-1, 0), C_ACCENT),
    ('TEXTCOLOR', (0, 0), (-1, 0), HexColor("#ffffff")),
    ('TEXTCOLOR', (0, 1), (-1, -1), C_BODY),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.3, C_BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor("#f8fafc"), HexColor("#ffffff")]),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
]))
story.append(rt)
story.append(Spacer(1, 4))
story.append(Paragraph(f'• Document plagiat : <b>77,8%</b> de similarité (2/2 segments détectés)', s_bullet))
story.append(Paragraph(f'• Document original : <b>0%</b> — <b>aucun faux positif</b>', s_bullet))
story.append(Paragraph(f'• Temps de traitement : <b>1 milliseconde</b> par document', s_bullet))
story.append(Paragraph(f'• Module recommandation : sujets proches <b>correctement identifiés</b>, thématiques sous-exploitées suggérées', s_bullet))
story.append(Paragraph(f'• Plate-forme : <b>13 pages admin</b>, <b>19 routes API</b>, <b>5 000 lignes</b> de code sur <b>GitHub</b>', s_bullet))

# ============================================================
# 7. CONCLUSION ET PERSPECTIVES
# ============================================================
story.append(section_bar("7. Conclusion et perspectives"))
story.append(Spacer(1, 3))
story.append(Paragraph(
    "Ce travail a abouti à une <b>plate-forme intelligente opérationnelle</b> intégrant deux services IA : "
    "détection du plagiat et recommandation de sujets. Les résultats (<b>F1 = 93,3%</b>, <b>rappel = 100%</b>) "
    "valident l'hypothèse et démontrent la pertinence de l'approche pour le contexte académique congolais.",
    s_body))
story.append(Spacer(1, 2))
story.append(Paragraph(f'<b><font name="{FB}" color="#0F3D2E">Perspectives :</font></b>', s_keyword))
perspectives = [
    "Intégration de <b>Sentence-BERT</b> multilingue pour une similarité sémantique plus profonde",
    "Détection du <b>plagiat par IA générative</b> (ChatGPT) via classificateurs stylométriques",
    "Déploiement sur <b>PostgreSQL + pgvector</b> pour la production",
    "Extension à d'<b>autres facultés</b> de l'UNIKIN puis à d'autres universités congolaises",
    "Constitution d'un <b>index national</b> des mémoires pour la détection interuniversitaire",
]
for p in perspectives:
    story.append(Paragraph(f'• {p}', s_bullet))

# Pied de page
story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.5, color=C_LIGHT, spaceAfter=3))
story.append(Paragraph(
    "Dépôt GitHub : https://github.com/AlterEgo095/DPATA — Kinshasa, 2025-2026",
    s_small
))

# ============================================================
# GÉNÉRATION
# ============================================================
doc = SimpleDocTemplate(
    OUTPUT_PATH, pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=1.3*cm, bottomMargin=1.3*cm,
    title="Synthèse du Mémoire de DEA — Moïse KASOMBO",
    author="Moïse KASOMBO",
)
doc.build(story)
print(f"✅ Document généré : {OUTPUT_PATH}")
print(f"   Taille : {os.path.getsize(OUTPUT_PATH) / 1024:.1f} Ko")
