# STOCKSENSE ULTRA PRO — 18-LAYER ANALYTICAL ENGINE SPECIFICATION

This specification outlines the architecture, calculations, predictive capabilities, and API integrations of the **18-Layer Analytical Engine** powering **Stocksense Ultra Pro**. It reflects the fully integrated, closed-loop database and broker order-execution pipeline currently deployed live.

---

## 1. Architectural Philosophy & Execution Flow

Every calculation in Stocksense Ultra Pro follows three absolute laws:

> [!NOTE]
> ### THE THREE LAWS OF STOCK LOGIC
> 
> 1. **LAW 1 — DETERMINISM**: Given the same input data, the engine always produces the exact same output. Every formula is explicit, thresholds are hardcoded, and randomness is prohibited.
> 2. **LAW 2 — TRACEABILITY**: Every score, signal, and verdict can be trace-audited back to the exact tick, document, or financial line-item that produced it.
> 3. **LAW 3 — HIERARCHY**: Signals are structured in a strict override hierarchy: 
>    `Veto Engine` $\rightarrow$ `Risk/Execution` $\rightarrow$ `Forensic Accounting` $\rightarrow$ `Institutional Flow` $\rightarrow$ `Derivatives/Market Microstructure` $\rightarrow$ `Technical Momentum` $\rightarrow$ `Valuation` $\rightarrow$ `Macro Environment`. 
>    Higher hierarchy layers instantly override lower-level indicators to prevent bull/bear traps.

### Closed-Loop Quantitative Data Flow

```mermaid
graph TD
    %% Input Sources
    subgraph Data Acquisition (Parallel Fetching)
        Kite[Zerodha Kite API]
        SmartAPI[Angel One SmartAPI]
        FMP[Financial Modeling Prep API]
        AV[Alpha Vantage API]
        NSE[NSE Derivatives Live Data]
        BSE[BSE Scraper / Announcements]
        VIX[India VIX Scraper]
        PG[PostgreSQL Trades DB]
    end

    %% Processing Phase
    subgraph 18-Layer Engine Orchestration
        L1[Layer 1: Macro & Global Regime]
        L2[Layer 2: Microstructure & L2 Order Book]
        L3[Layer 3: Technical & Momentum Indicators]
        L4[Layer 4: Advanced Technical & Price Action]
        L5[Layer 5: Volume Profile Engine]
        L6[Layer 6: Institutional Flow & Volume Tracker]
        L7[Layer 7: Options Derivatives & OI]
        L8[Layer 8: Core Fundamentals & Financials]
        L9[Layer 9: Forensic Accounting & Integrity Scanner]
        L10[Layer 10: DCF Valuation Engine]
        L11[Layer 11: Predictive Coherence Signals]
        L12[Layer 12: Risk Execution & Sizing]
        L13[Layer 13: Master Scoring & Veto Filters]
        L14[Layer 14: AI Orchestrator & Cognitive Reasoner]
        L15[Layer 15: Sentiment & Catalyst Engine]
        L16[Layer 16: Reliability & Circuit Breaker Engine]
        L17[Layer 17: Backtesting & Expectancy]
        L18[Layer 18: ATR Predictor & Short Entry Advisor]
    end

    %% Connections to Layers
    VIX & Kite --> L1
    SmartAPI & Kite & NSE --> L2
    Kite --> L3
    Kite --> L4
    Kite --> L5
    NSE & FMP --> L6
    NSE --> L7
    FMP & Kite --> L8
    FMP --> L9
    FMP & Kite --> L10
    L3 & L7 & L8 & L10 --> L11
    L3 & Kite --> L12
    AV & BSE & FMP --> L15
    L2 & L3 & L7 & L8 & L15 --> L16
    PG --> L17
    Kite & AV --> L18

    %% Scoring & Verdict Phase
    L1 & L2 & L3 & L4 & L5 & L6 & L7 & L8 & L9 & L10 & L11 & L15 & L16 & L17 & L18 --> L13
    L13 --> L12
    L12 --> L14
    
    %% Execution Loop
    L14 --> FinalOutput[Final Verdict & Sizing Output]
    FinalOutput --> OrderRouter[Layer 12 Order Router]
    OrderRouter -->|POST /order/place| Broker[Kite API / Sandbox Broker]
    Broker -->|Log Trade| PG
```

---

## 2. API & Database Integration Matrix

The engine operates on a zero-lag parallel fetch pipeline using `Promise.all`. The table below outlines how our data APIs and database tables feed into specific layers:

