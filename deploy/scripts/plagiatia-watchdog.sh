#!/bin/bash
#===============================================================================
# PlagiatIA - Watchdog Script (Systemd Timer)
#
# Ce script vérifie périodiquement si l'application fonctionne correctement
# et la redémarre automatiquement en cas de problème.
#
# Installation:
#   sudo cp plagiatia-watchdog.sh /usr/local/bin/
#   sudo chmod +x /usr/local/bin/plagiatia-watchdog.sh
#   sudo cp plagiatia-watchdog.timer /etc/systemd/system/
#   sudo cp plagiatia-watchdog.service /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now plagiatia-watchdog.timer
#===============================================================================

APP_NAME="plagiatia"
APP_URL="http://127.0.0.1:3000/api/health"
LOG_FILE="/var/www/plagiatia/logs/watchdog.log"
MAX_RESTART_ATTEMPTS=3
RESTART_WINDOW=300  # 5 minutes en secondes

# Couleurs (optionnel)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_health() {
    # Vérifier si l'endpoint health répond
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$APP_URL" 2>/dev/null || echo "000")
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        return 0  # OK
    else
        return 1  # Erreur
    fi
}

check_pm2_status() {
    # Vérifier si PM2 tourne et si l'app est online
    if ! pm2 list | grep -q "$APP_NAME.*online"; then
        return 1  # Pas online
    fi
    return 0
}

count_recent_restarts() {
    # Compter les redémarrages récents pour éviter les boucles infinies
    if [ -f "/tmp/plagiatia_restarts.txt" ]; then
        NOW=$(date +%s)
        COUNT=0
        while read TIMESTAMP; do
            AGE=$((NOW - TIMESTAMP))
            if [ "$AGE" -lt "$RESTART_WINDOW" ]; then
                COUNT=$((COUNT + 1))
            fi
        done < /tmp/plagiatia_restarts.txt
        echo $COUNT
    else
        echo 0
    fi
}

record_restart() {
    echo "$(date +%s)" >> /tmp/plagiatia_restarts.txt
    # Nettoyer les anciennes entrées
    NOW=$(date +%s)
    TEMP_FILE=$(mktemp)
    while read TIMESTAMP; do
        AGE=$((NOW - TIMESTAMP))
        if [ "$AGE" -lt "$RESTART_WINDOW" ]; then
            echo "$TIMESTAMP"
        fi
    done < /tmp/plagiatia_restarts.txt > "$TEMP_FILE"
    mv "$TEMP_FILE" /tmp/plagiatia_restarts.txt
}

restart_app() {
    RECENT_RESTARTS=$(count_recent_restarts)
    
    if [ "$RECENT_RESTARTS" -ge "$MAX_RESTART_ATTEMPTS" ]; then
        log "${RED}[CRITICAL]${NC} Trop de redémarrages récents ($RECENT_RESTARTS dans ${RESTART_WINDOW}s). Abandon."
        # Envoyer une alerte (email, webhook, etc.) - à implémenter selon vos besoins
        return 1
    fi
    
    log "${YELLOW}[WARN]${NC} Redémarrage de l'application..."
    
    pm2 restart "$APP_NAME"
    record_restart
    
    sleep 5
    
    if check_health; then
        log "${GREEN}[OK]${NC} Application redémarrée avec succès"
        return 0
    else
        log "${RED}[ERROR]${NC} L'application ne répond toujours pas après redémarrage"
        return 1
    fi
}

main() {
    # S'assurer que le répertoire de logs existe
    mkdir -p "$(dirname "$LOG_FILE")"
    
    if check_health && check_pm2_status; then
        log "${GREEN}[OK]${NC} Application fonctionnelle"
        
        # Réinitialiser le compteur de restarts si tout va bien depuis un moment
        if [ -f "/tmp/plagiatia_restarts.txt" ]; then
            NOW=$(date +%s)
            LAST_RESTART=$(tail -1 /tmp/plagiatia_restarts.txt)
            AGE=$((NOW - LAST_RESTART))
            if [ "$AGE" -gt "$((RESTART_WINDOW * 2))" ]; then
                rm -f /tmp/plagiatia_restarts.txt
            fi
        fi
        
        exit 0
    else
        log "${YELLOW}[WARN]${NC} Problème détecté, tentative de récupération..."
        
        if check_pm2_status; then
            # PM2 dit que c'est online mais le health check échoue
            log "${YELLOW}[WARN]${NC} Health check échoué, redémarrage..."
            restart_app
        else
            # PM2 ne tourne pas ou app n'est pas online
            log "${YELLOW}[WARN]${NC} Application non détectée par PM2, démarrage..."
            
            RECENT_RESTARTS=$(count_recent_restarts)
            if [ "$RECENT_RESTARTS" -ge "$MAX_RESTART_ATTEMPTS" ]; then
                log "${RED}[CRITICAL]${NC} Trop de tentatives. Intervention manuelle requise."
                exit 1
            fi
            
            cd /var/www/plagiatia
            pm2 start ecosystem.config.js --env production 2>/dev/null || \
            pm2 start .next/standalone/server.js --name "$APP_NAME"
            pm2 save
            record_restart
            
            sleep 5
            
            if check_health; then
                log "${GREEN}[OK]${NC} Application démarrée avec succès"
            else
                log "${RED}[ERROR]${NC} Impossible de démarrer l'application"
                exit 1
            fi
        fi
    fi
}

main
