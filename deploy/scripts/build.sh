#!/bin/bash
#===============================================================================
# PlagiatIA - Script de Build Production
# 
# Ce script prépare l'application pour le déploiement:
# - Installation des dépendances
# - Build Next.js en mode standalone
# - Préparation du bundle de déploiement
# - Tests de santé
#
# Usage: ./build.sh [options]
#   --clean      Nettoyer les caches avant build
#   --package   Créer une archive .tar.gz du build
#   --docker    Build Docker image (optionnel)
#===============================================================================

set -e

#===============================================================================
# CONFIGURATION
#===============================================================================

APP_NAME="plagiatia"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$BUILD_DIR/dist"
STANDALONE_DIR="$BUILD_DIR/.next/standalone"

NODE_ENV=${NODE_ENV:-production}

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[BUILD]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

#===============================================================================
# PRÉ-BUILD
#===============================================================================

pre_build() {
    log_info "=========================================="
    log_info "PRÉPARATION DU BUILD - $APP_NAME"
    log_info "=========================================="
    
    cd "$BUILD_DIR"
    
    # Vérification Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé"
        exit 1
    fi
    
    log_info "Node.js: $(node --version)"
    log_info "npm: $(npm --version)"
    
    # Vérification des fichiers essentiels
    local required_files=("package.json" "next.config.ts" "tsconfig.json")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Fichier manquant: $file"
            exit 1
        fi
    done
    
    # Création des répertoires nécessaires
    mkdir -p data logs backups dist
}

#===============================================================================
# NETTOYAGE
#===============================================================================

do_clean() {
    log_info "Nettoyage des caches..."
    
    rm -rf .next
    rm -rf node_modules/.cache
    rm -rf dist
    
    npm cache clean --force 2>/dev/null || true
    
    log_success "Cache nettoyé"
}

#===============================================================================
# INSTALLATION DÉPENDANCES
#===============================================================================

install_deps() {
    log_info "Installation des dépendances..."
    
    # Installation sans scripts (plus rapide, plus sûr en CI)
    npm ci --prefer-offline --no-audit --no-fund 2>/dev/null || npm install
    
    log_success "Dépendances installées"
}

#===============================================================================
# BUILD NEXT.JS
#===============================================================================

do_build() {
    log_info "=========================================="
    log_info "BUILD NEXT.JS (standalone output)"
    log_info "=========================================="
    
    # Export de l'environnement pour le build
    export NODE_ENV=$NODE_ENV
    
    # Build avec Turbopack ou Webpack
    if [ -f ".turbopack" ] || grep -q '"turbo"' package.json 2>/dev/null; then
        log_info "Build avec Turbopack..."
        npm run build -- --turbo 2>&1 | tee build.log
    else
        log_info "Build avec Webpack..."
        npm run build 2>&1 | tee build.log
    fi
    
    # Vérification du build
    if [ ! -d "$STANDALONE_DIR" ]; then
        log_error "Échec du build - répertoire standalone non créé"
        exit 1
    fi
    
    log_success "Build terminé avec succès"
}

#===============================================================================
# PRÉPARATION DU BUNDLE STANDALONE
#===============================================================================

prepare_standalone() {
    log_info "Préparation du bundle standalone..."
    
    # Copie des fichiers statiques
    log_info "Copie des assets statiques..."
    
    if [ -d "public" ]; then
        cp -r public "$STANDALONE_DIR/public"
    fi
    
    # Copie des données si elles existent
    if [ -d "data" ]; then
        cp -r data "$STANDALONE_DIR/data" 2>/dev/null || true
    fi
    
    # Copie des templates de déploiement
    if [ -d "deploy" ]; then
        cp -r deploy "$STANDALONE_DIR/deploy" 2>/dev/null || true
    fi
    
    # Création du fichier .env dans le standalone s'il existe
    if [ -f ".env.production" ]; then
        cp .env.production "$STANDALONE_DIR/.env.production"
    elif [ -f ".env" ]; then
        cp .env "$STANDALONE_DIR/.env"
    fi
    
    # Création du PM2 ecosystem config
    cat > "$STANDALONE_DIR/ecosystem.config.js" << 'PM2EOF'
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      HOSTNAME: '127.0.0.1',
    },
    max_memory_restart: '512M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    error_file: '../logs/pm2-error.log',
    out_file: '../logs/pm2-out.log',
    merge_logs: true,
  }]
};
PM2EOF
    
    # Permissions
    chmod +x "$STANDALONE_DIR/server.js" 2>/dev/null || true
    
    log_success "Bundle standalone préparé"
}

