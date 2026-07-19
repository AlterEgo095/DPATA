#!/bin/bash
cd /home/z/my-project
while true; do
    echo "$(date): Starting Next.js server..."
    bun --hot next dev -p 3000 2>&1 | tee -a /home/z/my-project/server-output.log
    EXIT_CODE=$?
    echo "$(date): Server exited with code $EXIT_CODE, restarting in 3s..."
    sleep 3
done
