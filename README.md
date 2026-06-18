# 🛡️ PlagiatIA — Plateforme Web IA de Détection du Plagiat Académique

> Plateforme universitaire intelligente de gestion et d'analyse des travaux académiques, intégrant un moteur IA de détection automatique du plagiat basé sur les embeddings vectoriels Sentence-BERT et la similarité sémantique.

**Cas pilote** : Faculté des Sciences — Université de Kinshasa (UNIKIN)
**Année académique** : 2025-2026
**Auteur** : Moïse KASOMBO

---

## 📋 Table des matières

- [Contexte du projet](#contexte-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Architecture technique](#architecture-technique)
- [Structure du projet](#structure-du-projet)
- [Installation et démarrage](#installation-et-démarrage)
- [Comptes par défaut](#comptes-par-défaut)
- [Documentation académique](#documentation-académique)
- [Roadmap](#roadmap)
- [Licence](#licence)

---

## 🎓 Contexte du projet

Ce dépôt contient l'implémentation de la plateforme décrite dans le mémoire de licence :

> **Développement d'une plateforme web basée sur l'Intelligence Artificielle pour la détection automatique du plagiat dans les travaux académiques**

Le projet ne consiste pas à développer un simple logiciel de comparaison de documents, mais à concevoir une **plateforme universitaire intelligente** capable de :

- Recevoir les travaux académiques (TFC, mémoires, thèses)
- Analyser automatiquement leur contenu via un pipeline IA
- Détecter les similitudes textuelles **et sémantiques** (paraphrases, reformulations, traductions)
- Produire des rapports détaillés destinés aux enseignants et aux jurys
- Gérer l'ensemble de l'organisation académique (facultés, départements, promotions, utilisateurs)

La plateforme est conçue selon une **architecture modulaire et multicouche** permettant son extension progressive à plusieurs facultés, départements et, à terme, à d'autres universités, sans modification du cœur de l'application.

---

## ✨ Fonctionnalités

### 👥 Gestion des utilisateurs
- Authentification sécurisée JWT (cookies httpOnly)
- Quatre rôles : Super Administrateur, Administrateur Faculté, Enseignant, Étudiant
- Gestion des permissions basée sur les rôles (RBAC)
- Profil utilisateur avec rattachement faculté/département/promotion

### 🏛️ Back-Office Administrateur
- **Gestion des facultés** : création, modification, activation/désactivation, suppression
- **Gestion des départements** : rattachement hiérarchique aux facultés
- **Gestion des promotions** : niveaux (L1, L2, L3, G1, G2, G3, Master...), années académiques
- **Gestion des utilisateurs** : étudiants, enseignants, administrateurs
- **Journal d'audit** : traçabilité complète des actions (création, modification, suppression, connexion)
- **Paramètres système** : configuration du moteur IA (seuil, modèle, périmètre)

### 📄 Gestion documentaire
- Dépôt de travaux académiques (PDF, DOCX, TXT)
- Extraction automatique du texte (avec OCR pour PDF scannés)
- Métadonnées complètes (type, sujet, encadrant, promotion, année)
- Historique et statuts (brouillon, soumis, en analyse, analysé, validé, rejeté)

### 🤖 Moteur IA de détection
- Pipeline complet en 8 étapes (soumission → extraction → NLP → embeddings → recherche vectorielle → similarité → classification → rapport)
- Modèle d'embeddings : `distiluse-base-multilingual-cased-v1` (Sentence-BERT multilingue FR/EN)
- Recherche vectorielle par similarité cosinus
- Classification des correspondances : copier-coller strict, paraphrase, reformulation, traduction, similarité faible
- Seuil configurable (par défaut 0,80)
- Périmètre configurable : faculté, département, ou inter-facultés

### 📊 Tableau de bord & statistiques
- KPIs en temps réel (facultés, départements, utilisateurs, travaux, analyses)
- Score moyen de similarité
- Répartition des travaux par faculté
- Activité récente (journal d'audit)
- État du moteur IA

---

## 🏗️ Architecture technique

### Stack technologique

| Composant | Technologie | Rôle |
|---|---|---|
| **Framework frontend** | Next.js 16 (App Router) | SSR/CSR, routing, API routes |
| **Langage** | TypeScript 5 | Typage statique |
| **UI Library** | React 18 | Composants réactifs |
| **Styling** | Tailwind CSS 4 | Design system utilitaire |
| **Composants UI** | shadcn/ui (New York) | Composants accessibles |
| **Icônes** | Lucide React | Iconographie cohérente |
| **Authentification** | jose (JWT) | Tokens signés HS256 |
| **Validation** | Zod | Validation des schémas |
| **Notifications** | Sonner | Toasts élégants |
| **State management** | TanStack Query | Cache server state |
| **Persistance** | JSON store (file-based) | Démo — production : PostgreSQL + pgvector |

### Architecture multicouche (vision universitaire)

```
┌─────────────────────────────────────────────┐
│           UNIVERSITÉ (UNIKIN)               │
└───────────────────────┬─────────────────────┘
                        │
       ┌────────────────▼────────────────┐
       │   PLATEFORME CENTRALE IA        │
       │  • Gestion utilisateurs         │
       │  • Base documentaire            │
       │  • Moteur IA anti-plagiat       │
       │  • API & Tableaux de bord       │
       └──┬──────────┬──────────┬────────┘
          │          │          │
   ┌──────▼───┐ ┌────▼────┐ ┌──▼────────┐
   │ Faculté A│ │Faculté B│ │ Faculté C │
   │ Sciences │ │  Droit  │ │ Médecine  │
   └──┬───────┘ └──┬──────┘ └────┬──────┘
      │            │             │
   ┌──▼──────┐  ┌──▼─────┐  ┌───▼─────┐
   │Départem.│  │Départem│  │Départem.│
   │  Info.  │  │ Privé  │  │ Chirurg.│
   └──┬──────┘  └──┬─────┘  └───┬─────┘
      │            │             │
   ┌──▼────────────▼─────────────▼────┐
   │ SOUMISSION DES MÉMOIRES & TFC     │
   └───────────────┬───────────────────┘
                   │
         ┌─────────▼─────────┐
         │   MOTEUR IA        │
         │  • OCR + NLP       │
         │  • Embeddings SBERT│
         │  • Recherche vect. │
         │  • Similarité      │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   RAPPORT IA       │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   JURY / ENSEIGNANT│
         └───────────────────┘
```

### Architecture logicielle (multi-tiers)

| Couche | Responsabilité | Composants |
|---|---|---|
| **Présentation** | Interface utilisateur | React + Tailwind + shadcn/ui |
| **Application** | Logique métier + API | Next.js API Routes (Route Handlers) |
| **Services IA** | Pipeline de détection | Sentence-BERT, pgvector, NLP |
| **Données** | Persistance | JSON store (démo) → PostgreSQL + pgvector (prod) |

---

## 📁 Structure du projet

```
.
├── prisma/
│   └── schema.prisma              # Schéma Prisma complet (Faculté, Département, User, Document, Analysis, Match, Embedding, AuditLog)
├── public/
│   └── uploads/                   # Fichiers téléversés (ignoré du git)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Layout racine (méta, fonts, toasters)
│   │   ├── page.tsx               # Page de connexion (branding UNIKIN)
│   │   ├── globals.css            # Styles globaux Tailwind
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts     # POST — Connexion JWT
│   │   │   │   ├── logout/route.ts    # POST — Déconnexion
│   │   │   │   └── me/route.ts        # GET — Utilisateur courant
│   │   │   ├── dashboard/
│   │   │   │   └── stats/route.ts     # GET — KPIs et statistiques
│   │   │   └── faculties/
│   │   │       ├── route.ts           # GET (liste) + POST (création)
│   │   │       └── [id]/route.ts      # GET + PUT + DELETE
│   │   └── dashboard/
│   │       ├── layout.tsx         # Layout admin (sidebar + topbar + nav RBAC)
│   │       ├── page.tsx           # Tableau de bord principal
│   │       └── faculties/page.tsx # Gestion CRUD des facultés
│   ├── components/
│   │   └── ui/                    # shadcn/ui (48 composants)
│   ├── hooks/                     # Hooks React (use-mobile, use-toast)
│   └── lib/
│       ├── auth/
│       │   └── jwt.ts             # Sign/verify JWT, cookies, RBAC
│       ├── store/
│       │   └── db.ts              # JSON store local (remplace Prisma en démo)
│       ├── db.ts                  # Prisma client (réservé production)
│       └── utils.ts               # Utilitaires (cn, formatters)
├── data/                          # DB JSON locale (ignoré du git)
├── prisma/schema.prisma           # Schéma de base de données complet
├── .env                           # Variables d'environnement (ignoré)
├── package.json                   # Dépendances et scripts
├── tailwind.config.ts             # Configuration Tailwind
├── tsconfig.json                  # Configuration TypeScript
└── README.md                      # Ce fichier
```

---

## 🚀 Installation et démarrage

### Prérequis

- **Node.js** 18+ (ou Bun 1.3+)
- **npm** ou **bun**

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/AlterEgo095/DPATA.git
cd DPATA

# 2. Installer les dépendances
npm install
# ou
bun install

# 3. Configurer les variables d'environnement
cp .env.example .env  # (créer .env avec DATABASE_URL et JWT_SECRET)

# 4. Lancer en développement
npm run dev
# ou
bun run dev

# 5. Ouvrir http://localhost:3000
```

### Variables d'environnement

Créer un fichier `.env` à la racine :

```env
# Base de données (production : PostgreSQL avec pgvector)
DATABASE_URL=file:./db/custom.db

# Secret JWT (CHANGEZ-LE EN PRODUCTION !)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Environnement
NODE_ENV=development
```

---

## 🔑 Comptes par défaut

La plateforme est initialisée avec un compte super-administrateur par défaut :

| Champ | Valeur |
|---|---|
| **Email** | `admin@unikin.ac.cd` |
| **Mot de passe** | `admin123` |
| **Rôle** | Super Administrateur |

⚠️ **En production** : changez immédiatement ce mot de passe après la première connexion via le back-office.

---

## 📚 Documentation académique

Le mémoire académique complet (61 pages, PDF + DOCX) est disponible dans le dossier `download/` (non versionné). Il contient :

- **Introduction générale** (problématique, hypothèse, méthodologie CRISP-DM + Merise)
- **Chapitre I** — Fondements de l'IA appliquée à la détection automatique du plagiat
- **Chapitre II** — État de l'art du plagiat académique et analyse des besoins
- **Chapitre III** — Conception de la plateforme web intelligente (architecture, pipeline IA, UML)
- **Conclusion générale** (acquis de la phase de conception, limites, perspectives)
- **Bibliographie** (Normes APA)

Le **Chapitre IV** (implémentation, expérimentation et évaluation) sera intégré après le développement complet de la plateforme, avec captures d'écran réelles et résultats d'évaluation quantitative.

---

## 🗺️ Roadmap

### ✅ Phase 1 — Conception (achevée)
- [x] Schéma de données complet (Prisma)
- [x] Architecture multicouche universitaire
- [x] Diagramme d'architecture professionnel
- [x] Mémoire académique (3 chapitres + conclusion intermédiaire)

### ✅ Phase 2 — Implémentation (achevée)
- [x] Authentification JWT + cookies httpOnly
- [x] Layout admin avec sidebar RBAC (4 rôles)
- [x] Page de connexion avec branding UNIKIN
- [x] Tableau de bord avec KPIs + état système + activité récente
- [x] Back-office facultés (CRUD complet)
- [x] Back-office départements (CRUD complet)
- [x] Back-office promotions (CRUD complet)
- [x] Back-office utilisateurs (étudiants, enseignants, admins)
- [x] Workflow étudiant : dépôt de travaux académiques
- [x] Workflow enseignant : consultation et validation
- [x] Moteur IA : implémentation TypeScript native (TF-IDF + similarité cosinus)
- [x] Moteur IA : classification des matches (5 types)
- [x] Moteur IA : prétraitement NLP (tokenisation, stop words FR+EN)
- [x] Génération automatique de rapports PDF (HTML imprimable)
- [x] Tableau de bord statistiques avancé (supervision admin)
- [x] Journal d'audit complet (200 entrées)
- [x] Page paramètres système
- [x] 9 captures d'écran pour le Chapitre IV

### 🔜 Phase 3 — Expérimentation (à venir)
- [ ] Constitution du corpus pilote (150 travaux réels)
- [ ] Implémentation de la baseline lexicale (3-grammes + Jaccard)
- [ ] Évaluation quantitative (précision, rappel, F1, courbe ROC)
- [ ] Comparaison approche sémantique vs baseline
- [ ] Analyse par type de plagiat (copier-coller, paraphrase, traduction, IA générative)
- [ ] Rédaction du Chapitre IV avec captures d'écran et résultats réels

### 🎯 Phase 4 — Extension (perspectives)
- [ ] Déploiement inter-facultés (UNIKIN)
- [ ] API fédératrice interuniversitaire
- [ ] Détection interuniversitaire du plagiat
- [ ] Fine-tuning du modèle sur corpus francophone africain
- [ ] Détection du plagiat par IA générative
- [ ] Assistant de rédaction scientifique
- [ ] Index national des mémoires

---

## 📜 Licence

Ce projet est développé dans le cadre d'un mémoire de licence en Sciences Informatiques à l'Université de Kinshasa. Tous droits réservés.

## 👤 Auteur

**Moïse KASOMBO**
- Département de Mathématiques et Informatique
- Faculté des Sciences — Université de Kinshasa
- Année académique 2025-2026

## 🙏 Remerciements

- Faculté des Sciences de l'Université de Kinshasa
- Département de Mathématiques et Informatique
- Encadreur(s) du mémoire (à compléter)

---

## 📊 État du projet

![Status](https://img.shields.io/badge/Status-Phase%202%20Implémentation-yellow)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan)
![License](https://img.shields.io/badge/License-Academic-lightgrey)
