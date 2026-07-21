#!/bin/bash
#===============================================================================
# PlagiatIA - Script de Déploiement PRODUCTION SÉCURISÉ
# Domaine: plagiatia.aenews.net | Server: 95.111.226.63
#
# ⚠️  CE SCRIPT EST CONÇU POUR ÊTRE SÛR:
#    - Analyse l'environnement AVANT toute action
#    - Ne touche PAS aux processus/ports existants
#    - Utilise des ports alternatifs si nécessaire
#    - Crée des backups avant modifications
#
# Usage:
#   chmod +x deploy-plagiatia-pro.sh
#   sudo ./deploy-plagiatia-pro.sh
#===============================================================================

set -e

#===============================================================================
# CONFIGURATION
#===============================================================================
DOMAIN="plagiatia.aenews.net"
APP_NAME="plagiatia"
BASE_DIR="/opt"
DEPLOY_DIR="$BASE_DIR/$APP_NAME"
BACKUP_DIR="$BASE_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Ports (seront ajustés automatiquement si occupés)
DEFAULT_PORT=3000
ALT_PORTS=(3001 3002 3003 3004 3005)

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${NC}"; }
log_header() {
    echo ""
    echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║${NC}  ${BOLD}$1${NC}"
    echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
}

#===============================================================================
# FONCTIONS DE VÉRIFICATION PRÉALABLE
#===============================================================================

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Ce script doit être exécuté en root (sudo)"
        log_info "Usage: sudo ./deploy-plagiatia-pro.sh"
        exit 1
    fi
    log_success "Exécution en root confirmée"
}

check_connectivity() {
    log_step "Vérification de la connectivité Internet"
    
    if ping -c 1 -W 5 google.com &> /dev/null || ping -c 1 -W 5 cloudflare.com &> /dev/null; then
        log_success "Connectivité Internet OK"
        return 0
    else
        log_error "Pas de connexion Internet!"
        exit 1
    fi
}

#===============================================================================
# ANALYSE DE L'ENVIRONNEMENT EXISTANT (CRITIQUE)
#===============================================================================

