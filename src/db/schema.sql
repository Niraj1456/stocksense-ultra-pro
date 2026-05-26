-- ==========================================
-- STOCKSENSE ULTRA PRO — ORIGINAL TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS price_history (
  symbol TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  interval TEXT NOT NULL,
  o DOUBLE PRECISION,
  h DOUBLE PRECISION,
  l DOUBLE PRECISION,
  c DOUBLE PRECISION,
  v DOUBLE PRECISION,
  source TEXT NOT NULL,
  isin CHAR(12),
  PRIMARY KEY (symbol, ts, interval, source)
);

CREATE TABLE IF NOT EXISTS options_history (
  symbol TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  expiry DATE,
  strike DOUBLE PRECISION,
  option_type TEXT,
  oi DOUBLE PRECISION,
  iv DOUBLE PRECISION,
  ltp DOUBLE PRECISION,
  source TEXT NOT NULL,
  PRIMARY KEY (symbol, ts, strike, option_type, source)
);

CREATE TABLE IF NOT EXISTS fundamentals (
  symbol TEXT NOT NULL,
  period TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  json JSONB NOT NULL,
  PRIMARY KEY (symbol, period, ts, source)
);

CREATE TABLE IF NOT EXISTS scores (
  symbol TEXT NOT NULL,
  mode TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  verdict TEXT,
  total_score DOUBLE PRECISION,
  layer_scores_json JSONB NOT NULL,
  PRIMARY KEY (symbol, mode, ts)
);

CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  entry_ts TIMESTAMPTZ,
  entry_price DOUBLE PRECISION,
  size DOUBLE PRECISION,
  sl DOUBLE PRECISION,
  target DOUBLE PRECISION,
  exit_ts TIMESTAMPTZ,
  exit_price DOUBLE PRECISION,
  mae DOUBLE PRECISION,
  json JSONB,
  mode TEXT,
  applied_weights_log_id INTEGER
);

CREATE TABLE IF NOT EXISTS volume_profile (
  symbol TEXT NOT NULL,
  session TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  poc DOUBLE PRECISION,
  vah DOUBLE PRECISION,
  val DOUBLE PRECISION,
  nodes_json JSONB,
  PRIMARY KEY (symbol, session, ts)
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'open',
  payload_json JSONB
);

-- ==========================================
-- 26-LAYER ENGINE UPGRADE SCHEMA ADDITIONS
-- ==========================================

-- 1. System Config Table (Manual Override, Trade Thresholds, Calibration Jitter & Job TTL limits)
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO system_config (key, value) VALUES ('weight_calibration_enabled', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l25_min_trades', '130') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l26_min_trades', '130') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l25_calibration_min_new_trades', '10') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l25_calibration_min_hours', '48') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l25_dirichlet_multiplier', '10') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l25_dirichlet_multiplier_L19', '20') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l25_dirichlet_multiplier_L20', '20') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l16_rs_ratings_ttl_hours', '26') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l16_peer_metrics_ttl_hours', '72') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l19_bulk_deal_alert_threshold_pct', '0.5') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_rsRatingJob_ttl_hours', '26') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_peerDataJob_ttl_hours', '26') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_bseBulkDealsJob_ttl_hours', '26') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_weightCalibrationJob_ttl_hours', '52') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_bsePledgeScraper_ttl_hours', '192') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_corporateActionsSyncJob_ttl_hours', '26') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_partitionMaintenanceJob_ttl_hours', '744') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('job_overrideExpiryJob_ttl_hours', '2') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l26_single_window_stale_days_intraday', '45') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l26_single_window_stale_days_investment', '120') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l11_model_version', '1.0.0') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('l11_model_trained_at', '2026-05-25') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('engine_upgrade_date', '2026-05-25') ON CONFLICT (key) DO NOTHING;

-- 2. Upgraded Promoter Pledge Cache Table
CREATE TABLE IF NOT EXISTS promoter_pledge (
    isin CHAR(12) PRIMARY KEY,
    symbol VARCHAR(30) NOT NULL,
    promoter_holding_pct NUMERIC(5,2) NOT NULL,
    pledged_shares_pct NUMERIC(5,2) NOT NULL,
    pledge_velocity_qoq NUMERIC(5,2) DEFAULT 0.00,
    bulk_deal_alert BOOLEAN DEFAULT FALSE,
    bulk_deal_alert_set_at TIMESTAMP DEFAULT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_promoter_pledge_symbol ON promoter_pledge(symbol);
CREATE INDEX IF NOT EXISTS idx_promoter_pledge_updated ON promoter_pledge(last_updated_at);

-- 3. RS Ratings Point-in-Time Partitioned Cache Table
CREATE TABLE IF NOT EXISTS rs_ratings (
    symbol VARCHAR(30) NOT NULL,
    snapshot_date DATE NOT NULL,
    weighted_performance NUMERIC(8,4) NOT NULL,
    rs_percentile INTEGER NOT NULL,
    is_confirmed_uptrend BOOLEAN DEFAULT FALSE,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, snapshot_date)
) PARTITION BY RANGE (snapshot_date);

