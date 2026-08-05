#!/bin/bash
# PlagiatIA Backup Script
BACKUP_DIR="/opt/plagiatia/backups"
DATA_DIR="/opt/plagiatia/data"
MAX_BACKUPS=7

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/plagiatia_backup_$TIMESTAMP.tar.gz"

# Backup data directory
tar -czf "$BACKUP_FILE" -C /opt/plagiatia data/ ecosystem.plagiatia.config.js 2>/dev/null

if [ $? -eq 0 ]; then
    # Clean old backups
    ls -t "$BACKUP_DIR"/plagiatia_backup_*.tar.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f 2>/dev/null
    echo "[$(date)] Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "[$(date)] Backup FAILED"
fi
