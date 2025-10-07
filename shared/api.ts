import { z } from 'zod';
import type { Request, Response } from 'express';
import {
  dateRangeParamsSchema,
  revenueResponseSchema,
  subscriptionResponseSchema
} from './types';

export const API = {
  revenue: {
    path: '/api/revenue',
    title: 'Revenue',
    paramsSchema: dateRangeParamsSchema,
    responseSchema: revenueResponseSchema
  },
  revenueCode: {
    path: '/api/revenue/code',
    title: 'Revenue w/ Code',
    paramsSchema: dateRangeParamsSchema,
    responseSchema: revenueResponseSchema
  },
  activeSubscriptions: {
    path: '/api/active-subscriptions',
    title: 'Active Subscriptions (Interval)',
    paramsSchema: dateRangeParamsSchema,
    responseSchema: subscriptionResponseSchema
  },
  activeSubscriptionsCode: {
    path: '/api/active-subscriptions/code',
    title: 'Active Subscriptions (Interval) w/ Code',
    paramsSchema: dateRangeParamsSchema,
    responseSchema: subscriptionResponseSchema
  },
  subscriptions: {
    path: '/api/subscriptions',
    title: 'Active Subscriptions (Delta)',
    paramsSchema: dateRangeParamsSchema,
    responseSchema: subscriptionResponseSchema
  },
  subscriptionsCode: {
    path: '/api/subscriptions/code',
    title: 'Active Subscriptions (Delta) w/ Code',
    paramsSchema: dateRangeParamsSchema,
    responseSchema: subscriptionResponseSchema
  }
} as const;

// Derive union type from all API contracts
type ApiContracts = typeof API[keyof typeof API];

// Frontend: Type-safe API client factory
export const createApiClient = (contract: ApiContracts) => {
  return async (params?: z.input<typeof contract.paramsSchema>): Promise<z.infer<typeof contract.responseSchema>> => {
    // Parse and validate params (uses defaults if not provided)
    const validated = contract.paramsSchema.parse(params || {}) as Record<string, unknown>;

    // Build query string
    const queryEntries = Object.entries(validated).map(([k, v]) => [k, String(v)]);
    const query = new URLSearchParams(queryEntries as [string, string][]).toString();

    const url = `${contract.path}?${query}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Runtime validation of response
    return contract.responseSchema.parse(data);
  };
};

// Backend: Type-safe handler factory
export const createApiHandler = (
  contract: ApiContracts,
  handler: (params: z.output<typeof contract.paramsSchema>) => Promise<z.infer<typeof contract.responseSchema>>
) => {
  return async (req: Request, res: Response) => {
    try {
      // Parse and validate query parameters
      const params = contract.paramsSchema.parse(req.query);

      // Execute handler with validated params
      const result = await handler(params);

      // Response validation happens at runtime if needed
      return res.json(result);
    } catch (error) {
      console.error('API handler error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid parameters',
          details: error.issues
        });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};
