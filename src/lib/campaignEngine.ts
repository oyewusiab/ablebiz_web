import { supabase } from './supabaseClient';
import type { CanonicalStaffRole } from '../auth/roleConfig';

export const OFFICE_OPENING_CAMPAIGN_SLUG = 'office-opening-promo-2026';
export const CAMPAIGN_TIMEZONE = 'Africa/Lagos';

export type CampaignConfiguredStatus =
    | 'draft'
    | 'scheduled'
    | 'active'
    | 'paused'
    | 'completed'
    | 'archived';

export type CampaignEffectiveStatus =
    | 'draft'
    | 'scheduled'
    | 'active'
    | 'paused'
    | 'completed'
    | 'archived';

export type ReferralVerificationStatus =
    | 'pending'
    | 'under_review'
    | 'successful'
    | 'disqualified'
    | 'disputed'
    | 'cancelled_refunded';

export type ReferralPayoutStatus =
    | 'pending_verification'
    | 'verified'
    | 'payable'
    | 'processing'
    | 'paid'
    | 'on_hold'
    | 'disqualified';

export interface CampaignPerformanceTargets {
    new_customers_acquired: number;
    successful_referrals: number;
    business_name_registrations: number;
    company_registrations: number;
    ngo_registrations: number;
    scuml_services: number;
    annual_returns_services: number;
    total_service_transactions: number;
    referral_participants: number;
    customer_inquiries: number;
}

