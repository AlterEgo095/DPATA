#!/bin/bash
#===============================================================================
# PlagiatIA - Script de Déploiement VPS Production
# Université de Kinshasa (UNIKIN)
#
# Ce script automatise:
# - Mise à jour du code depuis Git
# - Build Next.js standalone
# - Configuration Nginx + SSL (Certbot)
# - Redémarrage du service PM2
#
# Usage: ./deploy.sh [options]
#   --setup       Première installation complète
#   --deploy      Déploiement standard (défaut)
#   --ssl         Configuration SSL uniquement
#   --rollback    Retour à la version précédente
#   --backup      Backup de la base de données
#   --logs        Voir les logs en temps réel
#
# Prérequis:
# - Ubuntu 22.04+ / Debian 12+
# - Node.js 20+ LTS
# - PM2 global installé
# - Nginx installé
# - Certbot installé
#===============================================================================

set -e  # Arrêter en cas d'erreur

#===============================================================================
# CONFIGURATION - À MODIFIER SELON VOTRE ENVIRONNEMENT
#===============================================================================

# Informations de l'application
APP_NAME="plagiatia"
APP_DIR="/var/www/plagiatia"
REPO_URL="https://github.com/votre-username/plagiatia.git"  # ← Modifier
BRANCH="main"

# Utilisateur et groupe
APP_USER="www-data"
APP_GROUP="www-data"

# Environnement Node.js
NODE_VERSION=20
PM2_ECOSYSTEM_FILE="$APP_DIR/ecosystem.config.js"

# Configuration Nginx
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONF="$APP_DIR/deploy/nginx/plagiatia.conf"

# Domaine (modifier avec votre vrai domaine)
DOMAIN="plagiatia.unikin.ac.cd"  # ← Modifier
WWW_DOMAIN="www.$DOMAIN"
EMAIL_ADMIN="admin@unikin.ac.cd"  # ← Modifier pour Certbot

# Base de données
DB_PATH="$APP_DIR/data/plagiatia.db"
DB_BACKUP_DIR="$APP_DIR/backups"

# Ports
APP_PORT=3000

# Logs
LOG_DIR="$APP_DIR/logs"
PM2_LOG_FILE="$LOG_DIR/pm2-combined.log"
ERROR_LOG="$LOG_DIR/error.log"
ACCESS_LOG="$LOG_DIR/access.log"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

#===============================================================================
# FONCTIONS UTILITAIRES
#===============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Ce script doit être exécuté en root (sudo)"
        exit 1
    fi
}

check_dependencies() {
    log_info "Vérification des dépendances..."
    
    local missing_deps=()
    
    command -v node >/dev/null 2>&1 || missing_deps+=("node")
    command -v npm >/dev/null 2>&1 || missing_deps+=("npm")
    command -v pm2 >/dev/null 2>&1 || missing_deps+=("pm2")
    command -v nginx >/dev/null 2>&1 || missing_deps+=("nginx")
    command -v certbot >/dev/null 2>&1 || missing_deps+=("certbot")
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Dépendances manquantes: ${missing_deps[*]}"
        log_info "Installez-les avec: apt install nodejs npm nginx certbot && npm install -g pm2"
        exit 1
    fi
    
    log_success "Toutes les dépendances sont installées"
}

create_directories() {
    log_info "Création des répertoires..."
    
    mkdir -p "$APP_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$DB_BACKUP_DIR"
    mkdir -p "$APP_DIR/data"
    mkdir -p "$APP_DIR/.next/standalone"
    
    chown -R $APP_USER:$APP_GROUP "$APP_DIR"
    
    log_success "Répertoires créés"
}

#===============================================================================
# INSTALLATION INITIALE (--setup)
#===============================================================================

