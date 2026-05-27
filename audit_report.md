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
| **Vetoed / Filtered Setups** | 431 | 438 | — | — |
| **Active Trade Setups** | 69 | 62 | — | — |
| **Target Hit Ratio (Wins)** | 89.86% | 46.77% | >= 90% (ST)<br>>= 50% (LT) | ST: **FAILED** ❌<br>LT: **FAILED** ❌ |
| **Directional Accuracy** | 89.86% | 59.68% | >= 60.00% | ST: **PASSED** ✅<br>LT: **FAILED** ❌ |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction — STRONG BUY (Score >= 70)**: **90.91% Win Rate** (30/33 setups)
* **Moderate Conviction — BUY / ACCUMULATE (45 <= Score < 70)**: **92.31% Win Rate** (24/26 setups)
* **Low Conviction — AVOID (Score < 45)**: **80.00% Win Rate** (8/10 setups)

---

## 3. Short-Term Intraday Verification Ledger (All 100 Stocks - Latest Day Snapshot)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `ENERGYDEV` | ₹17.17 | 61.12 | **UP** | ₹17.23 | ₹16.00 | **₹17.35** | NO | **WIN** |
| 2 | `AIRAN` | ₹17.01 | 61.58 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `ENGINERSIN` | ₹230.50 | 51.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `BLAL` | ₹187.97 | 46.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `ETHOSLTD` | ₹2399.40 | 49.4 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `DELHIVERY` | ₹463.50 | 63.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `FAIRCHEMOR` | ₹619.60 | 71.03 | **UP** | ₹621.77 | ₹584.18 | **₹619.00** | NO | **TIMEOUT** |
| 8 | `EXXARO` | ₹6.55 | 32.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `GOYALALUM` | ₹6.77 | 51.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `LATTEYS` | ₹24.95 | 73.98 | **UP** | ₹25.09 | ₹22.36 | **₹25.69** | NO | **WIN** |
| 11 | `EMMBI` | ₹84.43 | 52.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `TVSMOTOR` | ₹3454.90 | 51.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `EMIL` | ₹115.17 | 50.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `CYBERMEDIA` | ₹17.85 | 67.64 | **UP** | ₹17.94 | ₹15.96 | **₹17.84** | NO | **TIMEOUT** |
| 15 | `LINC` | ₹100.88 | 54.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `FCSSOFT` | ₹1.51 | 30.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `PETRONET` | ₹280.20 | 51.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `MSUMI` | ₹39.23 | 32.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `LTFOODS` | ₹410.45 | 50.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `HCG` | ₹656.00 | 75.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `MTNL` | ₹30.38 | 62.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `GOCLCORP` | ₹378.10 | 75.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `MOTHERSON` | ₹135.82 | 68.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `NECLIFE` | ₹12.27 | 50.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `CUB` | ₹254.10 | 52.55 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `FEDFINA` | ₹161.74 | 51.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `MOSCHIP` | ₹203.30 | 48.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `GENUSPAPER` | ₹12.83 | 63.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `CSBBANK` | ₹364.10 | 51.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `HAVISHA` | ₹1.50 | 48.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `DBEIL` | ₹78.85 | 53.18 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `MOTISONS` | ₹11.56 | 24.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `DAMCAPITAL` | ₹152.84 | 51.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `GUJALKALI` | ₹696.25 | 50.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `NRL` | ₹58.08 | 76.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `CTE` | ₹32.07 | 50.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `CURAA` | ₹89.57 | 41.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `LYPSAGEMS` | ₹5.17 | 51.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `GTPL` | ₹66.53 | 38.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `BLUSPRING` | ₹68.12 | 50.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `AWHCL` | ₹470.50 | 33.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `OBCL` | ₹53.18 | 39.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `NAZARA` | ₹290.55 | 50.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `PDSL` | ₹301.20 | 51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `CUMMINSIND` | ₹5418.50 | 66.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `PCJEWELLER` | ₹9.12 | 66.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `PRAKASHSTL` | ₹4.51 | 51.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `NAM-INDIA` | ₹1095.70 | 70.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `INTELLECT` | ₹710.55 | 51.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `PAVNAIND` | ₹18.12 | 31.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `IGARASHI` | ₹385.60 | 49.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `MASTEK` | ₹1632.20 | 35.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `POLYPLEX` | ₹905.70 | 50.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `ASHIANA` | ₹377.15 | 52.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `LEMONTREE` | ₹117.21 | 53.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `CEATLTD` | ₹3298.10 | 49.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `APOLLOHOSP` | ₹8258.50 | 51.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `HONASA` | ₹396.00 | 87.91 | **UP** | ₹397.42 | ₹376.15 | **₹408.25** | NO | **WIN** |
| 59 | `INDUSTOWER` | ₹433.25 | 50.4 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `AUTOAXLES` | ₹1795.20 | 64.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `LAOPALA` | ₹176.42 | 55.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `MUKKA` | ₹22.95 | 51.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `HMT` | ₹57.27 | 36.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `ORIENTHOT` | ₹98.87 | 51.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `MAHLIFE` | ₹341.30 | 53.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `PANSARI` | ₹291.70 | 54.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `PNB` | ₹105.91 | 51.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `ACCELYA` | ₹1131.20 | 50.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `FDC` | ₹403.15 | 79.92 | **UP** | ₹404.80 | ₹380.67 | **₹419.20** | NO | **WIN** |
| 70 | `COROMANDEL` | ₹1846.80 | 33.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `PRAENG` | ₹21.06 | 39.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `AIIL` | ₹494.85 | 48.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `PNC` | ₹18.59 | 25.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `NATCOPHARM` | ₹1186.00 | 72.78 | **UP** | ₹1189.07 | ₹1129.26 | **₹1202.00** | NO | **WIN** |
| 75 | `IL&FSTRANS` | ₹2.33 | 53.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `OBEROIRLTY` | ₹1693.70 | 51.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `BRNL` | ₹20.32 | 62.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `MUKTAARTS` | ₹64.62 | 77.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `INOXGREEN` | ₹179.29 | 48.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `MANGLMCEM` | ₹850.60 | 60.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `GPTINFRA` | ₹117.56 | 51.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `CREDITACC` | ₹1298.30 | 49.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `OSWALAGRO` | ₹48.12 | 51.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `MCLOUD` | ₹27.22 | 76.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `MOTOGENFIN` | ₹26.97 | 51.04 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `INDNIPPON` | ₹820.05 | 57.52 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `ADANIENT` | ₹2969.30 | 88.67 | **UP** | ₹2981.09 | ₹2830.40 | **₹2995.00** | NO | **WIN** |
| 88 | `DATAPATTNS` | ₹4101.70 | 69.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `GVPTECH` | ₹6.57 | 49.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `LOTUSEYE` | ₹109.42 | 52.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `360ONE` | ₹1125.30 | 51.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `IRFC` | ₹99.28 | 51.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `MANGALAM` | ₹28.89 | 32.68 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `COASTCORP` | ₹61.12 | 72.31 | **UP** | ₹61.45 | ₹55.86 | **₹63.00** | NO | **WIN** |
| 95 | `SEAMECLTD` | ₹1595.20 | 50.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `PAR` | ₹92.30 | 53.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `OLAELEC` | ₹37.58 | 52.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `PRAKASH` | ₹149.99 | 74.47 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `SMSPHARMA` | ₹376.25 | 48.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `SHANKARA` | ₹126.00 | 64.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 4. Long-Term Horizon Verification Ledger (All 100 Stocks - Latest Day Snapshot)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `ENERGYDEV` | ₹16.72 | 61.92 | **UP** | ₹17.10 | ₹15.12 | **₹17.90** | NO | **WIN** |
| 2 | `AIRAN` | ₹16.38 | 56.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `ENGINERSIN` | ₹241.40 | 51.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `BLAL` | ₹186.38 | 35.58 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `ETHOSLTD` | ₹2356.30 | 49.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `DELHIVERY` | ₹456.80 | 49.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `FAIRCHEMOR` | ₹600.55 | 46.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `EXXARO` | ₹6.53 | 32.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `GOYALALUM` | ₹6.76 | 47.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `LATTEYS` | ₹23.71 | 51.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `EMMBI` | ₹83.90 | 51.52 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `TVSMOTOR` | ₹3361.90 | 42.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `EMIL` | ₹115.68 | 57.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `CYBERMEDIA` | ₹17.32 | 51.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `LINC` | ₹97.97 | 52.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `FCSSOFT` | ₹1.51 | 31.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `PETRONET` | ₹264.65 | 34.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `MSUMI` | ₹39.72 | 39.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `LTFOODS` | ₹403.90 | 47.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `HCG` | ₹652.05 | 79.14 | **UP** | ₹671.60 | ₹606.91 | **₹655.70** | NO | **TIMEOUT** |
| 21 | `MTNL` | ₹28.74 | 46.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `GOCLCORP` | ₹298.25 | 47.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `MOTHERSON` | ₹132.17 | 67.31 | **UP** | ₹135.23 | ₹123.13 | **₹139.01** | NO | **WIN** |
| 24 | `NECLIFE` | ₹12.27 | 50.42 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `CUB` | ₹250.05 | 50.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `FEDFINA` | ₹150.85 | 49.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `MOSCHIP` | ₹210.19 | 48.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `GENUSPAPER` | ₹12.76 | 49.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `CSBBANK` | ₹363.85 | 51.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `HAVISHA` | ₹1.58 | 50.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `DBEIL` | ₹75.85 | 40.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `MOTISONS` | ₹11.89 | 37.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `DAMCAPITAL` | ₹152.04 | 40.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `GUJALKALI` | ₹717.25 | 72.37 | **UP** | ₹739.65 | ₹643.35 | **₹694.00** | NO | **TIMEOUT** |
| 35 | `NRL` | ₹52.37 | 48.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `CTE` | ₹31.53 | 51.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `CURAA` | ₹91.20 | 35.38 | **DOWN** | ₹88.89 | ₹100.30 | **₹83.00** | NO | **WIN** |
| 38 | `LYPSAGEMS` | ₹4.98 | 47.19 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `GTPL` | ₹67.84 | 50.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `BLUSPRING` | ₹73.51 | 92.7 | **UP** | ₹77.52 | ₹66.11 | **₹67.37** | NO | **TIMEOUT** |
| 41 | `AWHCL` | ₹462.75 | 29.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `OBCL` | ₹53.89 | 34.18 | **DOWN** | ₹52.76 | ₹58.20 | **₹51.50** | NO | **WIN** |
| 43 | `NAZARA` | ₹291.05 | 51.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `PDSL` | ₹294.35 | 50.4 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `CUMMINSIND` | ₹5399.50 | 70.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `PCJEWELLER` | ₹8.21 | 32.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `PRAKASHSTL` | ₹4.37 | 37.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `NAM-INDIA` | ₹1103.00 | 76.16 | **UP** | ₹1128.29 | ₹1025.77 | **₹1096.90** | NO | **TIMEOUT** |
| 49 | `INTELLECT` | ₹689.95 | 35.46 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `PAVNAIND` | ₹17.99 | 31.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `IGARASHI` | ₹400.55 | 51.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `MASTEK` | ₹1619.30 | 49.79 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `POLYPLEX` | ₹888.60 | 48.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `ASHIANA` | ₹378.70 | 77.34 | **UP** | ₹392.14 | ₹346.61 | **₹379.10** | NO | **TIMEOUT** |
| 55 | `LEMONTREE` | ₹111.14 | 35.47 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `CEATLTD` | ₹3167.40 | 36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `APOLLOHOSP` | ₹8078.50 | 66.19 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `HONASA` | ₹356.75 | 72.19 | **UP** | ₹363.42 | ₹334.67 | **₹408.25** | NO | **WIN** |
| 59 | `INDUSTOWER` | ₹427.85 | 50.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `AUTOAXLES` | ₹1755.60 | 52.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `LAOPALA` | ₹168.33 | 26.61 | **DOWN** | ₹164.13 | ₹179.19 | **₹175.65** | NO | **TIMEOUT** |
| 62 | `MUKKA` | ₹22.69 | 46.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `HMT` | ₹56.65 | 46.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `ORIENTHOT` | ₹96.80 | 48.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `MAHLIFE` | ₹326.70 | 50.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `PANSARI` | ₹265.90 | 38.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `PNB` | ₹102.22 | 39.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `ACCELYA` | ₹1106.40 | 33.6 | **DOWN** | ₹1091.08 | ₹1164.23 | **₹1141.10** | NO | **TIMEOUT** |
| 69 | `FDC` | ₹363.60 | 47.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `COROMANDEL` | ₹1871.60 | 49.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `PRAENG` | ₹21.54 | 48.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `AIIL` | ₹507.85 | 74.82 | **UP** | ₹525.62 | ₹463.27 | **₹534.20** | NO | **WIN** |
| 73 | `PNC` | ₹18.62 | 21.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `NATCOPHARM` | ₹1156.30 | 50.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `IL&FSTRANS` | ₹2.37 | 54.36 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `OBEROIRLTY` | ₹1626.70 | 59.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `BRNL` | ₹20.11 | 49.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `MUKTAARTS` | ₹52.00 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `INOXGREEN` | ₹180.42 | 51.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `MANGLMCEM` | ₹798.70 | 34.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `GPTINFRA` | ₹119.85 | 62.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `CREDITACC` | ₹1293.90 | 49.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `OSWALAGRO` | ₹44.84 | 32.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `MCLOUD` | ₹25.08 | 48.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `MOTOGENFIN` | ₹24.66 | 66.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `INDNIPPON` | ₹782.25 | 57.25 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `ADANIENT` | ₹2704.80 | 54.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `DATAPATTNS` | ₹3834.10 | 50.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `GVPTECH` | ₹6.52 | 38.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `LOTUSEYE` | ₹109.22 | 52.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `360ONE` | ₹1107.40 | 62.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `IRFC` | ₹97.13 | 36.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `MANGALAM` | ₹30.76 | 52.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `COASTCORP` | ₹59.66 | 49.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `SEAMECLTD` | ₹1617.20 | 71.83 | **UP** | ₹1680.53 | ₹1448.15 | **₹1697.90** | NO | **WIN** |
| 96 | `PAR` | ₹84.94 | 31.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `OLAELEC` | ₹36.96 | 65.57 | **UP** | ₹38.21 | ₹33.12 | **₹38.40** | NO | **WIN** |
| 98 | `PRAKASH` | ₹147.57 | 69.82 | **UP** | ₹151.07 | ₹135.36 | **₹154.98** | NO | **WIN** |
| 99 | `SMSPHARMA` | ₹424.30 | 64.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `SHANKARA` | ₹125.20 | 53.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 5. Systems Validation & Verification Sign-Off

### Real Data Verification
* Backtest executed directly on real historical candles from Yahoo Finance.
* Realized target hit ratio reflects true historical execution margins rather than biased random walks.

### System Settings Used
* Short-Term SL Multiplier: **1.5 × ATR**, Target: **0.40–1.20 × ATR** (dynamic, conviction-scaled)
* Long-Term SL Multiplier: **2.0 × ATR**, Target: **0.40–1.20 × ATR** (dynamic, conviction-scaled)

**Audit Conducted by:** Antigravity AI Engine
**Verification Date:** 2026-05-27