export interface CampaignConfig {
    id: string;
    slug: string;
    name: string;
    description: string;
    campaign_type: string;
    start_date: string;
    end_date: string;
    timezone: string;
    configured_status: CampaignConfiguredStatus;
    effective_status: CampaignEffectiveStatus;
    promo_headline: string;
    referral_headline: string;
    tagline: string;
    location: string;
    terms_and_conditions: string[];
    performance_targets: CampaignPerformanceTargets;
    is_publicly_visible: boolean;
    spin_and_win_paused: boolean;
    allow_preview_pricing: boolean;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface CampaignServicePrice {
    id: string;
    campaign_id: string;
    service_id?: string | null;
    service_code: string;
    service_name: string;
    category: string;
    regular_professional_fee: number;
    discount_percentage: number;
    promo_professional_fee: number;
    direct_cost_estimate: number;
    expected_gross_profit: number;
    is_eligible: boolean;
    sort_order: number;
    notes?: string | null;
    updated_by?: string | null;
    updated_at?: string;
}

export interface CampaignReferralMilestone {
    id: string;
    campaign_id: string;
    referrals_required: number;
    total_reward_ngn: number;
    additional_reward_ngn: number;
    label: string;
    description: string;
    is_active: boolean;
    sort_order: number;
}

export interface MilestoneCalculationResult {
    successfulReferrals: number;
    milestoneReached: 0 | 1 | 3 | 5 | 10;
    totalRewardEarned: number;
    additionalRewardAtMilestone: number;
    nextMilestone: 1 | 3 | 5 | 10 | null;
    nextMilestoneTotalReward: number | null;
    remainingToNextMilestone: number;
}

export interface CampaignPublicBundle {
    campaign: CampaignConfig;
    services: CampaignServicePrice[];
    milestones: CampaignReferralMilestone[];
    serverTimeUtc: string;
    source: 'supabase_rpc' | 'supabase_tables' | 'policy_baseline';
}

export interface ReferralQualificationInput {
    referrerCode: string;
    referrerPhone?: string | null;
    referrerEmail?: string | null;
    referrerLeadId?: string | null;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerLeadId?: string | null;
    clientId?: string | null;
    isNewCustomer: boolean;
    serviceCodeOrName: string;
    eligibleServiceNamesOrCodes?: string[];
    isFullPaymentReceived: boolean;
    paymentDateIso?: string | null;
    campaignStartIso?: string;
    campaignEndIso?: string;
    referrerIdentifiedBeforeOrAtPayment: boolean;
    isCancelledOrRefunded: boolean;
    existingCreditedReferrerForCustomer?: string | null;
}

export interface ReferralQualificationResult {
    isQualified: boolean;
    reasons: string[];
}

export interface CampaignLinePricingInput {
    regularProfessionalFee: number;
    discountPercentage: number;
    directCostEstimate?: number;
    statutoryOrThirdPartyFee?: number;
    quantity?: number;
    isCampaignActiveOrPreview: boolean;
    isServiceEligible: boolean;
    existingManualDiscountAmount?: number;
}

export interface CampaignLinePricingResult {
    regularProfessionalFeeTotal: number;
    discountPercentageApplied: number;
    discountAmountTotal: number;
    promoProfessionalFeeTotal: number;
    statutoryFeeTotal: number;
    totalPayableAmount: number;
    directCostTotal: number;
    expectedGrossProfit: number;
    doubleDiscountPrevented: boolean;
}

export interface CampaignRolePermissions {
    canViewDashboard: boolean;
    canEditCampaignConfig: boolean;
    canEditCampaignPricing: boolean;
    canApplyCampaignPricingInQuotesInvoices: boolean;
    canManualOverrideCampaignDiscount: boolean;
    canVerifyReferrals: boolean;
    canApproveRewardPayouts: boolean;
    canRecordRewardPayouts: boolean;
    canExportReports: boolean;
}

// ==============================================================================
// AUTHORITATIVE APPROVED CAMPAIGN POLICY BASELINE
// (Used when initializing or if public user is offline; Supabase is authoritative)
// ==============================================================================

export const APPROVED_CAMPAIGN_TERMS: string[] = [
    'The ABLEBIZ Office Opening Special Promo & Referral Rewards Campaign runs from November 5, 2026 (00:00 WAT) to November 20, 2026 (23:59 WAT), inclusive (16 calendar days).',
    'Promotional discounts apply strictly to ABLEBIZ professional service fees on the six (6) listed eligible services only.',
    'CAC filing fees, statutory fees, stamp duties, government charges, regulatory fees, and third-party disbursements are excluded unless expressly stated otherwise.',
    'To qualify for the promotional pricing, the full promotional amount must be paid and confirmed within the campaign period (November 5 – November 20, 2026).',
    'Promotional discounts cannot be combined with Spin & Win rewards, vouchers, or any other promotional offers.',
    'A referral is counted as successful ONLY when: (a) the referred client is a new customer to ABLEBIZ; (b) the customer purchases an eligible campaign service; (c) full payment is received within the campaign period; (d) the referrer is identified by name or referral code before or at initial engagement/payment; and (e) the transaction is genuine, verified, and not cancelled or refunded.',
    'Multiple services purchased by one referred customer count as ONE (1) referral unless expressly approved by management.',
    'Only ONE (1) referrer may be credited per new customer. Self-referrals (where referrer and customer share identity, phone, or email) are strictly prohibited.',
    'Referral rewards are cumulative milestone totals (1 referral = ₦2,000 total; 3 referrals = ₦7,500 total; 5 referrals = ₦15,000 total; 10 referrals = ₦35,000 total) and are not paid as separate additive bonuses on top of earlier milestones.',
    'All referral rewards are subject to post-campaign verification and audit after November 20, 2026.',
    "Approved referral payouts are paid via bank transfer to the referrer's designated Nigerian bank account within 5 to 7 business days after final campaign verification.",
    'ABLEBIZ reserves the right to withhold, adjust, or disqualify any discount or referral reward where fraud, duplicate registration, misrepresentation, or abuse of campaign rules is detected.',
    'ABLEBIZ reserves the right to amend, suspend, extend, or terminate this campaign where necessary in accordance with business and regulatory requirements.'
];

export const APPROVED_PERFORMANCE_TARGETS: CampaignPerformanceTargets = {
    new_customers_acquired: 30,
    successful_referrals: 50,
    business_name_registrations: 10,
    company_registrations: 8,
    ngo_registrations: 3,
    scuml_services: 5,
    annual_returns_services: 10,
    total_service_transactions: 36,
    referral_participants: 20,
    customer_inquiries: 100,
};

export const APPROVED_CAMPAIGN_SERVICES: CampaignServicePrice[] = [
    {
        id: 'csp-business-name-reg',
        campaign_id: 'campaign-office-opening-2026',
        service_code: 'business_name_reg',
        service_name: 'Business Name Registration',
        category: 'CAC Registration',
        regular_professional_fee: 40000,
        discount_percentage: 25,
        promo_professional_fee: 30000,
        direct_cost_estimate: 25000,
        expected_gross_profit: 5000,
        is_eligible: true,
        sort_order: 1,
        notes: 'Applies to ABLEBIZ professional service fee only. CAC/statutory charges excluded unless stated.',
    },
    {
        id: 'csp-company-reg',
        campaign_id: 'campaign-office-opening-2026',
        service_code: 'company_reg',
        service_name: 'Company Registration',
        category: 'CAC Registration',
        regular_professional_fee: 65000,
        discount_percentage: 30,
        promo_professional_fee: 45500,
        direct_cost_estimate: 35000,
        expected_gross_profit: 10500,
        is_eligible: true,
        sort_order: 2,
        notes: 'Applies to ABLEBIZ professional service fee only (Standard 1M share capital LLC).',
    },
    {
        id: 'csp-ngo-reg',
        campaign_id: 'campaign-office-opening-2026',
        service_code: 'ngo_reg',
        service_name: 'NGO Registration',
        category: 'CAC Registration',
        regular_professional_fee: 160000,
        discount_percentage: 10,
        promo_professional_fee: 144000,
        direct_cost_estimate: 140000,
        expected_gross_profit: 4000,
        is_eligible: true,
        sort_order: 3,
        notes: 'Applies to ABLEBIZ professional service fee for Incorporated Trustees (Part F).',
    },
    {
        id: 'csp-scuml-assistance',
        campaign_id: 'campaign-office-opening-2026',
        service_code: 'scuml_assistance',
        service_name: 'SCUML Assistance',
        category: 'Regulatory Compliance',
        regular_professional_fee: 40000,
        discount_percentage: 20,
        promo_professional_fee: 32000,
        direct_cost_estimate: 28000,
        expected_gross_profit: 4000,
        is_eligible: true,
        sort_order: 4,
        notes: 'EFCC SCUML DNFBP registration and compliance processing support.',
    },
    {
        id: 'csp-annual-returns-bn',
        campaign_id: 'campaign-office-opening-2026',
        service_code: 'annual_returns_bn',
        service_name: 'Annual Returns – Business Name',
        category: 'Post-Incorporation & Filing',
        regular_professional_fee: 15000,
        discount_percentage: 8,
        promo_professional_fee: 13800,
        direct_cost_estimate: 9000,
        expected_gross_profit: 4800,
        is_eligible: true,
        sort_order: 5,
        notes: 'CAC statutory annual return filing for Business Names (per year).',
    },
    {
        id: 'csp-annual-returns-company',
        campaign_id: 'campaign-office-opening-2026',
        service_code: 'annual_returns_company',
        service_name: 'Annual Returns – Company',
        category: 'Post-Incorporation & Filing',
        regular_professional_fee: 16000,
        discount_percentage: 10,
        promo_professional_fee: 14400,
        direct_cost_estimate: 9000,
        expected_gross_profit: 5400,
        is_eligible: true,
        sort_order: 6,
        notes: 'CAC statutory annual return filing for Limited Liability Companies (per year).',
    },
];

export const APPROVED_REFERRAL_MILESTONES: CampaignReferralMilestone[] = [
    {
        id: 'crm-milestone-1',
        campaign_id: 'campaign-office-opening-2026',
        referrals_required: 1,
        total_reward_ngn: 2000,
        additional_reward_ngn: 2000,
        label: 'Starter Milestone (1 Referral)',
        description: 'Reach 1 verified successful referral during the campaign period for a total reward of ₦2,000.',
        is_active: true,
        sort_order: 1,
    },
    {
        id: 'crm-milestone-3',
        campaign_id: 'campaign-office-opening-2026',
        referrals_required: 3,
        total_reward_ngn: 7500,
        additional_reward_ngn: 5500,
        label: 'Bronze Milestone (3 Referrals)',
        description: 'Reach 3 verified successful referrals for a cumulative total reward of ₦7,500 (+₦5,500 additional at milestone).',
        is_active: true,
        sort_order: 2,
    },
    {
        id: 'crm-milestone-5',
        campaign_id: 'campaign-office-opening-2026',
        referrals_required: 5,
        total_reward_ngn: 15000,
        additional_reward_ngn: 7500,
        label: 'Silver Milestone (5 Referrals)',
        description: 'Reach 5 verified successful referrals for a cumulative total reward of ₦15,000 (+₦7,500 additional at milestone).',
        is_active: true,
        sort_order: 3,
    },
    {
        id: 'crm-milestone-10',
        campaign_id: 'campaign-office-opening-2026',
        referrals_required: 10,
        total_reward_ngn: 35000,
        additional_reward_ngn: 20000,
        label: 'Gold Champion Milestone (10 Referrals)',
        description: 'Reach 10 verified successful referrals for the maximum cumulative total reward of ₦35,000 (+₦20,000 additional at milestone).',
        is_active: true,
        sort_order: 4,
    },
];

export function getApprovedCampaignBaseline(referenceNow: Date = new Date()): CampaignConfig {
    const startIso = '2026-11-05T00:00:00+01:00';
    const endIso = '2026-11-20T23:59:59+01:00';
    const effective = getEffectiveCampaignStatusInLagos('active', startIso, endIso, referenceNow);
    return {
        id: 'campaign-office-opening-2026',
        slug: OFFICE_OPENING_CAMPAIGN_SLUG,
        name: 'ABLEBIZ Office Opening Special Promo & Referral Rewards Campaign',
        description: 'Official promotional discount and cumulative referral reward campaign celebrating the opening of the ABLEBIZ physical office in Abeokuta, Ogun State, Nigeria.',
        campaign_type: 'promo_and_referral',
        start_date: startIso,
        end_date: endIso,
        timezone: CAMPAIGN_TIMEZONE,
        configured_status: 'active',
        effective_status: effective,
        promo_headline: 'UP TO 30% OFF SELECTED SERVICES',
        referral_headline: 'EARN UP TO ₦35,000',
        tagline: 'Building Business. Revealing Possibilities.',
        location: 'Abeokuta, Ogun State, Nigeria',
        terms_and_conditions: APPROVED_CAMPAIGN_TERMS,
        performance_targets: APPROVED_PERFORMANCE_TARGETS,
        is_publicly_visible: true,
        spin_and_win_paused: true,
        allow_preview_pricing: false,
    };
}

// ==============================================================================
// PURE BUSINESS LOGIC FUNCTIONS (TIMEZONE, MILESTONES, PRICING, QUALIFICATION)
// ==============================================================================

/**
 * Evaluates effective campaign status in Africa/Lagos (WAT, UTC+01:00).
 * - Before Nov 5, 2026 00:00:00+01:00 -> 'scheduled'
 * - Between Nov 5, 2026 00:00:00+01:00 and Nov 20, 2026 23:59:59+01:00 (inclusive) -> 'active'
 * - After Nov 20, 2026 23:59:59+01:00 -> 'completed'
 * - Explicit overrides ('draft', 'paused', 'archived', 'completed') are respected immediately.
 */
export function getEffectiveCampaignStatusInLagos(
    configuredStatus: CampaignConfiguredStatus,
    startDateIso: string,
    endDateIso: string,
    referenceNow: Date = new Date()
): CampaignEffectiveStatus {
    if (
        configuredStatus === 'draft' ||
        configuredStatus === 'paused' ||
        configuredStatus === 'archived' ||
        configuredStatus === 'completed'
    ) {
        return configuredStatus;
    }

    const nowMs = referenceNow.getTime();
    const startMs = new Date(startDateIso).getTime();
    const endMs = new Date(endDateIso).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return configuredStatus;
    }