do_setup() {
    log_info "=========================================="
    log_info "INSTALLATION INITIALE DE PLAGIATIA"
    log_info "=========================================="
    
    check_root
    check_dependencies
    
    # Installation des paquets système si nécessaire
    log_info "Mise à jour des paquets système..."
    apt update && apt upgrade -y
    
    # Installation des dépendances si manquantes
    apt install -y curl wget git nginx certbot python3-certbot-nginx \
                   build-essential ufw fail2ban
    
    # Installation Node.js via nvm ou nodesource
    if ! command -v node >/dev/null 2>&1; then
        log_info "Installation de Node.js $NODE_VERSION..."
        curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
        apt-get install -y nodejs
    fi
    
    # Installation globale PM2
    if ! command -v pm2 >/dev/null 2>&1; then
        log_info "Installation de PM2..."
        npm install -g pm2
        pm2 startup systemd -u $APP_USER --hp $APP_DIR
        pm2 save
    fi
    
    # Clonage du repository
    if [ ! -d "$APP_DIR/.git" ]; then
        log_info "Clonage du repository..."
        rm -rf "$APP_DIR"/*
        git clone "$REPO_URL" "$APP_DIR" --branch "$BRANCH" --single-branch
    fi
    
    create_directories
    
    # Copie des fichiers de configuration
    setup_nginx
    setup_pm2
    setup_env
    
    # Premier build
    do_build
    
    # Démarrage du service
    pm2 start "$PM2_ECOSYSTEM_FILE"
    pm2 save
    
    # Configuration SSL
    setup_ssl
    
    # Configuration firewall
    setup_firewall
    
    log_success "=========================================="
    log_success "INSTALLATION TERMINÉE AVEC SUCCÈS"
    log_success "=========================================="
    echo ""
    echo "Votre application est accessible sur:"
    echo "  - HTTP://$DOMAIN"
    echo "  - HTTPS://$DOMAIN (après configuration SSL)"
    echo ""
    echo "Commandes utiles:"
    echo "  - pm2 logs $APP_NAME     # Voir les logs"
    echo "  - pm2 status            # État des processus"
    echo "  - $0 --deploy           # Mettre à jour"
    echo "  - $0 --backup           # Sauvegarder la DB"
}

#===============================================================================
# BUILD DE L'APPLICATION
#===============================================================================

do_build() {
    log_info "=========================================="
    log_info "BUILD DE L'APPLICATION"
    log_info "=========================================="
    
    cd "$APP_DIR"
    
    # Récupération des derniers changements
    log_info "Récupération des derniers changements..."
    git fetch origin
    git pull origin "$BRANCH"
    
    # Installation des dépendances
    log_info "Installation des dépendances npm..."
    sudo -u $APP_USER npm ci --production=false
    
    # Build Next.js en mode standalone
    log_info "Build Next.js (standalone output)..."
    sudo -u $APP_USER npm run build
    
    # Copie des fichiers nécessaires pour standalone
    log_info "Préparation du bundle standalone..."
    
    # Le mode standalone génère un .next/standalone indépendant
    # Il faut aussi copier les fichiers statiques, public, etc.
    if [ -d ".next/standalone" ]; then
        cp -r .next/standalone/* .next/standalone/.next 2>/dev/null || true
        cp -r public .next/standalone/public 2>/dev/null || true
        cp -r static .next/standalone/static 2>/dev/null || true
        
        # Copie des données si elles existent
        cp -r data .next/standalone/data 2>/dev/null || true
    fi
    
    # Permissions
    chown -R $APP_USER:$APP_GROUP "$APP_DIR"
    
    log_success "Build terminé avec succès"
}

#===============================================================================
# DÉPLOIEMENT STANDARD (--deploy)
#===============================================================================

do_deploy() {
    log_info "=========================================="
    log_info "DÉPLOIEMENT DE PLAGIATIA"
    log_info "=========================================="
    
    check_root
    
    # Backup avant déploiement
    backup_before_deploy
    
    # Build
    do_build
    
    # Redémarrage PM2
    log_info "Redémarrage du service..."
    cd "$APP_DIR"
    
    if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
        pm2 restart "$APP_NAME"
    else
        pm2 start "$PM2_ECOSYSTEM_FILE"
    fi
    
    pm2 save
    
    # Vérification
    sleep 3
    if pm2 status | grep -q "$APP_NAME.*online"; then
        log_success "Application déployée et en ligne!"
        
        # Notification optionnelle (Slack/Discord/Webhook)
        notify_deployment "SUCCESS" "Déploiement réussi sur $(date)"
    else
        log_error "Problème au démarrage! Consultez les logs:"
        pm2 logs "$APP_NAME" --lines 20 --nostream
        notify_deployment "FAILURE" "Échec du déploiement sur $(date)"
        exit 1
    fi
}

#===============================================================================
# CONFIGURATION NGINX
#===============================================================================

setup_nginx() {
    log_info "Configuration de Nginx..."
    
    # Création de la configuration Nginx
    cat > "$NGINX_CONF" << 'NGINX_EOF'
# PlagiatIA - Configuration Nginx Production
# Université de Kinshasa (UNIKIN)

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

# Upstream pour Next.js
upstream plagiatia_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP -> HTTPS redirection (actif après SSL)
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
    
    # ACME challenge pour Certbot
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }
    
    # Redirection vers HTTPS (commentée avant SSL)
    # return 301 https://$server_name$request_uri;
    
    # Configuration temporaire (avant SSL)
    location / {
        proxy_pass http://plagiatia_backend;
        
        # Headers proxy
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Cache des assets statiques
        proxy_cache_valid 200 302 10m;
        proxy_cache_valid 404 1m;
    }
    
    # Limiter les requêtes de login
    location /api/auth/login {
        limit_req zone=login_limit burst=3 nodelay;
        limit_req_status 429;
        
        proxy_pass http://plagiatia_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API endpoints avec rate limiting
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        limit_req_status 429;
        limit_conn conn_limit 20;
        
        proxy_pass http://plagiatia_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Fichiers statiques avec cache agressif
    location /_next/static/ {
        proxy_pass http://plagiatia_backend;
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Icons et images
    location ~* \.(ico|png|jpg|jpeg|gif|svg|webp|avif)$ {
        proxy_pass http://plagiatia_backend;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
    
    # Fonts
    location ~* \.(woff|woff2|ttf|otf|eot)$ {
        proxy_pass http://plagiatia_backend;
        expires 365d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin *;
        access_log off;
    }
    
    # Logs
    access_log /var/log/nginx/plagiatia_access.log;
    error_log /var/log/nginx/plagiatia_error.log;
}

# Configuration HTTPS (activée après Certbot)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
#     
#     # SSL Configuration
#     ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
#     
#     # SSL optimisé
#     ssl_session_timeout 1d;
#     ssl_session_cache shared:SSL:50m;
#     ssl_session_tickets off;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
#     ssl_prefer_server_ciphers off;
#     
#     # HSTS
#     add_header Strict-Transport-Security "max-age=63072000" always;
#     add_header X-Frame-Options DENY always;
#     add_header X-Content-Type-Options nosniff always;
#     add_header Referrer-Policy strict-origin-when-cross-origin always;
#     add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
#     
#     # OCSP Stapling
#     ssl_stapling on;
#     ssl_stapling_verify on;
#     resolver 8.8.8.8 8.8.4.4 valid=300s;
#     resolver_timeout 5s;
#     
#     # Proxy vers Next.js
#     location / {
#         proxy_pass http://plagiatia_backend;
#         
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_set_header X-Forwarded-Host $host;
#         
#         proxy_connect_timeout 60s;
#         proxy_send_timeout 300s;
#         proxy_read_timeout 300s;
#     }
#     
#     # ... (même config que HTTP pour les autres locations)
#     
#     access_log /var/log/nginx/plagiatia_ssl_access.log;
#     error_log /var/log/nginx/plagiatia_ssl_error.log;
# }
NGINX_EOF

    # Remplacer les placeholders
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_CONF"
    
    # Activation du site
    ln -sf "$NGINX_CONF" "$NGINX_SITES_ENABLED/plagiatia.conf"
    
    # Test de la configuration
    nginx -t
    
    # Rechargement de Nginx
    systemctl reload nginx || systemctl restart nginx
    
    log_success "Nginx configuré pour $DOMAIN"
}

#===============================================================================
# CONFIGURATION SSL/CERTBOT
#===============================================================================

setup_ssl() {
    log_info "Configuration SSL avec Certbot..."
    
    # Création du répertoire pour le challenge ACME
    mkdir -p /var/www/certbot
    
    # Test si le domaine pointe déjà vers ce serveur
    if dig +short "$DOMAIN" | grep -q "$(curl -s ifconfig.me)"; then
        log_info "Le domaine $DOMAIN pointe correctement vers ce serveur"
    else
        log_warning "Le domaine $DOMAIN ne semble pas pointer vers ce serveur IP: $(curl -s ifconfig.me)"
        log_warning "Assurez-vous que le DNS est configuré avant de continuer"
        read -p "Continuer quand même? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    # Obtention du certificat SSL
    certbot --nginx \
        -d "$DOMAIN" \
        -d "$WWW_DOMAIN" \
        --email "$EMAIL_ADMIN" \
        --agree-tos \
        --no-eff-email \
        --redirect \
        --hsts \
        --staple-ocsp \
        --must-staple
    
    # Test du renouvellement automatique
    certbot renew --dry-run
    
    # Ajout du cron job pour renouvellement automatique
    cat > /etc/cron.d/certbot << 'CRON_EOF'
# Renouvellement automatique des certificats SSL (2 fois/jour)
0 */12 * * * root test -x /usr/bin/certbot -a \! -x /usr/bin/systemctl systemctl reload certbot --quiet --quiet-renewal "/bin/sh -c systemctl reload nginx"
CRON_EOF
    
    chmod 644 /etc/cron.d/certbot
    
    log_success "SSL configuré avec succès pour $DOMAIN"
}

