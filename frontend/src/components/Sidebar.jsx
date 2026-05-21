import React from 'react';

function formatVolume(v) {
  if (!v || v === 0) return '—';
  if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(2)} L`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)} K`;
  return v.toString();
}

export default function Sidebar({
  watchlist,
  selectedStock,
  onSelect,
  onToggleWatchlist,
  marketData,
  searchTerm,
  onSearchChange,
  suggestions,
  onKeyPress,
  livePrice
}) {
  // Get top volume stocks from real market data
  const volumeStocks = (marketData || [])
    .filter(s => s.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  return (
    <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Quick Search Terminal */}
      <div className="sidebar-card-premium">
        <div className="sidebar-card-title" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>🔍</span> Quick Search Terminal
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="search-input"
            style={{ width: '100%', paddingLeft: '2.2rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            placeholder="Search stock symbol (e.g. TCS)..."
            value={searchTerm}
            onChange={onSearchChange}
            onKeyDown={onKeyPress}
          />
          <span className="search-icon" style={{ left: '12px' }}>🔍</span>
          {suggestions.length > 0 && (
            <div className="suggestions" style={{ position: 'absolute', width: '100%', top: 'calc(100% + 4px)', left: 0, zIndex: 150, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', maxHeight: '250px', overflowY: 'auto' }}>
              {suggestions.map(s => (
                <div 
                  key={s} 
                  className="suggestion-item" 
                  onClick={() => onSelect(s)} 
                  style={{ padding: '0.55rem 0.8rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', borderBottom: '1px solid var(--border)' }}
                >
                  <span style={{ fontWeight: 700 }}>{s}</span>
                  <span style={{ color: 'var(--accent)', fontSize: '0.68rem', fontWeight: 800 }}>NSE</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Watchlist Card */}
      <div className="sidebar-card-premium">
        <div className="sidebar-card-title" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--warning)' }}>★</span> Your Watchlist
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {watchlist.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No stocks in watchlist yet. Search and add stocks to track.
            </p>
          )}
          {watchlist.map(stock => {
            const stockInfo = (marketData || []).find(s => s.symbol === stock);
            let displayPct = null;
            let positive = true;
            let dotColor = 'amber';

            if (stockInfo) {
              displayPct = (stockInfo.pct >= 0 ? '+' : '') + stockInfo.pct.toFixed(2) + '%';
              positive = stockInfo.positive;
              const pctVal = stockInfo.pct;
              dotColor = pctVal > 1.5 ? 'green' : pctVal < -1.5 ? 'red' : 'amber';
            } else if (stock === selectedStock && livePrice && livePrice.pct !== "" && livePrice.pct !== "-") {
              displayPct = livePrice.pct;
              positive = livePrice.positive;
              const parsedPct = parseFloat(livePrice.pct.replace('%', ''));
              if (!isNaN(parsedPct)) {
                dotColor = parsedPct > 1.5 ? 'green' : parsedPct < -1.5 ? 'red' : 'amber';
              }
            }

            return (
              <div
                key={stock}
                onClick={() => onSelect(stock)}
                className={`sidebar-row-premium${stock === selectedStock ? ' active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.65rem', border: stock === selectedStock ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.02)', background: stock === selectedStock ? 'var(--accent-dim)' : 'rgba(255, 255, 255, 0.01)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={`status-indicator-dot ${dotColor}`}></span>
                  <span className="sidebar-item-name" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {stock}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {displayPct ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: positive ? 'var(--accent)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                      {displayPct}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      —
                    </span>
                  )}
                  <span
                    className="sidebar-item-remove"
                    onClick={(e) => { e.stopPropagation(); onToggleWatchlist(stock); }}
                    title="Remove from watchlist"
                    style={{ fontSize: '0.95rem', cursor: 'pointer', fontWeight: 800, color: 'var(--text-muted)', transition: 'color 0.2s', padding: '0 2px' }}
                  >
                    ×
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume Stocks - Real Data */}
      <div className="sidebar-card-premium">
        <div className="sidebar-card-title" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--accent)' }}>📊</span> Top Volume Stocks
          <span className="data-source-live" style={{ marginLeft: 'auto', fontSize: '0.52rem', padding: '1px 3px' }}>
            Live Feed
          </span>
        </div>
        {volumeStocks.length === 0 ? (
          <div style={{ padding: '1rem 0', textAlign: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading volume data...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {volumeStocks.map((stock, i) => {
              const dotColor = stock.pct > 1.5 ? 'green' : stock.pct < -1.5 ? 'red' : 'amber';
              return (
                <div
                  key={stock.symbol}
                  onClick={() => onSelect(stock.symbol)}
                  className={`sidebar-row-premium${stock.symbol === selectedStock ? ' active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', padding: '0.55rem 0.65rem', border: stock.symbol === selectedStock ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.02)', background: stock.symbol === selectedStock ? 'var(--accent-dim)' : 'rgba(255, 255, 255, 0.01)' }}
                >
                  <span style={{
                    width: '18px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    marginRight: '0.2rem',
                    flexShrink: 0
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                    <span className={`status-indicator-dot ${dotColor}`}></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {stock.symbol}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        Vol: {formatVolume(stock.volume)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <div style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: stock.positive ? 'var(--accent)' : 'var(--danger)',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {stock.pct >= 0 ? '+' : ''}{stock.pct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Relative Volume Surge - stocks with unusual volume */}
      <div className="sidebar-card-premium">
        <div className="sidebar-card-title" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--danger)' }}>🔥</span> Volume Surge
          <span className="status-grid-active-badge" style={{ marginLeft: 'auto', fontSize: '0.52rem', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' }}>
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
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No unusual volume detected today
                </span>
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {surgeStocks.map((stock) => {
                const dotColor = stock.pct > 1.5 ? 'green' : stock.pct < -1.5 ? 'red' : 'amber';
                return (
                  <div
                    key={stock.symbol}
                    onClick={() => onSelect(stock.symbol)}
                    className={`sidebar-row-premium${stock.symbol === selectedStock ? ' active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.65rem', border: stock.symbol === selectedStock ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.02)', background: stock.symbol === selectedStock ? 'var(--accent-dim)' : 'rgba(255, 255, 255, 0.01)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className={`status-indicator-dot ${dotColor}`}></span>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {stock.symbol}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: stock.positive ? 'var(--accent)' : 'var(--danger)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {stock.pct >= 0 ? '+' : ''}{stock.pct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding: '0.2rem 0.45rem',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: stock.rvol > 3 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      color: stock.rvol > 3 ? '#f43f5e' : '#10b981',
                      border: `1px solid ${stock.rvol > 3 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {stock.rvol.toFixed(1)}x RVOL
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
