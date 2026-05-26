# StockSense Ultra Pro — Real Systems Audit Report

This report presents an honest, systems-level audit evaluating the **Target Hit Ratio** and **Directional Accuracy** of StockSense Ultra Pro. 
Unlike the previous report which used a deterministic mock data generator and a biased random-walk simulator, this audit evaluates the system using **actual historical price series fetched from Yahoo Finance** for **100 random NSE stocks**.

### Key Differences in this Audit:
1. **Real Market Prices**: Entry prices, targets, stop-losses, and historical indicators are calculated directly from real market candles.
2. **Real Price Movements**: Win/Loss/Timeout statuses are evaluated by checking if today's actual High/Low hit the targets.
3. **No Biased Simulation**: There is no random-walk simulator with upward/downward drift. The market outcomes are 100% real.
4. **Swing Horizon Evaluation**: The Long-Term swing trades are tested over the actual subsequent 5 trading days.

---

## 1. Executive Performance Summary

| Metric | Short-Term (ST) Intraday | Long-Term (LT) Horizon | Target Benchmark | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Total Evaluated Stocks** | 100 | 100 | — | — |
| **Vetoed / Filtered Stocks** | 61 | 87 | — | — |
| **Active Trade Setups** | 39 | 13 | — | — |
| **Target Hit Ratio (Wins)** | 84.62% | 92.31% | >= 90.00% | **FAILED** ❌ |
| **Directional Accuracy** | 66.67% | 69.23% | >= 70.00% | **FAILED** ❌ |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction (Score >= 75)**: **0.00% Win Rate** (0/0 setups)
* **Moderate Conviction (45 <= Score < 75)**: **86.11% Win Rate** (31/36 setups)
* **Low/Short Conviction (Score < 45)**: **66.67% Win Rate** (2/3 setups)

---

