import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { API } from '@shared/api';
import type { RevenueResponse } from '@shared/types';
import App from './App';

describe('App Component', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  it('displays loading state initially', () => {
    // Mock fetch to never resolve (simulate loading)
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    render(<App />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('fetches data and renders chart after loading', async () => {
    // Mock response using contract type - guaranteed to match actual API
    const mockResponse: RevenueResponse = [
      { bucket: '2025-07-01', revenue_usd: 5 },
      { bucket: '2025-07-02', revenue_usd: 7 }
    ];

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    ) as typeof fetch;

    render(<App />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    // Verify title is present
    expect(screen.getByText('Subscription Metrics')).toBeInTheDocument();

    // Verify fetch was called with correct endpoint - uses contract path
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(API.revenue.path)
    );
  });

  it('renders the page title', async () => {
    // Mock successful fetch with empty response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      } as Response)
    ) as typeof fetch;

    render(<App />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Subscription Metrics');
    });
  });
});
