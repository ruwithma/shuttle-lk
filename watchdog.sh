#!/bin/bash
while true; do
  cd /home/z/my-project
  node node_modules/.bin/next dev -p 3000 2>&1
  echo "[$(date)] Server exited, restarting in 2s..." >> /home/z/my-project/watchdog.log
  sleep 2
done
