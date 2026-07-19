#!/bin/bash
# ============================================================
# DPATA Server Watchdog - Script de surveillance professionnelle
# Maintient le serveur Next.js en fonctionnement permanent
# ============================================================

PROJECT_DIR="/home/z/my-project"
LOG_FILE="$PROJECT_DIR/server.log"
PID_FILE="$PROJECT_DIR/server.pid"
MAX_RESTARTS=100
RESTART_DELAY=3

# Compteurs
restart_count=0

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Nettoyage au démarrage
cleanup() {
    log "🧹 Nettoyage des anciens processus..."
    pkill -9 -f "next-server" 2>/dev/null
    pkill -9 -f "next dev" 2>/dev/null
    sleep 2
}

# Démarrage du serveur
start_server() {
    cd "$PROJECT_DIR"
    log "🚀 Démarrage du serveur Next.js (restart #$((restart_count + 1)))..."
    
    # Lancer le serveur en foreground
    bun --hot next dev -p 3000 2>&1 | tee -a "$LOG_FILE"
    
    EXIT_CODE=$?
    return $EXIT_CODE
}

# Gestion de l'arrêt propre
trap 'log "🛑 Arrêt du watchdog demandé"; cleanup; exit 0' SIGTERM SIGINT

# Point d'entrée principal
log "=========================================="
log "🎓 DPATA Server Watchdog - Démarrage"
log "=========================================="

cleanup

while [ $restart_count -lt $MAX_RESTARTS ]; do
    start_server
    
    if [ $? -ne 0 ]; then
        restart_count=$((restart_count + 1))
        log "⚠️ Serveur arrêté (code: $?) - Redémarrage dans ${RESTART_DELAY}s... ($restart_count/$MAX_RESTARTS)"
        sleep $RESTART_DELAY
    else
        log "✅ Serveur arrêté normalement"
        break
    fi
done

if [ $restart_count -ge $MAX_RESTARTS ]; then
    log "❌ Nombre maximum de redémarrages atteint ($MAX_RESTARTS)"
fi

log "👋 Watchdog terminé"
