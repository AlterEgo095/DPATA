#!/bin/bash
#===============================================================================
# PlagiatIA - Script de Déploiement Production
# Domaine: plagiatia.aenews.net
#
# Ce script automatise:
# - Mise à jour du code depuis Git
# - Installation des dépendances (bun install)
# - Build Next.js standalone
# - Migration de la base de données
# - Redémarrage du service PM2
# - Backup automatique avant déploiement
#
# Usage:
#   ./deploy.sh              # Déploiement standard
#   ./deploy.sh --setup      # Première installation
#   ./deploy.sh --rollback   # Retour à la version précédente
#   ./deploy.sh --backup     # Backup manuel de la BDD
#   ./deploy.sh --logs       # Voir les logs en temps réel
#   ./deploy.sh --status     # Vérifier le statut du serveur
#===============================================================================

set -e

#===============================================================================
# CONFIGURATION
#===============================================================================

APP_NAME="plagiatia"
APP_DIR="/var/www/plagiatia"
BACKUP_DIR="$APP_DIR/backups"
LOG_FILE="$APP_DIR/logs/deploy.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
GIT_BRANCH="main"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $(date '+%H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"; }
log_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

#===============================================================================
# FONCTIONS
#===============================================================================

check_requirements() {
    log_step "Vérification des prérequis"
    
    # Vérifier Bun
    if ! command -v bun &> /dev/null; then
        log_error "Bun n'est pas installé! Exécutez d'abord setup-vps.sh"
        exit 1
    fi
    log_success() { echo -e "${GREEN}[✓]${NC} Bun: $(bun --version)"; }
    
    # Vérifier PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 n'est pas installé!"
        exit 1
    fi
    
    # Vérifier que le répertoire existe
    if [ ! -d "$APP_DIR" ]; then
        log_error "Le répertoire $APP_DIR n'existe pas!"
        log_info "Exécutez d'abord: sudo ./setup-vps.sh"
        exit 1
    fi
    
    log "Prérequis OK ✓"
}

backup_database() {
    log_step "Backup de la base de données"
    
    mkdir -p "$BACKUP_DIR"
    
    if [ -f "$APP_DIR/data/plagiatia.db" ]; then
        cp "$APP_DIR/data/plagiatia.db" "$BACKUP_DIR/plagiatia_$TIMESTAMP.db"
        gzip "$BACKUP_DIR/plagiatia_$TIMESTAMP.db"
        log "Backup créé: plagiatia_$TIMESTAMP.db.gz"
        
        # Nettoyage des anciens backups (garder les 10 derniers)
        ls -t "$BACKUP_DIR"/*.db.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
    else
        log_warn "Pas de base de données existante à sauvegarder"
    fi
}

pull_code() {
    log_step "Mise à jour depuis Git"
    
    cd "$APP_DIR"
    
    # Stash des changements locaux si nécessaire
    git stash --include-untracked 2>/dev/null || true
    
    # Récupération des derniers changements
    git fetch origin $GIT_BRANCH
    git checkout $GIT_BRANCH
    git pull origin $GIT_BRANCH
    
    log "Code mis à jour ✓"
}

install_dependencies() {
    log_step "Installation des dépendances"
    
    cd "$APP_DIR"
    
    # Installation avec Bun (rapide!)
    bun install --frozen-lockfile || bun install
    
    log "Dépendances installées ✓"
}

build_application() {
    log_step "Build Next.js (standalone)"
    
    cd "$APP_DIR"
    
    # Export pour production
    export NODE_ENV=production
    
    # Build avec Bun
    bun run build
    
    log "Build terminé ✓"
}

migrate_database() {
    log_step "Migration de la base de données"
    
    cd "$APP_DIR"
    
    # Push du schema Prisma vers SQLite
    bun run db:push
    
    log "Base de données à jour ✓"
}

restart_service() {
    log_step "Redémarrage du service PM2"
    
    cd "$APP_DIR"
    
    # Arrêt si déjà en cours
    pm2 describe $APP_NAME > /dev/null 2>&1 && pm2 delete $APP_NAME 2>/dev/null || true
    
    # Démarrage avec ecosystem config
    if [ -f "$APP_DIR/ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --env production
    else
        # Démarrage manuel
        pm2 start .next/standalone/server.js \
            --name "$APP_NAME" \
            --env production \
            --max-memory-restart 500M
    fi
    
    # Sauvegarde de la configuration PM2
    pm2 save
    
    # Attente du démarrage
    sleep 3
    
    # Vérification du statut
    if pm2 list | grep -q "$APP_NAME.*online"; then
        log "Service démarré ✓"
    else
        log_error "Erreur au démarrage du service!"
        pm2 logs $APP_NAME --lines 20 --nostream
        exit 1
    fi
}

show_logs() {
    log "Affichage des logs en temps réel (Ctrl+C pour quitter)..."
    pm2 logs $APP_NAME --lines 50
}

show_status() {
    echo ""
    echo "╔══════════════════════════════════════════════════╗"
    echo "║           PlagiatIA - Statut Serveur             ║"
    echo "╠══════════════════════════════════════════════════╣"
    echo ""
    
    echo "📦 Application:"
    pm2 list | grep -E "(name|plagiatia)" || true
    echo ""
    
    echo "🌐 Nginx:"
    systemctl is-active nginx 2>/dev/null && echo "   Status: ✅ Actif" || echo "   Status: ❌ Inactif"
    echo ""
    
    echo "💾 Base de données:"
    if [ -f "$APP_DIR/data/plagiatia.db" ]; then
        SIZE=$(du -h "$APP_DIR/data/plagiatia.db" | cut -f1)
        MODIFIED=$(stat -c %y "$APP_DIR/data/plagiatia.db" 2>/dev/null | cut -d. -f1)
        echo "   Taille: $SIZE"
        echo "   Modifié: $MODIFIED"
    else
        echo "   Status: ❌ Non trouvée"
    fi
    echo ""
    
    echo "🔒 SSL:"
    if [ -d "/etc/letsencrypt/live/plagiatia.aenews.net" ]; then
        EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/plagiatia.aenews.net/fullchain.pem 2>/dev/null | cut -d= -f2)
        echo "   Status: ✅ Valide"
        echo "   Expiration: $EXPIRY"
    else
        echo "   Status: ⚠️ Non configuré"
    fi
    echo ""
    
    echo "💿 Espace disque:"
    df -h / | awk 'NR==2{print "   Total: "$2" | Utilisé: "$3" ("$5") | Libre: "$4}'
    echo ""
    
    echo "🧠 Mémoire:"
    free -h | awk 'NR==2{print "   Total: "$2" | Utilisé: "$3" | Libre: "$7}'
    echo ""
    
    echo "╚══════════════════════════════════════════════════╝"
}

rollback() {
    log_step "Rollback vers la version précédente"
    
    cd "$APP_DIR"
    
    # Trouver le dernier backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.db.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "Aucun backup trouvé pour rollback!"
        exit 1
    fi
    
    log "Restauration depuis: $LATEST_BACKUP"
    
    # Arrêt du service
    pm2 stop $APP_NAME 2>/dev/null || true
    
    # Restauration
    gunzip -c "$LATEST_BACKUP" > "$APP_DIR/data/plagiatia.db"
    
    # Redémarrage
    pm2 restart $APP_NAME 2>/dev/null || restart_service
    
    log "Rollback effectué ✓"
}

first_setup() {
    log "🚀 Première installation complète..."
    
    check_requirements
    
    # Clonage du repository
    if [ -z "$(ls -A $APP_DIR 2>/dev/null)" ] || [ ! -d "$APP_DIR/.git" ]; then
        log_step "Clonage du repository"
        cd /var/www
        git clone https://github.com/AlterEgo095/DPATA.git temp_deploy
        mv temp_deploy/* "$APP_DIR/"
        mv temp_deploy/.* "$APP_DIR/" 2>/dev/null || true
        rm -rf temp_deploy
    fi
    
    # Copie du fichier env
    if [ -f "$APP_DIR/.env.production" ] && [ ! -f "$APP_DIR/.env.local" ]; then
        cp "$APP_DIR/.env.production" "$APP_DIR/.env.local"
        log "Fichier .env.local configuré"
    fi
    
    # Installation et build
    pull_code
    install_dependencies
    migrate_database
    build_application
    restart_service
    
    echo ""
    log_success "✅ Installation terminée!"
    log_info "Accès: https://plagiatia.aenews.net"
}

#===============================================================================
# MAIN
#===============================================================================

case "${1:-deploy}" in
    --setup|setup|-s)
        first_setup
        ;;
    --deploy|deploy|-d|"")
        check_requirements
        backup_database
        pull_code
        install_dependencies
        migrate_database
        build_application
        restart_service
        
        echo ""
        log_success "✅ Déploiement terminé avec succès!"
        log_info "Application disponible sur: https://plagiatia.aenews.net"
        ;;
    --rollback|rollback|-r)
        rollback
        ;;
    --backup|backup|-b)
        backup_database
        ;;
    --logs|logs|-l)
        show_logs
        ;;
    --status|status|-st)
        show_status
        ;;
    --help|help|-h)
        echo "
PlagiatIA - Script de Déploiement

Usage: ./deploy.sh [option]

Options:
  --setup, -s    Première installation complète
  --deploy, -d   Déploiement standard (défaut)
  --rollback,-r  Retour à la version précédente
  --backup, -b   Backup de la base de données
  --logs, -l     Voir les logs en temps réel
  --status, -st  Voir le statut du serveur
  --help, -h     Afficher cette aide

Exemples:
  ./deploy.sh              # Déploiement standard
  ./deploy.sh --setup      # Première installation
  ./deploy.sh --rollback   Rollback en cas de problème
  ./deploy.sh --status     Vérifier l'état du serveur
"
        ;;
    *)
        log_error "Option inconnue: $1"
        echo "Utilisez --help pour voir les options disponibles"
        exit 1
        ;;
esac
