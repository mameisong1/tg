#!/bin/bash
# Start Chrome
bash /root/chrome &
sleep 4

# Verify Chrome is running
if curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
  echo "Chrome is running, starting test..."
  cd /TG/temp/QA-20260416-02 && node browser-test.js
else
  echo "❌ Chrome failed to start"
  exit 1
fi
