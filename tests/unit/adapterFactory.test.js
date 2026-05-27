const { 
  getMarketDataAdapter, 
  getFundamentalAdapter, 
  circuitBreaker 
} = require("../../src/adapters/adapterFactory");
const YahooAdapter = require("../../src/adapters/yahoo/yahooAdapter");

// Mock adapters
jest.mock("../../src/adapters/yahoo/yahooAdapter", () => {
  return jest.fn().mockImplementation(() => {
    return {
      getHistoricalPrices: jest.fn().mockResolvedValue({ dates: ["2026-05-25"], close: [150.2] }),
      getLTP: jest.fn().mockResolvedValue({ price: 150.2 })
    };
  });
});

jest.mock("../../src/adapters/kite/kiteAdapter", () => {
  return jest.fn().mockImplementation(() => {
    return {
      getHistoricalPrices: jest.fn().mockRejectedValue(new Error("Kite API Error")),
      getLTP: jest.fn().mockResolvedValue({ price: 200.0 })
    };
  });
});

describe("Adapter Factory & Circuit Breaker Unit Tests", () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.MARKET_DATA_PROVIDER;
    delete process.env.FUNDAMENTAL_DATA_PROVIDER;
    circuitBreaker.failures = 0;
    circuitBreaker.lastFailureTime = 0;
  });

  it("should resolve YahooAdapter as the default provider", () => {
    const adapter = getMarketDataAdapter();
    expect(adapter).toBeDefined();
  });

  it("should increment failures on errors and activate the circuit breaker on threshold", async () => {
    process.env.MARKET_DATA_PROVIDER = "kite";
    
    // Request a fresh module reference to pick up the new env provider
    const { getMarketDataAdapter: getKiteMarketAdapter, circuitBreaker: cb } = require("../../src/adapters/adapterFactory");
    const adapter = getKiteMarketAdapter();

    expect(cb.failures).toBe(0);

    // Run 3 failing calls to trip the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await adapter.getHistoricalPrices("RELIANCE", "1d");
      } catch (err) {
        // Ignored, we want to record failures
      }
    }

    expect(cb.failures).toBe(3);
    expect(cb.isOpen()).toBe(true);
  });
});