#===============================================================================
# CONFIGURATION PM2
#===============================================================================

setup_pm2() {
    log_info "Configuration PM2..."
    
    cat > "$PM2_ECOSYSTEM_FILE" << PM2EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    cwd: '$APP_DIR',
    script: '.next/standalone/server.js',
    
    // Environnement
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT,
      HOSTNAME: '127.0.0.1',
    },
    
    // Mode cluster (optionnel, pour multi-core)
    // instances: 'max',
    // exec_mode: 'cluster',
    
    // Gestion de la mémoire
    max_memory_restart: '512M',
    
    // Restart automatique
    autorestart: true,
    watch: false,
    
    // Logging
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '$LOG_DIR/pm2-error.log',
    out_file: '$LOG_DIR/pm2-out.log',
    merge_logs: true,
    
    // Health check
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }],
  
  // Deploy configuration (optionnel)
  deploy: {
    production: {
      user: '$APP_USER',
      host: ['$DOMAIN'],
      ref: 'origin/$BRANCH',
      repo: '$REPO_URL',
      path: '$APP_DIR',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
PM2EOF
    
    chown $APP_USER:$APP_GROUP "$PM2_ECOSYSTEM_FILE"
    
    log_success "PM2 configuré"
}

#===============================================================================
# VARIABLES D'ENVIRONNEMENT
#===============================================================================

setup_env() {
    log_info "Configuration des variables d'environnement..."
    
    # Génération de secrets sécurisés si inexistants
    JWT_SECRET=$(openssl rand -base64 64 2>/dev/null || head -c 64 /dev/urandom | base64)
    PASSWORD_SALT=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    
    cat > "$APP_DIR/.env.production" << ENVEOF
#===============================================================================
# PlagiatIA - Variables d'environnement PRODUCTION
# IMPORTANT: Modifiez ces valeurs avant le premier lancement!
#===============================================================================

# Application
NODE_ENV=production
PORT=$APP_PORT
HOSTNAME=127.0.0.1
APP_URL=https://$DOMAIN

# Sécurité - À CHANGER OBLIGATOIREMENT!
JWT_SECRET=${JWT_SECRET}
PASSWORD_SALT=${PASSWORD_SALT}
JWT_EXPIRES_IN=7d

# Base de données (SQLite)
DATABASE_URL=file:./data/plagiatia.db

# Session
SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)

# Email (optionnel - pour notifications)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@unikin.ac.cd
EMAIL_FROM_NAME=PlagiatIA UNIKIN

# Administration
ADMIN_EMAIL=admin@unikin.ac.cd
ADMIN_PASSWORD=$(openssl rand -base64 16 2>/dev/null)  # À changer!

# API Keys (pour intégrations tierces)
API_ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null)

