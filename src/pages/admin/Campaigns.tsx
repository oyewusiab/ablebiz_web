import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Award,
    Banknote,
    BarChart3,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    Edit3,
    FileSpreadsheet,
    Filter,
    PauseCircle,
    PlayCircle,
    Printer,
    RefreshCw,
    Save,
    Search,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Tag,
    TrendingUp,
    Users,
    XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';
import { useGamification } from '../../gamification/GamificationProvider';
import { DocumentHeader, DocumentFooter } from '../../components/admin/DocumentBranding';
import {
    APPROVED_CAMPAIGN_SERVICES,
    APPROVED_REFERRAL_MILESTONES,
    calculateReferralMilestoneReward,
    deduplicateQualifiedReferrals,
    formatLagosDateTime,
    getApprovedCampaignBaseline,
    getCampaignRolePermissions,
    getEffectiveCampaignStatusInLagos,
    invalidateCampaignCache,
    isPaymentWithinCampaignWindowInLagos,
    matchServiceToCampaignPrice,
    OFFICE_OPENING_CAMPAIGN_SLUG,
    validateReferralQualification,
    type CampaignConfig,
    type CampaignConfiguredStatus,
    type CampaignReferralMilestone,
    type CampaignServicePrice,
    type ReferralPayoutStatus,
    type ReferralVerificationStatus,
} from '../../lib/campaignEngine';

