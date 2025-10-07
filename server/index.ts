import express from "express";
import * as s from "./solutions";
import { API, createApiHandler } from "@shared/api";

const app = express();
const port = 3000;

// Strategy 1: Revenue aggregation (group-by)
app.get(API.revenue.path, createApiHandler(API.revenue, s.getRevenueWithSql));
app.get(API.revenueCode.path, createApiHandler(API.revenueCode, async (params) => {
  const invoices = await s.getInvoicesFromDb(params.from, params.to);
  return s.getRevenueWithCode({
    invoices,
    from: params.from,
    to: params.to,
    grain: params.grain
  });
}));

// Strategy 2: Active subscriptions (interval containment)
app.get(API.activeSubscriptions.path, createApiHandler(API.activeSubscriptions, s.getActiveSubscriptionsWithSql));
app.get(API.activeSubscriptionsCode.path, createApiHandler(API.activeSubscriptionsCode, async (params) => {
  const subscriptions = await s.getSubscriptionsFromDb(params.from, params.to);
  return s.getActiveSubscriptionsWithCode({
    subscriptions,
    from: params.from,
    to: params.to,
    grain: params.grain
  });
}));

// Strategy 3: Subscriptions over time (delta + window function)
app.get(API.subscriptions.path, createApiHandler(API.subscriptions, s.getSubscriptionsWithSql));
app.get(API.subscriptionsCode.path, createApiHandler(API.subscriptionsCode, async (params) => {
  const subscriptions = await s.getSubscriptionsFromDb(params.from, params.to);
  return s.getSubscriptionsWithCode({
    subscriptions,
    from: params.from,
    to: params.to,
    grain: params.grain
  });
}));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
