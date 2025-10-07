-- Users (one row per end-user)
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products (subscription plans or SKUs)
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INT NOT NULL
);

-- Subscriptions (logical subscription per user+product)
CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  started_at TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ,                     -- null if active
  UNIQUE (user_id, product_id, started_at)
);

-- Invoices/renewals (financial events)
CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  amount_cents INT NOT NULL,  -- positive; refunds appear as separate negative rows
  status TEXT NOT NULL CHECK (status IN ('paid','refunded','void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON invoices (period_start);
CREATE INDEX ON invoices (subscription_id, period_start);
CREATE INDEX ON subscriptions (user_id, product_id);
CREATE INDEX ON subscriptions (started_at);
CREATE INDEX ON users (created_at);

INSERT INTO users (id, country, created_at) VALUES
  (1, 'US', '2025-06-01'),
  (2, 'DE', '2025-06-10'),
  (3, 'FR', '2025-07-01'),
  (4, 'IN', '2025-07-15'),
  (5, 'US', '2025-08-01');

INSERT INTO products (id, name, price_cents) VALUES
  (1, 'Basic Plan', 500),   -- $5.00
  (2, 'Pro Plan', 1500),    -- $15.00
  (3, 'Enterprise Plan', 5000); -- $50.00

INSERT INTO subscriptions (id, user_id, product_id, started_at, canceled_at) VALUES
    (1, 1, 1, '2025-06-01', NULL),                 -- active Basic
    (2, 2, 2, '2025-06-15', '2025-08-15'),         -- cancelled Pro
    (3, 3, 1, '2025-07-01', NULL),                 -- active Basic
    (4, 4, 3, '2025-07-20', NULL),                 -- active Enterprise
    (5, 5, 2, '2025-08-01', NULL);                 -- active Pro

INSERT INTO invoices (subscription_id, period_start, period_end, amount_cents, status, created_at) VALUES
    -- User 1: Basic Plan
    (1, '2025-06-01', '2025-07-01', 500, 'paid', '2025-06-01'),
    (1, '2025-07-01', '2025-08-01', 500, 'paid', '2025-07-01'),
    (1, '2025-08-01', '2025-09-01', 500, 'paid', '2025-08-01'),

    -- User 2: Pro Plan (cancelled after 2 months)
    (2, '2025-06-15', '2025-07-15', 1500, 'paid', '2025-06-15'),
    (2, '2025-07-15', '2025-08-15', 1500, 'paid', '2025-07-15'),

    -- User 3: Basic Plan
    (3, '2025-07-01', '2025-08-01', 500, 'paid', '2025-07-01'),
    (3, '2025-08-01', '2025-09-01', 500, 'paid', '2025-08-01'),

    -- User 4: Enterprise Plan
    (4, '2025-07-20', '2025-08-20', 5000, 'paid', '2025-07-20'),

    -- User 5: Pro Plan
    (5, '2025-08-01', '2025-09-01', 1500, 'paid', '2025-08-01');

INSERT INTO users (id, country, created_at) VALUES
  (6, 'BR', '2025-08-05'),   -- new user Brazil
  (7, 'US', '2025-08-10');   -- churn/upgrade scenario

INSERT INTO subscriptions (id, user_id, product_id, started_at, canceled_at) VALUES
  (6, 6, 1, '2025-08-05', '2025-08-20'),          -- churned quickly
  (7, 7, 1, '2025-08-10', '2025-08-20'),          -- started Basic, upgraded
  (8, 7, 2, '2025-08-20', NULL);                  -- upgrade to Pro

INSERT INTO invoices (subscription_id, period_start, period_end, amount_cents, status, created_at) VALUES
  -- User 4: Enterprise
  (4, '2025-08-20', '2025-09-20', 5000, 'paid', '2025-08-20'),

  -- User 6: Basic (churn, refund scenario)
  (6, '2025-08-05', '2025-09-05', 500, 'paid', '2025-08-05'),
  (6, '2025-08-10', '2025-09-05', -500, 'refunded', '2025-08-10'), -- refunded mid-cycle

  -- User 7: Upgrade case
  (7, '2025-08-10', '2025-09-10', 500, 'paid', '2025-08-10'),      -- Basic
  (7, '2025-08-20', '2025-09-20', 1500, 'paid', '2025-08-20');     -- Upgraded to Pro

-- Strategy A — Aggregating invoices directly (straight group-by)
-- Use when you want revenue over time.
CREATE OR REPLACE FUNCTION revenue_over_time(
  from_date DATE,
  to_date DATE,
  grain TEXT DEFAULT 'day'
)
RETURNS TABLE(bucket DATE, revenue_usd NUMERIC) AS $$
BEGIN
  RETURN QUERY WITH

  bucketed AS (
    SELECT
      DATE_TRUNC(grain, period_start) AS bucket,
      SUM(amount_cents) AS revenue_cents
    FROM invoices
    WHERE period_start >= from_date
      AND period_start < to_date
      AND status = 'paid'
    GROUP BY 1
  )

  SELECT
    bucketed.bucket::date AS bucket,
    (bucketed.revenue_cents/100.0) AS revenue_usd
  FROM bucketed
  ORDER BY bucketed.bucket;
END;
$$ LANGUAGE plpgsql;

-- Strategy B — Active subscriptions via date series + join (interval containment)
-- Use when you want active paid subscriptions count over time.
CREATE OR REPLACE FUNCTION active_subscriptions_over_time(
  from_date DATE,
  to_date DATE,
  grain TEXT DEFAULT 'day'
)
RETURNS TABLE(bucket DATE, active_count INT) AS $$
BEGIN
  RETURN QUERY WITH

  series AS (
    SELECT generate_series(
      DATE_TRUNC(grain, from_date::timestamptz),
      DATE_TRUNC(grain, to_date::timestamptz),
      (CASE WHEN grain='day'  THEN '1 day'
            WHEN grain='week' THEN '1 week'
                              ELSE '1 month'
      END)::interval
    ) AS bucket
  )

  SELECT
    s.bucket::date,
    COUNT(*)::int AS active_count
  FROM series s
  JOIN subscriptions sub
    ON sub.started_at <= s.bucket
    AND (sub.canceled_at IS NULL OR sub.canceled_at > s.bucket)
  GROUP BY s.bucket
  ORDER BY s.bucket;
END;
$$ LANGUAGE plpgsql;

-- Strategy C — Delta events + windowed running sum (scales better)
-- Convert intervals to deltas: +1 at started_at, -1 at canceled_at (if present). Then prefix-sum.
-- Use for active counts with large ranges.
CREATE OR REPLACE FUNCTION subscriptions_over_time(
  from_date DATE,
  to_date DATE,
  grain TEXT DEFAULT 'day'
)
RETURNS TABLE(
  bucket DATE,
  active_count BIGINT
) AS $$
BEGIN
  RETURN QUERY WITH

  deltas AS (
    SELECT
      DATE_TRUNC(grain, started_at) AS bucket$,
      +1 AS delta
    FROM subscriptions
    WHERE started_at < to_date

    UNION ALL

    SELECT
      DATE_TRUNC(grain, canceled_at) AS bucket$,
      -1 AS delta
    FROM subscriptions
    WHERE canceled_at IS NOT NULL
      AND canceled_at >= from_date
  ),

  per_bucket AS (
    SELECT
      bucket$,
      SUM(delta) AS day_delta
    FROM deltas
    GROUP BY 1
  ),

  series AS (
    SELECT generate_series(
      DATE_TRUNC(grain, from_date::timestamptz),
      DATE_TRUNC(grain, to_date::timestamptz),
      (CASE WHEN grain='day'  THEN '1 day'
            WHEN grain='week' THEN '1 week'
                              ELSE '1 month'
      END)::interval
    ) AS bucket$
  ),

  joined AS (
    SELECT
      s.bucket$,
      COALESCE(p.day_delta, 0) AS day_delta
    FROM series s
    LEFT JOIN per_bucket p ON s.bucket$ = p.bucket$
  )

  SELECT
    joined.bucket$::date,
    SUM(joined.day_delta) OVER (ORDER BY joined.bucket$ ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::BIGINT
  FROM joined
  ORDER BY joined.bucket$;
END;
$$ LANGUAGE plpgsql;

-- Additional performance indices (in addition to teh already created basic indices)
-- The following optimize the three query strategies:

-- For Strategy B (active_subscriptions_over_time): filters on canceled_at IS NULL OR canceled_at > bucket
CREATE INDEX ON subscriptions (canceled_at);

-- For Strategy B: composite index for interval containment checks
CREATE INDEX ON subscriptions (started_at, canceled_at);

-- For Strategy A (revenue_over_time): filters by status = 'paid' and range on period_start
CREATE INDEX ON invoices (status, period_start);

-- For potential future period_end queries
CREATE INDEX ON invoices (period_end);