CREATE INDEX IF NOT EXISTS idx_rs_ratings_pit ON rs_ratings(snapshot_date, symbol);
CREATE INDEX IF NOT EXISTS idx_rs_ratings_percentile ON rs_ratings(rs_percentile);
CREATE INDEX IF NOT EXISTS idx_rs_ratings_updated ON rs_ratings(last_updated_at);

-- Example Partition Allocations for RS Ratings
CREATE TABLE IF NOT EXISTS rs_ratings_2025 PARTITION OF rs_ratings
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS rs_ratings_2026 PARTITION OF rs_ratings
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- 4. Peer Metrics Point-in-Time Partitioned Cache Table
CREATE TABLE IF NOT EXISTS peer_metrics (
    symbol VARCHAR(30) NOT NULL,
    snapshot_date DATE NOT NULL,
    sector VARCHAR(50) NOT NULL,
    roe NUMERIC(8,4),
    roce NUMERIC(8,4),
    debt_to_equity NUMERIC(8,4),
    revenue_growth_yoy NUMERIC(8,4),
    operating_margin NUMERIC(8,4),
    fcf_yield NUMERIC(8,4),
    peer_score NUMERIC(5,2) NOT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, snapshot_date)
) PARTITION BY RANGE (snapshot_date);

CREATE INDEX IF NOT EXISTS idx_peer_metrics_pit ON peer_metrics(snapshot_date, symbol);
CREATE INDEX IF NOT EXISTS idx_peer_metrics_sector ON peer_metrics(sector);
CREATE INDEX IF NOT EXISTS idx_peer_metrics_updated ON peer_metrics(last_updated_at);

-- Example Partition Allocations for Peer Metrics
CREATE TABLE IF NOT EXISTS peer_metrics_2025 PARTITION OF peer_metrics
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS peer_metrics_2026 PARTITION OF peer_metrics
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- 5. Weight Calibration Log Table
CREATE TABLE IF NOT EXISTS weight_calibration_log (
    id SERIAL PRIMARY KEY,
    calibrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mode VARCHAR(20) NOT NULL,
    regime VARCHAR(25) NOT NULL,
    lambda_value NUMERIC(4,2) NOT NULL,
    wfe_score NUMERIC(5,2) NOT NULL,
    calibrated_weights JSONB NOT NULL,
    ceiling_hit_streak JSONB DEFAULT '{}' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_weight_calibration_mode_reg ON weight_calibration_log(mode, regime);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_active_weight_per_regime') THEN
        CREATE UNIQUE INDEX idx_one_active_weight_per_regime
        ON weight_calibration_log(mode, regime)
        WHERE is_active = TRUE;
    END IF;
END $$;

-- Add FK constraint for trades.applied_weights_log_id if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_trades_weights_log'
    ) THEN
        ALTER TABLE trades
        ADD CONSTRAINT fk_trades_weights_log
        FOREIGN KEY (applied_weights_log_id) REFERENCES weight_calibration_log(id);
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 6. Historical Listing Universe Registry (Survivorship Bias Elimination)
CREATE TABLE IF NOT EXISTS universe_registry (
    isin CHAR(12) NOT NULL,
    symbol VARCHAR(30) NOT NULL,
    listed_at DATE NOT NULL,
    delisted_at DATE DEFAULT NULL,
    previous_symbols JSONB DEFAULT '[]',
    PRIMARY KEY (isin, listed_at)
);
CREATE INDEX IF NOT EXISTS idx_universe_registry_dates ON universe_registry(listed_at, delisted_at);
CREATE INDEX IF NOT EXISTS idx_universe_registry_symbol ON universe_registry(symbol);
COMMENT ON COLUMN universe_registry.previous_symbols IS 'Array of {symbol, valid_until} objects tracking historical ticker renames for this ISIN';

