import { ApifyClient } from 'apify-client';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// ============================================
// Configuration (from environment variables)
// ============================================
const config = {
  // Apify
  apifyToken: process.env.APIFY_TOKEN,
  
  // Target account
  twitterHandle: process.env.TWITTER_HANDLE || 'elonmusk',
  
  // Polling interval (in minutes)
  pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES || '5'),
  
  // Webhook URL to send new tweets
  webhookUrl: process.env.WEBHOOK_URL,
  
  // Optional: webhook secret for signature
  webhookSecret: process.env.WEBHOOK_SECRET,
  
  // State file path
  stateFile: process.env.STATE_FILE || './state.json',
};

// ============================================
// State management
// ============================================
function loadState() {
  try {
    if (existsSync(config.stateFile)) {
      const data = readFileSync(config.stateFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading state:', err.message);
  }
  return { lastSeenTweetId: null, lastSeenTimestamp: null };
}

function saveState(state) {
  try {
    writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Error saving state:', err.message);
  }
}

// ============================================
// Apify Tweet Scraper
// ============================================
async function fetchLatestTweets(client, handle, maxItems = 10) {
  console.log(`[${new Date().toISOString()}] Fetching latest tweets from @${handle}...`);
  
  const input = {
    searchTerms: [`from:${handle}`],
    sort: 'Latest',
    maxItems: maxItems,
  };

  // Run the Tweet Scraper actor
  const run = await client.actor('apidojo/tweet-scraper').call(input, {
    waitSecs: 120,
  });

  // Fetch results from the dataset
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  
  console.log(`[${new Date().toISOString()}] Fetched ${items.length} tweets`);
  
  return items;
}

// ============================================
// Webhook sender
// ============================================
async function sendToWebhook(tweet) {
  if (!config.webhookUrl) {
    console.log('[Webhook] No webhook URL configured, skipping');
    return;
  }

  const payload = {
    event: 'new_tweet',
    timestamp: new Date().toISOString(),
    tweet: {
      id: tweet.id,
      url: tweet.url,
      text: tweet.text,
      createdAt: tweet.createdAt,
      author: tweet.author?.userName || config.twitterHandle,
      authorName: tweet.author?.name,
      replyCount: tweet.replyCount,
      retweetCount: tweet.retweetCount,
      likeCount: tweet.likeCount,
      quoteCount: tweet.quoteCount,
      isRetweet: tweet.isRetweet,
      isQuote: tweet.isQuote,
      isReply: tweet.isReply,
    },
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  // Add signature if secret is configured
  if (config.webhookSecret) {
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.log(`[Webhook] Sent tweet ${tweet.id} to webhook`);
  } catch (err) {
    console.error(`[Webhook] Error sending to webhook:`, err.message);
  }
}

// ============================================
// Main polling loop
// ============================================
async function poll(client) {
  const state = loadState();
  
  try {
    const tweets = await fetchLatestTweets(client, config.twitterHandle);
    
    if (tweets.length === 0) {
      console.log(`[${new Date().toISOString()}] No tweets found`);
      return;
    }

    // Sort by ID descending (newest first)
    tweets.sort((a, b) => b.id.localeCompare(a.id));

    // Find new tweets (those newer than lastSeenTweetId)
    const newTweets = [];
    for (const tweet of tweets) {
      if (!state.lastSeenTweetId || tweet.id > state.lastSeenTweetId) {
        newTweets.push(tweet);
      }
    }

    if (newTweets.length === 0) {
      console.log(`[${new Date().toISOString()}] No new tweets`);
      return;
    }

    console.log(`[${new Date().toISOString()}] Found ${newTweets.length} new tweet(s)`);

    // Send new tweets to webhook (oldest first, to maintain chronological order)
    newTweets.reverse();
    for (const tweet of newTweets) {
      console.log(`[New Tweet] ${tweet.id}: ${tweet.text?.substring(0, 100)}...`);
      await sendToWebhook(tweet);
    }

    // Update state with the newest tweet ID
    state.lastSeenTweetId = tweets[0].id;
    state.lastSeenTimestamp = new Date().toISOString();
    saveState(state);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error during poll:`, err.message);
    if (err.stack) console.error(err.stack);
  }
}

// ============================================
// Main entry point
// ============================================
async function main() {
  console.log('========================================');
  console.log('  Elon Watcher - Tweet Monitor');
  console.log('========================================');
  console.log(`Target: @${config.twitterHandle}`);
  console.log(`Poll interval: ${config.pollIntervalMinutes} minutes`);
  console.log(`Webhook URL: ${config.webhookUrl ? '✓ configured' : '✗ not set'}`);
  console.log(`Webhook secret: ${config.webhookSecret ? '✓ configured' : '✗ not set'}`);
  console.log('========================================\n');

  // Validate required config
  if (!config.apifyToken) {
    console.error('ERROR: APIFY_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!config.webhookUrl) {
    console.warn('WARNING: No WEBHOOK_URL set, tweets will only be logged');
  }

  // Initialize Apify client
  const client = new ApifyClient({ token: config.apifyToken });

  // Initial poll
  await poll(client);

  // Set up recurring poll
  const intervalMs = config.pollIntervalMinutes * 60 * 1000;
  console.log(`\n[${new Date().toISOString()}] Next poll in ${config.pollIntervalMinutes} minutes...`);
  
  setInterval(async () => {
    await poll(client);
    console.log(`[${new Date().toISOString()}] Next poll in ${config.pollIntervalMinutes} minutes...`);
  }, intervalMs);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[Shutdown] Received SIGTERM, exiting...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n[Shutdown] Received SIGINT, exiting...');
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
