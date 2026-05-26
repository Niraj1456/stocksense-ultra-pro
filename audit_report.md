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
| **Vetoed / Filtered Stocks** | 88 | 100 | — | — |
| **Active Trade Setups** | 12 | 0 | — | — |
| **Target Hit Ratio (Wins)** | 58.33% | 0.00% | >= 90.00% | **FAILED** ❌ |
| **Directional Accuracy** | 66.67% | 0.00% | >= 70.00% | **FAILED** ❌ |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction (Score >= 75)**: **0.00% Win Rate** (0/0 setups)
* **Moderate Conviction (45 <= Score < 75)**: **58.33% Win Rate** (7/12 setups)
* **Low/Short Conviction (Score < 45)**: **0.00% Win Rate** (0/0 setups)

---

## 3. Short-Term Intraday Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `UCOBANK` | ₹25.54 | 50.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `RICOAUTO` | ₹119.76 | 53.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `ROSSELLIND` | ₹55.54 | 53.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `HIRECT` | ₹972.75 | 54.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `RGL` | ₹103.87 | 50.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `DMCC` | ₹278.85 | 49.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `AHLEAST` | ₹165.64 | 52.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `REDINGTON` | ₹224.14 | 50.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `IIFLCAPS` | ₹345.55 | 50.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `RBA` | ₹68.06 | 53.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `IGIL` | ₹373.90 | 53.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `LOTUSEYE` | ₹109.05 | 50.04 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `ADANIENT` | ₹2849.70 | 57.1 | **UP** | ₹2894.82 | ₹2717.93 | **₹2903.80** | NO | **WIN** |
| 14 | `KTKBANK` | ₹264.25 | 55.85 | **UP** | ₹267.97 | ₹250.10 | **₹272.95** | NO | **WIN** |
| 15 | `EQUIPPP` | ₹15.22 | 49.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `RAINBOW` | ₹1350.00 | 50.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `LUMAXTECH` | ₹1591.00 | 49.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `NAVINFLUOR` | ₹7445.50 | 58.06 | **UP** | ₹7551.69 | ₹7144.36 | **₹7448.50** | NO | **TIMEOUT** |
| 19 | `KAVDEFENCE` | ₹65.90 | 50.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `RELTD` | ₹127.63 | 49.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `OMAXE` | ₹76.84 | 52.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `AMBER` | ₹7461.50 | 52.68 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `EUREKAFORB` | ₹465.85 | 45.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `AYMSYNTEX` | ₹214.88 | 49.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `NH` | ₹1940.00 | 54.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `PALREDTEC` | ₹44.40 | 54.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `PANACEABIO` | ₹419.05 | 54.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `NGLFINE` | ₹2858.90 | 56.12 | **UP** | ₹2958.96 | ₹2553.49 | **₹2816.50** | NO | **TIMEOUT** |
| 29 | `GSLSU` | ₹54.04 | 45.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `ORIENTBELL` | ₹356.65 | 56.17 | **UP** | ₹364.73 | ₹326.28 | **₹349.15** | NO | **TIMEOUT** |
| 31 | `KAMATHOTEL` | ₹165.38 | 50.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `LFIC` | ₹137.15 | 52.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `AMBICAAGAR` | ₹23.64 | 47.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `LAMBODHARA` | ₹103.15 | 50.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `OSIAHYPER` | ₹3.86 | 44.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `LLOYDSENT` | ₹71.32 | 54.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `AETHER` | ₹1074.50 | 49.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `PARASPETRO` | ₹2.10 | 46.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `ANANTRAJ` | ₹507.50 | 53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `GILLETTE` | ₹7807.50 | 50.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `PATINTLOG` | ₹12.32 | 55.27 | **UP** | ₹12.53 | ₹11.51 | **₹14.40** | NO | **WIN** |
| 42 | `REPCOHOME` | ₹396.20 | 52.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `LAXMIDENTL` | ₹246.86 | 56.52 | **UP** | ₹253.45 | ₹227.26 | **₹239.66** | NO | **TIMEOUT** |
| 44 | `POLYPLEX` | ₹913.55 | 50.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `NILAINFRA` | ₹8.15 | 53.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `ACE` | ₹885.45 | 53.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `PGHH` | ₹9659.00 | 45.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `RAYMONDLSL` | ₹729.35 | 47.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `ALLDIGI` | ₹828.05 | 52.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `SHANKARA` | ₹126.00 | 54.5 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `AMJLAND` | ₹38.01 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `LAURUSLABS` | ₹1356.30 | 55.46 | **UP** | ₹1368.75 | ₹1308.42 | **₹1369.20** | NO | **WIN** |
| 53 | `AAKASH` | ₹8.94 | 54.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `EPACK` | ₹234.15 | 46.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `JUBLPHARMA` | ₹1007.25 | 49.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `ADANIGREEN` | ₹1411.10 | 56.07 | **UP** | ₹1437.94 | ₹1330.12 | **₹1446.20** | NO | **WIN** |
| 57 | `KAUSHALYA` | ₹884.90 | 52.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `SCPL` | ₹419.70 | 50.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `NOVAAGRI` | ₹28.66 | 50.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `NAHARSPING` | ₹263.00 | 54.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `NILASPACES` | ₹12.94 | 46.79 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `NPST` | ₹1031.20 | 49.42 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `PTCIL` | ₹16279.00 | 50.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `LANDMARK` | ₹384.05 | 50.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `MODIRUBBER` | ₹133.15 | 53.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `SAMMAANCAP` | ₹168.56 | 54.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `HECPROJECT` | ₹130.57 | 53.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `RUPA` | ₹148.86 | 53.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `KALYANKJIL` | ₹357.85 | 49.47 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `NOCIL` | ₹165.74 | 52.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `GENESYS` | ₹253.65 | 50.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `ANDHRAPAP` | ₹62.92 | 45.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `LLOYDSENGG` | ₹74.63 | 58.55 | **UP** | ₹76.41 | ₹69.65 | **₹77.84** | NO | **WIN** |
| 74 | `SPIC` | ₹71.81 | 53.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `ALLCARGO` | ₹8.87 | 49.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `HEXATRADEX` | ₹164.01 | 49.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `SONACOMS` | ₹594.65 | 53.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SANCO` | ₹3.80 | 57.05 | **UP** | ₹3.93 | ₹3.39 | **₹3.61** | NO | **TIMEOUT** |
| 79 | `SAMBHV` | ₹107.42 | 51.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `PKTEA` | ₹834.90 | 53.42 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `ELDEHSG` | ₹805.70 | 49.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `PREMIERENE` | ₹985.00 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `DENTA` | ₹285.50 | 53.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `ORIENTCEM` | ₹138.67 | 50.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `KPIGREEN` | ₹436.35 | 52.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `SMARTWORKS` | ₹456.80 | 54.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `GNFC` | ₹515.05 | 49.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `ORTEL` | ₹1.59 | 46.58 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `ASHAPURMIN` | ₹677.10 | 54.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `RPTECH` | ₹547.40 | 54.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `PRAENG` | ₹20.90 | 49.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `SAKAR` | ₹801.00 | 56.07 | **UP** | ₹822.45 | ₹720.09 | **₹835.00** | NO | **WIN** |
| 93 | `SPECIALITY` | ₹113.35 | 54.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `STARCEMENT` | ₹218.10 | 52.55 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `DEN` | ₹27.53 | 51.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `RAYMONDREL` | ₹613.15 | 53.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `ACC` | ₹1382.30 | 50.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `LEXUS` | ₹18.91 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `KAJARIACER` | ₹1070.00 | 52.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `PSPPROJECT` | ₹772.45 | 53.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 4. Long-Term Horizon Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `UCOBANK` | ₹24.77 | 48.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `RICOAUTO` | ₹113.78 | 49.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `ROSSELLIND` | ₹55.31 | 49.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `HIRECT` | ₹992.95 | 51.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `RGL` | ₹101.88 | 49.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `DMCC` | ₹295.65 | 49.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `AHLEAST` | ₹160.10 | 50.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `REDINGTON` | ₹221.24 | 50.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `IIFLCAPS` | ₹343.15 | 49.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `RBA` | ₹68.28 | 51.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `IGIL` | ₹332.70 | 50.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `LOTUSEYE` | ₹108.61 | 49.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `ADANIENT` | ₹2725.00 | 51.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `KTKBANK` | ₹247.75 | 50.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `EQUIPPP` | ₹14.32 | 48.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `RAINBOW` | ₹1350.70 | 51.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `LUMAXTECH` | ₹1626.10 | 49.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `NAVINFLUOR` | ₹7075.50 | 51.39 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `KAVDEFENCE` | ₹63.49 | 50.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `RELTD` | ₹125.54 | 48.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `OMAXE` | ₹74.81 | 49.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `AMBER` | ₹7128.50 | 49.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `EUREKAFORB` | ₹491.25 | 49.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `AYMSYNTEX` | ₹227.83 | 49.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `NH` | ₹1884.10 | 50.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `PALREDTEC` | ₹39.37 | 50.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `PANACEABIO` | ₹416.40 | 51.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `NGLFINE` | ₹2276.70 | 50.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `GSLSU` | ₹55.38 | 48.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `ORIENTBELL` | ₹350.00 | 51.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `KAMATHOTEL` | ₹163.69 | 49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `LFIC` | ₹138.28 | 49.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `AMBICAAGAR` | ₹23.82 | 49.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `LAMBODHARA` | ₹101.39 | 49.79 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `OSIAHYPER` | ₹4.29 | 48.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `LLOYDSENT` | ₹68.51 | 49.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `AETHER` | ₹1095.90 | 49.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `PARASPETRO` | ₹2.04 | 49.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `ANANTRAJ` | ₹482.45 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `GILLETTE` | ₹7662.50 | 49.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `PATINTLOG` | ₹11.86 | 49.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `REPCOHOME` | ₹395.80 | 50.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `LAXMIDENTL` | ₹204.24 | 50.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `POLYPLEX` | ₹886.20 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `NILAINFRA` | ₹7.88 | 49.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `ACE` | ₹881.95 | 50.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `PGHH` | ₹9706.00 | 50.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `RAYMONDLSL` | ₹743.65 | 49.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `ALLDIGI` | ₹825.40 | 50.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `SHANKARA` | ₹125.98 | 50.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `AMJLAND` | ₹38.44 | 48.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `LAURUSLABS` | ₹1344.90 | 51.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `AAKASH` | ₹8.91 | 51.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `EPACK` | ₹240.85 | 49.79 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `JUBLPHARMA` | ₹1010.95 | 51.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `ADANIGREEN` | ₹1377.80 | 51.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `KAUSHALYA` | ₹876.05 | 49.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `SCPL` | ₹442.80 | 51.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `NOVAAGRI` | ₹28.80 | 50.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `NAHARSPING` | ₹257.89 | 49.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `NILASPACES` | ₹13.15 | 49.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `NPST` | ₹1043.00 | 48.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `PTCIL` | ₹16221.00 | 49.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `LANDMARK` | ₹366.50 | 48.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `MODIRUBBER` | ₹132.16 | 49.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `SAMMAANCAP` | ₹138.25 | 49.25 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `HECPROJECT` | ₹125.50 | 50.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `RUPA` | ₹146.26 | 50.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `KALYANKJIL` | ₹344.15 | 48.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `NOCIL` | ₹171.62 | 50.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `GENESYS` | ₹209.50 | 48.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `ANDHRAPAP` | ₹63.26 | 49.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `LLOYDSENGG` | ₹68.44 | 51.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `SPIC` | ₹70.99 | 50.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `ALLCARGO` | ₹8.66 | 48.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `HEXATRADEX` | ₹166.87 | 50.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `SONACOMS` | ₹579.75 | 49.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SANCO` | ₹3.75 | 51.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `SAMBHV` | ₹109.97 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `PKTEA` | ₹825.00 | 49.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `ELDEHSG` | ₹818.85 | 50.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `PREMIERENE` | ₹983.10 | 50.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `DENTA` | ₹262.95 | 49.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `ORIENTCEM` | ₹135.53 | 50.07 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `KPIGREEN` | ₹438.00 | 50.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `SMARTWORKS` | ₹429.50 | 50.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `GNFC` | ₹545.95 | 51.39 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `ORTEL` | ₹1.68 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `ASHAPURMIN` | ₹638.20 | 49.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `RPTECH` | ₹543.25 | 51.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `PRAENG` | ₹21.53 | 49.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `SAKAR` | ₹766.80 | 51.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `SPECIALITY` | ₹102.01 | 50.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `STARCEMENT` | ₹210.72 | 49.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `DEN` | ₹26.84 | 50.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `RAYMONDREL` | ₹579.60 | 51.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `ACC` | ₹1359.30 | 50.07 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `LEXUS` | ₹18.75 | 48.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `KAJARIACER` | ₹1054.40 | 49.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `PSPPROJECT` | ₹773.00 | 49.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

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
