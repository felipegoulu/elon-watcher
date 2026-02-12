'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const NAV_ITEMS = [
  { id: 'webhook', label: 'Webhook', icon: '🔗' },
  { id: 'accounts', label: 'Accounts', icon: '👤' },
  { id: 'polling', label: 'Polling', icon: '⏱️' },
  { id: 'openclaw', label: 'OpenClaw', icon: '🦞' },
  { id: 'logs', label: 'Message Log', icon: '📋' },
];

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('webhook');
  const [auth, setAuth] = useState({ checked: false, authenticated: false, username: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [config, setConfig] = useState({
    webhookUrl: '',
    handles: [],
    pollIntervalMinutes: 15,
  });
  const [newHandle, setNewHandle] = useState('');
  const [handlePreview, setHandlePreview] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  const [handleConfigs, setHandleConfigs] = useState({});
  const [editingHandle, setEditingHandle] = useState(null);
  const [handleConfigForm, setHandleConfigForm] = useState({ mode: 'now', prompt: '', channel: '' });
  
  const [openclawConfig, setOpenclawConfig] = useState(null);
  const [openclawHeartbeat, setOpenclawHeartbeat] = useState(null);
  const [savingOpenclaw, setSavingOpenclaw] = useState(false);
  
  const [sentTweets, setSentTweets] = useState([]);

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (!newHandle || newHandle.length < 2) { setHandlePreview(null); return; }
    const timer = setTimeout(() => {
      const clean = newHandle.replace(/^@/, '').trim();
      if (clean) setHandlePreview({ handle: clean, url: `https://x.com/${clean}` });
    }, 300);
    return () => clearTimeout(timer);
  }, [newHandle]);

  function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : null; }
  function setToken(t) { localStorage.setItem('token', t); }
  function clearToken() { localStorage.removeItem('token'); }
  function authHeaders() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

  async function checkAuth() {
    const token = getToken();
    if (!token) { setAuth({ checked: true, authenticated: false, username: '' }); setLoading(false); return; }
    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
      const data = await res.json();
      if (data.authenticated) {
        setAuth({ checked: true, authenticated: true, username: data.username });
        fetchConfig(); fetchStatus(); fetchHandleConfigs();
      } else { clearToken(); setAuth({ checked: true, authenticated: false, username: '' }); setLoading(false); }
    } catch { clearToken(); setAuth({ checked: true, authenticated: false, username: '' }); setLoading(false); }
  }

  async function handleLogin(e) {
    e.preventDefault(); setLoginError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (data.success) { setToken(data.token); setAuth({ checked: true, authenticated: true, username: data.username }); fetchConfig(); fetchStatus(); fetchHandleConfigs(); }
      else setLoginError(data.error || 'Login failed');
    } catch { setLoginError('Connection error'); }
  }

  async function handleLogout() {
    try { await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: authHeaders() }); } catch {}
    clearToken(); setAuth({ checked: true, authenticated: false, username: '' });
  }

  async function handleChangePassword(e) {
    e.preventDefault(); setPasswordError('');
    if (passwordForm.new !== passwordForm.confirm) { setPasswordError('Passwords do not match'); return; }
    if (passwordForm.new.length < 4) { setPasswordError('Min 4 characters'); return; }
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new }),
      });
      const data = await res.json();
      if (data.success) { setShowPasswordModal(false); setPasswordForm({ current: '', new: '', confirm: '' }); setMessage({ type: 'success', text: 'Password updated' }); }
      else setPasswordError(data.error || 'Failed');
    } catch { setPasswordError('Connection error'); }
    finally { setChangingPassword(false); }
  }

  async function fetchConfig() {
    try {
      const res = await fetch(`${API_URL}/config`, { headers: authHeaders() });
      if (res.ok) {
        const cfg = await res.json();
        setConfig(cfg);
        if (cfg.webhookUrl) {
          try {
            const ocRes = await fetch(`${API_URL}/openclaw/config`, { headers: authHeaders() });
            if (ocRes.ok) setOpenclawConfig(await ocRes.json());
          } catch (e) { console.log('OpenClaw config fetch failed:', e); }
        }
      }
      else if (res.status === 401) { clearToken(); setAuth({ checked: true, authenticated: false, username: '' }); }
    } catch { setMessage({ type: 'error', text: 'Failed to load config' }); }
    finally { setLoading(false); }
  }

  async function fetchStatus() {
    try { const res = await fetch(`${API_URL}/status`, { headers: authHeaders() }); if (res.ok) setStatus(await res.json()); } catch {}
  }

  async function fetchHandleConfigs() {
    try {
      const res = await fetch(`${API_URL}/handle-config`, { headers: authHeaders() });
      if (res.ok) {
        const configs = await res.json();
        const configMap = {};
        configs.forEach(c => { configMap[c.handle] = c; });
        setHandleConfigs(configMap);
      }
    } catch {}
  }

  async function saveHandleConfig(handle) {
    try {
      const res = await fetch(`${API_URL}/handle-config/${handle}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(handleConfigForm),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Config saved for @${handle}` });
        fetchHandleConfigs();
        setEditingHandle(null);
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    }
  }

  function openHandleConfig(handle) {
    const existing = handleConfigs[handle] || { mode: 'now', prompt: '', channel: '' };
    setHandleConfigForm({ mode: existing.mode || 'now', prompt: existing.prompt || '', channel: existing.channel || '' });
    setEditingHandle(handle);
  }

  async function fetchOpenclawConfig() {
    if (!config.webhookUrl) return;
    try {
      const res = await fetch(`${API_URL}/openclaw/config`, { headers: authHeaders() });
      if (res.ok) {
        setOpenclawConfig(await res.json());
        fetchOpenclawHeartbeat();
      }
    } catch (err) {
      console.log('OpenClaw config not available:', err.message);
    }
  }

  async function fetchOpenclawHeartbeat() {
    if (!config.webhookUrl) return;
    try {
      const res = await fetch(`${API_URL}/openclaw/heartbeat`, { headers: authHeaders() });
      if (res.ok) setOpenclawHeartbeat(await res.json());
    } catch {}
  }

  async function saveOpenclawConfig(newConfig) {
    if (!config.webhookUrl) return;
    setSavingOpenclaw(true);
    try {
      const res = await fetch(`${API_URL}/openclaw/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'OpenClaw config saved & gateway restarted' });
        setOpenclawConfig(newConfig);
        setTimeout(fetchOpenclawHeartbeat, 2000);
      } else {
        setMessage({ type: 'error', text: 'Failed to save OpenClaw config' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setSavingOpenclaw(false);
    }
  }

  function updateHeartbeatConfig(key, value) {
    if (!openclawConfig) return;
    const updated = { ...openclawConfig };
    if (!updated.agents) updated.agents = {};
    if (!updated.agents.defaults) updated.agents.defaults = {};
    if (!updated.agents.defaults.heartbeat) updated.agents.defaults.heartbeat = {};
    updated.agents.defaults.heartbeat[key] = value;
    setOpenclawConfig(updated);
  }

  function updateChannelHeartbeat(channel, key, value) {
    if (!openclawConfig) return;
    const updated = { ...openclawConfig };
    if (!updated.channels) updated.channels = {};
    if (!updated.channels[channel]) updated.channels[channel] = {};
    if (!updated.channels[channel].heartbeat) updated.channels[channel].heartbeat = {};
    updated.channels[channel].heartbeat[key] = value;
    setOpenclawConfig(updated);
  }

  useEffect(() => {
    if (config.webhookUrl) fetchOpenclawConfig();
  }, [config.webhookUrl]);

  async function fetchSentTweets() {
    try {
      const res = await fetch(`${API_URL}/sent-tweets?limit=50`, { headers: authHeaders() });
      if (res.ok) setSentTweets(await res.json());
    } catch (err) {
      console.log('Failed to fetch sent tweets:', err.message);
    }
  }

  useEffect(() => {
    if (activeSection === 'logs' && auth.authenticated) fetchSentTweets();
  }, [activeSection, auth.authenticated]);

  async function saveConfig() {
    setSaving(true); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(config),
      });
      if (res.ok) { setMessage({ type: 'success', text: 'Saved' }); fetchStatus(); }
      else { const err = await res.json(); setMessage({ type: 'error', text: err.error || 'Failed' }); }
    } catch { setMessage({ type: 'error', text: 'Connection error' }); }
    finally { setSaving(false); }
  }

  async function triggerPoll() {
    try { await fetch(`${API_URL}/poll`, { method: 'POST', headers: authHeaders() }); setMessage({ type: 'success', text: 'Poll started' }); setTimeout(fetchStatus, 3000); }
    catch { setMessage({ type: 'error', text: 'Failed' }); }
  }

  function addHandle() {
    const h = newHandle.replace(/^@/, '').trim().toLowerCase();
    if (h && !config.handles.includes(h)) { setConfig({ ...config, handles: [...config.handles, h] }); setNewHandle(''); setHandlePreview(null); }
  }

  function removeHandle(h) { setConfig({ ...config, handles: config.handles.filter(x => x !== h) }); }

  // Login
  if (auth.checked && !auth.authenticated) {
    return (
      <div className="page">
        <div className="login-container">
          <div className="login-box">
            <h1>Tweet Watcher</h1>
            <p className="subtitle">Sign in to continue</p>
            {loginError && <div className="error-msg">{loginError}</div>}
            <form onSubmit={handleLogin}>
              <input type="text" placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
              <input type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
              <button type="submit" className="btn-primary">Continue</button>
            </form>
          </div>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!auth.checked || loading) {
    return (<div className="page"><div className="loading">Loading...</div><style jsx>{styles}</style></div>);
  }

  return (
    <div className="page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo">⚡</span>
          <span className="logo-text">Tweet Watcher</span>
        </div>
        
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.id === 'accounts' && config.handles.length > 0 && (
                <span className="nav-badge">{config.handles.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {status && (
            <div className="status-indicator">
              <span className="status-dot online"></span>
              <span className="status-text">
                {Object.keys(status.state?.lastSeenIds || {}).length} accounts tracked
              </span>
            </div>
          )}
          <div className="user-section">
            <span className="user-name">{auth.username}</span>
            <button className="icon-btn" onClick={() => setShowPasswordModal(true)} title="Settings">⚙️</button>
            <button className="icon-btn" onClick={handleLogout} title="Logout">🚪</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {message && (
          <div className={`toast ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {/* Webhook Section */}
        {activeSection === 'webhook' && (
          <div className="content">
            <div className="content-header">
              <h1>Webhook Configuration</h1>
              <p>Configure where new tweets are sent</p>
            </div>
            
            <div className="card">
              <label>Endpoint URL</label>
              <input 
                type="url" 
                value={config.webhookUrl} 
                onChange={e => setConfig({...config, webhookUrl: e.target.value})}
                placeholder="https://example.com/webhook"
              />
              <span className="hint">New tweets will be sent here as POST requests</span>
            </div>

            <div className="actions">
              <button className="btn-primary" onClick={saveConfig} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Accounts Section */}
        {activeSection === 'accounts' && (
          <div className="content">
            <div className="content-header">
              <h1>Twitter Accounts</h1>
              <p>Manage which accounts to monitor</p>
            </div>
            
            <div className="card">
              <label>Add Account</label>
              <div className="input-row">
                <div className="handle-input-wrap">
                  <span className="at">@</span>
                  <input 
                    type="text" 
                    value={newHandle} 
                    onChange={e => setNewHandle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHandle())}
                    placeholder="username"
                  />
                </div>
                <button className="btn-secondary" onClick={addHandle} disabled={!newHandle.trim()}>Add</button>
              </div>
              
              {handlePreview && (
                <div className="preview">
                  <span>@{handlePreview.handle}</span>
                  <a href={handlePreview.url} target="_blank" rel="noopener noreferrer">View on X →</a>
                </div>
              )}
            </div>

            <div className="card">
              <label>Monitored Accounts</label>
              <div className="handles-list">
                {config.handles.length === 0 ? (
                  <div className="empty">No accounts added yet</div>
                ) : (
                  config.handles.map(h => (
                    <div key={h} className="handle-row">
                      <div className="handle-info">
                        <a href={`https://x.com/${h}`} target="_blank" rel="noopener noreferrer">@{h}</a>
                        {handleConfigs[h]?.prompt && <span className="config-badge" title="Has custom prompt">⚡</span>}
                        {handleConfigs[h]?.mode === 'next-heartbeat' && <span className="mode-badge">batched</span>}
                      </div>
                      <div className="handle-actions">
                        <button className="icon-btn" onClick={() => openHandleConfig(h)} title="Configure">⚙️</button>
                        <button className="icon-btn danger" onClick={() => removeHandle(h)} title="Remove">🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="actions">
              <button className="btn-primary" onClick={saveConfig} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Polling Section */}
        {activeSection === 'polling' && (
          <div className="content">
            <div className="content-header">
              <h1>Polling Settings</h1>
              <p>Configure how often to check for new tweets</p>
            </div>
            
            <div className="card">
              <label>Poll Interval: {config.pollIntervalMinutes} minutes</label>
              <input 
                type="range" 
                min="1" 
                max="60" 
                value={config.pollIntervalMinutes}
                onChange={e => setConfig({...config, pollIntervalMinutes: parseInt(e.target.value)})}
              />
              <div className="range-labels">
                <span>1 min</span>
                <span>60 min</span>
              </div>
              <span className="hint">
                Estimated cost: ~${(0.40 * Math.max(1, config.handles.length) * (60 / config.pollIntervalMinutes) * 24).toFixed(2)}/day
              </span>
            </div>

            {status && (
              <div className="card">
                <label>Status</label>
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">State</span>
                    <span className="status-value online">● Running</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Last Poll</span>
                    <span className="status-value">{status.state?.lastPoll ? new Date(status.state.lastPoll).toLocaleString() : '—'}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Accounts</span>
                    <span className="status-value">{Object.keys(status.state?.lastSeenIds || {}).length} tracked</span>
                  </div>
                </div>
              </div>
            )}

            <div className="actions">
              <button className="btn-secondary" onClick={triggerPoll}>Poll Now</button>
              <button className="btn-primary" onClick={saveConfig} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* OpenClaw Section */}
        {activeSection === 'openclaw' && (
          <div className="content">
            <div className="content-header">
              <h1>🦞 OpenClaw Settings</h1>
              <p>Configure heartbeat and notification behavior</p>
            </div>
            
            {!openclawConfig ? (
              <div className="card">
                <div className="empty">
                  <p>OpenClaw config not available.</p>
                  <p className="hint">Make sure the webhook URL points to a server with OpenClaw access.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="card">
                  <label>Heartbeat Interval</label>
                  <div className="input-row">
                    <input 
                      type="text" 
                      value={openclawConfig?.agents?.defaults?.heartbeat?.every || '30m'}
                      onChange={e => updateHeartbeatConfig('every', e.target.value)}
                      placeholder="30m"
                      style={{width: '120px'}}
                    />
                    <span className="hint-inline">e.g., 5m, 15m, 1h</span>
                  </div>
                </div>

                <div className="card">
                  <label>Target Channel</label>
                  <select 
                    value={openclawConfig?.agents?.defaults?.heartbeat?.target || 'last'}
                    onChange={e => updateHeartbeatConfig('target', e.target.value)}
                  >
                    <option value="last">Last active</option>
                    <option value="telegram">Telegram</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="discord">Discord</option>
                    <option value="none">None (silent)</option>
                  </select>

                  {openclawConfig?.agents?.defaults?.heartbeat?.target === 'telegram' && (
                    <>
                      <label style={{marginTop: '16px'}}>Telegram Chat ID</label>
                      <input 
                        type="text" 
                        value={openclawConfig?.agents?.defaults?.heartbeat?.to || ''}
                        onChange={e => updateHeartbeatConfig('to', e.target.value)}
                        placeholder="e.g., 5679450975"
                      />
                    </>
                  )}
                </div>

                <div className="card">
                  <label>Options</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={openclawConfig?.agents?.defaults?.heartbeat?.includeReasoning || false}
                        onChange={e => updateHeartbeatConfig('includeReasoning', e.target.checked)}
                      />
                      <span>Include Reasoning</span>
                    </label>
                    <span className="hint">Show AI thinking process in responses</span>
                  </div>

                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={openclawConfig?.channels?.telegram?.heartbeat?.showOk || false}
                        onChange={e => updateChannelHeartbeat('telegram', 'showOk', e.target.checked)}
                      />
                      <span>Show OK Messages</span>
                    </label>
                    <span className="hint">Send message even when nothing to report</span>
                  </div>
                </div>

                {openclawHeartbeat && (
                  <div className="card">
                    <label>Last Heartbeat</label>
                    <div className="heartbeat-info">
                      <span className={`status-badge ${openclawHeartbeat.status === 'ok-token' ? 'ok' : ''}`}>
                        {openclawHeartbeat.status === 'ok-token' ? '● OK' : openclawHeartbeat.status}
                      </span>
                      {openclawHeartbeat.durationMs && <span className="hint"> ({openclawHeartbeat.durationMs}ms)</span>}
                      {openclawHeartbeat.silent && <span className="hint"> — silent</span>}
                    </div>
                  </div>
                )}

                <div className="actions">
                  <button className="btn-secondary" onClick={fetchOpenclawHeartbeat}>Refresh Status</button>
                  <button 
                    className="btn-primary" 
                    onClick={() => saveOpenclawConfig(openclawConfig)}
                    disabled={savingOpenclaw}
                  >
                    {savingOpenclaw ? 'Saving...' : 'Save OpenClaw Config'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Message Log Section */}
        {activeSection === 'logs' && (
          <div className="content">
            <div className="content-header">
              <h1>Message Log</h1>
              <p>Recent tweets sent to webhook</p>
            </div>
            
            <div className="card">
              <div className="log-header">
                <span>{sentTweets.length} messages</span>
                <button className="btn-secondary btn-small" onClick={fetchSentTweets}>Refresh</button>
              </div>
              
              <div className="tweet-log">
                {sentTweets.length === 0 ? (
                  <div className="empty">No messages sent yet</div>
                ) : (
                  sentTweets.map((tweet, i) => (
                    <div key={tweet.id || i} className="log-entry">
                      <div className="log-entry-header">
                        <span className="log-handle">@{tweet.handle}</span>
                        <span className={`log-status ${tweet.status}`}>{tweet.status}</span>
                        <span className="log-time">{new Date(tweet.created_at).toLocaleString()}</span>
                      </div>
                      <div className="log-tweet">{tweet.tweet_text}</div>
                      {tweet.handle_config && (tweet.handle_config.prompt || tweet.handle_config.channel) && (
                        <div className="log-config">
                          {tweet.handle_config.prompt && <span className="config-tag">Prompt: {tweet.handle_config.prompt}</span>}
                          {tweet.handle_config.channel && <span className="config-tag">Canal: {tweet.handle_config.channel}</span>}
                          {tweet.handle_config.mode && <span className="config-tag">Mode: {tweet.handle_config.mode}</span>}
                        </div>
                      )}
                      <details className="log-details">
                        <summary>View full message</summary>
                        <pre>{tweet.formatted_message}</pre>
                      </details>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Change Password</h3>
            {passwordError && <div className="error-msg">{passwordError}</div>}
            <form onSubmit={handleChangePassword}>
              <label>Current Password</label>
              <input type="password" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} />
              <label>New Password</label>
              <input type="password" value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} />
              <label>Confirm Password</label>
              <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={changingPassword}>{changingPassword ? 'Saving...' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handle Config Modal */}
      {editingHandle && (
        <div className="modal-overlay" onClick={() => setEditingHandle(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>Configure @{editingHandle}</h3>
            
            <label>Notification Mode</label>
            <div className="radio-group">
              <label className={`radio-option ${handleConfigForm.mode === 'now' ? 'selected' : ''}`}>
                <input type="radio" name="mode" value="now" checked={handleConfigForm.mode === 'now'} onChange={e => setHandleConfigForm({...handleConfigForm, mode: e.target.value})} />
                <span className="radio-label">⚡ Instant</span>
                <span className="radio-desc">Notify immediately when tweet detected</span>
              </label>
              <label className={`radio-option ${handleConfigForm.mode === 'next-heartbeat' ? 'selected' : ''}`}>
                <input type="radio" name="mode" value="next-heartbeat" checked={handleConfigForm.mode === 'next-heartbeat'} onChange={e => setHandleConfigForm({...handleConfigForm, mode: e.target.value})} />
                <span className="radio-label">📦 Batched</span>
                <span className="radio-desc">Wait for next heartbeat cycle</span>
              </label>
            </div>

            <label>Channel Override</label>
            <select value={handleConfigForm.channel} onChange={e => setHandleConfigForm({...handleConfigForm, channel: e.target.value})}>
              <option value="">Default (active session)</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="discord">Discord</option>
            </select>
            <span className="hint">Where to send notifications for this account</span>

            <label>Custom Prompt</label>
            <textarea 
              value={handleConfigForm.prompt} 
              onChange={e => setHandleConfigForm({...handleConfigForm, prompt: e.target.value})}
              placeholder="e.g., Analyze this tweet and summarize the key points"
              rows={3}
            />
            <span className="hint">Special instructions for processing tweets from this account</span>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditingHandle(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => saveHandleConfig(editingHandle)}>Save</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page {
    min-height: 100vh;
    background: #000;
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
  }

  /* Sidebar */
  .sidebar {
    width: 260px;
    min-height: 100vh;
    background: #0a0a0a;
    border-right: 1px solid #222;
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid #222;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo {
    font-size: 24px;
  }

  .logo-text {
    font-size: 16px;
    font-weight: 600;
  }

  .sidebar-nav {
    flex: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #888;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    width: 100%;
  }

  .nav-item:hover {
    background: #111;
    color: #fff;
  }

  .nav-item.active {
    background: #1a1a1a;
    color: #fff;
  }

  .nav-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .nav-label {
    flex: 1;
  }

  .nav-badge {
    background: #333;
    color: #888;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid #222;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #666;
    margin-bottom: 12px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #333;
  }

  .status-dot.online {
    background: #0c8;
  }

  .user-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .user-name {
    flex: 1;
    font-size: 13px;
    color: #888;
  }

  .icon-btn {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    opacity: 0.6;
    transition: opacity 0.15s;
  }

  .icon-btn:hover {
    opacity: 1;
    background: #1a1a1a;
  }

  .icon-btn.danger:hover {
    background: rgba(255, 0, 0, 0.1);
  }

  /* Main Content */
  .main {
    flex: 1;
    margin-left: 260px;
    padding: 32px 48px;
    min-height: 100vh;
  }

  .content {
    max-width: 640px;
  }

  .content-header {
    margin-bottom: 32px;
  }

  .content-header h1 {
    font-size: 28px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .content-header p {
    color: #666;
    margin: 0;
    font-size: 14px;
  }

  .card {
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }

  label {
    display: block;
    font-size: 13px;
    color: #888;
    margin-bottom: 8px;
  }

  input[type="text"],
  input[type="url"],
  input[type="password"] {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    background: #111;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fafafa;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  input:focus {
    border-color: #666;
  }

  input::placeholder {
    color: #444;
  }

  .hint {
    display: block;
    font-size: 12px;
    color: #666;
    margin-top: 8px;
  }

  .hint-inline {
    font-size: 12px;
    color: #666;
    margin-left: 12px;
  }

  .input-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .handle-input-wrap {
    flex: 1;
    position: relative;
  }

  .handle-input-wrap .at {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
  }

  .handle-input-wrap input {
    padding-left: 28px;
  }

  .preview {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #111;
    border-radius: 8px;
    margin-top: 12px;
    font-size: 13px;
  }

  .preview a {
    color: #0070f3;
    text-decoration: none;
  }

  .handles-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .handle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: #111;
    border-radius: 8px;
  }

  .handle-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .handle-info a {
    color: #fafafa;
    text-decoration: none;
    font-weight: 500;
  }

  .handle-info a:hover {
    color: #0070f3;
  }

  .config-badge {
    font-size: 12px;
  }

  .mode-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: #1a1a1a;
    border-radius: 4px;
    color: #666;
    text-transform: uppercase;
  }

  .handle-actions {
    display: flex;
    gap: 4px;
  }

  .empty {
    color: #666;
    font-size: 13px;
    padding: 20px 0;
    text-align: center;
  }

  input[type="range"] {
    width: 100%;
    height: 4px;
    background: #333;
    border-radius: 2px;
    appearance: none;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    cursor: pointer;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #666;
    margin-top: 8px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .status-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-label {
    font-size: 12px;
    color: #666;
  }

  .status-value {
    font-size: 14px;
  }

  .status-value.online {
    color: #0c8;
  }

  select {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    background: #111;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fafafa;
    outline: none;
    cursor: pointer;
  }

  select:focus {
    border-color: #666;
  }

  .checkbox-group {
    margin-bottom: 16px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .heartbeat-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
    background: #1a1a1a;
    color: #666;
  }

  .status-badge.ok {
    background: rgba(0, 200, 100, 0.1);
    color: #0c8;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }

  .btn-primary {
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    background: #fff;
    color: #000;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    background: transparent;
    color: #fafafa;
    border: 1px solid #333;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-secondary:hover {
    border-color: #666;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .toast {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 24px;
    font-size: 14px;
    max-width: 640px;
  }

  .toast.success {
    background: rgba(0, 200, 100, 0.1);
    border: 1px solid #0c8;
    color: #0c8;
  }

  .toast.error {
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid #f00;
    color: #f00;
  }

  .toast button {
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    opacity: 0.7;
  }

  /* Log Section */
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    font-size: 13px;
    color: #666;
  }

  .tweet-log {
    max-height: 600px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .log-entry {
    padding: 16px;
    background: #111;
    border-radius: 8px;
  }

  .log-entry-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 13px;
  }

  .log-handle {
    font-weight: 600;
    color: #0070f3;
  }

  .log-status {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    text-transform: uppercase;
  }

  .log-status.sent {
    background: rgba(0, 200, 100, 0.1);
    color: #0c8;
  }

  .log-status.failed {
    background: rgba(255, 0, 0, 0.1);
    color: #f00;
  }

  .log-time {
    color: #666;
    margin-left: auto;
    font-size: 12px;
  }

  .log-tweet {
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .log-config {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .config-tag {
    font-size: 11px;
    padding: 4px 8px;
    background: #1a1a1a;
    border-radius: 4px;
    color: #888;
  }

  .log-details {
    margin-top: 12px;
  }

  .log-details summary {
    font-size: 12px;
    color: #666;
    cursor: pointer;
    padding: 4px 0;
  }

  .log-details summary:hover {
    color: #0070f3;
  }

  .log-details pre {
    margin-top: 8px;
    padding: 12px;
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 6px;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    color: #ccc;
    font-family: 'Monaco', 'Menlo', monospace;
  }

  /* Login */
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .login-box {
    width: 100%;
    max-width: 360px;
    padding: 32px;
  }

  .login-box h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px;
    text-align: center;
  }

  .login-box .subtitle {
    color: #666;
    text-align: center;
    margin-bottom: 32px;
  }

  .login-box input {
    margin-bottom: 16px;
  }

  .login-box .btn-primary {
    width: 100%;
    margin-top: 8px;
  }

  .error-msg {
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid #f00;
    color: #f00;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #0a0a0a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 24px;
    width: 100%;
    max-width: 400px;
  }

  .modal h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 20px;
  }

  .modal label {
    margin-top: 12px;
  }

  .modal input {
    margin-bottom: 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }

  .modal-wide {
    max-width: 500px;
  }

  textarea {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    background: #111;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fafafa;
    outline: none;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }

  textarea:focus {
    border-color: #666;
  }

  textarea::placeholder {
    color: #444;
  }

  .radio-group {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .radio-option {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 14px;
    background: #111;
    border: 1px solid #333;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .radio-option:hover {
    border-color: #666;
  }

  .radio-option.selected {
    border-color: #0070f3;
    background: rgba(0, 112, 243, 0.1);
  }

  .radio-option input {
    display: none;
  }

  .radio-label {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .radio-desc {
    font-size: 12px;
    color: #666;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .sidebar {
      width: 100%;
      height: auto;
      position: relative;
      border-right: none;
      border-bottom: 1px solid #222;
    }

    .sidebar-nav {
      flex-direction: row;
      overflow-x: auto;
      padding: 8px;
    }

    .nav-item {
      flex-direction: column;
      padding: 8px 16px;
      gap: 4px;
    }

    .nav-label {
      font-size: 11px;
    }

    .nav-badge {
      display: none;
    }

    .sidebar-footer {
      display: none;
    }

    .main {
      margin-left: 0;
      padding: 24px;
    }

    .page {
      flex-direction: column;
    }
  }
`;
