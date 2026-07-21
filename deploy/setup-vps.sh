#!/bin/bash
#===============================================================================
# PlagiatIA - Script d'Installation VPS Complet
# Domaine: plagiatia.aenews.net
# Server IP: 95.111.226.63
#
# Ce script automatise l'installation complète d'un serveur Ubuntu/Debian
# pour héberger PlagiatIA avec:
# - Bun Runtime (pas Node.js!)
# - Nginx reverse proxy
# - SSL/TLS avec Certbot
# - PM2 process manager
# - Pare-feu UFW + Fail2Ban
#
# Usage:
#   sudo ./setup-vps.sh
#
# Ou avec arguments:
#   sudo ./setup-vps.sh [domaine] [email]
#   sudo ./setup-vps.sh plagiatia.aenews.net admin@aenews.net
#===============================================================================

set -e

#===============================================================================
# CONFIGURATION
#===============================================================================

DOMAIN="${1:-plagiatia.aenews.net}"
EMAIL="${2:-admin@aenews.net}"
APP_USER="www-data"
APP_DIR="/var/www/plagiatia"
APP_NAME="plagiatia"
SERVER_IP="95.111.226.63"
REPO_URL="https://github.com/AlterEgo095/DPATA.git"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

#===============================================================================
# FONCTIONS UTILITAIRES
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
║          🎓 Plateforme Anti-Plagiat IA v2.0                  ║
║              Script d'Installation VPS v2.0                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"
    log_info "Domaine:       ${GREEN}$DOMAIN${NC}"
    log_info "Email SSL:     ${GREEN}$EMAIL${NC}"
    log_info "IP Serveur:    ${GREEN}$SERVER_IP${NC}"
    log_info "Répertoire:    ${GREEN}$APP_DIR${NC}"
    echo ""
}

check_connectivity() {
    log_step "Vérification de la connectivité Internet"
    
    if ping -c 1 google.com &> /dev/null || ping -c 1 cloudflare.com &> /dev/null; then
        log_success "Connectivité Internet OK"
    else
        log_error "Pas de connexion Internet!"
        exit 1
    fi
}

#===============================================================================
# ÉTAPE 1: MISE À JOUR DU SYSTÈME
#===============================================================================

update_system() {
    log_step "Étape 1/9: Mise à jour du système"
    
    export DEBIAN_FRONTEND=noninteractive
    
    apt update -y
    apt upgrade -y
    
    # Installation des utilitaires essentiels
    apt install -y \
        curl wget git unzip jq \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        ufw fail2ban \
        htop vim nano \
        build-essential python3 \
        lsb-release
    
    # Netoyage des paquets inutiles
    apt autoremove -y
    apt clean
    
    log_success "Système mis à jour et optimisé"
}

#===============================================================================
# ÉTAPE 2: INSTALLATION DE BUN (Runtime Principal)
#===============================================================================

install_bun() {
    log_step "Étape 2/9: Installation de Bun Runtime"
    
    if command -v bun &> /dev/null; then
        local BUN_VERSION=$(bun --version)
        log_warning "Bun déjà installé: v$BUN_VERSION"
        
        # Mise à jour si nécessaire
        curl -fsSL https://bun.sh/install | bash
        log_success "Bun mis à jour: $(bun --version)"
        return
    fi
    
    # Installation officielle de Bun
    curl -fsSL https://bun.sh/install | bash
    
    # Configuration du PATH pour le script courant
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Ajout au PATH global
    echo 'export BUN_INSTALL="$HOME/.bun"' >> /etc/bash.bashrc
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /etc/bash.bashrc
    
    # Lien symbolique pour accès global
    ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun 2>/dev/null || true
    
    log_success "Bun installé: $(bun --version)"
}

#===============================================================================
# ÉTAPE 3: INSTALLATION DE PM2
#===============================================================================

install_pm2() {
    log_step "Étape 3/9: Installation de PM2"
    
    if command -v pm2 &> /dev/null; then
        log_warning "PM2 déjà installé: $(pm2 --version)"
        return
    fi
    
    # Installation via npm (fourni avec Bun)
    bun install -g pm2
    
    # Démarrage auto au boot (systemd)
    pm2 startup systemd -u $APP_USER --hp $APP_DIR 2>/dev/null || true
    pm2 save 2>/dev/null || env PATH=$PATH:$(dirname $(which pm2)) pm2 save 2>/dev/null || true
    
    log_success "PM2 installé: $(pm2 --version)"
}

#===============================================================================
# ÉTAPE 4: INSTALLATION DE NGINX + CERTBOT
#===============================================================================

