const EventEmitter = require('events');
const axios = require('axios');

class MarketStream extends EventEmitter {
  constructor() {
    super();
    this.subscribedSymbols = new Set();
    this.pollingInterval = null;
    this.pollRateMs = 2000; // 2 seconds for near real-time feel
  }

  subscribe(symbols) {
    const syms = Array.isArray(symbols) ? symbols : [symbols];
    syms.forEach(s => this.subscribedSymbols.add(s));
    this.start();
    console.log(`[MarketStream] Subscribed to ${syms.join(', ')}`);
  }

  unsubscribe(symbols) {
    const syms = Array.isArray(symbols) ? symbols : [symbols];
    syms.forEach(s => this.subscribedSymbols.delete(s));
    if (this.subscribedSymbols.size === 0) {
      this.stop();
    }
  }

  start() {
    if (this.pollingInterval) return;
    console.log("[MarketStream] Starting real-time market stream (Yahoo Finance Engine)...");
    
    this.pollingInterval = setInterval(async () => {
      if (this.subscribedSymbols.size === 0) return;

      const symbols = Array.from(this.subscribedSymbols);
      
      try {
        // Yahoo Finance v7 quote endpoint provides real-time pricing without API keys
        const response = await axios.get("https://query1.finance.yahoo.com/v7/finance/quote", {
          params: { symbols: symbols.map(s => s.includes('.') ? s : `${s}.NS`).join(",") },
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          },
          timeout: 5000
        });

        const quotes = response.data?.quoteResponse?.result || [];
        
        quotes.forEach(quote => {
          const rawSymbol = quote.symbol.replace(".NS", "").replace(".BO", "");
          
          const tickData = {
            symbol: rawSymbol,
            ltp: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePct: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            timestamp: quote.regularMarketTime * 1000,
            status: quote.marketState // e.g. "REGULAR", "CLOSED"
          };

          this.emit('tick', tickData);
        });

      } catch (err) {
        console.error(`[MarketStream] Error fetching live data: ${err.message}`);
        this.emit('error', err);
      }
    }, this.pollRateMs);
  }

  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("[MarketStream] Stream stopped.");
    }
  }
}

// Singleton instance
const marketStream = new MarketStream();
module.exports = { marketStream, MarketStream };
