/**
 * Stocksense Ultra Pro - Localized In-Memory Volatile Cache (WebSocket Simulation)
 * Houses fast-moving, volatile data (Layers 2, 3, 4, 5, 12) for sub-millisecond hot-path access.
 */

const { indicatorsFromCandles } = require("../layers/layer3/candles");
const {
  rsiEngine,
  macdEngine,
  emaEngine,
  atrEngine,
  adxEngine,
  volumeProfileEngine,
  supportResistanceEngine
} = require("../layers/layer3/technicals");

// Global volatile cache store
global.volatileCache = global.volatileCache || {};

class VolatileCacheManager {
  /**
   * Initializes volatile cache for a symbol with realistic default/simulated datasets
   */
  static initSymbol(symbol) {
    if (global.volatileCache[symbol]) return global.volatileCache[symbol];

    const basePrice = this.getBasePrice(symbol);
    const candles = this.generateMockCandles(basePrice);
    const depth = this.generateMockDepth(basePrice);
    
    const volatileObj = {
      symbol,
      lastPrice: basePrice,
      candles,
      depth,
      lastUpdated: new Date().toISOString(),
      indicators: null // compiled on first read or simulation tick
    };

    global.volatileCache[symbol] = volatileObj;
    this.recomputeIndicators(symbol);

    // Start simulation ticks for this symbol to emulate live WebSocket feeds
    this.startSimulation(symbol);

    return global.volatileCache[symbol];
  }

  /**
   * Returns volatile data for a symbol. Automatically initializes if missing.
   */
  static get(symbol) {
    const cleanSymbol = String(symbol).trim().toUpperCase();
    if (!global.volatileCache[cleanSymbol]) {
      this.initSymbol(cleanSymbol);
    }
    return global.volatileCache[cleanSymbol];
  }

  /**
   * Updates volatile cache with real incoming WebSocket tick data
   */
  static updateTick(symbol, price, depthData = null) {
    const cleanSymbol = String(symbol).trim().toUpperCase();
    const cache = global.volatileCache[cleanSymbol];
    if (!cache) {
      this.initSymbol(cleanSymbol);
      return;
    }

    cache.lastPrice = price;
    if (depthData) {
      cache.depth = depthData;
    } else {
      cache.depth = this.generateMockDepth(price);
    }
    
    // Update the last candle
    if (cache.candles && cache.candles.length > 0) {
      const lastCandle = cache.candles[cache.candles.length - 1];
      lastCandle.c = price;
      if (price > lastCandle.h) lastCandle.h = price;
      if (price < lastCandle.l) lastCandle.l = price;
      lastCandle.v += Math.floor(Math.random() * 100);
    }

    cache.lastUpdated = new Date().toISOString();
    this.recomputeIndicators(cleanSymbol);
  }

  /**
   * Recalculates indicators extremely fast in-memory using Layer 3 technicals
   */
  static recomputeIndicators(symbol) {
    const cache = global.volatileCache[symbol];
    if (!cache) return;

    const candles = cache.candles;
    const s = {
      open: candles.map(c => c.o),
      high: candles.map(c => c.h),
      low: candles.map(c => c.l),
      close: candles.map(c => c.c),
      volume: candles.map(c => c.v)
    };
    const currentPrice = cache.lastPrice;

    const indicators = indicatorsFromCandles(candles);
    
    const rsiRes = rsiEngine({ close_prices: s.close });
    const macdRes = macdEngine({ close_prices: s.close });
    const emaRes = emaEngine({ close_prices: s.close, current_price: currentPrice });
    const atrRes = atrEngine({
      high_prices: s.high,
      low_prices: s.low,
      close_prices: s.close,
      entry_price: currentPrice,
      vix_regime: "STABLE"
    });
    const adxRes = adxEngine({ high_prices: s.high, low_prices: s.low, close_prices: s.close });

    const pvPairs = candles.map(c => ({ price: c.c, volume: c.v }));
    const vpRes = volumeProfileEngine({
      price_volume_pairs: pvPairs,
      current_price: currentPrice,
      rvol: indicators.rvol20 || 1.0,
      atr_target_2: atrRes.ok ? atrRes.data.target_2 : null
    });

    const hvn = vpRes.ok ? vpRes.data.hvn_zones : [];
    const srRes = supportResistanceEngine({
      high_prices: s.high,
      low_prices: s.low,
      close_prices: s.close,
      current_price: currentPrice,
      hvn_zones: hvn
    });

    if (rsiRes.ok) indicators.rsiDetails = rsiRes.data;
    if (macdRes.ok) {
      indicators.macdDetails = macdRes.data;
      indicators.macd = {
        macd_line: macdRes.data.macd_line,
        signal_line: macdRes.data.signal_line,
        histogram: macdRes.data.histogram,
        histogram_direction: macdRes.data.histogram_direction,
        crossover: macdRes.data.crossover
      };
    }
    if (emaRes.ok) indicators.emaDetails = emaRes.data;
    if (atrRes.ok) indicators.atrDetails = atrRes.data;
    if (adxRes.ok) indicators.adxDetails = adxRes.data;
    if (vpRes.ok) indicators.vpDetails = vpRes.data;
    if (srRes.ok) {
      indicators.srDetails = srRes.data;
      indicators.r1 = srRes.data.r1;
      indicators.s1 = srRes.data.s1;
      indicators.r2 = srRes.data.r2;
      indicators.s2 = srRes.data.s2;
      indicators.r3 = srRes.data.r3;
      indicators.s3 = srRes.data.s3;
    }

    cache.indicators = indicators;
  }

