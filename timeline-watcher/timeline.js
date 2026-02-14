#!/usr/bin/env node
/**
 * Timeline Watcher - Polls X timeline and sends batch to OpenClaw
 * Run via cron every 6 hours
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Load .env file manually (no external deps)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

// Config
const CONFIG = {
  clientId: process.env.X_CLIENT_ID,
  clientSecret: process.env.X_CLIENT_SECRET,
  maxTweetsPerPoll: parseInt(process.env.MAX_TWEETS_PER_POLL || '50'),
  tokensFile: process.env.TOKENS_FILE || path.join(__dirname, 'tokens.json'),
  stateFile: process.env.STATE_FILE || path.join(__dirname, 'state.json'),
  openclawCmd: process.env.OPENCLAW_CMD || 'openclaw',
  mode: process.env.OPENCLAW_MODE || 'next-heartbeat',
};

// Load tokens
function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG.tokensFile, 'utf-8'));
  } catch (err) {
    console.error('Failed to load tokens:', err.message);
    process.exit(1);
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(CONFIG.tokensFile, JSON.stringify(tokens, null, 2));
}

// Load state (seen tweets)
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf-8'));
  } catch {
    return { seenTweets: [], lastPoll: null };
  }
}

function saveState(state) {
  fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
}

// Refresh access token
async function refreshToken(tokens) {
  console.log('🔄 Refreshing access token...');
  
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token
    })
  });
  
  const newTokens = await res.json();
  
  if (newTokens.error) {
    throw new Error(`Token refresh failed: ${newTokens.error_description || newTokens.error}`);
  }
  
  saveTokens(newTokens);
  console.log('✅ Token refreshed');
  return newTokens;
}

// Get user ID
async function getUserId(tokens) {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  if (res.status === 401) {
    const newTokens = await refreshToken(tokens);
    return getUserId(newTokens);
  }
  
  const data = await res.json();
  return { userId: data.data.id, tokens };
}

// Fetch timeline
async function getTimeline(tokens, userId) {
  const url = new URL(`https://api.twitter.com/2/users/${userId}/timelines/reverse_chronological`);
  url.searchParams.set('max_results', String(CONFIG.maxTweetsPerPoll));
  url.searchParams.set('tweet.fields', 'created_at,author_id,text,public_metrics');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'username,name');
  
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  if (res.status === 401) {
    const newTokens = await refreshToken(tokens);
    return getTimeline(newTokens, userId);
  }
  
  if (res.status === 429) {
    console.log('⚠️ Rate limited');
    return { data: [], includes: {} };
  }
  
  return res.json();
}

// Send to OpenClaw
function sendToOpenClaw(message) {
  return new Promise((resolve) => {
    const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/`/g, '\\`');
    const cmd = `${CONFIG.openclawCmd} system event --text "${escapedMessage}" --mode ${CONFIG.mode}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('OpenClaw error:', error.message);
        resolve(false);
      } else {
        console.log('✅ Sent to OpenClaw');
        resolve(true);
      }
    });
  });
}

// Format tweets into a batch message
function formatBatch(tweets, authors) {
  const authorMap = {};
  if (authors) {
    for (const user of authors) {
      authorMap[user.id] = user;
    }
  }
  
  let msg = `📱 Timeline Update (${tweets.length} tweets)\n\n`;
  msg += `Estos son los tweets recientes de tu feed. Revisalos y si hay algo interesante para mí, contame.\n\n`;
  msg += `---\n\n`;
  
  for (const tweet of tweets) {
    const author = authorMap[tweet.author_id] || { username: 'unknown', name: 'Unknown' };
    const metrics = tweet.public_metrics || {};
    const engagement = metrics.like_count + metrics.retweet_count + metrics.reply_count;
    
    msg += `@${author.username}`;
    if (engagement > 100) msg += ` 🔥`;
    msg += `:\n${tweet.text}\n\n`;
  }
  
  return msg;
}

// Main
async function main() {
  console.log('🚀 Timeline Watcher - Poll started');
  console.log(`⏰ ${new Date().toISOString()}`);
  
  let tokens = loadTokens();
  const state = loadState();
  const seenSet = new Set(state.seenTweets || []);
  
  try {
    // Get user ID (and potentially refresh token)
    const result = await getUserId(tokens);
    tokens = result.tokens;
    const userId = result.userId;
    
    console.log(`👤 User: ${userId}`);
    
    // Fetch timeline
    const timeline = await getTimeline(tokens, userId);
    
    if (!timeline.data || timeline.data.length === 0) {
      console.log('No tweets found');
      return;
    }
    
    // Filter out seen tweets
    const newTweets = timeline.data.filter(t => !seenSet.has(t.id));
    
    console.log(`📊 Found ${timeline.data.length} tweets, ${newTweets.length} new`);
    
    if (newTweets.length === 0) {
      console.log('No new tweets to send');
      return;
    }
    
    // Format and send batch
    const message = formatBatch(newTweets, timeline.includes?.users);
    await sendToOpenClaw(message);
    
    // Update state
    for (const tweet of newTweets) {
      seenSet.add(tweet.id);
    }
    
    // Keep only last 500 tweet IDs
    const seenArray = [...seenSet].slice(-500);
    
    saveState({
      seenTweets: seenArray,
      lastPoll: new Date().toISOString(),
      lastCount: newTweets.length
    });
    
    console.log('✅ Poll complete');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
