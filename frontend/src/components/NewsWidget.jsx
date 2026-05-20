import React from 'react';

// Mocked news representing standard CNBC & US News integration
const getNewsForSymbol = (symbol) => [
  {
    id: 1,
    source: "CNBC",
    headline: `${symbol} sees strong institutional accumulation ahead of key macroeconomic data release.`,
    time: "2 hours ago",
    sentiment: "positive"
  },
  {
    id: 2,
    source: "US News & World Report",
    headline: `Global supply chain shifts provide significant tailwinds for ${symbol}'s export margins.`,
    time: "5 hours ago",
    sentiment: "positive"
  },
  {
    id: 3,
    source: "CNBC",
    headline: `Analysts upgrade ${symbol} following robust quarterly earnings beat and forward guidance.`,
    time: "1 day ago",
    sentiment: "positive"
  },
  {
    id: 4,
    source: "Bloomberg",
    headline: `Foreign Portfolio Investors increase stake in ${symbol} amidst emerging market rally.`,
    time: "1 day ago",
    sentiment: "neutral"
  }
];

export default function NewsWidget({ symbol }) {
  const news = getNewsForSymbol(symbol);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <div className="layer-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="layer-title" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Global News Feed</span>
        <span className="data-source-live">LIVE</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {news.map(item => (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: '700', 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                color: item.source === 'CNBC' ? '#00b8d4' : '#f59e0b'
              }}>
                {item.source}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.time}</span>
            </div>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{item.headline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