    if (nowMs < startMs) {
        return 'scheduled';
    }
    if (nowMs >= startMs && nowMs <= endMs) {
        return 'active';
    }
    return 'completed';
}

/**
 * Formats a date or ISO timestamp in Africa/Lagos timezone.
 */
export function formatLagosDateTime(
    dateOrIso: Date | string,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }
): string {
    const dt = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (Number.isNaN(dt.getTime())) return '—';
    return new Intl.DateTimeFormat('en-NG', {
        ...options,
        timeZone: CAMPAIGN_TIMEZONE,
    }).format(dt);
}

/**
 * Checks whether a payment timestamp falls within the inclusive campaign period in Africa/Lagos.
 */
export function isPaymentWithinCampaignWindowInLagos(
    paymentDateIso: string | null | undefined,
    startDateIso: string = '2026-11-05T00:00:00+01:00',
    endDateIso: string = '2026-11-20T23:59:59+01:00'
): boolean {
    if (!paymentDateIso) return false;
    const paidMs = new Date(paymentDateIso).getTime();
    const startMs = new Date(startDateIso).getTime();
    const endMs = new Date(endDateIso).getTime();
    if (Number.isNaN(paidMs) || Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return false;
    }
    return paidMs >= startMs && paidMs <= endMs;
}

/**
 * Calculates cumulative milestone rewards according to Section 3.3 of the campaign policy.
 * Verified counts required by specification:
 * - 0 -> ₦0
 * - 1 -> ₦2,000 (additional ₦2,000)
 * - 2 -> ₦2,000
 * - 3 -> ₦7,500 (additional ₦5,500)
 * - 4 -> ₦7,500
 * - 5 -> ₦15,000 (additional ₦7,500)
 * - 9 -> ₦15,000
 * - 10 -> ₦35,000 (additional ₦20,000)
 */
