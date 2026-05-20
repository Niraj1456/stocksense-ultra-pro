const Layer1 = require("../layers/layer1");
const Layer7 = require("../layers/layer7");
const Layer8 = require("../layers/layer8");
const Layer9 = require("../layers/layer9");
const Layer10 = require("../layers/layer10");
const Layer11 = require("../layers/layer11");
const Layer12 = require("../layers/layer12");
const Layer13 = require("../layers/layer13");
const Layer14 = require("../layers/layer14");
const Layer15 = require("../layers/layer15");
const Layer16 = require("../layers/layer16");
const Layer17 = require("../layers/layer17");
const Layer18 = require("../layers/layer18");
const { layer3Technicals } = require("../layers/layer3");

const { fetchMarketDepth } = require("../services/nseDerivatives");

// ── NEW API INTEGRATIONS ──
const fmp = require("../services/fmpService");
const av = require("../services/alphaVantageService");

async function analyzeStock(symbol, mode = "ST") {
  // ═══════════════════════════════════════════════════════════════
  // PARALLEL DATA FETCH — All sources fire simultaneously
  // ═══════════════════════════════════════════════════════════════
  const [vixOut, chainOut, techOut, finOut, depthOutRaw, fmpData, avSentiment, avEarnings] = await Promise.all([
    Layer1.indiaVix().catch((e) => ({ ok: false, error: e.message })),
    Layer7.optionsChain(symbol).catch((e) => ({ ok: false, error: e.message })),
    layer3Technicals({ symbol }).catch((e) => ({ ok: false, error: e.message })),
    Layer8.financials(symbol).catch((e) => ({ ok: false, error: e.message })),
    fetchMarketDepth(symbol).catch(() => null),
    // NEW: FMP full profile (financials, DCF, insider, institutional, earnings)
    fmp.getFullProfile(symbol).catch(() => null),
    // NEW: Alpha Vantage NLP sentiment
    av.getNewsSentiment(symbol).catch(() => null),
    // NEW: Alpha Vantage earnings calendar for event-driven ATR
    av.getEarningsCalendar(symbol).catch(() => null)
  ]);

  // ═══════════════════════════════════════════════════════════════
  // LAYER 7: Derivatives (PCR, Max Pain) — unchanged logic
  // ═══════════════════════════════════════════════════════════════
  const pcrOut = chainOut.ok ? Layer7.pcr(chainOut.data) : { ok: false, data: {} };
  const maxPainOut = chainOut.ok ? Layer7.maxPain(chainOut.data) : { ok: false, data: {} };

  // ═══════════════════════════════════════════════════════════════
  // LAYER 8: Fundamentals — ENHANCED with FMP data
  // Merges Yahoo basic data with FMP full financials
  // ═══════════════════════════════════════════════════════════════
  const fmpLatest = fmpData?.financials?.latest || {};
  const fmpMetrics = fmpData?.metrics?.[0] || {};
  const fmpProfile = fmpData?.profile || {};

  // Merge: prefer FMP for deep data, Yahoo for quick quotes
  const mergedFundamentals = {
    // From Yahoo (fast, always available)
    peRatio: finOut.data?.peRatio || null,
    pbRatio: finOut.data?.pbRatio || null,
    pegRatio: finOut.data?.pegRatio || null,
    debtToEquity: finOut.data?.debtToEquity || (fmpMetrics.debtToEquity || null),
    roce: finOut.data?.roce || (fmpMetrics.roe ? fmpMetrics.roe * 100 : null),
    currentRatio: finOut.data?.currentRatio || fmpMetrics.currentRatio || null,
    // From FMP Profile (free tier — always available)
    marketCap: fmpProfile.marketCap || finOut.data?.marketCap || null,
    sector: fmpProfile.sector || null,
    industry: fmpProfile.industry || null,
    beta: fmpProfile.beta || null,
    companyName: fmpProfile.companyName || null,
    averageVolume: fmpProfile.averageVolume || null,
    priceRange52W: fmpProfile.range || null,
    lastDividend: fmpProfile.lastDividend || null,
    isActivelyTrading: fmpProfile.isActivelyTrading ?? true,
    // From FMP Financial Statements (paid tier — graceful degradation)
    totalAssets: fmpLatest.totalAssets || null,
    totalLiabilities: fmpLatest.totalLiabilities || null,
    totalEquity: fmpLatest.totalStockholdersEquity || null,
    revenue: fmpLatest.revenue || null,
    netIncome: fmpLatest.netIncome || null,
    ebitda: fmpLatest.ebitda || null,
    operatingIncome: fmpLatest.operatingIncome || null,
    eps: fmpLatest.eps || null,
    freeCashFlow: fmpLatest.freeCashFlow || null,
    operatingCashFlow: fmpLatest.operatingCashFlow || null,
    retainedEarnings: fmpLatest.retainedEarnings || null,
    longTermDebt: fmpLatest.longTermDebt || null,
    totalCurrentAssets: fmpLatest.totalCurrentAssets || null,
    totalCurrentLiabilities: fmpLatest.totalCurrentLiabilities || null,
    interestExpense: fmpLatest.interestExpense || null,
    grossProfit: fmpLatest.grossProfit || null,
    costOfRevenue: fmpLatest.costOfRevenue || null,
    // FMP computed values (paid tier)
    roic: fmpMetrics.roic || null,
    fcfYield: fmpMetrics.freeCashFlowYield || null,
    earningsYield: fmpMetrics.earningsYield || null,
    // Source confidence
    hasFMPData: !!fmpData?.financials,
    dataConfidence: fmpData?.dataConfidence?.score || 0
  };

  // ═══════════════════════════════════════════════════════════════
  // LAYER 8: Forensic Health Engine — NOW FED WITH REAL DATA
  // ═══════════════════════════════════════════════════════════════
  const interestCoverage = (mergedFundamentals.operatingIncome && mergedFundamentals.interestExpense && mergedFundamentals.interestExpense > 0)
    ? mergedFundamentals.operatingIncome / mergedFundamentals.interestExpense : null;
  const ocfToNi = (mergedFundamentals.operatingCashFlow && mergedFundamentals.netIncome && mergedFundamentals.netIncome > 0)
    ? mergedFundamentals.operatingCashFlow / mergedFundamentals.netIncome : null;

  const forensicOut = Layer8.forensicHealthEngine({
    debt_to_equity: mergedFundamentals.debtToEquity,
    interest_coverage: interestCoverage,
    current_ratio: mergedFundamentals.currentRatio,
    roe: mergedFundamentals.roce,
    ocf_to_net_income: ocfToNi
  });

  // ═══════════════════════════════════════════════════════════════
  // LAYER 8: Valuation Score Engine — unchanged logic
  // ═══════════════════════════════════════════════════════════════
  const valuationOut = Layer8.valuationScoreEngine({
    pe_ratio: mergedFundamentals.peRatio,
    pb_ratio: mergedFundamentals.pbRatio,
    peg_ratio: mergedFundamentals.pegRatio
  });
  if (valuationOut.data) valuationOut.data.valuationBand = valuationOut.data.signal;

  // ═══════════════════════════════════════════════════════════════
  // LAYER 9: Forensic Accounting — ACTIVATED WITH FMP DATA
  // Altman Z-Score, Beneish M-Score, Piotroski F-Score
  // ═══════════════════════════════════════════════════════════════
  let altmanOut = { ok: false, data: {} };
  let piotroskiOut = { ok: false, data: {} };

  if (mergedFundamentals.totalAssets && mergedFundamentals.totalLiabilities) {
    const workingCapital = (mergedFundamentals.totalCurrentAssets || 0) - (mergedFundamentals.totalCurrentLiabilities || 0);
    altmanOut = Layer9.altmanZScoreEngine({
      working_capital: workingCapital,
      retained_earnings: mergedFundamentals.retainedEarnings || 0,
      ebit: mergedFundamentals.operatingIncome || 0,
      market_value_equity: mergedFundamentals.marketCap || 0,
      total_liabilities: mergedFundamentals.totalLiabilities,
      sales: mergedFundamentals.revenue || 0,
      total_assets: mergedFundamentals.totalAssets
    });
  }

  // Piotroski F-Score from FMP multi-year financials
  if (fmpData?.financials?.income?.length >= 2 && fmpData?.financials?.balance?.length >= 2) {
    const inc = fmpData.financials.income;
    const bal = fmpData.financials.balance;
    const cf = fmpData.financials.cashflow || [];
    piotroskiOut = Layer9.piotroskiFScoreEngine({
      net_income_positive: (inc[0]?.netIncome || 0) > 0,
      cfo_positive: (cf[0]?.operatingCashFlow || 0) > 0,
      roce_improving: inc.length >= 2 && (inc[0]?.netIncome / (bal[0]?.totalStockholdersEquity || 1)) > (inc[1]?.netIncome / (bal[1]?.totalStockholdersEquity || 1)),
      cfo_greater_than_net_income: (cf[0]?.operatingCashFlow || 0) > (inc[0]?.netIncome || 0),
      long_term_debt_decreasing: bal.length >= 2 && (bal[0]?.longTermDebt || 0) < (bal[1]?.longTermDebt || Infinity),
      current_ratio_improving: bal.length >= 2 && ((bal[0]?.totalCurrentAssets || 0) / (bal[0]?.totalCurrentLiabilities || 1)) > ((bal[1]?.totalCurrentAssets || 0) / (bal[1]?.totalCurrentLiabilities || 1)),
      no_new_shares_issued: bal.length >= 2 && (bal[0]?.commonStock || 0) <= (bal[1]?.commonStock || 0),
      gross_margin_improving: inc.length >= 2 && ((inc[0]?.grossProfit || 0) / (inc[0]?.revenue || 1)) > ((inc[1]?.grossProfit || 0) / (inc[1]?.revenue || 1)),
      asset_turnover_improving: bal.length >= 2 && inc.length >= 2 && ((inc[0]?.revenue || 0) / (bal[0]?.totalAssets || 1)) > ((inc[1]?.revenue || 0) / (bal[1]?.totalAssets || 1))
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 10: DCF Valuation — ACTIVATED WITH FMP DCF DATA
  // ═══════════════════════════════════════════════════════════════
  let dcfOut = { ok: false, data: {} };
  const currentPrice = techOut?.data?.indicators?.lastClose;
  if (fmpData?.dcf && currentPrice) {
    dcfOut = {
      ok: true,
      data: {
        intrinsic_value: fmpData.dcf.dcf || 0,
        current_price: currentPrice,
        margin_of_safety_pct: fmpData.dcf.dcf ? ((fmpData.dcf.dcf - currentPrice) / fmpData.dcf.dcf * 100) : 0,
        valuation_status: fmpData.dcf.dcf > currentPrice * 1.3 ? "DEEP_DISCOUNT" : fmpData.dcf.dcf > currentPrice * 1.15 ? "UNDERVALUED" : fmpData.dcf.dcf < currentPrice * 0.7 ? "EXTREMELY_OVERVALUED" : "FAIRLY_VALUED",
        pts: fmpData.dcf.dcf > currentPrice * 1.3 ? 5 : fmpData.dcf.dcf > currentPrice * 1.15 ? 3 : fmpData.dcf.dcf < currentPrice * 0.7 ? -5 : 0,
        source: "FMP_DCF"
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 15: Sentiment — UPGRADED WITH ALPHA VANTAGE NLP
  // ═══════════════════════════════════════════════════════════════
  let sentimentOut = { ok: false, data: { sentiment_score: 0, pts: 0, sentimentLabel: "NEUTRAL" } };
  if (avSentiment) {
    sentimentOut = {
      ok: true,
      data: {
        sentiment_score: avSentiment.avgSentiment,
        sentimentLabel: avSentiment.sentimentLabel,
        pts: avSentiment.pts,
        vetoFlag: avSentiment.vetoFlag,
        articleCount: avSentiment.articleCount,
        dataConfidence: avSentiment.dataConfidence,
        source: "ALPHA_VANTAGE_NLP"
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 11: Predictive Signals — unchanged logic
  // ═══════════════════════════════════════════════════════════════
  const predictiveOut = Layer11.predictiveSignals({
    maxPain: maxPainOut.data || {},
    pcr: pcrOut.data || {},
    technicals: techOut?.data?.indicators || {},
    valuationBand: valuationOut.data?.valuationBand
  });

  const slOut = Layer12.slCalculator ? Layer12.slCalculator({
    atr14: techOut?.data?.indicators?.atr14,
    lastClose: currentPrice,
    mode
  }) : { ok: false, data: {} };
  const rrOut = slOut.ok && Layer12.rrValidator
    ? Layer12.rrValidator({ entry: currentPrice, sl: slOut.data.sl, target: slOut.data.target, minRR: mode === "LT" ? 3 : 1.5 })
    : { ok: false, data: {} };
  const sizeOut = slOut.ok && Layer12.positionSizer
    ? Layer12.positionSizer({ capital: 100000, riskPct: 1, entry: currentPrice, sl: slOut.data.sl })
    : { ok: false, data: {} };

  // ═══════════════════════════════════════════════════════════════
  // L2 ORDER BOOK + MOMENTUM — unchanged logic
  // ═══════════════════════════════════════════════════════════════
  const md = depthOutRaw?.marketDeptOrderBook || depthOutRaw?.marketDept498OrderBook;
  let l2Imbalance = 0;
  let hasRealL2 = false;
  if (md) {
    let buyQty = 0, sellQty = 0;
    for (const b of (md.bid || [])) buyQty += b.quantity || 0;
    for (const a of (md.ask || [])) sellQty += a.quantity || 0;
    const total = buyQty + sellQty;
    l2Imbalance = total > 0 ? ((buyQty - sellQty) / total * 100) : 0;
    hasRealL2 = true;
  }

  const candles = techOut?.data?.candles || [];
  const len = candles.length;
  let momentum = 0;
  let momentumPct = 0;
  if (len >= 6) {
    momentum = candles[len - 1].c > candles[len - 6].c ? 1 : -1;
    momentumPct = ((candles[len - 1].c - candles[len - 6].c) / candles[len - 6].c) * 100;
  }
  
  // Calculate atrTrend
  let atrTrend = 0;
  let atrValue = techOut?.data?.indicators?.atr14 || 0;
  if (len > 20) {
    const highsPrev = candles.slice(0, -5).map(c=>c.h);
    const lowsPrev = candles.slice(0, -5).map(c=>c.l);
    const closesPrev = candles.slice(0, -5).map(c=>c.c);
    const { ATR } = require("technicalindicators");
    const atrPrevArr = ATR.calculate({ period: 14, high: highsPrev, low: lowsPrev, close: closesPrev });
    const atrPrev = atrPrevArr[atrPrevArr.length - 1] || atrValue;
    atrTrend = atrValue > atrPrev * 1.05 ? 1 : (atrValue < atrPrev * 0.95 ? -1 : 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 13: Score Engine — with enriched indicators
  // Now includes sentiment pts and DCF pts as new inputs
  // ═══════════════════════════════════════════════════════════════
  const scoreOut = Layer13.scoreEngine({
    mode,
    stock: symbol,
    currentPrice,
    indicators: {
      rsi: techOut?.data?.indicators?.rsi14 || 50,
      rvol: techOut?.data?.indicators?.rvol20 || 1.0,
      momentum,
      momentumPct,
      atrTrend,
      atrValue,
      pcr: pcrOut?.data?.pcr || 1.0,
      l2Imbalance,
      hasRealPCR: Boolean(pcrOut?.ok && chainOut?.ok && chainOut?.data?.records),
      hasRealL2,
      macd: techOut?.data?.indicators?.macd,
      ema20: techOut?.data?.indicators?.ema20,
      ema50: techOut?.data?.indicators?.ema50,
      ema200: techOut?.data?.indicators?.ema200 || null,
      peRatio: mergedFundamentals.peRatio,
      pbRatio: mergedFundamentals.pbRatio,
      pegRatio: mergedFundamentals.pegRatio,
      debtToEquity: mergedFundamentals.debtToEquity,
      roce: mergedFundamentals.roce,
      adx: techOut?.data?.indicators?.adx14?.adx ?? techOut?.data?.indicators?.adx14,
      // NEW: FMP-powered fundamentals boost
      piotroskiScore: piotroskiOut?.data?.f_score || null,
      altmanZone: altmanOut?.data?.zone || null,
      dcfMoS: dcfOut?.data?.margin_of_safety_pct || null,
      // NEW: Alpha Vantage sentiment
      sentimentPts: sentimentOut?.data?.pts || 0,
      sentimentVeto: sentimentOut?.data?.vetoFlag || false
    },
    inputs: {
      l1RiskBand: (vixOut?.data?.inputs?.vix_current ?? vixOut?.data?.last) <= 12 ? "LOW" : (vixOut?.data?.inputs?.vix_current ?? vixOut?.data?.last) <= 20 ? "MODERATE" : "HIGH",
      rsi: techOut?.data?.indicators?.rsi14,
      pcr: pcrOut?.data?.pcr,
      roce: mergedFundamentals.roce,
      forensicRiskScore: forensicOut?.data?.health_score != null ? Math.max(0, -forensicOut.data.health_score) / 10 : 0,
      valuationBand: valuationOut?.data?.valuationBand,
      predictiveHints: predictiveOut?.data?.hints,
      rrValid: rrOut?.data?.valid
    }
  });
  const verdictOut = Layer13.verdictClassifier(scoreOut?.data?.totalScore);

  // ═══════════════════════════════════════════════════════════════
  // BUILD CONTEXT — all layers assembled
  // ═══════════════════════════════════════════════════════════════
  const context = {
    symbol,
    mode,
    layer1: vixOut,
    layer3: techOut,
    layer7: { pcrOut, maxPainOut },
    layer8: { ...finOut, merged: mergedFundamentals },
    layer9: { forensicOut, altmanOut, piotroskiOut },
    layer10: { valuationOut, dcfOut },
    layer11: predictiveOut,
    layer12: { slOut, rrOut, sizeOut },
    layer13: { scoreOut, verdictOut },
    layer15: {
      sentiment: sentimentOut,
      supplyChainNews: Layer15.supplyChainNews ? await Layer15.supplyChainNews().catch((e) => ({ ok: false, error: e?.message })) : {ok: false},
      announcements: Layer15.announcements ? await Layer15.announcements(symbol).catch((e) => ({ ok: false, error: e?.message })) : {ok: false}
    },
    layer16: {
      symbolResolver: Layer16.symbolResolver ? Layer16.symbolResolver(symbol) : null,
      cacheProbe: Layer16.cacheLayerProbe ? await Layer16.cacheLayerProbe().catch((e) => ({ ok: false, error: e?.message })) : null
    },
    layer17: {
      winRateByScore: Layer17.winRateByScoreBand ? await Layer17.winRateByScoreBand().catch((e) => ({ ok: false, error: e?.message })) : null,
      drawdown: Layer17.drawdownAnalysis ? await Layer17.drawdownAnalysis().catch((e) => ({ ok: false, error: e?.message })) : null
    },
    // NEW: API data confidence
    dataConfidence: {
      fmp: fmpData?.dataConfidence || { score: 0 },
      sentiment: avSentiment ? "ACTIVE" : "UNAVAILABLE",
      earnings: avEarnings ? "ACTIVE" : "UNAVAILABLE"
    }
  };

  // ── Layer 18: ATR Predictor + Short Advisor — ENHANCED with earnings calendar ──
  let layer18Out = { atrPredictor: null, shortAdvisor: null };
  if (candles.length >= 40) {
    const cArr = candles.map(c => c.c);
    const hArr = candles.map(c => c.h);
    const lArr = candles.map(c => c.l);
    const vArr = candles.map(c => c.v);
    const rsiVal = techOut?.data?.indicators?.rsi14 || 50;

    // ATR Predictor — NOW with earnings calendar from Alpha Vantage
    try {
      layer18Out.atrPredictor = Layer18.predictATR({
        highs: hArr, lows: lArr, closes: cArr, volumes: vArr,
        prediction_horizon_days: mode === "LT" ? 5 : 1,
        days_to_earnings: avEarnings?.daysToEarnings ?? null
      });
    } catch (e) { layer18Out.atrPredictor = { ok: false, error: e.message }; }

    // Short Advisor
    try {
      layer18Out.shortAdvisor = Layer18.adviseShortEntry({
        closes: cArr, highs: hArr, lows: lArr, volumes: vArr,
        current_price: currentPrice || cArr[cArr.length - 1],
        rsi: rsiVal, rvol: techOut?.data?.indicators?.rvol20 || 1.0,
        atr_value: atrValue, ema20: techOut?.data?.indicators?.ema20,
        ema50: techOut?.data?.indicators?.ema50, ema200: techOut?.data?.indicators?.ema200 || null,
        adx: techOut?.data?.indicators?.adx14?.adx ?? techOut?.data?.indicators?.adx14 ?? 25,
        pcr: pcrOut?.data?.pcr || null,
        has_real_pcr: Boolean(pcrOut?.ok && chainOut?.ok && chainOut?.data?.records),
        vix_level: vixOut?.data?.inputs?.vix_current ?? null,
        sector_momentum_pct: 0
      });
    } catch (e) { layer18Out.shortAdvisor = { ok: false, error: e.message }; }
  }
  context.layer18 = layer18Out;

  const layer14 = Layer14.aiOrchestrator ? await Layer14.aiOrchestrator({
    symbol,
    mode,
    context,
    scoreData: scoreOut.data,
    verdictData: verdictOut.data
  }) : { ok: true, data: { status: "missing_layer_14" } };

  return {
    ok: true,
    symbol,
    mode,
    layers: context,
    final: layer14.data,
    data: {
      masterScore: scoreOut.data?.totalScore || 50,
      verdict: scoreOut.data?.engineResult?.verdict || verdictOut.data?.verdict || "NEUTRAL",
      aiReasoning: layer14.data?.response_text || "Analysis complete."
    }
  };
}

module.exports = { analyzeStock };
