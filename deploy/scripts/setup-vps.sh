#!/bin/bash
#===============================================================================
# PlagiatIA - Script d'Installation Rapide VPS
#
# Ce script automatise l'installation complète d'un serveur Ubuntu/Debian
# pour héberger PlagiatIA avec Nginx, SSL, et PM2.
#
# Usage:
#   curl -fsSL https://votre-domaine.com/setup.sh | sudo bash -
#   ou
#   sudo ./setup-vps.sh [domaine] [email]
#
# Exemple:
#   sudo ./setup-vps.sh plagiatia.unikin.ac.cd admin@unikin.ac.cd
#===============================================================================

set -e

#===============================================================================
# CONFIGURATION
#===============================================================================

DOMAIN="${1:-plagiatia.unikin.ac.cd}"
EMAIL="${2:-admin@unikin.ac.cd}"
APP_USER="www-data"
APP_DIR="/var/www/plagiatia"
APP_NAME="plagiatia"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[SETUP]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

#===============================================================================
# FONCTIONS
#===============================================================================

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Ce script doit être exécuté en root (sudo)"
        exit 1
    fi
}

banner() {
    cat << 'BANNER'
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ███████╗ ██████╗ ██████╗  █████╗ ███████╗                 ║
║   ██╔════╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝                 ║
║   ███████╗██║   ██║██████╔╝███████║███████╗                 ║
║   ╚════██║██║   ██║██╔══██╗██╔══██║╚════██║                 ║
║   ███████║╚██████╔╝██║  ██║██║  ██║███████║                 ║
║   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝                 ║
║                                                              ║
║           Plateforme Anti-Plagiat IA - UNIKIN               ║
║              Script d'Installation VPS v1.0                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
BANNER
    echo ""
    log_info "Domaine: $DOMAIN"
    log_info "Email: $EMAIL"
    echo ""
}

update_system() {
    log_info "Mise à jour du système..."
    
    apt update -y
    apt upgrade -y
    
    # Installation des utilitaires de base
    apt install -y \
        curl wget git unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        ufw fail2ban \
        htop vim
    
    log_success "Système mis à jour"
}

install_nodejs() {
    log_info "Installation de Node.js 20 LTS..."
    
    if command -v node &> /dev/null && [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -ge 20 ]]; then
        log_warning "Node.js déjà installé: $(node --version)"
        return
    fi
    
    # Ajout du repository NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    
    # Installation
    apt-get install -y nodejs
    
    # Vérification
    log_success "Node.js installé: $(node --version)"
    log_success "npm installé: $(npm --version)"
}

install_pm2() {
    log_info "Installation de PM2..."
    
    if command -v pm2 &> /dev/null; then
        log_warning "PM2 déjà installé: $(pm2 --version)"
        return
    fi
    
    npm install -g pm2
    
    # Démarrage auto au boot
    pm2 startup systemd -u $APP_USER --hp $APP_DIR 2>/dev/null || true
    pm2 save 2>/dev/null || true
    
    log_success "PM2 installé: $(pm2 --version)"
}

install_nginx() {
    log_info "Installation de Nginx..."
    
    if command -v nginx &> /dev/null; then
        log_warning "Nginx déjà installé: $(nginx -v 2>&1)"
        return
    fi
    
    apt install -y nginx certbot python3-certbot-nginx
    
    # Activation au démarrage
    systemctl enable nginx
    systemctl start nginx
    
    log_success "Nginx installé et démarré"
}

setup_firewall() {
    log_info "Configuration du pare-feu UFW..."
    
    # Reset
    ufw --force reset
    
    # Règles par défaut
    ufw default deny incoming
    ufw default allow outgoing
    
    # Services autorisés
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Activation
    echo "y" | ufw enable
    
    log_success "Pare-feu configuré (SSH, HTTP, HTTPS)"
}

setup_fail2ban() {
    log_info "Configuration de Fail2Ban..."
    
    cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = root

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 900

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600
F2BEOF
    
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    log_success "Fail2Ban configuré"
}

create_app_user() {
    log_info "Création de l'utilisateur applicatif..."
    
    if id "$APP_USER" &>/dev/null; then
        log_warning "L'utilisateur $APP_USER existe déjà"
        return
    fi
    
    # L'utilisateur www-data existe généralement sur Debian/Ubuntu
    useradd -r -s /bin/false "$APP_USER" 2>/dev/null || true
    
    log_success "Utilisateur $APP_NAME prêt"
}

