import { pool } from "./db";
import { GRAIN, INVOICE_STATUS, type Grain, type Invoice, type Subscription, type DateRangeParams } from "@shared/types";
import { truncateDate, generateSeries } from "./helpers";

// ============================================================================
// Strategy 1: Revenue aggregation (group-by)
// ============================================================================

export const getRevenueWithSql = async (params: DateRangeParams) => {
  const {
    from = '2025-06-01',
    to = '2025-10-01',
    grain = GRAIN.day,
  } = params

  const { rows } = await pool.query(`
    SELECT
      DATE_TRUNC($3, period_start) as bucket,
      SUM(amount_cents/100) as revenue_usd
    FROM invoices
    WHERE period_start >= $1 AND period_start < $2
      AND status = 'paid'
    GROUP BY bucket
    ORDER BY bucket
    `,
    [from, to, grain]
  );

  return rows;
}

export const getInvoicesFromDb = async (from: string, to: string) => {
  const { rows } = await pool.query(`
    SELECT
      period_start,
      amount_cents,
      status
    FROM invoices
    WHERE period_start >= $1 AND period_start < $2
    `,
    [from, to]
  );

  return rows as Invoice[];
}

export const getRevenueWithCode = ({
  invoices,
  from,
  to,
  grain
}: {
  invoices: Invoice[],
  from: string,
  to: string,
  grain: Grain
}) => {
  const bucketMap = new Map<string, number>();

  for (const invoice of invoices) {
    if (invoice.status !== INVOICE_STATUS.paid) continue;

    const periodStart = new Date(invoice.period_start);
    if (periodStart < new Date(from) || periodStart >= new Date(to)) continue;

    const bucket = truncateDate(periodStart, grain);
    const currentAmount = bucketMap.get(bucket) ?? 0;
    bucketMap.set(bucket, currentAmount + invoice.amount_cents);
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, cents]) => ({
      bucket,
      revenue_usd: cents / 100
    }));
}

// ============================================================================
// Strategy 2: Active subscriptions (interval containment with series + join)
// ============================================================================

export const getActiveSubscriptionsWithSql = async (params: DateRangeParams) => {
  const {
    from = '2025-06-01',
    to = '2025-10-01',
    grain = GRAIN.day,
  } = params

  const { rows } = await pool.query(`
    WITH
    series AS (
      SELECT generate_series(
        DATE_TRUNC($3, $1::timestamptz),
        DATE_TRUNC($3, $2::timestamptz),
        (CASE WHEN $3='day' THEN '1 day'
              WHEN $3='week' THEN '1 week'
              ELSE '1 month' END)::interval
      ) AS bucket
    ),
    active AS (
      SELECT
        s.bucket,
        COUNT(*)::int AS active_count
      FROM series s
      JOIN subscriptions sub
        ON sub.started_at <= s.bucket
       AND (sub.canceled_at IS NULL OR sub.canceled_at > s.bucket)
      GROUP BY s.bucket
    )
    SELECT
      bucket::date,
      active_count
    FROM active
    ORDER BY bucket
    `,
    [from, to, grain]
  );

  return rows;
}

export const getActiveSubscriptionsWithCode = ({
  subscriptions,
  from,
  to,
  grain
}: {
  subscriptions: Subscription[],
  from: string,
  to: string,
  grain: Grain
}) => {
  const series = generateSeries(
    truncateDate(new Date(from), grain),
    truncateDate(new Date(to), grain),
    grain
  );

  return series.map(bucket => {
    const bucketDate = new Date(bucket);

    const activeCount = subscriptions.filter(sub => {
      const started = new Date(sub.started_at);
      const canceled = sub.canceled_at ? new Date(sub.canceled_at) : null;

      return started <= bucketDate && (!canceled || canceled > bucketDate);
    }).length;

    return {
      bucket,
      active_count: activeCount
    };
  });
}

// ============================================================================
// Strategy 3: Subscriptions over time (delta + window function)
// ============================================================================

export const getSubscriptionsWithSql = async (params: DateRangeParams) => {
  const {
    from = '2025-06-01',
    to = '2025-10-01',
    grain = GRAIN.day,
  } = params

  const { rows } = await pool.query(`
    WITH
    deltas AS (
      SELECT
        DATE_TRUNC($3, started_at) AS bucket,
        +1 AS delta
      FROM subscriptions
      WHERE started_at < $2

      UNION ALL

      SELECT
        DATE_TRUNC($3, canceled_at) AS bucket,
        -1 AS delta
      FROM subscriptions
      WHERE canceled_at IS NOT NULL
        AND canceled_at >= $1
    ),
    per_bucket AS (
      SELECT
        bucket,
        SUM(delta) AS day_delta
      FROM deltas
      GROUP BY bucket
    ),
    series AS (
      SELECT generate_series(
        DATE_TRUNC($3, $1::timestamptz),
        DATE_TRUNC($3, $2::timestamptz),
        (CASE WHEN $3='day' THEN '1 day'
              WHEN $3='week' THEN '1 week'
              ELSE '1 month' END)::interval
      ) AS bucket
    ),
    joined AS (
      SELECT
        s.bucket,
        COALESCE(p.day_delta, 0) AS day_delta
      FROM series s
      LEFT JOIN per_bucket p ON s.bucket = p.bucket
    )
    SELECT
      bucket::date,
      SUM(day_delta) OVER (ORDER BY bucket ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS active_count
    FROM joined
    ORDER BY bucket
    `,
    [from, to, grain]
  );

  return rows;
}

export const getSubscriptionsWithCode = ({
  subscriptions,
  from,
  to,
  grain
}: {
  subscriptions: Subscription[],
  from: string,
  to: string,
  grain: Grain
}) => {
  const deltaMap = new Map<string, number>();

  for (const sub of subscriptions) {
    // Add +1 for starts before toDate
    if (new Date(sub.started_at) < new Date(to)) {
      const bucket = truncateDate(new Date(sub.started_at), grain);
      deltaMap.set(bucket, (deltaMap.get(bucket) ?? 0) + 1);
    }

    // Add -1 for cancellations at or after fromDate
    if (sub.canceled_at && new Date(sub.canceled_at) >= new Date(from)) {
      const bucket = truncateDate(new Date(sub.canceled_at), grain);
      deltaMap.set(bucket, (deltaMap.get(bucket) ?? 0) - 1);
    }
  }

  const series = generateSeries(
    truncateDate(new Date(from), grain),
    truncateDate(new Date(to), grain),
    grain
  );

  let runningTotal = 0;

  return series.map(bucket => {
    const delta = deltaMap.get(bucket) ?? 0;
    runningTotal += delta;

    return {
      bucket,
      active_count: runningTotal
    };
  });
}

// ============================================================================
// Shared helper (used by both subscription strategies)
// ============================================================================

export const getSubscriptionsFromDb = async (from: string, to: string) => {
  const { rows } = await pool.query(`
    SELECT
      started_at,
      canceled_at
    FROM subscriptions
    WHERE started_at < $2
      AND (canceled_at IS NULL OR canceled_at >= $1)
    `,
    [from, to]
  );

  return rows as Subscription[];
}