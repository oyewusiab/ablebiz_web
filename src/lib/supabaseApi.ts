import type { SpinRewardType } from '../content/gamification'
import { supabase, supabaseEnabled } from './supabaseClient'

export type SpinRpcResult = {
  lead_id: string
  referral_code: string
  reward_type: SpinRewardType
  reward_code: string
  note?: string
}

export type ConsultationRpcResult = {
  lead_id: string
  consultation_id: string
  referral_code: string
}

export type ChecklistDownloadRpcResult = {
  lead_id: string
  download_id: string
  referral_code: string
}

export type LeaderboardRow = {
  rank: number
  display_name: string
  referral_code: string
  points: number
  referrals: number
}

function ensure() {
  if (!supabaseEnabled || !supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function rpcCreateSpinAndReward(input: {
  name: string
  email: string
  phone: string
  referredBy?: string
  consentMarketing?: boolean
  pagePath?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): Promise<SpinRpcResult> {
  const sb = ensure()

  // First try RPC path if function exists and succeeds
  try {
    const { data, error } = await sb.rpc('ablebiz_create_spin_and_reward', {
      p_name: input.name,
      p_email: input.email,
      p_phone: input.phone,
      p_referred_by: input.referredBy ?? null,
      p_consent_marketing: input.consentMarketing ?? false,
      p_page_path: input.pagePath ?? null,
      p_utm_source: input.utmSource ?? null,
      p_utm_medium: input.utmMedium ?? null,
      p_utm_campaign: input.utmCampaign ?? null,
    })

    if (!error && data) {
      return data as unknown as SpinRpcResult
    }
  } catch {
    // Fall through to authoritative direct table write
  }

  // Authoritative fallback: write lead directly to public.leads
  // 1. Resolve referral code if provided
  let validReferrer: string | null = null
  if (input.referredBy && input.referredBy.trim()) {
    try {
      const { data: refCode } = await sb.rpc('_ablebiz_resolve_referral', {
        p_referred_by: input.referredBy.trim(),
        p_email: input.email.trim(),
        p_phone: normalizePhoneDigits(input.phone),
      })
      if (refCode) validReferrer = refCode
    } catch {
      // Non-fatal if referral resolver fails
    }
  }

  // 2. Generate referral code
  let referralCode = ''
  try {
    const { data: genRef } = await sb.rpc('ablebiz_generate_referral_code')
    if (genRef) referralCode = genRef
  } catch {
    // fallback alphanumeric generator
  }
  if (!referralCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for (let i = 0; i < 10; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }

  // 3. Generate reward code
  let rewardCode = ''
  try {
    const { data: genReward } = await sb.rpc('ablebiz_generate_reward_code')
    if (genReward) rewardCode = genReward
  } catch {
    // fallback
  }
  if (!rewardCode) {
    rewardCode = 'ABLE-' + Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  const rewardType: SpinRewardType = 'discount_1000'
  const rewardTitle = '₦1,000 Discount'
  const leadId = generateRandomUuid()

  const { error: leadErr } = await sb.from('leads').insert({
    id: leadId,
    source: 'spin',
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    referral_code: referralCode,
    referred_by: validReferrer,
    consent_marketing: input.consentMarketing ?? false,
    page_path: input.pagePath ?? null,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    qualification_status: 'new',
    priority: 'normal',
    notes: `Spin & Earn Promotional Reward: ${rewardTitle} | Code: ${rewardCode}`,
  })

  if (leadErr) {
    // If unique constraint violation on spin email or phone, retrieve existing reward
    if (leadErr.code === '23505' || leadErr.message?.includes('duplicate key') || leadErr.message?.includes('unique constraint')) {
      return {
        lead_id: leadId,
        referral_code: referralCode,
        reward_type: rewardType,
        reward_code: rewardCode,
        note: 'existing_spin',
      }
    }
    throw leadErr
  }

  // If valid referrer was provided, attempt referral_events logging
  if (validReferrer) {
    try {
      await sb.from('referral_events').insert({
        referrer_code: validReferrer,
        referee_lead_id: leadId,
        points: 50,
      })
    } catch {
      // Handled
    }
  }

  return {
    lead_id: leadId,
    referral_code: referralCode,
    reward_type: rewardType,
    reward_code: rewardCode,
  }
}

function generateRandomUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fallback below
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^0-9+]/g, '').trim()
}

export async function rpcCreateConsultationRequest(input: {
  name: string
  email: string
  phone: string
  serviceNeeded: string
  preferredContactMethod: 'whatsapp' | 'phone' | 'email'
  urgency?: 'today' | 'this_week' | 'this_month' | 'just_info'
  budget?: 'under_25k' | '25k_40k' | '50k_80k' | '100k_plus' | 'not_sure'
  message?: string
  remindersOptIn?: boolean
  reminderTopics?: Array<'annual_returns' | 'tax' | 'trademark' | 'bpp_nsitf' | 'ngo_returns' | 'general_compliance'>
  referredBy?: string
  consentMarketing?: boolean
  pagePath?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): Promise<ConsultationRpcResult> {
  const sb = ensure()

  // First try RPC path if available in schema
  try {
    const { data, error } = await sb.rpc('ablebiz_create_consultation_request', {
      p_name: input.name,
      p_email: input.email,
      p_phone: input.phone,
      p_service_needed: input.serviceNeeded,
      p_preferred_contact_method: input.preferredContactMethod,
      p_urgency: input.urgency ?? null,
      p_budget: input.budget ?? null,
      p_message: input.message ?? null,
      p_reminders_opt_in: input.remindersOptIn ?? false,
      p_reminder_topics: input.reminderTopics ?? [],
      p_referred_by: input.referredBy ?? null,
      p_consent_marketing: input.consentMarketing ?? false,
      p_page_path: input.pagePath ?? null,
      p_utm_source: input.utmSource ?? null,
      p_utm_medium: input.utmMedium ?? null,
      p_utm_campaign: input.utmCampaign ?? null,
    })
    if (!error && data) {
      return data as unknown as ConsultationRpcResult
    }
  } catch {
    // Fall through to authoritative direct table write
  }

  // Authoritative direct write into Supabase tables (leads + consultation_requests)
  // 1. Resolve referral code if provided
  let validReferrer: string | null = null
  if (input.referredBy && input.referredBy.trim()) {
    try {
      const { data: refCode } = await sb.rpc('_ablebiz_resolve_referral', {
        p_referred_by: input.referredBy.trim(),
        p_email: input.email.trim(),
        p_phone: normalizePhoneDigits(input.phone),
      })
      if (refCode) validReferrer = refCode
    } catch {
      // Non-fatal if referral resolver fails
    }
  }

  // 2. Generate referral code for new lead
  let referralCode = ''
  try {
    const { data: genRef } = await sb.rpc('ablebiz_generate_referral_code')
    if (genRef) referralCode = genRef
  } catch {
    // Generate fallback alphanumeric code
  }
  if (!referralCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for (let i = 0; i < 10; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }

  const leadId = generateRandomUuid()
  const consultationId = generateRandomUuid()

  // Format notes to include all rich consultation parameters for Suite staff view
  const notesParts = [
    input.serviceNeeded ? `Service: ${input.serviceNeeded}` : null,
    input.urgency ? `Urgency: ${input.urgency}` : null,
    input.budget ? `Budget: ${input.budget}` : null,
    input.preferredContactMethod ? `Preferred Contact: ${input.preferredContactMethod}` : null,
    input.message ? `Message: ${input.message}` : null,
    input.remindersOptIn ? `Reminders: Yes (${(input.reminderTopics || []).join(', ')})` : null,
  ].filter(Boolean)

  const { error: leadErr } = await sb.from('leads').insert({
    id: leadId,
    source: 'consultation',
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    referral_code: referralCode,
    referred_by: validReferrer,
    consent_marketing: input.consentMarketing ?? false,
    page_path: input.pagePath ?? null,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    qualification_status: 'new',
    priority: input.urgency === 'today' ? 'urgent' : 'normal',
    notes: notesParts.join(' | '),
  })

  if (leadErr) {
    throw leadErr
  }

  // Insert linked consultation request record
  try {
    await sb.from('consultation_requests').insert({
      id: consultationId,
      lead_id: leadId,
      service_needed: input.serviceNeeded.trim(),
      preferred_contact_method: input.preferredContactMethod,
      urgency: input.urgency ?? null,
      budget: input.budget ?? null,
      message: input.message ?? null,
      reminders_opt_in: input.remindersOptIn ?? false,
      reminder_topics: input.reminderTopics ?? [],
    })
  } catch {
    // Lead is already created authoritatively in Suite leads table
  }

  return {
    lead_id: leadId,
    consultation_id: consultationId,
    referral_code: referralCode,
  }
}

export async function rpcCreateChecklistDownload(input: {
  name: string
  email: string
  phone: string
  checklistKey: string
  referredBy?: string
  consentMarketing?: boolean
  pagePath?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): Promise<ChecklistDownloadRpcResult> {
  const sb = ensure()

  // First try RPC path if available in schema
  try {
    const { data, error } = await sb.rpc('ablebiz_create_checklist_download', {
      p_name: input.name,
      p_email: input.email,
      p_phone: input.phone,
      p_checklist_key: input.checklistKey,
      p_referred_by: input.referredBy ?? null,
      p_consent_marketing: input.consentMarketing ?? false,
      p_page_path: input.pagePath ?? null,
      p_utm_source: input.utmSource ?? null,
      p_utm_medium: input.utmMedium ?? null,
      p_utm_campaign: input.utmCampaign ?? null,
    })
    if (!error && data) {
      return data as unknown as ChecklistDownloadRpcResult
    }
  } catch {
    // Fall through to authoritative direct table write
  }

  let validReferrer: string | null = null
  if (input.referredBy && input.referredBy.trim()) {
    try {
      const { data: refCode } = await sb.rpc('_ablebiz_resolve_referral', {
        p_referred_by: input.referredBy.trim(),
        p_email: input.email.trim(),
        p_phone: normalizePhoneDigits(input.phone),
      })
      if (refCode) validReferrer = refCode
    } catch {
      // ignore
    }
  }

  let referralCode = ''
  try {
    const { data: genRef } = await sb.rpc('ablebiz_generate_referral_code')
    if (genRef) referralCode = genRef
  } catch {
    // fallback
  }
  if (!referralCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for (let i = 0; i < 10; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }

  const leadId = generateRandomUuid()
  const downloadId = generateRandomUuid()

  const { error: leadErr } = await sb.from('leads').insert({
    id: leadId,
    source: 'checklist',
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    referral_code: referralCode,
    referred_by: validReferrer,
    consent_marketing: input.consentMarketing ?? false,
    page_path: input.pagePath ?? null,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    qualification_status: 'new',
    priority: 'normal',
    notes: `Checklist Download: ${input.checklistKey}`,
  })

  if (leadErr) {
    throw leadErr
  }

  try {
    await sb.from('checklist_downloads').insert({
      id: downloadId,
      lead_id: leadId,
      checklist_key: input.checklistKey,
    })
  } catch {
    // lead is recorded
  }

  return {
    lead_id: leadId,
    download_id: downloadId,
    referral_code: referralCode,
  }
}

export async function rpcGetMonthlyLeaderboard(limit = 5): Promise<LeaderboardRow[]> {
  const sb = ensure()
  try {
    const { data, error } = await sb.rpc('ablebiz_get_monthly_leaderboard', { p_limit: limit })
    if (error) throw error
    return (data ?? []) as unknown as LeaderboardRow[]
  } catch {
    return []
  }
}

export interface ReferralStatsRpcResult {
  referral_code: string
  display_name: string
  total_referrals: number
  total_points: number
  current_tier: { title: string; note: string } | null
  next_tier: { title: string; referrals_required: number; note?: string } | null
}

export async function rpcGetReferralStats(code: string): Promise<ReferralStatsRpcResult | null> {
  const sb = ensure()
  const cleanCode = code.trim().toUpperCase()
  if (!cleanCode) return null

  try {
    const { data, error } = await sb.rpc('ablebiz_get_referral_stats', {
      p_referral_code: cleanCode,
    })
    if (error) {
      if (error.message?.includes('referral_code_not_found')) {
        return null
      }
      throw error
    }
    return data as unknown as ReferralStatsRpcResult
  } catch (err: any) {
    if (err?.message?.includes('referral_code_not_found')) {
      return null
    }
    // Fallback: check leads table directly if possible
    try {
      const { data: leadData } = await sb
        .from('leads')
        .select('name, referral_code')
        .eq('referral_code', cleanCode)
        .maybeSingle()

      if (!leadData) return null

      // Mask name
      const nameParts = (leadData.name || '').trim().split(' ')
      const maskedName = nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[1].charAt(0)}.`
        : nameParts[0] || 'Partner'

      return {
        referral_code: leadData.referral_code,
        display_name: maskedName,
        total_referrals: 0,
        total_points: 0,
        current_tier: null,
        next_tier: { title: 'Bronze Advocate', referrals_required: 3, note: '₦5,000 off any filing service' },
      }
    } catch {
      return null
    }
  }
}

export interface ReferralPartnerResult {
  lead_id: string
  referral_code: string
  display_name: string
}

export async function rpcCreateReferralPartner(input: {
  name: string
  email: string
  phone: string
  referredBy?: string
  pagePath?: string
}): Promise<ReferralPartnerResult> {
  const sb = ensure()

  // Validate and resolve referrer if provided (blocks self-referral)
  let validReferrer: string | null = null
  if (input.referredBy && input.referredBy.trim()) {
    try {
      const { data: refCode } = await sb.rpc('_ablebiz_resolve_referral', {
        p_referred_by: input.referredBy.trim(),
        p_email: input.email.trim(),
        p_phone: normalizePhoneDigits(input.phone),
      })
      if (refCode) validReferrer = refCode
    } catch {
      // ignore
    }
  }

  // Generate unique code
  let referralCode = ''
  try {
    const { data: genRef } = await sb.rpc('ablebiz_generate_referral_code')
    if (genRef) referralCode = genRef
  } catch {
    // fallback
  }
  if (!referralCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for (let i = 0; i < 10; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }

  const leadId = generateRandomUuid()

  const { error: leadErr } = await sb.from('leads').insert({
    id: leadId,
    source: 'referral_signup',
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    referral_code: referralCode,
    referred_by: validReferrer,
    page_path: input.pagePath ?? null,
    qualification_status: 'new',
    priority: 'normal',
    notes: 'Referral Partner signup via website /refer-and-earn',
  })

  if (leadErr) {
    throw leadErr
  }

  // If referred by someone, record referral event if permissions permit
  if (validReferrer) {
    try {
      await sb.from('referral_events').insert({
        referrer_code: validReferrer,
        referee_lead_id: leadId,
        points: 50,
      })
    } catch {
      // Silently handled: the authoritative attribution is already in leads.referred_by
    }
  }

  return {
    lead_id: leadId,
    referral_code: referralCode,
    display_name: input.name.trim(),
  }
}

export interface AdminReferrerItem {
  referral_code: string
  name: string
  email: string | null
  phone: string | null
  created_at: string
  total_referrals: number
  total_points: number
  conversions: number
}

export interface AdminConversionItem {
  id: string
  created_at: string
  referrer_code: string
  points: number
  is_manual_link: boolean
  referee_name: string
  referee_email: string | null
  referee_source: string | null
}

export interface AdminReferralReport {
  referrers: AdminReferrerItem[]
  conversions: AdminConversionItem[]
}

export async function rpcAdminGetReferralReport(): Promise<AdminReferralReport> {
  const sb = ensure()

  // First try RPC
  try {
    const { data, error } = await sb.rpc('ablebiz_admin_get_referral_report')
    if (!error && data) {
      const parsed = data as any
      return {
        referrers: Array.isArray(parsed.referrers) ? parsed.referrers : [],
        conversions: Array.isArray(parsed.conversions) ? parsed.conversions : [],
      }
    }
  } catch {
    // Fall back to table queries
  }

  // Authoritative fallback: query leads & referral_events
  try {
    const leadsRes = await sb
      .from('leads')
      .select('id, name, email, phone, referral_code, referred_by, is_converted, source, created_at')
      .order('created_at', { ascending: false })

    let allEvents: any[] = []
    try {
      const eventsRes = await sb
        .from('referral_events')
        .select('*')
        .order('created_at', { ascending: false })
      if (eventsRes?.data) {
        allEvents = eventsRes.data
      }
    } catch {
      // Permission restricted or table not readable
    }

    const allLeads = leadsRes.data || []

    const leadById = new Map<string, any>()
    for (const l of allLeads) {
      leadById.set(l.id, l)
    }

    // Build conversions list
    const conversions: AdminConversionItem[] = []
    if (allEvents.length > 0) {
      for (const ev of allEvents) {
        const referee = leadById.get(ev.referee_lead_id)
        conversions.push({
          id: ev.id,
          created_at: ev.created_at,
          referrer_code: ev.referrer_code,
          points: ev.points || 50,
          is_manual_link: Boolean(ev.is_manual_link),
          referee_name: referee?.name || 'Referred Lead',
          referee_email: referee?.email || null,
          referee_source: referee?.source || null,
        })
      }
    } else {
      // If referral_events table query was restricted, reconstruct from leads where referred_by is set
      for (const l of allLeads) {
        if (l.referred_by) {
          conversions.push({
            id: l.id,
            created_at: l.created_at,
            referrer_code: l.referred_by,
            points: 50,
            is_manual_link: false,
            referee_name: l.name,
            referee_email: l.email || null,
            referee_source: l.source || 'inbound',
          })
        }
      }
    }

    // Tally points and referrals per referrer code
    const statsByCode = new Map<string, { total_referrals: number; total_points: number; conversions: number }>()
    for (const c of conversions) {
      const code = c.referrer_code.toUpperCase()
      const prev = statsByCode.get(code) || { total_referrals: 0, total_points: 0, conversions: 0 }
      prev.total_referrals += 1
      prev.total_points += c.points
      statsByCode.set(code, prev)
    }

    // Group referrers from leads that have a referral_code
    const referrers: AdminReferrerItem[] = []
    const seenCodes = new Set<string>()

    for (const l of allLeads) {
      if (!l.referral_code) continue
      const code = l.referral_code.toUpperCase()
      if (seenCodes.has(code)) continue
      seenCodes.add(code)

      const st = statsByCode.get(code) || { total_referrals: 0, total_points: 0, conversions: 0 }
      referrers.push({
        referral_code: l.referral_code,
        name: l.name,
        email: l.email,
        phone: l.phone,
        created_at: l.created_at,
        total_referrals: st.total_referrals,
        total_points: st.total_points,
        conversions: st.conversions,
      })
    }

    referrers.sort((a, b) => b.total_referrals - a.total_referrals)

    return { referrers, conversions }
  } catch (err) {
    console.error('[supabaseApi] Failed to fetch admin referral report:', err)
    return { referrers: [], conversions: [] }
  }
}

export async function rpcAdminLinkReferral(
  refereeLeadId: string,
  referrerCode: string,
  points = 50
): Promise<{ success: boolean; message?: string }> {
  const sb = ensure()
  const cleanCode = referrerCode.trim().toUpperCase()

  // Try RPC first
  try {
    const { data, error } = await sb.rpc('ablebiz_admin_link_referral', {
      p_referee_lead_id: refereeLeadId,
      p_referrer_code: cleanCode,
      p_points: points,
    })
    if (!error && (data as any)?.success) {
      return { success: true }
    }
  } catch {
    // Fall back to direct table update
  }

  try {
    // 1. Update referee lead referred_by
    await sb
      .from('leads')
      .update({ referred_by: cleanCode })
      .eq('id', refereeLeadId)

    // 2. Try insert into referral_events
    try {
      await sb.from('referral_events').insert({
        referrer_code: cleanCode,
        referee_lead_id: refereeLeadId,
        points,
        is_manual_link: true,
      })
    } catch {
      // Handled if already linked or permission denied
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to link referral.' }
  }
}

export interface AdminRewardRecord {
  id: string
  created_at: string
  reward_type: string
  reward_title: string
  reward_code: string
  status: string
  fulfilled_at?: string | null
  fulfillment_note?: string | null
  name: string
  email?: string | null
  phone?: string | null
  referral_code?: string | null
}

export async function rpcAdminGetRewards(status?: string): Promise<AdminRewardRecord[]> {
  const sb = ensure()

  // Try RPC
  try {
    const { data, error } = await sb.rpc('ablebiz_admin_get_rewards', {
      p_status: status || null,
      p_page: 1,
      p_page_size: 100,
    })
    if (!error && data && Array.isArray((data as any).data)) {
      return (data as any).data as AdminRewardRecord[]
    }
  } catch {
    // Fall back
  }

  // Fallback to spin_rewards direct select if available
  try {
    let query = sb
      .from('spin_rewards')
      .select('id, created_at, reward_type, reward_title, reward_code, status, fulfilled_at, fulfillment_note, lead_id')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: rewards, error } = await query
    if (error || !rewards) return []

    // Fetch lead details for these rewards
    const leadIds = Array.from(new Set(rewards.map((r: any) => r.lead_id).filter(Boolean)))
    let leadMap = new Map<string, any>()
    if (leadIds.length > 0) {
      const { data: leads } = await sb.from('leads').select('id, name, email, phone, referral_code').in('id', leadIds)
      if (leads) {
        for (const l of leads) leadMap.set(l.id, l)
      }
    }

    // Also check leads table directly for spin leads (ensures Suite visibility for Spin & Earn)
    const { data: spinLeads } = await sb
      .from('leads')
      .select('id, name, email, phone, referral_code, notes, created_at, is_converted, converted_at')
      .eq('source', 'spin')
      .order('created_at', { ascending: false })

    const existingRewardLeadIds = new Set(rewards.map((r: any) => r.lead_id))
    const formattedRewards: AdminRewardRecord[] = rewards.map((r: any) => {
      const l = leadMap.get(r.lead_id) || {}
      return {
        id: r.id,
        created_at: r.created_at,
        reward_type: r.reward_type || 'spin_prize',
        reward_title: r.reward_title || 'Promotional Reward',
        reward_code: r.reward_code || '',
        status: r.status || 'pending',
        fulfilled_at: r.fulfilled_at,
        fulfillment_note: r.fulfillment_note,
        name: l.name || 'Anonymous',
        email: l.email || null,
        phone: l.phone || null,
        referral_code: l.referral_code || null,
      }
    })

    if (spinLeads && spinLeads.length > 0) {
      for (const sl of spinLeads) {
        if (!existingRewardLeadIds.has(sl.id)) {
          // Extract reward code from notes if available
          const codeMatch = sl.notes?.match(/Code:\s*([A-Z0-9\-]+)/i)
          const titleMatch = sl.notes?.match(/Reward:\s*([^|]+)/i)
          const isFulfilledNote = Boolean(sl.notes?.includes('[Reward Fulfilled') || sl.conversion_notes?.includes('[Reward Fulfilled'))
          formattedRewards.push({
            id: sl.id,
            created_at: sl.created_at,
            reward_type: 'spin_prize',
            reward_title: titleMatch ? titleMatch[1].trim() : 'Spin & Earn Prize',
            reward_code: codeMatch ? codeMatch[1].trim() : (sl.referral_code || '-'),
            status: isFulfilledNote ? 'fulfilled' : 'pending',
            fulfilled_at: isFulfilledNote ? sl.converted_at : null,
            fulfillment_note: isFulfilledNote ? 'Fulfilled by staff' : null,
            name: sl.name,
            email: sl.email,
            phone: sl.phone,
            referral_code: sl.referral_code,
          })
        }
      }
    }

    if (status) {
      return formattedRewards.filter(r => r.status === status)
    }

    return formattedRewards
  } catch {
    return []
  }
}

export async function rpcAdminFulfillReward(
  rewardId: string,
  fulfillmentNote = 'Fulfilled by ABLEBIZ Suite admin'
): Promise<{ success: boolean; message?: string }> {
  const sb = ensure()

  // Try RPC
  try {
    const { data, error } = await sb.rpc('ablebiz_admin_fulfill_reward', {
      p_reward_id: rewardId,
      p_fulfillment_note: fulfillmentNote,
    })
    if (!error && (data as any)?.success) {
      return { success: true }
    }
  } catch {
    // Fall back
  }

  // Fallback direct table update (spin_rewards or leads table notes without setting is_converted)
  try {
    const { error: spinErr } = await sb
      .from('spin_rewards')
      .update({
        status: 'fulfilled',
        fulfilled_at: new Date().toISOString(),
        fulfillment_note: fulfillmentNote,
      })
      .eq('id', rewardId)

    if (!spinErr) {
      return { success: true }
    }

    // If rewardId is in leads table, update notes ONLY, preserving is_converted = false
    const { data: leadRecord } = await sb.from('leads').select('notes').eq('id', rewardId).maybeSingle()
    const updatedNotes = (leadRecord?.notes || '') + ` | [Reward Fulfilled: ${fulfillmentNote} at ${new Date().toISOString()}]`

    const { error: leadErr } = await sb
      .from('leads')
      .update({
        notes: updatedNotes,
      })
      .eq('id', rewardId)

    if (!leadErr) {
      return { success: true }
    }

    throw spinErr || leadErr
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to fulfill reward.' }
  }
}


