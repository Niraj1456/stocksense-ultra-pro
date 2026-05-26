/**
 * Shared Mathematical Constants for StockSense Ultra Pro 26-Layer Engine
 * 
 * These constants prevent division-by-zero and numerical instability
 * across the scoring pipeline. All layer modules MUST import from here
 * rather than defining local epsilon values.
 */
module.exports = {
    // Used for financial ratios with large denominators (L20 Accruals Ratio)
    ACCRUALS_EPSILON: 0.0001,
    // Used for volatility denominators to prevent numerical instability (L26 Sharpe Ratio)
    SHARPE_EPSILON: 0.001
};
