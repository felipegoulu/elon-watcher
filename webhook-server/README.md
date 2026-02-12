# Tweet Webhook Receiver for OpenClaw

Receives tweets from Tweet Watcher and notifies OpenClaw.

## Setup on EC2

```bash
# Clone or copy files
cd /opt
git clone https://github.com/felipegoulu/elon-watcher.git
cd elon-watcher/webhook-server

# Run directly
PORT=3001 node server.js

# Or with PM2
pm2 start server.js --name tweet-webhook
pm2 save
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `OPENCLAW_CMD` - Path to openclaw CLI (default: `openclaw`)
- `TWEET_LOG` - Fallback log file (default: `./tweets.log`)

## Endpoints

- `GET /health` - Health check
- `POST /` or `POST /webhook` - Receive tweet webhook

## Configure Tweet Watcher

In the Tweet Watcher dashboard, set webhook URL to:

```
http://YOUR_EC2_IP:3001/webhook
```

## Systemd Service (optional)

```bash
sudo nano /etc/systemd/system/tweet-webhook.service
```

```ini
[Unit]
Description=Tweet Webhook Receiver
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/elon-watcher/webhook-server
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable tweet-webhook
sudo systemctl start tweet-webhook
```