create_directories() {
    log_info "Création des répertoires..."
    
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/logs"
    mkdir -p "$APP_DIR/data"
    mkdir -p "$APP_DIR/backups"
    mkdir -p "/var/www/certbot"
    mkdir -p "/etc/nginx/snippets"
    
    # Permissions
    chown -R $APP_USER:$APP_USER "$APP_DIR"
    
    log_success "Répertoires créés"
}

configure_nginx_snippet() {
    log_info "Configuration du snippet proxy Nginx..."
    
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
PROXYEOF
    
    log_success "Snippet proxy créé"
}

generate_secrets() {
    log_info "Génération des secrets..."
    
    local SECRETS_FILE="$APP_DIR/.env.production"
    
    if [ -f "$SECRETS_FILE" ]; then
        log_warning "Fichier .env existant - préservation"
        return
    fi
    
    JWT_SECRET=$(openssl rand -base64 64)
    PASSWORD_SALT=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -base32)
    API_KEY=$(openssl rand -hex 32)
    ADMIN_PASS=$(openssl rand -base64 16)
    
    cat > "$SECRETS_FILE" << EOF
#===============================================================================
# PlagiatIA - Variables d'environnement PRODUCTION
# Généré automatiquement le $(date -R)
#===============================================================================

NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
APP_URL=https://$DOMAIN

# Secrets - À CONSERVER EN SÉCURITÉ!
JWT_SECRET=$JWT_SECRET
PASSWORD_SALT=$PASSWORD_SALT
SESSION_SECRET=$SESSION_SECRET
JWT_EXPIRES_IN=7d

# Base de données
DATABASE_URL=file:./data/plagiatia.db

# Administrateur
ADMIN_EMAIL=admin@$DOMAIN
ADMIN_PASSWORD=$ADMIN_PASS
ADMIN_FIRSTNAME=Admin
ADMIN_LASTNAME=PlagiatIA

# API
API_ENCRYPTION_KEY=$API_KEY
API_RATE_LIMIT_GLOBAL=1000

# Fédération
FEDERATION_ID=\$(hostname)-plagiatia-01
FEDERATION_API_KEY=$(openssl rand -hex 32)

# Logging
LOG_LEVEL=info

# Fonctionnalités
ENABLE_PDF_EXPORT=true
ENABLE_BATCH_PROCESSING=true
ENABLE_PUBLIC_API=true
ENABLE_ADVANCED_STATISTICS=true
EOF
    
    chmod 600 "$SECRETS_FILE"
    chown $APP_USER:$APP_USER "$SECRETS_FILE"
    
    log_success "Secrets générés dans $SECRETS_FILE"
    log_warning "NOTEZ LE MOT DE PASSE ADMIN: $ADMIN_PASS"
}

print_summary() {
    cat << SUMMARY

╔══════════════════════════════════════════════════════════════╗
║                    INSTALLATION TERMINÉE                      ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Domaine:     https://$DOMAIN                    ║
║  Répertoire:  $APP_DIR                       ║
║  Utilisateur: $APP_USER                              ║
║                                                              ║
║  Prochaines étapes:                                         ║
║                                                              ║
║  1. Déployer l'application:                                  ║
║     $ cd $APP_DIR                          ║
║     $ git clone <repo-url> .                                ║
║     $ npm ci && npm run build                               ║
║     $ pm2 start ecosystem.config.js                         ║
║     $ pm2 save                                              ║
║                                                              ║
║  2. Configurer SSL:                                          ║
║     $ certbot --nginx -d $DOMAIN \\
║       -d www.$DOMAIN --email $EMAIL              ║
║                                                              ║
║  3. Configurer Nginx:                                       ║
║     $ cp deploy/nginx/plagiatia.conf \\                     ║
║       /etc/nginx/sites-available/                           ║
║     $ ln -sf /etc/nginx/sites-available/plagiatia.conf \\  ║
║       /etc/nginx/sites-enabled/                             ║
║     $ nginx -t && systemctl reload nginx                   ║
║                                                              ║
║  Commandes utiles:                                           ║
║     pm2 logs plagiatia     # Logs temps réel                ║
║     pm2 status            # État processus                 ║
║     pm2 restart plagiatia  # Redémarrer                    ║
║     nginx -t && systemctl reload nginx                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

SUMMARY
}

#===============================================================================
# MAIN
#===============================================================================

main() {
    banner
    check_root
    
    log_info "Démarrage de l'installation..."
    echo ""
    
    update_system
    install_nodejs
    install_pm2
    install_nginx
    setup_firewall
    setup_fail2ban
    create_app_user
    create_directories
    configure_nginx_snippet
    generate_secrets
    
    print_summary
    
    log_success "Installation terminée!"
}

main "$@"
