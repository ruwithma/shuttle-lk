#!/bin/bash
if ! pgrep -f "next-server" > /dev/null 2>&1; then
  pkill -f "next dev" 2>/dev/null
  cd /home/z/my-project
  nohup node node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
  echo "[$(date)] Server restarted" >> /home/z/my-project/server-restarts.log
fi