install_nginx() {
    log_step "Étape 4/9: Installation de Nginx + Certbot"
    
    if command -v nginx &> /dev/null; then
        log_warning "Nginx déjà installé: $(nginx -v 2>&1)"
    else
        apt install -y nginx certbot python3-certbot-nginx
        log_success "Nginx installé"
    fi
    
    # Activation au démarrage
    systemctl enable nginx
    systemctl start nginx
    
    log_success "Nginx actif: $(systemctl is-active nginx)"
}

#===============================================================================
# ÉTAPE 5: CONFIGURATION DU PARE-FEU (UFW)
#===============================================================================

setup_firewall() {
    log_step "Étape 5/9: Configuration du pare-feu UFW"
    
    # Reset des règles existantes
    ufw --force reset
    
    # Règles par défaut (sécurité maximale)
    ufw default deny incoming
    ufw default allow outgoing
    
    # Services autorisés
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Optionnel: Limiter SSH (anti brute-force)
    ufw limit 22/tcp comment 'SSH Rate Limited'
    
    # Activation avec confirmation automatique
    echo "y" | ufw enable
    
    # Rechargement
    ufw reload
    
    ufw status numbered | head -20
    
    log_success "Pare-feu configuré (SSH, HTTP, HTTPS ouverts)"
}

#===============================================================================
# ÉTAPE 6: CONFIGURATION DE FAIL2BAN
#===============================================================================

setup_fail2ban() {
    log_step "Étape 6/9: Configuration de Fail2Ban"
    
    cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = root
action = %(action_mw)s

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200

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

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 3
bantime = 86400
F2BEOF
    
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    log_success "Fail2Ban configuré et actif"
}

#===============================================================================
# ÉTAPE 7: CRÉATION DES RÉPERTOIRES ET UTILISATEURS
#===============================================================================

setup_directories() {
    log_step "Étape 7/9: Création des répertoires"
    
    # Répertoires de l'application
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/logs"
    mkdir -p "$APP_DIR/data"
    mkdir -p "$APP_DIR/backups"
    
    # Répertoire pour Certbot (ACME challenge)
    mkdir -p "/var/www/certbot"
    
    # Snippets Nginx
    mkdir -p "/etc/nginx/snippets"
    
    # Permissions
    chown -R $APP_USER:$APP_USER "$APP_DIR" 2>/dev/null || chown -R www-data:www-data "$APP_DIR"
    chmod 755 "$APP_DIR"
    
    log_success "Répertoires créés dans $APP_DIR"
}

#===============================================================================
# ÉTAPE 8: CONFIGURATION NGINX SNIPPET PROXY
#===============================================================================

configure_nginx_snippet() {
    log_step "Étape 8/9: Configuration Nginx Proxy Snippet"
    
    cat > /etc/nginx/snippets/plagiatia-proxy.conf << 'PROXYEOF'
# PlagiatIA - Proxy configuration for Next.js/Bun backend
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Request-ID $request_id;

# Timeouts optimisés pour Next.js
proxy_connect_timeout 60s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;

# Buffer settings
proxy_buffering on;
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;

# Disable request buffering for large uploads (chunked transfer)
proxy_request_buffering off;
PROXYEOF
    
    log_success "Snippet proxy Nginx créé"
}

#===============================================================================
# ÉTAPE 9: GÉNÉRATION DES SECRETS (.env.production)
#===============================================================================

generate_env_file() {
    log_step "Étape 9/9: Génération des secrets et .env.production"
    
    local ENV_FILE="$APP_DIR/.env.production"
    
    if [ -f "$ENV_FILE" ]; then
        log_warning "Fichier .env existant - Préservation des valeurs actuelles"
        return
    fi
    
    # Génération de secrets sécurisés
    JWT_SECRET=$(openssl rand -base64 64)
    PASSWORD_SALT=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -base32)
    API_KEY=$(openssl rand -hex 32)
    ADMIN_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 16)
    
    cat > "$ENV_FILE" << EOF
#===============================================================================
# PlagiatIA - Variables d'environnement PRODUCTION
# Domaine: $DOMAIN
# Généré automatiquement le $(date -R)
#
# ⚠️  CONSERVER CE FICHIER EN SÉCURITÉ!
#     Ne jamais le commit sur Git!
#===============================================================================

# Environnement
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
APP_URL=https://$DOMAIN

# Secrets d'authentification
JWT_SECRET=$JWT_SECRET
PASSWORD_SALT=$PASSWORD_SALT
SESSION_SECRET=$SESSION_SECRET
JWT_EXPIRES_IN=7d

# Base de données SQLite
DATABASE_URL=file:./data/plagiatia.db

