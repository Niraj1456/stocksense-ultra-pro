const express = require("express");
const Layer8 = require("../layers/layer8");
const Layer9 = require("../layers/layer9");
const fmp = require("../services/fmpService");

const layer9Router = express.Router();

// FIX RC12: Route was calling Layer9.forensicAccounting() which doesn't exist.
// Now correctly uses the actual exported engines with real FMP data.
layer9Router.get("/forensic/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol;

    // Fetch both Yahoo and FMP data in parallel
    const [f, fmpData] = await Promise.all([
      Layer8.financials(symbol),
      fmp.getFinancialStatements(symbol).catch(() => null)
    ]);

    const yahooData = f.ok ? f.data : {};
    const fmpLatest = fmpData?.latest || {};
    const fmpBalance = fmpData?.balance || [];
    const fmpIncome = fmpData?.income || [];

    // Altman Z-Score (requires FMP balance sheet data)
    let altmanResult = { ok: false, error: "insufficient_data" };
    if (fmpLatest.totalAssets && fmpLatest.totalLiabilities) {
      const workingCapital = (fmpLatest.totalCurrentAssets || 0) - (fmpLatest.totalCurrentLiabilities || 0);
      altmanResult = Layer9.altmanZScoreEngine({
        working_capital: workingCapital,
        retained_earnings: fmpLatest.retainedEarnings || 0,
        ebit: fmpLatest.operatingIncome || 0,
        market_value_equity: yahooData.marketCap || 0,
        total_liabilities: fmpLatest.totalLiabilities,
        sales: fmpLatest.revenue || 0,
        total_assets: fmpLatest.totalAssets
      });
    }

    // Piotroski F-Score (requires 2+ years of FMP data)
    let piotroskiResult = { ok: false, error: "insufficient_data" };
    if (fmpIncome.length >= 2 && fmpBalance.length >= 2) {
      const cf = fmpData?.cashflow || [];
      piotroskiResult = Layer9.piotroskiFScoreEngine({
        net_income_positive: (fmpIncome[0]?.netIncome || 0) > 0,
        cfo_positive: (cf[0]?.operatingCashFlow || 0) > 0,
        roce_improving: (fmpIncome[0]?.netIncome / (fmpBalance[0]?.totalStockholdersEquity || 1)) > (fmpIncome[1]?.netIncome / (fmpBalance[1]?.totalStockholdersEquity || 1)),
        cfo_greater_than_net_income: (cf[0]?.operatingCashFlow || 0) > (fmpIncome[0]?.netIncome || 0),
        long_term_debt_decreasing: (fmpBalance[0]?.longTermDebt || 0) < (fmpBalance[1]?.longTermDebt || Infinity),
        current_ratio_improving: ((fmpBalance[0]?.totalCurrentAssets || 0) / (fmpBalance[0]?.totalCurrentLiabilities || 1)) > ((fmpBalance[1]?.totalCurrentAssets || 0) / (fmpBalance[1]?.totalCurrentLiabilities || 1)),
        no_new_shares_issued: (fmpBalance[0]?.commonStock || 0) <= (fmpBalance[1]?.commonStock || 0),
        gross_margin_improving: ((fmpIncome[0]?.grossProfit || 0) / (fmpIncome[0]?.revenue || 1)) > ((fmpIncome[1]?.grossProfit || 0) / (fmpIncome[1]?.revenue || 1)),
        asset_turnover_improving: ((fmpIncome[0]?.revenue || 0) / (fmpBalance[0]?.totalAssets || 1)) > ((fmpIncome[1]?.revenue || 0) / (fmpBalance[1]?.totalAssets || 1))
      });
    }

    // Beneish M-Score (requires 2+ years)
    let beneishResult = { ok: false, error: "insufficient_data" };
    if (fmpIncome.length >= 2 && fmpBalance.length >= 2) {
      const curr = { ...fmpIncome[0], ...fmpBalance[0], ...(fmpData?.cashflow?.[0] || {}) };
      const prev = { ...fmpIncome[1], ...fmpBalance[1], ...(fmpData?.cashflow?.[1] || {}) };
      beneishResult = Layer9.beneishMScoreEngine({
        dsri: ((curr.netReceivables || 1) / (curr.revenue || 1)) / ((prev.netReceivables || 1) / (prev.revenue || 1)),
        gmi: ((prev.grossProfit || 1) / (prev.revenue || 1)) / ((curr.grossProfit || 1) / (curr.revenue || 1)),
        aqi: 1.0, // Asset quality index — complex, default to neutral
        sgi: (curr.revenue || 1) / (prev.revenue || 1),
        depi: 1.0, // Depreciation index — default neutral
        sgai: ((curr.sellingAndMarketingExpenses || 0) + (curr.generalAndAdministrativeExpenses || 0)) / (curr.revenue || 1) / (((prev.sellingAndMarketingExpenses || 0) + (prev.generalAndAdministrativeExpenses || 0)) / (prev.revenue || 1) || 1),
        tata: ((curr.netIncome || 0) - (curr.operatingCashFlow || 0)) / (curr.totalAssets || 1),
        lvgi: ((curr.totalLiabilities || 1) / (curr.totalAssets || 1)) / ((prev.totalLiabilities || 1) / (prev.totalAssets || 1))
      });
    }

    res.json({
      ok: true,
      data: {
        altman: altmanResult,
        piotroski: piotroskiResult,
        beneish: beneishResult
      },
      meta: { fetchedAt: new Date().toISOString(), source: "route:layer9" }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = { layer9Router };
