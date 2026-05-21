import React, { useEffect, useRef, memo } from 'react';

function TradingViewWidget({ symbol, theme = 'dark' }) {
  const container = useRef();

  useEffect(() => {
    // Remove any Yahoo Finance suffixes (.NS, .BO) and spaces
    const cleanSymbol = symbol.replace(/\s+/g, '').replace(/\.NS$/i, '').replace(/\.BO$/i, '');
  
    // USE BSE PREFIX FOR FREE EMBEDS: TradingView restricts NSE data on free embeds, 
    // causing the 'Notification: Only available on TradingView' error which defaults to AAPL.
    // BSE data is unrestricted and identical in price action.
    let tvSymbol = `BSE:${cleanSymbol}`;
  
    // Keep Nifty indices as TVC (Calculations) to bypass NSE embed restrictions, SENSEX remains BSE
    if (symbol === "NIFTY 50") tvSymbol = "TVC:NIFTY";
    else if (symbol === "SENSEX") tvSymbol = "BSE:SENSEX";
    else if (symbol === "NIFTY BANK") tvSymbol = "TVC:BANKNIFTY";
    else if (symbol === "NIFTY IT") tvSymbol = "TVC:CNXIT";
    else if (symbol === "NIFTY AUTO") tvSymbol = "TVC:CNXAUTO";
    else if (symbol === "NIFTY PHARMA") tvSymbol = "TVC:CNXPHARMA";

    let tvScriptLoadingPromise;

    if (!document.getElementById("tradingview-widget-script")) {
      const script = document.createElement("script");
      script.id = "tradingview-widget-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.type = "text/javascript";
      script.async = true;
      document.head.appendChild(script);

      tvScriptLoadingPromise = new Promise((resolve) => {
        script.onload = resolve;
      });
    } else {
      tvScriptLoadingPromise = Promise.resolve();
    }

    tvScriptLoadingPromise.then(() => {
      if (window.TradingView && container.current) {
        new window.TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: "D",
          timezone: "Asia/Kolkata",
          theme: theme,
          style: "1",
          locale: "en",
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          container_id: container.current.id
        });
      }
    });
  }, [symbol, theme]);

  return (
    <div className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
      <div id={`tv_chart_${symbol.replace(/\s+/g, '')}`} ref={container} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

export default memo(TradingViewWidget);
