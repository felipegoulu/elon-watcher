'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchState() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        setState(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch state:', err);
    } finally {
      setLoading(false);
    }
  }

  async function triggerPoll() {
    setPolling(true);
    setMessage(null);
    try {
      const res = await fetch('/api/poll', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Poll complete! Found ${data.newTweets} new tweets.` });
        fetchState();
      } else {
        setMessage({ type: 'error', text: data.error || 'Poll failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setPolling(false);
    }
  }

  function formatTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function getNextPoll() {
    // Assuming polls at 2am, 8am, 2pm, 8pm
    const now = new Date();
    const hours = [2, 8, 14, 20];
    const currentHour = now.getHours();
    
    let nextHour = hours.find(h => h > currentHour);
    if (!nextHour) nextHour = hours[0]; // tomorrow 2am
    
    const next = new Date(now);
    if (nextHour <= currentHour) next.setDate(next.getDate() + 1);
    next.setHours(nextHour, 0, 0, 0);
    
    return next.toLocaleString();
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading...</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-title">📱 Timeline Watcher</span>
      </nav>

      <main className="main">
        {message && (
          <div className={`toast ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        <div className="section">
          <div className="section-header">
            <h2>Status</h2>
            <span className="status-badge online">● Active</span>
          </div>
          <div className="section-body">
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Last Poll</span>
                <span className="status-value">{formatTime(state?.lastPoll)}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Next Poll</span>
                <span className="status-value">{getNextPoll()}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Tweets Sent</span>
                <span className="status-value">{state?.lastCount || 0} last batch</span>
              </div>
              <div className="status-item">
                <span className="status-label">Total Tracked</span>
                <span className="status-value">{state?.seenTweets?.length || 0} tweets</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h2>Schedule</h2>
          </div>
          <div className="section-body">
            <p className="hint">Polls run automatically every 6 hours via cron:</p>
            <div className="schedule-list">
              <div className="schedule-item">🌙 2:00 AM</div>
              <div className="schedule-item">☀️ 8:00 AM</div>
              <div className="schedule-item">🌤️ 2:00 PM</div>
              <div className="schedule-item">🌆 8:00 PM</div>
            </div>
            <p className="hint" style={{marginTop: '16px'}}>
              Each poll fetches ~50 tweets from your timeline and sends them to OpenClaw 
              as a batch system event with mode <code>next-heartbeat</code>.
            </p>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h2>Manual Poll</h2>
          </div>
          <div className="section-body">
            <p className="hint">Trigger a poll manually to fetch your latest timeline.</p>
            <button 
              className="btn-primary" 
              onClick={triggerPoll}
              disabled={polling}
            >
              {polling ? 'Polling...' : 'Poll Now'}
            </button>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h2>How it works</h2>
          </div>
          <div className="section-body">
            <div className="flow">
              <div className="flow-step">
                <span className="flow-icon">🐦</span>
                <span className="flow-text">X API</span>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-step">
                <span className="flow-icon">📥</span>
                <span className="flow-text">Timeline Watcher</span>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-step">
                <span className="flow-icon">🦞</span>
                <span className="flow-text">OpenClaw</span>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-step">
                <span className="flow-icon">💬</span>
                <span className="flow-text">You</span>
              </div>
            </div>
            <p className="hint" style={{marginTop: '16px', textAlign: 'center'}}>
              OpenClaw reviews your timeline during heartbeat and tells you what's interesting.
            </p>
          </div>
        </div>
      </main>

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
  }

  .nav {
    display: flex;
    align-items: center;
    padding: 0 24px;
    height: 64px;
    border-bottom: 1px solid #333;
  }

  .nav-title {
    font-size: 16px;
    font-weight: 600;
  }

  .main {
    max-width: 600px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .section {
    border: 1px solid #333;
    border-radius: 12px;
    margin-bottom: 24px;
    background: #0a0a0a;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
  }

  .section-header h2 {
    font-size: 14px;
    font-weight: 500;
    margin: 0;
  }

  .section-body {
    padding: 20px;
  }

  .status-badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 12px;
  }

  .status-badge.online {
    background: rgba(0, 200, 100, 0.15);
    color: #0c8;
  }

  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .status-item {
    padding: 12px;
    background: #111;
    border-radius: 8px;
  }

  .status-label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }

  .status-value {
    font-size: 14px;
    font-weight: 500;
  }

  .hint {
    font-size: 13px;
    color: #888;
    line-height: 1.5;
  }

  .hint code {
    background: #1a1a1a;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Monaco', monospace;
    font-size: 12px;
  }

  .schedule-list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 12px;
  }

  .schedule-item {
    padding: 12px;
    background: #111;
    border-radius: 8px;
    text-align: center;
    font-size: 13px;
  }

  .btn-primary {
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    background: #fff;
    color: #000;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
    margin-top: 12px;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toast {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 24px;
    font-size: 14px;
  }

  .toast.success {
    background: rgba(0, 200, 100, 0.1);
    border: 1px solid rgba(0, 200, 100, 0.3);
    color: #0c8;
  }

  .toast.error {
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.3);
    color: #f66;
  }

  .toast button {
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    opacity: 0.7;
  }

  .flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px 0;
  }

  .flow-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    background: #111;
    border-radius: 8px;
  }

  .flow-icon {
    font-size: 24px;
  }

  .flow-text {
    font-size: 11px;
    color: #888;
  }

  .flow-arrow {
    color: #444;
    font-size: 18px;
  }

  .loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
  }
`;