| API / Database | Layers Served | Data Points Extracted | Fallback / Graceful Degradation |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | L17 | Query last 100 closed trades for queried symbol: entry/exit price, stoploss, entry time. | If unconfigured or offline (`DATABASE_URL_missing`), bypasses cleanly, returning neutral defaults. |
| **Zerodha Kite API** | L1, L2, L3, L4, L5, L8, L12, L16, L17, L18 | Real-time OHLCV candles, last traded price (LTP), bid/ask quote depth, daily delivery %, sector index price. | Fallback to Yahoo Finance historical APIs and NSE scrapers. |
| **Angel One SmartAPI** | L2 | Real-time order book websocket streams, level-2 order book depth (bid/ask spread). | Fallback to Zerodha Kite market depth and live NSE snapshot APIs. |
| **Financial Modeling Prep (FMP)** | L6, L8, L9, L10, L15 | Quarterly & annual financials, DCF models, insider trading logs, consensus earnings history, company profile. | Graceful degradation: disables Piotroski, Altman, and Beneish metrics, defaulting to Yahoo basic data. |
| **Alpha Vantage API** | L15, L18 | News sentiment, articles, corporate earnings calendar, days to earnings. | Fallback to BSE Scrapers and local Google News parsing. |
| **NSE Derivatives Data** | L2, L6, L7 | Option Chain (strike price, call/put OI, IV), FII/DII cash/derivative daily net value, block & bulk deals. | Estimated institutional accumulation metrics and default option models. |

---

## 3. Comprehensive Deep-Dive: The 18 Analytical Layers

### Layer 1: Macro & Global Regime Classifier
* **Domain**: Systemic Risk Environment
* **APIs / Services**: India VIX, Sector index symbols (Kite), McClellan Oscillator, Advance/Decline ratios.
* **How it Analyzes**: Assesses domestic and global volatility trends. Compares sectoral indexes against the Nifty 50 to evaluate sector strength.
* **How it Predicts**: Categorizes the market into three regimes: `BULL`, `BEAR`, or `CHOP`. 
* **Score Engine Help**: Low VIX ($\le 12$) boosts base score by $+10$ points; high VIX ($> 20$) penalizes base score by $-15$ points.

### Layer 2: Microstructure & Level-2 Order Book Imbalance (L2)
* **Domain**: Immediate Order Book Sentiment
* **APIs / Services**: Angel One SmartAPI live level-2 depth, Zerodha Kite market depth feeds.
* **How it Analyzes**: Calculates a weighted Order Book Imbalance (OBI) at five depth levels:
  $$\text{OBI} = \frac{\sum (\text{BidQty}_i \cdot W_i) - \sum (\text{AskQty}_i \cdot W_i)}{\sum (\text{BidQty}_i \cdot W_i) + \sum (\text{AskQty}_i \cdot W_i)}$$
* **How it Predicts**: Evaluates the *imbalance velocity* ($\text{OBI} - \text{OBI}_{\text{prev}}$) to forecast immediate, micro-second tick breakout directions.
* **Score Engine Help**: Contributes up to $\pm 15$ points directly.

### Layer 3: Technical & Momentum Indicators
* **Domain**: Classic Price Action Momentum
* **APIs / Services**: Zerodha Kite / Yahoo Finance historical OHLCV data.
* **How it Analyzes**: Computes RSI-14, MACD, and EMA Crossovers (EMA20 vs EMA50 vs EMA200).
* **How it Predicts**: Evaluates momentum boundaries. If RSI is trending between 55 and 75 in a strong trend, it predicts continued momentum.
* **Score Engine Help**: Baseline technical score mapped to a $10 - 90$ range. ADX > 25 adds a $1.15\times$ multiplier; ADX < 20 dampens momentum scores by $0.75\times$.

### Layer 4: Advanced Technical & Price Action Classifiers
* **Domain**: Structural Trend and Wave Theory
* **APIs / Services**: High-precision historical OHLCV candles (120+ to 250+ bars).
* **How it Analyzes**: Implements Wyckoff structural phases (Accumulation, Markup, Distribution, Markdown), Elliott Wave counts, and Fibonacci Confluence levels.
* **How it Predicts**: Wyckoff Accumulation/Markup phases predict major upside breakouts; Wave 3 identifies high-velocity trends.
* **Score Engine Help**: Accumulation/Markup adds $+15$ points; Distribution/Markdown penalizes by $-15$.