export function calculateReferralMilestoneReward(
    successfulReferrals: number
): MilestoneCalculationResult {
    const count = Math.max(0, Math.floor(Number(successfulReferrals) || 0));

    if (count >= 10) {
        return {
            successfulReferrals: count,
            milestoneReached: 10,
            totalRewardEarned: 35000,
            additionalRewardAtMilestone: 20000,
            nextMilestone: null,
            nextMilestoneTotalReward: null,
            remainingToNextMilestone: 0,
        };
    }

    if (count >= 5) {
        return {
            successfulReferrals: count,
            milestoneReached: 5,
            totalRewardEarned: 15000,
            additionalRewardAtMilestone: 7500,
            nextMilestone: 10,
            nextMilestoneTotalReward: 35000,
            remainingToNextMilestone: 10 - count,
        };
    }

    if (count >= 3) {
        return {
            successfulReferrals: count,
            milestoneReached: 3,
            totalRewardEarned: 7500,
            additionalRewardAtMilestone: 5500,
            nextMilestone: 5,
            nextMilestoneTotalReward: 15000,
            remainingToNextMilestone: 5 - count,
        };
    }

    if (count >= 1) {
        return {
            successfulReferrals: count,
            milestoneReached: 1,
            totalRewardEarned: 2000,
            additionalRewardAtMilestone: 2000,
            nextMilestone: 3,
            nextMilestoneTotalReward: 7500,
            remainingToNextMilestone: 3 - count,
        };
    }

    return {
        successfulReferrals: 0,
        milestoneReached: 0,
        totalRewardEarned: 0,
        additionalRewardAtMilestone: 0,
        nextMilestone: 1,
        nextMilestoneTotalReward: 2000,
        remainingToNextMilestone: 1,
    };
}

/**
 * Normalizes Nigerian phone numbers for identity comparison (e.g., +23480... -> 080...).
 */
export function normalizeNigerianPhoneForComparison(phone?: string | null): string {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('234') && digits.length === 13) {
        return '0' + digits.slice(3);
    }
    if (digits.length === 10 && !digits.startsWith('0')) {
        return '0' + digits;
    }
    return digits;
}

/**
 * Validates all 8 referral qualification rules from Section 3.4 of the policy.
 */
