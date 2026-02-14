import http from 'http';
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let pollInterval = null;

// ============================================
// Database
// ============================================
async function initDb() {
  pool = new Pool({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      x_client_id TEXT,
      x_client_secret TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      webhook_url TEXT,
      poll_interval_hours INTEGER DEFAULT 6,
      max_tweets_per_poll INTEGER DEFAULT 50,
      openclaw_mode TEXT DEFAULT 'next-heartbeat',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (id = 1)
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seen_tweets (
      tweet_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS poll_log (
      id SERIAL PRIMARY KEY,
      tweets_found INTEGER,
      tweets_new INTEGER,
      status TEXT,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  
  // Insert default config if not exists
  await pool.query(`
    INSERT INTO config (id) VALUES (1) ON CONFLICT DO NOTHING
  `);
  
  console.log('Database initialized');
}

async function getConfig() {
  const res = await pool.query('SELECT * FROM config WHERE id = 1');
  return res.rows[0] || {};
}

async function updateConfig(updates) {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  
  await pool.query(
    `UPDATE config SET ${setClause}, updated_at = NOW() WHERE id = 1`,
    values
  );
}

// ============================================
// X API
// ============================================
async function refreshToken(config) {
  console.log('Refreshing X API token...');
  
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${config.x_client_id}:${config.x_client_secret}`).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    })
  });
  
  const data = await res.json();
  
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  
  await updateConfig({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
  });
  
  console.log('Token refreshed');
  return data.access_token;
}

async function getValidToken(config) {
  if (!config.access_token) return null;
  
  const expiresAt = config.token_expires_at ? new Date(config.token_expires_at) : null;
  if (expiresAt && expiresAt < new Date(Date.now() + 300000)) {
    return await refreshToken(config);
  }
  
  return config.access_token;
}

async function getUserId(token) {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  return data.data?.id;
}

async function getTimeline(token, userId, maxResults = 50) {
  const url = new URL(`https://api.twitter.com/2/users/${userId}/timelines/reverse_chronological`);
  url.searchParams.set('max_results', String(maxResults));
  url.searchParams.set('tweet.fields', 'created_at,author_id,text,public_metrics');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'username,name');
  
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res.status === 429) {
    throw new Error('Rate limited');
  }
  
  return res.json();
}

// ============================================
// Polling
// ============================================
async function poll() {
  console.log('Starting poll...');
  const config = await getConfig();
  
  if (!config.x_client_id || !config.access_token) {
    console.log('Not configured, skipping poll');
    return { success: false, error: 'Not configured' };
  }
  
  try {
    const token = await getValidToken(config);
    if (!token) throw new Error('No valid token');
    
    const userId = await getUserId(token);
    if (!userId) throw new Error('Could not get user ID');
    
    const timeline = await getTimeline(token, userId, config.max_tweets_per_poll || 50);
    
    if (!timeline.data || timeline.data.length === 0) {
      await pool.query(
        'INSERT INTO poll_log (tweets_found, tweets_new, status) VALUES ($1, $2, $3)',
        [0, 0, 'success']
      );
      return { success: true, found: 0, new: 0 };
    }
    
    // Check which tweets are new
    const tweetIds = timeline.data.map(t => t.id);
    const seenRes = await pool.query(
      'SELECT tweet_id FROM seen_tweets WHERE tweet_id = ANY($1)',
      [tweetIds]
    );
    const seenSet = new Set(seenRes.rows.map(r => r.tweet_id));
    
    const newTweets = timeline.data.filter(t => !seenSet.has(t.id));
    
    console.log(`Found ${timeline.data.length} tweets, ${newTweets.length} new`);
    
    if (newTweets.length > 0 && config.webhook_url) {
      // Build authors map
      const authors = {};
      if (timeline.includes?.users) {
        timeline.includes.users.forEach(u => { authors[u.id] = u; });
      }
      
      // Format message
      let msg = `📱 Timeline Update (${newTweets.length} tweets)\n\n`;
      msg += `Revisá estos tweets de tu feed y contame si hay algo interesante.\n\n---\n\n`;
      
      for (const tweet of newTweets) {
        const author = authors[tweet.author_id] || { username: 'unknown' };
        const metrics = tweet.public_metrics || {};
        const engagement = (metrics.like_count || 0) + (metrics.retweet_count || 0);
        msg += `@${author.username}${engagement > 100 ? ' 🔥' : ''}:\n${tweet.text}\n\n`;
      }
      
      // Send to webhook
      await sendWebhook(config.webhook_url, msg, config.openclaw_mode || 'next-heartbeat');
      
      // Mark tweets as seen
      for (const tweet of newTweets) {
        await pool.query(
          'INSERT INTO seen_tweets (tweet_id) VALUES ($1) ON CONFLICT DO NOTHING',
          [tweet.id]
        );
      }
    }
    
    // Cleanup old seen tweets (keep last 7 days)
    await pool.query(
      "DELETE FROM seen_tweets WHERE created_at < NOW() - INTERVAL '7 days'"
    );
    
    await pool.query(
      'INSERT INTO poll_log (tweets_found, tweets_new, status) VALUES ($1, $2, $3)',
      [timeline.data.length, newTweets.length, 'success']
    );
    
    return { success: true, found: timeline.data.length, new: newTweets.length };
    
  } catch (err) {
    console.error('Poll error:', err.message);
    await pool.query(
      'INSERT INTO poll_log (tweets_found, tweets_new, status, error) VALUES ($1, $2, $3, $4)',
      [0, 0, 'error', err.message]
    );
    return { success: false, error: err.message };
  }
}

async function sendWebhook(url, message, mode) {
  try {
    const payload = {
      event: 'timeline_update',
      message,
      mode,
      timestamp: new Date().toISOString()
    };
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Webhook sent');
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
}

function schedulePoll(intervalHours) {
  if (pollInterval) clearInterval(pollInterval);
  
  const ms = intervalHours * 60 * 60 * 1000;
  console.log(`Scheduling poll every ${intervalHours} hours`);
  
  pollInterval = setInterval(poll, ms);
}

// ============================================
// HTTP Server
// ============================================
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }
  
  try {
    // Health check
    if (path === '/health') {
      return json(res, { status: 'ok', timestamp: new Date().toISOString() });
    }
    
    // Get config
    if (path === '/api/config' && req.method === 'GET') {
      const config = await getConfig();
      // Don't expose secrets
      return json(res, {
        hasCredentials: !!(config.x_client_id && config.x_client_secret),
        hasTokens: !!(config.access_token && config.refresh_token),
        webhookUrl: config.webhook_url,
        pollIntervalHours: config.poll_interval_hours,
        maxTweetsPerPoll: config.max_tweets_per_poll,
        openclawMode: config.openclaw_mode,
        updatedAt: config.updated_at
      });
    }
    
    // Update config
    if (path === '/api/config' && req.method === 'PUT') {
      const body = await parseBody(req);
      const allowed = ['x_client_id', 'x_client_secret', 'access_token', 'refresh_token', 
                       'webhook_url', 'poll_interval_hours', 'max_tweets_per_poll', 'openclaw_mode'];
      const updates = {};
      for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      await updateConfig(updates);
      
      // Reschedule if interval changed
      if (body.poll_interval_hours) {
        schedulePoll(body.poll_interval_hours);
      }
      
      return json(res, { success: true });
    }
    
    // Manual poll
    if (path === '/api/poll' && req.method === 'POST') {
      const result = await poll();
      return json(res, result);
    }
    
    // Get poll history
    if (path === '/api/polls' && req.method === 'GET') {
      const limit = url.searchParams.get('limit') || 20;
      const result = await pool.query(
        'SELECT * FROM poll_log ORDER BY created_at DESC LIMIT $1',
        [parseInt(limit)]
      );
      return json(res, result.rows);
    }
    
    // Get status
    if (path === '/api/status' && req.method === 'GET') {
      const config = await getConfig();
      const lastPoll = await pool.query(
        'SELECT * FROM poll_log ORDER BY created_at DESC LIMIT 1'
      );
      const seenCount = await pool.query('SELECT COUNT(*) FROM seen_tweets');
      
      return json(res, {
        configured: !!(config.x_client_id && config.access_token),
        lastPoll: lastPoll.rows[0] || null,
        seenTweets: parseInt(seenCount.rows[0].count),
        pollIntervalHours: config.poll_interval_hours
      });
    }
    
    // 404
    json(res, { error: 'Not found' }, 404);
    
  } catch (err) {
    console.error('Request error:', err);
    json(res, { error: err.message }, 500);
  }
});

// ============================================
// Start
// ============================================
async function main() {
  await initDb();
  
  const config = await getConfig();
  schedulePoll(config.poll_interval_hours || 6);
  
  // Initial poll after 1 minute
  setTimeout(poll, 60000);
  
  server.listen(PORT, () => {
    console.log(`Timeline Watcher API running on port ${PORT}`);
  });
}

main().catch(console.error);
