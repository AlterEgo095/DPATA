#!/bin/bash
cd /home/z/my-project
export NODE_ENV=development

echo "$(date): === DPATA Server Manager Started ===" > /home/z/my-project/dpata-status.log

while true; do
    echo "$(date): Starting Next.js server..." >> /home/z/my-project/dpata-status.log
    
    # Lancer next dev et attendre sa fin
    bun next dev -p 3000 >> /home/z/my-project/dpata-server.log 2>&1
    
    EXIT_CODE=$?
    echo "$(date): Server exited with code $EXIT_CODE" >> /home/z/my-project/dpata-status.log
    
    # Attendre avant de redémarrer
    sleep 3
done
