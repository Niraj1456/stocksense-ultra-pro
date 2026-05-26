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
| **Vetoed / Filtered Stocks** | 63 | 79 | — | — |
| **Active Trade Setups** | 37 | 21 | — | — |
| **Target Hit Ratio (Wins)** | 89.19% | 57.14% | >= 90.00% | **FAILED** ❌ |
| **Directional Accuracy** | 54.05% | 52.38% | >= 70.00% | **FAILED** ❌ |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction (Score >= 75)**: **0.00% Win Rate** (0/0 setups)
* **Moderate Conviction (45 <= Score < 75)**: **88.57% Win Rate** (31/35 setups)
* **Low/Short Conviction (Score < 45)**: **100.00% Win Rate** (2/2 setups)

---

## 3. Short-Term Intraday Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `GESHIP` | ₹1648.60 | 49.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 2 | `ELECON` | ₹547.40 | 64.65 | **UP** | ₹549.61 | ₹512.53 | **₹528.15** | NO | **TIMEOUT** |
| 3 | `ZODIACLOTH` | ₹76.40 | 55.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `BHEL` | ₹419.40 | 65.46 | **UP** | ₹420.52 | ₹399.03 | **₹418.05** | NO | **TIMEOUT** |
| 5 | `BLUECHIP` | ₹2.17 | 53.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `CHEMFAB` | ₹413.00 | 49.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `EKC` | ₹117.20 | 55.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `ONESOURCE` | ₹1806.80 | 48.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 9 | `REFEX` | ₹284.15 | 65.51 | **UP** | ₹285.47 | ₹263.77 | **₹307.35** | NO | **WIN** |
| 10 | `BSHSL` | ₹96.35 | 49.13 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 11 | `PCBL` | ₹294.25 | 55.52 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `OBEROIRLTY` | ₹1712.40 | 57.99 | **UP** | ₹1716.24 | ₹1639.61 | **₹1718.00** | NO | **WIN** |
| 13 | `OPTIEMUS` | ₹429.45 | 59.91 | **UP** | ₹430.72 | ₹402.60 | **₹438.20** | NO | **WIN** |
| 14 | `CAPITALSFB` | ₹278.65 | 56.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `EIFFL` | ₹239.87 | 51.5 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `FLAIR` | ₹299.05 | 48.5 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 17 | `BHAGERIA` | ₹154.52 | 49.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `ORCHPHARMA` | ₹715.35 | 62.63 | **UP** | ₹717.90 | ₹673.03 | **₹750.00** | NO | **WIN** |
| 19 | `CCL` | ₹1059.00 | 48.75 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `BSE` | ₹4291.20 | 68.03 | **UP** | ₹4301.31 | ₹4118.37 | **₹4368.10** | NO | **WIN** |
| 21 | `SILGO` | ₹79.25 | 63.51 | **UP** | ₹79.65 | ₹72.79 | **₹83.39** | NO | **WIN** |
| 22 | `EMAMILTD` | ₹404.05 | 39.02 | **DOWN** | ₹403.06 | ₹424.25 | **₹402.60** | NO | **WIN** |
| 23 | `SOTL` | ₹424.35 | 60.11 | **UP** | ₹425.59 | ₹398.43 | **₹433.00** | NO | **WIN** |
| 24 | `MAGADSUGAR` | ₹473.20 | 53.1 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `FMGOETZE` | ₹463.00 | 58.24 | **UP** | ₹464.45 | ₹435.81 | **₹432.70** | NO | **LOSS** |
| 26 | `SPECIALITY` | ₹113.35 | 58.29 | **UP** | ₹113.80 | ₹104.82 | **₹115.00** | NO | **WIN** |
| 27 | `NDL` | ₹2.66 | 56.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `SREEL` | ₹191.41 | 52.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `SIYSIL` | ₹601.70 | 51.49 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 30 | `STEELCITY` | ₹78.05 | 41.55 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `BIKAJI` | ₹640.50 | 48.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 32 | `HISARMETAL` | ₹150.71 | 49.97 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `SPIC` | ₹71.81 | 56.56 | **UP** | ₹72.03 | ₹67.37 | **₹74.22** | NO | **WIN** |
| 34 | `SRM` | ₹531.40 | 63.09 | **UP** | ₹533.68 | ₹493.96 | **₹568.45** | NO | **WIN** |
| 35 | `ELIN` | ₹120.78 | 51.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `SECMARK` | ₹125.26 | 49.83 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `LT` | ₹4033.40 | 57.27 | **UP** | ₹4040.07 | ₹3904.23 | **₹4052.90** | NO | **WIN** |
| 38 | `EIDPARRY` | ₹789.85 | 50.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `CARERATING` | ₹1687.60 | 48.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 40 | `RVHL` | ₹37.25 | 41.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `FINEORG` | ₹4557.80 | 56.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `SARLAPOLY` | ₹97.83 | 61.5 | **UP** | ₹98.15 | ₹92.33 | **₹99.00** | NO | **WIN** |
| 43 | `ELECTCAST` | ₹82.37 | 59.93 | **UP** | ₹82.72 | ₹76.10 | **₹84.47** | NO | **WIN** |
| 44 | `PHOENIXLTD` | ₹1809.60 | 57.33 | **UP** | ₹1813.02 | ₹1731.90 | **₹1819.30** | NO | **WIN** |
| 45 | `PGEL` | ₹471.25 | 49.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `BIGBLOC` | ₹55.42 | 50.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `BORANA` | ₹320.10 | 49.33 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `BSL` | ₹123.30 | 42.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `ENDURANCE` | ₹2801.20 | 62.34 | **UP** | ₹2809.73 | ₹2658.34 | **₹2811.50** | NO | **WIN** |
| 50 | `LLOYDSENGG` | ₹74.63 | 70.3 | **UP** | ₹74.99 | ₹69.65 | **₹78.00** | NO | **WIN** |
| 51 | `FDC` | ₹369.35 | 56.79 | **UP** | ₹370.31 | ₹350.39 | **₹414.90** | NO | **WIN** |
| 52 | `PIDILITIND` | ₹1477.20 | 61.17 | **UP** | ₹1479.74 | ₹1425.48 | **₹1483.00** | NO | **WIN** |
| 53 | `KEEPLEARN` | ₹2.09 | 47.93 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `FELDVR` | ₹2.57 | 42.65 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `SUMIT` | ₹44.86 | 50.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `CAPACITE` | ₹224.80 | 42.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `PGIL` | ₹1627.80 | 60.21 | **UP** | ₹1632.61 | ₹1527.32 | **₹1645.60** | NO | **WIN** |
| 58 | `BLUEDART` | ₹4886.00 | 37.82 | **DOWN** | ₹4875.78 | ₹5088.20 | **₹4865.50** | NO | **WIN** |
| 59 | `SAMBHV` | ₹107.42 | 52.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `SUNFLAG` | ₹388.45 | 64.38 | **UP** | ₹390.04 | ₹358.82 | **₹407.00** | NO | **WIN** |
| 61 | `STEL` | ₹468.10 | 51.8 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `SUPRAJIT` | ₹444.95 | 58.75 | **UP** | ₹445.98 | ₹425.85 | **₹507.00** | NO | **WIN** |
| 63 | `BSOFT` | ₹330.80 | 51.04 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `PCJEWELLER` | ₹8.92 | 51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `BIRLACABLE` | ₹167.52 | 55.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `SIL` | ₹16.35 | 63.2 | **UP** | ₹16.44 | ₹14.85 | **₹16.85** | NO | **WIN** |
| 67 | `CDSL` | ₹1217.40 | 51.47 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `EIHOTEL` | ₹321.05 | 49.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 69 | `LTFOODS` | ₹405.35 | 57.77 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `CALSOFT` | ₹20.38 | 50.11 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `ELGIEQUIP` | ₹567.90 | 58.2 | **UP** | ₹569.31 | ₹541.43 | **₹572.00** | NO | **WIN** |
| 72 | `SAFARI` | ₹1515.30 | 50.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `SBIN` | ₹969.60 | 50.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `PNC` | ₹19.09 | 49.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `PIXTRANS` | ₹1520.30 | 47.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `KNRCON` | ₹133.35 | 56.99 | **UP** | ₹133.67 | ₹125.95 | **₹134.37** | NO | **WIN** |
| 77 | `SILLYMONKS` | ₹17.01 | 51.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SWELECTES` | ₹611.30 | 47.89 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `EMMBI` | ₹84.76 | 47.86 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `CAMLINFINE` | ₹122.73 | 51.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `KNAGRI` | ₹191.82 | 53.01 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 82 | `SAILIFE` | ₹1175.90 | 59.66 | **UP** | ₹1179.94 | ₹1103.01 | **₹1147.60** | NO | **TIMEOUT** |
| 83 | `SMSPHARMA` | ₹369.15 | 48.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `SANSERA` | ₹2905.20 | 61.3 | **UP** | ₹2915.66 | ₹2725.12 | **₹2932.40** | NO | **WIN** |
| 85 | `NEXTMEDIA` | ₹4.10 | 49.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `BLACKBUCK` | ₹515.00 | 41.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `BELRISE` | ₹210.64 | 56.94 | **UP** | ₹211.23 | ₹199.02 | **₹223.50** | NO | **WIN** |
| 88 | `LOKESHMACH` | ₹260.08 | 55.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `DIAMINESQ` | ₹246.80 | 47.69 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `SAKHTISUG` | ₹17.96 | 56.74 | **UP** | ₹18.02 | ₹16.59 | **₹18.90** | NO | **WIN** |
| 91 | `RUPA` | ₹148.86 | 61 | **UP** | ₹149.27 | ₹140.45 | **₹155.99** | NO | **WIN** |
| 92 | `M&MFIN` | ₹308.55 | 41.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `SBC` | ₹38.83 | 61.28 | **UP** | ₹38.92 | ₹37.27 | **₹39.24** | NO | **WIN** |
| 94 | `DANGEE` | ₹3.29 | 56.98 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `SALASAR` | ₹7.16 | 50.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `PILANIINVS` | ₹4616.00 | 50.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `RVTH` | ₹799.45 | 66.39 | **UP** | ₹804.08 | ₹729.51 | **₹855.90** | NO | **WIN** |
| 98 | `SAKUMA` | ₹1.76 | 50.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `MMP` | ₹289.43 | 62.26 | **UP** | ₹290.76 | ₹267.06 | **₹294.00** | NO | **WIN** |
| 100 | `KEYFINSERV` | ₹271.90 | 50.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

---

## 4. Long-Term Horizon Verification Ledger (All 100 Stocks)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `GESHIP` | ₹1715.90 | 61.33 | **UP** | ₹1760.91 | ₹1561.04 | **₹1648.00** | NO | **TIMEOUT** |
| 2 | `ELECON` | ₹485.15 | 49.92 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 3 | `ZODIACLOTH` | ₹77.94 | 53.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 4 | `BHEL` | ₹401.10 | 57.89 | **UP** | ₹407.30 | ₹371.64 | **₹420.95** | NO | **WIN** |
| 5 | `BLUECHIP` | ₹2.01 | 52.15 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 6 | `CHEMFAB` | ₹409.85 | 49.61 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 7 | `EKC` | ₹114.73 | 48.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 8 | `ONESOURCE` | ₹1854.50 | 56.58 | **UP** | ₹1887.64 | ₹1690.51 | **₹1905.00** | NO | **WIN** |
| 9 | `REFEX` | ₹274.35 | 59.23 | **UP** | ₹282.52 | ₹244.53 | **₹307.35** | NO | **WIN** |
| 10 | `BSHSL` | ₹99.29 | 58.01 | **UP** | ₹101.78 | ₹89.88 | **₹97.00** | NO | **TIMEOUT** |
| 11 | `PCBL` | ₹273.55 | 48.04 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 12 | `OBEROIRLTY` | ₹1622.00 | 48.39 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 13 | `OPTIEMUS` | ₹415.05 | 49.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 14 | `CAPITALSFB` | ₹277.55 | 55.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 15 | `EIFFL` | ₹222.72 | 44.34 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 16 | `FLAIR` | ₹333.05 | 58.09 | **UP** | ₹337.84 | ₹310.45 | **₹310.45** | NO | **LOSS** |
| 17 | `BHAGERIA` | ₹151.87 | 46.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 18 | `ORCHPHARMA` | ₹735.85 | 58.13 | **UP** | ₹750.16 | ₹681.87 | **₹724.00** | NO | **TIMEOUT** |
| 19 | `CCL` | ₹1089.40 | 49.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 20 | `BSE` | ₹4190.80 | 62.55 | **UP** | ₹4262.50 | ₹3952.11 | **₹4368.10** | NO | **WIN** |
| 21 | `SILGO` | ₹78.23 | 59.53 | **UP** | ₹80.50 | ₹70.01 | **₹83.39** | NO | **WIN** |
| 22 | `EMAMILTD` | ₹435.05 | 50.43 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 23 | `SOTL` | ₹417.50 | 50.47 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 24 | `MAGADSUGAR` | ₹470.15 | 49.21 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 25 | `FMGOETZE` | ₹452.20 | 53.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 26 | `SPECIALITY` | ₹102.01 | 52.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 27 | `NDL` | ₹2.65 | 49.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 28 | `SREEL` | ₹189.45 | 50.84 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 29 | `SIYSIL` | ₹611.70 | 57.84 | **UP** | ₹624.27 | ₹563.85 | **₹592.00** | NO | **TIMEOUT** |
| 30 | `STEELCITY` | ₹78.94 | 46.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 31 | `BIKAJI` | ₹678.25 | 57.68 | **UP** | ₹686.76 | ₹637.56 | **₹637.56** | NO | **LOSS** |
| 32 | `HISARMETAL` | ₹148.08 | 45.95 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 33 | `SPIC` | ₹70.99 | 53.64 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 34 | `SRM` | ₹485.85 | 57.46 | **UP** | ₹496.86 | ₹432.84 | **₹568.45** | NO | **WIN** |
| 35 | `ELIN` | ₹121.59 | 52.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 36 | `SECMARK` | ₹125.98 | 49.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 37 | `LT` | ₹3921.00 | 54.35 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 38 | `EIDPARRY` | ₹790.55 | 46.2 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 39 | `CARERATING` | ₹1756.10 | 57.6 | **UP** | ₹1791.32 | ₹1621.06 | **₹1677.50** | NO | **TIMEOUT** |
| 40 | `RVHL` | ₹40.66 | 51.67 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 41 | `FINEORG` | ₹4567.20 | 49.47 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 42 | `SARLAPOLY` | ₹95.10 | 54.9 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 43 | `ELECTCAST` | ₹75.49 | 48.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 44 | `PHOENIXLTD` | ₹1721.80 | 47.38 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 45 | `PGEL` | ₹466.15 | 44.6 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 46 | `BIGBLOC` | ₹54.37 | 49.19 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 47 | `BORANA` | ₹321.15 | 43.88 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 48 | `BSL` | ₹123.25 | 42.29 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 49 | `ENDURANCE` | ₹2545.20 | 48.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 50 | `LLOYDSENGG` | ₹68.44 | 61.01 | **UP** | ₹69.98 | ₹61.76 | **₹78.00** | NO | **WIN** |
| 51 | `FDC` | ₹362.60 | 47.27 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 52 | `PIDILITIND` | ₹1455.80 | 58.29 | **UP** | ₹1471.26 | ₹1383.24 | **₹1508.40** | NO | **WIN** |
| 53 | `KEEPLEARN` | ₹2.18 | 53.51 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 54 | `FELDVR` | ₹2.66 | 41.91 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 55 | `SUMIT` | ₹43.80 | 44.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 56 | `CAPACITE` | ₹225.10 | 48.87 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 57 | `PGIL` | ₹1604.50 | 57.09 | **UP** | ₹1635.04 | ₹1455.78 | **₹1652.20** | NO | **WIN** |
| 58 | `BLUEDART` | ₹4911.00 | 39.99 | **DOWN** | ₹4842.26 | ₹5217.79 | **₹4830.00** | NO | **WIN** |
| 59 | `SAMBHV` | ₹109.97 | 47.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 60 | `SUNFLAG` | ₹358.55 | 50.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 61 | `STEL` | ₹438.70 | 45.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 62 | `SUPRAJIT` | ₹416.10 | 47.54 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 63 | `BSOFT` | ₹320.90 | 45.28 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 64 | `PCJEWELLER` | ₹8.09 | 41.7 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 65 | `BIRLACABLE` | ₹161.14 | 48.31 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 66 | `SIL` | ₹15.92 | 49.78 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 67 | `CDSL` | ₹1209.50 | 51.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 68 | `EIHOTEL` | ₹326.25 | 57.82 | **UP** | ₹331.43 | ₹306.53 | **₹321.00** | NO | **TIMEOUT** |
| 69 | `LTFOODS` | ₹411.65 | 55.66 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 70 | `CALSOFT` | ₹22.70 | 50.17 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 71 | `ELGIEQUIP` | ₹541.10 | 54.94 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 72 | `SAFARI` | ₹1426.90 | 46.62 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 73 | `SBIN` | ₹948.80 | 43.57 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 74 | `PNC` | ₹19.09 | 41.76 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 75 | `PIXTRANS` | ₹1531.90 | 53.56 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 76 | `KNRCON` | ₹126.76 | 43.59 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 77 | `SILLYMONKS` | ₹15.18 | 41.22 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 78 | `SWELECTES` | ₹622.35 | 48.12 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 79 | `EMMBI` | ₹83.38 | 52.23 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 80 | `CAMLINFINE` | ₹124.03 | 51.99 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 81 | `KNAGRI` | ₹198.96 | 59.56 | **UP** | ₹205.57 | ₹175.06 | **₹191.65** | NO | **TIMEOUT** |
| 82 | `SAILIFE` | ₹1125.40 | 55.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 83 | `SMSPHARMA` | ₹410.25 | 55.14 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 84 | `SANSERA` | ₹2396.50 | 53.44 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 85 | `NEXTMEDIA` | ₹4.02 | 43.96 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 86 | `BLACKBUCK` | ₹532.45 | 45.32 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 87 | `BELRISE` | ₹209.27 | 56.5 | **UP** | ₹212.24 | ₹194.54 | **₹223.50** | NO | **WIN** |
| 88 | `LOKESHMACH` | ₹243.21 | 47.85 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 89 | `DIAMINESQ` | ₹259.15 | 47.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 90 | `SAKHTISUG` | ₹17.69 | 48.41 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 91 | `RUPA` | ₹146.26 | 55.26 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 92 | `M&MFIN` | ₹319.65 | 46.53 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 93 | `SBC` | ₹34.04 | 49.72 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 94 | `DANGEE` | ₹3.17 | 49.09 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 95 | `SALASAR` | ₹6.96 | 43.37 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 96 | `PILANIINVS` | ₹4408.60 | 42.16 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 97 | `RVTH` | ₹669.40 | 50.3 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 98 | `SAKUMA` | ₹1.76 | 44.81 | **NEUTRAL** | — | — | **—** | NO | **N/A** |
| 99 | `MMP` | ₹276.92 | 59.07 | **UP** | ₹283.36 | ₹247.40 | **₹297.00** | NO | **WIN** |
| 100 | `KEYFINSERV` | ₹262.35 | 44.63 | **NEUTRAL** | — | — | **—** | NO | **N/A** |

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
