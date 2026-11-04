import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateReferralMilestoneReward,
    validateReferralQualification,
    calculateCampaignLinePricing,
    deduplicateQualifiedReferrals,
    getEffectiveCampaignStatusInLagos,
    isPaymentWithinCampaignWindowInLagos,
    matchServiceToCampaignPrice,
    getCampaignRolePermissions,
    APPROVED_CAMPAIGN_SERVICES,
    APPROVED_REFERRAL_MILESTONES,
    OFFICE_OPENING_CAMPAIGN_SLUG,
    type ReferralVerificationStatus,
} from '../campaignEngine';

describe('ABLEBIZ Office Opening Special Promo & Referral Rewards — Engine Tests', () => {
    // --------------------------------------------------------------------------
    // 1. Cumulative Milestone Calculations (Section 3.3 of Policy)
    // --------------------------------------------------------------------------
    describe('Referral Milestone Calculations (Cumulative Totals, Not Additive)', () => {
        it('calculates 0 referrals -> ₦0', () => {
            const res = calculateReferralMilestoneReward(0);
            assert.equal(res.milestoneReached, 0);
            assert.equal(res.totalRewardEarned, 0);
            assert.equal(res.additionalRewardAtMilestone, 0);
            assert.equal(res.nextMilestone, 1);
            assert.equal(res.nextMilestoneTotalReward, 2000);
            assert.equal(res.remainingToNextMilestone, 1);
        });

        it('calculates 1 referral -> ₦2,000 (Add ₦2,000)', () => {
            const res = calculateReferralMilestoneReward(1);
            assert.equal(res.milestoneReached, 1);
            assert.equal(res.totalRewardEarned, 2000);
            assert.equal(res.additionalRewardAtMilestone, 2000);
            assert.equal(res.nextMilestone, 3);
            assert.equal(res.nextMilestoneTotalReward, 7500);
            assert.equal(res.remainingToNextMilestone, 2);
        });

        it('calculates 2 referrals -> ₦2,000 (Milestone 1 retained until 3 reached)', () => {
            const res = calculateReferralMilestoneReward(2);
            assert.equal(res.milestoneReached, 1);
            assert.equal(res.totalRewardEarned, 2000);
            assert.equal(res.nextMilestone, 3);
            assert.equal(res.remainingToNextMilestone, 1);
        });

        it('calculates 3 referrals -> ₦7,500 (Add ₦5,500 at milestone, NOT ₦2,000 + ₦7,500)', () => {
            const res = calculateReferralMilestoneReward(3);
            assert.equal(res.milestoneReached, 3);
            assert.equal(res.totalRewardEarned, 7500);
            assert.equal(res.additionalRewardAtMilestone, 5500);
            assert.equal(res.nextMilestone, 5);
            assert.equal(res.nextMilestoneTotalReward, 15000);
            assert.equal(res.remainingToNextMilestone, 2);
        });

        it('calculates 4 referrals -> ₦7,500', () => {
            const res = calculateReferralMilestoneReward(4);
            assert.equal(res.milestoneReached, 3);
            assert.equal(res.totalRewardEarned, 7500);
            assert.equal(res.remainingToNextMilestone, 1);
        });

        it('calculates 5 referrals -> ₦15,000 (Add ₦7,500 at milestone)', () => {
            const res = calculateReferralMilestoneReward(5);
            assert.equal(res.milestoneReached, 5);
            assert.equal(res.totalRewardEarned, 15000);
            assert.equal(res.additionalRewardAtMilestone, 7500);
            assert.equal(res.nextMilestone, 10);
            assert.equal(res.nextMilestoneTotalReward, 35000);
            assert.equal(res.remainingToNextMilestone, 5);
        });

        it('calculates 9 referrals -> ₦15,000 (1 away from champion milestone)', () => {
            const res = calculateReferralMilestoneReward(9);
            assert.equal(res.milestoneReached, 5);
            assert.equal(res.totalRewardEarned, 15000);
            assert.equal(res.nextMilestone, 10);
            assert.equal(res.remainingToNextMilestone, 1);
        });

        it('calculates 10 referrals -> ₦35,000 (Add ₦20,000 at top milestone)', () => {
            const res = calculateReferralMilestoneReward(10);
            assert.equal(res.milestoneReached, 10);
            assert.equal(res.totalRewardEarned, 35000);
            assert.equal(res.additionalRewardAtMilestone, 20000);
            assert.equal(res.nextMilestone, null);
            assert.equal(res.remainingToNextMilestone, 0);
        });

        it('calculates 15 referrals -> ₦35,000 (Capped at top milestone reward)', () => {
            const res = calculateReferralMilestoneReward(15);
            assert.equal(res.milestoneReached, 10);
            assert.equal(res.totalRewardEarned, 35000);
            assert.equal(res.nextMilestone, null);
        });
    });

    // --------------------------------------------------------------------------
    // 2. Approved Service Pricing & Gross Profit Calculations (Policy Section 2.1)
    // --------------------------------------------------------------------------
    describe('Approved Promotional Pricing & Gross Profit', () => {
        it('verifies Business Name Registration: ₦40k - 25% -> ₦30k (GP ₦5,000)', () => {
            const bn = APPROVED_CAMPAIGN_SERVICES.find((s) => s.service_code === 'business_name_reg')!;
            assert.equal(bn.regular_professional_fee, 40000);
            assert.equal(bn.discount_percentage, 25);
            assert.equal(bn.promo_professional_fee, 30000);
            assert.equal(bn.direct_cost_estimate, 25000);
            assert.equal(bn.expected_gross_profit, 5000);
        });

        it('verifies Company Registration: ₦65k - 30% -> ₦45,500 (GP ₦10,500)', () => {
            const co = APPROVED_CAMPAIGN_SERVICES.find((s) => s.service_code === 'company_reg')!;
            assert.equal(co.regular_professional_fee, 65000);
            assert.equal(co.discount_percentage, 30);
            assert.equal(co.promo_professional_fee, 45500);
            assert.equal(co.direct_cost_estimate, 35000);
            assert.equal(co.expected_gross_profit, 10500);
        });

        it('verifies NGO Registration: ₦160k - 10% -> ₦144,000 (GP ₦4,000)', () => {
            const ngo = APPROVED_CAMPAIGN_SERVICES.find((s) => s.service_code === 'ngo_reg')!;
            assert.equal(ngo.regular_professional_fee, 160000);
            assert.equal(ngo.discount_percentage, 10);
            assert.equal(ngo.promo_professional_fee, 144000);
            assert.equal(ngo.direct_cost_estimate, 140000);
            assert.equal(ngo.expected_gross_profit, 4000);
        });

        it('verifies SCUML Assistance: ₦40k - 20% -> ₦32,000 (GP ₦4,000)', () => {
            const scuml = APPROVED_CAMPAIGN_SERVICES.find((s) => s.service_code === 'scuml_assistance')!;
            assert.equal(scuml.regular_professional_fee, 40000);
            assert.equal(scuml.discount_percentage, 20);
            assert.equal(scuml.promo_professional_fee, 32000);
            assert.equal(scuml.direct_cost_estimate, 28000);
            assert.equal(scuml.expected_gross_profit, 4000);
        });

        it('verifies Annual Returns – Business Name: ₦15k - 8% -> ₦13,800 (GP ₦4,800)', () => {
            const arBn = APPROVED_CAMPAIGN_SERVICES.find((s) => s.service_code === 'annual_returns_bn')!;
            assert.equal(arBn.regular_professional_fee, 15000);
            assert.equal(arBn.discount_percentage, 8);
            assert.equal(arBn.promo_professional_fee, 13800);
            assert.equal(arBn.direct_cost_estimate, 9000);
            assert.equal(arBn.expected_gross_profit, 4800);
        });

        it('verifies Annual Returns – Company: ₦16k - 10% -> ₦14,400 (GP ₦5,400)', () => {
            const arCo = APPROVED_CAMPAIGN_SERVICES.find((s) => s.service_code === 'annual_returns_company')!;
            assert.equal(arCo.regular_professional_fee, 16000);
            assert.equal(arCo.discount_percentage, 10);
            assert.equal(arCo.promo_professional_fee, 14400);
            assert.equal(arCo.direct_cost_estimate, 9000);
            assert.equal(arCo.expected_gross_profit, 5400);
        });
    });

    // --------------------------------------------------------------------------
    // 3. Line Pricing & Statutory Fee Exclusion (Section 2.2 & Part 5)
    // --------------------------------------------------------------------------
    describe('Line Pricing, Statutory Fee Exclusion & Double Discounting Prevention', () => {
        it('applies discount strictly to professional fee and leaves statutory fee intact', () => {
            const res = calculateCampaignLinePricing({
                regularProfessionalFee: 65000,
                discountPercentage: 30,
                statutoryOrThirdPartyFee: 20000, // CAC filing fee
                quantity: 1,
                isCampaignActiveOrPreview: true,
                isServiceEligible: true,
            });

            assert.equal(res.regularProfessionalFeeTotal, 65000);
            assert.equal(res.discountAmountTotal, 19500);
            assert.equal(res.promoProfessionalFeeTotal, 45500);
            assert.equal(res.statutoryFeeTotal, 20000);
            assert.equal(res.totalPayableAmount, 65500); // 45,500 + 20,000
        });

        it('flags double discounting when manual header discount is stacked on promo price', () => {
            const res = calculateCampaignLinePricing({
                regularProfessionalFee: 40000,
                discountPercentage: 25,
                quantity: 1,
                isCampaignActiveOrPreview: true,
                isServiceEligible: true,
                existingManualDiscountAmount: 5000,
            });

            assert.equal(res.doubleDiscountPrevented, true);
        });

        it('does not apply promotional discount if campaign is not active/preview or service is ineligible', () => {
            const res = calculateCampaignLinePricing({
                regularProfessionalFee: 40000,
                discountPercentage: 25,
                quantity: 1,
                isCampaignActiveOrPreview: false,
                isServiceEligible: true,
            });

            assert.equal(res.discountPercentageApplied, 0);
            assert.equal(res.promoProfessionalFeeTotal, 40000);
        });
    });

    // --------------------------------------------------------------------------
    // 4. Referral Qualification Rules Validation (8 Policy Rules)
    // --------------------------------------------------------------------------
    describe('Referral Qualification Rule Engine (Policy Section 3.4)', () => {
        const validBaseline = {
            referrerCode: 'ABL-REF-001',
            referrerPhone: '08011112222',
            referrerEmail: 'partner@example.com',
            customerName: 'Adebayo Johnson',
            customerPhone: '08099998888',
            customerEmail: 'adebayo@example.com',
            isNewCustomer: true,
            serviceCodeOrName: 'Company Registration',
            isFullPaymentReceived: true,
            paymentDateIso: '2026-11-10T14:30:00+01:00', // Within Nov 5 - Nov 20, 2026
            referrerIdentifiedBeforeOrAtPayment: true,
            isCancelledOrRefunded: false,
        };

        it('qualifies a genuine new customer referral with full payment in campaign window', () => {
            const res = validateReferralQualification(validBaseline);
            assert.equal(res.isQualified, true);
            assert.equal(res.reasons.length, 0);
        });

        it('disqualifies self-referrals (matching phone or email)', () => {
            const resPhone = validateReferralQualification({
                ...validBaseline,
                customerPhone: '08011112222', // Same as referrer
            });
            assert.equal(resPhone.isQualified, false);
            assert.ok(resPhone.reasons.some((r) => r.includes('Self-referral prohibited')));

            const resEmail = validateReferralQualification({
                ...validBaseline,
                customerEmail: 'partner@example.com', // Same as referrer
            });
            assert.equal(resEmail.isQualified, false);
            assert.ok(resEmail.reasons.some((r) => r.includes('Self-referral prohibited')));
        });

        it('disqualifies existing customers (not a new customer to ABLEBIZ)', () => {
            const res = validateReferralQualification({
                ...validBaseline,
                isNewCustomer: false,
            });
            assert.equal(res.isQualified, false);
            assert.ok(res.reasons.some((r) => r.includes('existing customer')));
        });

        it('disqualifies payments received outside campaign window (before Nov 5 or after Nov 20)', () => {
            const resBefore = validateReferralQualification({
                ...validBaseline,
                paymentDateIso: '2026-11-04T22:00:00+01:00', // Before campaign start
            });
            assert.equal(resBefore.isQualified, false);
            assert.ok(resBefore.reasons.some((r) => r.includes('official campaign window')));

            const resAfter = validateReferralQualification({
                ...validBaseline,
                paymentDateIso: '2026-11-21T09:00:00+01:00', // After campaign end
            });
            assert.equal(resAfter.isQualified, false);
            assert.ok(resAfter.reasons.some((r) => r.includes('official campaign window')));
        });

        it('disqualifies non-eligible services', () => {
            const res = validateReferralQualification({
                ...validBaseline,
                serviceCodeOrName: 'Custom Web Design & Hosting',
            });
            assert.equal(res.isQualified, false);
            assert.ok(res.reasons.some((r) => r.includes('not an eligible campaign service')));
        });

        it('disqualifies cancelled or refunded transactions', () => {
            const res = validateReferralQualification({
                ...validBaseline,
                isCancelledOrRefunded: true,
            });
            assert.equal(res.isQualified, false);
            assert.ok(res.reasons.some((r) => r.includes('cancelled or refunded')));
        });

        it('disqualifies attribution if another referrer was already credited for this customer', () => {
            const res = validateReferralQualification({
                ...validBaseline,
                existingCreditedReferrerForCustomer: 'ABL-REF-EARLIER',
            });
            assert.equal(res.isQualified, false);
            assert.ok(res.reasons.some((r) => r.includes('already credited to another referrer')));
        });
    });

    // --------------------------------------------------------------------------
    // 5. Anti-Duplicate Deduplication (Single Referrer & Multi-Service = 1 Referral)
    // --------------------------------------------------------------------------
    describe('Deduplication: Single Referrer & Multi-Service Rules', () => {
        it('ensures multiple services purchased by the same customer count as ONE referral', () => {
            const raw = [
                {
                    id: 'event-1',
                    referrer_code: 'ABL-REF-001',
                    client_id: 'client-100',
                    verification_status: 'successful' as ReferralVerificationStatus,
                    created_at: '2026-11-06T10:00:00Z',
                },
                {
                    id: 'event-2',
                    referrer_code: 'ABL-REF-001',
                    client_id: 'client-100', // Same client purchasing a second service (e.g. SCUML)
                    verification_status: 'successful' as ReferralVerificationStatus,
                    created_at: '2026-11-08T12:00:00Z',
                },
            ];

            const { qualifiedByReferrer } = deduplicateQualifiedReferrals(raw);
            assert.equal(qualifiedByReferrer['ABL-REF-001'].length, 1);
        });

        it('ensures the same customer cannot be credited to two different referrers', () => {
            const raw = [
                {
                    id: 'event-1',
                    referrer_code: 'ABL-REF-FIRST',
                    client_id: 'client-555',
                    verification_status: 'successful' as ReferralVerificationStatus,
                    created_at: '2026-11-06T10:00:00Z',
                },
                {
                    id: 'event-2',
                    referrer_code: 'ABL-REF-SECOND',
                    client_id: 'client-555', // Duplicate claim
                    verification_status: 'successful' as ReferralVerificationStatus,
                    created_at: '2026-11-07T10:00:00Z',
                },
            ];

            const { qualifiedByReferrer, customerFirstReferrerMap } = deduplicateQualifiedReferrals(raw);
            assert.equal(customerFirstReferrerMap['client:client-555'], 'ABL-REF-FIRST');
            assert.equal(qualifiedByReferrer['ABL-REF-FIRST'].length, 1);
            assert.equal(qualifiedByReferrer['ABL-REF-SECOND'], undefined);
        });
    });

    // --------------------------------------------------------------------------
    // 6. Africa/Lagos Timezone Campaign Status Boundaries
    // --------------------------------------------------------------------------
    describe('Africa/Lagos Timezone Campaign Status Evaluation', () => {
        const startIso = '2026-11-05T00:00:00+01:00';
        const endIso = '2026-11-20T23:59:59+01:00';

        it('evaluates status as "scheduled" 1 minute before start date', () => {
            const justBefore = new Date('2026-11-04T23:59:00+01:00');
            const status = getEffectiveCampaignStatusInLagos('active', startIso, endIso, justBefore);
            assert.equal(status, 'scheduled');
        });

        it('evaluates status as "active" exactly at start date (2026-11-05 00:00:00 WAT)', () => {
            const exactStart = new Date('2026-11-05T00:00:00+01:00');
            const status = getEffectiveCampaignStatusInLagos('active', startIso, endIso, exactStart);
            assert.equal(status, 'active');
        });

        it('evaluates status as "active" during campaign window (2026-11-12 12:00:00 WAT)', () => {
            const midCampaign = new Date('2026-11-12T12:00:00+01:00');
            const status = getEffectiveCampaignStatusInLagos('active', startIso, endIso, midCampaign);
            assert.equal(status, 'active');
        });

        it('evaluates status as "active" at the final second (2026-11-20 23:59:59 WAT)', () => {
            const finalSecond = new Date('2026-11-20T23:59:59+01:00');
            const status = getEffectiveCampaignStatusInLagos('active', startIso, endIso, finalSecond);
            assert.equal(status, 'active');
        });

        it('evaluates status as "completed" 1 second after cutoff (2026-11-21 00:00:00 WAT)', () => {
            const afterEnd = new Date('2026-11-21T00:00:00+01:00');
            const status = getEffectiveCampaignStatusInLagos('active', startIso, endIso, afterEnd);
            assert.equal(status, 'completed');
        });
    });

    // --------------------------------------------------------------------------
    // 7. Role-Based Access Control (RBAC) across 8 Canonical Staff Roles
    // --------------------------------------------------------------------------
    describe('Campaign Module RBAC Permissions', () => {
        it('gives Super Admin and Admin full configuration, pricing, and payout permissions', () => {
            const superAdmin = getCampaignRolePermissions('super_admin');
            const admin = getCampaignRolePermissions('admin');
            assert.equal(superAdmin.canEditCampaignConfig, true);
            assert.equal(superAdmin.canEditCampaignPricing, true);
            assert.equal(superAdmin.canApproveRewardPayouts, true);
            assert.equal(superAdmin.canRecordRewardPayouts, true);

            assert.equal(admin.canEditCampaignConfig, true);
            assert.equal(admin.canEditCampaignPricing, true);
            assert.equal(admin.canApproveRewardPayouts, true);
        });

        it('allows Operations Manager to edit config and pricing but not approve/record cash payouts', () => {
            const ops = getCampaignRolePermissions('operations_manager');
            assert.equal(ops.canEditCampaignConfig, true);
            assert.equal(ops.canEditCampaignPricing, true);
            assert.equal(ops.canVerifyReferrals, true);
            assert.equal(ops.canApproveRewardPayouts, false);
            assert.equal(ops.canRecordRewardPayouts, false);
        });

        it('allows Accounts Officer to verify referrals and process payouts, but not change central pricing catalog', () => {
            const acct = getCampaignRolePermissions('accounts_officer');
            assert.equal(acct.canEditCampaignConfig, false);
            assert.equal(acct.canEditCampaignPricing, false);
            assert.equal(acct.canVerifyReferrals, true);
            assert.equal(acct.canRecordRewardPayouts, true);
        });

        it('restricts Viewer to read-only dashboard access', () => {
            const viewer = getCampaignRolePermissions('viewer');
            assert.equal(viewer.canViewDashboard, true);
            assert.equal(viewer.canEditCampaignConfig, false);
            assert.equal(viewer.canEditCampaignPricing, false);
            assert.equal(viewer.canVerifyReferrals, false);
            assert.equal(viewer.canRecordRewardPayouts, false);
        });
    });
});