## 3. Short-Term Intraday Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `CENTRALBK` | ₹31.27 | 37.15 | **DOWN** | ₹31.19 | ₹32.64 | **₹31.00** | NO | **WIN** |
| 2 | `COASTCORP` | ₹58.69 | 50.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `DVL` | ₹249.19 | 57.86 | **UP** | ₹249.93 | ₹235.05 | **₹254.40** | NO | **WIN** |
| 4 | `VTL` | ₹601.40 | 57.32 | **UP** | ₹602.91 | ₹567.08 | **₹607.80** | NO | **WIN** |
| 5 | `HIRECT` | ₹972.75 | 59.44 | **UP** | ₹976.69 | ₹888.60 | **₹1033.45** | NO | **WIN** |
| 6 | `GENUSPAPER` | ₹12.78 | 55.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `MASTEK` | ₹1670.00 | 51.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `CREATIVEYE` | ₹7.04 | 58.28 | **UP** | ₹7.08 | ₹6.36 | **₹7.02** | NO | **TIMEOUT** |
| 9 | `NIBE` | ₹1410.20 | 65.14 | **UP** | ₹1418.20 | ₹1285.59 | **₹1501.00** | NO | **WIN** |
| 10 | `GMRAIRPORT` | ₹96.90 | 55.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `GOLDTECH` | ₹42.73 | 62.19 | **UP** | ₹42.95 | ₹39.00 | **₹49.00** | NO | **WIN** |
| 12 | `AHLUCONT` | ₹807.30 | 49.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `LFIC` | ₹137.15 | 56.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `PLASTIBLEN` | ₹176.83 | 60.25 | **UP** | ₹177.46 | ₹165.74 | **₹179.60** | NO | **WIN** |
| 15 | `AUSOMENT` | ₹135.25 | 56.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `PKTEA` | ₹834.90 | 57.44 | **UP** | ₹837.95 | ₹765.86 | **₹908.00** | NO | **WIN** |
| 17 | `PANACHE` | ₹348.15 | 49.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `GNA` | ₹378.30 | 49.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `BELLACASA` | ₹250.70 | 50.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `RPTECH` | ₹547.40 | 63.32 | **UP** | ₹549.22 | ₹512.55 | **₹557.10** | NO | **WIN** |
| 21 | `LIBAS` | ₹12.33 | 58.54 | **UP** | ₹12.38 | ₹11.38 | **₹12.45** | NO | **WIN** |
| 22 | `BLACKBUCK` | ₹515.00 | 40.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `PIONEEREMB` | ₹26.74 | 58.18 | **UP** | ₹26.84 | ₹24.41 | **₹26.90** | NO | **WIN** |
| 24 | `GLOBAL` | ₹101.68 | 49.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `PRUDMOULI` | ₹15.56 | 50.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `OIL` | ₹482.55 | 49.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `PCJEWELLER` | ₹8.92 | 50.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `PTL` | ₹38.00 | 48.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `POONAWALLA` | ₹398.90 | 41.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `ONESOURCE` | ₹1806.80 | 50.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `GOACARBON` | ₹401.95 | 59.37 | **UP** | ₹403.19 | ₹375.38 | **₹408.00** | NO | **WIN** |
| 32 | `LLOYDSENT` | ₹71.32 | 60.06 | **UP** | ₹71.58 | ₹66.62 | **₹73.95** | NO | **WIN** |
| 33 | `PATELENG` | ₹26.28 | 49.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `LUPIN` | ₹2287.20 | 54.52 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `OAL` | ₹328.65 | 61.16 | **UP** | ₹330.00 | ₹305.34 | **₹334.80** | NO | **WIN** |
| 36 | `RAJMET` | ₹3.89 | 49.39 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `GODIGIT` | ₹306.50 | 42.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `EUREKAFORB` | ₹465.85 | 40.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `PRAXIS` | ₹7.07 | 49.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `ALMONDZ` | ₹13.97 | 40.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `M&M` | ₹3139.00 | 50.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `PENINLAND` | ₹16.81 | 50.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `EPL` | ₹219.25 | 56.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `RAMRAT` | ₹470.45 | 62.69 | **UP** | ₹472.46 | ₹437.08 | **₹477.50** | NO | **WIN** |
| 45 | `PURVA` | ₹229.89 | 59.74 | **UP** | ₹230.65 | ₹213.91 | **₹226.00** | NO | **TIMEOUT** |
| 46 | `GOCOLORS` | ₹329.10 | 52.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `GILLETTE` | ₹7807.50 | 50.18 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `GMRP&UI` | ₹107.59 | 48.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `LCCINFOTEC` | ₹4.29 | 43.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `LAXMIDENTL` | ₹246.86 | 64.17 | **UP** | ₹248.09 | ₹227.26 | **₹236.96** | NO | **TIMEOUT** |
| 51 | `FOCUS` | ₹83.39 | 50.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `NECCLTD` | ₹15.54 | 56.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `ARVIND` | ₹482.25 | 60.19 | **UP** | ₹483.55 | ₹455.10 | **₹494.80** | NO | **WIN** |
| 54 | `ROTO` | ₹57.66 | 50.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `DMCC` | ₹278.85 | 49.5 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `FIEMIND` | ₹2273.60 | 58.25 | **UP** | ₹2278.33 | ₹2169.11 | **₹2305.00** | NO | **WIN** |
| 57 | `QUADFUTURE` | ₹288.65 | 49.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `LINC` | ₹101.05 | 50.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `BESTAGRO` | ₹18.19 | 50.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `EPIGRAL` | ₹1240.90 | 58.35 | **UP** | ₹1244.30 | ₹1166.04 | **₹1269.90** | NO | **WIN** |
| 61 | `RECLTD` | ₹342.20 | 49.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `NAVA` | ₹613.90 | 55.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `ELECTHERM` | ₹771.00 | 57.49 | **UP** | ₹775.16 | ₹691.05 | **₹830.60** | NO | **WIN** |
| 64 | `LAMBODHARA` | ₹103.15 | 50.25 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `NELCAST` | ₹137.19 | 49.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `ARVINDFASN` | ₹465.60 | 55.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `GLAXO` | ₹2300.10 | 41.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `MANAPPURAM` | ₹325.65 | 61.64 | **UP** | ₹326.41 | ₹310.43 | **₹328.30** | NO | **WIN** |
| 69 | `ALKALI` | ₹71.46 | 62.12 | **UP** | ₹71.76 | ₹66.45 | **₹73.50** | NO | **WIN** |
| 70 | `AVANTEL` | ₹171.70 | 64.17 | **UP** | ₹172.44 | ₹159.86 | **₹174.00** | NO | **WIN** |
| 71 | `NBIFIN` | ₹1956.90 | 56.81 | **UP** | ₹1962.86 | ₹1839.72 | **₹1939.50** | NO | **TIMEOUT** |
| 72 | `BTML` | ₹6.49 | 50.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `POLYPLEX` | ₹913.55 | 52.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `NSIL` | ₹5691.00 | 50.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `RKEC` | ₹33.84 | 50.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `DCM` | ₹88.23 | 65.04 | **UP** | ₹88.66 | ₹81.53 | **₹94.00** | NO | **WIN** |
| 77 | `LANDMARK` | ₹384.05 | 50.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `CYIENT` | ₹918.05 | 50.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `NDLVENTURE` | ₹129.83 | 59.86 | **UP** | ₹130.32 | ₹121.00 | **₹131.39** | NO | **WIN** |
| 80 | `RUBYMILLS` | ₹273.10 | 69.63 | **UP** | ₹274.28 | ₹256.56 | **₹286.80** | NO | **WIN** |
| 81 | `MANUGRAPH` | ₹15.68 | 59.34 | **UP** | ₹15.76 | ₹14.05 | **₹15.99** | NO | **WIN** |
| 82 | `KDDL` | ₹2793.40 | 60.26 | **UP** | ₹2803.44 | ₹2583.97 | **₹2775.90** | NO | **TIMEOUT** |
| 83 | `KCPSUGIND` | ₹24.46 | 55.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `DBL` | ₹435.55 | 48.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `OMAXAUTO` | ₹227.79 | 59.3 | **UP** | ₹228.60 | ₹210.48 | **₹239.17** | NO | **WIN** |
| 86 | `WALCHANNAG` | ₹245.00 | 60.36 | **UP** | ₹246.34 | ₹221.25 | **₹269.00** | NO | **WIN** |
| 87 | `ABCOTS` | ₹216.83 | 37.78 | **DOWN** | ₹215.78 | ₹237.52 | **₹222.00** | NO | **TIMEOUT** |
| 88 | `DREAMFOLKS` | ₹77.00 | 50.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `PFS` | ₹30.64 | 57.26 | **UP** | ₹30.71 | ₹29.05 | **₹31.13** | NO | **WIN** |
| 90 | `XELPMOC` | ₹101.83 | 50.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `INFY` | ₹1168.50 | 50.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `ZUARI` | ₹221.15 | 49.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `KFINTECH` | ₹829.40 | 49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `PARSVNATH` | ₹4.25 | 33.91 | **DOWN** | ₹4.22 | ₹4.78 | **₹4.17** | NO | **WIN** |
| 95 | `NAVKARURB` | ₹0.85 | 50.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `JKIL` | ₹508.40 | 51.07 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `AMBICAAGAR` | ₹23.64 | 45.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `WEBELSOLAR` | ₹111.11 | 60.56 | **UP** | ₹111.53 | ₹102.42 | **₹115.90** | NO | **WIN** |
| 99 | `AKASH` | ₹27.65 | 57.87 | **UP** | ₹27.73 | ₹25.76 | **₹28.00** | NO | **WIN** |
| 100 | `ARTEMISMED` | ₹287.92 | 62.51 | **UP** | ₹288.93 | ₹271.05 | **₹295.00** | NO | **WIN** |