#===============================================================================
# TESTS DE SANTÉ
#===============================================================================

health_check() {
    log_info "Tests de santé post-build..."
    
    local errors=0
    
    # Vérification du serveur standalone
    if [ ! -f "$STANDALONE_DIR/server.js" ]; then
        log_error "server.js manquant dans le bundle standalone"
        ((errors++))
    fi
    
    # Vérification de la taille du bundle
    local bundle_size=$(du -sh "$STANDALONE_DIR" | cut -f1)
    log_info "Taille du bundle: $bundle_size"
    
    # Vérification des dépendances critiques
    if [ ! -d "$STANDALONE_DIR/node_modules" ]; then
        log_warning "node_modules absent - vérifiez que tout est inclus"
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Tous les tests de santé passés ✓"
    else
        log_error "$errors erreur(s) détectée(s) pendant les tests"
        return 1
    fi
}

#===============================================================================
# PACKAGING
#===============================================================================

create_package() {
    log_info "Création de l'archive de déploiement..."
    
    local VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
    local TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    local PACKAGE_NAME="${APP_NAME}_v${VERSION}_${TIMESTAMP}"
    
    mkdir -p "$DIST_DIR"
    
    # Création de l'archive
    tar -czvf "$DIST_DIR/${PACKAGE_NAME}.tar.gz" \
        -C "$(dirname "$STANDALONE_DIR")" \
        "$(basename "$STANDALONE_DIR")" \
        --exclude='*.map' \
        --exclude='.cache' \
        2>/dev/null
    
    local archive_size=$(du -sh "$DIST_DIR/${PACKAGE_NAME}.tar.gz" | cut -f1)
    
    log_success "Archive créée: ${PACKAGE_NAME}.tar.gz ($archive_size)"
    echo "$DIST_DIR/${PACKAGE_NAME}.tar.gz"
}

#===============================================================================
# DOCKER BUILD (optionnel)
#===============================================================================

docker_build() {
    log_info "Build Docker image..."
    
    if [ ! -f "Dockerfile" ]; then
        log_warning "Dockerfile non trouvé - création d'un Dockerfile par défaut..."
        create_dockerfile
    fi
    
    local VERSION=$(git describe --tags --always 2>/dev/null || echo "latest")
    
    docker build \
        -t "$APP_NAME:$VERSION" \
        -t "$APP_NAME:latest" \
        --build-arg NODE_VERSION=20 \
        .
    
    log_success "Image Docker créée: $APP_NAME:$VERSION"
}

create_dockerfile() {
    cat > Dockerfile << 'DOCKEREOF'
FROM node:20-alpine AS base

# Dependencies only
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production=false

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
DOCKEREOF
}

#===============================================================================
# MAIN
#===============================================================================

main() {
    case "${1:-}" in
        --clean)
            pre_build
            do_clean
            ;;
        --package)
            pre_build
            do_clean
            install_deps
            do_build
            prepare_standalone
            health_check
            create_package
            ;;
        --docker)
            pre_build
            docker_build
            ;;
        "")
            # Build standard
            pre_build
            install_deps
            do_build
            prepare_standalone
            health_check
            ;;
        *)
            echo "Usage: $0 [--clean|--package|--docker]"
            exit 1
            ;;
    esac
    
    log_info "=========================================="
    log_success "BUILD TERMINÉ AVEC SUCCÈS!"
    log_info "=========================================="
    echo ""
    echo "Prochaines étapes:"
    echo "  1. Transférez le dossier .next/standalone sur le serveur"
    echo "  2. Configurez .env.production avec vos secrets"
    echo "  3. Lancez: pm2 start ecosystem.config.js"
    echo "  4. Configurez Nginx (voir deploy/nginx/plagiatia.conf)"
    echo ""
}

main "$@"