# Compte administrateur par défaut
ADMIN_EMAIL=admin@aenews.net
ADMIN_PASSWORD=$ADMIN_PASS
ADMIN_FIRSTNAME=Admin
ADMIN_LASTNAME=PlagiatIA

# Clés API
API_ENCRYPTION_KEY=$API_KEY
API_RATE_LIMIT_GLOBAL=1000

# Fédération (pour futures universités partenaires)
FEDERATION_ID=\$(hostname)-plagiatia-01
FEDERATION_API_KEY=$(openssl rand -hex 32)

# Logging
LOG_LEVEL=info

# Fonctionnalités
ENABLE_PDF_EXPORT=true
ENABLE_BATCH_PROCESSING=true
ENABLE_PUBLIC_API=true
ENABLE_ADVANCED_STATISTICS=true
ENABLE_AI_DETECTION=true
EOF
    
    # Permissions restrictives
    chmod 600 "$ENV_FILE"
    chown $APP_USER:$APP_USER "$ENV_FILE" 2>/dev/null || true
    
    log_success "Fichier .env.production créé"
    echo ""
    log_warning "═══════════════════════════════════════════════════════"
    log_warning "🔑 MOT DE PASSE ADMINISTRATEUR: ${GREEN}$ADMIN_PASS${NC}"
    log_warning "   Email: admin@aenews.net"
    log_warning "═══════════════════════════════════════════════════════"
    log_warning "⚠️  NOTEZ CES IDENTIFIANTS MAINTENANT!"
    echo ""
}

#===============================================================================
# RÉSUMÉ FINAL
#===============================================================================

print_summary() {
    cat << SUMMARY

╔══════════════════════════════════════════════════════════════════════════╗
║                    ✅ INSTALLATION TERMINÉE AVEC SUCCÈS                   ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  🌐 Domaine:      https://$DOMAIN                              ║
║  📁 Répertoire:   $APP_DIR                              ║
║  👤 Utilisateur:  $APP_USER                                           ║
║  🔧 Runtime:      Bun $(bun --version 2>/dev/null || echo "N/A")                          ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                     PROCHAINES ÉTAPES DE DÉPLOIEMENT                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  1️⃣  CLONER LE REPOSITORY:                                              ║
║      cd $APP_DIR                                                   ║
║      git clone $REPO_URL temp && mv temp/* . && rm -rf temp         ║
║                                                                          ║
║  2️⃣  INSTALLER LES DÉPENDANCES & BUILD:                                ║
║      cd $APP_DIR                                                   ║
║      cp .env.production .env.local                                      ║
║      bun install                                                        ║
║      bun run db:push                                                    ║
║      bun run build                                                      ║
║                                                                          ║
║  3️⃣  DÉMARRER AVEC PM2:                                                 ║
║      cp deploy/templates/ecosystem.config.js ecosystem.config.js        ║
║      pm2 start ecosystem.config.js                                      ║
║      pm2 save                                                           ║
║                                                                          ║
║  4️⃣  CONFIGURER NGINX:                                                  ║
║      cp deploy/nginx/plagiatia.aenews.net.conf \\                       ║
║         /etc/nginx/sites-available/                                     ║
║      ln -sf /etc/nginx/sites-available/plagiatia.aenews.net.conf \\     ║
║             /etc/nginx/sites-enabled/                                   ║
║      rm -f /etc/nginx/sites-enabled/default                             ║
║      nginx -t && systemctl reload nginx                                 ║
║                                                                          ║
║  5️⃣  CONFIGURER SSL (Certbot):                                          ║
║      certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos \\
║            --redirect --no-eff-email                                    ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                         COMMANDES UTILES                                 ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  📊 Surveillance:   pm2 logs plagiatia --lines 100                      ║
║  🔄 Redémarrer:     pm2 restart plagiatia                               ║
║  📈 Statuts:        pm2 status                                          ║
║  🔍 Debug:          pm2 describe plagiatia                              ║
║  🌐 Reload Nginx:   nginx -t && systemctl reload nginx                  ║
║  📋 Logs Nginx:     tail -f /var/log/nginx/plagiatia_ssl_access.log     ║
║  🔒 Renouveler SSL: certbot renew --dry-run                             ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝

SUMMARY
}

#===============================================================================
# SCRIPT PRINCIPAL
#===============================================================================

main() {
    banner
    check_root
    check_connectivity
    
    log_info "Démarrage de l'installation complète..."
    echo ""
    
    update_system
    install_bun
    install_pm2
    install_nginx
    setup_firewall
    setup_fail2ban
    setup_directories
    configure_nginx_snippet
    generate_env_file
    
    print_summary
    
    log_success "✨ Prêt pour le déploiement de PlagiatIA!"
}

# Exécution
main "$@"