function formatNaira(amount: number): string {
    return `₦${Number(amount || 0).toLocaleString('en-NG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
}

interface TransactionRegisterRow {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    customerCode: string;
    customerName: string;
    customerPhone: string;
    servicePurchased: string;
    regularProfessionalFee: number;
    discountPercentage: number;
    promoProfessionalFee: number;
    statutoryCharges: number;
    totalAmountPayable: number;
    amountPaid: number;
    directCostEstimate: number;
    grossProfit: number;
    paymentStatus: string;
    paymentDate: string | null;
    campaignEligibilityStatus: string;
    referrerName: string;
    referralCode: string;
    referralStatus: string;
    transactionVerificationStatus: string;
    createdAt: string;
}

interface ReferralVerificationRow {
    id: string;
    referrerCode: string;
    referrerName: string;
    referrerPhone: string;
    referrerEmail: string;
    referrerLeadId: string | null;
    refereeLeadId: string | null;
    clientId: string | null;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    servicePurchased: string;
    verificationStatus: ReferralVerificationStatus;
    disqualificationReason: string;
    verificationNotes: string;
    isNewCustomer: boolean;
    isEligibleService: boolean;
    isPaidInWindow: boolean;
    invoiceId: string | null;
    invoiceNumber: string | null;
    paymentDate: string | null;
    verifiedAt: string | null;
    createdAt: string;
    autoCheckQualified: boolean;
    autoCheckReasons: string[];
}

interface PayoutLedgerRow {
    id: string;
    referrerCode: string;
    referrerName: string;
    referrerPhone: string;
    referrerEmail: string;
    verifiedReferralCount: number;
    milestoneReached: number;
    totalRewardEarned: number;
    additionalRewardAtMilestone: number;
    amountPaid: number;
    amountPayable: number;
    paymentStatus: ReferralPayoutStatus;
    bankName: string;
    accountName: string;
    accountNumber: string;
    paymentReference: string;
    paymentDate: string | null;
    verifiedBy: string | null;
    paidBy: string | null;
    notes: string;
    isPersistedInDb: boolean;
}

export function Campaigns() {
    const { user, profile } = useAuth();
    const { refreshCampaignBundle } = useGamification();
    const permissions = useMemo(
        () => getCampaignRolePermissions(profile?.role),
        [profile?.role]
    );

    const [activeTab, setActiveTab] = useState<
        'overview' | 'pricing' | 'transactions' | 'referrals' | 'reports'
    >('overview');

    const [loading, setLoading] = useState(true);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
    const [actionFeedback, setActionFeedback] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    // Authoritative State
    const [campaign, setCampaign] = useState<CampaignConfig>(() =>
        getApprovedCampaignBaseline(new Date())
    );
    const [servicePrices, setServicePrices] = useState<CampaignServicePrice[]>(
        APPROVED_CAMPAIGN_SERVICES
    );
    const [milestones, setMilestones] = useState<CampaignReferralMilestone[]>(
        APPROVED_REFERRAL_MILESTONES
    );

    // Operational Datasets from Real Supabase Tables
    const [campaignInquiriesCount, setCampaignInquiriesCount] = useState<number>(0);
    const [newCustomersCount, setNewCustomersCount] = useState<number>(0);
    const [referralParticipantsCount, setReferralParticipantsCount] = useState<number>(0);
    const [transactionRows, setTransactionRows] = useState<TransactionRegisterRow[]>([]);
    const [referralRows, setReferralRows] = useState<ReferralVerificationRow[]>([]);
    const [payoutRows, setPayoutRows] = useState<PayoutLedgerRow[]>([]);
    const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);

    // Filters
    const [txSearch, setTxSearch] = useState('');
    const [txStatusFilter, setTxStatusFilter] = useState('all');
    const [refSearch, setRefSearch] = useState('');
    const [refStatusFilter, setRefStatusFilter] = useState('all');

    // Modals / Editing States
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [priceDraft, setPriceDraft] = useState<{
        regular_professional_fee: number;
        discount_percentage: number;
        promo_professional_fee: number;
        direct_cost_estimate: number;
        is_eligible: boolean;
    } | null>(null);

    const [selectedReferral, setSelectedReferral] = useState<ReferralVerificationRow | null>(
        null
    );
    const [verifyForm, setVerifyForm] = useState<{
        status: ReferralVerificationStatus;
        servicePurchased: string;
        isNewCustomer: boolean;
        isEligibleService: boolean;
        isPaidInWindow: boolean;
        disqualificationReason: string;
        notes: string;
    }>({
        status: 'successful',
        servicePurchased: '',
        isNewCustomer: true,
        isEligibleService: true,
        isPaidInWindow: true,
        disqualificationReason: '',
        notes: '',
    });
    const [isVerifyingReferral, setIsVerifyingReferral] = useState(false);

    const [selectedPayout, setSelectedPayout] = useState<PayoutLedgerRow | null>(null);
    const [payoutForm, setPayoutForm] = useState<{
        paymentStatus: ReferralPayoutStatus;
        amountPaid: number;
        bankName: string;
        accountName: string;
        accountNumber: string;
        paymentReference: string;
        notes: string;
    }>({
        paymentStatus: 'verified',
        amountPaid: 0,
        bankName: '',
        accountName: '',
        accountNumber: '',
        paymentReference: '',
        notes: '',
    });
    const [isSavingPayout, setIsSavingPayout] = useState(false);

    const loadCampaignWorkspace = async () => {
        setLoading(true);
        setQueryError(null);
        setMigrationNotice(null);

        try {
            // 1. Load Central Campaign Config from Supabase
            let activeCampaign = getApprovedCampaignBaseline(new Date());
            let activeServices = APPROVED_CAMPAIGN_SERVICES;
            let activeMilestones = APPROVED_REFERRAL_MILESTONES;

            const { data: campData, error: campError } = await supabase
                .from('campaigns')
                .select('*')
                .eq('slug', OFFICE_OPENING_CAMPAIGN_SLUG)
                .maybeSingle();

            if (campError) {
                // Check if table does not exist yet (migration pending)
                if (
                    campError.code === '42P01' ||
                    campError.message?.includes('does not exist') ||
                    campError.message?.includes('schema cache')
                ) {
                    setMigrationNotice(
                        'Notice: The campaign configuration tables (implementation/MIGRATION_OFFICE_OPENING_CAMPAIGN.sql) have not yet been executed on this Supabase instance. Displaying policy-baseline configuration alongside live CRM/Finance records.'
                    );
                } else {
                    throw new Error(`Failed to load campaign configuration: ${campError.message}`);
                }
            } else if (campData) {
                const effective = getEffectiveCampaignStatusInLagos(
                    campData.status,
                    campData.start_date,
                    campData.end_date,
                    new Date()
                );
                activeCampaign = {
                    id: campData.id,
                    slug: campData.slug,
                    name: campData.name,
                    description: campData.description || '',
                    campaign_type: campData.campaign_type || 'promo_and_referral',
                    start_date: campData.start_date,
                    end_date: campData.end_date,
                    timezone: campData.timezone || 'Africa/Lagos',
                    configured_status: campData.status,
                    effective_status: effective,
                    promo_headline: campData.promo_headline,
                    referral_headline: campData.referral_headline,
                    tagline: campData.tagline,
                    location: campData.location,
                    terms_and_conditions: Array.isArray(campData.terms_and_conditions)
                        ? campData.terms_and_conditions
                        : activeCampaign.terms_and_conditions,
                    performance_targets:
                        campData.performance_targets || activeCampaign.performance_targets,
                    is_publicly_visible: Boolean(campData.is_publicly_visible),
                    spin_and_win_paused: Boolean(campData.spin_and_win_paused),
                    allow_preview_pricing: Boolean(campData.allow_preview_pricing),
                    updated_by: campData.updated_by,
                    updated_at: campData.updated_at,
                };

                const [{ data: srvData, error: srvErr }, { data: msData, error: msErr }] =
                    await Promise.all([
                        supabase
                            .from('campaign_service_prices')
                            .select('*')
                            .eq('campaign_id', campData.id)
                            .order('sort_order', { ascending: true }),
                        supabase
                            .from('campaign_referral_milestones')
                            .select('*')
                            .eq('campaign_id', campData.id)
                            .order('referrals_required', { ascending: true }),
                    ]);

                if (srvErr) throw new Error(`Failed to load campaign pricing: ${srvErr.message}`);
                if (msErr) throw new Error(`Failed to load campaign milestones: ${msErr.message}`);

                if (srvData && srvData.length > 0) {
                    activeServices = srvData.map((s: any) => ({
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
                            s.expected_gross_profit ??
                                Number(s.promo_professional_fee) - Number(s.direct_cost_estimate || 0)
                        ),
                        is_eligible: Boolean(s.is_eligible),
                        sort_order: Number(s.sort_order || 0),
                        notes: s.notes,
                        updated_by: s.updated_by,
                        updated_at: s.updated_at,
                    }));
                }

                if (msData && msData.length > 0) {
                    activeMilestones = msData.map((m: any) => ({
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
                }
            }

            setCampaign(activeCampaign);
            setServicePrices(activeServices);
            setMilestones(activeMilestones);

            // 2. Query Real Operational, CRM, Finance & Referral Tables (Never fabricate or hide errors)
            const [
                leadsRes,
                clientsRes,
                invoicesRes,
                paymentsRes,
                referralsRes,
                auditRes,
            ] = await Promise.all([
                supabase
                    .from('leads')
                    .select('id, name, phone, email, business_interest, source, referral_code, referred_by, is_converted, converted_client_id, utm, created_at')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('clients')
                    .select('id, client_code, full_name, phone, email, referral_code, created_at')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('invoices')
                    .select('*, clients(id, client_code, full_name, phone, email, referral_code), invoice_items(*)')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('payments')
                    .select('id, invoice_id, amount, payment_date, is_verified, payment_method, reference_number')
                    .eq('is_verified', true)
                    .order('payment_date', { ascending: false }),
                supabase
                    .from('referral_events')
                    .select('*')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('audit_logs')
                    .select('*')
                    .in('entity_type', [
                        'campaigns',
                        'campaign_service_prices',
                        'referral_events',
                        'campaign_referral_payouts',
                        'invoices',
                    ])
                    .order('created_at', { ascending: false })
                    .limit(30),
            ]);

            if (leadsRes.error) throw new Error(`Leads query failed: ${leadsRes.error.message}`);
            if (clientsRes.error) throw new Error(`Clients query failed: ${clientsRes.error.message}`);
            if (invoicesRes.error) throw new Error(`Invoices query failed: ${invoicesRes.error.message}`);
            if (paymentsRes.error) throw new Error(`Payments query failed: ${paymentsRes.error.message}`);
            if (referralsRes.error) throw new Error(`Referral events query failed: ${referralsRes.error.message}`);

            const allLeads = leadsRes.data || [];
            const allClients = clientsRes.data || [];
            const allInvoices = invoicesRes.data || [];
            const allPayments = paymentsRes.data || [];
            const allReferralEvents = referralsRes.data || [];

            if (!auditRes.error && auditRes.data) {
                setRecentAuditLogs(auditRes.data);
            }

            // Build lookup maps
            const leadByIdMap = new Map<string, any>();
            const leadByReferralCodeMap = new Map<string, any>();
            allLeads.forEach((l: any) => {
                leadByIdMap.set(l.id, l);
                if (l.referral_code) {
                    leadByReferralCodeMap.set(String(l.referral_code).toUpperCase(), l);
                }
            });

            const clientByIdMap = new Map<string, any>();
            allClients.forEach((c: any) => clientByIdMap.set(c.id, c));

            const paymentsByInvoiceMap = new Map<string, any[]>();
            allPayments.forEach((p: any) => {
                const list = paymentsByInvoiceMap.get(p.invoice_id) || [];
                list.push(p);
                paymentsByInvoiceMap.set(p.invoice_id, list);
            });

            // Calculate Campaign Inquiries & New Customers within campaign window (or attributed to campaign)
            const startMs = new Date(activeCampaign.start_date).getTime();
            const endMs = new Date(activeCampaign.end_date).getTime();

            const campaignLeads = allLeads.filter((l: any) => {
                const createdMs = new Date(l.created_at).getTime();
                const inWindow = createdMs >= startMs && createdMs <= endMs;
                const hasUtm =
                    l.utm &&
                    (l.utm.utm_campaign === OFFICE_OPENING_CAMPAIGN_SLUG ||
                        l.utm.utm_source === 'office_opening_promo_page');
                return inWindow || hasUtm;
            });
            setCampaignInquiriesCount(campaignLeads.length);

            const campaignClients = allClients.filter((c: any) => {
                const createdMs = new Date(c.created_at).getTime();
                return createdMs >= startMs && createdMs <= endMs;
            });
            setNewCustomersCount(campaignClients.length);

            const partnerLeads = allLeads.filter((l: any) => Boolean(l.referral_code));
            setReferralParticipantsCount(partnerLeads.length);

            // Map referral events by client_id or referee_lead_id for attribution
            const referralByClientId = new Map<string, any>();
            allReferralEvents.forEach((re: any) => {
                if (re.client_id && !referralByClientId.has(re.client_id)) {
                    referralByClientId.set(re.client_id, re);
                }
            });

            // 3. Build Campaign Transaction Register from Real Invoices & Payments
            const txRegister: TransactionRegisterRow[] = [];
            for (const inv of allInvoices) {
                const invCreatedMs = new Date(inv.created_at).getTime();
                const invPayments = paymentsByInvoiceMap.get(inv.id) || [];
                const latestPaymentDate =
                    invPayments.length > 0 ? invPayments[0].payment_date : null;
                const paidInWindow = isPaymentWithinCampaignWindowInLagos(
                    latestPaymentDate,
                    activeCampaign.start_date,
                    activeCampaign.end_date
                );
                const isExplicitCampaignInvoice = Boolean(inv.campaign_id);
                const isCreatedInWindow = invCreatedMs >= startMs && invCreatedMs <= endMs;

                if (!isExplicitCampaignInvoice && !isCreatedInWindow && !paidInWindow) {
                    continue;
                }

                const items: any[] = inv.invoice_items || [];
                const itemDescriptions = items.map((i) => i.description).join(', ');
                const matchedService = matchServiceToCampaignPrice(
                    itemDescriptions,
                    activeServices
                );

                // Compute professional fee, discount, statutory fee snapshots
                let regularFee = Number(inv.regular_fee_total || 0);
                let discountPct = 0;
                let promoFee = 0;
                let statutoryFee = Number(inv.statutory_fee_total || 0);
                let directCost = 0;

                if (items.length > 0) {
                    let calcReg = 0;
                    let calcPromo = 0;
                    let calcStat = 0;
                    let calcCost = 0;
                    for (const item of items) {
                        if (item.item_type === 'statutory_fee') {
                            calcStat += Number(item.total_price || 0);
                        } else {
                            const regUnit = Number(
                                item.regular_unit_price ??
                                    matchedService?.regular_professional_fee ??
                                    item.unit_price ??
                                    0
                            );
                            const promoUnit = Number(
                                item.promo_unit_price ?? item.unit_price ?? 0
                            );
                            const qty = Number(item.quantity || 1);
                            calcReg += regUnit * qty;
                            calcPromo += promoUnit * qty;
                            calcCost +=
                                Number(
                                    item.direct_cost_snapshot ??
                                        matchedService?.direct_cost_estimate ??
                                        0
                                ) * qty;
                            if (Number(item.discount_percentage) > 0) {
                                discountPct = Number(item.discount_percentage);
                            }
                        }
                    }
                    if (regularFee === 0) regularFee = calcReg;
                    promoFee = calcPromo;
                    if (statutoryFee === 0) statutoryFee = calcStat;
                    directCost = calcCost;
                } else if (matchedService) {
                    regularFee = matchedService.regular_professional_fee;
                    discountPct = matchedService.discount_percentage;
                    promoFee = matchedService.promo_professional_fee;
                    directCost = matchedService.direct_cost_estimate;
                } else {
                    regularFee = Number(inv.subtotal || inv.total_amount || 0);
                    promoFee = Number(inv.total_amount || 0);
                }

                if (discountPct === 0 && regularFee > promoFee && regularFee > 0) {
                    discountPct = Math.round(((regularFee - promoFee) / regularFee) * 100);
                }

                const linkedRefEvent = inv.client_id
                    ? referralByClientId.get(inv.client_id)
                    : null;
                const refCode =
                    inv.referral_code ||
                    linkedRefEvent?.referrer_code ||
                    inv.clients?.referral_code ||
                    '';
                const refPartner = refCode
                    ? leadByReferralCodeMap.get(String(refCode).toUpperCase())
                    : null;

                const isFullyPaid =
                    inv.status === 'paid' ||
                    (Number(inv.amount_paid || 0) >= Number(inv.total_amount || 0) &&
                        Number(inv.total_amount || 0) > 0);

                const computedEligibility =
                    inv.campaign_eligibility_status &&
                    inv.campaign_eligibility_status !== 'not_applicable'
                        ? inv.campaign_eligibility_status
                        : inv.status === 'cancelled'
                        ? 'cancelled_refunded'
                        : isFullyPaid && (paidInWindow || isExplicitCampaignInvoice)
                        ? 'qualified'
                        : 'pending_payment';

                txRegister.push({
                    invoiceId: inv.id,
                    invoiceNumber: inv.invoice_number,
                    customerId: inv.client_id,
                    customerCode: inv.clients?.client_code || '—',
                    customerName: inv.clients?.full_name || 'Unknown Client',
                    customerPhone: inv.clients?.phone || '—',
                    servicePurchased:
                        matchedService?.service_name ||
                        itemDescriptions ||
                        'Professional Service',
                    regularProfessionalFee: regularFee,
                    discountPercentage: discountPct,
                    promoProfessionalFee: promoFee,
                    statutoryCharges: statutoryFee,
                    totalAmountPayable: Number(inv.total_amount || promoFee + statutoryFee),
                    amountPaid: Number(inv.amount_paid || 0),
                    directCostEstimate: directCost,
                    grossProfit: promoFee - directCost,
                    paymentStatus: inv.status,
                    paymentDate: latestPaymentDate,
                    campaignEligibilityStatus: computedEligibility,
                    referrerName: refPartner?.name || (refCode ? 'Registered Partner' : '—'),
                    referralCode: refCode || '—',
                    referralStatus:
                        linkedRefEvent?.verification_status ||
                        linkedRefEvent?.reward_status ||
                        (refCode ? 'Pending Verification' : 'No Referral'),
                    transactionVerificationStatus:
                        inv.transaction_verification_status ||
                        (isFullyPaid ? 'verified' : 'pending'),
                    createdAt: inv.created_at,
                });
            }
            setTransactionRows(txRegister);

            // 4. Build Referral Verification Queue with 8-Point Qualification Validation
            const { customerFirstReferrerMap } = deduplicateQualifiedReferrals(
                allReferralEvents.map((re: any) => ({
                    id: re.id,
                    referrer_code: re.referrer_code,
                    client_id: re.client_id,
                    referee_lead_id: re.referee_lead_id,
                    verification_status:
                        (re.verification_status as ReferralVerificationStatus) ||
                        (re.reward_status === 'Qualified' || re.reward_status === 'Claimed'
                            ? 'successful'
                            : re.reward_status === 'Void'
                            ? 'disqualified'
                            : 'pending'),
                    created_at: re.created_at,
                }))
            );

            const verRows: ReferralVerificationRow[] = allReferralEvents.map((re: any) => {
                const partner = leadByReferralCodeMap.get(
                    String(re.referrer_code || '').toUpperCase()
                );
                const refereeLead = re.referee_lead_id
                    ? leadByIdMap.get(re.referee_lead_id)
                    : null;
                const clientRecord =
                    (re.client_id && clientByIdMap.get(re.client_id)) ||
                    (refereeLead?.converted_client_id &&
                        clientByIdMap.get(refereeLead.converted_client_id)) ||
                    null;

                const clientInvoices = clientRecord
                    ? allInvoices.filter((inv: any) => inv.client_id === clientRecord.id)
                    : [];
                const paidInvoice = clientInvoices.find((inv: any) => inv.status === 'paid');
                const invPayments = paidInvoice
                    ? paymentsByInvoiceMap.get(paidInvoice.id) || []
                    : [];
                const paidDate =
                    invPayments.length > 0
                        ? invPayments[0].payment_date
                        : paidInvoice?.updated_at || null;

                const serviceName =
                    re.service_purchased ||
                    refereeLead?.business_interest ||
                    (paidInvoice?.invoice_items?.[0]?.description ?? 'Business Registration');

                const verStatus: ReferralVerificationStatus =
                    re.verification_status ||
                    (re.reward_status === 'Qualified' || re.reward_status === 'Claimed'
                        ? 'successful'
                        : re.reward_status === 'Void'
                        ? 'disqualified'
                        : 'pending');

                const customerKey =
                    (clientRecord?.id && `client:${clientRecord.id}`) ||
                    (re.referee_lead_id && `lead:${re.referee_lead_id}`) ||
                    `event:${re.id}`;

                const check = validateReferralQualification({
                    referrerCode: re.referrer_code,
                    referrerPhone: partner?.phone,
                    referrerEmail: partner?.email,
                    referrerLeadId: partner?.id,
                    customerName:
                        clientRecord?.full_name || refereeLead?.name || 'Referred Prospect',
                    customerPhone: clientRecord?.phone || refereeLead?.phone,
                    customerEmail: clientRecord?.email || refereeLead?.email,
                    customerLeadId: refereeLead?.id,
                    clientId: clientRecord?.id,
                    isNewCustomer: re.is_new_customer ?? true,
                    serviceCodeOrName: serviceName,
                    isFullPaymentReceived: Boolean(paidInvoice) || Boolean(re.is_paid_in_campaign_window),
                    paymentDateIso: paidDate || (re.is_paid_in_campaign_window ? activeCampaign.start_date : null),
                    campaignStartIso: activeCampaign.start_date,
                    campaignEndIso: activeCampaign.end_date,
                    referrerIdentifiedBeforeOrAtPayment: true,
                    isCancelledOrRefunded:
                        verStatus === 'cancelled_refunded' ||
                        clientInvoices.some((i: any) => i.status === 'cancelled'),
                    existingCreditedReferrerForCustomer: customerFirstReferrerMap[customerKey],
                });

                return {
                    id: re.id,
                    referrerCode: re.referrer_code,
                    referrerName: partner?.name || re.referrer_code,
                    referrerPhone: partner?.phone || '—',
                    referrerEmail: partner?.email || '—',
                    referrerLeadId: partner?.id || null,
                    refereeLeadId: re.referee_lead_id,
                    clientId: clientRecord?.id || re.client_id || null,
                    customerName:
                        clientRecord?.full_name || refereeLead?.name || 'Referred Contact',
                    customerPhone: clientRecord?.phone || refereeLead?.phone || '—',
                    customerEmail: clientRecord?.email || refereeLead?.email || '—',
                    servicePurchased: serviceName,
                    verificationStatus: verStatus,
                    disqualificationReason: re.disqualification_reason || '',
                    verificationNotes: re.verification_notes || '',
                    isNewCustomer: re.is_new_customer ?? true,
                    isEligibleService:
                        re.is_eligible_service ??
                        Boolean(matchServiceToCampaignPrice(serviceName, activeServices)),
                    isPaidInWindow:
                        re.is_paid_in_campaign_window ??
                        isPaymentWithinCampaignWindowInLagos(
                            paidDate,
                            activeCampaign.start_date,
                            activeCampaign.end_date
                        ),
                    invoiceId: re.invoice_id || paidInvoice?.id || null,
                    invoiceNumber: paidInvoice?.invoice_number || null,
                    paymentDate: paidDate,
                    verifiedAt: re.verified_at || null,
                    createdAt: re.created_at,
                    autoCheckQualified: check.isQualified,
                    autoCheckReasons: check.reasons,
                };
            });
            setReferralRows(verRows);

            // 5. Load & Reconcile Cumulative Referral Payouts Ledger
            let dbPayouts: any[] = [];
            const { data: payoutData, error: payoutErr } = await supabase
                .from('campaign_referral_payouts')
                .select('*')
                .order('verified_referral_count', { ascending: false });

            if (!payoutErr && payoutData) {
                dbPayouts = payoutData;
            }

            const dbPayoutByCode = new Map<string, any>();
            dbPayouts.forEach((p) =>
                dbPayoutByCode.set(String(p.referrer_code).toUpperCase(), p)
            );

            // Deduplicate qualified referrals per referrer
            const { qualifiedByReferrer } = deduplicateQualifiedReferrals(
                verRows.map((r) => ({
                    id: r.id,
                    referrer_code: r.referrerCode,
                    client_id: r.clientId,
                    referee_lead_id: r.refereeLeadId,
                    referee_phone: r.customerPhone,
                    verification_status: r.verificationStatus,
                    created_at: r.createdAt,
                }))
            );

            // Collect all distinct referrer codes
            const allCodes = new Set<string>();
            verRows.forEach((r) => {
                if (r.referrerCode) allCodes.add(r.referrerCode.toUpperCase());
            });
            dbPayouts.forEach((p) => {
                if (p.referrer_code) allCodes.add(String(p.referrer_code).toUpperCase());
            });

            const computedPayouts: PayoutLedgerRow[] = Array.from(allCodes).map((code) => {
                const dbRow = dbPayoutByCode.get(code);
                const partner = leadByReferralCodeMap.get(code);
                const qualifiedList = qualifiedByReferrer[code] || [];
                const verifiedCount = qualifiedList.length;
                const milestoneCalc = calculateReferralMilestoneReward(verifiedCount);
                const amountPaid = Number(dbRow?.amount_paid || 0);
                const totalEarned = milestoneCalc.totalRewardEarned;
                const amountPayable = Math.max(0, totalEarned - amountPaid);

                let status: ReferralPayoutStatus =
                    dbRow?.payment_status || 'pending_verification';
                if (
                    status === 'pending_verification' &&
                    totalEarned > 0 &&
                    amountPayable > 0
                ) {
                    status = 'payable';
                }

                return {
                    id: dbRow?.id || `computed-${code}`,
                    referrerCode: code,
                    referrerName: dbRow?.referrer_name || partner?.name || code,
                    referrerPhone: dbRow?.referrer_phone || partner?.phone || '—',
                    referrerEmail: dbRow?.referrer_email || partner?.email || '—',
                    verifiedReferralCount: verifiedCount,
                    milestoneReached: milestoneCalc.milestoneReached,
                    totalRewardEarned: totalEarned,
                    additionalRewardAtMilestone: milestoneCalc.additionalRewardAtMilestone,
                    amountPaid,
                    amountPayable,
                    paymentStatus: status,
                    bankName: dbRow?.bank_name || '',
                    accountName: dbRow?.account_name || '',
                    accountNumber: dbRow?.account_number || '',
                    paymentReference: dbRow?.payment_reference || '',
                    paymentDate: dbRow?.payment_date || null,
                    verifiedBy: dbRow?.verified_by || null,
                    paidBy: dbRow?.paid_by || null,
                    notes: dbRow?.notes || '',
                    isPersistedInDb: Boolean(dbRow?.id),
                };
            });

            computedPayouts.sort(
                (a, b) =>
                    b.totalRewardEarned - a.totalRewardEarned ||
                    b.verifiedReferralCount - a.verifiedReferralCount
            );
            setPayoutRows(computedPayouts);
        } catch (err: any) {
            console.error('[Campaigns] Failed to load workspace:', err);
            setQueryError(
                err?.message ||
                    'An unexpected database error occurred while loading campaign records.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCampaignWorkspace();
    }, []);

    // ============================================================================
    // COMPUTED DASHBOARD KPI METRICS (FROM REAL DATABASE RECORDS)
    // ============================================================================

    const dashboardMetrics = useMemo(() => {
        const qualifiedTx = transactionRows.filter(
            (t) =>
                t.paymentStatus === 'paid' &&
                t.campaignEligibilityStatus !== 'disqualified' &&
                t.campaignEligibilityStatus !== 'cancelled_refunded'
        );

        const totalCampaignRevenue = qualifiedTx.reduce(
            (sum, t) => sum + t.promoProfessionalFee,
            0
        );
        const totalDiscountsGranted = qualifiedTx.reduce(
            (sum, t) =>
                sum + Math.max(0, t.regularProfessionalFee - t.promoProfessionalFee),
            0
        );
        const totalGrossProfit = qualifiedTx.reduce((sum, t) => sum + t.grossProfit, 0);

        const successfulReferralsCount = payoutRows.reduce(
            (sum, p) => sum + p.verifiedReferralCount,
            0
        );
        const pendingReferralsCount = referralRows.filter(
            (r) =>
                r.verificationStatus === 'pending' ||
                r.verificationStatus === 'under_review'
        ).length;

        const totalRewardsEarned = payoutRows.reduce(
            (sum, p) => sum + p.totalRewardEarned,
            0
        );
        const totalRewardsPaid = payoutRows
            .filter((p) => p.paymentStatus === 'paid')
            .reduce((sum, p) => sum + p.amountPaid, 0);
        const totalRewardsPayable = payoutRows
            .filter((p) => p.paymentStatus !== 'disqualified')
            .reduce((sum, p) => sum + p.amountPayable, 0);
        const outstandingRewards = Math.max(0, totalRewardsEarned - totalRewardsPaid);

        // Breakdown by service category against Policy Section 5 Targets
        const countByService = {
            businessName: qualifiedTx.filter((t) =>
                t.servicePurchased.toLowerCase().includes('business name') &&
                !t.servicePurchased.toLowerCase().includes('annual')
            ).length,
            company: qualifiedTx.filter(
                (t) =>
                    (t.servicePurchased.toLowerCase().includes('company') ||
                        t.servicePurchased.toLowerCase().includes('llc')) &&
                    !t.servicePurchased.toLowerCase().includes('annual')
            ).length,
            ngo: qualifiedTx.filter((t) =>
                t.servicePurchased.toLowerCase().includes('ngo')
            ).length,
            scuml: qualifiedTx.filter((t) =>
                t.servicePurchased.toLowerCase().includes('scuml')
            ).length,
            annualReturns: qualifiedTx.filter((t) =>
                t.servicePurchased.toLowerCase().includes('annual')
            ).length,
        };

        return {
            totalEnquiries: campaignInquiriesCount,
            newCustomersAcquired: newCustomersCount,
            campaignTransactionsCount: qualifiedTx.length,
            totalAllCampaignInvoices: transactionRows.length,
            totalCampaignRevenue,
            totalDiscountsGranted,
            totalGrossProfit,
            netProfitAfterReferralRewards: totalGrossProfit - totalRewardsEarned,
            referralParticipants: referralParticipantsCount,
            successfulReferrals: successfulReferralsCount,
            pendingReferrals: pendingReferralsCount,
            totalRewardsEarned,
            totalRewardsPayable,
            totalRewardsPaid,
            outstandingRewards,
            countByService,
        };
    }, [
        transactionRows,
        payoutRows,
        referralRows,
        campaignInquiriesCount,
        newCustomersCount,
        referralParticipantsCount,
    ]);

    // ============================================================================
    // HANDLERS: CAMPAIGN CONFIG, PRICING, VERIFICATION & PAYOUTS
    // ============================================================================

    const handleSaveCampaignConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!permissions.canEditCampaignConfig) return;
        setIsSavingConfig(true);
        setActionFeedback(null);

        try {
            const { error } = await supabase
                .from('campaigns')
                .update({
                    status: campaign.configured_status,
                    promo_headline: campaign.promo_headline,
                    referral_headline: campaign.referral_headline,
                    is_publicly_visible: campaign.is_publicly_visible,
                    spin_and_win_paused: campaign.spin_and_win_paused,
                    allow_preview_pricing: campaign.allow_preview_pricing,
                    updated_by: user?.id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('slug', OFFICE_OPENING_CAMPAIGN_SLUG);

            if (error) throw error;

            await supabase.from('audit_logs').insert({
                staff_id: user?.id || null,
                staff_email: profile?.email || user?.email || null,
                action: 'update_campaign_configuration',
                entity_type: 'campaigns',
                entity_id: campaign.id,
                new_values: {
                    status: campaign.configured_status,
                    is_publicly_visible: campaign.is_publicly_visible,
                    spin_and_win_paused: campaign.spin_and_win_paused,
                    allow_preview_pricing: campaign.allow_preview_pricing,
                },
            });

            invalidateCampaignCache();
            await refreshCampaignBundle();
            await loadCampaignWorkspace();
            setActionFeedback({
                type: 'success',
                message: 'Campaign configuration updated and logged to audit trail.',
            });
        } catch (err: any) {
            setActionFeedback({
                type: 'error',
                message: err?.message || 'Failed to update campaign configuration.',
            });
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleSaveServicePrice = async (srv: CampaignServicePrice) => {
        if (!permissions.canEditCampaignPricing || !priceDraft) return;
        setActionFeedback(null);

        try {
            const { error } = await supabase
                .from('campaign_service_prices')
                .update({
                    regular_professional_fee: priceDraft.regular_professional_fee,
                    discount_percentage: priceDraft.discount_percentage,
                    promo_professional_fee: priceDraft.promo_professional_fee,
                    direct_cost_estimate: priceDraft.direct_cost_estimate,
                    is_eligible: priceDraft.is_eligible,
                    updated_by: user?.id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', srv.id);

            if (error) throw error;

            await supabase.from('audit_logs').insert({
                staff_id: user?.id || null,
                staff_email: profile?.email || user?.email || null,
                action: 'update_campaign_service_price',
                entity_type: 'campaign_service_prices',
                entity_id: srv.id,
                old_values: {
                    service_name: srv.service_name,
                    regular_professional_fee: srv.regular_professional_fee,
                    discount_percentage: srv.discount_percentage,
                    promo_professional_fee: srv.promo_professional_fee,
                    is_eligible: srv.is_eligible,
                },
                new_values: priceDraft,
            });

            setEditingPriceId(null);
            setPriceDraft(null);
            invalidateCampaignCache();
            await refreshCampaignBundle();
            await loadCampaignWorkspace();
            setActionFeedback({
                type: 'success',
                message: `Updated campaign pricing for ${srv.service_name}. Historical quotations and invoices remain unchanged.`,
            });
        } catch (err: any) {
            setActionFeedback({
                type: 'error',
                message: err?.message || 'Failed to update campaign service pricing.',
            });
        }
    };

    const handleVerifyReferralSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReferral || !permissions.canVerifyReferrals) return;
        setIsVerifyingReferral(true);
        setActionFeedback(null);

        try {
            const { error } = await supabase.rpc('ablebiz_verify_campaign_referral', {
                p_referral_event_id: selectedReferral.id,
                p_verification_status: verifyForm.status,
                p_service_purchased: verifyForm.servicePurchased || selectedReferral.servicePurchased,
                p_invoice_id: selectedReferral.invoiceId,
                p_payment_id: null,
                p_is_new_customer: verifyForm.isNewCustomer,
                p_is_eligible_service: verifyForm.isEligibleService,
                p_is_paid_in_window: verifyForm.isPaidInWindow,
                p_disqualification_reason: verifyForm.disqualificationReason || null,
                p_notes: verifyForm.notes || null,
            });

            if (error) throw error;

            setSelectedReferral(null);
            await loadCampaignWorkspace();
            setActionFeedback({
                type: 'success',
                message: `Referral verification status updated to "${verifyForm.status}" and cumulative milestone recalculated.`,
            });
        } catch (err: any) {
            setActionFeedback({
                type: 'error',
                message: err?.message || 'Failed to verify referral.',
            });
        } finally {
            setIsVerifyingReferral(false);
        }
    };

    const handleUpdatePayoutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayout || !permissions.canRecordRewardPayouts) return;
        setIsSavingPayout(true);
        setActionFeedback(null);

        try {
            // Ensure payout record exists in campaign_referral_payouts first
            if (!selectedPayout.isPersistedInDb) {
                await supabase.rpc('ablebiz_recalculate_referrer_campaign_payout', {
                    p_campaign_id: campaign.id,
                    p_referrer_code: selectedPayout.referrerCode,
                });
            }

            const { data: targetRow } = await supabase
                .from('campaign_referral_payouts')
                .select('id')
                .eq('referrer_code', selectedPayout.referrerCode)
                .maybeSingle();

            if (!targetRow?.id) {
                throw new Error(
                    'Payout record not yet initialized in database. Please ensure the campaign SQL migration is applied.'
                );
            }

            const { error } = await supabase.rpc('ablebiz_update_referral_payout', {
                p_payout_id: targetRow.id,
                p_payment_status: payoutForm.paymentStatus,
                p_amount_paid: Number(payoutForm.amountPaid),
                p_payment_reference: payoutForm.paymentReference || null,
                p_bank_name: payoutForm.bankName || null,
                p_account_name: payoutForm.accountName || null,
                p_account_number: payoutForm.accountNumber || null,
                p_notes: payoutForm.notes || null,
            });

            if (error) throw error;

            setSelectedPayout(null);
            await loadCampaignWorkspace();
            setActionFeedback({
                type: 'success',
                message: `Referral payout for ${selectedPayout.referrerName} (${selectedPayout.referrerCode}) updated to "${payoutForm.paymentStatus}".`,
            });
        } catch (err: any) {
            setActionFeedback({
                type: 'error',
                message: err?.message || 'Failed to update referral payout.',
            });
        } finally {
            setIsSavingPayout(false);
        }
    };

    const handleVerifyInvoiceTransaction = async (
        tx: TransactionRegisterRow,
        newStatus: 'verified' | 'disqualified'
    ) => {
        if (!permissions.canVerifyReferrals) return;
        try {
            const { error } = await supabase
                .from('invoices')
                .update({
                    transaction_verification_status: newStatus,
                    campaign_eligibility_status:
                        newStatus === 'verified' ? 'qualified' : 'disqualified',
                    verified_by: user?.id || null,
                    verified_at: new Date().toISOString(),
                })
                .eq('id', tx.invoiceId);

            if (error) throw error;

            await supabase.from('audit_logs').insert({
                staff_id: user?.id || null,
                staff_email: profile?.email || user?.email || null,
                action: 'verify_campaign_transaction',
                entity_type: 'invoices',
                entity_id: tx.invoiceId,
                new_values: {
                    invoice_number: tx.invoiceNumber,
                    transaction_verification_status: newStatus,
                },
            });

            await loadCampaignWorkspace();
            setActionFeedback({
                type: 'success',
                message: `Transaction ${tx.invoiceNumber} marked as ${newStatus}.`,
            });
        } catch (err: any) {
            setActionFeedback({
                type: 'error',
                message: err?.message || 'Could not update transaction verification.',
            });
        }
    };

    // ============================================================================
    // CSV EXPORT UTILITIES (PART 3D)
    // ============================================================================

    const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
        const escapeCell = (val: string | number) => {
            const s = String(val ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };
        const csvContent = [
            headers.map(escapeCell).join(','),
            ...rows.map((r) => r.map(escapeCell).join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportTransactionsCsv = () => {
        exportCsv(
            `ablebiz-campaign-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
            [
                'Invoice Number',
                'Customer ID',
                'Customer Name',
                'Phone Number',
                'Service Purchased',
                'Regular Professional Fee (NGN)',
                'Discount %',
                'Promo Professional Fee (NGN)',
                'Statutory Charges (NGN)',
                'Total Payable (NGN)',
                'Amount Paid (NGN)',
                'Gross Profit (NGN)',
                'Payment Status',
                'Payment Date',
                'Campaign Eligibility',
                'Referrer Name',
                'Referral Code',
                'Referral Status',
                'Verification Status',
            ],
            transactionRows.map((t) => [
                t.invoiceNumber,
                t.customerCode,
                t.customerName,
                t.customerPhone,
                t.servicePurchased,
                t.regularProfessionalFee,
                t.discountPercentage,
                t.promoProfessionalFee,
                t.statutoryCharges,
                t.totalAmountPayable,
                t.amountPaid,
                t.grossProfit,
                t.paymentStatus,
                t.paymentDate ? formatLagosDateTime(t.paymentDate) : '',
                t.campaignEligibilityStatus,
                t.referrerName,
                t.referralCode,
                t.referralStatus,
                t.transactionVerificationStatus,
            ])
        );
    };

    const handleExportPayoutsCsv = () => {
        exportCsv(
            `ablebiz-campaign-referral-payouts-${new Date().toISOString().slice(0, 10)}.csv`,
            [
                'Referrer Code',
                'Referrer Name',
                'Phone',
                'Email',
                'Verified Successful Referrals',
                'Highest Milestone Reached',
                'Total Cumulative Reward Earned (NGN)',
                'Additional Reward at Milestone (NGN)',
                'Amount Paid (NGN)',
                'Amount Payable (NGN)',
                'Payment Status',
                'Bank Name',
                'Account Name',
                'Account Number',
                'Payment Reference',
                'Payment Date',
            ],
            payoutRows.map((p) => [
                p.referrerCode,
                p.referrerName,
                p.referrerPhone,
                p.referrerEmail,
                p.verifiedReferralCount,
                p.milestoneReached,
                p.totalRewardEarned,
                p.additionalRewardAtMilestone,
                p.amountPaid,
                p.amountPayable,
                p.paymentStatus,
                p.bankName,
                p.accountName,
                p.accountNumber,
                p.paymentReference,
                p.paymentDate ? formatLagosDateTime(p.paymentDate) : '',
            ])
        );
    };

    // Filtered lists
    const filteredTransactions = useMemo(() => {
        return transactionRows.filter((t) => {
            if (txStatusFilter !== 'all' && t.campaignEligibilityStatus !== txStatusFilter) {
                return false;
            }
            if (!txSearch.trim()) return true;
            const q = txSearch.toLowerCase();
            return (
                t.customerName.toLowerCase().includes(q) ||
                t.customerPhone.toLowerCase().includes(q) ||
                t.invoiceNumber.toLowerCase().includes(q) ||
                t.servicePurchased.toLowerCase().includes(q) ||
                t.referralCode.toLowerCase().includes(q)
            );
        });
    }, [transactionRows, txSearch, txStatusFilter]);

    const filteredReferrals = useMemo(() => {
        return referralRows.filter((r) => {
            if (refStatusFilter !== 'all' && r.verificationStatus !== refStatusFilter) {
                return false;
            }
            if (!refSearch.trim()) return true;
            const q = refSearch.toLowerCase();
            return (
                r.referrerCode.toLowerCase().includes(q) ||
                r.referrerName.toLowerCase().includes(q) ||
                r.customerName.toLowerCase().includes(q) ||
                r.customerPhone.toLowerCase().includes(q) ||
                r.servicePurchased.toLowerCase().includes(q)
            );
        });
    }, [referralRows, refSearch, refStatusFilter]);

    return (
        <div className="space-y-6">
            {/* TOP HEADER */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-amber-900">
                            <Sparkles className="h-3.5 w-3.5" /> Official Campaign Workspace
                        </span>
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold uppercase ${
                                campaign.effective_status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : campaign.effective_status === 'scheduled'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                            }`}
                        >
                            Effective Status (WAT): {campaign.effective_status}
                        </span>
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold ${
                                campaign.spin_and_win_paused
                                    ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            }`}
                        >
                            {campaign.spin_and_win_paused ? (
                                <>
                                    <PauseCircle className="h-3.5 w-3.5" /> Spin & Win Paused
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="h-3.5 w-3.5" /> Spin & Win Active
                                </>
                            )}
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">{campaign.name}</h1>
                    <p className="text-xs sm:text-sm text-slate-500">
                        Period: <strong>November 5 – November 20, 2026</strong> • Timezone:{' '}
                        <strong>{campaign.timezone} (WAT)</strong> • Location:{' '}
                        <strong>{campaign.location}</strong>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={loadCampaignWorkspace}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </button>
                    {permissions.canExportReports && (
                        <button
                            type="button"
                            onClick={handleExportTransactionsCsv}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-950 transition shadow-xs"
                        >
                            <Download className="h-4 w-4" /> Export Transactions CSV
                        </button>
                    )}
                </div>
            </div>

            {/* EXPLICIT QUERY ERROR ALERT (NEVER SILENTLY ZERO-FALLBACK) */}
            {queryError && (
                <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-red-900 shadow-xs">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <div className="font-extrabold text-sm">
                                Database Query Error — Metrics Not Zeroed
                            </div>
                            <p className="text-xs text-red-800">{queryError}</p>
                            <button
                                type="button"
                                onClick={loadCampaignWorkspace}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800"
                            >
                                Retry Database Query
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {migrationNotice && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>{migrationNotice}</div>
                </div>
            )}

            {actionFeedback && (
                <div
                    className={`rounded-2xl border p-4 text-xs font-bold flex items-center justify-between ${
                        actionFeedback.type === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-red-200 bg-red-50 text-red-900'
                    }`}
                >
                    <span>{actionFeedback.message}</span>
                    <button
                        type="button"
                        onClick={() => setActionFeedback(null)}
                        className="text-xs underline ml-4"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* WORKSPACE NAVIGATION TABS */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 print:hidden">
                {[
                    { id: 'overview', label: '1. Overview Dashboard', icon: BarChart3 },
                    { id: 'pricing', label: '2. Pricing & Configuration', icon: Tag },
                    {
                        id: 'transactions',
                        label: `3. Transaction Register (${transactionRows.length})`,
                        icon: FileSpreadsheet,
                    },
                    {
                        id: 'referrals',
                        label: `4. Referral Verification & Payouts (${referralRows.length})`,
                        icon: Award,
                    },
                    { id: 'reports', label: '5. Executive Reports & Exports', icon: TrendingUp },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                                active
                                    ? 'bg-[#0A2558] text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ========================================================================
                TAB 1: CAMPAIGN OVERVIEW DASHBOARD (PART 3A)
               ======================================================================== */}
            {activeTab === 'overview' && !queryError && (
                <div className="space-y-6">
                    {/* 16 Required KPI Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Campaign Enquiries</span>
                                <Users className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="mt-2 text-3xl font-black text-slate-900">
                                {dashboardMetrics.totalEnquiries}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Target: {campaign.performance_targets.customer_inquiries}+ inquiries
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>New Customers Acquired</span>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="mt-2 text-3xl font-black text-slate-900">
                                {dashboardMetrics.newCustomersAcquired}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Target: {campaign.performance_targets.new_customers_acquired} new clients
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Paid Promo Transactions</span>
                                <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="mt-2 text-3xl font-black text-slate-900">
                                {dashboardMetrics.campaignTransactionsCount}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Target: {campaign.performance_targets.total_service_transactions}+ paid services ({dashboardMetrics.totalAllCampaignInvoices} total invoices)
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Total Campaign Revenue</span>
                                <Banknote className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="mt-2 text-2xl font-black text-emerald-700">
                                {formatNaira(dashboardMetrics.totalCampaignRevenue)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Professional service fees collected
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Discounts Granted</span>
                                <Tag className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="mt-2 text-2xl font-black text-amber-700">
                                {formatNaira(dashboardMetrics.totalDiscountsGranted)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Total professional fee savings given
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Campaign Gross Profit</span>
                                <TrendingUp className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="mt-2 text-2xl font-black text-[#0A2558]">
                                {formatNaira(dashboardMetrics.totalGrossProfit)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Promo fees minus direct service costs
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Referral Participants</span>
                                <Users className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="mt-2 text-3xl font-black text-slate-900">
                                {dashboardMetrics.referralParticipants}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Target: {campaign.performance_targets.referral_participants} active partners
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Referrals (Verified / Pending)</span>
                                <Award className="h-4 w-4 text-amber-500" />
                            </div>
                            <div className="mt-2 text-2xl font-black text-slate-900">
                                <span className="text-emerald-700">
                                    {dashboardMetrics.successfulReferrals}
                                </span>{' '}
                                /{' '}
                                <span className="text-amber-600">
                                    {dashboardMetrics.pendingReferrals}
                                </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Target: {campaign.performance_targets.successful_referrals} successful referrals
                            </div>
                        </div>
                    </div>

                    {/* Referral Reward Financial Summary Strip */}
                    <div className="grid gap-4 sm:grid-cols-4 bg-slate-900 text-white p-6 rounded-2xl shadow-md">
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Total Referral Rewards Earned
                            </div>
                            <div className="mt-1 text-2xl font-black text-amber-400">
                                {formatNaira(dashboardMetrics.totalRewardsEarned)}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                                Cumulative milestones unlocked
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Referral Rewards Payable
                            </div>
                            <div className="mt-1 text-2xl font-black text-blue-300">
                                {formatNaira(dashboardMetrics.totalRewardsPayable)}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                                Approved & awaiting bank transfer
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Referral Rewards Paid
                            </div>
                            <div className="mt-1 text-2xl font-black text-emerald-400">
                                {formatNaira(dashboardMetrics.totalRewardsPaid)}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                                Disbursed with payment reference
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Outstanding Referral Rewards
                            </div>
                            <div className="mt-1 text-2xl font-black text-white">
                                {formatNaira(dashboardMetrics.outstandingRewards)}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                                Net unpaid milestone balance
                            </div>
                        </div>
                    </div>

                    {/* Policy Section 5 Performance Indicator Targets Progress */}
                    <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-black text-slate-900">
                                    Campaign Performance Targets vs. Actuals (Section 5 Policy)
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Live tracking against the official ABLEBIZ Office Opening Special Promo targets
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            {[
                                {
                                    label: 'Business Name Reg.',
                                    actual: dashboardMetrics.countByService.businessName,
                                    target: campaign.performance_targets.business_name_registrations,
                                },
                                {
                                    label: 'Company Reg.',
                                    actual: dashboardMetrics.countByService.company,
                                    target: campaign.performance_targets.company_registrations,
                                },
                                {
                                    label: 'NGO Reg.',
                                    actual: dashboardMetrics.countByService.ngo,
                                    target: campaign.performance_targets.ngo_registrations,
                                },
                                {
                                    label: 'SCUML Services',
                                    actual: dashboardMetrics.countByService.scuml,
                                    target: campaign.performance_targets.scuml_services,
                                },
                                {
                                    label: 'Annual Returns',
                                    actual: dashboardMetrics.countByService.annualReturns,
                                    target: campaign.performance_targets.annual_returns_services,
                                },
                            ].map((item) => {
                                const pct = Math.min(
                                    100,
                                    Math.round((item.actual / Math.max(1, item.target)) * 100)
                                );
                                return (
                                    <div
                                        key={item.label}
                                        className="rounded-xl bg-slate-50 p-4 border border-slate-200/70"
                                    >
                                        <div className="text-xs font-bold text-slate-700">
                                            {item.label}
                                        </div>
                                        <div className="mt-1 flex items-baseline justify-between">
                                            <span className="text-xl font-black text-slate-900">
                                                {item.actual}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-500">
                                                / {item.target} target ({pct}%)
                                            </span>
                                        </div>
                                        <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                                            <div
                                                className="h-full bg-[#0A2558] rounded-full transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================
                TAB 2: CAMPAIGN PRICING & CONFIGURATION MANAGEMENT (PART 3B)
               ======================================================================== */}
            {activeTab === 'pricing' && (
                <div className="space-y-6">
                    {/* Central Campaign Configuration Form */}
                    <form
                        onSubmit={handleSaveCampaignConfig}
                        className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-5"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">
                                    Central Campaign Configuration & Spin & Win Pause Control
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Single source of truth for both the public ABLEBIZ website and ABLEBIZ Suite.
                                </p>
                            </div>
                            {campaign.updated_at && (
                                <span className="text-xs text-slate-400">
                                    Last updated: {formatLagosDateTime(campaign.updated_at)} (WAT)
                                </span>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <label className="grid gap-1 text-xs font-bold text-slate-700">
                                Configured Campaign Status
                                <select
                                    disabled={!permissions.canEditCampaignConfig}
                                    value={campaign.configured_status}
                                    onChange={(e) =>
                                        setCampaign({
                                            ...campaign,
                                            configured_status: e.target
                                                .value as CampaignConfiguredStatus,
                                        })
                                    }
                                    className="h-10 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-900 disabled:bg-slate-100"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="completed">Completed</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </label>

                            <label className="grid gap-1 text-xs font-bold text-slate-700">
                                Promotional Headline
                                <input
                                    disabled={!permissions.canEditCampaignConfig}
                                    value={campaign.promo_headline}
                                    onChange={(e) =>
                                        setCampaign({ ...campaign, promo_headline: e.target.value })
                                    }
                                    className="h-10 rounded-xl border border-slate-300 px-3 text-xs text-slate-900 disabled:bg-slate-100"
                                />
                            </label>

                            <label className="grid gap-1 text-xs font-bold text-slate-700">
                                Referral Reward Headline
                                <input
                                    disabled={!permissions.canEditCampaignConfig}
                                    value={campaign.referral_headline}
                                    onChange={(e) =>
                                        setCampaign({
                                            ...campaign,
                                            referral_headline: e.target.value,
                                        })
                                    }
                                    className="h-10 rounded-xl border border-slate-300 px-3 text-xs text-slate-900 disabled:bg-slate-100"
                                />
                            </label>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3 pt-2">
                            <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
                                <input
                                    type="checkbox"
                                    disabled={!permissions.canEditCampaignConfig}
                                    checked={campaign.is_publicly_visible}
                                    onChange={(e) =>
                                        setCampaign({
                                            ...campaign,
                                            is_publicly_visible: e.target.checked,
                                        })
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                />
                                <div>
                                    <strong className="font-bold text-slate-900 block">
                                        Public Website Visibility
                                    </strong>
                                    <span className="text-slate-500">
                                        Display Office Opening Promo banners and `/office-opening-promo` page.
                                    </span>
                                </div>
                            </label>

                            <label className="flex items-start gap-2.5 rounded-xl bg-amber-50/70 p-3.5 border border-amber-200 text-xs">
                                <input
                                    type="checkbox"
                                    disabled={!permissions.canEditCampaignConfig}
                                    checked={campaign.spin_and_win_paused}
                                    onChange={(e) =>
                                        setCampaign({
                                            ...campaign,
                                            spin_and_win_paused: e.target.checked,
                                        })
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-amber-400"
                                />
                                <div>
                                    <strong className="font-bold text-amber-950 block">
                                        Pause Spin & Win Feature (Part 6)
                                    </strong>
                                    <span className="text-amber-800">
                                        Disables popup timer, public Spin & Win triggers, and blocks new spin rewards.
                                    </span>
                                </div>
                            </label>

                            <label className="flex items-start gap-2.5 rounded-xl bg-blue-50/70 p-3.5 border border-blue-200 text-xs">
                                <input
                                    type="checkbox"
                                    disabled={!permissions.canEditCampaignConfig}
                                    checked={campaign.allow_preview_pricing}
                                    onChange={(e) =>
                                        setCampaign({
                                            ...campaign,
                                            allow_preview_pricing: e.target.checked,
                                        })
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-blue-400"
                                />
                                <div>
                                    <strong className="font-bold text-blue-950 block">
                                        Allow Suite Preview Pricing Before Nov 5
                                    </strong>
                                    <span className="text-blue-800">
                                        Allows staff to prepare campaign quotations before 00:00 WAT Nov 5.
                                    </span>
                                </div>
                            </label>
                        </div>

                        {permissions.canEditCampaignConfig && (
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isSavingConfig}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-950 disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    {isSavingConfig
                                        ? 'Saving Configuration...'
                                        : 'Save Campaign Configuration'}
                                </button>
                            </div>
                        )}
                    </form>

                    {/* Campaign Service Pricing Table */}
                    <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">
                                    Approved Promotional Service Pricing Catalog
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Campaign prices do NOT overwrite standard `services_catalog` fees. Quotations and invoices store frozen price snapshots.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500">
                                        <th className="py-3 px-4">Eligible Service</th>
                                        <th className="py-3 px-4 text-right">
                                            Regular Professional Fee
                                        </th>
                                        <th className="py-3 px-4 text-right">Discount %</th>
                                        <th className="py-3 px-4 text-right">
                                            Promo Professional Fee
                                        </th>
                                        <th className="py-3 px-4 text-right">
                                            Direct Cost Estimate
                                        </th>
                                        <th className="py-3 px-4 text-right">
                                            Expected Gross Profit
                                        </th>
                                        <th className="py-3 px-4 text-center">Eligibility</th>
                                        {permissions.canEditCampaignPricing && (
                                            <th className="py-3 px-4 text-right">Manage</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {servicePrices.map((srv) => {
                                        const isEditing = editingPriceId === srv.id;
                                        return (
                                            <tr key={srv.id} className="hover:bg-slate-50/70">
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-slate-900">
                                                        {srv.service_name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        Code: {srv.service_code} • {srv.category}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                                                    {isEditing && priceDraft ? (
                                                        <input
                                                            type="number"
                                                            value={priceDraft.regular_professional_fee}
                                                            onChange={(e) => {
                                                                const reg = Number(e.target.value);
                                                                const promo = Math.round(
                                                                    reg *
                                                                        (1 -
                                                                            priceDraft.discount_percentage /
                                                                                100)
                                                                );
                                                                setPriceDraft({
                                                                    ...priceDraft,
                                                                    regular_professional_fee: reg,
                                                                    promo_professional_fee: promo,
                                                                });
                                                            }}
                                                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                                                        />
                                                    ) : (
                                                        formatNaira(srv.regular_professional_fee)
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    {isEditing && priceDraft ? (
                                                        <input
                                                            type="number"
                                                            value={priceDraft.discount_percentage}
                                                            onChange={(e) => {
                                                                const pct = Number(e.target.value);
                                                                const promo = Math.round(
                                                                    priceDraft.regular_professional_fee *
                                                                        (1 - pct / 100)
                                                                );
                                                                setPriceDraft({
                                                                    ...priceDraft,
                                                                    discount_percentage: pct,
                                                                    promo_professional_fee: promo,
                                                                });
                                                            }}
                                                            className="w-16 rounded border border-slate-300 px-2 py-1 text-right"
                                                        />
                                                    ) : (
                                                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-extrabold text-amber-900">
                                                            {srv.discount_percentage}%
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-black text-[#0A2558]">
                                                    {isEditing && priceDraft ? (
                                                        <input
                                                            type="number"
                                                            value={priceDraft.promo_professional_fee}
                                                            onChange={(e) =>
                                                                setPriceDraft({
                                                                    ...priceDraft,
                                                                    promo_professional_fee: Number(
                                                                        e.target.value
                                                                    ),
                                                                })
                                                            }
                                                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                                                        />
                                                    ) : (
                                                        formatNaira(srv.promo_professional_fee)
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-right text-slate-500">
                                                    {formatNaira(srv.direct_cost_estimate)}
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                                                    {formatNaira(
                                                        srv.promo_professional_fee -
                                                            srv.direct_cost_estimate
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    {isEditing && priceDraft ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={priceDraft.is_eligible}
                                                            onChange={(e) =>
                                                                setPriceDraft({
                                                                    ...priceDraft,
                                                                    is_eligible: e.target.checked,
                                                                })
                                                            }
                                                        />
                                                    ) : srv.is_eligible ? (
                                                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                                            Eligible
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                {permissions.canEditCampaignPricing && (
                                                    <td className="py-3.5 px-4 text-right">
                                                        {isEditing ? (
                                                            <div className="flex justify-end gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleSaveServicePrice(srv)
                                                                    }
                                                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingPriceId(null);
                                                                        setPriceDraft(null);
                                                                    }}
                                                                    className="rounded-lg bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingPriceId(srv.id);
                                                                    setPriceDraft({
                                                                        regular_professional_fee:
                                                                            srv.regular_professional_fee,
                                                                        discount_percentage:
                                                                            srv.discount_percentage,
                                                                        promo_professional_fee:
                                                                            srv.promo_professional_fee,
                                                                        direct_cost_estimate:
                                                                            srv.direct_cost_estimate,
                                                                        is_eligible: srv.is_eligible,
                                                                    });
                                                                }}
                                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <Edit3 className="h-3 w-3" /> Edit
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Configuration & Campaign Audit Trail */}
                    <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-3">
                        <h3 className="text-sm font-black text-slate-900">
                            Campaign Configuration & Verification Audit Trail
                        </h3>
                        {recentAuditLogs.length === 0 ? (
                            <p className="text-xs text-slate-400">
                                No campaign configuration changes logged yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                                            <th className="py-2 px-3">Timestamp (WAT)</th>
                                            <th className="py-2 px-3">Staff Actor</th>
                                            <th className="py-2 px-3">Action</th>
                                            <th className="py-2 px-3">Entity</th>
                                            <th className="py-2 px-3">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recentAuditLogs.slice(0, 12).map((log) => (
                                            <tr key={log.id}>
                                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                                                    {formatLagosDateTime(log.created_at)}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-slate-800">
                                                    {log.staff_email || 'Authorized Staff'}
                                                </td>
                                                <td className="py-2 px-3 font-bold text-[#0A2558]">
                                                    {log.action}
                                                </td>
                                                <td className="py-2 px-3 text-slate-500">
                                                    {log.entity_type}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-[10px] text-slate-600 max-w-md truncate">
                                                    {JSON.stringify(log.new_values)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================
                TAB 3: CAMPAIGN TRANSACTION REGISTER (PART 3C)
               ======================================================================== */}
            {activeTab === 'transactions' && (
                <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">
                                Campaign Transaction Register
                            </h2>
                            <p className="text-xs text-slate-500">
                                Real customer, invoice, payment, and referral attribution records.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    value={txSearch}
                                    onChange={(e) => setTxSearch(e.target.value)}
                                    placeholder="Search client, phone, invoice, ref code..."
                                    className="h-9 rounded-xl border border-slate-300 pl-8 pr-3 text-xs text-slate-900"
                                />
                            </div>
                            <select
                                value={txStatusFilter}
                                onChange={(e) => setTxStatusFilter(e.target.value)}
                                className="h-9 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700"
                            >
                                <option value="all">All Eligibility Statuses</option>
                                <option value="qualified">Qualified</option>
                                <option value="pending_payment">Pending Payment</option>
                                <option value="disqualified">Disqualified</option>
                                <option value="cancelled_refunded">Cancelled / Refunded</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                                    <th className="py-3 px-3">Customer ID & Name</th>
                                    <th className="py-3 px-3">Phone</th>
                                    <th className="py-3 px-3">Service Purchased</th>
                                    <th className="py-3 px-3 text-right">Regular Fee</th>
                                    <th className="py-3 px-3 text-right">Discount</th>
                                    <th className="py-3 px-3 text-right">Promo Fee</th>
                                    <th className="py-3 px-3 text-right">Statutory Fee</th>
                                    <th className="py-3 px-3 text-right">Total Payable</th>
                                    <th className="py-3 px-3">Payment Status & Date</th>
                                    <th className="py-3 px-3">Eligibility</th>
                                    <th className="py-3 px-3">Referrer & Code</th>
                                    <th className="py-3 px-3">Verification</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={12}
                                            className="py-8 text-center text-xs text-slate-400"
                                        >
                                            No matching campaign transactions found in database.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((tx) => (
                                        <tr key={tx.invoiceId} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-900">
                                                    {tx.customerName}
                                                </div>
                                                <div className="font-mono text-[10px] text-slate-400">
                                                    {tx.customerCode} • {tx.invoiceNumber}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                                                {tx.customerPhone}
                                            </td>
                                            <td className="py-3 px-3 font-semibold text-slate-800 max-w-[180px]">
                                                {tx.servicePurchased}
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-500">
                                                {formatNaira(tx.regularProfessionalFee)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-amber-700">
                                                {tx.discountPercentage}%
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-[#0A2558]">
                                                {formatNaira(tx.promoProfessionalFee)}
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-600">
                                                {formatNaira(tx.statutoryCharges)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-slate-900">
                                                {formatNaira(tx.totalAmountPayable)}
                                            </td>
                                            <td className="py-3 px-3">
                                                <span
                                                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                        tx.paymentStatus === 'paid'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    {tx.paymentStatus}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {tx.paymentDate
                                                        ? formatLagosDateTime(tx.paymentDate)
                                                        : 'Unpaid'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span
                                                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                        tx.campaignEligibilityStatus === 'qualified'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : tx.campaignEligibilityStatus ===
                                                              'pending_payment'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                    }`}
                                                >
                                                    {tx.campaignEligibilityStatus.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="font-semibold text-slate-800">
                                                    {tx.referrerName}
                                                </div>
                                                <div className="font-mono text-[10px] text-amber-700 font-bold">
                                                    {tx.referralCode} ({tx.referralStatus})
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                            tx.transactionVerificationStatus ===
                                                            'verified'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : tx.transactionVerificationStatus ===
                                                                  'disqualified'
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}
                                                    >
                                                        {tx.transactionVerificationStatus}
                                                    </span>
                                                    {permissions.canVerifyReferrals && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleVerifyInvoiceTransaction(
                                                                    tx,
                                                                    tx.transactionVerificationStatus ===
                                                                        'verified'
                                                                        ? 'disqualified'
                                                                        : 'verified'
                                                                )
                                                            }
                                                            className="text-[10px] font-bold text-blue-700 hover:underline"
                                                        >
                                                            Toggle
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================
                TAB 4: REFERRAL VERIFICATION & CUMULATIVE REWARD PAYOUTS (PART 4)
               ======================================================================== */}
            {activeTab === 'referrals' && (
                <div className="space-y-8">
                    {/* SECTION A: CUMULATIVE MILESTONE & REWARD PAYOUTS LEDGER */}
                    <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">
                                    Referral Reward Payouts Ledger (Cumulative Milestones)
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Milestones: 1 Ref = ₦2,000 | 3 Refs = ₦7,500 | 5 Refs = ₦15,000 | 10 Refs = ₦35,000. Multiple services by 1 customer count as 1 referral.
                                </p>
                            </div>
                            {permissions.canExportReports && (
                                <button
                                    type="button"
                                    onClick={handleExportPayoutsCsv}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                                >
                                    <Download className="h-3.5 w-3.5" /> Export Payouts CSV
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                                        <th className="py-3 px-3">Referrer Name & Code</th>
                                        <th className="py-3 px-3">Phone & Email</th>
                                        <th className="py-3 px-3 text-center">
                                            Verified Referrals
                                        </th>
                                        <th className="py-3 px-3 text-center">
                                            Milestone Reached
                                        </th>
                                        <th className="py-3 px-3 text-right">
                                            Total Reward Earned
                                        </th>
                                        <th className="py-3 px-3 text-right">
                                            Additional at Milestone
                                        </th>
                                        <th className="py-3 px-3 text-right">Amount Paid</th>
                                        <th className="py-3 px-3 text-right">Amount Payable</th>
                                        <th className="py-3 px-3">Bank Details</th>
                                        <th className="py-3 px-3">Payout Status</th>
                                        {permissions.canRecordRewardPayouts && (
                                            <th className="py-3 px-3 text-right">Action</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {payoutRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={11}
                                                className="py-8 text-center text-xs text-slate-400"
                                            >
                                                No referral participants recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        payoutRows.map((p) => (
                                            <tr
                                                key={p.referrerCode}
                                                className="hover:bg-slate-50/70"
                                            >
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-slate-900">
                                                        {p.referrerName}
                                                    </div>
                                                    <div className="font-mono text-[11px] font-bold text-amber-700">
                                                        {p.referrerCode}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-[11px] text-slate-600">
                                                    <div>{p.referrerPhone}</div>
                                                    <div className="text-slate-400">
                                                        {p.referrerEmail}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 font-black text-[#0A2558]">
                                                        {p.verifiedReferralCount}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-900">
                                                        {p.milestoneReached === 0
                                                            ? 'None'
                                                            : `${p.milestoneReached} Refs`}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-slate-900">
                                                    {formatNaira(p.totalRewardEarned)}
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                                                    +{formatNaira(p.additionalRewardAtMilestone)}
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                                                    {formatNaira(p.amountPaid)}
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-blue-800">
                                                    {formatNaira(p.amountPayable)}
                                                </td>
                                                <td className="py-3 px-3 text-[11px]">
                                                    {p.accountNumber ? (
                                                        <div>
                                                            <div className="font-bold text-slate-800">
                                                                {p.bankName} • {p.accountNumber}
                                                            </div>
                                                            <div className="text-slate-500">
                                                                {p.accountName}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">
                                                            Not submitted
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span
                                                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                                            p.paymentStatus === 'paid'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : p.paymentStatus === 'payable' ||
                                                                  p.paymentStatus === 'verified'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : p.paymentStatus === 'disqualified'
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}
                                                    >
                                                        {p.paymentStatus.replace(/_/g, ' ')}
                                                    </span>
                                                    {p.paymentReference && (
                                                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                                                            Ref: {p.paymentReference}
                                                        </div>
                                                    )}
                                                </td>
                                                {permissions.canRecordRewardPayouts && (
                                                    <td className="py-3 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedPayout(p);
                                                                setPayoutForm({
                                                                    paymentStatus: p.paymentStatus,
                                                                    amountPaid:
                                                                        p.amountPaid > 0
                                                                            ? p.amountPaid
                                                                            : p.totalRewardEarned,
                                                                    bankName: p.bankName,
                                                                    accountName: p.accountName,
                                                                    accountNumber: p.accountNumber,
                                                                    paymentReference:
                                                                        p.paymentReference,
                                                                    notes: p.notes,
                                                                });
                                                            }}
                                                            className="rounded-lg bg-[#0A2558] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-950"
                                                        >
                                                            Manage Payout
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SECTION B: INDIVIDUAL REFERRAL QUALIFICATION & VERIFICATION QUEUE */}
                    <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">
                                    Referral Qualification & Verification Queue
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Verify referrals against the 8 mandatory campaign policy criteria before approving rewards.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    value={refSearch}
                                    onChange={(e) => setRefSearch(e.target.value)}
                                    placeholder="Search referrer or referred customer..."
                                    className="h-9 rounded-xl border border-slate-300 px-3 text-xs text-slate-900"
                                />
                                <select
                                    value={refStatusFilter}
                                    onChange={(e) => setRefStatusFilter(e.target.value)}
                                    className="h-9 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700"
                                >
                                    <option value="all">All Verification Statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="successful">Successful</option>
                                    <option value="disqualified">Disqualified</option>
                                    <option value="disputed">Disputed</option>
                                    <option value="cancelled_refunded">Cancelled / Refunded</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                                        <th className="py-3 px-3">Date</th>
                                        <th className="py-3 px-3">Referrer</th>
                                        <th className="py-3 px-3">Referred Customer</th>
                                        <th className="py-3 px-3">Service Purchased</th>
                                        <th className="py-3 px-3">Automated Policy Check</th>
                                        <th className="py-3 px-3">Verification Status</th>
                                        {permissions.canVerifyReferrals && (
                                            <th className="py-3 px-3 text-right">Verify</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredReferrals.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="py-8 text-center text-xs text-slate-400"
                                            >
                                                No referrals match the current filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredReferrals.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50/70">
                                                <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                                                    {formatLagosDateTime(r.createdAt)}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-slate-900">
                                                        {r.referrerName}
                                                    </div>
                                                    <div className="font-mono text-[10px] font-bold text-amber-700">
                                                        {r.referrerCode} • {r.referrerPhone}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-slate-900">
                                                        {r.customerName}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-slate-500">
                                                        {r.customerPhone}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 font-semibold text-slate-800">
                                                    {r.servicePurchased}
                                                    {r.invoiceNumber && (
                                                        <div className="font-mono text-[10px] text-emerald-700">
                                                            Paid Invoice: {r.invoiceNumber}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 max-w-xs">
                                                    {r.autoCheckQualified ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                                                            <ShieldCheck className="h-3 w-3" /> Meets All 8 Policy Rules
                                                        </span>
                                                    ) : (
                                                        <div className="space-y-0.5">
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                                                                Needs Verification Review
                                                            </span>
                                                            <div className="text-[10px] text-slate-500">
                                                                {r.autoCheckReasons[0]}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span
                                                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                                            r.verificationStatus === 'successful'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : r.verificationStatus ===
                                                                      'disqualified' ||
                                                                  r.verificationStatus ===
                                                                      'cancelled_refunded'
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : 'bg-blue-100 text-blue-800'
                                                        }`}
                                                    >
                                                        {r.verificationStatus.replace(/_/g, ' ')}
                                                    </span>
                                                    {r.disqualificationReason && (
                                                        <div className="text-[10px] text-rose-600 mt-0.5">
                                                            Reason: {r.disqualificationReason}
                                                        </div>
                                                    )}
                                                </td>
                                                {permissions.canVerifyReferrals && (
                                                    <td className="py-3 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedReferral(r);
                                                                setVerifyForm({
                                                                    status: r.verificationStatus,
                                                                    servicePurchased:
                                                                        r.servicePurchased,
                                                                    isNewCustomer: r.isNewCustomer,
                                                                    isEligibleService:
                                                                        r.isEligibleService,
                                                                    isPaidInWindow:
                                                                        r.isPaidInWindow,
                                                                    disqualificationReason:
                                                                        r.disqualificationReason,
                                                                    notes: r.verificationNotes,
                                                                });
                                                            }}
                                                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-50"
                                                        >
                                                            Review / Verify
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================
                TAB 5: EXECUTIVE CAMPAIGN REPORTS & PRINT VIEW (PART 3D)
               ======================================================================== */}
            {activeTab === 'reports' && (
                <div className="rounded-2xl bg-white p-8 border border-slate-200 shadow-xs space-y-8">
                    <DocumentHeader
                        title="OFFICE OPENING SPECIAL PROMO & REFERRAL REWARDS — EXECUTIVE REPORT"
                        documentNumber={`CAMPAIGN-RPT-${new Date().getFullYear()}`}
                        date={formatLagosDateTime(new Date())}
                        status={campaign.effective_status.toUpperCase()}
                    />

                    <div className="flex flex-wrap gap-3 print:hidden">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-4 py-2.5 text-xs font-bold text-white"
                        >
                            <Printer className="h-4 w-4" /> Print Official Report
                        </button>
                        <button
                            type="button"
                            onClick={handleExportTransactionsCsv}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"
                        >
                            <Download className="h-4 w-4" /> Export Transactions CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportPayoutsCsv}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"
                        >
                            <Download className="h-4 w-4" /> Export Referral Payouts CSV
                        </button>
                    </div>

                    {/* Section 6.2 Post-Campaign Evaluation Summary Table */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-[#0A2558]">
                                1. Operational & Revenue Performance
                            </h3>
                            <div className="divide-y divide-slate-100 text-xs">
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">Total Campaign Inquiries:</span>
                                    <span className="font-bold text-slate-900">
                                        {dashboardMetrics.totalEnquiries}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">New Customers Acquired:</span>
                                    <span className="font-bold text-slate-900">
                                        {dashboardMetrics.newCustomersAcquired}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">Paid Campaign Services Sold:</span>
                                    <span className="font-bold text-slate-900">
                                        {dashboardMetrics.campaignTransactionsCount}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Total Campaign Professional Fee Revenue:
                                    </span>
                                    <span className="font-black text-emerald-700">
                                        {formatNaira(dashboardMetrics.totalCampaignRevenue)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Total Promotional Discounts Granted:
                                    </span>
                                    <span className="font-bold text-amber-700">
                                        {formatNaira(dashboardMetrics.totalDiscountsGranted)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Gross Profit (Before Referral Rewards):
                                    </span>
                                    <span className="font-black text-[#0A2558]">
                                        {formatNaira(dashboardMetrics.totalGrossProfit)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-[#0A2558]">
                                2. Referral Rewards & Net Profitability
                            </h3>
                            <div className="divide-y divide-slate-100 text-xs">
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Registered Referral Participants:
                                    </span>
                                    <span className="font-bold text-slate-900">
                                        {dashboardMetrics.referralParticipants}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Verified Successful Referrals:
                                    </span>
                                    <span className="font-bold text-emerald-700">
                                        {dashboardMetrics.successfulReferrals}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Total Cumulative Referral Rewards Earned:
                                    </span>
                                    <span className="font-bold text-slate-900">
                                        {formatNaira(dashboardMetrics.totalRewardsEarned)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Total Referral Rewards Payable:
                                    </span>
                                    <span className="font-bold text-blue-700">
                                        {formatNaira(dashboardMetrics.totalRewardsPayable)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600">
                                        Total Referral Rewards Paid:
                                    </span>
                                    <span className="font-bold text-emerald-700">
                                        {formatNaira(dashboardMetrics.totalRewardsPaid)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600 font-bold">
                                        Net Campaign Profit (After Referral Rewards):
                                    </span>
                                    <span className="font-black text-base text-[#0A2558]">
                                        {formatNaira(
                                            dashboardMetrics.netProfitAfterReferralRewards
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DocumentFooter />
                </div>
            )}

            {/* ========================================================================
                MODAL 1: VERIFY / DISQUALIFY REFERRAL
               ======================================================================== */}
            {selectedReferral && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    Verify Campaign Referral
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Referrer: <strong>{selectedReferral.referrerName}</strong> (
                                    {selectedReferral.referrerCode}) → Customer:{' '}
                                    <strong>{selectedReferral.customerName}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedReferral(null)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-700"
                            >
                                Close
                            </button>
                        </div>

                        <form onSubmit={handleVerifyReferralSubmit} className="space-y-4 text-xs">
                            <label className="grid gap-1 font-bold text-slate-700">
                                Verification Decision *
                                <select
                                    value={verifyForm.status}
                                    onChange={(e) =>
                                        setVerifyForm({
                                            ...verifyForm,
                                            status: e.target.value as ReferralVerificationStatus,
                                        })
                                    }
                                    className="h-10 rounded-xl border border-slate-300 px-3 font-bold text-slate-900"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="successful">
                                        Successful (Qualifies for Milestone)
                                    </option>
                                    <option value="disqualified">Disqualified</option>
                                    <option value="disputed">Disputed</option>
                                    <option value="cancelled_refunded">
                                        Cancelled / Refunded
                                    </option>
                                </select>
                            </label>

                            <label className="grid gap-1 font-bold text-slate-700">
                                Eligible Service Purchased
                                <input
                                    value={verifyForm.servicePurchased}
                                    onChange={(e) =>
                                        setVerifyForm({
                                            ...verifyForm,
                                            servicePurchased: e.target.value,
                                        })
                                    }
                                    className="h-10 rounded-xl border border-slate-300 px-3 text-slate-900"
                                />
                            </label>

                            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-2">
                                <div className="font-extrabold text-slate-800">
                                    Mandatory Qualification Checklist (Section 3.4):
                                </div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={verifyForm.isNewCustomer}
                                        onChange={(e) =>
                                            setVerifyForm({
                                                ...verifyForm,
                                                isNewCustomer: e.target.checked,
                                            })
                                        }
                                    />
                                    <span>Referred client is a NEW customer to ABLEBIZ</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={verifyForm.isEligibleService}
                                        onChange={(e) =>
                                            setVerifyForm({
                                                ...verifyForm,
                                                isEligibleService: e.target.checked,
                                            })
                                        }
                                    />
                                    <span>
                                        Client purchased one of the 6 eligible campaign services
                                    </span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={verifyForm.isPaidInWindow}
                                        onChange={(e) =>
                                            setVerifyForm({
                                                ...verifyForm,
                                                isPaidInWindow: e.target.checked,
                                            })
                                        }
                                    />
                                    <span>
                                        Full payment received within Nov 5 – Nov 20, 2026 (WAT)
                                    </span>
                                </label>
                            </div>

                            {(verifyForm.status === 'disqualified' ||
                                verifyForm.status === 'cancelled_refunded') && (
                                <label className="grid gap-1 font-bold text-rose-700">
                                    Disqualification / Cancellation Reason *
                                    <input
                                        required
                                        value={verifyForm.disqualificationReason}
                                        onChange={(e) =>
                                            setVerifyForm({
                                                ...verifyForm,
                                                disqualificationReason: e.target.value,
                                            })
                                        }
                                        placeholder="e.g. Existing customer / Unpaid after cutoff / Self-referral"
                                        className="h-10 rounded-xl border border-rose-300 px-3 text-slate-900"
                                    />
                                </label>
                            )}

                            <label className="grid gap-1 font-bold text-slate-700">
                                Verification Audit Notes
                                <textarea
                                    value={verifyForm.notes}
                                    onChange={(e) =>
                                        setVerifyForm({ ...verifyForm, notes: e.target.value })
                                    }
                                    className="min-h-20 rounded-xl border border-slate-300 p-3 text-slate-900"
                                    placeholder="Optional notes for audit log..."
                                />
                            </label>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedReferral(null)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isVerifyingReferral}
                                    className="rounded-xl bg-[#0A2558] px-5 py-2 font-bold text-white hover:bg-blue-950 disabled:opacity-50"
                                >
                                    {isVerifyingReferral
                                        ? 'Recording Decision...'
                                        : 'Save Verification & Recalculate Milestone'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================
                MODAL 2: MANAGE REFERRAL REWARD PAYOUT (PART 4D)
               ======================================================================== */}
            {selectedPayout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    Process Referral Reward Payout
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Partner: <strong>{selectedPayout.referrerName}</strong> (
                                    {selectedPayout.referrerCode}) • Milestone:{' '}
                                    <strong>
                                        {selectedPayout.milestoneReached} Referrals (
                                        {formatNaira(selectedPayout.totalRewardEarned)} Total)
                                    </strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedPayout(null)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-700"
                            >
                                Close
                            </button>
                        </div>

                        <form onSubmit={handleUpdatePayoutSubmit} className="space-y-4 text-xs">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1 font-bold text-slate-700">
                                    Payout Status *
                                    <select
                                        value={payoutForm.paymentStatus}
                                        onChange={(e) =>
                                            setPayoutForm({
                                                ...payoutForm,
                                                paymentStatus: e.target
                                                    .value as ReferralPayoutStatus,
                                            })
                                        }
                                        className="h-10 rounded-xl border border-slate-300 px-3 font-bold text-slate-900"
                                    >
                                        <option value="pending_verification">
                                            Pending Verification
                                        </option>
                                        <option value="verified">Verified</option>
                                        <option value="payable">Payable</option>
                                        <option value="processing">Processing</option>
                                        <option value="paid">Paid (Disbursed)</option>
                                        <option value="on_hold">On Hold</option>
                                        <option value="disqualified">Disqualified</option>
                                    </select>
                                </label>

                                <label className="grid gap-1 font-bold text-slate-700">
                                    Amount Paid (NGN)
                                    <input
                                        type="number"
                                        value={payoutForm.amountPaid}
                                        onChange={(e) =>
                                            setPayoutForm({
                                                ...payoutForm,
                                                amountPaid: Number(e.target.value),
                                            })
                                        }
                                        className="h-10 rounded-xl border border-slate-300 px-3 font-bold text-slate-900"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <label className="grid gap-1 font-bold text-slate-700">
                                    Bank Name
                                    <input
                                        value={payoutForm.bankName}
                                        onChange={(e) =>
                                            setPayoutForm({
                                                ...payoutForm,
                                                bankName: e.target.value,
                                            })
                                        }
                                        placeholder="e.g. GTBank"
                                        className="h-10 rounded-xl border border-slate-300 px-3 text-slate-900"
                                    />
                                </label>
                                <label className="grid gap-1 font-bold text-slate-700">
                                    Account Number
                                    <input
                                        value={payoutForm.accountNumber}
                                        onChange={(e) =>
                                            setPayoutForm({
                                                ...payoutForm,
                                                accountNumber: e.target.value,
                                            })
                                        }
                                        placeholder="10 digits"
                                        className="h-10 rounded-xl border border-slate-300 px-3 font-mono text-slate-900"
                                    />
                                </label>
                                <label className="grid gap-1 font-bold text-slate-700">
                                    Account Name
                                    <input
                                        value={payoutForm.accountName}
                                        onChange={(e) =>
                                            setPayoutForm({
                                                ...payoutForm,
                                                accountName: e.target.value,
                                            })
                                        }
                                        placeholder="Account Holder"
                                        className="h-10 rounded-xl border border-slate-300 px-3 text-slate-900"
                                    />
                                </label>
                            </div>

                            <label className="grid gap-1 font-bold text-slate-700">
                                Bank Transfer Payment Reference{' '}
                                {payoutForm.paymentStatus === 'paid' && '*'}
                                <input
                                    required={payoutForm.paymentStatus === 'paid'}
                                    value={payoutForm.paymentReference}
                                    onChange={(e) =>
                                        setPayoutForm({
                                            ...payoutForm,
                                            paymentReference: e.target.value,
                                        })
                                    }
                                    placeholder="Required when marking as Paid (e.g. NIP/TRF-202611...)"
                                    className="h-10 rounded-xl border border-slate-300 px-3 font-mono text-slate-900"
                                />
                            </label>

                            <label className="grid gap-1 font-bold text-slate-700">
                                Finance / Audit Notes
                                <textarea
                                    value={payoutForm.notes}
                                    onChange={(e) =>
                                        setPayoutForm({ ...payoutForm, notes: e.target.value })
                                    }
                                    className="min-h-16 rounded-xl border border-slate-300 p-3 text-slate-900"
                                    placeholder="Verification & payout audit notes..."
                                />
                            </label>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPayout(null)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingPayout}
                                    className="rounded-xl bg-[#0A2558] px-5 py-2 font-bold text-white hover:bg-blue-950 disabled:opacity-50"
                                >
                                    {isSavingPayout
                                        ? 'Saving Payout...'
                                        : 'Record Payout Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
export default Campaigns;
