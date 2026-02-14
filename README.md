# Timeline Watcher

Polls your X timeline every 6 hours and sends interesting tweets to OpenClaw.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌─────┐
│   X API     │ ──▶ │ Timeline Watcher │ ──▶ │  OpenClaw   │ ──▶ │ You │
└─────────────┘     └──────────────────┘     └─────────────┘     └─────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Dashboard  │
                    └─────────────┘
```

## Components

### `/timeline-watcher`
Node.js script that:
- Polls your X timeline via OAuth 2.0
- Filters out already-seen tweets
- Sends batch summary to OpenClaw as a system event
- Runs via cron every 6 hours (2am, 8am, 2pm, 8pm)

### `/webhook-server`
HTTP server that:
- Receives webhook POSTs and forwards to OpenClaw
- Manages OpenClaw config remotely
- Runs on EC2 via pm2

### `/dashboard`
Next.js dashboard showing:
- Polling status and history
- Manual poll trigger
- Schedule overview

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/felipegoulu/timeline-watcher.git
cd timeline-watcher

# Setup timeline watcher
cd timeline-watcher
cp .env.example .env
# Edit .env with your X API credentials
# Create tokens.json from OAuth flow
```

### 2. Deploy to EC2

```bash
# On EC2
cd ~/timeline-watcher

# Install deps
cd timeline-watcher && npm install
cd ../webhook-server && npm install
cd ../dashboard && npm install && npm run build

# Start webhook server
cd ../webhook-server
pm2 start server.js --name webhook

# Setup cron for timeline polling
cd ../timeline-watcher
./setup-cron.sh
```

### 3. Verify

```bash
# Test poll manually
cd timeline-watcher
node timeline.js

# Check cron
crontab -l | grep timeline
```

## Environment Variables

### timeline-watcher/.env

| Variable | Description |
|----------|-------------|
| X_CLIENT_ID | X API OAuth 2.0 Client ID |
| X_CLIENT_SECRET | X API OAuth 2.0 Client Secret |
| MAX_TWEETS_PER_POLL | Max tweets per poll (default: 50) |
| OPENCLAW_CMD | OpenClaw CLI command (default: openclaw) |
| OPENCLAW_MODE | Event mode (default: next-heartbeat) |

## Cost

- **X API:** Pay-per-use (~$0.10-0.50/day for 200 tweets)
- **EC2:** t2.micro free tier eligible
- **Vercel:** Free for dashboard

## License

MIT