### Layer 5: Volume Profile Engine (VPE)
* **Domain**: Volume at Price Distribution
* **APIs / Services**: Historical OHLCV candle databases.
* **How it Analyzes**: Groups historical volume by price intervals to identify **Point of Control (POC)**, **Value Area High (VAH)**, and **Value Area Low (VAL)**.
* **How it Predicts**: Trading above POC with high Relative Volume (RVOL > 1.5) predicts a dynamic breakout.
* **Score Engine Help**: Contributes up to $\pm 15$ points. High RVOL applies a $1.3\times$ expansion multiplier.

### Layer 6: Institutional Flow & Volume Tracker
* **Domain**: "Smart Money" Accumulation / Distribution
* **APIs / Services**: NSE daily reports, FMP Insider database, block/bulk deal sheets.
* **How it Analyzes**: Compiles aggregate FII/DII net flows, active mutual fund flows, and corporate insider transactions.
* **How it Predicts**: Identifies institutional buying support or liquidations. Massive insider net buying ratio ($+1.0$) predicts severe fundamental value validation.
* **Score Engine Help**: Highly weighted layer, modifying the base score by up to $\pm 25$ points.

### Layer 7: Options Derivatives & Open Interest (OI)
* **Domain**: Option Market Speculation
* **APIs / Services**: NSE Live Option Chain API.
* **How it Analyzes**: Extracts Put-Call Ratio (PCR), Max Pain, and OI Delta shifts.
* **How it Predicts**: Maps major support (heavy Put OI) and resistance (heavy Call OI). Max Pain acts as a gravitational price target near weekly/monthly expiry.
* **Score Engine Help**: Contributes $\pm 15$ points.

### Layer 8: Core Fundamentals & Financials
* **Domain**: Long-term Corporate Balance Sheet Health
* **APIs / Services**: FMP Financial Statements, Yahoo Finance.
* **How it Analyzes**: Audits Debt-to-Equity, Return on Equity (ROE $> 20\%$ is strong), PEG Ratio, and Interest Coverage.
* **How it Predicts**: Predicts long-term enterprise viability, ensuring that momentum trades are backed by corporate health.
* **Score Engine Help**: Base fundamentals mapped to $10 - 90$.

### Layer 9: Forensic Accounting & Integrity Scanner
* **Domain**: Fraud Detection & Bankruptcy Prevention
* **APIs / Services**: FMP multi-year financial statements.
* **How it Analyzes**: Implements three world-class accounting algorithms:
  * **Altman Z-Score**: Bankruptcy risk model.
  * **Piotroski F-Score**: Financial health metric (0 - 9 scale).
  * **Beneish M-Score**: Checks 8 accounting anomalies to detect potential earnings manipulation.
* **How it Predicts**: Predicts structural corporate failure and accounting fraud.
* **Score Engine Help**: Piotroski $\ge 7$ adds $+15$ points; $\le 3$ subtracts $-15$. Altman Distress Zone subtracts $-15$. **CRITICAL**: Beneish M-Score $> -1.78$ triggers a severe **trade VETO** blocking all long setups.

### Layer 10: DCF Valuation Engine
* **Domain**: Intrinsic Mathematical Value
* **APIs / Services**: FMP DCF Models.
* **How it Analyzes**: Compares current stock price with the calculated DCF Intrinsic Value to calculate the Margin of Safety.
* **How it Predicts**: Classifies stocks into valuation bands: `DEEP_DISCOUNT` ($>30\%$ MoS), `UNDERVALUED`, `FAIR`, or `OVERVALUED`.
* **Score Engine Help**: Intrinsic value discount directly shifts Layer 10 scores from $10 - 90$.

### Layer 11: Predictive Coherence Signals
* **Domain**: Cross-Layer Signal Convergence
* **APIs / Services**: Unified output scores from Layers 3, 7, 8, and 10.
* **How it Analyzes**: Assesses if diverse layers point in the same direction. Example: Do bullish technicals align with supportive option structures and deep discounts?
* **How it Predicts**: Higher convergence rates indicate strong market consensus.
* **Score Engine Help**: Every converging layer "hint" adds $+8$ points up to a maximum score of $90$.

### Layer 12: Risk Execution & Sizing (Active Broker/Sandbox Integration)
* **Domain**: Money Management & Portfolio Protection
* **APIs / Services**: Stock ATR-14, Last Close, Zerodha Kite API / Sandbox order endpoint.
* **How it Analyzes**: Calculates volatility-based stoplosses and target prices. Validates Risk-to-Reward (R:R $\ge 1.5$ for Intraday, $\ge 3.0$ for Investment) and computes position sizing using the strict 1% risk rule:
  $$\text{Position Size} = \frac{\text{Capital} \cdot 0.01}{\text{Entry} - \text{Stoploss}}$$