-- 7. Price Adjustment Log Table
CREATE TABLE IF NOT EXISTS price_adjustment_log (
    id SERIAL PRIMARY KEY,
    isin CHAR(12) NOT NULL,
    symbol VARCHAR(30) NOT NULL,
    ex_date DATE NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    adjustment_factor NUMERIC(10,6) NOT NULL,
    rows_adjusted INTEGER,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_price_adjustment_isin ON price_adjustment_log(isin);

-- 8. Corporate Actions Table
CREATE TABLE IF NOT EXISTS corporate_actions (
    id SERIAL PRIMARY KEY,
    isin CHAR(12) NOT NULL,
    symbol VARCHAR(30) NOT NULL,
    ex_date DATE NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_corporate_action UNIQUE (isin, ex_date, action_type)
);
CREATE INDEX IF NOT EXISTS idx_corporate_actions_isin_ex ON corporate_actions(isin, ex_date);

-- 9. Jobs Registry Table
CREATE TABLE IF NOT EXISTS jobs (
    job_name VARCHAR(50) PRIMARY KEY,
    last_success TIMESTAMP,
    last_attempt TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'OK',
    error_message TEXT
);
INSERT INTO jobs (job_name) VALUES ('rsRatingJob') ON CONFLICT (job_name) DO NOTHING;
INSERT INTO jobs (job_name) VALUES ('peerDataJob') ON CONFLICT (job_name) DO NOTHING;
INSERT INTO jobs (job_name) VALUES ('weightCalibrationJob') ON CONFLICT (job_name) DO NOTHING;
INSERT INTO jobs (job_name) VALUES ('bsePledgeScraper') ON CONFLICT (job_name) DO NOTHING;
INSERT INTO jobs (job_name) VALUES ('bseBulkDealsJob') ON CONFLICT (job_name) DO NOTHING;
INSERT INTO jobs (job_name) VALUES ('corporateActionsSyncJob') ON CONFLICT (job_name) DO NOTHING;
INSERT INTO jobs (job_name) VALUES ('partitionMaintenanceJob') ON CONFLICT (job_name) DO NOTHING;
INSERT INTO jobs (job_name) VALUES ('overrideExpiryJob') ON CONFLICT (job_name) DO NOTHING;

-- ==========================================
-- STORED PROCEDURES
-- ==========================================

-- 10. Stored Procedure: Reset Weights to Static baseline
CREATE OR REPLACE PROCEDURE reset_weights_to_static()
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE weight_calibration_log
  SET is_active = FALSE
  WHERE is_active = TRUE;
  
  UPDATE system_config
  SET value = 'false', updated_at = NOW()
  WHERE key = 'weight_calibration_enabled';
  
  INSERT INTO system_config (key, value)
  VALUES ('weight_reset_timestamp', NOW()::TEXT)
  ON CONFLICT (key) DO UPDATE
  SET value = NOW()::TEXT, updated_at = NOW();
END;
$$;

-- 11. Stored Procedure: Re-enable weight calibration
CREATE OR REPLACE PROCEDURE reenable_weight_calibration()
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE system_config
  SET value = 'true', updated_at = NOW()
  WHERE key = 'weight_calibration_enabled';
  
  DELETE FROM system_config
  WHERE key = 'weight_reset_timestamp';
END;
$$;

-- 12. Stored Procedure: Atomic Weight Rotation
CREATE OR REPLACE PROCEDURE rotate_active_weights(
    p_mode VARCHAR(20),
    p_regime VARCHAR(25),
    p_lambda NUMERIC(4,2),
    p_wfe NUMERIC(5,2),
    p_weights JSONB,
    p_ceiling_hit_streak JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_lock_key BIGINT;
BEGIN
    v_lock_key := CASE 
        WHEN p_mode = 'INTRADAY' AND p_regime = 'LOW_VIX' THEN 26001
        WHEN p_mode = 'INTRADAY' AND p_regime = 'HIGH_VIX' THEN 26002
        WHEN p_mode = 'INVESTMENT' AND p_regime = 'LOW_VIX' THEN 26003
        WHEN p_mode = 'INVESTMENT' AND p_regime = 'HIGH_VIX' THEN 26004
        ELSE 26000
    END;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    WITH deactivate AS (
        UPDATE weight_calibration_log
        SET is_active = FALSE
        WHERE mode = p_mode AND regime = p_regime AND is_active = TRUE
        RETURNING id
    )
    INSERT INTO weight_calibration_log 
        (mode, regime, lambda_value, wfe_score, calibrated_weights, ceiling_hit_streak, is_active)
    VALUES 
        (p_mode, p_regime, p_lambda, p_wfe, p_weights, p_ceiling_hit_streak, TRUE);
END;
$$;
