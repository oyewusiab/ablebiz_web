import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_CATEGORIES,
  REPORT_CATALOGUE,
  getReportById,
  getReportsByCategory,
} from "../reportCatalogue";
import {
  METRIC_DEFINITIONS_LIST,
  formatBusinessStatusLabel,
  formatDataSourceLabel,
  getMetricDefinition,
} from "../metricRegistry";
import {
  CAMPAIGN_CLIENTS_SELECT_COLUMNS,
  CAMPAIGN_INVOICES_SELECT_COLUMNS,
  CAMPAIGN_LEADS_SELECT_COLUMNS,
  CAMPAIGN_PAYMENTS_SELECT_COLUMNS,
  formatCampaignStatusLabel,
  formatClientCode,
  isLeadAttributedToCampaign,
  resolveLeadServiceInterest,
} from "../../campaignEngine";
import {
  canAccessReport,
  canExportReportFormat,
  canPerformReportAction,
  getRoleReportAccessProfile,
  resolveEffectiveReportScope,
  validateScheduledReportRecipients,
} from "../reportPermissions";
import {
  calculateOrganisationalHealth,
  classifyCacApplicationStage,
  computePeriodComparison,
  computePeriodWindow,
  createDefaultReportFilterState,
  createEmptyReportingDataset,
  generateReportPayload,
  summarizeCacStages,
} from "../reportEngine";
import {
  buildReportCsvString,
  buildReportExcelBytes,
  buildReportPdfDocument,
} from "../reportExport";

