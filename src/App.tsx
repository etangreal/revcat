
import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { GRAIN, type Grain } from '@shared/types';
import { API, createApiClient } from '@shared/api';

type DateValuePoint = {
  date: string;
  value: string | number;
};

type Metric = 'revenue' | 'active-subscriptions' | 'subscriptions';
type Implementation = 'sql' | 'code';

// Map metric + implementation to API contracts
const apiMapper = {
  revenue: {
    sql: API.revenue,
    code: API.revenueCode
  },
  'active-subscriptions': {
    sql: API.activeSubscriptions,
    code: API.activeSubscriptionsCode
  },
  subscriptions: {
    sql: API.subscriptions,
    code: API.subscriptionsCode
  }
};

const useFetchMetric = (metric: Metric, implementation: Implementation, grain: Grain) => {
  const [data, setData] = useState<DateValuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const api = apiMapper[metric][implementation];

    createApiClient(api)({ grain })
      .then((rawData) => {
        // Transform backend shape to chart shape
        const transformed = rawData.map(d => ({
          date: d.bucket,
          value: 'revenue_usd' in d ? d.revenue_usd : d.active_count
        }));
        setData(transformed);
      })
      .catch((err: Error) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [metric, implementation, grain]);

  return { data, loading, error };
};

export default function App() {
  const [metric, setMetric] = useState<Metric>('revenue');
  const [implementation, setImplementation] = useState<Implementation>('sql');
  const [grain, setGrain] = useState<Grain>(GRAIN.day);
  const { data, loading, error } = useFetchMetric(metric, implementation, grain);

  const xAxis = useCallback((tickItem: string, index: number, ticks: string[] = []) => {
    const date = new Date(tickItem);
    const isFirst = index === 0;
    const isLast = index === ticks.length - 1;

    if (grain === 'day') {
      // For daily: show month/day, with year on first and last
      if (isFirst || isLast) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (grain === 'week') {
      // For weekly: show month/day, with year on first and last
      if (isFirst || isLast) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      // For monthly: show month with year
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  }, [grain]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error}</p>

  const metricLabel = metric === 'revenue'
    ? 'Revenue (USD)'
    : 'Active Subscriptions';

  // Get title from API contract
  const title = apiMapper[metric][implementation].title;

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: '20px' }}>{title}</h1>

      <div style={{ marginBottom: 20, display: 'flex', gap: 16 }}>
        <label>
          Metric:{' '}
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="revenue">Revenue</option>
            <option value="active-subscriptions">Active Subscriptions (Interval)</option>
            <option value="subscriptions">Active Subscriptions (Delta)</option>
          </select>
        </label>

        <label>
          Implementation:{' '}
          <select value={implementation} onChange={(e) => setImplementation(e.target.value as Implementation)}>
            <option value="sql">SQL</option>
            <option value="code">TypeScript</option>
          </select>
        </label>

        <label>
          Grain:{' '}
          <select value={grain} onChange={(e) => setGrain(e.target.value as Grain)}>
            {Object.values(GRAIN).map(g => (
              <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
            ))}
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={xAxis}
            interval="preserveStartEnd"
          />
          <YAxis dataKey="value" />
          <Tooltip
            labelFormatter={(label) =>
              new Date(label).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            }
            formatter={(value) => [value, metricLabel]}
          />
          <Line type="monotone" dataKey="value" dot={false} stroke="#8884d8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