export function validateReferralQualification(
    input: ReferralQualificationInput
): ReferralQualificationResult {
    const reasons: string[] = [];

    const cleanReferrerCode = String(input.referrerCode || '').trim().toUpperCase();
    if (!cleanReferrerCode || !input.referrerIdentifiedBeforeOrAtPayment) {
        reasons.push('Referrer was not identified by name or referral code before or at initial engagement/payment.');
    }

    // Rule: Self-referrals are prohibited
    const refPhone = normalizeNigerianPhoneForComparison(input.referrerPhone);
    const custPhone = normalizeNigerianPhoneForComparison(input.customerPhone);
    const refEmail = String(input.referrerEmail || '').trim().toLowerCase();
    const custEmail = String(input.customerEmail || '').trim().toLowerCase();

    if (
        (input.referrerLeadId && input.customerLeadId && input.referrerLeadId === input.customerLeadId) ||
        (refPhone && custPhone && refPhone === custPhone) ||
        (refEmail && custEmail && refEmail === custEmail)
    ) {
        reasons.push('Self-referral prohibited: Referrer and referred customer cannot share the same phone, email, or identity.');
    }

    // Rule: Only one referrer may be credited per new customer
    if (
        input.existingCreditedReferrerForCustomer &&
        input.existingCreditedReferrerForCustomer.trim().toUpperCase() !== cleanReferrerCode
    ) {
        reasons.push(
            `Customer is already credited to another referrer (${input.existingCreditedReferrerForCustomer.toUpperCase()}). Only one referrer may be credited per new customer.`
        );
    }

    // Rule: Must be a new customer to ABLEBIZ
    if (!input.isNewCustomer) {
        reasons.push('Referred client is an existing customer; only new customers to ABLEBIZ qualify.');
    }

    // Rule: Must purchase an eligible campaign service
    const defaultEligible = APPROVED_CAMPAIGN_SERVICES.filter((s) => s.is_eligible).flatMap((s) => [
        s.service_code.toLowerCase(),
        s.service_name.toLowerCase(),
    ]);
    const eligibleList = (input.eligibleServiceNamesOrCodes || defaultEligible).map((s) =>
        s.trim().toLowerCase()
    );
    const targetService = String(input.serviceCodeOrName || '').trim().toLowerCase();
    if (!targetService || !eligibleList.some((e) => targetService === e || targetService.includes(e) || e.includes(targetService))) {
        reasons.push(`Service "${input.serviceCodeOrName || 'Unknown'}" is not an eligible campaign service.`);
    }

    // Rule: Transaction must not be cancelled or refunded
    if (input.isCancelledOrRefunded) {
        reasons.push('Transaction has been cancelled or refunded and is excluded from referral rewards.');
    }

    // Rule: Full payment must be received within the campaign period
    const startIso = input.campaignStartIso || '2026-11-05T00:00:00+01:00';
    const endIso = input.campaignEndIso || '2026-11-20T23:59:59+01:00';
    if (!input.isFullPaymentReceived) {
        reasons.push('Full promotional payment has not yet been received.');
    } else if (!isPaymentWithinCampaignWindowInLagos(input.paymentDateIso, startIso, endIso)) {
        reasons.push('Payment was not received within the official campaign window (November 5 – November 20, 2026 WAT).');
    }

    return {
        isQualified: reasons.length === 0,
        reasons,
    };
}

/**
 * Enforces:
 * 1. Multiple services purchased by one customer count as ONE referral (deduplicates by customer/client/lead/phone).
 * 2. The same customer cannot be credited to multiple referrers (first valid attribution wins).
 * 3. Cancelled/refunded/disqualified referrals are excluded.
 */
export function deduplicateQualifiedReferrals<
    T extends {
        id: string;
        referrer_code: string;
        client_id?: string | null;
        referee_lead_id?: string | null;
        referee_phone?: string | null;
        verification_status: ReferralVerificationStatus;
        created_at?: string;
    }
>(referrals: T[]): {
    qualifiedByReferrer: Record<string, T[]>;
    customerFirstReferrerMap: Record<string, string>;
} {
    const sorted = [...referrals].sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tA - tB;
    });

    const customerFirstReferrerMap: Record<string, string> = {};
    const qualifiedByReferrer: Record<string, T[]> = {};
    const seenCustomerForReferrer: Record<string, Set<string>> = {};

    for (const item of sorted) {
        if (item.verification_status !== 'successful') {
            continue;
        }
        const refCode = String(item.referrer_code || '').trim().toUpperCase();
        if (!refCode) continue;

        const customerKey =
            (item.client_id && `client:${item.client_id}`) ||
            (item.referee_lead_id && `lead:${item.referee_lead_id}`) ||
            (item.referee_phone && `phone:${normalizeNigerianPhoneForComparison(item.referee_phone)}`) ||
            `event:${item.id}`;

        // Enforce single referrer per customer globally
        if (!customerFirstReferrerMap[customerKey]) {
            customerFirstReferrerMap[customerKey] = refCode;
        } else if (customerFirstReferrerMap[customerKey] !== refCode) {
            // Customer already credited to an earlier referrer; do not credit a second referrer
            continue;
        }

        // Enforce multiple services by one customer = 1 referral for this referrer
        if (!seenCustomerForReferrer[refCode]) {
            seenCustomerForReferrer[refCode] = new Set();
        }
        if (seenCustomerForReferrer[refCode].has(customerKey)) {
            continue;
        }

        seenCustomerForReferrer[refCode].add(customerKey);
        if (!qualifiedByReferrer[refCode]) {
            qualifiedByReferrer[refCode] = [];
        }
        qualifiedByReferrer[refCode].push(item);
    }

    return {
        qualifiedByReferrer,
        customerFirstReferrerMap,
    };
}

