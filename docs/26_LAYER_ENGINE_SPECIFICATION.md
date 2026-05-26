# STOCKSENSE ULTRA PRO — 26-LAYER ANALYTICAL ENGINE SPECIFICATION

This specification outlines the architecture, mathematical formulations, interaction modifiers, veto filters, self-learning meta-layers, and API integration endpoints of the **26-Layer Analytical Engine** powering **Stocksense Ultra Pro**.

---

## 1. Architectural Philosophy & Execution Flow

Every calculation in Stocksense Ultra Pro follows three absolute laws:

> [!NOTE]
> ### THE THREE LAWS OF STOCK LOGIC
> 
> 1. **LAW 1 — DETERMINISM**: Given the same input data and snapshot date, the engine always produces the exact same output. Every formula is explicit, thresholds are hardcoded, and randomness is prohibited.
> 2. **LAW 2 — TRACEABILITY**: Every score, signal, and verdict can be trace-audited back to the exact tick, document, or financial line-item that produced it.
> 3. **LAW 3 — HIERARCHY**: Signals are structured in a strict override hierarchy: 
>    `Veto Engine (FATAL)` $\rightarrow$ `Risk/Execution` $\rightarrow$ `Forensic Accounting (L9/L20)` $\rightarrow$ `Institutional Flow` $\rightarrow$ `Derivatives/Market Microstructure` $\rightarrow$ `Technical Momentum` $\rightarrow$ `Valuation` $\rightarrow$ `Macro Environment`.
>    Higher hierarchy layers instantly override lower-level indicators to prevent bull/bear traps.

### Upgraded 26-Layer Closed-Loop Quantitative Data Flow

