#!/bin/bash
# Watchdog : redémarre automatiquement Next.js s'il crashe
cd /home/z/my-project
while true; do
  if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
    pkill -f "next dev" 2>/dev/null
    sleep 2
    echo "[$(date)] Redémarrage Next.js..." >> /tmp/watchdog.log
    node --max-old-space-size=4096 node_modules/next/dist/bin/next dev -p 3000 >> /tmp/next-watchdog.log 2>&1 &
    sleep 10
  fi
  sleep 30
done
