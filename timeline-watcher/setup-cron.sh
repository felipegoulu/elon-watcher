#!/bin/bash
# Setup cron job for timeline watcher
# Runs at 2am, 8am, 2pm, 8pm (every 6 hours)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_PATH=$(which node)
CRON_CMD="0 2,8,14,20 * * * cd $SCRIPT_DIR && $NODE_PATH timeline.js >> poll.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "timeline.js"; then
    echo "Cron job already exists. Updating..."
    # Remove existing timeline.js cron
    crontab -l | grep -v "timeline.js" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo "✅ Cron job installed:"
echo "$CRON_CMD"
echo ""
echo "Current crontab:"
crontab -l | grep timeline