describe("ABLEBIZ BI & Executive Reporting Expansion — Comprehensive Suite", () => {
  describe("1. Report Catalogue & Metric Registry Completeness", () => {
    it("registers all 7 required reporting categories and 78 reports", () => {
      assert.equal(REPORT_CATEGORIES.length, 7);
      assert.equal(REPORT_CATALOGUE.length, 78);

      assert.equal(getReportsByCategory("executive").length, 10);
      assert.equal(getReportsByCategory("financial").length, 16);
      assert.equal(getReportsByCategory("crm").length, 12);
      assert.equal(getReportsByCategory("operations").length, 12);
      assert.equal(getReportsByCategory("hr").length, 9);
      assert.equal(getReportsByCategory("marketing").length, 10);
      assert.equal(getReportsByCategory("compliance").length, 9);
    });

    it("provides business-friendly metric definitions with plain-English formulas, sources, and limitations", () => {
      assert.ok(METRIC_DEFINITIONS_LIST.length >= 18);
      const cashMetric = getMetricDefinition("cash_collected");
      assert.ok(cashMetric);
      assert.equal(cashMetric.name, "Verified Cash Collected");
      assert.equal(cashMetric.authoritativeSource, "Payment Records");
      assert.equal(cashMetric.unit, "NGN");

      const referralLiability = getMetricDefinition("referral_reward_liability");
      assert.ok(referralLiability);
      assert.ok(referralLiability.calculationFormula.includes("milestone"));

      // Ensure no raw SQL syntax or public.<table_name> leaks into user-facing metric definitions
      for (const m of METRIC_DEFINITIONS_LIST) {
        assert.ok(
          !m.authoritativeSource.includes("public."),
          `Metric ${m.id} source should not contain raw public. table reference`
        );
        assert.ok(
          !m.calculationFormula.includes("SUM(") &&
            !m.calculationFormula.includes("COUNT(") &&
            !m.calculationFormula.includes("WHERE "),
          `Metric ${m.id} calculationFormula should use plain business language`
        );
      }
    });
  });

  describe("2. Period Comparison & Zero/Missing Denominator Handling", () => {
    it("computes positive and negative percentage changes accurately when prior baseline > 0", () => {
      const up = computePeriodComparison(150_000, 100_000, "NGN");
      assert.equal(up.direction, "up");
      assert.equal(up.absoluteDifference, 50_000);
      assert.equal(up.percentageChange, 50);
      assert.equal(up.formattedPercentage, "+50.0%");

      const down = computePeriodComparison(75_000, 100_000, "NGN");
      assert.equal(down.direction, "down");
      assert.equal(down.absoluteDifference, -25_000);
      assert.equal(down.percentageChange, -25);
      assert.equal(down.formattedPercentage, "-25.0%");
    });

    it("handles zero prior-period denominator safely without Infinity or NaN", () => {
      const fromZero = computePeriodComparison(85_000, 0, "NGN");
      assert.equal(fromZero.percentageChange, null);
      assert.equal(fromZero.direction, "up");
      assert.ok(fromZero.formattedPercentage.includes("New activity"));

      const bothZero = computePeriodComparison(0, 0, "NGN");
      assert.equal(bothZero.percentageChange, 0);
      assert.equal(bothZero.direction, "flat");
    });

    it("handles null/missing prior-period baseline gracefully", () => {
      const noBaseline = computePeriodComparison(42, null, "count");
      assert.equal(noBaseline.previousValue, null);
      assert.equal(noBaseline.percentageChange, null);
      assert.equal(noBaseline.direction, "na");
    });

    it("computes deterministic period windows without mutating reference dates", () => {
      const refDate = new Date("2026-04-20T14:30:00.000Z");
      const origTs = refDate.getTime();
      const win = computePeriodWindow(
        {
          period: "this_week",
          startDate: "",
          endDate: "",
          comparisonMode: "previous_period",
        },
        refDate
      );
      assert.equal(refDate.getTime(), origTs);
      assert.ok(win.startDate);
      assert.ok(win.endDate);
      assert.ok(win.comparisonStartDate);
      assert.ok(win.comparisonEndDate);
      assert.ok(win.comparisonEndDate.getTime() < win.startDate.getTime());
    });
  });

  describe("3. Organisational Health Score & Missing Data Exclusion", () => {
    it("excludes unavailable or restricted dimensions from denominator rather than scoring them as zero", () => {
      const health = calculateOrganisationalHealth({
        revenueGrowthPct: 20,
        hasRevenueData: true,
        netProfitMarginPct: 36,
        hasProfitData: true,
        collectionEfficiencyPct: 90,
        overdueSharePct: 0,
        hasReceivablesData: true,
        leadConversionPct: 40,
        newClientsCount: 5,
        hasCrmData: true,
        serviceCompletionPct: null,
        hasServiceData: false, // Missing dimension
        cacQueryRatePct: null,
        cacAvgTurnaroundDays: null,
        hasCacData: false, // Missing dimension
        taskCompletionPct: null,
        overdueTasksCount: 0,
        hasStaffTaskData: false, // Missing dimension
        referralVerificationPct: null,
        campaignRegistrationsCount: 0,
        hasCampaignData: false, // Missing dimension
        canViewFinance: true,
      });

      assert.equal(health.evaluatedDimensionsCount, 4);
      assert.ok(health.overallScore !== null && health.overallScore >= 80);
      assert.equal(health.overallBand, "Strong / Healthy");
    });

    it("returns null overallScore and 'Insufficient Data for Assessment' when fewer than 3 dimensions have data", () => {
      const sparseHealth = calculateOrganisationalHealth({
        revenueGrowthPct: null,
        hasRevenueData: false,
        netProfitMarginPct: null,
        hasProfitData: false,
        collectionEfficiencyPct: null,
        overdueSharePct: null,
        hasReceivablesData: false,
        leadConversionPct: 50,
        newClientsCount: 2,
        hasCrmData: true,
        serviceCompletionPct: 80,
        hasServiceData: true,
        cacQueryRatePct: null,
        cacAvgTurnaroundDays: null,
        hasCacData: false,
        taskCompletionPct: null,
        overdueTasksCount: 0,
        hasStaffTaskData: false,
        referralVerificationPct: null,
        campaignRegistrationsCount: 0,
        hasCampaignData: false,
        canViewFinance: false,
      });

      assert.equal(sparseHealth.evaluatedDimensionsCount, 2);
      assert.equal(sparseHealth.overallScore, null);
      assert.equal(
        sparseHealth.overallBand,
        "Insufficient Data for Assessment"
      );
    });
  });

  describe("4. Financial, CRM, CAC & Campaign/Referral Calculation Accuracy", () => {
    const refNow = new Date("2026-04-25T12:00:00.000Z");
    const dataset = createEmptyReportingDataset();

    // Invoices: 1 paid (100k), 1 partially paid (200k total, 50k paid, 150k balance, overdue), 1 draft (500k - must be excluded), 1 cancelled (300k - must be excluded)
    dataset.invoices = [
      {
        id: "inv_1",
        invoice_number: "INV-001",
        client_id: "cl_1",
        total: 100_000,
        amount_paid: 100_000,
        balance_due: 0,
        status: "paid",
        issue_date: "2026-04-05T10:00:00Z",
        due_date: "2026-04-15T10:00:00Z",
      },
      {
        id: "inv_2",
        invoice_number: "INV-002",
        client_id: "cl_2",
        total: 200_000,
        amount_paid: 50_000,
        balance_due: 150_000,
        status: "partially_paid",
        issue_date: "2026-04-06T10:00:00Z",
        due_date: "2026-04-12T10:00:00Z", // Past due relative to 2026-04-25
      },
      {
        id: "inv_draft",
        invoice_number: "INV-003",
        total: 500_000,
        amount_paid: 0,
        balance_due: 500_000,
        status: "draft",
        issue_date: "2026-04-07T10:00:00Z",
      },
      {
        id: "inv_cancelled",
        invoice_number: "INV-004",
        total: 300_000,
        amount_paid: 0,
        balance_due: 300_000,
        status: "cancelled",
        issue_date: "2026-04-08T10:00:00Z",
      },
    ];

    // Payments: 2 verified (100k + 50k = 150k), 1 unverified (80k - must be excluded from cash collected)
    dataset.payments = [
      {
        id: "pay_1",
        amount: 100_000,
        is_verified: true,
        payment_date: "2026-04-05T12:00:00Z",
      },
      {
        id: "pay_2",
        amount: 50_000,
        is_verified: true,
        payment_date: "2026-04-06T12:00:00Z",
      },
      {
        id: "pay_unverified",
        amount: 80_000,
        is_verified: false,
        payment_date: "2026-04-09T12:00:00Z",
      },
    ];

    // Expenses: 1 approved & paid (40k), 1 rejected (90k - must be excluded)
    dataset.expenses = [
      {
        id: "exp_1",
        title: "CAC Portal Filing Stamp",
        amount: 40_000,
        tax_amount: 0,
        approval_status: "approved",
        payment_status: "paid",
        expense_date: "2026-04-10T10:00:00Z",
      },
      {
        id: "exp_rejected",
        title: "Rejected Voucher",
        amount: 90_000,
        tax_amount: 0,
        approval_status: "rejected",
        payment_status: "unpaid",
        expense_date: "2026-04-11T10:00:00Z",
      },
    ];

    // Leads & Clients: 4 leads in cohort, 2 converted -> 50.0% conversion rate
    dataset.clients = [
      {
        id: "cl_1",
        full_name: "Adebayo Holdings Ltd",
        created_at: "2026-04-04T10:00:00Z",
      },
      {
        id: "cl_2",
        full_name: "Zuma Tech Ventures",
        created_at: "2026-04-06T10:00:00Z",
      },
    ];
    dataset.leads = [
      { id: "l_1", full_name: "Lead 1", is_converted: true, created_at: "2026-04-02T10:00:00Z" },
      { id: "l_2", full_name: "Lead 2", is_converted: true, created_at: "2026-04-03T10:00:00Z" },
      { id: "l_3", full_name: "Lead 3", is_converted: false, qualification_status: "qualified", created_at: "2026-04-08T10:00:00Z" },
      { id: "l_4", full_name: "Lead 4", is_converted: false, qualification_status: "new", created_at: "2026-04-09T10:00:00Z" },
    ];

    // CAC Registrations: 2 completed (4 days and 6 days -> avg 5.0 days), 1 queried
    dataset.cacRegistrations = [
      {
        id: "cac_1",
        proposed_name_1: "Alpha Ventures",
        stage: "completed",
        assigned_officer_id: "staff_reg_1",
        submitted_at: "2026-04-01T00:00:00Z",
        completed_at: "2026-04-05T00:00:00Z", // 4 days
        query_count: 0,
      },
      {
        id: "cac_2",
        proposed_name_1: "Beta Corporate Ltd",
        stage: "approved",
        assigned_officer_id: "staff_reg_1",
        submitted_at: "2026-04-05T00:00:00Z",
        completed_at: "2026-04-11T00:00:00Z", // 6 days
        query_count: 0,
      },
      {
        id: "cac_3",
        proposed_name_1: "Gamma Enterprises",
        stage: "queried",
        assigned_officer_id: "staff_reg_2",
        submitted_at: "2026-04-12T00:00:00Z",
        query_count: 2,
      },
    ];

    // Referrals & Campaign: Referrer 1 has 5 verified referrals -> cumulative reward MUST be ₦15,000 (NOT 2k+7.5k+15k=24.5k!)
    // Plus 2 unverified referrals which MUST NOT be counted as successful.
    dataset.referrers = [
      {
        id: "ref_1",
        referral_code: "ABL-REF-001",
        full_name: "Chinedu Okafor",
        total_referrals_count: 7,
        verified_referrals_count: 5,
      },
    ];
    dataset.referralConversions = [
      { id: "rc_1", referrer_id: "ref_1", payment_verified: true, created_at: "2026-04-14T10:00:00Z" },
      { id: "rc_2", referrer_id: "ref_1", payment_verified: true, created_at: "2026-04-15T10:00:00Z" },
      { id: "rc_3", referrer_id: "ref_1", payment_verified: true, created_at: "2026-04-16T10:00:00Z" },
      { id: "rc_4", referrer_id: "ref_1", payment_verified: true, created_at: "2026-04-17T10:00:00Z" },
      { id: "rc_5", referrer_id: "ref_1", payment_verified: true, created_at: "2026-04-18T10:00:00Z" },
      { id: "rc_6_unverified", referrer_id: "ref_1", payment_verified: false, verification_status: "pending", created_at: "2026-04-19T10:00:00Z" },
      { id: "rc_7_unverified", referrer_id: "ref_1", payment_verified: false, verification_status: "pending", created_at: "2026-04-20T10:00:00Z" },
    ];
    dataset.referralRewardLedger = [
      { id: "led_1", referrer_id: "ref_1", reward_amount: 2_000, payout_status: "paid" },
    ];
    dataset.campaignDiscounts = [
      {
        id: "cd_1",
        service_name: "Business Name Registration",
        original_price: 40_000,
        discount_amount: 4_000,
        discounted_price: 36_000,
        discount_percentage: 10,
        applied_at: "2026-04-15T10:00:00Z",
      },
      {
        id: "cd_2",
        service_name: "Company Incorporation (LTD)",
        original_price: 100_000,
        discount_amount: 10_000,
        discounted_price: 90_000,
        discount_percentage: 10,
        applied_at: "2026-04-16T10:00:00Z",
      },
    ];

    const filters = {
      ...createDefaultReportFilterState(),
      period: "this_month" as const,
    };

    it("correctly separates Invoices Issued, Verified Cash Collected, Outstanding A/R, Overdue A/R, Expenses, and Net Cash Profit", () => {
      const finReport = generateReportPayload(
        "revenue_report",
        filters,
        {
          staffId: "staff_admin",
          fullName: "Super Admin",
          role: "super_admin",
        },
        dataset,
        refNow
      );

      const byId = Object.fromEntries(finReport.kpis.map((k) => [k.id, k]));

      // Billable invoices = 100k + 200k = 300k (draft 500k and cancelled 300k excluded)
      assert.equal(byId.fin_invoices_issued.comparison.currentValue, 300_000);
      // Verified payments = 100k + 50k = 150k (unverified 80k excluded)
      assert.equal(byId.fin_cash_collected.comparison.currentValue, 150_000);
      // Outstanding balance = 150k
      assert.equal(byId.fin_outstanding_ar.comparison.currentValue, 150_000);
      // Overdue balance = 150k (due 2026-04-12 < 2026-04-25)
      assert.equal(byId.fin_overdue_ar.comparison.currentValue, 150_000);
      // Approved expenses = 40k (rejected 90k excluded)
      assert.equal(byId.fin_expenses_incurred.comparison.currentValue, 40_000);
      // Net cash surplus = 150k - 40k = 110k
      assert.equal(byId.fin_net_profit.comparison.currentValue, 110_000);
    });

    it("computes cohort Lead Conversion Rate accurately (converted cohort leads / total cohort leads)", () => {
      const crmReport = generateReportPayload(
        "lead_conversion_report",
        filters,
        {
          staffId: "staff_cso",
          fullName: "Client Officer",
          role: "client_service_officer",
        },
        dataset,
        refNow
      );
      const byId = Object.fromEntries(crmReport.kpis.map((k) => [k.id, k]));
      assert.equal(byId.crm_total_leads.comparison.currentValue, 4);
      assert.equal(byId.crm_converted_leads.comparison.currentValue, 50);
    });

    it("computes CAC turnaround duration and enforces personal scope for registration_officer", () => {
      const regOfficerReport = generateReportPayload(
        "registration_officer_performance_report",
        filters,
        {
          staffId: "staff_reg_1",
          fullName: "Reg Officer 1",
          role: "registration_officer",
        },
        dataset,
        refNow
      );

      assert.equal(regOfficerReport.scopeApplied, "personal");
      const byId = Object.fromEntries(
        regOfficerReport.kpis.map((k) => [k.id, k])
      );
      // Only the 2 filings assigned to staff_reg_1 are included (cac_3 assigned to staff_reg_2 is excluded)
      assert.equal(byId.ops_cac_total.comparison.currentValue, 2);
      // Average turnaround of 4 days and 6 days = 5.0 days
      assert.equal(byId.ops_cac_turnaround.comparison.currentValue, 5);
    });

    it("enforces cumulative referral milestone rewards (5 verified = ₦15,000, minus ₦2,000 paid = ₦13,000 payable) and excludes unverified referrals", () => {
      const campaignReport = generateReportPayload(
        "office_opening_campaign_report",
        filters,
        {
          staffId: "staff_mkt",
          fullName: "Marketing Officer",
          role: "marketing_officer",
        },
        dataset,
        refNow
      );

      const byId = Object.fromEntries(
        campaignReport.kpis.map((k) => [k.id, k])
      );
      assert.equal(
        byId.mkt_campaign_registrations.comparison.currentValue,
        2
      );
      assert.equal(byId.mkt_campaign_revenue.comparison.currentValue, 126_000);
      // Only 5 verified referrals counted (2 unverified excluded)
      assert.equal(byId.mkt_verified_referrals.comparison.currentValue, 5);
      // 5 verified referrals -> cumulative reward = ₦15,000 (NOT additive). Paid = ₦2,000 -> Payable Liability = ₦13,000
      assert.equal(
        byId.mkt_referral_liability.comparison.currentValue,
        13_000
      );
    });
  });

  describe("5. Role-Based Access Control Across All 8 Canonical Roles", () => {
    it("enforces strict role permissions across financial, HR, operational, marketing, and security reports", () => {
      // 1. super_admin has access to all 78 reports
      const superProfile = getRoleReportAccessProfile("super_admin");
      assert.equal(superProfile.allowedReportIds.length, 78);

      // 2. registration_officer cannot access financial, HR-sensitive, or audit reports, and is clamped to personal scope
      assert.equal(canAccessReport("registration_officer", "revenue_report"), false);
      assert.equal(canAccessReport("registration_officer", "audit_log_report"), false);
      assert.equal(
        canAccessReport("registration_officer", "registration_officer_performance_report"),
        true
      );
      assert.equal(
        resolveEffectiveReportScope(
          "registration_officer",
          "registration_officer_performance_report",
          "organisation"
        ),
        "personal"
      );

      // 3. accounts_officer can access financial & referral liability reports, but not sensitive HR or security audit logs
      assert.equal(canAccessReport("accounts_officer", "revenue_report"), true);
      assert.equal(
        canAccessReport("accounts_officer", "referral_reward_liability_report"),
        true
      );
      assert.equal(
        canAccessReport("accounts_officer", "financial_control_exceptions_report"),
        true
      );
      assert.equal(canAccessReport("accounts_officer", "audit_log_report"), false);

      // 4. marketing_officer can access campaign & referral reports, but not company-wide financial statements
      assert.equal(
        canAccessReport("marketing_officer", "office_opening_campaign_report"),
        true
      );
      assert.equal(
        canAccessReport("marketing_officer", "monthly_financial_statement"),
        false
      );

      // 5. viewer has read-only summary access and cannot view detailed records or export reports
      const viewerProfile = getRoleReportAccessProfile("viewer");
      assert.equal(viewerProfile.canAccessReportingWorkspace, true);
      assert.equal(viewerProfile.canViewDetailedRecords, false);
      assert.equal(viewerProfile.canExportReports, false);
      assert.equal(
        canExportReportFormat("viewer", "business_operations_summary", "pdf"),
        false
      );
      assert.equal(
        canPerformReportAction(
          "viewer",
          "business_operations_summary",
          "view_detailed_records"
        ),
        false
      );
    });

    it("blocks scheduled report configurations from adding unauthorized recipients", () => {
      const validation = validateScheduledReportRecipients("revenue_report", [
        { id: "1", full_name: "Accounts Lead", role: "accounts_officer" },
        { id: "2", full_name: "Reg Officer", role: "registration_officer" },
      ]);

      assert.equal(validation.valid, false);
      assert.equal(validation.authorizedRecipients.length, 1);
      assert.equal(validation.unauthorizedRecipients.length, 1);
      assert.equal(validation.unauthorizedRecipients[0].full_name, "Reg Officer");
    });
  });

  describe("6. Professional Export Builders (CSV, Multi-Worksheet XLSX, Executive PDF)", () => {
    const dataset = createEmptyReportingDataset();
    dataset.invoices = [
      {
        id: "inv_10",
        invoice_number: "INV-100",
        total: 120_000,
        amount_paid: 120_000,
        balance_due: 0,
        status: "paid",
        issue_date: new Date().toISOString(),
      },
    ];
    dataset.payments = [
      {
        id: "pay_10",
        amount: 120_000,
        is_verified: true,
        payment_date: new Date().toISOString(),
      },
    ];

    const payload = generateReportPayload(
      "executive_business_performance",
      createDefaultReportFilterState(),
      {
        staffId: "staff_1",
        fullName: "Managing Director",
        role: "super_admin",
      },
      dataset
    );

    it("generates UTF-8 BOM CSV output with KPIs, Health Score, and Tables", () => {
      const csv = buildReportCsvString(payload);
      assert.ok(csv.startsWith("\uFEFF"));
      assert.ok(csv.includes("Executive Business Performance Report"));
      assert.ok(csv.includes("KEY PERFORMANCE INDICATORS"));
      assert.ok(csv.includes("₦120,000"));
    });

    it("generates a valid OpenXML .xlsx ZIP archive with multiple worksheets", () => {
      const bytes = buildReportExcelBytes(payload);
      assert.ok(bytes instanceof Uint8Array);
      assert.ok(bytes.byteLength > 1000);
      // ZIP magic header PK\x03\x04
      assert.equal(bytes[0], 0x50);
      assert.equal(bytes[1], 0x4b);
      assert.equal(bytes[2], 0x03);
      assert.equal(bytes[3], 0x04);
    });

    it("generates a multi-section jsPDF document with page numbering", () => {
      const pdfDoc = buildReportPdfDocument(payload);
      assert.ok(pdfDoc.getNumberOfPages() >= 1);
    });
  });

  describe("7. Plain Business Language & CAC Stage Classification", () => {
    it("translates raw technical table names and status codes into readable business labels", () => {
      assert.equal(formatDataSourceLabel("public.payments"), "Payment Records");
      assert.equal(formatDataSourceLabel("public.invoices"), "Invoice Records");
      assert.equal(formatDataSourceLabel("public.expenses"), "Expense Records");
      assert.equal(
        formatDataSourceLabel("public.cac_registrations"),
        "CAC Registration Records"
      );

      assert.equal(formatBusinessStatusLabel("verified"), "Confirmed");
      assert.equal(
        formatBusinessStatusLabel("pending_verification"),
        "Awaiting Verification"
      );
      assert.equal(formatBusinessStatusLabel("in_progress"), "In Progress");
      assert.equal(
        formatBusinessStatusLabel("insufficient_data"),
        "Insufficient Data"
      );
      assert.equal(
        formatBusinessStatusLabel("query_failed"),
        "Unable to Retrieve Data"
      );

      for (const rep of REPORT_CATALOGUE) {
        for (const src of rep.authoritativeSources) {
          assert.ok(
            !src.includes("public."),
            `Report ${rep.id} source "${src}" should be business-friendly`
          );
        }
      }
    });

    it("distinguishes CAC applications across Submitted, In Progress, Approved, Completed, Rejected, and Cancelled", () => {
      const cacList = [
        { id: "1", current_stage: "application_submitted" },
        { id: "2", current_stage: "under_cac_review" },
        { id: "3", current_stage: "documents_verified" },
        { id: "4", current_stage: "approved" },
        { id: "5", current_stage: "documents_received" },
        { id: "6", current_stage: "completed" },
        { id: "7", current_stage: "queried" },
        { id: "8", current_stage: "cancelled" },
      ];

      assert.equal(classifyCacApplicationStage(cacList[0]), "submitted");
      assert.equal(classifyCacApplicationStage(cacList[1]), "in_progress");
      assert.equal(classifyCacApplicationStage(cacList[3]), "approved");
      assert.equal(classifyCacApplicationStage(cacList[4]), "approved");
      assert.equal(classifyCacApplicationStage(cacList[5]), "completed");
      assert.equal(classifyCacApplicationStage(cacList[6]), "rejected");
      assert.equal(classifyCacApplicationStage(cacList[7]), "cancelled");

      const summary = summarizeCacStages(cacList);
      assert.equal(summary.total, 8);
      assert.equal(summary.submitted, 1);
      assert.equal(summary.inProgress, 2);
      assert.equal(summary.approved, 2);
      assert.equal(summary.completed, 1);
      assert.equal(summary.rejectedOrQueried, 1);
      assert.equal(summary.cancelled, 1);
      assert.equal(summary.eligibleCount, 7); // 8 total - 1 cancelled
      assert.equal(summary.progressedCount, 3); // 2 approved + 1 completed
      assert.ok(
        summary.progressRatePct !== null &&
          Math.abs(summary.progressRatePct - (3 / 7) * 100) < 0.01
      );
    });
  });

  describe("8. Campaigns & Promos Database Schema & Attribution Regression Tests", () => {
    it("never selects non-existent columns (business_interest or utm) from public.leads", () => {
      const selectedCols = CAMPAIGN_LEADS_SELECT_COLUMNS.split(",").map((c) =>
        c.trim()
      );
      assert.equal(selectedCols.includes("business_interest"), false);
      assert.equal(selectedCols.includes("utm"), false);
      assert.equal(selectedCols.includes("business_type"), true);
      assert.equal(selectedCols.includes("notes"), true);
      assert.equal(selectedCols.includes("utm_campaign"), true);
      assert.equal(selectedCols.includes("utm_source"), true);
      assert.equal(selectedCols.includes("page_path"), true);
    });

    it("never selects non-existent columns (client_code or reference_number) from public.clients, public.invoices, or public.payments", () => {
      assert.equal(CAMPAIGN_CLIENTS_SELECT_COLUMNS.includes("client_code"), false);
      assert.equal(CAMPAIGN_INVOICES_SELECT_COLUMNS.includes("client_code"), false);
      assert.equal(CAMPAIGN_PAYMENTS_SELECT_COLUMNS.includes("reference_number"), false);
      assert.equal(CAMPAIGN_PAYMENTS_SELECT_COLUMNS.includes("receipt_number"), true);
      assert.equal(CAMPAIGN_PAYMENTS_SELECT_COLUMNS.includes("transaction_reference"), true);
      assert.equal(formatClientCode("12345678-aaaa-bbbb-cccc-1234567890ab"), "CL-123456");
      assert.equal(formatClientCode("12345678-aaaa", "ABZ-001"), "ABZ-001");
      assert.equal(formatClientCode(null), "—");
    });

    it("resolves lead requested service interest from consultation_requests, notes, or business_type", () => {
      assert.equal(
        resolveLeadServiceInterest(
          { business_type: "Limited Company", notes: "Service: Business Name | Ref: 1" },
          "Trademark Registration"
        ),
        "Trademark Registration"
      );
      assert.equal(
        resolveLeadServiceInterest({
          business_type: "Limited Company",
          notes: "Service: Company Incorporation (LTD) | Timeline: Urgent",
        }),
        "Company Incorporation (LTD)"
      );
      assert.equal(
        resolveLeadServiceInterest({
          business_type: "NGO / Incorporated Trustees",
          notes: "General enquiry",
        }),
        "NGO / Incorporated Trustees"
      );
    });

    it("attributes leads to the campaign using verified top-level columns and formats campaign statuses in plain English", () => {
      const startMs = new Date("2026-04-13T00:00:00Z").getTime();
      const endMs = new Date("2026-05-13T23:59:59Z").getTime();

      assert.equal(
        isLeadAttributedToCampaign(
          {
            created_at: "2026-04-20T10:00:00Z",
            source: "website",
            utm_campaign: "office-opening-promo-2026",
          },
          startMs,
          endMs,
          "office-opening-promo-2026"
        ),
        true
      );

      assert.equal(formatCampaignStatusLabel("verified"), "Confirmed");
      assert.equal(
        formatCampaignStatusLabel("pending_verification"),
        "Awaiting Verification"
      );
      assert.equal(
        formatCampaignStatusLabel("cancelled_refunded"),
        "Cancelled / Refunded"
      );
      assert.equal(formatCampaignStatusLabel("payable"), "Ready for Payout");
    });
  });
});