analyze_environment() {
    log_header "🔍 ANALYSE DE L'ENVIRONNEMENT EXISTANT"
    
    # Créer le rapport d'analyse
    REPORT_FILE="/tmp/plagiatia_env_analysis_$TIMESTAMP.txt"
    echo "=== RAPPORT D'ANALYSE ENVIRONNEMENT ===" > "$REPORT_FILE"
    echo "Date: $(date)" >> "$REPORT_FILE"
    echo "Serveur: $(hostname)" >> "$REPORT_FILE"
    echo "IP: $(hostname -I | awk '{print $1}')" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # 1. Liste des utilisateurs système
    log_info "Analyse des utilisateurs système..."
    echo "--- UTILISATEURS SYSTÈME ---" >> "$REPORT_FILE"
    cut -d: -f1 /etc/passwd | grep -E "(www|nginx|node|bun|aenews)" >> "$REPORT_FILE" 2>/dev/null || true
    
    # 2. Services actifs (systemd)
    log_info "Analyse des services systemd actifs..."
    echo "" >> "$REPORT_FILE"
    echo "--- SERVICES SYSTEMD ACTIFS ---" >> "$REPORT_FILE"
    systemctl list-units --type=service --state=running --no-pager | grep -v "systemd\|dbus\|getty\|user@" >> "$REPORT_FILE" 2>/dev/null || true
    
    # 3. Processus en écoute sur les ports
    log_info "Analyse des ports utilisés..."
    echo "" >> "$REPORT_FILE"
    echo "--- PORTS EN ÉCOUTE ---" >> "$REPORT_FILE"
    
    if command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null >> "$REPORT_FILE"
    elif command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null >> "$REPORT_FILE"
    fi
    
    # 4. Applications web existantes dans /opt
    log_info "Analyse des applications dans /opt..."
    echo "" >> "$REPORT_FILE"
    echo "--- APPLICATIONS DANS /OPT ---" >> "$REPORT_FILE"
    ls -la /opt/ 2>/dev/null >> "$REPORT_FILE" || echo "/opt vide ou inexistant" >> "$REPORT_FILE"
    
    # 5. Configuration Nginx existante
    log_info "Analyse de la configuration Nginx..."
    echo "" >> "$REPORT_FILE"
    echo "--- SITES NGINX ---" >> "$REPORT_FILE"
    if [ -d "/etc/nginx/sites-enabled" ]; then
        ls -la /etc/nginx/sites-enabled/ >> "$REPORT_FILE" 2>/dev/null || true
        for site in /etc/nginx/sites-enabled/*; do
            if [ -f "$site" ]; then
                echo "" >> "$REPORT_FILE"
                echo "--- Contenu: $(basename $site) ---" >> "$REPORT_FILE"
                cat "$site" >> "$REPORT_FILE" 2>/dev/null | head -30
            fi
        done
    else
        echo "Nginx non configuré ou sites-enabled inexistant" >> "$REPORT_FILE"
    fi
    
    # 6. PM2 processes si installé
    log_info "Analyse des processus PM2..."
    echo "" >> "$REPORT_FILE"
    echo "--- PROCESSUS PM2 ---" >> "$REPORT_FILE"
    if command -v pm2 &> /dev/null; then
        pm2 list >> "$REPORT_FILE" 2>/dev/null || true
    else
        echo "PM2 non installé" >> "$REPORT_FILE"
    fi
    
    # 7. Versions des runtimes
    log_info "Vérification des runtimes disponibles..."
    echo "" >> "$REPORT_FILE"
    echo "--- RUNTIMES DISPONIBLES ---" >> "$REPORT_FILE"
    echo "Node.js: $(node --version 2>/dev/null || echo 'Non installé')" >> "$REPORT_FILE"
    echo "npm: $(npm --version 2>/dev/null || echo 'Non installé')" >> "$REPORT_FILE"
    echo "Bun: $(bun --version 2>/dev/null || echo 'Non installé')" >> "$REPORT_FILE"
    echo "PM2: $(pm2 --version 2>/dev/null || echo 'Non installé')" >> "$REPORT_FILE"
    echo "Nginx: $(nginx -v 2>&1 || echo 'Non installé')" >> "$REPORT_FILE"
    
    # 8. Espace disque
    log_info "Vérification de l'espace disque..."
    echo "" >> "$REPORT_FILE"
    echo "--- ESPACE DISQUE ---" >> "$REPORT_FILE"
    df -h / >> "$REPORT_FILE"
    
    # 9. Mémoire disponible
    log_info "Vérification de la mémoire..."
    echo "" >> "$REPORT_FILE"
    echo "--- MÉMOIRE ---" >> "$REPORT_FILE"
    free -h >> "$REPORT_FILE"
    
    log_success "Rapport d'analyse créé: $REPORT_FILE"
    cat "$REPORT_FILE"
    echo ""
    
    REPORT_FILE="$REPORT_FILE"  # Export pour usage ultérieur
}

find_available_port() {
    log_step "Recherche d'un port disponible pour PlagiatIA"
    
    PORT=$DEFAULT_PORT
    
    # Vérifier si le port par défaut est libre
    if ss -tlnp 2>/dev/null | grep -q ":$PORT " || netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
        log_warn "Port $PORT déjà utilisé, recherche d'une alternative..."
        
        for ALT_PORT in "${ALT_PORTS[@]}"; do
            if ! ss -tlnp 2>/dev/null | grep -q ":$ALT_PORT " && ! netstat -tlnp 2>/dev/null | grep -q ":$ALT_PORT "; then
                PORT=$ALT_PORT
                log_success "Port disponible trouvé: $PORT"
                break
            fi
            log_warn "Port $ALT_PORT aussi utilisé"
        done
        
        if [ "$PORT" = "$DEFAULT_PORT" ]; then
            log_error "Aucun port disponible trouvé!"
            log_info "Ports à vérifier manuellement: ${ALT_PORTS[*]}"
            exit 1
        fi
    else
        log_success "Port $PORT disponible"
    fi
    
    export APP_PORT=$PORT
}

detect_existing_apps() {
    log_step "Détection des applications existantes"
    
    EXISTING_APPS=()
    
    # Chercher les apps Node.js/Bun
    if command -v pm2 &> /dev/null; then
        while IFS= read -r line; do
            if [[ "$line" =~ \|([^\|]+)\|[[:space:]]*online ]]; then
                app_name="${BASH_REMATCH[1]}"
                app_name=$(echo "$app_name" | xargs)  # trim
                if [ -n "$app_name" ]; then
                    EXISTING_APPS+=("$app_name")
                    log_warn "Application existante détectée: $app_name"
                fi
            fi
        done < <(pm2 list 2>/dev/null)
    fi
    
    # Chercher les services Nginx
    if [ -d "/etc/nginx/sites-enabled" ]; then
        for site in /etc/nginx/sites-enabled/*; do
            if [ -f "$site" ] && [ "$(basename $site)" != "default" ]; then
                domain=$(grep -oP 'server_name\s+\K[^;]+' "$site" 2>/dev/null | head -1)
                if [ -n "$domain" ]; then
                    EXISTING_APPS+=("nginx:$domain")
                    log_warn "Site Nginx existant: $domain"
                fi
            done
        done
    fi
    
    if [ ${#EXISTING_APPS[@]} -eq 0 ]; then
        log_success "Aucune application conflictuelle détectée"
    else
        log_warn "${#EXISTING_APPS[@]} application(s) existante(s) - Le script évitera tout conflit"
    fi
}

#===============================================================================
# INSTALLATION DES DÉPENDANCES SI NÉCESSAIRE
#===============================================================================

install_bun_if_needed() {
    log_step "Vérification/Installation de Bun"
    
    if command -v bun &> /dev/null; then
        BUN_VERSION=$(bun --version)
        log_success "Bun déjà installé: v$BUN_VERSION"
        
        # Mise à jour si version ancienne
        if [[ "$BUN_VERSION" < "1.0" ]]; then
            log_info "Mise à jour de Bun recommandée..."
            curl -fsSL https://bun.sh/install | bash 2>/dev/null || true
        fi
        return
    fi
    
    log_info "Installation de Bun..."
    curl -fsSL https://bun.sh/install | bash
    
    # Recharger le PATH
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Lien global
    ln -sf ~/.bun/bin/bun /usr/local/bin/bun 2>/dev/null || true
    
    log_success "Bun installé: $(bun --version)"
}

install_pm2_if_needed() {
    log_step "Vérification/Installation de PM2"
    
    if command -v pm2 &> /dev/null; then
        log_success "PM2 déjà installé: $(pm2 --version)"
        return
    fi
    
    log_info "Installation de PM2..."
    bun install -g pm2 2>/dev/null || npm install -g pm2 2>/dev/null || true
    
    # Setup startup
    pm2 startup systemd 2>/dev/null || true
    pm2 save 2>/dev/null || true
    
    log_success "PM2 installé: $(pm2 --version)"
}

install_nginx_if_needed() {
    log_step "Vérification/Installation de Nginx"
    
    if command -v nginx &> /dev/null; then
        log_success "Nginx déjà installé: $(nginx -v 2>&1)"
        return
    fi
    
    log_info "Installation de Nginx..."
    apt update -y
    apt install -y nginx certbot python3-certbot-nginx
    
    systemctl enable nginx
    systemctl start nginx
    
    log_success "Nginx installé et démarré"
}

#===============================================================================
# DÉPLOIEMENT DE PLAGIATIA
#===============================================================================

clone_repository() {
    log_step "Clonage du repository PlagiatIA"
    
    # Créer le répertoire s'il n'existe pas
    mkdir -p "$BASE_DIR"
    
    # Si le répertoire existe déjà, mettre à jour
    if [ -d "$DEPLOY_DIR/.git" ]; then
        log_info "Repository existant détected, mise à jour..."
        cd "$DEPLOY_DIR"
        git stash --include-untracked 2>/dev/null || true
        git fetch origin main
        git checkout main
        git pull origin main
    else
        # Supprimer l'ancien répertoire s'il existe sans git
        if [ -d "$DEPLOY_DIR" ]; then
            log_warn "Ancien répertoire détecté (non-git), sauvegarde et suppression..."
            mv "$DEPLOY_DIR" "$DEPLOY_DIR.old.$TIMESTAMP"
        fi
        
        log_info "Clone du repository..."
        git clone https://github.com/AlterEgo095/DPATA.git "$DEPLOY_DIR"
    fi
    
    cd "$DEPLOY_DIR"
    log_success "Repository prêt dans $DEPLOY_DIR"
}

setup_environment() {
    log_step "Configuration de l'environnement"
    
    cd "$DEPLOY_DIR"
    
    # Créer les répertoires nécessaires
    mkdir -p logs data backups
    
    # Configurer .env.local si non existant
    if [ ! -f ".env.local" ]; then
        log_info "Création du fichier .env.local..."
        
        # Générer des secrets sécurisés
        JWT_SECRET=$(openssl rand -base64 64)
        PASSWORD_SALT=$(openssl rand -hex 32)
        SESSION_SECRET=$(openssl rand -base32)
        API_KEY=$(openssl rand -hex 32)
        ADMIN_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 16)
        
        cat > .env.local << EOF
#===============================================================================
# PlagiatIA - Variables d'environnement PRODUCTION
# Domaine: $DOMAIN
# Généré: $(date -R)
#===============================================================================

NODE_ENV=production
PORT=${APP_PORT:-3000}
HOSTNAME=127.0.0.1
APP_URL=https://$DOMAIN

JWT_SECRET=$JWT_SECRET
PASSWORD_SALT=$PASSWORD_SALT
SESSION_SECRET=$SESSION_SECRET
JWT_EXPIRES_IN=7d

DATABASE_URL=file:./data/plagiatia.db

ADMIN_EMAIL=admin@aenews.net
ADMIN_PASSWORD=$ADMIN_PASS
ADMIN_FIRSTNAME=Admin
ADMIN_LASTNAME=PlagiatIA

API_ENCRYPTION_KEY=$API_KEY
API_RATE_LIMIT_GLOBAL=1000

LOG_LEVEL=info

ENABLE_PDF_EXPORT=true
ENABLE_BATCH_PROCESSING=true
ENABLE_PUBLIC_API=true
ENABLE_ADVANCED_STATISTICS=true
ENABLE_AI_DETECTION=true
EOF
        
        chmod 600 .env.local
        log_success ".env.local créé"
        
        echo ""
        log_warn "═══════════════════════════════════════════════════"
        log_warn "🔑 MOT DE PASSE ADMIN: ${GREEN}$ADMIN_PASS${NC}"
        log_warn "   Email: admin@aenews.net"
        log_warn "═══════════════════════════════════════════════════"
        echo ""
    else
        log_info ".env.local existe déjà, préservation"
    fi
}

install_dependencies() {
    log_step "Installation des dépendances"
    
    cd "$DEPLOY_DIR"
    
    bun install --frozen-lockfile 2>/dev/null || bun install
    
    log_success "Dépendances installées"
}

build_application() {
    log_step "Build de l'application Next.js"
    
    cd "$DEPLOY_DIR"
    
    export NODE_ENV=production
    
    bun run build
    
    log_success "Build terminé"
}

setup_database() {
    log_step "Initialisation de la base de données"
    
    cd "$DEPLOY_DIR"
    
    # Backup de la BDD si elle existe
    if [ -f "data/plagiatia.db" ]; then
        cp data/plagiatia.db "backups/plagiatia_pre_deploy_$TIMESTAMP.db"
        log_info "Backup BDD effectué"
    fi
    
    # Push du schema Prisma
    bun run db:push
    
    log_success "Base de données prête"
}

start_application() {
    log_step "Démarrage de l'application"
    
    cd "$DEPLOY_DIR"
    
    # Vérifier si PM2 connaît déjà cette app
    if pm2 describe $APP_NAME > /dev/null 2>&1; then
        log_info "Application existante dans PM2, redémarrage propre..."
        
        # Arrêt gracieux
        pm2 stop $APP_NAME 2>/dev/null || true
        sleep 2
        
        # Mise à jour et redémarrage
        pm2 delete $APP_NAME 2>/dev/null || true
    fi
    
    # Copier ecosystem config si disponible
    if [ -f "deploy/templates/ecosystem.config.js" ]; then
        cp deploy/templates/ecosystem.config.js ecosystem.config.js
        
        # Adapter le port si nécessaire
        if [ -n "$APP_PORT" ] && [ "$APP_PORT" != "3000" ]; then
            sed -i "s/PORT: 3000/PORT: $APP_PORT/g" ecosystem.config.js
        fi
        
        pm2 start ecosystem.config.js --env production
    else
        # Démarrage manuel
        pm2 start .next/standalone/server.js \
            --name "$APP_NAME" \
            --env production \
            --max-memory-restart 500M
    fi
    
    pm2 save
    
    sleep 3
    
    # Vérification
    if pm2 list | grep -q "$APP_NAME.*online"; then
        log_success "Application démarrée sur le port ${APP_PORT:-3000}"
    else
        log_error "Problème au démarrage!"
        pm2 logs $APP_NAME --lines 20 --nostream 2>/dev/null || true
        exit 1
    fi
}

configure_nginx() {
    log_step "Configuration Nginx pour $DOMAIN"
    
    local NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
    local PORT=${APP_PORT:-3000}
    
    # Créer le snippet proxy s'il n'existe pas
    mkdir -p /etc/nginx/snippets
    if [ ! -f "/etc/nginx/snippets/plagiatia-proxy.conf" ]; then
        cat > /etc/nginx/snippets/plagiatia-proxy.conf << 'PROXYEOF'
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_connect_timeout 60s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
proxy_buffering on;
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;
proxy_request_buffering off;
PROXYEOF
        log_success "Snippet proxy créé"
    fi
    
    # Créer la configuration Nginx pour ce domaine
    cat > "$NGINX_CONF" << EOF
# PlagiatIA - $DOMAIN
# Port backend: $PORT
# Généré automatiquement le $(date -R)

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=plagiatia_api_limit:10m rate=100r/s;
limit_req_zone \$binary_remote_addr zone=plagiatia_login_limit:10m rate=5r/m;

upstream plagiatia_backend_${APP_PORT} {
    server 127.0.0.1:$PORT;
    keepalive 64;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS (activer après SSL)
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL (à configurer avec certbot)
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    
    access_log /var/log/nginx/${APP_NAME}_access.log combined buffer=512k flush=1m;
    error_log /var/log/nginx/${APP_NAME}_error.log warn;
    
    # Main app
    location / {
        proxy_pass http://plagiatia_backend_${APP_PORT};
        include /etc/nginx/snippets/plagiatia-proxy.conf;
        
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API with rate limiting
    location /api/ {
        limit_req zone=plagiatia_api_limit burst=50 nodelay;
        
        proxy_pass http://plagiatia_backend_${APP_PORT};
        include /etc/nginx/snippets/plagiatia-proxy.conf;
        
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
    
    # Login protection
    location /api/auth/login {
        limit_req zone=plagiatia_login_limit burst=3 nodelay;
        proxy_pass http://plagiatia_backend_${APP_PORT};
        include /etc/nginx/snippets/plagiatia-proxy.conf;
    }
    
    # Upload endpoint
    location /api/documents {
        client_max_body_size 100M;
        proxy_pass http://plagiatia_backend_${APP_PORT};
        include /etc/nginx/snippets/plagiatia-proxy.conf;
        proxy_connect_timeout 120s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
    
    # Static assets cache
    location /_next/static/ {
        proxy_pass http://plagiatia_backend_${APP_PORT};
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Health check (no logging)
    location /api/health {
        proxy_pass http://plagiatia_backend_${APP_PORT};
        access_log off;
    }
}
EOF
    
    # Activer le site
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    
    # Tester la configuration
    if nginx -t 2>&1; then
        systemctl reload nginx
        log_success "Nginx configuré pour $DOMAIN (port backend: $PORT)"
    else
        log_error "Erreur de configuration Nginx!"
        rm -f "/etc/nginx/sites-enabled/$APP_NAME"
        exit 1
    fi
}

setup_ssl() {
    log_step "Configuration SSL/TLS avec Certbot"
    
    # Vérifier si le domaine résout déjà
    if dig +short $DOMAIN | grep -q "[0-9]"; then
        log_info "Domaine $DOMAIN résout correctement"
        
        # Tenter la configuration SSL
        if certbot --nginx -d "$DOMAIN" --email admin@aenews.net --agree-tos --redirect --no-eff-email --non-interactive 2>&1; then
            log_success "SSL configuré pour $DOMAIN"
        else
            log_warn "SSL non configuré (le domaine doit pointer vers ce serveur)"
            log_info "Vous pouvez configurer SSL plus tard avec:"
            log_info "  certbot --nginx -d $DOMAIN --email admin@aenews.net"
        fi
    else
        log_warn "Le domaine $DNS ne pointe pas encore vers ce serveur"
        log_info "Configurez votre DNS puis relancez:"
        log_info "  certbot --nginx -d $DOMAIN"
    fi
}

#===============================================================================
# RÉSUMÉ FINAL
#===============================================================================

print_summary() {
    local PORT=${APP_PORT:-3000}
    
    cat << SUMMARY

╔══════════════════════════════════════════════════════════════════════════╗
║                    ✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS                      ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  🌐 Application:   https://$DOMAIN                              ║
║  📁 Répertoire:    $DEPLOY_DIR                         ║
║  🔌 Port Backend:  $PORT                                          ║
║  📊 Process Manager: PM2                                             ║
║  🔧 Runtime:       Bun                                             ║
║                                                                            ║
╠══════════════════════════════════════════════════════════════════════════╣
║                          COMMANDES UTILES                                ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  📋 Statut:         pm2 status                                           ║
║  📜 Logs:           pm2 logs $APP_NAME --lines 100                  ║
║  🔄 Redémarrer:     pm2 restart $APP_NAME                             ║
║  🔍 Debug:          pm2 describe $APP_NAME                            ║
║  🌐 Reload Nginx:   nginx -t && systemctl reload nginx                   ║
║                                                                            ║
║  🔄 Mettre à jour:  cd $DEPLOY_DIR && git pull && \\       ║
║                     bun run build && pm2 restart $APP_NAME              ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════╝

SUMMARY
}

#===============================================================================
# MAIN EXECUTION
#===============================================================================

main() {
    clear
    cat << 'BANNER'

╔══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║   ███████╗ ██████╗ ██████╗  █████╗ ███████╗                                 ║
║   ██╔════╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝                                 ║
║   ███████╗██║   ██║██████╔╝███████║███████╗                                 ║
║   ╚════██║██║   ██║██╔══██╗██╔══██║╚════██║                                 ║
║   ███████║╚██████╔╝██║  ██║██║  ██║███████║                                 ║
║   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝                                 ║
║                                                                            ║
║              🎓 Plateforme Anti-Plagiat IA v2.0                             ║
║              🚀 Script de Déploiement Professionnel                        ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════╝

BANNER
    
    echo ""
    log_info "Domaine cible: ${GREEN}$DOMAIN${NC}"
    log_info "Répertoire: ${GREEN}$DEPLOY_DIR${NC}"
    echo ""
    
    # Phase 1: Vérifications préalables
    log_header "PHASE 1: VÉRIFICATIONS PRÉALABLES"
    check_root
    check_connectivity
    
    # Phase 2: Analyse de l'environnement
    log_header "PHASE 2: ANALYSE DE L'ENVIRONNEMENT"
    analyze_environment
    find_available_port
    detect_existing_apps
    
    # Confirmation avant de continuer
    echo ""
    read -p "$(echo -e ${YELLOW}[?]${NC} Continuer avec le déploiement? (o/N): )" CONFIRM
    if [[ "$CONFIRM" != "o" && "$CONFIRM" != "O" && "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        log_info "Déploiement annulé"
        exit 0
    fi
    
    # Phase 3: Installation des dépendances
    log_header "PHASE 3: INSTALLATION DES DÉPENDANCES"
    install_bun_if_needed
    install_pm2_if_needed
    install_nginx_if_needed
    
    # Phase 4: Déploiement de l'application
    log_header "PHASE 4: DÉPLOIEMENT DE L'APPLICATION"
    clone_repository
    setup_environment
    install_dependencies
    build_application
    setup_database
    start_application
    
    # Phase 5: Configuration web
    log_header "PHASE 5: CONFIGURATION WEB (NGINX + SSL)"
    configure_nginx
    setup_ssl
    
    # Finalisation
    print_summary
    
    log_success "🎉 PlagiatIA est maintenant déployé sur https://$DOMAIN"
}

# Exécution
main "$@"
