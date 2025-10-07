import { describe, it, expect } from 'vitest';
import { getInvoicesFromDb, getRevenueWithCode, getRevenueWithSql } from './solutions';
import { GRAIN, INVOICE_STATUS } from '@shared/types';

describe('db', () => {
  it('revenue over time data should match snapshot', async () => {
    const data = await getRevenueWithSql({ from: '2025-06-01', to: '2025-10-01', grain: GRAIN.month })
    expect(data).toMatchInlineSnapshot(`
      [
        {
          "bucket": 2025-06-01T00:00:00.000Z,
          "revenue_usd": "20",
        },
        {
          "bucket": 2025-07-01T00:00:00.000Z,
          "revenue_usd": "75",
        },
        {
          "bucket": 2025-08-01T00:00:00.000Z,
          "revenue_usd": "100",
        },
      ]
    `)
  });

  it('should return all invoices', async () => {
    const data = await getInvoicesFromDb('2025-06-01', '2025-10-01');

    expect(data.length).toBe(14)
    expect(data[1]).toMatchInlineSnapshot(`
      {
        "amount_cents": 500,
        "period_start": 2025-07-01T00:00:00.000Z,
        "status": "paid",
      }
    `)
    expect(data[2]).toMatchInlineSnapshot(`
      {
        "amount_cents": 500,
        "period_start": 2025-08-01T00:00:00.000Z,
        "status": "paid",
      }
    `)
  })

  it('should parse invoice and aggregate revenue', () => {
    const invoices = [
      {
        "period_start": '2025-07-01T00:00:00.000Z',
        "amount_cents": 500,
        "status": INVOICE_STATUS.paid,
      },
      {
        "period_start": '2025-08-01T00:00:00.000Z',
        "amount_cents": 500,
        "status": INVOICE_STATUS.paid,
      }
    ]

    const data = getRevenueWithCode({invoices, from: '2025-07-01', to: '2025-09-01', grain: GRAIN.month})

    expect(data).toMatchInlineSnapshot(`
      [
        {
          "bucket": "2025-07-01",
          "revenue_usd": 5,
        },
        {
          "bucket": "2025-08-01",
          "revenue_usd": 5,
        },
      ]
    `)
  })
});
