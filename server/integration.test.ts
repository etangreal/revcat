import { describe, it, expect, beforeAll } from 'vitest';
import { API } from '@shared/api';

const BASE_URL = 'http://localhost:3000';

const testEndpoint = async (contract: typeof API.revenue | typeof API.activeSubscriptions | typeof API.subscriptions) => {
  const response = await fetch(`${BASE_URL}${contract.path}?grain=month`);

  expect(response.status).toBe(200);

  const data = await response.json();
  const validated = contract.responseSchema.parse(data);

  expect(Array.isArray(validated)).toBe(true);
  expect(validated.length).toBeGreaterThan(0);
};

describe('api Integration Tests', () => {
  beforeAll(() => {
    // TODO: Ensure server is running and database is initialized
  });

  it('revenue endpoint matches contract', () => testEndpoint(API.revenue));

  it('active-subscriptions endpoint matches contract', () => testEndpoint(API.activeSubscriptions));

  it('subscriptions endpoint matches contract', () => testEndpoint(API.subscriptions));
});
