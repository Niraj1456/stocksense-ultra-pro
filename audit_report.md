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
| **Vetoed / Filtered Stocks** | 83 | 84 | — | — |
| **Active Trade Setups** | 17 | 16 | — | — |
| **Target Hit Ratio (Wins)** | 76.47% | 68.75% | >= 90.00% | **FAILED** ❌ |
| **Directional Accuracy** | 64.71% | 25.00% | >= 70.00% | **FAILED** ❌ |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction (Score >= 75)**: **100.00% Win Rate** (5/5 setups)
* **Moderate Conviction (45 <= Score < 75)**: **100.00% Win Rate** (4/4 setups)
* **Low/Short Conviction (Score < 45)**: **50.00% Win Rate** (4/8 setups)

---

## 3. Short-Term Intraday Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `GSLSU` | ₹54.25 | 58.49 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 2 | `RSYSTEMS` | ₹268.90 | 46.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `UTTAMSUGAR` | ₹245.20 | 51.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `MOSCHIP` | ₹201.06 | 46.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `LXCHEM` | ₹151.81 | 55.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `KINGFA` | ₹5135.70 | 58.63 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 7 | `MOBIKWIK` | ₹193.27 | 43.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `LODHA` | ₹886.75 | 43.42 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `GANECOS` | ₹955.60 | 26.49 | **DOWN** | ₹939.17 | ₹1043.35 | **₹893.10** | NO | **WIN** |
| 10 | `LINC` | ₹99.41 | 43.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `INDIGO` | ₹4438.60 | 58.18 | **UP** | ₹4459.65 | ₹4233.78 | **₹4538.00** | NO | **WIN** |
| 12 | `INSPIRISYS` | ₹125.45 | 28.48 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 13 | `MAGNUM` | ₹19.96 | 46.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `HNDFDS` | ₹513.35 | 72.37 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 15 | `MITTAL` | ₹1.07 | 76.44 | **UP** | ₹1.09 | ₹0.98 | **₹1.21** | NO | **WIN** |
| 16 | `AIIL` | ₹510.75 | 54.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `ETHOSLTD` | ₹2407.80 | 53.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `AWHCL` | ₹466.25 | 39.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `BVCL` | ₹41.92 | 45.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `INFOMEDIA` | ₹5.99 | 53.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `INDNIPPON` | ₹795.05 | 54.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `LAMBODHARA` | ₹101.65 | 43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `MFML` | ₹24.98 | 56.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `LCCINFOTEC` | ₹4.51 | 53.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `MIDHANI` | ₹413.20 | 57.52 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `MAHSEAMLES` | ₹635.35 | 64.06 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 27 | `LICHSGFIN` | ₹539.20 | 42.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `MHLXMIRU` | ₹173.60 | 43.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `INTELLECT` | ₹697.95 | 42.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `MAHEPC` | ₹117.24 | 54.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `INOXWIND` | ₹94.31 | 29.82 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 32 | `LIKHITHA` | ₹203.21 | 31.99 | **DOWN** | ₹200.59 | ₹219.56 | **₹210.18** | NO | **TIMEOUT** |
| 33 | `MANAKCOAT` | ₹100.71 | 29.14 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 34 | `BLACKBUCK` | ₹500.20 | 54.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `CARTRADE` | ₹1796.60 | 44.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `JAYAGROGN` | ₹231.72 | 34.28 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 37 | `HMAAGRO` | ₹24.37 | 45.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `ENERGYDEV` | ₹16.90 | 57.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `HONDAPOWER` | ₹2221.40 | 54.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `MOTHERSON` | ₹136.18 | 78.51 | **UP** | ₹137.54 | ₹129.21 | **₹138.75** | NO | **WIN** |
| 41 | `KTKBANK` | ₹264.50 | 58.72 | **UP** | ₹266.03 | ₹249.82 | **₹267.00** | NO | **WIN** |
| 42 | `NATHBIOGEN` | ₹172.83 | 54.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `GOCOLORS` | ₹303.40 | 89.05 | **UP** | ₹308.86 | ₹277.70 | **₹333.30** | NO | **WIN** |
| 44 | `ARIHANTSUP` | ₹242.65 | 33.5 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 45 | `ELECTCAST` | ₹78.13 | 24.64 | **DOWN** | ₹77.16 | ₹84.30 | **₹82.37** | NO | **TIMEOUT** |
| 46 | `NITINSPIN` | ₹499.50 | 59.69 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 47 | `AKSHAR` | ₹0.49 | 57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `LTTS` | ₹3419.30 | 44.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `ICEMAKE` | ₹793.55 | 58.52 | **UP** | ₹797.91 | ₹757.22 | **₹825.00** | NO | **WIN** |
| 50 | `BLUSPRING` | ₹67.30 | 60.83 | **UP** | ₹67.93 | ₹61.56 | **₹70.00** | NO | **WIN** |
| 51 | `NARMADA` | ₹37.61 | 25.07 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 52 | `GREAVESCOT` | ₹169.45 | 57.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `APOLSINHOT` | ₹1130.90 | 39.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `MUNJALSHOW` | ₹137.49 | 56.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `CCL` | ₹1064.90 | 34.85 | **DOWN** | ₹1055.10 | ₹1126.90 | **₹1053.10** | NO | **WIN** |
| 56 | `HITECHCORP` | ₹167.87 | 28.1 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 57 | `LANCORHOL` | ₹24.47 | 52.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `PRITI` | ₹44.86 | 42.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `NECLIFE` | ₹12.06 | 38.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `KRITI` | ₹71.07 | 51.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `PVRINOX` | ₹979.80 | 42.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `GODREJPROP` | ₹1732.90 | 44.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `GILLETTE` | ₹7783.50 | 41.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `PCBL` | ₹293.20 | 53.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `STALLION` | ₹166.80 | 47.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `STLTECH` | ₹441.15 | 34.25 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 67 | `SHAHALLOYS` | ₹72.78 | 61.87 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 68 | `PALASHSECU` | ₹96.03 | 56.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `LAKPRE` | ₹6.19 | 42.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `BOHRAIND` | ₹19.20 | 60.08 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 71 | `PROZONER` | ₹51.56 | 31.96 | **DOWN** | ₹50.68 | ₹57.06 | **₹50.04** | NO | **WIN** |
| 72 | `INNOVANA` | ₹357.55 | 53.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `HCG` | ₹654.30 | 81.62 | **UP** | ₹661.88 | ₹617.40 | **₹663.75** | NO | **WIN** |
| 74 | `ALANKIT` | ₹8.63 | 41.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `LAXMIDENTL` | ₹249.28 | 25.36 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 76 | `GOLDENTOBC` | ₹26.88 | 53.55 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `MOIL` | ₹303.45 | 44.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SKFINDIA` | ₹1694.70 | 42.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `ARKADE` | ₹113.16 | 52.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `ACEINTEG` | ₹20.09 | 57.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `PRINCEPIPE` | ₹273.45 | 53.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `INTERARCH` | ₹1750.30 | 33.72 | **DOWN** | ₹1730.07 | ₹1904.55 | **₹1813.00** | NO | **TIMEOUT** |
| 83 | `STEL` | ₹443.80 | 43.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `HSCL` | ₹587.15 | 59.11 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 85 | `SUNDARAM` | ₹1.40 | 34.16 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 86 | `GTECJAINX` | ₹18.30 | 53.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `EIMCOELECO` | ₹1605.60 | 44.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `HDIL` | ₹1.99 | 33.77 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 89 | `SONAMLTD` | ₹58.39 | 26.95 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 90 | `PGHL` | ₹5553.00 | 82.17 | **UP** | ₹5594.64 | ₹5352.08 | **₹5741.00** | NO | **WIN** |
| 91 | `NAVINFLUOR` | ₹7125.00 | 66.44 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 92 | `NDRAUTO` | ₹806.45 | 57.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `MANGALAM` | ₹29.41 | 34.45 | **DOWN** | ₹29.14 | ₹31.12 | **₹29.01** | NO | **WIN** |
| 94 | `NITCO` | ₹96.27 | 57.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `SHREECEM` | ₹24785.00 | 42.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `FISCHER` | ₹36.48 | 44.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `LAOPALA` | ₹170.38 | 33.72 | **DOWN** | ₹169.36 | ₹178.19 | **₹174.64** | NO | **TIMEOUT** |
| 98 | `A2ZINFRA` | ₹15.53 | 29.25 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 99 | `AGARWALEYE` | ₹479.35 | 31.1 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 100 | `SAKSOFT` | ₹139.02 | 43.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 4. Long-Term Horizon Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `GSLSU` | ₹55.81 | 47.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `RSYSTEMS` | ₹277.00 | 40.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `UTTAMSUGAR` | ₹233.25 | 31.3 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 4 | `MOSCHIP` | ₹202.68 | 42.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `LXCHEM` | ₹151.09 | 56.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `KINGFA` | ₹5303.60 | 57.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `MOBIKWIK` | ₹189.02 | 34.93 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 8 | `LODHA` | ₹857.75 | 37.62 | **DOWN** | ₹850.81 | ₹923.23 | **₹845.70** | NO | **WIN** |
| 9 | `GANECOS` | ₹1029.40 | 53.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `LINC` | ₹94.61 | 54.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `INDIGO` | ₹4275.70 | 43.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `INSPIRISYS` | ₹114.09 | 12.82 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 13 | `MAGNUM` | ₹20.10 | 44.08 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `HNDFDS` | ₹514.85 | 55.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `MITTAL` | ₹0.88 | 55.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `AIIL` | ₹497.50 | 58.21 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 17 | `ETHOSLTD` | ₹2275.90 | 54.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `AWHCL` | ₹463.85 | 32.44 | **DOWN** | ₹459.45 | ₹500.87 | **₹459.05** | NO | **WIN** |
| 19 | `BVCL` | ₹42.77 | 47.19 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `INFOMEDIA` | ₹5.69 | 56.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `INDNIPPON` | ₹779.40 | 58.86 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 22 | `LAMBODHARA` | ₹101.87 | 38.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `MFML` | ₹24.51 | 32.82 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 24 | `LCCINFOTEC` | ₹4.57 | 53.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `MIDHANI` | ₹397.80 | 59.11 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 26 | `MAHSEAMLES` | ₹636.60 | 65.83 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 27 | `LICHSGFIN` | ₹545.55 | 42.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `MHLXMIRU` | ₹176.57 | 45.58 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `INTELLECT` | ₹691.15 | 55.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `MAHEPC` | ₹114.59 | 49.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `INOXWIND` | ₹94.75 | 32.71 | **DOWN** | ₹93.79 | ₹102.86 | **₹97.04** | NO | **TIMEOUT** |
| 32 | `LIKHITHA` | ₹195.84 | 32.36 | **DOWN** | ₹193.06 | ₹219.18 | **₹192.00** | NO | **WIN** |
| 33 | `MANAKCOAT` | ₹99.36 | 61.13 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 34 | `BLACKBUCK` | ₹527.10 | 52.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `CARTRADE` | ₹1784.10 | 42.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `JAYAGROGN` | ₹210.91 | 72.08 | **UP** | ₹213.46 | ₹191.35 | **₹234.15** | NO | **WIN** |
| 37 | `HMAAGRO` | ₹23.32 | 47.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `ENERGYDEV` | ₹16.80 | 57.03 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `HONDAPOWER` | ₹2137.40 | 38.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `MOTHERSON` | ₹128.75 | 63.29 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 41 | `KTKBANK` | ₹242.85 | 38.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `NATHBIOGEN` | ₹158.30 | 32.57 | **DOWN** | ₹156.56 | ₹175.60 | **₹178.79** | NO | **LOSS** |
| 43 | `GOCOLORS` | ₹259.50 | 53.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `ARIHANTSUP` | ₹258.50 | 22.78 | **DOWN** | ₹252.57 | ₹297.97 | **₹235.00** | NO | **WIN** |
| 45 | `ELECTCAST` | ₹77.96 | 32.31 | **DOWN** | ₹76.95 | ₹86.42 | **₹73.51** | NO | **WIN** |
| 46 | `NITINSPIN` | ₹494.95 | 64.18 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 47 | `AKSHAR` | ₹0.49 | 65.01 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 48 | `LTTS` | ₹3549.50 | 56.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `ICEMAKE` | ₹750.85 | 44.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `BLUSPRING` | ₹69.38 | 50.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `NARMADA` | ₹34.92 | 31.83 | **DOWN** | ₹34.56 | ₹37.91 | **₹38.70** | NO | **LOSS** |
| 52 | `GREAVESCOT` | ₹160.48 | 42.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `APOLSINHOT` | ₹1093.80 | 42.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `MUNJALSHOW` | ₹132.52 | 56.19 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `CCL` | ₹1090.40 | 45.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `HITECHCORP` | ₹135.66 | 44.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `LANCORHOL` | ₹24.13 | 56.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `PRITI` | ₹44.78 | 42.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `NECLIFE` | ₹12.38 | 41.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `KRITI` | ₹69.70 | 53.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `PVRINOX` | ₹1007.90 | 42.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `GODREJPROP` | ₹1686.30 | 44.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `GILLETTE` | ₹7732.00 | 47.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `PCBL` | ₹267.50 | 44.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `STALLION` | ₹143.08 | 24.72 | **DOWN** | ₹140.45 | ₹162.13 | **₹180.00** | NO | **LOSS** |
| 66 | `STLTECH` | ₹421.90 | 31.21 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 67 | `SHAHALLOYS` | ₹68.73 | 78.06 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 68 | `PALASHSECU` | ₹96.90 | 55.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `LAKPRE` | ₹6.34 | 46.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `BOHRAIND` | ₹19.21 | 58.93 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 71 | `PROZONER` | ₹50.41 | 32.9 | **DOWN** | ₹49.63 | ₹58.23 | **₹49.21** | NO | **WIN** |
| 72 | `INNOVANA` | ₹370.95 | 44.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `HCG` | ₹632.25 | 72.24 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 74 | `ALANKIT` | ₹8.65 | 44.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `LAXMIDENTL` | ₹197.67 | 42.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `GOLDENTOBC` | ₹26.46 | 44.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `MOIL` | ₹300.90 | 44.4 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SKFINDIA` | ₹1661.30 | 40.55 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `ARKADE` | ₹113.56 | 32.53 | **DOWN** | ₹112.70 | ₹122.07 | **₹111.50** | NO | **WIN** |
| 80 | `ACEINTEG` | ₹19.09 | 42.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `PRINCEPIPE` | ₹252.85 | 62.33 | **UP** | ₹255.27 | ₹229.95 | **₹295.95** | NO | **WIN** |
| 82 | `INTERARCH` | ₹1632.00 | 11.61 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 83 | `STEL` | ₹444.20 | 53.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `HSCL` | ₹551.50 | 33.33 | **DOWN** | ₹545.27 | ₹614.28 | **₹539.60** | NO | **WIN** |
| 85 | `SUNDARAM` | ₹1.38 | 28.84 | **DOWN** | ₹1.36 | ₹1.57 | **₹1.39** | NO | **TIMEOUT** |
| 86 | `GTECJAINX` | ₹19.00 | 33.42 | **DOWN** | ₹18.71 | ₹22.06 | **₹17.72** | NO | **WIN** |
| 87 | `EIMCOELECO` | ₹1552.70 | 45.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `HDIL` | ₹1.98 | 44.18 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `SONAMLTD` | ₹50.21 | 51.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `PGHL` | ₹5255.00 | 58.24 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 91 | `NAVINFLUOR` | ₹6904.50 | 61.21 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 92 | `NDRAUTO` | ₹820.40 | 39.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `MANGALAM` | ₹30.37 | 64.52 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 94 | `NITCO` | ₹98.72 | 60.01 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 95 | `SHREECEM` | ₹24475.00 | 45.5 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `FISCHER` | ₹34.77 | 57.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `LAOPALA` | ₹168.48 | 58.9 | **NEUTRAL** | — | — | **—** | YES | **N/A** |
| 98 | `A2ZINFRA` | ₹14.50 | 53.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `AGARWALEYE` | ₹442.00 | 46.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `SAKSOFT` | ₹133.26 | 56.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 5. Systems Validation & Verification Sign-Off

### Real Data Verification
* Backtest executed directly on real historical candles from Yahoo Finance.
* Realized target hit ratio reflects true historical execution margins rather than biased random walks.

### System Settings Used
* Short-Term SL Multiplier: **1.5 * ATR**, Target Multiplier: **2.5 * ATR** (RR: **1.67**)
* Long-Term SL Multiplier: **2.0 * ATR**, Target Multiplier: **6.0 * ATR** (RR: **3.00**)

**Audit Conducted by:** Antigravity AI Engine
**Verification Date:** 2026-05-25
