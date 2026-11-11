import test from "node:test";
import assert from "node:assert/strict";

import {
  generateCashFlowForecast,
  calculateCurrentCashPosition,
  calculateBudgetVsActual,
  DEFAULT_SCENARIOS,
  expandRecurringExpenses,
} from "../cashFlow/cashFlowService";

test("Phase 7 — Cash Flow: Accurately calculates current recorded cash position", () => {
  const payments = [
    { id: "p1", amount: 150_000, is_verified: true },
    { id: "p2", amount: 50_000, is_verified: true },
    { id: "p3", amount: 80_000, is_verified: false }, // Unverified payment MUST NOT be counted as cash in bank
  ];

  const expenses = [
    { id: "e1", amount: 40_000, status: "approved" },
    { id: "e2", amount: 20_000, status: "approved" },
    { id: "e3", amount: 90_000, status: "rejected" }, // Rejected expense MUST NOT be subtracted
  ];

  const cash = calculateCurrentCashPosition(payments, expenses, 100_000); // ₦100k opening reserve
  // 100k opening + (150k + 50k verified receipts) - (40k + 20k approved expenses) = 240,000
  assert.equal(cash, 240_000);
});

test("Phase 7 — Cash Flow: Outstanding invoice collections handle partial payments and exclude fully paid invoices", () => {
  const referenceNow = new Date("2026-05-01T00:00:00Z");

  const invoices = [
    // Fully paid invoice -> MUST be excluded
    {
      id: "inv_paid",
      invoice_number: "INV-001",
      total_amount: 100_000,
      amount_paid: 100_000,
      balance_due: 0,
      status: "paid",
      due_date: "2026-05-10",
    },
    // Partially paid invoice -> Only balance_due (₦40,000) should be projected
    {
      id: "inv_partial",
      invoice_number: "INV-002",
      total_amount: 100_000,
      amount_paid: 60_000,
      balance_due: 40_000,
      status: "partially_paid",
      due_date: "2026-05-15",
      collection_confidence: "high", // 100% confidence factor
    },
    // Unpaid invoice
    {
      id: "inv_unpaid",
      invoice_number: "INV-003",
      total_amount: 50_000,
      amount_paid: 0,
      balance_due: 50_000,
      status: "sent",
      due_date: "2026-05-20",
      collection_confidence: "high",
    },
  ];

  const forecast = generateCashFlowForecast({
    currentCashPosition: 100_000,
    invoices,
    serviceRequests: [],
    servicesCatalog: [],
    projectedExpenses: [],
    scenarioConfig: { ...DEFAULT_SCENARIOS.expected, collectionRatePercent: 100 },
    referenceNow,
  });

  // Expected collections must be 40k + 50k = 90k
  assert.equal(forecast.expectedCollections.length, 2);
  const collectedTotal = forecast.expectedCollections.reduce((s, c) => s + c.balanceDue, 0);
  assert.equal(collectedTotal, 90_000);
  assert.equal(forecast.horizon30Days.expectedCollections, 90_000);
  // Closing = 100k + 90k = 190,000
  assert.equal(forecast.horizon30Days.projectedClosingBalance, 190_000);
});

test("Phase 7 — Cash Flow: Prevents double-counting between active service requests and issued invoices", () => {
  const referenceNow = new Date("2026-05-01T00:00:00Z");

  const servicesCatalog = [
    { id: "svc_1", name: "Corporate Filing", default_fee_ngn: 50_000 },
  ];

  // sr_1 already has an invoice (inv_1).
  // sr_2 has NO invoice yet (pure pipeline).
  const serviceRequests = [
    { id: "sr_1", service_id: "svc_1", tracking_code: "SR-001", status: "in_progress", target_completion_date: "2026-05-15" },
    { id: "sr_2", service_id: "svc_1", tracking_code: "SR-002", status: "in_progress", target_completion_date: "2026-05-20" },
  ];

  const invoices = [
    {
      id: "inv_1",
      service_request_id: "sr_1",
      total_amount: 50_000,
      amount_paid: 0,
      balance_due: 50_000,
      status: "sent",
      due_date: "2026-05-15",
      collection_confidence: "high",
    },
  ];

  const forecast = generateCashFlowForecast({
    currentCashPosition: 100_000,
    invoices,
    serviceRequests,
    servicesCatalog,
    projectedExpenses: [],
    scenarioConfig: { ...DEFAULT_SCENARIOS.expected, collectionRatePercent: 100, pipelineConversionRatePercent: 100 },
    referenceNow,
  });

  // Pipeline opportunities MUST only contain sr_2 (sr_1 is represented by inv_1)
  assert.equal(forecast.pipelineOpportunities.length, 1);
  assert.equal(forecast.pipelineOpportunities[0].serviceRequestId, "sr_2");
  // Total projected inflows = 50k invoice + 50k uninvoiced pipeline = 100,000
  assert.equal(forecast.horizon30Days.totalProjectedInflow, 100_000);
});

