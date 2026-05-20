import React from 'react';

function formatVolume(v) {
  if (!v || v === 0) return '—';
  if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(2)} L`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)} K`;
  return v.toString();
}

export default function Sidebar({ watchlist, selectedStock, onSelect, onToggleWatchlist, marketData }) {
  // Get top volume stocks from real market data
  const volumeStocks = (marketData || [])
    .filter(s => s.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  return (
    <div className="sidebar">
      {/* Watchlist Card */}
      <div className="sidebar-card">
        <div className="sidebar-card-title">
          <span>★</span> Your Watchlist
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {watchlist.length === 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No stocks in watchlist yet. Search and add stocks to track.</p>
          )}
          {watchlist.map(stock => (
            <div
              key={stock}
              onClick={() => onSelect(stock)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.6rem',
                borderRadius: '8px',
                cursor: 'pointer',
                background: stock === selectedStock ? 'var(--accent-dim)' : 'transparent',
                transition: 'all 0.15s'
              }}
            >
              <span style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: stock === selectedStock ? 'var(--accent-solid)' : 'var(--text-primary)'
              }}>
                {stock}
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); onToggleWatchlist(stock); }}
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0 4px',
                  borderRadius: '4px',
                  transition: 'color 0.15s'
                }}
                title="Remove from watchlist"
              >
                ×
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Volume Stocks - Real Data */}
      <div className="sidebar-card">
        <div className="sidebar-card-title">
          <span>📊</span> Top Volume Stocks
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            Live
          </span>
        </div>
        {volumeStocks.length === 0 ? (
          <div style={{ padding: '1rem 0', textAlign: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading volume data...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {volumeStocks.map((stock, i) => (
              <div
                key={stock.symbol}
                onClick={() => onSelect(stock.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.55rem 0.4rem',
                  cursor: 'pointer',
                  borderBottom: i < volumeStocks.length - 1 ? '1px solid var(--border)' : 'none',
                  borderRadius: '6px',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  width: '20px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  flexShrink: 0
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {stock.symbol}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Vol: {formatVolume(stock.volume)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    ₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: stock.positive ? 'var(--accent)' : 'var(--danger)',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {stock.pct >= 0 ? '+' : ''}{stock.pct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relative Volume Surge - stocks with unusual volume */}
      <div className="sidebar-card">
        <div className="sidebar-card-title">
          <span>🔥</span> Volume Surge
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            RVOL &gt; 1.5x
          </span>
        </div>
        {(() => {
          const surgeStocks = (marketData || [])
            .filter(s => s.rvol > 1.5)
            .sort((a, b) => b.rvol - a.rvol)
            .slice(0, 6);

          if (surgeStocks.length === 0) {
            return (
              <div style={{ padding: '0.75rem 0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  No unusual volume detected today
                </span>
              </div>
            );
          }

          return surgeStocks.map((stock, i) => (
            <div
              key={stock.symbol}
              onClick={() => onSelect(stock.symbol)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.4rem',
                cursor: 'pointer',
                borderBottom: i < surgeStocks.length - 1 ? '1px solid var(--border)' : 'none',
                borderRadius: '6px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stock.symbol}
                </div>
                <div style={{ fontSize: '0.7rem', color: stock.positive ? 'var(--accent)' : 'var(--danger)', fontWeight: 600 }}>
                  {stock.pct >= 0 ? '+' : ''}{stock.pct.toFixed(2)}%
                </div>
              </div>
              <div style={{
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: stock.rvol > 3 ? 'var(--danger-dim)' : 'var(--accent-dim)',
                color: stock.rvol > 3 ? 'var(--danger-solid)' : 'var(--accent-solid)'
              }}>
                {stock.rvol.toFixed(1)}x vol
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
