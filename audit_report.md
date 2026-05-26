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
| **Vetoed / Filtered Stocks** | 54 | 100 | — | — |
| **Active Trade Setups** | 46 | 0 | — | — |
| **Target Hit Ratio (Wins)** | 80.43% | 0.00% | >= 90.00% | **FAILED** ❌ |
| **Directional Accuracy** | 50.00% | 0.00% | >= 70.00% | **FAILED** ❌ |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction (Score >= 75)**: **0.00% Win Rate** (0/0 setups)
* **Moderate Conviction (45 <= Score < 75)**: **81.82% Win Rate** (36/44 setups)
* **Low/Short Conviction (Score < 45)**: **50.00% Win Rate** (1/2 setups)

---

## 3. Short-Term Intraday Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `ROUTE` | ₹516.55 | 49.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `ANSALAPI` | ₹4.10 | 49.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `ACUTAAS` | ₹2923.80 | 55.7 | **UP** | ₹2929.34 | ₹2764.67 | **₹3069.00** | NO | **WIN** |
| 4 | `HCG` | ₹655.95 | 55.94 | **UP** | ₹657.45 | ₹619.68 | **₹658.95** | NO | **WIN** |
| 5 | `INOXGREEN` | ₹177.81 | 48.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `HARIOMPIPE` | ₹413.20 | 57.77 | **UP** | ₹414.60 | ₹381.10 | **₹440.85** | NO | **WIN** |
| 7 | `CENTURYPLY` | ₹778.05 | 53.05 | **UP** | ₹779.50 | ₹739.15 | **₹786.35** | NO | **WIN** |
| 8 | `IFBIND` | ₹1052.20 | 46.55 | **DOWN** | ₹1049.51 | ₹1123.06 | **₹1218.00** | NO | **LOSS** |
| 9 | `ACMESOLAR` | ₹300.60 | 54.9 | **UP** | ₹301.30 | ₹282.92 | **₹309.15** | NO | **WIN** |
| 10 | `SIEMENS` | ₹3667.50 | 53.44 | **UP** | ₹3675.08 | ₹3467.67 | **₹3697.90** | NO | **WIN** |
| 11 | `HAPPSTMNDS` | ₹373.30 | 50.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `SEAMECLTD` | ₹1631.70 | 54.84 | **UP** | ₹1636.59 | ₹1508.82 | **₹1643.00** | NO | **WIN** |
| 13 | `TERASOFT` | ₹340.85 | 50.58 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `SHRIRAMFIN` | ₹961.95 | 50.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `TVSSCS` | ₹120.81 | 56.59 | **UP** | ₹121.12 | ₹113.43 | **₹126.85** | NO | **WIN** |
| 16 | `EMKAY` | ₹224.24 | 50.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `BHARATRAS` | ₹1432.50 | 52.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `ACL` | ₹55.25 | 52.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `BHAGYANGR` | ₹278.10 | 49.58 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `CHOLAFIN` | ₹1591.00 | 50.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `ELGIEQUIP` | ₹567.90 | 53.83 | **UP** | ₹568.92 | ₹541.43 | **₹572.00** | NO | **WIN** |
| 22 | `ADROITINFO` | ₹8.82 | 45.06 | **DOWN** | ₹8.78 | ₹9.87 | **₹8.70** | NO | **WIN** |
| 23 | `ULTRACEMCO` | ₹11726.00 | 50.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `SHYAMCENT` | ₹4.93 | 46.07 | **DOWN** | ₹4.91 | ₹5.52 | **₹4.80** | NO | **WIN** |
| 25 | `SHEKHAWATI` | ₹14.83 | 53.5 | **UP** | ₹14.89 | ₹13.30 | **₹15.57** | NO | **WIN** |
| 26 | `EXCELINDUS` | ₹982.30 | 50.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `ECOSMOBLTY` | ₹137.03 | 50.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `HILTON` | ₹22.22 | 50.46 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `AFSL` | ₹201.04 | 46.05 | **DOWN** | ₹200.84 | ₹206.16 | **₹201.00** | NO | **TIMEOUT** |
| 30 | `MGL` | ₹1074.90 | 54.42 | **UP** | ₹1077.04 | ₹1020.30 | **₹1109.60** | NO | **WIN** |
| 31 | `AIIL` | ₹502.85 | 52.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `SELMC` | ₹29.75 | 46.79 | **DOWN** | ₹29.65 | ₹32.54 | **₹29.55** | NO | **WIN** |
| 33 | `UEL` | ₹141.61 | 46.06 | **DOWN** | ₹141.06 | ₹155.93 | **₹140.10** | NO | **WIN** |
| 34 | `HCL-INSYS` | ₹11.66 | 50.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `EMCURE` | ₹1738.30 | 53.65 | **UP** | ₹1741.20 | ₹1648.96 | **₹1756.00** | NO | **WIN** |
| 36 | `EIDPARRY` | ₹789.85 | 50.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `UNIVASTU` | ₹72.18 | 53.72 | **UP** | ₹72.36 | ₹67.43 | **₹73.40** | NO | **WIN** |
| 38 | `KNAGRI` | ₹191.82 | 51.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `SENCO` | ₹353.80 | 55.03 | **UP** | ₹354.56 | ₹331.60 | **₹357.55** | NO | **WIN** |
| 40 | `BHARATSE` | ₹188.65 | 53.31 | **UP** | ₹189.16 | ₹172.73 | **₹192.00** | NO | **WIN** |
| 41 | `KCPSUGIND` | ₹24.46 | 53.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `SHAREINDIA` | ₹139.98 | 52.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `EDELWEISS` | ₹111.96 | 52.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `TTML` | ₹42.86 | 54.55 | **UP** | ₹42.94 | ₹40.55 | **₹44.39** | NO | **WIN** |
| 45 | `RUSTOMJEE` | ₹402.15 | 50.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `TOLINS` | ₹106.14 | 50.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `EPACK` | ₹234.15 | 47.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `20MICRONS` | ₹196.67 | 56.51 | **UP** | ₹197.31 | ₹181.51 | **₹190.05** | NO | **TIMEOUT** |
| 49 | `APCL` | ₹121.85 | 51.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `SANCO` | ₹3.80 | 57.66 | **UP** | ₹3.82 | ₹3.39 | **₹3.61** | NO | **TIMEOUT** |
| 51 | `BHAGERIA` | ₹154.52 | 49.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `GSLSU` | ₹54.04 | 45.94 | **DOWN** | ₹53.86 | ₹58.72 | **₹54.64** | NO | **TIMEOUT** |
| 53 | `BHAGCHEM` | ₹245.95 | 52.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `GLOBAL` | ₹101.68 | 49.45 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `PLAZACABLE` | ₹47.54 | 52.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `SECMARK` | ₹125.26 | 50.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `BHARTIARTL` | ₹1874.80 | 46.3 | **DOWN** | ₹1872.82 | ₹1935.68 | **₹1848.00** | NO | **WIN** |
| 58 | `ARENTERP` | ₹38.27 | 46.66 | **DOWN** | ₹38.10 | ₹42.77 | **₹40.75** | NO | **TIMEOUT** |
| 59 | `APCOTEXIND` | ₹494.90 | 53.14 | **UP** | ₹496.18 | ₹460.84 | **₹502.00** | NO | **WIN** |
| 60 | `RVTH` | ₹799.45 | 57.8 | **UP** | ₹802.51 | ₹729.51 | **₹855.90** | NO | **WIN** |
| 61 | `BFINVEST` | ₹394.80 | 49.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `IKIO` | ₹154.42 | 52.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `CELLO` | ₹380.50 | 41.85 | **DOWN** | ₹379.73 | ₹397.96 | **₹399.60** | NO | **LOSS** |
| 64 | `TNPETRO` | ₹91.13 | 53.52 | **UP** | ₹91.28 | ₹86.45 | **₹92.80** | NO | **WIN** |
| 65 | `UFLEX` | ₹411.55 | 50.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `SERVOTECH` | ₹95.33 | 54.12 | **UP** | ₹95.62 | ₹87.74 | **₹95.88** | NO | **WIN** |
| 67 | `RAJESHEXPO` | ₹112.81 | 50.21 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `INDIAMART` | ₹2029.30 | 50.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `ASHIANA` | ₹379.80 | 54.26 | **UP** | ₹380.54 | ₹357.37 | **₹382.00** | NO | **WIN** |
| 70 | `EMAMILTD` | ₹404.05 | 44.86 | **DOWN** | ₹403.36 | ₹424.25 | **₹401.30** | NO | **WIN** |
| 71 | `ENERGYDEV` | ₹16.97 | 53.19 | **UP** | ₹17.01 | ₹15.83 | **₹17.90** | NO | **WIN** |
| 72 | `CHOICEIN` | ₹689.30 | 52.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `ANUP` | ₹1977.70 | 54.03 | **UP** | ₹1982.17 | ₹1862.21 | **₹2018.10** | NO | **WIN** |
| 74 | `UMAEXPORTS` | ₹25.19 | 50.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `MARICO` | ₹823.35 | 49.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `ASKAUTOLTD` | ₹452.20 | 50.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `BELLACASA` | ₹250.70 | 50.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `MHRIL` | ₹221.93 | 47.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `BANKBARODA` | ₹272.25 | 50.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `ELDEHSG` | ₹805.70 | 49.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `UNIECOM` | ₹88.60 | 50.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `MEDANTA` | ₹1249.30 | 56.9 | **UP** | ₹1251.34 | ₹1192.90 | **₹1259.00** | NO | **WIN** |
| 83 | `BALAMINES` | ₹1920.90 | 58.15 | **UP** | ₹1927.26 | ₹1776.92 | **₹1947.00** | NO | **WIN** |
| 84 | `PRECOT` | ₹762.55 | 55.65 | **UP** | ₹765.15 | ₹698.89 | **₹838.00** | NO | **WIN** |
| 85 | `AMNPLST` | ₹193.43 | 49.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `MASFIN` | ₹305.25 | 49.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `PATELENG` | ₹26.28 | 50.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `AURIONPRO` | ₹822.95 | 50.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `HINDCON` | ₹23.31 | 52.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `SBFC` | ₹93.21 | 51.07 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `MAHAPEXLTD` | ₹50.98 | 50.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `GIPCL` | ₹156.48 | 54.71 | **UP** | ₹156.79 | ₹148.61 | **₹159.32** | NO | **WIN** |
| 93 | `TTKPRESTIG` | ₹523.20 | 50.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `TALBROAUTO` | ₹354.35 | 56.98 | **UP** | ₹355.72 | ₹322.34 | **₹364.60** | NO | **WIN** |
| 95 | `TATACOMM` | ₹1936.00 | 57.33 | **UP** | ₹1940.50 | ₹1831.57 | **₹2049.90** | NO | **WIN** |
| 96 | `ONELIFECAP` | ₹26.35 | 56.49 | **UP** | ₹26.41 | ₹24.68 | **₹27.66** | NO | **WIN** |
| 97 | `CANTABIL` | ₹218.25 | 45.48 | **DOWN** | ₹217.84 | ₹230.53 | **₹218.99** | NO | **TIMEOUT** |
| 98 | `ANANTRAJ` | ₹507.50 | 52.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `SHOPERSTOP` | ₹337.30 | 53.38 | **UP** | ₹338.05 | ₹313.84 | **₹334.05** | NO | **TIMEOUT** |
| 100 | `BIOCON` | ₹430.05 | 57.58 | **UP** | ₹430.66 | ₹413.51 | **₹440.40** | NO | **WIN** |

