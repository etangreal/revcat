# 🧩 Data Insights Demo
React + Express + Postgres demo showcasing how to query, aggregate, and visualize subscription data — inspired by real analytics use-cases (e.g., active users and revenue over time).

# ⚙️ Stack
	•	Frontend: React + Vite + TypeScript + Recharts
	•	Backend: Express + Node + tsx
	•	Database: Postgres (Docker)

# 🚀 Quickstart
## 1️⃣ Start Postgres
```bash
pnpm db:up
```

## 2️⃣ Install dependencies 
```bash
pnpm i
```

## 3️⃣ Run both server + client with live-reload
```bash
pnpm dev
```
- Frontend: http://localhost:5000
- Backend: http://localhost:3000

## Optional helpers
| Command | Description |
|---------|-------------|
| `pnpm db:logs` | Follow DB logs |
| `pnpm db:reset` | Wipe & recreate DB |
| `pnpm typecheck:frontend` | Type-check frontend |
| `pnpm typecheck:server` | Type-check backend |
| `pnpm typecheck` | Type-check both frontend & backend |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest |
| `pnpm build` | Type-check & build client for production |
| `pnpm preview` | Serve built client |

# 📊 API Endpoints

All endpoints accept optional query parameters:
- `from` - Start date (default: `2025-06-01`)
- `to` - End date (default: `2025-10-01`)
- `grain` - Time bucket: `day`, `week`, or `month` (default: `day`)

### SQL-based (computed in database)
```
GET /api/revenue?from=2025-07-01&to=2025-10-01&grain=month
GET /api/active-subscriptions?grain=week
GET /api/subscriptions?grain=month
```

### Code-based (computed in application)
```
GET /api/revenue/code?from=2025-07-01&to=2025-10-01&grain=month
GET /api/active-subscriptions/code?grain=week
GET /api/subscriptions/code?grain=month
```

# 🧠 Highlights

### Three SQL strategies for time-series metrics:
1. Group-by aggregation (revenue)
2. Interval containment (active subs)
3. Delta + window function (scalable active counts)

### Code organization (server/solutions.ts):
Each strategy is co-located with both SQL and TypeScript implementations:

**Strategy 1: Revenue**
- `getRevenueWithSql` - SQL aggregation approach
- `getInvoicesFromDb` - Helper to fetch raw invoices
- `getRevenueWithCode` - TypeScript aggregation

**Strategy 2: Active Subscriptions**
- `getActiveSubscriptionsWithSql` - SQL interval containment with series + join
- `getActiveSubscriptionsWithCode` - TypeScript interval containment

**Strategy 3: Subscriptions Delta**
- `getSubscriptionsWithSql` - SQL delta events + window function
- `getSubscriptionsWithCode` - TypeScript delta + running total

**Shared Helper**
- `getSubscriptionsFromDb` - Fetches raw subscriptions (used by strategies 2 & 3)

### Type-safe API contracts (shared/api.ts):
Single source of truth for all API endpoints, inspired by tRPC and Next.js:
- **Contract definitions**: Path, title, params schema, response schema
- **Frontend**: `createApiClient()` - Type-safe fetch with runtime validation
- **Backend**: `createApiHandler()` - Type-safe handler with automatic validation
- **Automatic type inference**: Using `z.input` and `z.infer` from Zod schemas
- **Zero duplication**: Add one endpoint → types flow everywhere

### Testing:
- **Unit tests** (`server/unit.test.ts`): Test individual functions with sample data
- **Integration tests** (`server/integration.test.ts`): Validate actual API responses against contracts
- **Frontend tests** (`src/App.test.tsx`): Component rendering and data fetching

### Additional features:
- Type-safe enums for grain and invoice status
- PostgreSQL functions for each SQL strategy
- Performance indexes for query optimization

# 🖼️ Frontend
Interactive dashboard with Recharts line chart:
- **Metric selector**: Toggle between revenue, active subscriptions (interval), and active subscriptions (delta)
- **Implementation toggle**: Compare SQL vs TypeScript implementations side-by-side
- **Grain selector**: View data by day, week, or month
- **Dynamic title**: Updates based on selected metric and implementation
- **Smart x-axis**: Adjusts formatting based on grain (month+year for monthly, month+day for daily/weekly)

# 🧰 Useful environment variables
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revcat
PORT=3000
```