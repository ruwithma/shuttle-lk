#!/bin/bash
cd /home/z/my-project
while true; do
  node node_modules/.bin/next dev --port 3000
  echo "Server crashed, restarting in 3 seconds..."
  sleep 3
done