  /**
   * Background Simulation Ticker Loop simulating orderbook and price changes
   */
  static startSimulation(symbol) {
    if (global.volatileCache[`interval_${symbol}`]) return;

    // Simulation interval runs every 1 second
    const intervalId = setInterval(() => {
      const cache = global.volatileCache[symbol];
      if (!cache) return;

      // Small price walk (simulating live HFT feed)
      const volatility = 0.001; // 0.1% volatility
      const changePct = (Math.random() - 0.48) * volatility; // slight upward drift simulation
      const newPrice = Number((cache.lastPrice * (1 + changePct)).toFixed(2));

      // Dynamic orderbook fluctuations
      const depth = cache.depth;
      const spread = 0.05;

      // Mutate bid & ask slightly
      depth.buy.forEach((bid, idx) => {
        bid.price = Number((newPrice - (idx + 1) * spread).toFixed(2));
        bid.quantity += Math.floor((Math.random() - 0.5) * 50);
        if (bid.quantity < 10) bid.quantity = 10;
      });

      depth.sell.forEach((ask, idx) => {
        ask.price = Number((newPrice + (idx + 1) * spread).toFixed(2));
        ask.quantity += Math.floor((Math.random() - 0.5) * 50);
        if (ask.quantity < 10) ask.quantity = 10;
      });

      this.updateTick(symbol, newPrice, depth);
    }, 1000);

    global.volatileCache[`interval_${symbol}`] = intervalId;
  }

  // --- MOCK GENERATION UTILITIES ---

  static getBasePrice(symbol) {
    const prices = {
      RELIANCE: 2450.0,
      TCS: 3400.0,
      INFY: 1550.0,
      HDFCBANK: 1600.0,
      ICICIBANK: 950.0,
      SBIN: 580.0
    };
    return prices[symbol] || 1000.0;
  }

  static generateMockCandles(basePrice) {
    const candles = [];
    let currentPrice = basePrice * 0.95;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Generate 125 daily candles
    for (let i = 125; i >= 0; i--) {
      const change = (Math.random() - 0.49) * 20; // daily change
      const o = currentPrice;
      const c = currentPrice + change;
      const h = Math.max(o, c) + Math.random() * 5;
      const l = Math.min(o, c) - Math.random() * 5;
      const v = 50000 + Math.floor(Math.random() * 200000);
      const t = new Date(now - i * oneDay).toISOString().slice(0, 10);

      candles.push({ o, h, l, c, v, t });
      currentPrice = c;
    }
    return candles;
  }

  static generateMockDepth(price) {
    const buy = [];
    const sell = [];
    const spread = 0.05;

    for (let i = 1; i <= 5; i++) {
      buy.push({
        price: Number((price - i * spread).toFixed(2)),
        quantity: 500 + Math.floor(Math.random() * 2000)
      });
      sell.push({
        price: Number((price + i * spread).toFixed(2)),
        quantity: 500 + Math.floor(Math.random() * 2000)
      });
    }

    return { buy, sell };
  }
}

module.exports = VolatileCacheManager;
