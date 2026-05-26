# StockSense Ultra Pro — Real Systems Audit Report

This report presents an honest, systems-level audit evaluating the **Target Hit Ratio** and **Directional Accuracy** of StockSense Ultra Pro. 
This audit evaluates the system using **actual historical price series fetched from Yahoo Finance** for **100 random NSE stocks** evaluated over a **rolling 5-day window** (500 total evaluation points).

### Key Audit Methodology:
1. **Robust Sampling**: Evaluates 100 random stocks over 5 distinct trading days to smooth out single-day broad market noise.
2. **Real Market Prices**: Entry prices, targets, stop-losses, and indicators are calculated from real market candles.
3. **Target Win Status**: Evaluated by checking if today's actual High/Low hit the targets.
4. **Swing Horizon Evaluation**: Tested over the actual subsequent 5 trading days.

---

## 1. Executive Performance Summary

| Metric | Short-Term (ST) Intraday | Long-Term (LT) Horizon | Target Benchmark | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Total Evaluated Stocks** | 100 | 100 | — | — |
| **Vetoed / Filtered Setups** | 431 | 429 | — | — |
| **Active Trade Setups** | 69 | 71 | — | — |
| **Target Hit Ratio (Wins)** | 89.86% | 60.56% | >= 90.00% | **FAILED** ❌ |
| **Directional Accuracy** | 89.86% | 66.20% | >= 60.00% | **PASSED** ✅ |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction (Score >= 75)**: **100.00% Win Rate** (15/15 setups)
* **Moderate Conviction (45 <= Score < 75)**: **97.06% Win Rate** (33/34 setups)
* **Low/Short Conviction (Score < 45)**: **70.00% Win Rate** (14/20 setups)

---

