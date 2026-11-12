import { supabase } from '../supabaseClient';
import type {
  MarketingAttributionSummary,
  CampaignAttributionRow,
  LeadChannelAttributionRow,
  ReferralAttributionRow,
} from '../../types/suitePhases15To19';

export interface AttributionFilterOptions {
  startDate?: string;
  endDate?: string;
  campaignId?: string;
  source?: string;
}

/**
 * Calculates Campaign ROI mathematically safe against zero or null cost
 */
export function calculateCampaignRoi(
  revenue: number,
  cost: number
): number | null {
  if (cost <= 0) {
    // If cost is zero or negative, return null so UI can display "N/A - Organic / Zero Cost"
    return null;
  }
  const netReturn = revenue - cost;
  return Math.round((netReturn / cost) * 10000) / 100;
}

/**
 * Extracts marketing attribution parameters from URL search query safely
 */
export function parseUtmAttributionFromUrl(search: string | URLSearchParams): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referral_code?: string;
} {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const utm_source = params.get('utm_source') || params.get('source') || undefined;
  const utm_medium = params.get('utm_medium') || undefined;
  const utm_campaign = params.get('utm_campaign') || params.get('campaign') || undefined;
  const referral_code = params.get('ref') || params.get('referral_code') || undefined;

  return { utm_source, utm_medium, utm_campaign, referral_code };
}

/**
 * Fetch executive marketing attribution analytics
 */
