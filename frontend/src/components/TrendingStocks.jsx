import React, { useState, useEffect, useCallback } from 'react';

// Large pool of popular NSE stocks to scan daily
const STOCK_POOL = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "BHARTIARTL", "SBIN", "BAJFINANCE", "ITC", "KOTAKBANK",
  "LT", "WIPRO", "AXISBANK", "ADANIENT", "TMPV",
  "SUNPHARMA", "MARUTI", "ASIANPAINT", "TITAN", "ULTRACEMCO",
  "HCLTECH", "ONGC", "NTPC", "POWERGRID", "COALINDIA",
  "BAJAJFINSV", "JSWSTEEL", "TATASTEEL", "HINDALCO", "DRREDDY",
  "CIPLA", "EICHERMOT", "BPCL", "GRASIM", "DIVISLAB",
  "APOLLOHOSP", "HEROMOTOCO", "NESTLEIND", "DMART", "TECHM",
  "INDUSINDBK", "BRITANNIA", "SBILIFE", "BAJAJ-AUTO", "GODREJCP",
  "ADANIPORTS", "TATAPOWER", "VEDL", "DLF", "ETERNAL"
];

async function fetchStockData(symbol) {
  try {
    let yfSym = "";
    if (symbol === "NIFTY 50") yfSym = "^NSEI";
    else if (symbol === "SENSEX") yfSym = "^BSESN";
    else if (symbol === "NIFTY BANK") yfSym = "^NSEBANK";
    else if (symbol === "NIFTY IT") yfSym = "^CNXIT";
    else if (symbol === "NIFTY AUTO") yfSym = "^CNXAUTO";
    else if (symbol === "NIFTY PHARMA") yfSym = "^CNXPHARMA";
    else yfSym = `${symbol.replace(/\s+/g, '')}.NS`;

    const res = await fetch(`/api/yahoo/v8/finance/chart/${yfSym}?range=6d&interval=1d`);
    const d = await res.json();
    const result = d.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const price = meta.regularMarketPrice || 0;

    // Robust, index-aligned daily previous close calculation (prevents using historical meta.previousClose)
    let yesterdayClose = 0;
    if (result.timestamp && result.timestamp.length > 0 && quote && quote.close) {
      // Find the last index in the chart that has a non-null close price
      let lastValidIdx = -1;
      for (let i = result.timestamp.length - 1; i >= 0; i--) {
        if (quote.close[i] != null) {
          lastValidIdx = i;
          break;
        }
      }

      if (lastValidIdx !== -1) {
        const lastTimestamp = result.timestamp[lastValidIdx];
        
        const getIstDateString = (dateObj) => {
          try {
            return dateObj.toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
          } catch (e) {
            const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
            const istDate = new Date(utc + (3600000 * 5.5));
            return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
          }
        };

        const lastCandleIst = getIstDateString(new Date(lastTimestamp * 1000));
        const marketPriceTime = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date();
        const todayIst = getIstDateString(marketPriceTime);
        const lastIsToday = lastCandleIst === todayIst;

        if (lastIsToday) {
          // Find the closest non-null candle before lastValidIdx
          let yesterdayIdx = -1;
          for (let i = lastValidIdx - 1; i >= 0; i--) {
            if (quote.close[i] != null) {
              yesterdayIdx = i;
              break;
            }
          }
          if (yesterdayIdx !== -1) {
            yesterdayClose = quote.close[yesterdayIdx];
          }
        } else {
          // The last valid candle in the chart is yesterday or older.
          yesterdayClose = quote.close[lastValidIdx];
        }
      }
    }

    // Fallback to meta.chartPreviousClose (yesterday's close) or price
    if (!yesterdayClose || yesterdayClose <= 0) {
      yesterdayClose = meta.chartPreviousClose || price;
    }
    
    const chg = yesterdayClose > 0 ? (price - yesterdayClose) : 0;
    const pct = yesterdayClose > 0 ? ((chg / yesterdayClose) * 100) : 0;

    // FIXED: Volume — use yesterday's COMPLETE volume for ranking,
    // and show today's partial volume separately
    const volumes = quote?.volume?.filter(v => v != null) || [];
    const todayVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
    const yesterdayVolume = volumes.length >= 2 ? volumes[volumes.length - 2] : todayVolume;
    
    // Use yesterday's complete volume for ranking (today's is partial during market hours)
    // After market close, today's volume will be complete
    const now = new Date();
    let hour = now.getHours();
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: 'numeric'
      }).formatToParts(now).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});
      hour = parseInt(parts.hour, 10);
    } catch (e) {
      // fallback
    }
    const isMarketHours = hour >= 9 && hour < 16;
    const rankVolume = isMarketHours && volumes.length >= 2 ? yesterdayVolume : todayVolume;
    
    // Average volume from all complete days (exclude today during market hours)
    const completeVolumes = isMarketHours && volumes.length >= 2 ? volumes.slice(0, -1) : volumes;
    const avgVolume = completeVolumes.length > 1
      ? completeVolumes.slice(0, -1).reduce((a, b) => a + b, 0) / (completeVolumes.length - 1)
      : rankVolume;
    const rvol = avgVolume > 0 ? todayVolume / avgVolume : 1;

    return {
      symbol,
      price,
      chg,
      pct: isNaN(pct) ? 0 : pct,
      positive: chg >= 0,
      volume: rankVolume,
      todayVolume,
      avgVolume,
      rvol: isNaN(rvol) ? 1 : rvol
    };
  } catch {
    return null;
  }
}

