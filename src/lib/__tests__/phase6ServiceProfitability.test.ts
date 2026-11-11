import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateServiceProfitability,
  ServiceProfitabilityFilters,
} from "../profitability/profitabilityService";

test("Phase 6 — Service Profitability: Correctly computes gross profit and margin with discounts", () => {
  const catalog = [
    {
      id: "svc_bn",
      name: "Business Name Registration",
      category: "business_registration",
      slug: "business-name-registration",
      default_fee_ngn: 35_000,
      internal_cost_estimate: 15_000,
    },
    {
      id: "svc_ltd",
      name: "Company Incorporation (LTD)",
      category: "business_registration",
      slug: "company-incorporation",
      default_fee_ngn: 85_000,
      internal_cost_estimate: 35_000,
    },
  ];

  const serviceRequests = [
    { id: "sr_1", service_id: "svc_bn", status: "completed", created_at: "2026-05-01T10:00:00Z", completed_at: "2026-05-05T10:00:00Z" },
    { id: "sr_2", service_id: "svc_bn", status: "completed", created_at: "2026-05-02T10:00:00Z", completed_at: "2026-05-06T10:00:00Z" },
    { id: "sr_3", service_id: "svc_ltd", status: "completed", created_at: "2026-05-03T10:00:00Z", completed_at: "2026-05-08T10:00:00Z" },
  ];

  // Invoices: inv_1 for sr_1 has ₦35,000 subtotal, ₦5,000 discount -> ₦30,000 net
  // inv_2 for sr_2 has ₦35,000 subtotal, 0 discount -> ₦35,000 net
  // Total BN revenue = ₦65,000
  const invoices = [
    {
      id: "inv_1",
      service_request_id: "sr_1",
      subtotal: 35_000,
      discount: 5_000,
      total_amount: 30_000,
      amount_paid: 30_000,
      balance_due: 0,
      status: "paid",
      issue_date: "2026-05-01",
    },
    {
      id: "inv_2",
      service_request_id: "sr_2",
      subtotal: 35_000,
      discount: 0,
      total_amount: 35_000,
      amount_paid: 35_000,
      balance_due: 0,
      status: "paid",
      issue_date: "2026-05-02",
    },
    {
      id: "inv_3",
      service_request_id: "sr_3",
      subtotal: 85_000,
      discount: 10_000,
      total_amount: 75_000,
      amount_paid: 75_000,
      balance_due: 0,
      status: "paid",
      issue_date: "2026-05-03",
    },
  ];

  const invoiceItems = [
    { id: "item_1", invoice_id: "inv_1", service_id: "svc_bn", quantity: 1, unit_price: 35_000, total_price: 35_000 },
    { id: "item_2", invoice_id: "inv_2", service_id: "svc_bn", quantity: 1, unit_price: 35_000, total_price: 35_000 },
    { id: "item_3", invoice_id: "inv_3", service_id: "svc_ltd", quantity: 1, unit_price: 85_000, total_price: 85_000 },
  ];

  // Direct expenses:
  // sr_1: CAC filing fee ₦10,000
  // sr_2: CAC filing fee ₦10,000
  // sr_3: CAC filing fee ₦25,000
  // General office internet: ₦20,000 (unallocated)
  const expenses = [
    { id: "exp_1", service_request_id: "sr_1", service_id: "svc_bn", amount: 10_000, cost_type: "direct", expense_date: "2026-05-02" },
    { id: "exp_2", service_request_id: "sr_2", service_id: "svc_bn", amount: 10_000, cost_type: "direct", expense_date: "2026-05-03" },
    { id: "exp_3", service_request_id: "sr_3", service_id: "svc_ltd", amount: 25_000, cost_type: "direct", expense_date: "2026-05-04" },
    { id: "exp_4", amount: 20_000, cost_type: "unallocated", description: "Office Internet", expense_date: "2026-05-01" },
  ];

  const analysis = calculateServiceProfitability(catalog, serviceRequests, invoices, invoiceItems, expenses);

  // Business Name:
  // Revenue: 30k + 35k = 65k
  // Costs: 10k + 10k = 20k
  // Gross Profit = 45k
  // Margin = (45,000 / 65,000) * 100 = 69.2%
  const bn = analysis.services.find((s) => s.serviceId === "svc_bn")!;
  assert.equal(bn.recognizedServiceRevenue, 65_000);
  assert.equal(bn.discountsGranted, 5_000);
  assert.equal(bn.totalDirectCosts, 20_000);
  assert.equal(bn.grossProfit, 45_000);
  assert.equal(bn.grossProfitMarginPercent, 69.2);
  assert.equal(bn.completedCount, 2);
  assert.equal(bn.averageRevenuePerCompletedService, 32_500);

  // LTD:
  // Revenue: 75k
  // Costs: 25k
  // Gross Profit = 50k
  // Margin = (50,000 / 75,000) * 100 = 66.7%
  const ltd = analysis.services.find((s) => s.serviceId === "svc_ltd")!;
  assert.equal(ltd.recognizedServiceRevenue, 75_000);
  assert.equal(ltd.discountsGranted, 10_000);
  assert.equal(ltd.totalDirectCosts, 25_000);
  assert.equal(ltd.grossProfit, 50_000);
  assert.equal(ltd.grossProfitMarginPercent, 66.7);

  // Totals:
  // Total Revenue: 65k + 75k = 140k
  // Total Direct Costs: 20k + 25k = 45k
  // Total Gross Profit: 95k
  // Unallocated: 20k
  // Net Operating Surplus = 95k - 20k = 75k
  assert.equal(analysis.totals.totalServiceRevenue, 140_000);
  assert.equal(analysis.totals.totalDirectCosts, 45_000);
  assert.equal(analysis.totals.totalGrossProfit, 95_000);
  assert.equal(analysis.totals.unallocatedExpensesTotal, 20_000);
  assert.equal(analysis.totals.netOperatingSurplusAfterOverhead, 75_000);

  // Rankings: Top 1 is LTD (50k profit), Top 2 is BN (45k profit)
  assert.equal(analysis.topProfitableServices[0].serviceId, "svc_ltd");
  assert.equal(analysis.topProfitableServices[1].serviceId, "svc_bn");
});