* **How it Executes**: Integrates directly with the `POST /order/place` route in our Kite controller, allowing users to submit LIMIT or market orders instantly, logging details to our PostgreSQL database.
* **Score Engine Help**: If R:R is invalid, the setup is penalized, and the verdict classifier overrides the final output.

### Layer 13: Master Scoring & Veto Filters
* **Domain**: The Score Fusion Heart
* **APIs / Services**: Core engine javascript modules (`scoreEngine.js`, `masterScoring.js`).
* **How it Analyzes**: Aggregates all layer outputs using a dynamic Weight Table (customized for Intraday vs. Investment modes and Macro Regimes). Applies sector relative normalization and Veto checks.
* **How it Predicts**: Synthesizes a unified, robust **Master Score ($5 - 95$)** and a categorical **Verdict**.
* **Score Engine Help**: The orchestrator. Compiles scores, tests for structural vetos, and decides if the trade is executed or blocked.

### Layer 14: AI Orchestrator & Cognitive Reasoner
* **Domain**: Contextual Narrative Synthesis
* **APIs / Services**: Advanced Cognitive LLM API.
* **How it Analyzes**: Conserves raw mathematical inputs while ingesting the entire multidimensional JSON context of all 18 layers, scores, and active vetoes.
* **How it Predicts**: Synthesizes conflicting layers into a clear natural-language explanation, providing the definitive human-readable rationale for the final score.
* **Score Engine Help**: Translates the final outputs into actionable intelligence.

### Layer 15: Sentiment & Catalyst Engine
* **Domain**: Event-Driven Risk & Market Buzz
* **APIs / Services**: Alpha Vantage News Sentiment, Google News, BSE Announcements feed.
* **How it Analyzes**: Leverages NLP to analyze financial articles and concall transcripts. Scrapes BSE announcements for sudden auditor resignations, board meetings, or insider dumping.
* **How it Predicts**: Anticipates event-driven volatility spikes or selloffs.
* **Score Engine Help**: Contributes to Layer 15 score ($10 - 90$). Auditor resignations or promoter dumping trigger an immediate system veto.

### Layer 16: Reliability & Circuit Breaker Engine
* **Domain**: Systemic Data Integrity & Safety
* **APIs / Services**: Live timestamp audits, price feeds.
* **How it Analyzes**: Evaluates Freshness Decay, Outlier Price Spikes (Standard Deviation checks), and Confidence Aggregator (ratio of active vs failed APIs).
* **How it Predicts**: Protects against flash crashes, feed manipulation, stale calculations, and data corruption.
* **Score Engine Help**: If freshness or confidence falls below safe levels, or if price outliers are detected, the **Circuit Breaker trips**, vetoing the setup and halting trade execution.

### Layer 17: Dynamic Database Backtesting & Expectancy (PG Database Integration)
* **Domain**: Historical Performance & Edge Validation
* **APIs / Database**: PostgreSQL `trades` table.
* **How it Analyzes**: Queries PostgreSQL to retrieve all past closed trades for the queried symbol. Maps entry, stoploss, and exit prices to evaluate the trade's R-multiple:
  $$R_{\text{long}} = \frac{\text{ExitPrice} - \text{EntryPrice}}{\text{EntryPrice} - \text{Stoploss}}$$
  $$R_{\text{short}} = \frac{\text{EntryPrice} - \text{ExitPrice}}{\text{Stoploss} - \text{EntryPrice}}$$
  Automatically calculates expectancy, win-rate, and maximum drawdown metrics:
  $$\text{Expectancy} = (\text{WinRate} \cdot \text{AvgWin}_R) + (\text{LossRate} \cdot \text{AvgLoss}_R)$$
* **How it Predicts**: Uses historical win rates and profit factors (expectancy) to calculate edge conviction. Mapped to grades: `NEGATIVE_EXPECTANCY`, `MARGINAL_EDGE`, `SOLID_EDGE`, or `EXCEPTIONAL_EDGE`.
* **Score Engine Help**: Dynamically overrides simulated/mock parameters. Integrates real historical performance, reducing scores when the system edge deteriorates (alpha decay tracking).

