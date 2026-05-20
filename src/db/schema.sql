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
  json JSONB
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

