'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function Dashboard() {
  const [config, setConfig] = useState({
    hasCredentials: false,
    hasTokens: false,
    webhookUrl: '',
    pollIntervalHours: 6,
    maxTweetsPerPoll: 50,
    openclawMode: 'next-heartbeat'
  });
  const [status, setStatus] = useState(null);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Credentials form
  const [credentials, setCredentials] = useState({
    x_client_id: '',
    x_client_secret: '',
    access_token: '',
    refresh_token: ''
  });
  const [showCredentials, setShowCredentials] = useState(false);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    await Promise.all([fetchConfig(), fetchStatus(), fetchPolls()]);
    setLoading(false);
  }

  async function fetchConfig() {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) setConfig(await res.json());
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) setStatus(await res.json());
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }

  async function fetchPolls() {
    try {
      const res = await fetch(`${API_URL}/api/polls?limit=10`);
      if (res.ok) setPolls(await res.json());
    } catch (err) {
      console.error('Failed to fetch polls:', err);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        webhook_url: config.webhookUrl,
        poll_interval_hours: parseInt(config.pollIntervalHours),
        max_tweets_per_poll: parseInt(config.maxTweetsPerPoll),
        openclaw_mode: config.openclawMode
      };
      
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Config saved!' });
        fetchConfig();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function saveCredentials() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Credentials saved!' });
        setShowCredentials(false);
        setCredentials({ x_client_id: '', x_client_secret: '', access_token: '', refresh_token: '' });
        fetchConfig();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function triggerPoll() {
    setPolling(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/poll`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: `Poll complete! Found ${data.found} tweets, ${data.new} new.` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Poll failed' });
      }
      
      fetchStatus();
      fetchPolls();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPolling(false);
    }
  }

  function formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.loading}>Loading...</div></div>;
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>📱 Timeline Watcher</span>
      </nav>

      <main style={styles.main}>
        {message && (
          <div style={{...styles.toast, ...(message.type === 'error' ? styles.toastError : styles.toastSuccess)}}>
            {message.text}
            <button style={styles.toastClose} onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {/* Status */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Status</h2>
            <span style={{...styles.badge, ...(status?.configured ? styles.badgeGreen : styles.badgeRed)}}>
              {status?.configured ? '● Configured' : '○ Not configured'}
            </span>
          </div>
          <div style={styles.sectionBody}>
            <div style={styles.grid}>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Last Poll</span>
                <span style={styles.statValue}>
                  {status?.lastPoll ? formatTime(status.lastPoll.created_at) : '—'}
                </span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Tweets Tracked</span>
                <span style={styles.statValue}>{status?.seenTweets || 0}</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Poll Interval</span>
                <span style={styles.statValue}>{status?.pollIntervalHours || 6}h</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Last Result</span>
                <span style={styles.statValue}>
                  {status?.lastPoll ? `${status.lastPoll.tweets_new} new` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>X API Credentials</h2>
            <button style={styles.btnSmall} onClick={() => setShowCredentials(!showCredentials)}>
              {showCredentials ? 'Hide' : config.hasCredentials ? 'Update' : 'Setup'}
            </button>
          </div>
          {showCredentials && (
            <div style={styles.sectionBody}>
              <label style={styles.label}>Client ID</label>
              <input
                style={styles.input}
                type="text"
                value={credentials.x_client_id}
                onChange={e => setCredentials({...credentials, x_client_id: e.target.value})}
                placeholder="From X Developer Portal"
              />
              
              <label style={styles.label}>Client Secret</label>
              <input
                style={styles.input}
                type="password"
                value={credentials.x_client_secret}
                onChange={e => setCredentials({...credentials, x_client_secret: e.target.value})}
                placeholder="From X Developer Portal"
              />
              
              <label style={styles.label}>Access Token</label>
              <input
                style={styles.input}
                type="password"
                value={credentials.access_token}
                onChange={e => setCredentials({...credentials, access_token: e.target.value})}
                placeholder="From OAuth flow"
              />
              
              <label style={styles.label}>Refresh Token</label>
              <input
                style={styles.input}
                type="password"
                value={credentials.refresh_token}
                onChange={e => setCredentials({...credentials, refresh_token: e.target.value})}
                placeholder="From OAuth flow"
              />
              
              <button style={styles.btnPrimary} onClick={saveCredentials} disabled={saving}>
                {saving ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>
          )}
          {!showCredentials && (
            <div style={styles.sectionBody}>
              <div style={styles.statusRow}>
                <span>API Keys: {config.hasCredentials ? '✅ Set' : '❌ Missing'}</span>
                <span>OAuth Tokens: {config.hasTokens ? '✅ Set' : '❌ Missing'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Settings</h2>
          </div>
          <div style={styles.sectionBody}>
            <label style={styles.label}>Webhook URL (your OpenClaw server)</label>
            <input
              style={styles.input}
              type="url"
              value={config.webhookUrl || ''}
              onChange={e => setConfig({...config, webhookUrl: e.target.value})}
              placeholder="http://your-ec2:3001/webhook"
            />
            
            <label style={styles.label}>Poll Interval (hours)</label>
            <select
              style={styles.select}
              value={config.pollIntervalHours}
              onChange={e => setConfig({...config, pollIntervalHours: e.target.value})}
            >
              <option value="1">Every 1 hour</option>
              <option value="2">Every 2 hours</option>
              <option value="4">Every 4 hours</option>
              <option value="6">Every 6 hours</option>
              <option value="12">Every 12 hours</option>
              <option value="24">Every 24 hours</option>
            </select>
            
            <label style={styles.label}>Max Tweets per Poll</label>
            <input
              style={styles.input}
              type="number"
              min="10"
              max="100"
              value={config.maxTweetsPerPoll}
              onChange={e => setConfig({...config, maxTweetsPerPoll: e.target.value})}
            />
            
            <label style={styles.label}>OpenClaw Mode</label>
            <select
              style={styles.select}
              value={config.openclawMode}
              onChange={e => setConfig({...config, openclawMode: e.target.value})}
            >
              <option value="next-heartbeat">Next Heartbeat (batched)</option>
              <option value="now">Now (immediate)</option>
            </select>
            
            <button style={styles.btnPrimary} onClick={saveConfig} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Manual Poll</h2>
          </div>
          <div style={styles.sectionBody}>
            <p style={styles.hint}>Trigger a poll manually to fetch your latest timeline.</p>
            <button style={styles.btnPrimary} onClick={triggerPoll} disabled={polling || !status?.configured}>
              {polling ? 'Polling...' : 'Poll Now'}
            </button>
          </div>
        </div>

        {/* History */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Polls</h2>
            <button style={styles.btnSmall} onClick={fetchPolls}>Refresh</button>
          </div>
          <div style={styles.sectionBody}>
            {polls.length === 0 ? (
              <p style={styles.hint}>No polls yet</p>
            ) : (
              <div style={styles.pollList}>
                {polls.map((p, i) => (
                  <div key={i} style={styles.pollItem}>
                    <span style={styles.pollTime}>{formatTime(p.created_at)}</span>
                    <span style={{...styles.pollStatus, color: p.status === 'success' ? '#0c8' : '#f66'}}>
                      {p.status}
                    </span>
                    <span style={styles.pollCount}>
                      {p.tweets_found} found, {p.tweets_new} new
                    </span>
                    {p.error && <span style={styles.pollError}>{p.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#000', color: '#fafafa', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' },
  nav: { display: 'flex', alignItems: 'center', padding: '0 24px', height: 64, borderBottom: '1px solid #333' },
  navTitle: { fontSize: 16, fontWeight: 600 },
  main: { maxWidth: 640, margin: '0 auto', padding: '32px 24px' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' },
  
  section: { border: '1px solid #333', borderRadius: 12, marginBottom: 24, background: '#0a0a0a' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #333' },
  sectionTitle: { fontSize: 14, fontWeight: 500, margin: 0 },
  sectionBody: { padding: 20 },
  
  badge: { fontSize: 12, padding: '4px 10px', borderRadius: 12 },
  badgeGreen: { background: 'rgba(0,200,100,0.15)', color: '#0c8' },
  badgeRed: { background: 'rgba(255,0,0,0.15)', color: '#f66' },
  
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  stat: { padding: 12, background: '#111', borderRadius: 8 },
  statLabel: { display: 'block', fontSize: 12, color: '#666', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: 500 },
  
  label: { display: 'block', fontSize: 13, color: '#888', marginBottom: 8, marginTop: 16 },
  input: { width: '100%', padding: '10px 12px', fontSize: 14, background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fafafa', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px 12px', fontSize: 14, background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fafafa', outline: 'none', cursor: 'pointer' },
  
  btnPrimary: { marginTop: 20, padding: '12px 24px', fontSize: 14, fontWeight: 500, background: '#fff', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer' },
  btnSmall: { padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 6, cursor: 'pointer' },
  
  hint: { fontSize: 13, color: '#888', margin: '0 0 12px' },
  statusRow: { display: 'flex', gap: 24, fontSize: 14 },
  
  toast: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: 14 },
  toastSuccess: { background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.3)', color: '#0c8' },
  toastError: { background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#f66' },
  toastClose: { background: 'none', border: 'none', color: 'inherit', fontSize: 18, cursor: 'pointer', opacity: 0.7 },
  
  pollList: { display: 'flex', flexDirection: 'column', gap: 8 },
  pollItem: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#111', borderRadius: 8, fontSize: 13 },
  pollTime: { color: '#666', minWidth: 150 },
  pollStatus: { fontWeight: 500 },
  pollCount: { color: '#888' },
  pollError: { color: '#f66', marginLeft: 'auto' }
};