### Layer 18: ATR Predictor & Short Entry Advisor
* **Domain**: Volatility Forecasting & Short Selling
* **APIs / Services**: Historical high-precision OHLCV, AV Earnings Calendar.
* **How it Analyzes**: Forecasts volatility regimes using ATR Rate of Change and clustering models. Evaluates if conditions favor short selling based on EMA Death Crosses, high IV, and bearish options sentiment.
* **How it Predicts**: Predicts next-day volatility range (expansion vs. compression) and high-conviction short setups.
* **Score Engine Help**: Calculates dynamic target and stoploss ranges based on ATR predictions. Feeds short conviction metrics to Layer 13.

---

## 4. The Veto Engine & Capital Preservation

The most critical component of the engine is the **Veto System**. Under **Law 3 (Hierarchy)**, a trade veto instantly overrides bullish momentum, technical breakouts, and positive sentiment.

### The 8 Fatal Veto Triggers
1. **BENEISH_M_SCORE_MANIPULATION_RISK**: Sparked when Layer 9 detects a Beneish M-Score $> -1.78$, indicating financial statement manipulation.
2. **EARNINGS_ANNOUNCEMENT_BINARY_RISK**: Sparked when earnings are scheduled within 3 days.
3. **PROMOTER_DISTRESS_SELL**: Triggered when block/bulk deal logs show massive promoter liquidation relative to average daily volume.
4. **CIRCUIT_BREAKER_TRIPPED**: Triggered when Layer 16 detects price anomalies or stale API data.
5. **AUDITOR_RESIGNATION**: Triggered when corporate scrapers detect a sudden auditor resignation.
6. **STRONGLY_BEARISH_SENTIMENT**: Triggered when NLP sentiment scores fall below extreme thresholds.
7. **EARNINGS_IMMINENT_VETO**: Triggered by imminent quarterly event risks.
8. **INSIDER_VETO**: Triggered by large, unusual insider selling activities.

---

## 5. Mathematical Score Synthesis & Aggregation

### 1. Weight Table Engine (Layer 13)
The engine selects distinct weight vectors depending on the trading mode (`INTRADAY` vs. `INVESTMENT`) and current macro regime (derived from India VIX):

| Layer Group | Intraday Weight (Low VIX) | Intraday Weight (High VIX) | Investment Weight (Low VIX) | Investment Weight (High VIX) |
| :--- | :--- | :--- | :--- | :--- |
| **Layer 1 (Macro)** | $10\%$ | $18\%$ | $8\%$ | $15\%$ |
| **Layer 2 (Microstructure)** | $20\%$ | $12\%$ | $5\%$ | $5\%$ |
| **Layer 3 (Technicals)** | $20\%$ | $15\%$ | $12\%$ | $10\%$ |
| **Layer 4 (Price Action)** | $15\%$ | $10\%$ | $10\%$ | $8\%$ |
| **Layer 5 (Volume Profile)** | $15\%$ | $10\%$ | $10\%$ | $8\%$ |
| **Layer 6 (Institutional)** | $5\%$ | $5\%$ | $20\%$ | $18\%$ |
| **Layer 7 (Derivatives)** | $15\%$ | $15\%$ | $10\%$ | $10\%$ |
| **Layer 8 (Fundamentals)** | $0\%$ | $0\%$ | $15\%$ | $12\%$ |
| **Layer 9 (Forensic)** | $0\%$ | $5\%$ | $5\%$ | $8\%$ |
| **Layer 10 (Valuation)** | $0\%$ | $0\%$ | $5\%$ | $6\%$ |
| **Layer 15 (Sentiment)** | $0\%$ | $10\%$ | $0\%$ | $0\%$ |

### 2. Aggregation Formula
The core score is calculated as a weighted sum of the active layers:
$$\text{Base Score} = \sum_{i} (\text{Score}_i \cdot \text{Weight}_i)$$

### 3. Modifiers & Smoothing
* **Precision Micro-Variance**: Infuses minor continuous adjustments:
  $$\text{Tweak} = ((\text{RSI} - 50) \cdot 0.03) + (\text{RVOL} \cdot 0.12) + (\text{MomentumPct} \cdot 0.05)$$
* **Regime Compression**: 
  * Under choppy conditions (ADX < 15), scores are compressed toward the neutral value of 50 to prevent false breakouts:
    $$\text{Score}_{\text{compressed}} = 50 + (\text{Score}_{\text{raw}} - 50) \cdot 0.50$$
  * Under strong trends (ADX > 35), score deviations from neutral are boosted by $1.10\times$.
* **Sector relative Normalization**: Adjusts the stock score relative to the current average score of its industry sector.
