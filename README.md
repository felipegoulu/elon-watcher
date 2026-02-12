# Elon Watcher 🐦

Monitor tweets from any X/Twitter account and get notified via webhook when there's a new post.

Uses [Apify Tweet Scraper](https://apify.com/apidojo/tweet-scraper) to fetch tweets (no X API key needed).

## How it works

1. Polls Apify every N minutes for the latest tweets from the target account
2. Compares against the last seen tweet ID
3. Sends new tweets to your webhook URL as JSON

## Setup

### 1. Get an Apify API token

1. Create an account at [apify.com](https://apify.com)
2. Go to [Settings > Integrations](https://console.apify.com/account/integrations)
3. Copy your API token

### 2. Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/elon-watcher)

Or manually:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set APIFY_TOKEN=your_token_here
railway variables set WEBHOOK_URL=https://your-webhook.com/endpoint
railway variables set TWITTER_HANDLE=elonmusk
railway variables set POLL_INTERVAL_MINUTES=5

# Deploy
railway up
```

### 3. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APIFY_TOKEN` | ✅ | - | Your Apify API token |
| `WEBHOOK_URL` | ✅ | - | URL to receive new tweets |
| `TWITTER_HANDLE` | ❌ | `elonmusk` | Twitter handle to monitor |
| `POLL_INTERVAL_MINUTES` | ❌ | `5` | How often to check for new tweets |
| `WEBHOOK_SECRET` | ❌ | - | Secret for HMAC signature |
| `STATE_FILE` | ❌ | `./state.json` | Path to persist last seen tweet |

## Webhook Payload

When a new tweet is detected, the following JSON is POSTed to your webhook:

```json
{
  "event": "new_tweet",
  "timestamp": "2026-02-11T23:30:00.000Z",
  "tweet": {
    "id": "1234567890",
    "url": "https://x.com/elonmusk/status/1234567890",
    "text": "Tweet content here...",
    "createdAt": "Tue Feb 11 23:30:00 +0000 2026",
    "author": "elonmusk",
    "authorName": "Elon Musk",
    "replyCount": 1234,
    "retweetCount": 5678,
    "likeCount": 90123,
    "quoteCount": 456,
    "isRetweet": false,
    "isQuote": false,
    "isReply": false
  }
}
```

### Webhook Signature Verification

If `WEBHOOK_SECRET` is set, requests include an `X-Webhook-Signature` header:

```
X-Webhook-Signature: sha256=<hmac-sha256-hex>
```

Verify it in your webhook handler:

```javascript
import crypto from 'crypto';

function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Costs

- **Apify**: ~$0.40 per 1,000 tweets scraped
- **Railway**: Free tier includes 500 hours/month (enough for 24/7)

For monitoring 1 account with 5-minute intervals:
- ~288 polls/day × 10 tweets = ~2,880 tweets/day
- Monthly cost: ~$35/month

To reduce costs, increase `POLL_INTERVAL_MINUTES` (e.g., 15 min = ~$12/month).

## Local Development

```bash
# Clone the repo
git clone https://github.com/your-username/elon-watcher.git
cd elon-watcher

# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env

# Run
npm start
```

## License

MIT