## 3. Short-Term Intraday Verification Ledger (All 100 Stocks - Latest Day Snapshot)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `GPTINFRA` | ₹118.42 | 63.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `SBFC` | ₹93.21 | 54.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `DALBHARAT` | ₹1822.60 | 51.04 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `HCLTECH` | ₹1165.70 | 47.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `INDOBORAX` | ₹333.65 | 84.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `ALLCARGO` | ₹8.87 | 49.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `GAIL` | ₹168.67 | 70.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `KERNEX` | ₹1464.00 | 74.21 | **UP** | ₹1470.57 | ₹1363.93 | **₹1496.50** | NO | **WIN** |
| 9 | `GTL` | ₹7.61 | 62.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `INNOVANA` | ₹350.00 | 35.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `JTEKTINDIA` | ₹127.35 | 27.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `JPPOWER` | ₹18.88 | 48.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `GPPL` | ₹155.41 | 50.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `IRCTC` | ₹537.85 | 49.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `BLUEDART` | ₹4886.00 | 25.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `BEL` | ₹421.85 | 36.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `BLS` | ₹269.05 | 50.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `GARUDA` | ₹171.57 | 61.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `AGRITECH` | ₹108.46 | 49.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `JUBLPHARMA` | ₹1007.25 | 51.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `INDORAMA` | ₹37.06 | 50.42 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `AKUMS` | ₹521.00 | 62.17 | **UP** | ₹522.25 | ₹491.31 | **₹551.60** | NO | **WIN** |
| 23 | `HAPPSTMNDS` | ₹373.30 | 51.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `AGARWALEYE` | ₹479.70 | 72.94 | **UP** | ₹480.99 | ₹455.90 | **₹483.15** | NO | **WIN** |
| 25 | `INDOFARM` | ₹131.54 | 52.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `ADANIGREEN` | ₹1411.10 | 81.31 | **UP** | ₹1417.18 | ₹1330.12 | **₹1465.00** | NO | **WIN** |
| 27 | `BIRLAMONEY` | ₹141.35 | 65.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `DIFFNKG` | ₹323.35 | 65.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `DOLPHIN` | ₹409.05 | 49.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `JUNIPER` | ₹197.20 | 32.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `INFOMEDIA` | ₹6.16 | 74.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `JINDRILL` | ₹629.10 | 51.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `ACCURACY` | ₹5.86 | 79.33 | **UP** | ₹5.89 | ₹5.45 | **₹6.03** | NO | **WIN** |
| 34 | `JISLDVREQS` | ₹22.81 | 51.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `ALKALI` | ₹71.46 | 78.4 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `ORICONENT` | ₹63.49 | 35.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `BHARATFORG` | ₹1918.30 | 65.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `NYKAA` | ₹270.05 | 47.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `PRAXIS` | ₹7.07 | 48.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `PREMEXPLN` | ₹714.60 | 78.5 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `KAUSHALYA` | ₹884.90 | 60.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `RATNAMANI` | ₹2537.80 | 61.31 | **UP** | ₹2545.97 | ₹2339.27 | **₹2630.00** | NO | **WIN** |
| 43 | `ORBTEXP` | ₹163.87 | 54.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `OSWALAGRO` | ₹45.89 | 49.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `NSIL` | ₹5691.00 | 52.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `3PLAND` | ₹30.87 | 33.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `TIINDIA` | ₹3047.60 | 75.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `VIJIFIN` | ₹3.90 | 63.35 | **UP** | ₹3.92 | ₹3.52 | **₹4.00** | NO | **WIN** |
| 49 | `RAMAPHO` | ₹121.98 | 32.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `TAKE` | ₹29.63 | 51.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `TARACHAND` | ₹55.50 | 32.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `OPTIEMUS` | ₹429.45 | 69.65 | **UP** | ₹430.81 | ₹402.60 | **₹438.20** | NO | **WIN** |
| 53 | `INVENTURE` | ₹1.00 | 52.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `PARAS` | ₹855.75 | 71.21 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `GRSE` | ₹2675.70 | 60.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `GREENLAM` | ₹250.43 | 71.12 | **UP** | ₹251.62 | ₹231.01 | **₹234.13** | NO | **TIMEOUT** |
| 57 | `SECURKLOUD` | ₹20.79 | 19.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `GALAPREC` | ₹876.05 | 76.05 | **UP** | ₹879.79 | ₹821.14 | **₹950.00** | NO | **WIN** |
| 59 | `TCI` | ₹916.30 | 54.07 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `AIIL` | ₹502.85 | 60.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `BORANA` | ₹320.10 | 48.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `OSIAHYPER` | ₹3.86 | 30.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `HINDCOPPER` | ₹545.55 | 49.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `RACLGEAR` | ₹1422.90 | 64.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `TECHM` | ₹1435.50 | 53.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `TBOTEK` | ₹1215.20 | 49.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `JKPAPER` | ₹392.90 | 68.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `KARURVYSYA` | ₹292.00 | 49.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `TARSONS` | ₹214.70 | 70.85 | **UP** | ₹215.81 | ₹196.53 | **₹225.00** | NO | **WIN** |
| 70 | `CHEMPLASTS` | ₹243.89 | 54.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `BLISSGVS` | ₹317.55 | 76.9 | **UP** | ₹318.99 | ₹296.68 | **₹381.05** | NO | **WIN** |
| 72 | `DIGIDRIVE` | ₹19.87 | 27.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `HAL` | ₹4425.90 | 61.29 | **UP** | ₹4433.59 | ₹4238.88 | **₹4449.30** | NO | **WIN** |
| 74 | `GTECJAINX` | ₹18.39 | 35.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `FLEXITUFF` | ₹6.94 | 48.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `ONESOURCE` | ₹1806.80 | 47.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `SHAH` | ₹5.25 | 49.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SRGHFL` | ₹287.35 | 63.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `ONWARDTEC` | ₹270.12 | 68.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `POWERINDIA` | ₹35635.00 | 77.34 | **UP** | ₹35763.44 | ₹33794.50 | **₹36495.00** | NO | **WIN** |
| 81 | `GRINFRA` | ₹945.50 | 61.31 | **UP** | ₹947.34 | ₹900.82 | **₹952.45** | NO | **WIN** |
| 82 | `GAYAHWS` | ₹2.39 | 53.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `CMSINFO` | ₹310.55 | 53.55 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `COMPUSOFT` | ₹13.38 | 50.52 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `ALPA` | ₹68.00 | 50.21 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `PTC` | ₹191.93 | 46.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `TRENT` | ₹4300.00 | 65.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `RANEHOLDIN` | ₹1397.20 | 52.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `JUSTDIAL` | ₹523.80 | 50.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `AGARIND` | ₹424.45 | 53.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `RADAAN` | ₹3.04 | 31.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `ABINFRA` | ₹13.34 | 49.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `ANDHRSUGAR` | ₹86.84 | 45.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `ANUP` | ₹1977.70 | 67.16 | **UP** | ₹1984.19 | ₹1862.21 | **₹2018.10** | NO | **WIN** |
| 95 | `FMNL` | ₹10.26 | 47.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `JKIL` | ₹508.40 | 54.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `DPABHUSHAN` | ₹974.80 | 52.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `ACCELYA` | ₹1142.50 | 53.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `BAIDFIN` | ₹10.31 | 29.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `AMBUJACEM` | ₹441.95 | 52.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 4. Long-Term Horizon Verification Ledger (All 100 Stocks - Latest Day Snapshot)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `GPTINFRA` | ₹117.21 | 62.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `SBFC` | ₹90.77 | 35.69 | **DOWN** | ₹89.21 | ₹96.96 | **₹91.88** | NO | **TIMEOUT** |
| 3 | `DALBHARAT` | ₹1713.80 | 23.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `HCLTECH` | ₹1179.40 | 51.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `INDOBORAX` | ₹277.00 | 54.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `ALLCARGO` | ₹8.66 | 27.56 | **DOWN** | ₹8.38 | ₹9.57 | **₹9.60** | NO | **LOSS** |
| 7 | `GAIL` | ₹156.12 | 33.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `KERNEX` | ₹1354.00 | 49.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `GTL` | ₹7.40 | 48.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `INNOVANA` | ₹378.60 | 52.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `JTEKTINDIA` | ₹128.86 | 47.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `JPPOWER` | ₹18.84 | 62.54 | **UP** | ₹19.36 | ₹16.67 | **₹19.59** | NO | **WIN** |
| 13 | `GPPL` | ₹152.15 | 34.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `IRCTC` | ₹529.80 | 31.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `BLUEDART` | ₹4911.00 | 24.84 | **DOWN** | ₹4812.51 | ₹5217.79 | **₹4871.50** | NO | **TIMEOUT** |
| 16 | `BEL` | ₹422.95 | 49.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `BLS` | ₹262.00 | 33.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `GARUDA` | ₹169.91 | 48.52 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `AGRITECH` | ₹107.14 | 31.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `JUBLPHARMA` | ₹1010.95 | 81.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `INDORAMA` | ₹35.31 | 26.18 | **DOWN** | ₹34.24 | ₹38.72 | **₹44.47** | NO | **LOSS** |
| 22 | `AKUMS` | ₹519.80 | 48.19 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `HAPPSTMNDS` | ₹360.55 | 51.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `AGARWALEYE` | ₹456.85 | 68.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `INDOFARM` | ₹126.41 | 33.5 | **DOWN** | ₹122.95 | ₹139.43 | **₹122.00** | NO | **WIN** |
| 26 | `ADANIGREEN` | ₹1377.80 | 89.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `BIRLAMONEY` | ₹134.68 | 48.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `DIFFNKG` | ₹329.70 | 72.4 | **UP** | ₹341.32 | ₹299.05 | **₹324.10** | NO | **TIMEOUT** |
| 29 | `DOLPHIN` | ₹416.15 | 70.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `JUNIPER` | ₹199.69 | 35.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `INFOMEDIA` | ₹5.89 | 70.14 | **UP** | ₹6.24 | ₹4.67 | **₹6.37** | NO | **WIN** |
| 32 | `JINDRILL` | ₹655.45 | 82.27 | **UP** | ₹691.72 | ₹576.29 | **₹621.05** | NO | **TIMEOUT** |
| 33 | `ACCURACY` | ₹5.24 | 45.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `JISLDVREQS` | ₹22.71 | 47.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `ALKALI` | ₹64.68 | 63.95 | **UP** | ₹66.19 | ₹58.62 | **₹75.00** | NO | **WIN** |
| 36 | `ORICONENT` | ₹64.75 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `BHARATFORG` | ₹1857.30 | 48.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `NYKAA` | ₹271.45 | 67.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `PRAXIS` | ₹7.54 | 58.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `PREMEXPLN` | ₹524.75 | 61.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `KAUSHALYA` | ₹876.05 | 48.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `RATNAMANI` | ₹2532.90 | 47.18 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `ORBTEXP` | ₹158.98 | 51.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `OSWALAGRO` | ₹45.69 | 33.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `NSIL` | ₹5442.00 | 37.18 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `3PLAND` | ₹32.49 | 37.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `TIINDIA` | ₹2892.20 | 50.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `VIJIFIN` | ₹3.88 | 48.58 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `RAMAPHO` | ₹119.02 | 26.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `TAKE` | ₹25.53 | 14.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `TARACHAND` | ₹59.88 | 52.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `OPTIEMUS` | ₹415.05 | 50.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `INVENTURE` | ₹0.97 | 40.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `PARAS` | ₹763.10 | 48.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `GRSE` | ₹2658.50 | 47.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `GREENLAM` | ₹233.61 | 51.68 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `SECURKLOUD` | ₹21.65 | 35.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `GALAPREC` | ₹838.15 | 61.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `TCI` | ₹877.70 | 32.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `AIIL` | ₹496.70 | 63.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `BORANA` | ₹321.15 | 32.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `OSIAHYPER` | ₹4.29 | 29.24 | **DOWN** | ₹4.11 | ₹4.92 | **₹3.67** | NO | **WIN** |
| 63 | `HINDCOPPER` | ₹569.50 | 64.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `RACLGEAR` | ₹1266.40 | 59.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `TECHM` | ₹1467.10 | 52.4 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `TBOTEK` | ₹1178.10 | 48.68 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `JKPAPER` | ₹395.85 | 72.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `KARURVYSYA` | ₹293.25 | 61.39 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `TARSONS` | ₹210.79 | 51.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `CHEMPLASTS` | ₹230.35 | 41.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `BLISSGVS` | ₹282.80 | 66.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `DIGIDRIVE` | ₹21.48 | 46.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `HAL` | ₹4333.20 | 47.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `GTECJAINX` | ₹19.50 | 49.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `FLEXITUFF` | ₹7.02 | 43.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `ONESOURCE` | ₹1854.50 | 71.17 | **UP** | ₹1902.96 | ₹1690.51 | **₹1905.00** | NO | **WIN** |
| 77 | `SHAH` | ₹5.19 | 47.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SRGHFL` | ₹285.40 | 50.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `ONWARDTEC` | ₹258.17 | 37.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `POWERINDIA` | ₹33360.00 | 79.31 | **UP** | ₹34316.12 | ₹31159.40 | **₹36750.00** | NO | **WIN** |
| 81 | `GRINFRA` | ₹941.05 | 65.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `GAYAHWS` | ₹2.25 | 32.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `CMSINFO` | ₹305.65 | 52.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `COMPUSOFT` | ₹13.20 | 33.01 | **DOWN** | ₹12.83 | ₹14.57 | **₹13.30** | NO | **TIMEOUT** |
| 85 | `ALPA` | ₹69.78 | 63.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `PTC` | ₹207.14 | 66.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `TRENT` | ₹4069.60 | 65.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `RANEHOLDIN` | ₹1485.90 | 83.56 | **UP** | ₹1544.72 | ₹1328.97 | **₹1384.70** | NO | **TIMEOUT** |
| 89 | `JUSTDIAL` | ₹517.30 | 34.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `AGARIND` | ₹403.75 | 34.71 | **DOWN** | ₹390.91 | ₹453.53 | **₹425.10** | NO | **TIMEOUT** |
| 91 | `RADAAN` | ₹2.99 | 46.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `ABINFRA` | ₹12.82 | 22.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `ANDHRSUGAR` | ₹90.82 | 48.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `ANUP` | ₹1955.50 | 50.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `FMNL` | ₹12.52 | 80.48 | **UP** | ₹13.26 | ₹10.84 | **₹10.05** | NO | **LOSS** |
| 96 | `JKIL` | ₹482.75 | 32.37 | **DOWN** | ₹473.37 | ₹517.14 | **₹517.14** | NO | **LOSS** |
| 97 | `DPABHUSHAN` | ₹889.60 | 24.46 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `ACCELYA` | ₹1120.20 | 34.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `BAIDFIN` | ₹10.28 | 45.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `AMBUJACEM` | ₹431.70 | 49.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 5. Systems Validation & Verification Sign-Off

### Real Data Verification
* Backtest executed directly on real historical candles from Yahoo Finance.
* Realized target hit ratio reflects true historical execution margins rather than biased random walks.

### System Settings Used
* Short-Term SL Multiplier: **1.5 × ATR**, Target: **0.40–1.20 × ATR** (dynamic, conviction-scaled)
* Long-Term SL Multiplier: **2.0 × ATR**, Target: **0.40–1.20 × ATR** (dynamic, conviction-scaled)

**Audit Conducted by:** Antigravity AI Engine
**Verification Date:** 2026-05-26