test("Phase 6 — Service Profitability: Identifies missing cost records and flags estimated cost basis", () => {
  const catalog = [
    {
      id: "svc_tcc",
      name: "Tax Clearance Certificate",
      category: "tax_accounting",
      default_fee_ngn: 50_000,
      internal_cost_estimate: 20_000,
    },
  ];

  const serviceRequests = [
    { id: "sr_tcc_1", service_id: "svc_tcc", status: "completed" },
  ];

  const invoices = [
    { id: "inv_tcc", service_request_id: "sr_tcc_1", subtotal: 50_000, total_amount: 50_000, status: "paid" },
  ];

  const invoiceItems = [
    { id: "item_tcc", invoice_id: "inv_tcc", service_id: "svc_tcc", total_price: 50_000 },
  ];

  // No actual expenses recorded for this completed job!
  const expenses: any[] = [];

  const analysis = calculateServiceProfitability(catalog, serviceRequests, invoices, invoiceItems, expenses);

  const tcc = analysis.services.find((s) => s.serviceId === "svc_tcc")!;
  assert.equal(tcc.costClassification, "estimated");
  assert.equal(tcc.totalDirectCosts, 20_000); // Uses 1 * 20,000 catalog estimate
  assert.ok(analysis.totals.dataCompletenessNotice);
  assert.match(analysis.totals.dataCompletenessNotice!, /cannot be fully calculated|some service costs|incomplete/i);
});

test("Phase 6 — Service Profitability: Excludes draft and cancelled invoices from recognized revenue", () => {
  const catalog = [
    { id: "svc_test", name: "Test Service", default_fee_ngn: 10_000, internal_cost_estimate: 2_000 },
  ];
  const serviceRequests = [{ id: "sr_test", service_id: "svc_test", status: "completed" }];

  const invoices = [
    { id: "inv_draft", service_request_id: "sr_test", total_amount: 100_000, status: "draft" },
    { id: "inv_cancelled", service_request_id: "sr_test", total_amount: 50_000, status: "cancelled" },
    { id: "inv_sent", service_request_id: "sr_test", total_amount: 10_000, status: "sent" },
  ];

  const invoiceItems = [
    { invoice_id: "inv_draft", service_id: "svc_test", total_price: 100_000 },
    { invoice_id: "inv_cancelled", service_id: "svc_test", total_price: 50_000 },
    { invoice_id: "inv_sent", service_id: "svc_test", total_price: 10_000 },
  ];

  const analysis = calculateServiceProfitability(catalog, serviceRequests, invoices, invoiceItems, []);
  const svc = analysis.services.find((s) => s.serviceId === "svc_test")!;
  assert.equal(svc.recognizedServiceRevenue, 10_000);
});
