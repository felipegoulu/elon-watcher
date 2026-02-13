# PinchMe

Monitor X/Twitter accounts and get alerts via MCP or webhook.

## Architecture

- **Backend** (Railway): Node.js server that polls Apify and sends webhooks
- **MCP Server** (Railway): MCP interface for AI agents
- **Dashboard** (Vercel): Next.js UI to configure handles, webhook URL, and poll interval

## MCP Server

**URL:** `https://pinchme-mcp-production.up.railway.app/sse`

### Tools

| Tool | Description |
|------|-------------|
| `authenticate` | Auth with API key (once per session) |
| `list_handles` | List monitored accounts |
| `add_handle` | Add account to monitor |
| `remove_handle` | Stop monitoring account |
| `configure_handle` | Set mode/prompt/channel per account |
| `get_handle_config` | Get account settings |
| `poll_now` | Force immediate poll |
| `get_recent_tweets` | Get recent tweets |
| `get_status` | Get monitoring status |
| `set_poll_interval` | Change poll frequency |

### Usage

```bash
# Authenticate once
mcporter call 'https://pinchme-mcp-production.up.railway.app/sse.authenticate' \
  --args '{"api_key": "pk_..."}'

# Then use tools without api_key
mcporter call 'https://pinchme-mcp-production.up.railway.app/sse.list_handles'
```

## Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/config` | GET | Get current config |
| `/config` | PUT | Update config (restarts polling) |
| `/status` | GET | Get full status with state |
| `/poll` | POST | Trigger immediate poll |
| `/mcp/activate` | POST | Mark API key as MCP-activated |
| `/mcp/activated-keys` | GET | List MCP-activated keys |

## Deployment

### Backend (Railway)

1. Push to Railway
2. Set env vars:
   - `APIFY_TOKEN=your_token`
   - `DATABASE_URL=postgres://...`

### MCP Server (Railway)

1. Root directory: `mcp-server`
2. Set env: `API_URL=https://your-backend.up.railway.app`

### Dashboard (Vercel)

1. Connect to GitHub repo
2. Root directory: `dashboard`
3. Set env: `NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app`

## Local Development

```bash
# Backend
npm install
APIFY_TOKEN=xxx DATABASE_URL=xxx npm run dev

# MCP Server
cd mcp-server
npm install
API_URL=http://localhost:3000 npm start

# Dashboard
cd dashboard
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000 npm run dev
```

## Webhook Payload

```json
{
  "event": "new_tweet",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "handleConfig": {
    "mode": "now",
    "prompt": "",
    "channel": ""
  },
  "tweet": {
    "id": "...",
    "url": "...",
    "text": "...",
    "createdAt": "...",
    "author": "username"
  }
}
```