export async function fetchMarketingAttributionData(filters?: AttributionFilterOptions): Promise<{
  summary: MarketingAttributionSummary;
  campaigns: CampaignAttributionRow[];
  channels: LeadChannelAttributionRow[];
  referrals: ReferralAttributionRow[];
}> {
  const startDate = filters?.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = filters?.endDate || new Date().toISOString().split('T')[0];

  try {
    // Fetch Leads in period
    let leadQuery = supabase
      .from('leads')
      .select('id, name, source, utm_source, utm_medium, utm_campaign, referral_code, is_converted, converted_client_id, created_at')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`);

    if (filters?.source && filters.source !== 'all') {
      leadQuery = leadQuery.or(`source.eq.${filters.source},utm_source.eq.${filters.source}`);
    }

    const { data: leadsData } = await leadQuery;
    const leads = leadsData || [];

    // Fetch Campaigns
    const { data: campaignsData } = await supabase
      .from('campaigns')
      .select('id, name, campaign_type, configured_status, effective_status, budget_ngn, actual_spend_ngn, ad_spend_ngn');
    const campaigns = campaignsData || [];

    // Fetch Payments (Verified Cash Collections)
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('id, amount, payment_date, client_id, is_verified')
      .eq('is_verified', true)
      .gte('payment_date', `${startDate}T00:00:00Z`)
      .lte('payment_date', `${endDate}T23:59:59Z`);
    const verifiedPayments = paymentsData || [];

    // Fetch Invoices (Invoiced Revenue)
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('id, total_amount, client_id, issue_date')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate);
    const invoices = invoicesData || [];

    // Fetch Referrals
    const { data: referralsData } = await supabase
      .from('referrals')
      .select(`
        id, referral_code, referee_name, referee_phone, status, reward_amount, is_reward_paid, created_at,
        referrer:clients(id, full_name, phone)
      `);
    const referrals = referralsData || [];

    // Client ID mapping to leads
    const convertedClientLeadMap = new Map<string, any>();
    for (const lead of leads) {
      if (lead.is_converted && lead.converted_client_id) {
        convertedClientLeadMap.set(lead.converted_client_id, lead);
      }
    }

    // 1. Channel Aggregations
    const channelMap = new Map<string, {
      leads: number;
      converted: number;
      invoiced: number;
      cash: number;
    }>();

    const standardChannels = [
      'Website Enquiry',
      'WhatsApp Consultation',
      'Referral Partner',
      'Social Media (Organic)',
      'Paid Digital Ads',
      'Direct Walk-in / Office',
    ];

    for (const ch of standardChannels) {
      channelMap.set(ch, { leads: 0, converted: 0, invoiced: 0, cash: 0 });
    }

    for (const lead of leads) {
      const src = (lead.utm_source || lead.source || '').toLowerCase();
      let chKey = 'Direct Walk-in / Office';
      if (src.includes('web') || src.includes('consultation')) chKey = 'Website Enquiry';
      else if (src.includes('wa') || src.includes('whatsapp')) chKey = 'WhatsApp Consultation';
      else if (src.includes('ref') || lead.referral_code) chKey = 'Referral Partner';
      else if (src.includes('ad') || src.includes('cpc') || src.includes('paid')) chKey = 'Paid Digital Ads';
      else if (src.includes('social') || src.includes('facebook') || src.includes('instagram') || src.includes('linkedin')) chKey = 'Social Media (Organic)';

      const rec = channelMap.get(chKey) || { leads: 0, converted: 0, invoiced: 0, cash: 0 };
      rec.leads += 1;
      if (lead.is_converted) rec.converted += 1;
      channelMap.set(chKey, rec);
    }

    // Allocate Cash & Invoices to channels via converted client
    for (const p of verifiedPayments) {
      const l = convertedClientLeadMap.get(p.client_id);
      if (l) {
        const src = (l.utm_source || l.source || '').toLowerCase();
        let chKey = 'Direct Walk-in / Office';
        if (src.includes('web') || src.includes('consultation')) chKey = 'Website Enquiry';
        else if (src.includes('wa') || src.includes('whatsapp')) chKey = 'WhatsApp Consultation';
        else if (src.includes('ref') || l.referral_code) chKey = 'Referral Partner';
        else if (src.includes('ad') || src.includes('cpc') || src.includes('paid')) chKey = 'Paid Digital Ads';
        else if (src.includes('social')) chKey = 'Social Media (Organic)';

        const rec = channelMap.get(chKey);
        if (rec) rec.cash += Number(p.amount || 0);
      }
    }

    for (const inv of invoices) {
      const l = convertedClientLeadMap.get(inv.client_id);
      if (l) {
        const src = (l.utm_source || l.source || '').toLowerCase();
        let chKey = 'Direct Walk-in / Office';
        if (src.includes('web') || src.includes('consultation')) chKey = 'Website Enquiry';
        else if (src.includes('wa') || src.includes('whatsapp')) chKey = 'WhatsApp Consultation';
        else if (src.includes('ref') || l.referral_code) chKey = 'Referral Partner';
        else if (src.includes('ad') || src.includes('cpc') || src.includes('paid')) chKey = 'Paid Digital Ads';
        else if (src.includes('social')) chKey = 'Social Media (Organic)';

        const rec = channelMap.get(chKey);
        if (rec) rec.invoiced += Number(inv.total_amount || 0);
      }
    }

    const channelRows: LeadChannelAttributionRow[] = Array.from(channelMap.entries()).map(([name, data]) => ({
      channel_name: name,
      channel_type: name.includes('Paid') ? 'paid' : name.includes('Referral') ? 'partnership' : 'organic',
      leads_count: data.leads,
      converted_clients_count: data.converted,
      conversion_rate: data.leads > 0 ? Math.round((data.converted / data.leads) * 10000) / 100 : 0,
      invoiced_revenue: data.invoiced,
      verified_cash_collected: data.cash,
    }));

    // 2. Campaign Attribution Rows
    const campaignRows: CampaignAttributionRow[] = campaigns.map((c: any) => {
      const cLeads = leads.filter(
        (l) => l.utm_campaign?.toLowerCase() === c.name?.toLowerCase() || l.source?.toLowerCase().includes(c.name?.toLowerCase())
      );
      const cConverted = cLeads.filter((l) => l.is_converted).length;
      const cSpend = Number(c.actual_spend_ngn || c.ad_spend_ngn || 0);

      let cCash = 0;
      let cInvoiced = 0;

      for (const l of cLeads) {
        if (l.converted_client_id) {
          const clientPayments = verifiedPayments.filter((p) => p.client_id === l.converted_client_id);
          cCash += clientPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

          const clientInvoices = invoices.filter((i) => i.client_id === l.converted_client_id);
          cInvoiced += clientInvoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
        }
      }

      const costPerLead = cLeads.length > 0 && cSpend > 0 ? Math.round(cSpend / cLeads.length) : null;
      const costPerClient = cConverted > 0 && cSpend > 0 ? Math.round(cSpend / cConverted) : null;
      const roiCash = calculateCampaignRoi(cCash, cSpend);

      return {
        campaign_id: c.id,
        campaign_name: c.name,
        campaign_type: c.campaign_type || 'promotional',
        status: c.effective_status || c.configured_status || 'active',
        budget_ngn: Number(c.budget_ngn || 0),
        actual_spend_ngn: cSpend,
        leads_count: cLeads.length,
        converted_clients_count: cConverted,
        conversion_rate: cLeads.length > 0 ? Math.round((cConverted / cLeads.length) * 10000) / 100 : 0,
        invoiced_revenue: cInvoiced,
        verified_cash_collected: cCash,
        cost_per_lead: costPerLead,
        cost_per_acquired_client: costPerClient,
        roi_cash_percent: roiCash,
      };
    });

    // 3. Referral Partner Attribution Rows
    const partnerMap = new Map<string, {
      partner_name: string;
      partner_phone: string;
      referral_code: string;
      leads: number;
      converted: number;
      cash: number;
      invoiced: number;
      rewards: number;
    }>();

    for (const ref of referrals) {
      const code = ref.referral_code || 'DIRECT';
      const partnerName = (ref.referrer as any)?.full_name || ref.referee_name || 'Referral Partner';
      const partnerPhone = (ref.referrer as any)?.phone || ref.referee_phone || '—';

      const entry = partnerMap.get(code) || {
        partner_name: partnerName,
        partner_phone: partnerPhone,
        referral_code: code,
        leads: 0,
        converted: 0,
        cash: 0,
        invoiced: 0,
        rewards: 0,
      };

      entry.leads += 1;
      if (ref.status === 'successful' || ref.status === 'verified') {
        entry.converted += 1;
        entry.rewards += Number(ref.reward_amount || 0);
      }
      partnerMap.set(code, entry);
    }

    const referralRows: ReferralAttributionRow[] = Array.from(partnerMap.entries()).map(([code, p]) => ({
      partner_id: code,
      partner_name: p.partner_name,
      partner_phone: p.partner_phone,
      referral_code: p.referral_code,
      leads_count: p.leads,
      converted_clients_count: p.converted,
      conversion_rate: p.leads > 0 ? Math.round((p.converted / p.leads) * 10000) / 100 : 0,
      invoiced_revenue: p.invoiced,
      verified_cash_collected: p.cash,
      verified_rewards_payable: p.rewards,
    }));

    // 4. Overall Summary
    const totalLeads = leads.length;
    const convertedClients = leads.filter((l) => l.is_converted).length;
    const totalSpend = campaigns.reduce((acc, c) => acc + Number(c.actual_spend_ngn || c.ad_spend_ngn || 0), 0);
    const totalCashAttributed = channelRows.reduce((acc, c) => acc + c.verified_cash_collected, 0);
    const totalInvoicedAttributed = channelRows.reduce((acc, c) => acc + c.invoiced_revenue, 0);

    const summary: MarketingAttributionSummary = {
      reporting_period_start: startDate,
      reporting_period_end: endDate,
      total_leads: totalLeads,
      converted_clients: convertedClients,
      lead_conversion_rate: totalLeads > 0 ? Math.round((convertedClients / totalLeads) * 10000) / 100 : 0,
      invoiced_revenue_attributed: totalInvoicedAttributed,
      verified_cash_attributed: totalCashAttributed,
      total_campaign_spend: totalSpend,
      cost_per_lead: totalLeads > 0 && totalSpend > 0 ? Math.round(totalSpend / totalLeads) : null,
      cost_per_acquired_client: convertedClients > 0 && totalSpend > 0 ? Math.round(totalSpend / convertedClients) : null,
      campaign_roi_cash_percent: calculateCampaignRoi(totalCashAttributed, totalSpend),
      campaign_roi_invoiced_percent: calculateCampaignRoi(totalInvoicedAttributed, totalSpend),
    };

    return {
      summary,
      campaigns: campaignRows,
      channels: channelRows,
      referrals: referralRows,
    };
  } catch (err) {
    console.error('[AttributionAnalytics] Unexpected error:', err);
    throw err;
  }
}
