#!/bin/bash
trap "" SIGHUP SIGTERM SIGINT
while true; do
  cd /home/z/my-project
  node node_modules/.bin/next dev -p 3000 2>&1 | tee -a /home/z/my-project/dev.log
  sleep 2
done