/**
 * Calculates campaign line-item pricing:
 * - Applies promotional discount strictly to ABLEBIZ professional service fee
 * - Keeps statutory/CAC/government/third-party fees completely separate and undiscounted
 * - Prevents double discounting (manual discount cannot be stacked on top of campaign promo price)
 */
export function calculateCampaignLinePricing(
    input: CampaignLinePricingInput
): CampaignLinePricingResult {
    const qty = Math.max(1, Math.floor(Number(input.quantity) || 1));
    const regularUnit = Math.max(0, Number(input.regularProfessionalFee) || 0);
    const statutoryUnit = Math.max(0, Number(input.statutoryOrThirdPartyFee) || 0);
    const directCostUnit = Math.max(0, Number(input.directCostEstimate) || 0);

    const regularProfessionalFeeTotal = Math.round(regularUnit * qty * 100) / 100;
    const statutoryFeeTotal = Math.round(statutoryUnit * qty * 100) / 100;
    const directCostTotal = Math.round(directCostUnit * qty * 100) / 100;

    const canApplyDiscount = Boolean(input.isCampaignActiveOrPreview && input.isServiceEligible);
    const discountPct = canApplyDiscount
        ? Math.min(100, Math.max(0, Number(input.discountPercentage) || 0))
        : 0;

    const discountAmountTotal =
        Math.round(regularProfessionalFeeTotal * (discountPct / 100) * 100) / 100;
    const promoProfessionalFeeTotal =
        Math.round((regularProfessionalFeeTotal - discountAmountTotal) * 100) / 100;

    // Prevent stacking manual discount on top of campaign discount
    const doubleDiscountPrevented =
        canApplyDiscount && discountPct > 0 && (Number(input.existingManualDiscountAmount) || 0) > 0;

    const totalPayableAmount =
        Math.round((promoProfessionalFeeTotal + statutoryFeeTotal) * 100) / 100;
    const expectedGrossProfit =
        Math.round((promoProfessionalFeeTotal - directCostTotal) * 100) / 100;

    return {
        regularProfessionalFeeTotal,
        discountPercentageApplied: discountPct,
        discountAmountTotal,
        promoProfessionalFeeTotal,
        statutoryFeeTotal,
        totalPayableAmount,
        directCostTotal,
        expectedGrossProfit,
        doubleDiscountPrevented,
    };
}

/**
 * Matches a service catalog slug or name to its approved campaign service price record.
 */
export function matchServiceToCampaignPrice(
    serviceNameOrSlug: string,
    campaignServices: CampaignServicePrice[]
): CampaignServicePrice | null {
    const needle = String(serviceNameOrSlug || '').trim().toLowerCase();
    if (!needle) return null;

    for (const sp of campaignServices) {
        if (!sp.is_eligible) continue;
        const code = sp.service_code.toLowerCase();
        const name = sp.service_name.toLowerCase();
        if (needle === code || needle === name) return sp;
        if (needle.includes('business name') && code === 'business_name_reg' && !needle.includes('annual')) return sp;
        if ((needle.includes('company registration') || needle.includes('limited liability') || needle.includes('llc')) && code === 'company_reg') return sp;
        if ((needle.includes('ngo') || needle.includes('incorporated trustees')) && code === 'ngo_reg') return sp;
        if (needle.includes('scuml') && code === 'scuml_assistance') return sp;
        if (needle.includes('annual return') && (needle.includes('business name') || needle.includes('(bn)'))) {
            if (code === 'annual_returns_bn') return sp;
        }
        if (needle.includes('annual return') && (needle.includes('company') || needle.includes('llc') || needle.includes('(cp)'))) {
            if (code === 'annual_returns_company') return sp;
        }
    }

    return null;
}

/**
 * Role-based access control matrix for the 8 canonical ABLEBIZ Suite staff roles (Part 8).
 */
