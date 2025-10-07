import z from "zod";

export const GRAIN = {
  day: 'day',
  week: 'week',
  month: 'month'
} as const;

export const INVOICE_STATUS = {
  paid: 'paid',
  refunded: 'refunded',
  void: 'void',
} as const;

export const grainEnumSchema = z.enum([GRAIN.day, GRAIN.week, GRAIN.month]);
export type Grain = z.input<typeof grainEnumSchema>;

// API Schemas
export const dateRangeParamsSchema = z.object({
  from: z.string().optional().default('2025-06-01'),
  to: z.string().optional().default('2025-10-01'),
  grain: grainEnumSchema.default(GRAIN.day)
});

export const revenueResponseSchema = z.array(z.object({
  bucket: z.string(),
  revenue_usd: z.coerce.number()  // Handles PG numeric type returned as string
}));
export type RevenueResponse = z.infer<typeof revenueResponseSchema>

export const subscriptionResponseSchema = z.array(z.object({
  bucket: z.string(),
  active_count: z.number()
}));

export type DateRangeParams = z.input<typeof dateRangeParamsSchema>;

export type Subscription = {
  started_at: string;
  canceled_at?: string | null;
};

export type Invoice = {
  period_start: string;
  amount_cents: number;
  status: keyof typeof INVOICE_STATUS
};