```mermaid
graph TD
    %% Input Sources
    subgraph Data Acquisition (Parallel Fetching)
        Kite[Zerodha Kite API]
        SmartAPI[Angel One SmartAPI]
        FMP[Financial Modeling Prep API]
        AV[Alpha Vantage API]
        NSE[NSE Derivatives Live Data]
        BSE[BSE Scraper & XBRL API]
        VIX[India VIX Feed]
        PG[PostgreSQL Trades DB]
    end

    %% Processing Phase
    subgraph 26-Layer Engine Orchestration
        L1[L1: Macro & Regime]
        L2[L2: Microstructure & OBI]
        L3[L3: Technicals & Momentum]
        L4[L4: Price Action Wyckoff/Elliott]
        L5[L5: Volume Profile Engine]
        L6[L6: Institutional Flow]
        L7[L7: Options Derivatives]
        L8[L8: Core Fundamentals]
        L9[L9: Forensic Accounting]
        L10[L10: Valuation Engines]
        L11[L11: ML Predictive Fallback]
        L12[L12: Risk & Position Sizer]
        L13[L13: Master Scoring & Vetoes]
        L14[L14: AI Orchestrator Reasoner]
        L15[L15: Sentiment & Catalysts]
        L16[L16: Reliability & Circuit Breaker]
        L17[L17: Trades Expectancy]
        L18[L18: ATR Predictor Volatility]
        
        %% Upgraded Layers
        L19[L19: Promoter Pledge Tracker]
        L20[L20: Earnings Quality Sloan/CCC]
        L21[L21: RS Rating IBD-Style]
        L22[L22: Multi-Timeframe Coherence]
        L23[L23: Peer Percentile Ranking]
        L24[L24: Management Quality ROCE]
        L25[L25: Ensemble Dirichlet Weight Calibration]
        L26[L26: Walk-Forward Sharpe Engine]
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
    BSE & FMP --> L19
    FMP --> L20
    PG --> L21
    Kite --> L22
    PG --> L23
    FMP --> L24
    
    %% Self Learning Loops
    PG --> L26
    L26 -->|WFE Score| L25
    L25 -->|Calibrated Weights| L13
    
    %% Scoring & Verdict Phase
    L1 & L2 & L3 & L4 & L5 & L6 & L7 & L8 & L9 & L10 & L11 & L15 & L16 & L17 & L18 & L19 & L20 & L21 & L22 & L23 & L24 --> L13
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

The engine runs on a zero-lag parallel fetch pipeline using `Promise.all` and a composite key Point-in-Time (PIT) caching system:

| API / Database | Layers Served | Data Points Extracted | Fallback / Graceful Degradation |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | L17, L21, L23, L25, L26 | Closed trades (L17/L25/L26), RS percentile snapshots (L21), Sector peer benchmarks (L23), Calibrated weight overrides. | Default to static research-calibrated weights ($\lambda = 0$), L21 RS rating defaults to 50, L23 peer ranks default to 50. |
| **Zerodha Kite API** | L1, L2, L3, L4, L5, L8, L12, L16, L17, L18, L22 | Real-time OHLCV candles, last traded price (LTP), bid/ask quote depth, daily delivery %, sector index price. | Fallback to Yahoo Finance historical APIs and NSE scrapers. |
| **Angel One SmartAPI** | L2 | Real-time order book websocket streams, level-2 order book depth (bid/ask spread). | Fallback to Zerodha Kite market depth and live NSE snapshot APIs. |
| **Financial Modeling Prep (FMP)** | L6, L8, L9, L10, L15, L20, L24 | Balance Sheet, Income Statement, Cash Flow history, DCF models, insider trading logs, auditor name. | Default to Yahoo Finance quoteSummary or cached peer averages. Disables L20/L24 scoring (defaults to 50). |
| **Alpha Vantage API** | L15, L18 | News sentiment, articles, corporate earnings calendar, days to earnings. | Fallback to BSE Scrapers and local Google News parsing. |
| **NSE/BSE Scrapers & SEBI API** | L2, L6, L7, L19 | Option Chain (strike price, call/put OI, IV), block/bulk deal transactions, promoter shareholdings and pledge details. | Fallback to NSE XBRL corporate directories or FMP holders details. Defaults L19 to 50 (neutral). |

---

## 3. Comprehensive Deep-Dive: The 26 Analytical Layers

### Layer 1: Macro & Global Regime Classifier
* **Domain**: Systemic Risk Environment
* **Regime Classification**: Categorizes the market into `BULL`, `BEAR`, or `CHOP` using India VIX.
* **Hysteresis Band**: To prevent mid-session regime flipping:
  * Enter `HIGH_VIX` regime when India VIX rises $\ge 19.0$.
  * Exit `HIGH_VIX` / Enter `LOW_VIX` when India VIX falls $\le 16.5$.
  * Retains active regime within the $16.5 - 19.0$ jitter band.

### Layer 2: Microstructure & Level-2 Order Book Imbalance (L2)
* **Domain**: Order Book Supply/Demand Dynamics
* **Calculation**: Calculates a weighted Order Book Imbalance (OBI) at five depth levels.
* **Score Impact**: Contributes directly to the weighted sum up to $\pm 15$ points.

### Layer 3: Technical & Momentum Indicators
* **Domain**: Momentum & Core Trend
* **Calculation**: RSI-14, MACD, and EMA Crossovers (EMA20 vs EMA50 vs EMA200).
* **RS Dampening Modifier (Step 0.5)**: If RS percentile is $< 70$, L3 technical score is dampened to prevent false breakouts:
  $$\text{L3Score}_{\text{dampened}} = 50 + (\text{L3Score} - 50) \times 0.90$$

### Layer 4: Advanced Technical & Price Action Classifiers
* **Domain**: Structural Trend and Wave Theory
* **Classifiers**: Wyckoff structural phases, Elliott Wave counts, and Fibonacci Confluence levels.
* **Score Impact**: Wyckoff Accumulation/Markup adds $+15$ points; Distribution/Markdown subtracts $-15$.

### Layer 5: Volume Profile Engine (VPE)
* **Domain**: Volume at Price Distribution
* **Calculation**: Volume grouping by price bins, calculating POC, VAH, and VAL.
* **Amplification**: High relative volume ($\text{RVOL} > 1.5$) applies a $1.3\times$ expansion multiplier to L5 deviation from neutral.

### Layer 6: Institutional Flow & Volume Tracker
* **Domain**: Smart Money Accumulation / Distribution
* **Calculation**: FII/DII net flows, active mutual fund flows, block/bulk deal transactions, and insider trading ratios.
* **Score Impact**: Modifies base score by up to $\pm 25$ points.

### Layer 7: Options Derivatives & Open Interest (OI)
* **Domain**: Derivatives Market Sentiment
* **Calculation**: Put-Call Ratio (PCR), Max Pain, and OI Delta shifts.
* **Score Impact**: PCR $> 1.2$ adds $+15$ points; $< 0.6$ subtracts $-15$.

### Layer 8: Core Fundamentals & Financials
* **Domain**: Enterprise Financial Viability
* **Metrics**: Debt-to-Equity, absolute ROE, PEG Ratio, and Interest Coverage.
* **Peer Percentile Blend (L23)**: If L23 is active, absolute L8 fundamentals score is blended with the sector peer percentile rank (L23) to prevent bias against asset-heavy sectors.

### Layer 9: Forensic Accounting & Integrity Scanner
* **Domain**: Corporate Governance & Fraud Detection
* **Metrics**: Altman Z-Score (bankruptcy), Piotroski F-Score (health), and Beneish M-Score (earnings manipulation).
* **Veto Trigger**: Beneish M-Score $> -1.78$ triggers a `BENEISH_M_SCORE_MANIPULATION` fatal veto.

### Layer 10: DCF Valuation Engine
* **Domain**: Intrinsic Valuation consensus
* **Calculation**: LOCAL DCF (FCF projection method) compared against current market price to calculate Margin of Safety.

### Layer 11: Machine Learning Predictive Signal Layer
* **Domain**: Quantitative Pattern Classification
* **Calculation**: Probability output $P(\text{Up}) \in [0.0, 1.0]$ mapped to $[10, 90]$ score.
* **Codebase Migration**: Integrates a deterministic Quantitative Pattern Classifier fallback using rolling breakout, mean reversion, and Markov chain indicators.

### Layer 12: Risk Execution & Sizing
* **Domain**: Money Management & Portfolio Protection
* **Calculation**: Stoploss distance defined as $\text{StopDistance} = \text{ATR}_{14} \times 1.5$. Recommended position size calculated using the strict 1% risk rule. Pure execution layer (0% weight).

### Layer 13: Master Scoring & Veto Filters
* **Domain**: The Score Fusion Core
* **Aggregation Pipeline**:
  1. **Step 0.5 (RS Dampening)**: Dampen L3 score if L21 RS percentile $< 70$.
  2. **Step 1 (Base Weighted Sum)**: $S_{\text{base}} = \sum (S_i \cdot w_i) / 100$.
  3. **Step 2 (MTF Compression)**: If alignment is `MISALIGNED`, compress score: $S_1 = 50 + (S_{\text{base}} - 50) \times 0.65$.
  4. **Step 2b (MTF Coherence Bonus)**: If `FULL_BULLISH` and $S_1 > 55$, add $+3$; if `FULL_BEARISH` and $S_1 < 45$, subtract $-3$.
  5. **Step 3 (RS Multiplier)**: If RS $> 90$ and uptrend, multiply deviation by $1.08x$.
  6. **Step 4 (ADX Scaling)**: Apply ADX trend multipliers ($0.55\times$ to $1.12\times$).
  7. **Step 5 (RVOL Amplifier)**: Multiply deviation by $1.12\times$ if $\text{RVOL} > 2.0$ and trend is active.
  8. **Step 6 (Sector Normalization)**: Apply sector relative offset, clamped to $[-5, +5]$.
  9. **Step 6b (Joint Forensic-Earnings Compression)**: If L9 $< 40$ and L20 $< 40$, compress deviation by $0.75\times$ and log `JOINT_ACCOUNTING_MANIPULATION_RISK_WARN`.
  10. **Step 7 (Caution Veto Compressions)**: Apply caution tier multipliers (clamped to $[0.40, 1.00]$).
  11. **Step 8 (Conviction Gating)**: Calculate gating multiplier based on directional agreement across L2, L3, L4, L5, L21, and L22:
      $$\text{ConvMultiplier} = \max\left(0.33, \min\left(1.0, \frac{\text{agreeing\_layers}}{3}\right)\right)$$
      Compress deviation: $S_{\text{final}} = 50 + (S_{\text{gated}} - 50) \times \text{ConvMultiplier}$.
  12. **Step 9 (Clamping)**: Clamp final score to $[5, 95]$.

### Layer 14: AI Orchestrator & Cognitive Reasoner
* **Domain**: Narrative Synthesis
* **APIs / Services**: Large Language Model context parser, capped at **8,000 tokens**.

### Layer 15: Sentiment & Catalyst Engine
* **Domain**: Alternative Event-Driven Data
* **Calculation**: Sentiment scoring using news transcripts and concall text, board disclosures, and earnings proximity.

### Layer 16: Reliability & Circuit Breaker Engine
* **Domain**: Systemic Safety Rails
* **Calculation**: Audits data freshness decay (TTL), price outlier spikes, and API confidence ratios. Trips fatal vetoes on data staleness.

### Layer 17: Dynamic Database Backtesting & Expectancy
* **Domain**: Historical Strategy Edge
* **Calculation**: Expectancy and win-rate calculations compiled from historical PostgreSQL logs.

### Layer 18: ATR Predictor & Short Entry Advisor
* **Domain**: Volatility Forecasting
* **Calculation**: Predicts daily ATR movement range to scale target boundaries.

### Layer 19: Promoter Pledge Tracker
* **Domain**: Promoter Risk & Governance
* **Score Mapping**:
  * Pledge% = 0% $\rightarrow$ Score: **80** (Governance Champion)
  * Pledge% < 5% (stable/decreasing) $\rightarrow$ **75**
  * Pledge% < 5% (increasing < 5% QoQ) $\rightarrow$ **65**
  * Pledge% 5-15% (stable/decreasing) $\rightarrow$ **60**
  * Pledge% 5-15% (increasing < 5% QoQ) $\rightarrow$ **55**
  * Pledge% 15-30% (stable/decreasing) $\rightarrow$ **50** (neutral)
  * Pledge% 15-30% (increasing < 5% QoQ) $\rightarrow$ **45**
  * Pledge% 30-50% (stable/decreasing) or velocity $> 5\%$ QoQ $\rightarrow$ **30**
  * Pledge% $> 50\%$ and velocity $> 10\%$ QoQ $\rightarrow$ **10** + **FATAL VETO**: `PROMOTER_PLEDGE_DISTRESS_VETO`
  * Pledge% $> 50\%$ and velocity $\le 10\%$ QoQ $\rightarrow$ **20**
* **Dilution Exception Muting**: If a RIGHTS or QIP corporate action occurs during the quarter, muting sets quarterly velocity to `0.00` and logs `L19_PLEDGE_VELOCITY_MUTED_DUE_TO_EQUITY_DILUTION`.

### Layer 20: Earnings Quality & Revenue Decomposition
* **Domain**: Sloan Accounting Anomalies & Working Capital Stress
* **Calculations**:
  * Sloan Accruals Ratio (with math constant $\epsilon = 0.0001$):
    $$\text{AccrualsRatio} = \frac{\text{NetIncome} - \text{CFO}}{\left(\frac{\text{TotalAssets}_t + \text{TotalAssets}_{t-1}}{2}\right) + \epsilon}$$
  * Cash Conversion Cycle (CCC): $\text{DaysReceivable} + \text{DaysInventory} - \text{DaysPayable}$
  * Organic Growth: $\text{TotalRevenueGrowth} - \text{SegmentAcquisitionRevenue}$
* **Score Mapping**: Start at 50, add/subtract based on Sloan ($<0.05 \rightarrow +15$), organic growth ($>10\% \rightarrow +5$), and CCC trends.
* **Caution Trigger**: Accruals Ratio $> 0.20$ (excluding BFSI & adjusted sectors) triggers caution veto `EARNINGS_QUALITY_MANIPULATION` (0.80x compression).

### Layer 21: Relative Strength (RS) Rating Engine
* **Domain**: Relative Performance momentum (IBD-Style)
* **Calculation**: Calculates price change over past year:
  $$\text{Perf} = 2 \cdot \left(\frac{C_t - C_{t-20}}{C_{t-20}}\right) + 2 \cdot \left(\frac{C_t - C_{t-40}}{C_{t-40}}\right) + \left(\frac{C_t - C_{t-65}}{C_{t-65}}\right) + \left(\frac{C_t - C_{t-252}}{C_{t-252}}\right)$$
  Calculates the percentile rank ($1 - 99$) across all active universe registry symbols.
* **Score Mapping**: Mapped linearly to $[10, 90]$ range:
  $$\text{L21Score} = 10 + \left(\frac{\text{percentile} - 1}{98}\right) \times 80$$

### Layer 22: Multi-Timeframe Coherence
* **Domain**: Trend Congruence
* **How it Analyzes**: Assesses trend direction (EMA20 vs EMA50, MACD crossover) across Daily, Weekly, and Monthly charts.
* **Score Mapping**:
  * `FULL_BULLISH` (All 3 charts positive) $\rightarrow$ Score: **75**
  * `PARTIAL_BULLISH` (Daily + Weekly positive) $\rightarrow$ Score: **62**
  * `NEUTRAL` (Mixed direction / sideways) $\rightarrow$ Score: **50**
  * `PARTIAL_BEARISH` (Daily + Weekly negative) $\rightarrow$ Score: **38**
  * `MISALIGNED` $\rightarrow$ Score: **30**
  * `FULL_BEARISH` (All 3 charts negative) $\rightarrow$ Score: **25**

### Layer 23: Peer Percentile Ranking
* **Domain**: Sector Peer Valuation Context
* **Calculation**: Sector-relative percentile rank of ROE, ROCE, D/E, and FCF Yield.
* **Peer Count Blending (theta)**:
  * peerCount $< 5$: $\theta = 0.00$ (bypass)
  * peerCount $5 - 29$: $\theta = 0.30 + \left(\frac{\text{peerCount} - 5}{25}\right) \times 0.35$
  * peerCount $\ge 30$: $\theta = 0.65$
  * Blended Score: $L8_{\text{blended}} = (1 - \theta) \cdot L8_{\text{absolute}} + \theta \cdot L23_{\text{score}}$

### Layer 24: Management Quality Scoring
* **Domain**: Capital Allocation & Auditing Quality
* **ROCE Trend**: Calculates the 5-year ROCE slope using linear regression. (BFSI sectors receive a $1.5\times$ slope multiplier).
* **Capital Allocation**: sustainable dividend payout ratio relative to FCF.
* **Auditor Tier**: Big 4 auditing firms receive $+5$ bonus points; mid-tier receives $+2$; unknown/local auditor receives $0$ points.

### Layer 25: Ensemble Weight Calibration (Self-Learning)
* **Domain**: Parameter Tuning & Dynamic Weight Adjustment
* **Dirichlet Prior Update**: Optimizes active layer weights based on Directional Conviction Accuracy (DCA):
  $$\alpha_i = w_i \times 10$$
  $$\text{DCA}_i = \frac{\text{CorrectDirectionalTrades}_i}{\text{TotalTrades}_i}$$
* **Blended Weight Allocation**:
  $$w_{\text{final}}[i] = (1 - \lambda) \cdot w_{\text{static}}[i] + \lambda \cdot w_{\text{calibrated}}[i]$$
* **Calibration Safety Rails**:
  * Max shift of $\pm 3\%$ per layer per cycle.
  * Ceiling constraint of $30\%$ maximum weight.
  * Floors: active layers floor = $2\%$, inactive layers floor = $1\%$.
  * Cumulative drift limit: $|w_{\text{calibrated}} - w_{\text{static}}| > 8\%$ triggers `HIGH_CUMULATIVE_WEIGHT_DRIFT_ALERT`.
  * Minimum $130$ closed trades before calibration triggers.
* **Ceiling Streak Reset**: If a layer hits the $30\%$ ceiling for 3 consecutive cycles, triggers `reset_weights_to_static()` and log `SYSTEM_WEIGHTS_RESET_ALERT`.

### Layer 26: Walk-Forward Optimization Engine
* **Domain**: Out-of-Sample Strategy Edge Validation
* **Rolling Window**: Segregates trade history by mode using rolling windows (size=130 trades, step=50 trades).
* **Sharpe Maximization**:
  $$\text{Sharpe} = \frac{\overline{R}_{\text{window}} - 0}{\sigma_{R_{\text{window}}} + \text{SHARPE\_EPSILON}} \times \text{ScaleFactor}$$
  *ScaleFactor*: $252$ for Intraday, $\sqrt{\frac{252}{\max(5,\ \text{avgHoldingDays})}}$ for Investment.
* **WFE Blending Strength ($\lambda$)**:
  * $\text{WFE} > 0.70 \rightarrow \lambda = 1.0$
  * $0.55 \le \text{WFE} \le 0.70 \rightarrow \lambda = 0.70$
  * $\text{WFE} < 0.55 \rightarrow \lambda = 0.0$ (reverts to static weights)
* **Alpha Decay Fatal Veto**: If Sharpe decay rate (slope of OOS Sharpe across windows) is $< -0.15$ for 3 consecutive windows, triggers `ALPHA_DECAY_HALT_VETO` fatal veto.

---

## 4. The Tiered Veto & Caution System

Veto conditions are divided into three distinct tiers to preserve capital without over-penalizing trading frequency:

| Tier | Veto Code / Trigger Name | Condition | Source | Score Impact / Action |
|:---|:---|:---|:---:|:---|
| **FATAL** | `BENEISH_M_SCORE_MANIPULATION` | Beneish M-Score > -1.78 | L9 | Reject trade. Verdict = `SYSTEM_VETO`. |
| **FATAL** | `PROMOTER_PLEDGE_DISTRESS` | Pledge% > 50% AND Velocity > 10% QoQ | L19 | Reject trade. Verdict = `SYSTEM_VETO`. |
| **FATAL** | `PROMOTER_DISTRESS_SELL` | Promoter block deal selling > 0.5% | L19 | Reject trade. Verdict = `SYSTEM_VETO`. |
| **FATAL** | `CIRCUIT_BREAKER_TRIPPED` | Price anomalies, stale data, or API offline limits | L16 | Reject trade. Verdict = `SYSTEM_VETO`. |
| **FATAL** | `AUDITOR_RESIGNATION` | Sudden auditor resignation announcements | L15 | Reject trade. Verdict = `SYSTEM_VETO`. |
| **FATAL** | `ALPHA_DECAY_HALT` | Sharpe decay rate < -0.15 for 3 consecutive windows | L26 | Reject trade. Verdict = `SYSTEM_VETO`. |
| **CAUTION** | `TREND_MISALIGNMENT` | Daily, Weekly, and Monthly EMAs disagree | L22 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.65$. |
| **CAUTION** | `EARNINGS_BINARY_EVENT` | Days to earnings $\le 3$ | L15 | Compress score deviation: Long $\times 0.70$, Short $\times 0.85$. |
| **CAUTION** | `EARNINGS_QUALITY_MANIPULATION` | Accruals Ratio > 0.20 (excluding BFSI & adjusted sectors) | L20 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.80$. |
| **CAUTION** | `LOW_VOLUME_LONG` | Buy signal (Score $\ge 58$) with relative volume < 0.40 | L5 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `LOW_VOLUME_SHORT` | Short signal (Score $< 38$) with relative volume < 0.50 | L5 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `UNIVERSAL_LOW_VOLUME` | Score $\ge 58$ or $< 38$ with relative volume < 0.35 | L5 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.70$. |
| **CAUTION** | `MOMENTUM_DISAGREEMENT_LONG` | Buy signal with momentumPct < -1.0 and RSI > 25 | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.70$. |
| **CAUTION** | `MOMENTUM_DISAGREEMENT_SHORT`| Short signal with momentumPct > 1.0 and RSI < 75 | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.70$. |
| **CAUTION** | `TREND_ALIGNMENT_SHORT` | Short signal during macro and long-term uptrend | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `OVERSOLD_OVERRIDE` | Short signal with RSI < 25 during long-term uptrend | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.70$. |
| **CAUTION** | `BEAR_MARKET_LONG` | Buy signal in BEAR regime during trending conditions | L1 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `WEAK_BEAR_CONVICTION` | Bearish signal with $< 2$ bearish layers | L13 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `OVERSOLD_SHORT` | Short signal with RSI < 30 (unless momentum < -3%) | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `OVERBOUGHT_LONG` | Buy signal (Score < 75) with RSI > 60 | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `OVERSOLD_TREND_LONG` | Buy signal with RSI < 30 and ADX > 25 | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `CANDLE_VETO_LONG` | Long signal with weak close position or bearish engulfing | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **CAUTION** | `CANDLE_VETO_SHORT` | Short signal with weak close position or bullish engulfing | L3 | Compress score deviation: $S_{\text{new}} = 50 + (S - 50) \times 0.75$. |
| **ADVISORY** | `ALTMAN_DISTRESS` | Altman Z-Score indicates distress zone | L9 | Log warning advisory; no score impact. |

---

## 5. Interaction Effects & Scaling Modifiers

### 1. Multi-Layer Conviction Gating
Checks directional agreement across L2, L3, L4, L5, L21, and L22:
- **Long**: count layers with score $> 55$.
- **Short**: count layers with score $< 45$.
- **Formula**:
  $$\text{ConvMultiplier} = \max\left(0.33, \min\left(1.0, \frac{\text{agreeing\_layers}}{3}\right)\right)$$
  The deviation is compressed: $S_{\text{final}} = 50 + (S_{\text{gated}} - 50) \times \text{ConvMultiplier}$.

### 2. Regime-Aware Dynamic Target Scaling
Enforces volatility and volume scaling on ATR target ranges:
- **Base distance**: $H = \text{ATR}_{14} \times \text{atrMultiplier}$
- **High Volatility Compression**: If regime is `BEAR` or India VIX $\ge 19.0$, target headroom is compressed by $0.85\times$.
- **Volume breakout Expansion**: If $\text{RVOL} > 2.0$ and confirmed uptrend, headroom is expanded by $1.15\times$.
- **Low-volume Compression**: If $\text{RVOL} < 0.8$, headroom is compressed by $0.80\times$.

### 3. Data Quality Score
Tracks availability of primary vs fallback sources:
- **Weighted Quality Sum**:
  $$\text{data\_quality\_score} = \frac{\sum w_i \cdot \text{source}_i}{\sum w_i} \times 100$$
  If score $< 60.0$, logs `LOW_DATA_QUALITY_SCORE_ALERT`.

---

## 6. Override and Administration Endpoints

### 1. GET `/api/health`
Monitors system freshness, decay, and health:
* Queries succeeded TTL status of all 10 background jobs. Returns immediate `DEGRADED` status fallback if any job success is `NULL`.
* Assures `corporate_actions` table data is fresh ($< 336$ hours staleness).
* Reports WFE scores, Sharpe decay rates, and safety rollback states.

### 2. POST `/api/weights/override`
Enables manual weight calibration overrides under strict validation rules:
* Weights must sum to exactly `100.00%`.
* Active layer weights must respect floors ($\ge 2\%$) and ceilings ($\le 30\%$).
* Inactive weights must respect the $1\%$ floor.
* Logs overriding audit details and sets expiry keys. Reverts back automatically to static baseline on expiry using the `overrideExpiryJob` hourly cron check.
