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
    SHARPE_EPSILON: 0.001,

    // ═══════════════════════════════════════════════════════════════
    // SELF-LEARNING UPGRADE CONSTANTS
    // ═══════════════════════════════════════════════════════════════

    // EWMA decay factor for temporal DCA weighting (halflife ≈ 23 trades)
    EWMA_LAMBDA: 0.97,

    // KL-Divergence alert thresholds for weight drift detection
    KL_DIVERGENCE_MODERATE: 0.05,
    KL_DIVERGENCE_SEVERE: 0.15,

    // BOCD default hazard rate (1 changepoint per ~200 trades)
    BOCD_HAZARD_RATE: 0.005,

    // Sortino ratio downside deviation floor (prevents division by zero)
    SORTINO_EPSILON: 0.001,

    // Smooth WFE sigmoid parameters: 1 / (1 + exp(-k * (wfe - midpoint)))
    WFE_SIGMOID_K: 12,
    WFE_SIGMOID_MIDPOINT: 0.55,

    // Oracle Confidence Multiplier bounds
    ORACLE_MULTIPLIER_MIN: 0.5,
    ORACLE_MULTIPLIER_MAX: 1.3,

    // Layer correlation redundancy threshold (only penalize ρ > this)
    CORRELATION_REDUNDANCY_THRESHOLD: 0.65,
    // Damping factor for correlation redundancy penalty
    CORRELATION_DAMPING_ALPHA: 0.15
};