function StockRow({ data, onClick, showVolume }) {
  if (!data) return null;
  const initials = data.symbol.slice(0, 2);

  const formatVolume = (v) => {
    if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
    if (v >= 100000) return `${(v / 100000).toFixed(2)} L`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)} K`;
    return v.toString();
  };

  return (
    <div className="stock-card-row" onClick={() => onClick(data.symbol)}>
      <div className="stock-card-logo">{initials}</div>
      <div className="stock-card-info">
        <div className="stock-card-name">{data.symbol}</div>
        <div className="stock-card-symbol">NSE</div>
      </div>
      {showVolume && (
        <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vol</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatVolume(data.volume)}
          </div>
        </div>
      )}
      <div className="stock-card-price">
        <div className="stock-card-value">
          ₹{data.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        <div className="stock-card-change" style={{ color: data.positive ? 'var(--accent)' : 'var(--danger)' }}>
          {data.pct >= 0 ? '+' : ''}{data.pct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

export default function TrendingStocks({ watchlist = [], onSelectStock, onDataReady }) {
  const [tab, setTab] = useState('gainers');
  const [allStocks, setAllStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const onDataReadyRef = React.useRef(onDataReady);
  onDataReadyRef.current = onDataReady;

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    // Merge STOCK_POOL and watchlist to fetch live data for all of them
    const pool = Array.from(new Set([...STOCK_POOL, ...watchlist]));
    // Fetch in small batches to avoid overwhelming the proxy
    const results = [];
    const batchSize = 5;
    for (let i = 0; i < pool.length; i += batchSize) {
      const batch = pool.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(fetchStockData));
      results.push(...batchResults);
    }
    const valid = results.filter(Boolean);
    setAllStocks(valid);
    setLoading(false);
    setLastUpdated(new Date());

    // Share data with parent/sidebar
    if (onDataReadyRef.current) {
      onDataReadyRef.current(valid);
    }
  }, [watchlist]);

  useEffect(() => {
    fetchAllData();
    // Refresh every 60 seconds for live updates during market hours
    const iv = setInterval(fetchAllData, 60000);
    return () => clearInterval(iv);
  }, [fetchAllData]);

  const tabs = [
    { id: 'gainers', label: 'Top Gainers' },
    { id: 'losers', label: 'Top Losers' },
    { id: 'active', label: 'Most Active' },
    { id: 'volume', label: 'High Volume' },
  ];

  const getStocks = () => {
    if (allStocks.length === 0) return [];
    // Only display stocks from the main STOCK_POOL in the explorer tabs
    const sorted = [...allStocks].filter(s => STOCK_POOL.includes(s.symbol));
    switch (tab) {
      case 'gainers':
        return sorted.sort((a, b) => b.pct - a.pct).slice(0, 10);
      case 'losers':
        return sorted.sort((a, b) => a.pct - b.pct).slice(0, 10);
      case 'active':
        return sorted.sort((a, b) => b.volume - a.volume).slice(0, 10);
      case 'volume':
        // Relative volume: today vs 5-day average
        return sorted.sort((a, b) => b.rvol - a.rvol).slice(0, 10);
      default:
        return sorted.slice(0, 10);
    }
  };

  const showVolume = tab === 'active' || tab === 'volume';
  const displayStocks = getStocks();

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Explore Stocks</h2>
        {lastUpdated && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="cat-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`cat-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && allStocks.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            ⚡ Fetching live market data...
          </div>
          <div style={{ width: '120px', height: '3px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto', overflow: 'hidden' }}>
            <div style={{
              width: '40%', height: '100%',
              background: 'linear-gradient(90deg, #00d09c, #059669)',
              borderRadius: '2px',
              animation: 'loadingSlide 1.2s ease-in-out infinite'
            }} />
          </div>
          <style>{`@keyframes loadingSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {displayStocks.map(s => (
            <StockRow key={s.symbol} data={s} onClick={onSelectStock} showVolume={showVolume} />
          ))}
          {displayStocks.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>
              No data available. Market may be loading...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