test("Phase 7 — Cash Flow: Recurring expense recurrence expansion across forecast horizons", () => {
  const horizonEnd = new Date("2026-07-31T00:00:00Z"); // 3 months horizon

  const projectedExpenses: any[] = [
    {
      id: "exp_salaries",
      category: "salaries",
      description: "Monthly Staff Payroll",
      amount: 500_000,
      expected_payment_date: "2026-05-25",
      recurrence: "monthly",
      status: "projected",
    },
    {
      id: "exp_onetime",
      category: "office_supplies",
      description: "Printer Toner",
      amount: 25_000,
      expected_payment_date: "2026-05-10",
      recurrence: "none",
      status: "projected",
    },
  ];

  const expanded = expandRecurringExpenses(projectedExpenses, horizonEnd);

  // Toner is one-time (1 occurrence: May 10)
  // Payroll is monthly (3 occurrences: May 25, Jun 25, Jul 25)
  const salaryOccurrences = expanded.filter((e) => e.category === "salaries");
  assert.equal(salaryOccurrences.length, 3);
  assert.equal(salaryOccurrences[0].effectiveDate, "2026-05-25");
  assert.equal(salaryOccurrences[1].effectiveDate, "2026-06-25");
  assert.equal(salaryOccurrences[2].effectiveDate, "2026-07-25");

  const tonerOccurrences = expanded.filter((e) => e.category === "office_supplies");
  assert.equal(tonerOccurrences.length, 1);
});

test("Phase 7 — Cash Flow: Budget vs Actual calculates income/expense variance accurately", () => {
  const periodKey = "2026-05";

  const budgets: any[] = [
    { period_key: periodKey, category_type: "income", category_name: "Client Service Revenue", budgeted_amount: 1_000_000 },
    { period_key: periodKey, category_type: "expense", category_name: "Office Rent", budgeted_amount: 300_000 },
    { period_key: periodKey, category_type: "expense", category_name: "Internet & Power", budgeted_amount: 50_000 },
  ];

  // Actual verified payments in May 2026: ₦1,200,000 (exceeded budget by ₦200,000)
  const payments = [
    { amount: 700_000, payment_date: "2026-05-04T10:00:00Z", is_verified: true },
    { amount: 500_000, payment_date: "2026-05-15T10:00:00Z", is_verified: true },
  ];

  // Actual expenses: Rent = ₦300,000 (on target), Internet = ₦70,000 (over budget by ₦20,000)
  const expenses = [
    { amount: 300_000, category: "Office Rent", expense_date: "2026-05-02" },
    { amount: 70_000, category: "Internet & Power", expense_date: "2026-05-05" },
  ];

  const summary = calculateBudgetVsActual({ periodKey, budgets, payments, expenses });

  assert.equal(summary.totalBudgetedIncome, 1_000_000);
  assert.equal(summary.totalActualIncome, 1_200_000);
  assert.equal(summary.incomeVariance, 200_000); // ₦200k favorable

  assert.equal(summary.totalBudgetedExpense, 350_000);
  assert.equal(summary.totalActualExpense, 370_000);
  assert.equal(summary.expenseVariance, -20_000); // ₦20k over budget

  // Net Surplus: Budgeted was 1,000k - 350k = 650k. Actual is 1,200k - 370k = 830k. Variance = +180k.
  assert.equal(summary.budgetedNetSurplus, 650_000);
  assert.equal(summary.actualNetSurplus, 830_000);
  assert.equal(summary.surplusVariance, 180_000);

  // Internet item flagged with alert for exceeding 15% threshold
  const internetItem = summary.items.find((i) => i.categoryName === "Internet & Power")!;
  assert.equal(internetItem.status, "alert");
  assert.ok(internetItem.varianceAmount < 0);
});
