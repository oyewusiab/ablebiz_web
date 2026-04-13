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

  if (error) throw error
  return data as unknown as SpinRpcResult
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
  reminderTopics?: Array<'annual_returns' | 'scuml' | 'tax' | 'trademark' | 'ngo_returns' | 'general_compliance'>
  referredBy?: string
  consentMarketing?: boolean
  pagePath?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): Promise<ConsultationRpcResult> {
  const sb = ensure()
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

  if (error) throw error
  return data as unknown as ConsultationRpcResult
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

  if (error) throw error
  return data as unknown as ChecklistDownloadRpcResult
}

export async function rpcGetMonthlyLeaderboard(limit = 5): Promise<LeaderboardRow[]> {
  const sb = ensure()
  const { data, error } = await sb.rpc('ablebiz_get_monthly_leaderboard', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as unknown as LeaderboardRow[]
}
