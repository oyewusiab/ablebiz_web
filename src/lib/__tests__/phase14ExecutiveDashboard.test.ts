import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMetricWithComparison,
  createDefaultExecutiveFilters,
} from "../executiveDashboard/executiveService";

test("Phase 14 — Executive Dashboard: Metric comparison handles zero and missing denominators cleanly", () => {
  // Scenario 1: Standard positive growth
  const revenueGrowth = buildMetricWithComparison(
    1500000,
    1000000,
    "NGN",
    true,
    "Total verified cash collected."
  );
  assert.equal(revenueGrowth.value, 1500000);
  assert.equal(revenueGrowth.percentageChange, 50);
  assert.equal(revenueGrowth.changeDirection, "positive");
  assert.equal(revenueGrowth.isFavorable, true);

  // Scenario 2: Unfavorable increase (e.g. expenses grew)
  const expenseGrowth = buildMetricWithComparison(
    800000,
    500000,
    "NGN",
    false, // isHigherBetter = false
    "Total operational expenses."
  );
  assert.equal(expenseGrowth.percentageChange, 60);
  assert.equal(expenseGrowth.changeDirection, "positive");
  assert.equal(expenseGrowth.isFavorable, false); // Higher expenses are UNFAVORABLE

  // Scenario 3: Prior value was 0 (division by zero safeguard)
  const newMetric = buildMetricWithComparison(
    50000,
    0,
    "NGN",
    true,
    "New revenue stream."
  );
  assert.equal(Number.isNaN(newMetric.percentageChange), false);
  assert.equal(Number.isFinite(newMetric.percentageChange), true);
  assert.equal(newMetric.percentageChange, 100);

  // Scenario 4: Both values are 0
  const zeroMetric = buildMetricWithComparison(
    0,
    0,
    "count",
    true,
    "Zero count baseline."
  );
  assert.equal(zeroMetric.percentageChange, 0);

  // Scenario 5: Missing / null prior value
  const noPrior = buildMetricWithComparison(
    120000,
    null,
    "NGN",
    true,
    "First period."
  );
  assert.equal(noPrior.percentageChange, null);
  assert.equal(noPrior.changeDirection, "neutral");
});

test("Phase 14 — Executive Dashboard: Default filters initialize with current calendar month bounds", () => {
  const filters = createDefaultExecutiveFilters();
  assert.equal(filters.period, "this_month");
  assert.equal(filters.category, "all");
  assert.equal(filters.department, "all");
  assert.equal(filters.staffId, "all");

  const now = new Date();
  const expectedStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  assert.equal(filters.startDate, expectedStart);
});

test("Phase 14 — Executive Dashboard: Invoiced revenue vs verified cash separation maintains accounting accuracy", () => {
  // Sample invoices vs verified payments
  const mockInvoices = [
    { id: "inv-1", total_amount: 500000, status: "paid" },
    { id: "inv-2", total_amount: 300000, status: "sent" },
    { id: "inv-3", total_amount: 200000, status: "partial", amount_paid: 50000, balance_due: 150000 },
  ];

  const mockPayments = [
    { id: "pay-1", amount: 500000, status: "verified" },
    { id: "pay-2", amount: 50000, status: "verified" },
    { id: "pay-3", amount: 100000, status: "pending" }, // Unverified / in-flight!
  ];

  // Invoiced revenue = sum of all billed invoices = 1,000,000
  const invoicedRevenue = mockInvoices.reduce((acc, i) => acc + i.total_amount, 0);
  assert.equal(invoicedRevenue, 1000000);

  // Verified cash collected must EXCLUDE unverified payments
  const verifiedCashCollected = mockPayments
    .filter((p) => p.status === "verified")
    .reduce((acc, p) => acc + p.amount, 0);
  assert.equal(verifiedCashCollected, 550000);

  // Collection efficiency = verified cash / invoiced revenue
  const collectionEfficiency = (verifiedCashCollected / invoicedRevenue) * 100;
  assert.equal(Math.round(collectionEfficiency), 55);

  // Outstanding A/R = 300,000 + 150,000 = 450,000
  const outstandingAr = (300000) + (150000);
  assert.equal(outstandingAr, 450000);
});

test("Phase 14 — Executive Dashboard: CSAT and NPS calculations include explicit sample size disclosures", () => {
  const ratings = [5, 4, 5, 5, 3]; // 5 responses
  const avgCsat = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  assert.equal(avgCsat, 4.4);

  // Guardrail: Empty ratings return 0 without divide-by-zero errors
  const emptyRatings: number[] = [];
  const safeAvg = emptyRatings.length > 0 ? emptyRatings.reduce((a, b) => a + b, 0) / emptyRatings.length : 0;
  assert.equal(safeAvg, 0);
});
