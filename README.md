# Timeline Watcher

Monitor your X timeline and get notified of interesting tweets via OpenClaw.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    RAILWAY                          │
│  ┌─────────────┐    ┌─────────────┐                │
│  │     API     │────│  PostgreSQL │                │
│  │  (Node.js)  │    │   (config)  │                │
│  └──────┬──────┘    └─────────────┘                │
│         │                                           │
│    Polls every Xh                                   │
└─────────┼───────────────────────────────────────────┘
          │ webhook
          ▼
┌─────────────────────┐      ┌─────────────────────┐
│   EC2 (OpenClaw)    │      │  Dashboard (Vercel) │
│   Processes tweets  │      │  Configure settings │
│   Notifies you      │      │  View poll history  │
└─────────────────────┘      └─────────────────────┘
```

## Components

### `/api` - Backend (Railway)
- Polls X timeline on schedule
- Stores config in PostgreSQL
- Sends webhooks to OpenClaw
- Auto-refreshes OAuth tokens

### `/dashboard` - Frontend (Vercel)
- Configure X API credentials
- Set polling frequency
- View poll history
- Manual poll trigger

## Deployment

### 1. Deploy API to Railway

```bash
# Create new Railway project
railway init

# Add PostgreSQL
railway add --database postgres

# Deploy
cd api
railway up
```

Set environment variable in Railway:
- `DATABASE_URL` (auto-set by Railway Postgres)

### 2. Deploy Dashboard to Vercel

```bash
cd dashboard
vercel
```

Set environment variable in Vercel:
- `NEXT_PUBLIC_API_URL` = your Railway API URL

### 3. Configure via Dashboard

1. Open your Vercel dashboard URL
2. Add X API credentials (Client ID, Secret)
3. Add OAuth tokens (from auth flow)
4. Set webhook URL (your EC2 with OpenClaw)
5. Set poll interval

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/config | Get config (sanitized) |
| PUT | /api/config | Update config |
| GET | /api/status | Get current status |
| POST | /api/poll | Trigger manual poll |
| GET | /api/polls | Get poll history |

## License

MIT
