# Timeline Watcher

Polls your X timeline every 6 hours and sends a batch to OpenClaw.

## Setup

1. Copy credentials:
```bash
cp .env.example .env
# Edit .env with your X API credentials

# Create tokens.json with your OAuth tokens (from auth flow)
```

2. Test locally:
```bash
node timeline.js
```

3. Setup cron (every 6 hours):
```bash
# Run the setup script
./setup-cron.sh

# Or manually add to crontab:
crontab -e
# Add: 0 2,8,14,20 * * * cd /path/to/timeline-watcher && /usr/bin/node timeline.js >> poll.log 2>&1
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| X_CLIENT_ID | X API Client ID | required |
| X_CLIENT_SECRET | X API Client Secret | required |
| MAX_TWEETS_PER_POLL | Max tweets per poll | 50 |
| OPENCLAW_CMD | OpenClaw command | `openclaw` |
| OPENCLAW_MODE | Event mode | `next-heartbeat` |
| TOKENS_FILE | Path to tokens.json | `./tokens.json` |
| STATE_FILE | Path to state.json | `./state.json` |

## How it works

1. Cron triggers `timeline.js` every 6 hours
2. Script fetches your timeline via X API
3. Filters out tweets you've already seen
4. Sends a batch summary to OpenClaw as a system event
5. OpenClaw processes it during the next heartbeat