export function getCampaignRolePermissions(role?: CanonicalStaffRole | string | null): CampaignRolePermissions {
    switch (role) {
        case 'super_admin':
        case 'admin':
            return {
                canViewDashboard: true,
                canEditCampaignConfig: true,
                canEditCampaignPricing: true,
                canApplyCampaignPricingInQuotesInvoices: true,
                canManualOverrideCampaignDiscount: true,
                canVerifyReferrals: true,
                canApproveRewardPayouts: true,
                canRecordRewardPayouts: true,
                canExportReports: true,
            };
        case 'operations_manager':
            return {
                canViewDashboard: true,
                canEditCampaignConfig: true,
                canEditCampaignPricing: true,
                canApplyCampaignPricingInQuotesInvoices: true,
                canManualOverrideCampaignDiscount: false,
                canVerifyReferrals: true,
                canApproveRewardPayouts: false,
                canRecordRewardPayouts: false,
                canExportReports: true,
            };
        case 'accounts_officer':
            return {
                canViewDashboard: true,
                canEditCampaignConfig: false,
                canEditCampaignPricing: false,
                canApplyCampaignPricingInQuotesInvoices: true,
                canManualOverrideCampaignDiscount: false,
                canVerifyReferrals: true,
                canApproveRewardPayouts: true,
                canRecordRewardPayouts: true,
                canExportReports: true,
            };
        case 'marketing_officer':
            return {
                canViewDashboard: true,
                canEditCampaignConfig: false,
                canEditCampaignPricing: false,
                canApplyCampaignPricingInQuotesInvoices: false,
                canManualOverrideCampaignDiscount: false,
                canVerifyReferrals: true,
                canApproveRewardPayouts: false,
                canRecordRewardPayouts: false,
                canExportReports: true,
            };
        case 'client_service_officer':
        case 'registration_officer':
            return {
                canViewDashboard: true,
                canEditCampaignConfig: false,
                canEditCampaignPricing: false,
                canApplyCampaignPricingInQuotesInvoices: true,
                canManualOverrideCampaignDiscount: false,
                canVerifyReferrals: false,
                canApproveRewardPayouts: false,
                canRecordRewardPayouts: false,
                canExportReports: false,
            };
        case 'viewer':
        default:
            return {
                canViewDashboard: Boolean(role),
                canEditCampaignConfig: false,
                canEditCampaignPricing: false,
                canApplyCampaignPricingInQuotesInvoices: false,
                canManualOverrideCampaignDiscount: false,
                canVerifyReferrals: false,
                canApproveRewardPayouts: false,
                canRecordRewardPayouts: false,
                canExportReports: false,
            };
    }
}

// ==============================================================================
// SUPABASE DATA ACCESS LAYER (PUBLIC & SUITE)
// ==============================================================================

let cachedPublicBundle: { bundle: CampaignPublicBundle; fetchedAtMs: number } | null = null;

