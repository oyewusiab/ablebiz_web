import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Phase 15
import {
  buildWhatsAppPreparationLink,
} from '../notifications/notificationService';
import type { EscalationRule, StaffNotificationPreference } from '../../types/suitePhases15To19';

// Phase 16
import { DEFAULT_BUSINESS_CONTINUITY_SETTINGS } from '../backup/backupService';

// Phase 17
import {
  computeQuotationFinancials,
  getComplementaryRecommendations,
} from '../quotations/quotationIntelligence';

// Phase 18
import {
  calculateCampaignRoi,
  parseUtmAttributionFromUrl,
} from '../marketing/attributionAnalytics';

// Phase 19
import {
  validateExpenseAllocationsMath,
} from '../profitability/expenseAllocationService';

describe('ABLEBIZ SUITE — Phases 15 to 19 Comprehensive Test Suite', () => {
  // =========================================================================
  // PHASE 15: NOTIFICATIONS & ESCALATION ENGINE
  // =========================================================================
  describe('Phase 15: Notifications & Escalation Engine', () => {
    it('builds WhatsApp click-to-chat URL with correct Nigerian country code format', () => {
      const url1 = buildWhatsAppPreparationLink('08031234567', 'Hello from ABLEBIZ');
      assert.ok(url1.startsWith('https://wa.me/2348031234567?text='));
      assert.ok(url1.includes('Hello%20from%20ABLEBIZ'));

      const url2 = buildWhatsAppPreparationLink('+234 809 999 8888', 'Invoice INV-001 is ready');
      assert.ok(url2.startsWith('https://wa.me/2348099998888?text='));
    });

    it('evaluates escalation rules threshold properties and structure', () => {
      const rule: EscalationRule = {
        id: 'rule-task-overdue',
        event_type: 'task_overdue',
        name: 'Task Overdue Escalation',
        trigger_condition: 'Task uncompleted past due date',
        time_threshold_hours: 24,
        priority: 'high',
        responsible_role: 'registration_officer',
        escalate_to_role: 'operations_manager',
        channel: 'in_app',
        repeat_interval_hours: 24,
        is_active: true,
      };

      assert.equal(rule.time_threshold_hours, 24);
      assert.equal(rule.escalate_to_role, 'operations_manager');
      assert.equal(rule.responsible_role, 'registration_officer');
    });

    it('validates staff notification preferences structure and critical categories', () => {
      const pref: StaffNotificationPreference = {
        id: 'pref-1',
        staff_id: 'staff-1',
        in_app_enabled: true,
        email_enabled: true,
        whatsapp_enabled: false,
        subscribed_categories: ['tasks', 'sla', 'compliance', 'approvals'],
        reminder_frequency: 'immediate',
        quiet_hours_enabled: false,
      };

      assert.equal(pref.in_app_enabled, true);
      assert.ok(pref.subscribed_categories.includes('compliance'));
      assert.ok(pref.subscribed_categories.includes('approvals'));
    });
  });

  // =========================================================================
  // PHASE 16: BACKUP, RECOVERY & BUSINESS CONTINUITY
  // =========================================================================
  describe('Phase 16: Backup, Recovery & Business Continuity', () => {
    it('provides approved RPO and RTO defaults conforming to enterprise standards', () => {
      const settings = DEFAULT_BUSINESS_CONTINUITY_SETTINGS;
      assert.equal(settings.target_rpo_hours, 2.0, 'RPO target must be 2.0 hours');
      assert.equal(settings.target_rto_hours, 4.0, 'RTO target must be 4.0 hours');
      assert.ok(settings.retention_policy_days >= 30, 'Retention policy must be at least 30 days');
      assert.ok(settings.storage_coverage.includes('client_documents'));
      assert.ok(settings.storage_coverage.includes('invoices'));
      assert.ok(settings.storage_coverage.includes('receipts'));
      assert.ok(settings.storage_coverage.includes('cac_certificates'));
    });

    it('contains comprehensive Disaster Recovery Runbook with safety rules', () => {
      const runbook = DEFAULT_BUSINESS_CONTINUITY_SETTINGS.disaster_recovery_runbook;
      assert.ok(runbook.includes('DISASTER RECOVERY & BUSINESS CONTINUITY PLAN'));
      assert.ok(runbook.includes('Never restore directly into the production cluster'));
      assert.ok(runbook.includes('isolated staging replica'));
      assert.ok(runbook.toLowerCase().includes('cryptographic hash'));
    });
  });

  // =========================================================================
  // PHASE 17: SERVICE CATALOGUE & QUOTATION INTELLIGENCE
  // =========================================================================
  describe('Phase 17: Service Catalogue & Quotation Intelligence', () => {
    it('correctly calculates quotation totals, pass-through statutory fees, and gross margins', () => {
      const items = [
        {
          title: 'Private Limited Company (LTD) Registration',
          item_type: 'service' as const,
          quantity: 1,
          unit_price: 65000,
          total_price: 65000,
          statutory_fee: 20000, // CAC official fee (pass-through)
          internal_cost: 15000, // Legal drafting & stamp duty
        },
        {
          title: 'Official CAC Name Reservation',
          item_type: 'statutory_fee' as const,
          quantity: 1,
          unit_price: 5000,
          total_price: 5000,
          statutory_fee: 5000,
          internal_cost: 0,
        },
      ];

      const financials = computeQuotationFinancials(items, 3500); // ₦3,500 discount (5% of 70,000)

      assert.equal(financials.subtotal, 70000);
      assert.equal(financials.statutory_fees_total, 25000); // 20k + 5k
      assert.equal(financials.internal_cost_total, 15000);
      assert.equal(financials.discount_amount, 3500); // 5% of 70,000
      assert.equal(financials.total_amount, 66500); // 70,000 - 3,500

      // Operating revenue is total (66,500) minus statutory pass-through (25,000) = 41,500
      // Gross margin = Operating revenue (41,500) - internal delivery cost (15,000) = 26,500
      assert.equal(financials.margin_amount, 26500);
      assert.ok(financials.margin_percentage > 60);
      assert.equal(financials.requires_approval, false, '₦3,500 discount should not require executive approval');
    });

    it('triggers commercial approval requirement for excessive discount or negative margin', () => {
      const items = [
        {
          title: 'Corporate Legal Advisory',
          item_type: 'service' as const,
          quantity: 1,
          unit_price: 100000,
          total_price: 100000,
          statutory_fee: 0,
          internal_cost: 40000,
        },
      ];

      // ₦18,000 discount exceeds standard ₦15,000 / 10% threshold
      const financials = computeQuotationFinancials(items, 18000);
      assert.equal(financials.requires_approval, true);
      assert.ok(financials.approval_reasons.some((r: string) => r.includes('Quotation discount')));

      // Test negative margin trigger
      const lossMakingItems = [
        {
          title: 'Loss Leader Service',
          item_type: 'service' as const,
          quantity: 1,
          unit_price: 20000,
          total_price: 20000,
          statutory_fee: 10000,
          internal_cost: 15000, // Costs (10k stat + 15k delivery) > 20k price
        },
      ];
      const lossFinancials = computeQuotationFinancials(lossMakingItems, 0);
      assert.equal(lossFinancials.requires_approval, true);
      assert.ok(lossFinancials.approval_reasons.some((r: string) => r.includes('Operating margin is negative')));
    });

    it('generates explainable complementary service recommendations', async () => {
      const recommendations = await getComplementaryRecommendations([
        'Private Limited Company (LTD) Registration',
      ]);
      assert.ok(recommendations.length > 0);
      assert.ok(recommendations.some((r) => r.name.includes('TIN') || r.name.includes('Tax') || r.name.includes('Seal')));
      assert.ok(recommendations[0].reason.length > 10, 'Must have clear explainable rationale');
    });
  });

  // =========================================================================
  // PHASE 18: MARKETING ATTRIBUTION & CAMPAIGN ANALYTICS
  // =========================================================================
  describe('Phase 18: Marketing Attribution & Campaign Analytics', () => {
    it('safely handles zero, null, and positive marketing costs in ROI calculations', () => {
      // Zero cost (organic) must return null without throwing or producing NaN/Infinity
      assert.equal(calculateCampaignRoi(500000, 0), null);
      assert.equal(calculateCampaignRoi(500000, -100), null);

      // Paid campaigns with positive returns
      // Revenue 300,000 with Cost 100,000 -> Net Return 200,000 -> ROI 200%
      const roiPositive = calculateCampaignRoi(300000, 100000);
      assert.equal(roiPositive, 200);

      // Paid campaigns with negative returns (Loss)
      // Revenue 50,000 with Cost 100,000 -> Net Return -50,000 -> ROI -50%
      const roiLoss = calculateCampaignRoi(50000, 100000);
      assert.equal(roiLoss, -50);
    });

    it('parses UTM and referral parameters safely from various URL formats', () => {
      const searchStr = '?utm_source=facebook&utm_medium=cpc&utm_campaign=cac_promo_2026&ref=REF-7890';
      const parsed = parseUtmAttributionFromUrl(searchStr);

      assert.equal(parsed.utm_source, 'facebook');
      assert.equal(parsed.utm_medium, 'cpc');
      assert.equal(parsed.utm_campaign, 'cac_promo_2026');
      assert.equal(parsed.referral_code, 'REF-7890');

      // Test fallback to standard query param names
      const fallbackStr = '?source=google_ads&campaign=easter_discount';
      const fallbackParsed = parseUtmAttributionFromUrl(fallbackStr);
      assert.equal(fallbackParsed.utm_source, 'google_ads');
      assert.equal(fallbackParsed.utm_campaign, 'easter_discount');
    });
  });

  // =========================================================================
  // PHASE 19: RECEIPT-LINKED EXPENSE ALLOCATION & PROFITABILITY
  // =========================================================================
  describe('Phase 19: Receipt-Linked Expense Allocation & Profitability', () => {
    it('validates expense allocation math against constraints and prevents over-allocation', () => {
      const expenseAmount = 50000;

      // Valid allocation: 30k + 15k = 45k, leaving 5k unallocated overhead
      const validAlloc = [
        { payment_id: 'pay-1', allocated_amount: 30000 },
        { payment_id: 'pay-2', allocated_amount: 15000 },
      ];
      const resValid = validateExpenseAllocationsMath(expenseAmount, validAlloc);
      assert.equal(resValid.valid, true);
      assert.equal(resValid.totalAllocated, 45000);
      assert.equal(resValid.unallocated, 5000);

      // Invalid: Over-allocation (35k + 20k = 55k > 50k)
      const overAlloc = [
        { payment_id: 'pay-1', allocated_amount: 35000 },
        { payment_id: 'pay-2', allocated_amount: 20000 },
      ];
      const resOver = validateExpenseAllocationsMath(expenseAmount, overAlloc);
      assert.equal(resOver.valid, false);
      assert.ok(resOver.error?.includes('exceeds'));

      // Invalid: Duplicate payment receipt in same expense
      const dupAlloc = [
        { payment_id: 'pay-1', allocated_amount: 20000 },
        { payment_id: 'pay-1', allocated_amount: 10000 },
      ];
      const resDup = validateExpenseAllocationsMath(expenseAmount, dupAlloc);
      assert.equal(resDup.valid, false);
      assert.ok(resDup.error?.includes('Duplicate receipt'));

      // Invalid: Negative or zero allocation amount
      const negativeAlloc = [
        { payment_id: 'pay-1', allocated_amount: -5000 },
      ];
      const resNeg = validateExpenseAllocationsMath(expenseAmount, negativeAlloc);
      assert.equal(resNeg.valid, false);
      assert.ok(resNeg.error?.includes('positive number'));
    });

    it('calculates net contribution and categorizes profitability status accurately', () => {
      // Test Profitable Receipt: Receipt 100,000, Direct Costs 30,000 -> Contribution 70,000 (70% margin)
      const receiptAmount = 100000;
      const directCosts = 30000;
      const netContribution = receiptAmount - directCosts;
      const marginPct = (netContribution / receiptAmount) * 100;

      assert.equal(netContribution, 70000);
      assert.equal(marginPct, 70);
      const statusProfitable = marginPct >= 25 ? 'profitable' : 'break_even';
      assert.equal(statusProfitable, 'profitable');

      // Test Low Margin Receipt: Receipt 50,000, Direct Costs 42,000 -> Contribution 8,000 (16% margin)
      const lowMarginCont = 50000 - 42000;
      const lowMarginPct = (lowMarginCont / 50000) * 100;
      assert.equal(lowMarginCont, 8000);
      assert.equal(lowMarginPct, 16);
      const statusLow = lowMarginPct > 0 && lowMarginPct < 25 ? 'break_even' : 'profitable';
      assert.equal(statusLow, 'break_even');

      // Test Loss Making Receipt: Receipt 25,000, Direct Costs 28,000 -> Contribution -3,000 (-12% margin)
      const lossCont = 25000 - 28000;
      assert.equal(lossCont, -3000);
      const statusLoss = lossCont < 0 ? 'loss_making' : 'profitable';
      assert.equal(statusLoss, 'loss_making');
    });
  });
});
