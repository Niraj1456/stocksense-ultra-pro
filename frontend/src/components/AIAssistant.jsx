import React, { useState, useEffect } from 'react';

function parseStockPicks(text) {
  // Try to extract individual stock sections from the AI response
  const stocks = [];
  const stockRegex = /STOCK\s*#?\d+[:\s]*(.+?)(?:\|.*?)?(?:NSE:\s*(\w+))?/gi;
  let match;
  while ((match = stockRegex.exec(text)) !== null) {
    stocks.push({ name: match[1]?.trim(), ticker: match[2]?.trim() });
  }
  return stocks;
}

export default function AIAssistant() {
  const [status, setStatus] = useState({ gemini: false, claude: false });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('gemini');
  const [elapsed, setElapsed] = useState(0);

  // Check API status on mount
  useEffect(() => {
    fetch('/api/ai-assistant/status')
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {});
  }, []);

  // Timer during loading
  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  const generate = async () => {
    setLoading(true);
    setElapsed(0);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai-assistant/generate');
      const data = await res.json();
      if (data.ok) {
        setResult(data);
        // Auto-select first available tab
        if (data.results?.gemini) setActiveTab('gemini');
        else if (data.results?.claude) setActiveTab('claude');
      } else {
        setError(data.error || 'Failed to generate analysis');
      }
    } catch (err) {
      setError('Backend server not running. Start it with: npm run dev (in root folder)');
    }
    setLoading(false);
  };

  const isConfigured = status.gemini || status.claude;
  const now = new Date();
  let hours = now.getHours();
  let mins = now.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric'
    }).formatToParts(now).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    hours = parseInt(parts.hour, 10);
    mins = parseInt(parts.minute, 10);
  } catch (e) {
    // fallback
  }
  const timeVal = hours + mins / 60;
  const isPreMarket = timeVal >= 8.5 && timeVal < 9.25;
  const isMarketOpen = timeVal >= 9.25 && timeVal < 15.5;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)',
      marginBottom: '1.5rem'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '1.5rem 1.75rem',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🧠</span>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>AI Pre-Market Assistant</h2>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                Powered by Gemini 2.5 Pro + Claude Sonnet 4.6
              </p>
            </div>
          </div>
          <div style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '100px',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: isPreMarket ? 'rgba(0,208,156,0.2)' : isMarketOpen ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.1)',
            color: isPreMarket ? '#00d09c' : isMarketOpen ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            letterSpacing: '0.5px'
          }}>
            {isPreMarket ? '● PRE-MARKET WINDOW' : isMarketOpen ? '● MARKET LIVE' : '● AFTER HOURS'}
          </div>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0.5rem 0 1rem' }}>
          Dual-AI engine analyzes global macro, geopolitical risk, technicals, F&O data, and quant filters to identify 5-8 high-probability intraday trades with 2-3% profit targets.
        </p>

        {/* API Status */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.gemini ? '#00d09c' : '#ef4444' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Gemini 2.5 Pro</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.claude ? '#00d09c' : '#ef4444' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Claude Sonnet 4.6</span>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generate}
          disabled={loading || !isConfigured}
          style={{
            background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #00d09c 0%, #059669 100%)',
            color: '#fff',
            padding: '0.75rem 2rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            border: 'none',
            borderRadius: '100px',
            cursor: loading || !isConfigured ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 6px 20px rgba(0, 208, 156, 0.3)',
            transition: 'all 0.3s',
            fontFamily: 'inherit',
            width: '100%'
          }}
        >
          {loading
            ? `⚙️ Dual-AI Analysis Running... (${formatTime(elapsed)})`
            : !isConfigured
              ? '⚠️ Configure API Keys in .env'
              : '⚡ Generate Pre-Market Stock Picks'
          }
        </button>

        {!isConfigured && (
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.5rem', textAlign: 'center' }}>
            Add GEMINI_API_KEY and/or ANTHROPIC_API_KEY to your .env file, then restart the backend.
          </p>
        )}
      </div>

      {/* Loading Animation */}
      {loading && (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
            {status.gemini && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  border: '3px solid var(--border)',
                  borderTopColor: '#4285f4',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 0.5rem'
                }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gemini thinking...</span>
              </div>
            )}
            {status.claude && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  border: '3px solid var(--border)',
                  borderTopColor: '#d97706',
                  animation: 'spin 1.2s linear infinite',
                  margin: '0 auto 0.5rem'
                }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Claude analyzing...</span>
              </div>
            )}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Analyzing global markets, geopolitics, technicals, F&O data...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '1.25rem', background: 'rgba(235,91,60,0.06)', borderTop: '1px solid rgba(235,91,60,0.15)' }}>
          <p style={{ fontSize: '0.85rem', color: '#eb5b3c', fontWeight: 600 }}>⚠️ {error}</p>
        </div>
      )}

      {/* Results */}
      {result && result.results && (
        <div>
          {/* Tab Selector */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: '#f8fafc'
          }}>
            {result.results.gemini && (
              <button
                onClick={() => setActiveTab('gemini')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  background: activeTab === 'gemini' ? '#fff' : 'transparent',
                  borderBottom: activeTab === 'gemini' ? '2px solid #4285f4' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'gemini' ? 700 : 500,
                  color: activeTab === 'gemini' ? '#4285f4' : 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                ✦ Gemini 2.5 Pro
              </button>
            )}
            {result.results.claude && (
              <button
                onClick={() => setActiveTab('claude')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  background: activeTab === 'claude' ? '#fff' : 'transparent',
                  borderBottom: activeTab === 'claude' ? '2px solid #d97706' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'claude' ? 700 : 500,
                  color: activeTab === 'claude' ? '#d97706' : 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                ◆ Claude Sonnet 4.6
              </button>
            )}
          </div>

          {/* Active Result Content */}
          <div style={{ padding: '1.5rem' }}>
            {/* Timestamp */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Generated: {new Date(result.timestamp).toLocaleString('en-IN')}
              </span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '100px',
                background: activeTab === 'gemini' ? 'rgba(66,133,244,0.1)' : 'rgba(217,119,6,0.1)',
                color: activeTab === 'gemini' ? '#4285f4' : '#d97706'
              }}>
                {activeTab === 'gemini' ? result.results.gemini?.model : result.results.claude?.model}
              </span>
            </div>

            {/* Rendered Analysis */}
            <div style={{
              fontSize: '0.85rem',
              lineHeight: 1.8,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              fontFamily: "'Inter', sans-serif"
            }}>
              {renderAnalysis(
                activeTab === 'gemini'
                  ? result.results.gemini?.text
                  : result.results.claude?.text
              )}
            </div>
          </div>
        </div>
      )}

      {/* Errors from individual APIs */}
      {result?.errors && (
        <div style={{ padding: '1rem 1.5rem', background: '#fffbeb', borderTop: '1px solid #fde68a' }}>
          {Object.entries(result.errors).map(([key, msg]) => (
            <p key={key} style={{ fontSize: '0.78rem', color: '#92400e', margin: '0.25rem 0' }}>
              ⚠️ {key}: {msg}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function renderAnalysis(text) {
  if (!text) return <p style={{ color: 'var(--text-muted)' }}>No analysis available.</p>;

  // Split into sections and apply formatting
  const lines = text.split('\n');
  const elements = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Major section headers (═══ or ─── lines)
    if (/^[═─]{5,}/.test(trimmed)) return;

    // Section titles (ALL CAPS with multiple words)
    if (/^(MARKET SUMMARY|SECTION|STOCK\s*#|STOCKS TO AVOID|SECTOR WITH|SECTOR TO AVOID)/i.test(trimmed)) {
      elements.push(
        <div key={i} style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          padding: '0.6rem 1rem',
          borderRadius: '8px',
          fontSize: '0.82rem',
          fontWeight: 700,
          letterSpacing: '0.3px',
          marginTop: i > 0 ? '1.25rem' : '0',
          marginBottom: '0.5rem'
        }}>{trimmed}</div>
      );
      return;
    }

    // Key-value lines (Entry zone:, Target 1:, etc.)
    const kvMatch = trimmed.match(/^([\w\s/()&]+?):\s*(.+)$/);
    if (kvMatch && kvMatch[1].length < 30) {
      const label = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      const isPositive = /target|entry|buy|bullish|high|strong|outperform/i.test(label);
      const isNegative = /stop loss|avoid|bearish|risk|caution|sell/i.test(label);
      const isScore = /score|confidence/i.test(label);

      elements.push(
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.35rem 0',
          borderBottom: '1px solid rgba(0,0,0,0.04)'
        }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.82rem' }}>{label}</span>
          <span style={{
            fontWeight: 600,
            fontSize: '0.82rem',
            color: isNegative ? '#eb5b3c' : isPositive ? '#059669' : isScore ? '#7c3aed' : 'var(--text-primary)'
          }}>{value}</span>
        </div>
      );
      return;
    }

    // Bullet points
    if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('✗') || trimmed.startsWith('✓')) {
      elements.push(
        <div key={i} style={{ paddingLeft: '0.75rem', fontSize: '0.82rem', margin: '0.2rem 0', color: 'var(--text-secondary)' }}>
          {trimmed}
        </div>
      );
      return;
    }

    // Why today header
    if (/^Why today/i.test(trimmed)) {
      elements.push(
        <div key={i} style={{
          fontWeight: 700,
          fontSize: '0.82rem',
          color: '#059669',
          marginTop: '0.5rem',
          marginBottom: '0.25rem'
        }}>
          {trimmed}
        </div>
      );
      return;
    }

    // Regular text
    if (trimmed.length > 0) {
      elements.push(
        <div key={i} style={{ fontSize: '0.82rem', margin: '0.15rem 0', color: 'var(--text-primary)' }}>
          {trimmed}
        </div>
      );
    }
  });

  return <>{elements}</>;
}
