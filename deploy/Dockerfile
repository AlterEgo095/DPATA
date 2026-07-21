# PlagiatIA - Dockerfile Production Multi-stage
# Université de Kinshasa (UNIKIN)
#
# Build:  docker build -t plagiatia:latest .
# Run:    docker run -d --name plagiatia -p 3000:3000 --env-file .env.production plagiatia
#
# Avec docker-compose:
#   docker-compose up -d

#===============================================================================
# STAGE 1: Base Node.js
#===============================================================================
FROM node:20-alpine AS base

# Installation des dépendances système pour les modules natifs
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    curl

# Configuration de Node.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV npm_config_production=false
ENV YARN_ENABLE_SCRIPT_INSTALLER=false

WORKDIR /app

#===============================================================================
# STAGE 2: Dépendances
#===============================================================================
FROM base AS deps

# Copie des fichiers de dépendances
COPY package.json package-lock.json* ./

# Installation de toutes les dépendances (dev incluses pour build)
RUN npm ci --include=dev || npm install

#===============================================================================
# STAGE 3: Build
#===============================================================================FROM base AS builder

# Copie des dépendances installées
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Désactivation de la télémétrie Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js en mode standalone (pour image légère)
RUN npm run build

#===============================================================================
# STAGE 4: Production (Image finale légère)
#===============================================================================
FROM node:20-alpine AS runner

# Création d'un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Variables d'environnement production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Répertoire de travail
WORKDIR /app

# Copie des fichiers nécessaires depuis le build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Répertoires de données et logs
RUN mkdir -p /app/data /app/logs && \
    chown -R nextjs:nodejs /app/data /app/logs

# Utilisateur non-root
USER nextjs

# Exposition du port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Commande de démarrage
CMD ["node", "server.js"]

#===============================================================================
# ALTERNATIVE: Image avec PM2 (pour monitoring avancé)
#===============================================================================
# FROM node:20-alpine AS runner-pm2
#
# RUN apk add --no-cache curl
# RUN npm install -g pm2
#
# WORKDIR /app
#
# COPY --from=builder --chown=node:node /app/public ./public
# COPY --from=builder --chown=node:node /app/.next/standalone ./
# COPY --from=builder --chown=node:node /app/.next/static ./.next/static
#
# EXPOSE 3000
#
# CMD ["pm2-runtime", "ecosystem.config.js"]