---

## 4. Long-Term Horizon Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `CENTRALBK` | ₹34.04 | 43.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `COASTCORP` | ₹60.41 | 57.35 | **UP** | ₹61.96 | ₹52.92 | **₹62.90** | NO | **WIN** |
| 3 | `DVL` | ₹233.23 | 48.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `VTL` | ₹613.70 | 49.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `HIRECT` | ₹992.95 | 58.02 | **UP** | ₹1025.18 | ₹870.94 | **₹1033.45** | NO | **WIN** |
| 6 | `GENUSPAPER` | ₹12.75 | 54.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `MASTEK` | ₹1660.90 | 51.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `CREATIVEYE` | ₹6.83 | 55.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `NIBE` | ₹1108.70 | 58.9 | **UP** | ₹1136.09 | ₹1007.72 | **₹1584.80** | NO | **WIN** |
| 10 | `GMRAIRPORT` | ₹94.21 | 48.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `GOLDTECH` | ₹40.11 | 44.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `AHLUCONT` | ₹789.70 | 48.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `LFIC` | ₹138.28 | 48.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `PLASTIBLEN` | ₹165.92 | 49.42 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `AUSOMENT` | ₹121.00 | 48.25 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `PKTEA` | ₹825.00 | 49.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `PANACHE` | ₹368.85 | 56.25 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `GNA` | ₹364.20 | 43.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `BELLACASA` | ₹234.90 | 44.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `RPTECH` | ₹543.25 | 59.43 | **UP** | ₹557.31 | ₹492.21 | **₹560.00** | NO | **WIN** |
| 21 | `LIBAS` | ₹12.29 | 56.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `BLACKBUCK` | ₹532.45 | 43.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `PIONEEREMB` | ₹25.27 | 48.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `GLOBAL` | ₹102.67 | 49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `PRUDMOULI` | ₹14.93 | 43.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `OIL` | ₹501.70 | 56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `PCJEWELLER` | ₹8.09 | 42.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `PTL` | ₹38.90 | 48.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `POONAWALLA` | ₹404.50 | 44.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `ONESOURCE` | ₹1854.50 | 58.33 | **UP** | ₹1889.48 | ₹1690.51 | **₹1905.00** | NO | **WIN** |
| 31 | `GOACARBON` | ₹387.10 | 49.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `LLOYDSENT` | ₹68.51 | 49.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `PATELENG` | ₹25.86 | 43.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `LUPIN` | ₹2287.40 | 53.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `OAL` | ₹301.05 | 55.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `RAJMET` | ₹3.84 | 49.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `GODIGIT` | ₹311.00 | 50.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `EUREKAFORB` | ₹491.25 | 48.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `PRAXIS` | ₹7.54 | 53.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `ALMONDZ` | ₹14.35 | 48.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `M&M` | ₹3092.30 | 46.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `PENINLAND` | ₹16.55 | 45.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `EPL` | ₹217.23 | 48.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `RAMRAT` | ₹425.60 | 56.55 | **UP** | ₹434.33 | ₹382.39 | **₹477.50** | NO | **WIN** |
| 45 | `PURVA` | ₹233.09 | 58.17 | **UP** | ₹238.92 | ₹211.14 | **₹226.00** | NO | **TIMEOUT** |
| 46 | `GOCOLORS` | ₹259.00 | 43.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `GILLETTE` | ₹7662.50 | 44.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `GMRP&UI` | ₹114.45 | 55.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `LCCINFOTEC` | ₹4.57 | 45.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `LAXMIDENTL` | ₹204.24 | 55.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `FOCUS` | ₹85.31 | 57.19 | **UP** | ₹87.28 | ₹77.66 | **₹87.80** | NO | **WIN** |
| 52 | `NECCLTD` | ₹14.97 | 48.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `ARVIND` | ₹485.80 | 60.28 | **UP** | ₹494.42 | ₹447.63 | **₹498.75** | NO | **WIN** |
| 54 | `ROTO` | ₹57.11 | 50.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `DMCC` | ₹295.65 | 49.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `FIEMIND` | ₹2169.70 | 49.21 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `QUADFUTURE` | ₹289.30 | 43.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `LINC` | ₹96.92 | 44.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `BESTAGRO` | ₹16.81 | 43.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `EPIGRAL` | ₹1239.40 | 49.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `RECLTD` | ₹334.25 | 44.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `NAVA` | ₹602.85 | 48.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `ELECTHERM` | ₹699.30 | 48.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `LAMBODHARA` | ₹101.39 | 48.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `NELCAST` | ₹135.83 | 48.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `ARVINDFASN` | ₹429.30 | 44.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `GLAXO` | ₹2389.40 | 42.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `MANAPPURAM` | ₹315.30 | 56.6 | **UP** | ₹319.59 | ₹294.09 | **₹334.00** | NO | **WIN** |
| 69 | `ALKALI` | ₹64.68 | 55.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `AVANTEL` | ₹151.34 | 48.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `NBIFIN` | ₹1880.10 | 48.47 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `BTML` | ₹6.44 | 50.79 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `POLYPLEX` | ₹886.20 | 49.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `NSIL` | ₹5442.00 | 45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `RKEC` | ₹31.22 | 43.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `DCM` | ₹81.96 | 57.18 | **UP** | ₹83.81 | ₹72.96 | **₹94.00** | NO | **WIN** |
| 77 | `LANDMARK` | ₹366.50 | 43.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `CYIENT` | ₹905.85 | 50.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `NDLVENTURE` | ₹121.65 | 55.4 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `RUBYMILLS` | ₹228.49 | 49.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `MANUGRAPH` | ₹13.48 | 44.55 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `KDDL` | ₹2178.50 | 43.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `KCPSUGIND` | ₹24.31 | 48.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `DBL` | ₹444.45 | 48.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `OMAXAUTO` | ₹200.81 | 50.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `WALCHANNAG` | ₹236.49 | 56.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `ABCOTS` | ₹219.75 | 41.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `DREAMFOLKS` | ₹75.76 | 44.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `PFS` | ₹30.01 | 48.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `XELPMOC` | ₹106.57 | 50.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `INFY` | ₹1196.90 | 51.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `ZUARI` | ₹214.71 | 44.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `KFINTECH` | ₹824.70 | 42.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `PARSVNATH` | ₹4.88 | 41.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `NAVKARURB` | ₹0.82 | 50.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `JKIL` | ₹482.75 | 43.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `AMBICAAGAR` | ₹23.82 | 46.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `WEBELSOLAR` | ₹105.57 | 56.51 | **UP** | ₹108.01 | ₹93.46 | **₹115.90** | NO | **WIN** |
| 99 | `AKASH` | ₹26.77 | 55.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `ARTEMISMED` | ₹275.22 | 58.3 | **UP** | ₹279.65 | ₹254.45 | **₹295.00** | NO | **WIN** |

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