# Fédération (inter-universités)
FEDERATION_API_KEY=$(openssl rand -hex 32 2>/dev/null)
FEDERATION_ID=unikin-plagiatia-01

# Logging
LOG_LEVEL=info
ENVEOF
    
    # Restriction des permissions
    chmod 600 "$APP_DIR/.env.production"
    chown $APP_USER:$APP_GROUP "$APP_DIR/.env.production"
    
    # Création du lien symbolique pour .env
    ln -sf "$APP_DIR/.env.production" "$APP_DIR/.env"
    
    log_warning "Fichier .env.production créé - MODIFIEZ LES SECRETS!"
    log_success "Variables d'environnement configurées"
}

#===============================================================================
# FIREWALL (UFW)
#===============================================================================

setup_firewall() {
    log_info "Configuration du pare-feu UFW..."
    
    # Reset
    ufw --force reset
    
    # Règles par défaut
    ufw default deny incoming
    ufw default allow outgoing
    
    # SSH
    ufw allow 22/tcp comment 'SSH'
    
    # HTTP/HTTPS
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Activer UFW
    echo "y" | ufw enable
    
    log_success "Pare-feu configuré (SSH, HTTP, HTTPS)"
}

#===============================================================================
# BACKUPS
#===============================================================================

backup_db() {
    log_info "Sauvegarde de la base de données..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$DB_BACKUP_DIR/plagiatia_${TIMESTAMP}.db.gz"
    
    if [ -f "$DB_PATH" ]; then
        gzip -c "$DB_PATH" > "$BACKUP_FILE"
        chmod 640 "$BACKUP_FILE"
        
        # Nettoyage des anciens backups (garder les 30 derniers)
        ls -t "$DB_BACKUP_DIR"/*.db.gz 2>/dev/null | tail -n +31 | xargs -r rm
        
        log_success "Backup créé: $BACKUP_FILE"
    else
        log_warning "Aucune base de données trouvée à sauvegarder"
    fi
}

backup_before_deploy() {
    if [ -f "$DB_PATH" ]; then
        backup_db
    fi
}

#===============================================================================
# ROLLBACK
#===============================================================================

do_rollback() {
    log_info "Rollback de la version précédente..."
    
    cd "$APP_DIR"
    
    # Trouver le commit précédent
    PREVIOUS_COMMIT=$(git log --oneline -2 | tail -1 | cut -d' ' -f1)
    
    log_info "Retour au commit: $PREVIOUS_COMMIT"
    git checkout "$PREVIOUS_COMMIT"
    
    # Rebuild
    do_build
    
    # Restart
    pm2 restart "$APP_NAME"
    pm2 save
    
    log_success "Rollback effectué vers: $PREVIOUS_COMMIT"
}

#===============================================================================
# LOGS
#===============================================================================

show_logs() {
    pm2 logs "$APP_NAME" --lines 100
}

#===============================================================================
# NOTIFICATIONS (optionnel)
#===============================================================================

notify_deployment() {
    local STATUS="$1"
    local MESSAGE="$2"
    
    # Webhook Slack/Discord optionnel
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"[$STATUS] $MESSAGE\"}" \
    #     YOUR_WEBHOOK_URL
    
    log_info "Notification: [$STATUS] $MESSAGE"
}

#===============================================================================
# AIDE
#===============================================================================

show_help() {
    cat << 'HELPEOF'
===============================================================================
 PlagiatIA - Script de Déploiement VPS
===============================================================================

Usage: ./deploy.sh [OPTION]

Options:
  --setup       Première installation complète du serveur
  --deploy      Déploiement standard (build + restart)
  --ssl         Configuration SSL/Let's Encrypt uniquement
  --rollback    Retour à la version précédente
  --backup      Sauvegarde manuelle de la base de données
  --logs        Afficher les logs en temps réel
  --help        Afficher cette aide

Exemples:
  sudo ./deploy.sh --setup          # Première installation
  sudo ./deploy.sh --deploy         # Mettre à jour
  sudo ./deploy.sh --ssl            # Configurer HTTPS
  sudo ./deploy.sh --backup         # Sauvegarder la DB
  sudo ./deploy.sh --rollback       # Annuler dernière mise à jour
  sudo ./deploy.sh --logs           # Voir les logs

Fichiers générés:
  - deploy/nginx/plagiatia.conf     Config Nginx
  - ecosystem.config.js             Config PM2
  - .env.production                 Variables d'environnement
  - logs/                           Logs applicatifs
  - backups/                        Sauvegardes DB

Documentation: https://docs.plagiatia.unikin.ac.cd/deploy
===============================================================================
HELPEOF
}

#===============================================================================
# MAIN - ROUTAGE DES COMMANDES
#===============================================================================

case "${1:-}" in
    --setup)
        do_setup
        ;;
    --deploy)
        do_deploy
        ;;
    --ssl)
        check_root
        setup_ssl
        ;;
    --rollback)
        check_root
        do_rollback
        ;;
    --backup)
        backup_db
        ;;
    --logs)
        show_logs
        ;;
    --help|-h)
        show_help
        ;;
    "")
        # Pas d'argument = déploiement standard
        do_deploy
        ;;
    *)
        log_error "Option inconnue: $1"
        show_help
        exit 1
        ;;
esac
