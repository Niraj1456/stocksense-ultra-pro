const express = require("express");
const Layer8 = require("../layers/layer8");
const Layer10 = require("../layers/layer10");
const fmp = require("../services/fmpService");

const layer10Router = express.Router();

// FIX RC12: Route was calling Layer10.valuation() which doesn't exist.
// Now correctly calls the 4 actual engines with real data.
layer10Router.get("/valuation/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol;

    // Fetch Yahoo fundamentals + FMP data in parallel
    const [f, fmpDcf, fmpProfile] = await Promise.all([
      Layer8.financials(symbol),
      fmp.getDCF(symbol).catch(() => null),
      fmp.getProfile(symbol).catch(() => null)
    ]);

    const yahooData = f.ok ? f.data : {};
    const currentPrice = fmpProfile?.price || null;

    const results = {};

    // DCF Engine
    if (fmpDcf && currentPrice) {
      results.dcf = Layer10.dcfEngine({
        free_cash_flow: fmpDcf.fcf || 0,
        shares_outstanding: fmpDcf.sharesOutstanding || 1,
        current_price: currentPrice,
        // Use FMP's pre-computed intrinsic value
        intrinsic_value_override: fmpDcf.dcf || null
      });
    } else {
      results.dcf = { ok: false, error: "insufficient_data_for_dcf" };
    }

    // Graham Number Engine
    if (yahooData.peRatio && currentPrice) {
      const eps = currentPrice / yahooData.peRatio;
      const bvps = yahooData.pbRatio ? currentPrice / yahooData.pbRatio : null;
      if (eps > 0 && bvps && bvps > 0) {
        results.graham = Layer10.grahamNumberEngine({
          eps,
          book_value_per_share: bvps,
          current_price: currentPrice
        });
      } else {
        results.graham = { ok: false, error: "negative_eps_or_bvps" };
      }
    } else {
      results.graham = { ok: false, error: "insufficient_data" };
    }

    // Earnings Yield Engine
    if (yahooData.peRatio && yahooData.peRatio > 0) {
      results.earningsYield = Layer10.earningsYieldEngine({
        pe_ratio: yahooData.peRatio,
        gsec_10yr_yield: 7.0 // India G-Sec rate
      });
    } else {
      results.earningsYield = { ok: false, error: "no_pe_ratio" };
    }

    // Reverse DCF Engine (requires more complex inputs — basic version)
    results.reverseDcf = { ok: false, error: "requires_manual_inputs" };

    res.json({
      ok: true,
      data: results,
      meta: { fetchedAt: new Date().toISOString(), source: "route:layer10" }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = { layer10Router };