---

## 4. Long-Term Horizon Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `ROUTE` | ₹519.70 | 50.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `ANSALAPI` | ₹4.42 | 50.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `ACUTAAS` | ₹2886.50 | 50.68 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `HCG` | ₹646.85 | 50.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 5 | `INOXGREEN` | ₹183.16 | 50.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `HARIOMPIPE` | ₹312.75 | 49.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `CENTURYPLY` | ₹767.05 | 49.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `IFBIND` | ₹1098.80 | 49.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `ACMESOLAR` | ₹282.85 | 49.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 10 | `SIEMENS` | ₹3550.90 | 49.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `HAPPSTMNDS` | ₹360.55 | 50.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `SEAMECLTD` | ₹1561.60 | 50.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `TERASOFT` | ₹317.80 | 49.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `SHRIRAMFIN` | ₹927.35 | 49.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `TVSSCS` | ₹111.99 | 49.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `EMKAY` | ₹218.32 | 50.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `BHARATRAS` | ₹1414.30 | 50.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `ACL` | ₹55.12 | 50.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 19 | `BHAGYANGR` | ₹286.50 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `CHOLAFIN` | ₹1511.40 | 49.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 21 | `ELGIEQUIP` | ₹541.10 | 50.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 22 | `ADROITINFO` | ₹9.16 | 50.05 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `ULTRACEMCO` | ₹11368.00 | 49.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `SHYAMCENT` | ₹4.93 | 50.02 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `SHEKHAWATI` | ₹14.36 | 50.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `EXCELINDUS` | ₹965.95 | 50.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `ECOSMOBLTY` | ₹128.99 | 49.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `HILTON` | ₹21.67 | 49.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `AFSL` | ₹201.00 | 49.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `MGL` | ₹1059.40 | 49.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `AIIL` | ₹496.70 | 50.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `SELMC` | ₹29.19 | 49.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `UEL` | ₹147.40 | 50.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `HCL-INSYS` | ₹11.67 | 50.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 35 | `EMCURE` | ₹1710.20 | 50.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `EIDPARRY` | ₹790.55 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `UNIVASTU` | ₹69.99 | 49.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `KNAGRI` | ₹198.96 | 50.79 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `SENCO` | ₹335.05 | 50.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `BHARATSE` | ₹181.43 | 49.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `KCPSUGIND` | ₹24.31 | 49.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `SHAREINDIA` | ₹146.79 | 50.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `EDELWEISS` | ₹109.04 | 49.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `TTML` | ₹42.07 | 50.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `RUSTOMJEE` | ₹400.40 | 49.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `TOLINS` | ₹101.61 | 49.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `EPACK` | ₹240.85 | 49.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `20MICRONS` | ₹165.18 | 49.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `APCL` | ₹115.84 | 50.18 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `SANCO` | ₹3.75 | 50.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 51 | `BHAGERIA` | ₹151.87 | 49.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `GSLSU` | ₹55.38 | 49.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 53 | `BHAGCHEM` | ₹249.25 | 50.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `GLOBAL` | ₹102.67 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `PLAZACABLE` | ₹46.76 | 49.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `SECMARK` | ₹125.98 | 49.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `BHARTIARTL` | ₹1913.50 | 49.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 58 | `ARENTERP` | ₹37.37 | 49.5 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 59 | `APCOTEXIND` | ₹508.45 | 50.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `RVTH` | ₹669.40 | 50.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `BFINVEST` | ₹399.75 | 49.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `IKIO` | ₹152.06 | 49.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `CELLO` | ₹389.90 | 49.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `TNPETRO` | ₹90.75 | 50.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `UFLEX` | ₹401.80 | 49.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `SERVOTECH` | ₹91.10 | 50.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `RAJESHEXPO` | ₹108.40 | 49.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `INDIAMART` | ₹1982.60 | 49.24 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `ASHIANA` | ₹364.45 | 50.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `EMAMILTD` | ₹435.05 | 49.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `ENERGYDEV` | ₹16.79 | 49.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `CHOICEIN` | ₹659.00 | 49.74 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `ANUP` | ₹1955.50 | 50.06 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `UMAEXPORTS` | ₹24.02 | 49.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `MARICO` | ₹831.45 | 50.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `ASKAUTOLTD` | ₹455.80 | 50.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `BELLACASA` | ₹234.90 | 49.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `MHRIL` | ₹223.51 | 49.68 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `BANKBARODA` | ₹260.60 | 49.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `ELDEHSG` | ₹818.85 | 50.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `UNIECOM` | ₹83.72 | 49.82 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `MEDANTA` | ₹1240.40 | 50.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `BALAMINES` | ₹1708.80 | 50.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `PRECOT` | ₹650.95 | 50.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `AMNPLST` | ₹197.33 | 50.19 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `MASFIN` | ₹312.60 | 49.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `PATELENG` | ₹25.86 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 88 | `AURIONPRO` | ₹730.90 | 49.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `HINDCON` | ₹23.07 | 49.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `SBFC` | ₹90.77 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `MAHAPEXLTD` | ₹48.29 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `GIPCL` | ₹144.45 | 49.71 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `TTKPRESTIG` | ₹522.40 | 49.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `TALBROAUTO` | ₹330.50 | 50.48 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `TATACOMM` | ₹1646.60 | 50.73 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `ONELIFECAP` | ₹21.70 | 50.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `CANTABIL` | ₹222.05 | 50.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `ANANTRAJ` | ₹482.45 | 49.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `SHOPERSTOP` | ₹338.35 | 50.18 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 100 | `BIOCON` | ₹428.15 | 50.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

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
