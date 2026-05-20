// MODULE 15.1 — NEWS SENTIMENT SCORING ENGINE
function newsSentimentEngine({ news_items = [] }) {
  if (!news_items || news_items.length === 0) {
    return { ok: true, data: { sentiment_score: 0, sentiment_label: "NEUTRAL", pts: 0 } };
  }

  // Very basic deterministic keyword scoring 
  const bull_keywords = ["growth", "upgrade", "buy", "record", "profit", "expansion", "beat", "positive", "contract"];
  const bear_keywords = ["downgrade", "sell", "loss", "decline", "miss", "probe", "fraud", "resigns", "negative", "lawsuit"];

  let total_score = 0;
  
  for (const item of news_items) {
    const text = (item.title + " " + (item.description || "")).toLowerCase();
    
    let item_score = 0;
    bull_keywords.forEach(kw => { if (text.includes(kw)) item_score += 1; });
    bear_keywords.forEach(kw => { if (text.includes(kw)) item_score -= 2; }); // Bearish news weighted heavier
    
    total_score += item_score;
  }

  let sentiment_label = "NEUTRAL";
  let pts = 0;

  if (total_score >= 5) {
    sentiment_label = "STRONGLY_BULLISH_SENTIMENT";
    pts = 3;
  } else if (total_score > 0 && total_score < 5) {
    sentiment_label = "BULLISH_BIAS";
    pts = 1;
  } else if (total_score < 0 && total_score > -5) {
    sentiment_label = "BEARISH_BIAS";
    pts = -2;
  } else if (total_score <= -5) {
    sentiment_label = "STRONGLY_BEARISH_SENTIMENT";
    pts = -4;
  }

  return {
    ok: true,
    data: { total_score, sentiment_label, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:newsSentimentEngine" }
  };
}

// MODULE 15.2 — EVENT CATALYST RISK ENGINE
function eventCatalystEngine({ days_to_earnings = null, upcoming_corporate_actions = [] }) {
  let event_risk_status = "NO_NEAR_TERM_CATALYST";
  let iv_crush_risk = false;
  let flag = null;
  let pts = 0;
  let veto = false;

  // Earnings Risk Check
  if (days_to_earnings !== null) {
    if (days_to_earnings <= 3 && days_to_earnings >= 0) {
      event_risk_status = "EARNINGS_IMMINENT";
      iv_crush_risk = true;
      flag = "HIGH_EVENT_VOLATILITY_RISK";
      veto = true; // Typically avoid entering right before earnings
    } else if (days_to_earnings > 3 && days_to_earnings <= 14) {
      event_risk_status = "EARNINGS_APPROACHING";
      pts = 1; // Potential run-up
    }
  }

  // Corporate Actions Check (Dividends, Splits, Bonus)
  const action_types = upcoming_corporate_actions.map(a => a.type ? a.type.toUpperCase() : "");
  if (action_types.includes("DIVIDEND")) {
    pts += 1;
    if (event_risk_status === "NO_NEAR_TERM_CATALYST") event_risk_status = "UPCOMING_DIVIDEND";
  }
  if (action_types.includes("SPLIT") || action_types.includes("BONUS")) {
    pts += 2;
    event_risk_status = "LIQUIDITY_EVENT_ANNOUNCED";
  }

  return {
    ok: true,
    data: { days_to_earnings, event_risk_status, iv_crush_risk, flag, veto, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:eventCatalystEngine" }
  };
}

// MODULE 15.3 — INSIDER/PROMOTER ANNOUNCEMENT CLASSIFIER
function insiderTradingEngine({ bse_announcements = [] }) {
  let promoter_buy_events = 0;
  let promoter_sell_events = 0;
  let auditor_resignation = false;

  for (const ann of bse_announcements) {
    const text = (ann.subject || "").toUpperCase();
    
    // Check for SAST / Insider Trading disclosures
    if (text.includes("SAST") || text.includes("INSIDER TRADING")) {
      if (text.includes("ACQUISITION") || text.includes("BUY")) promoter_buy_events++;
      if (text.includes("DISPOSAL") || text.includes("SELL")) promoter_sell_events++;
    }

    if (text.includes("RESIGNATION OF AUDITOR")) {
      auditor_resignation = true;
    }
  }

  let insider_signal = "NEUTRAL";
  let pts = 0;
  let veto = false;
  let flag = null;

  if (auditor_resignation) {
    insider_signal = "CRITICAL_RED_FLAG";
    veto = true;
    flag = "AUDITOR_RESIGNATION";
    pts = -10;
  } else if (promoter_sell_events > 0 && promoter_buy_events === 0) {
    insider_signal = "PROMOTER_SELLING";
    pts = -3;
  } else if (promoter_buy_events > 0 && promoter_sell_events === 0) {
    insider_signal = "PROMOTER_ACCUMULATION";
    pts = 4;
  } else if (promoter_buy_events > 0 && promoter_sell_events > 0) {
    insider_signal = "MIXED_INSIDER_ACTION";
    pts = 0;
  }

  return {
    ok: true,
    data: { promoter_buy_events, promoter_sell_events, auditor_resignation, insider_signal, flag, veto, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:insiderTradingEngine" }
  };
}

module.exports = {
  newsSentimentEngine,
  eventCatalystEngine,
  insiderTradingEngine
};
