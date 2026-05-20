import React, { useState, useEffect } from 'react';

const INDICES = [
  { name: "NIFTY 50", symbol: "^NSEI" },
  { name: "SENSEX", symbol: "^BSESN" },
  { name: "NIFTY BANK", symbol: "^NSEBANK" },
  { name: "NIFTY IT", symbol: "^CNXIT" },
  { name: "NIFTY AUTO", symbol: "^CNXAUTO" },
  { name: "NIFTY PHARMA", symbol: "^CNXPHARMA" },
];

export default function IndexRibbon({ selectedStock, onSelect }) {
  const [indexData, setIndexData] = useState({});

  useEffect(() => {
    const fetchAll = async () => {
      for (const idx of INDICES) {
        try {
          const res = await fetch(`/api/yahoo/v8/finance/chart/${idx.symbol}?range=1d&interval=1d`);
          const d = await res.json();
          const meta = d.chart.result[0].meta;
          const price = meta.regularMarketPrice || 0;
          const prev = meta.previousClose || meta.chartPreviousClose || price;
          const chg = prev > 0 ? (price - prev) : 0;
          const pct = prev > 0 ? ((chg / prev) * 100) : 0;
          setIndexData(prev => ({
            ...prev,
            [idx.name]: { price, chg, pct: isNaN(pct) ? 0 : pct, positive: chg >= 0 }
          }));
        } catch { /* silent */ }
      }
    };
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="index-ribbon">
      {INDICES.map(idx => {
        const d = indexData[idx.name];
        const isActive = selectedStock === idx.name;
        return (
          <div
            key={idx.name}
            className={`index-card${isActive ? ' active' : ''}`}
            onClick={() => onSelect(idx.name)}
          >
            <span className="index-name">{idx.name}</span>
            <span className="index-value">
              {d ? d.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
            </span>
            <span className="index-change" style={{ color: d?.positive ? 'var(--accent)' : 'var(--danger)' }}>
              {d ? `${d.chg >= 0 ? '+' : ''}${d.chg.toFixed(2)} (${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(2)}%)` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