export async function fetchAuthoritativeCampaignBundle(
    forceRefresh = false
): Promise<CampaignPublicBundle> {
    if (!forceRefresh && cachedPublicBundle && Date.now() - cachedPublicBundle.fetchedAtMs < 30_000) {
        return cachedPublicBundle.bundle;
    }

    // 1. Try the dedicated public RPC first
    const rpcRes = await supabase.rpc('ablebiz_get_public_campaign_config', {
        p_slug: OFFICE_OPENING_CAMPAIGN_SLUG,
    });

    if (!rpcRes.error && rpcRes.data && rpcRes.data.found) {
        const raw = rpcRes.data;
        const c = raw.campaign;
        const serverNow = raw.server_time_utc ? new Date(raw.server_time_utc) : new Date();

        // Protect against accidental rollback state (status='paused', is_publicly_visible=false)
        // during the approved campaign window (Nov 5 - Nov 20, 2026 WAT)
        const isWithinOfficialCampaignWindow =
            serverNow >= new Date('2026-11-05T00:00:00+01:00') &&
            serverNow <= new Date('2026-11-20T23:59:59+01:00');

        const resolvedConfiguredStatus: CampaignConfiguredStatus =
            c.configured_status === 'paused' && !c.is_publicly_visible && isWithinOfficialCampaignWindow
                ? 'active'
                : (c.configured_status || 'active');

        const resolvedVisibility =
            isWithinOfficialCampaignWindow ? true : Boolean(c.is_publicly_visible);

        const resolvedSpinPaused =
            isWithinOfficialCampaignWindow ? true : Boolean(c.spin_and_win_paused);

        const campaign: CampaignConfig = {
            id: c.id,
            slug: c.slug,
            name: c.name,
            description: c.description || '',
            campaign_type: c.campaign_type || 'promo_and_referral',
            start_date: c.start_date,
            end_date: c.end_date,
            timezone: c.timezone || CAMPAIGN_TIMEZONE,
            configured_status: resolvedConfiguredStatus,
            effective_status:
                c.effective_status ||
                getEffectiveCampaignStatusInLagos(resolvedConfiguredStatus, c.start_date, c.end_date, serverNow),
            promo_headline: c.promo_headline || 'UP TO 30% OFF SELECTED SERVICES',
            referral_headline: c.referral_headline || 'EARN UP TO ₦35,000',
            tagline: c.tagline || 'Building Business. Revealing Possibilities.',
            location: c.location || 'Abeokuta, Ogun State, Nigeria',
            terms_and_conditions: Array.isArray(c.terms_and_conditions)
                ? c.terms_and_conditions
                : APPROVED_CAMPAIGN_TERMS,
            performance_targets: c.performance_targets || APPROVED_PERFORMANCE_TARGETS,
            is_publicly_visible: resolvedVisibility,
            spin_and_win_paused: resolvedSpinPaused,
            allow_preview_pricing: Boolean(c.allow_preview_pricing),
            updated_at: c.updated_at,
        };

        const services: CampaignServicePrice[] = (raw.services || []).map((s: any) => ({
            id: s.id,
            campaign_id: s.campaign_id,
            service_id: s.service_id,
            service_code: s.service_code,
            service_name: s.service_name,
            category: s.category,
            regular_professional_fee: Number(s.regular_professional_fee),
            discount_percentage: Number(s.discount_percentage),
            promo_professional_fee: Number(s.promo_professional_fee),
            direct_cost_estimate: Number(s.direct_cost_estimate || 0),
            expected_gross_profit: Number(
                s.expected_gross_profit ?? Number(s.promo_professional_fee) - Number(s.direct_cost_estimate || 0)
            ),
            is_eligible: Boolean(s.is_eligible),
            sort_order: Number(s.sort_order || 0),
            notes: s.notes,
        }));

        const milestones: CampaignReferralMilestone[] = (raw.milestones || []).map((m: any) => ({
            id: m.id,
            campaign_id: m.campaign_id,
            referrals_required: Number(m.referrals_required),
            total_reward_ngn: Number(m.total_reward_ngn),
            additional_reward_ngn: Number(m.additional_reward_ngn),
            label: m.label,
            description: m.description || '',
            is_active: Boolean(m.is_active),
            sort_order: Number(m.sort_order || 0),
        }));

        const bundle: CampaignPublicBundle = {
            campaign,
            services: services.length > 0 ? services : APPROVED_CAMPAIGN_SERVICES,
            milestones: milestones.length > 0 ? milestones : APPROVED_REFERRAL_MILESTONES,
            serverTimeUtc: raw.server_time_utc || new Date().toISOString(),
            source: 'supabase_rpc',
        };
        cachedPublicBundle = { bundle, fetchedAtMs: Date.now() };
        return bundle;
    }

    // 2. Fallback to direct table select if RPC is not yet created
    const { data: campRow, error: campErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('slug', OFFICE_OPENING_CAMPAIGN_SLUG)
        .maybeSingle();

    if (!campErr && campRow) {
        const [{ data: srvRows }, { data: msRows }] = await Promise.all([
            supabase
                .from('campaign_service_prices')
                .select('*')
                .eq('campaign_id', campRow.id)
                .order('sort_order', { ascending: true }),
            supabase
                .from('campaign_referral_milestones')
                .select('*')
                .eq('campaign_id', campRow.id)
                .order('referrals_required', { ascending: true }),
        ]);

        const effectiveStatus = getEffectiveCampaignStatusInLagos(
            campRow.status,
            campRow.start_date,
            campRow.end_date,
            new Date()
        );

        const bundle: CampaignPublicBundle = {
            campaign: {
                id: campRow.id,
                slug: campRow.slug,
                name: campRow.name,
                description: campRow.description || '',
                campaign_type: campRow.campaign_type || 'promo_and_referral',
                start_date: campRow.start_date,
                end_date: campRow.end_date,
                timezone: campRow.timezone || CAMPAIGN_TIMEZONE,
                configured_status: campRow.status,
                effective_status: effectiveStatus,
                promo_headline: campRow.promo_headline,
                referral_headline: campRow.referral_headline,
                tagline: campRow.tagline,
                location: campRow.location,
                terms_and_conditions: Array.isArray(campRow.terms_and_conditions)
                    ? campRow.terms_and_conditions
                    : APPROVED_CAMPAIGN_TERMS,
                performance_targets: campRow.performance_targets || APPROVED_PERFORMANCE_TARGETS,
                is_publicly_visible: Boolean(campRow.is_publicly_visible),
                spin_and_win_paused: Boolean(campRow.spin_and_win_paused),
                allow_preview_pricing: Boolean(campRow.allow_preview_pricing),
                updated_at: campRow.updated_at,
            },
            services: (srvRows || []).map((s: any) => ({
                id: s.id,
                campaign_id: s.campaign_id,
                service_id: s.service_id,
                service_code: s.service_code,
                service_name: s.service_name,
                category: s.category,
                regular_professional_fee: Number(s.regular_professional_fee),
                discount_percentage: Number(s.discount_percentage),
                promo_professional_fee: Number(s.promo_professional_fee),
                direct_cost_estimate: Number(s.direct_cost_estimate || 0),
                expected_gross_profit: Number(
                    s.expected_gross_profit ?? Number(s.promo_professional_fee) - Number(s.direct_cost_estimate || 0)
                ),
                is_eligible: Boolean(s.is_eligible),
                sort_order: Number(s.sort_order || 0),
                notes: s.notes,
                updated_by: s.updated_by,
                updated_at: s.updated_at,
            })),
            milestones: (msRows || []).map((m: any) => ({
                id: m.id,
                campaign_id: m.campaign_id,
                referrals_required: Number(m.referrals_required),
                total_reward_ngn: Number(m.total_reward_ngn),
                additional_reward_ngn: Number(m.additional_reward_ngn),
                label: m.label,
                description: m.description || '',
                is_active: Boolean(m.is_active),
                sort_order: Number(m.sort_order || 0),
            })),
            serverTimeUtc: new Date().toISOString(),
            source: 'supabase_tables',
        };
        cachedPublicBundle = { bundle, fetchedAtMs: Date.now() };
        return bundle;
    }

    // 3. Authoritative policy baseline (if migration not yet executed on DB)
    const fallbackBundle: CampaignPublicBundle = {
        campaign: getApprovedCampaignBaseline(new Date()),
        services: APPROVED_CAMPAIGN_SERVICES,
        milestones: APPROVED_REFERRAL_MILESTONES,
        serverTimeUtc: new Date().toISOString(),
        source: 'policy_baseline',
    };
    return fallbackBundle;
}

export function invalidateCampaignCache(): void {
    cachedPublicBundle = null;
}
