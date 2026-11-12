import type { CanonicalStaffRole } from '../auth/roleConfig';

// ==============================================================================
// PHASE 15: NOTIFICATIONS & ESCALATION ENGINE
// ==============================================================================

export type NotificationCategory =
  | 'tasks'
  | 'sla'
  | 'finance'
  | 'cac'
  | 'approvals'
  | 'appointments'
  | 'quotations'
  | 'compliance'
  | 'system'
  | 'backup';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SuiteNotification {
  id: string;
  recipient_staff_id: string;
  title: string;
  message: string;
  link?: string | null;
  priority: NotificationPriority;
  is_read: boolean;
  read_at?: string | null;
  category: NotificationCategory;
  event_type?: string | null;
  record_id?: string | null;
  record_type?: string | null;
  action_url?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface StaffNotificationPreference {
  id?: string;
  staff_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  subscribed_categories: NotificationCategory[];
  reminder_frequency: 'immediate' | 'hourly' | 'daily';
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type EscalationEventType =
  | 'task_overdue'
  | 'sla_warning'
  | 'sla_breach'
  | 'complaint_overdue'
  | 'approval_pending'
  | 'compliance_deadline'
  | 'quotation_expiring'
  | 'appointment_unconfirmed'
  | 'backup_failure';

export interface EscalationRule {
  id: string;
  event_type: EscalationEventType;
  name: string;
  description?: string | null;
  trigger_condition: string;
  time_threshold_hours: number;
  priority: NotificationPriority;
  responsible_role: CanonicalStaffRole;
  escalate_to_role: CanonicalStaffRole;
  escalate_to_staff_id?: string | null;
  channel: 'in_app' | 'email' | 'all';
  repeat_interval_hours: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EscalationLog {
  id: string;
  rule_id?: string | null;
  event_type: string;
  record_id: string;
  escalation_level: number;
  recipient_staff_id: string;
  recipient_role: string;
  title: string;
  message: string;
  notification_id?: string | null;
  triggered_at: string;
}

// ==============================================================================
// PHASE 16: BACKUP, RECOVERY & BUSINESS CONTINUITY
// ==============================================================================

export type BackupType = 'database' | 'documents' | 'configuration' | 'full_suite';
export type BackupStatus = 'completed' | 'verified' | 'in_progress' | 'failed' | 'retrying';

export interface BackupRecord {
  id: string;
  backup_reference: string;
  backup_type: BackupType;
  provider: string;
  storage_location: string;
  file_size_mb: number;
  checksum?: string | null;
  status: BackupStatus;
  retention_days: number;
  error_message?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  notes?: string | null;
  created_at: string;
  verifier?: { full_name: string };
}

export type RestoreOutcome = 'passed_unconditionally' | 'passed_with_minor_notes' | 'failed_requires_action';

export interface RestoreDrill {
  id: string;
  drill_code: string;
  drill_date: string;
  backup_reference: string;
  isolated_environment_name: string;
  duration_minutes: number;
  critical_tables_verified: string[];
  documents_verified: boolean;
  integrity_check_passed: boolean;
  rpo_hours_achieved: number;
  rto_minutes_achieved: number;
  overall_outcome: RestoreOutcome;
  validation_notes: string;
  corrective_action_plan?: string | null;
  conducted_by: string;
  created_at: string;
  conductor?: { full_name: string };
}

export interface BusinessContinuitySettings {
  id?: string;
  target_rpo_hours: number;
  target_rto_hours: number;
  rpo_rto_approved_by_management: boolean;
  management_approval_date?: string | null;
  retention_policy_days: number;
  primary_backup_schedule: string;
  point_in_time_recovery_available: boolean;
  storage_coverage: string[];
  disaster_recovery_lead: string;
  emergency_contact_phone: string;
  emergency_contact_email: string;
  disaster_recovery_runbook: string;
  updated_at?: string;
}

// ==============================================================================
// PHASE 17: SERVICE CATALOGUE & QUOTATION INTELLIGENCE
// ==============================================================================

export interface ServiceBundle {
  id: string;
  bundle_code: string;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
  included_service_ids: string[];
  bundle_price_ngn: number;
  standard_total_ngn: number;
  savings_percentage: number;
  eligibility_conditions?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceRecommendation {
  service_id: string;
  name: string;
  category: string;
  default_fee_ngn: number;
  reason: string;
  is_bundle?: boolean;
  bundle_id?: string;
}

export interface QuotationFinancialSummary {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  statutory_fees_total: number;
  internal_cost_total: number;
  margin_amount: number;
  margin_percentage: number;
  requires_approval: boolean;
  approval_reasons: string[];
}

// ==============================================================================
// PHASE 18: MARKETING CAMPAIGN & LEAD ATTRIBUTION ANALYTICS
// ==============================================================================

export interface MarketingAttributionSummary {
  reporting_period_start: string;
  reporting_period_end: string;
  total_leads: number;
  converted_clients: number;
  lead_conversion_rate: number;
  invoiced_revenue_attributed: number;
  verified_cash_attributed: number;
  total_campaign_spend: number;
  cost_per_lead: number | null;
  cost_per_acquired_client: number | null;
  campaign_roi_cash_percent: number | null;
  campaign_roi_invoiced_percent: number | null;
}

export interface CampaignAttributionRow {
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  status: string;
  budget_ngn: number;
  actual_spend_ngn: number;
  leads_count: number;
  converted_clients_count: number;
  conversion_rate: number;
  invoiced_revenue: number;
  verified_cash_collected: number;
  cost_per_lead: number | null;
  cost_per_acquired_client: number | null;
  roi_cash_percent: number | null;
}

export interface LeadChannelAttributionRow {
  channel_name: string;
  channel_type: string;
  leads_count: number;
  converted_clients_count: number;
  conversion_rate: number;
  invoiced_revenue: number;
  verified_cash_collected: number;
}

export interface ReferralAttributionRow {
  partner_id: string;
  partner_name: string;
  partner_phone: string;
  referral_code: string;
  leads_count: number;
  converted_clients_count: number;
  conversion_rate: number;
  invoiced_revenue: number;
  verified_cash_collected: number;
  verified_rewards_payable: number;
}

// ==============================================================================
// PHASE 19: RECEIPT-LINKED EXPENSE ALLOCATION & PROFITABILITY
// ==============================================================================

export interface ExpenseReceiptAllocation {
  id?: string;
  expense_id: string;
  payment_id: string;
  allocated_amount: number;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joins
  payment?: {
    receipt_number: string;
    amount: number;
    payment_date: string;
    is_verified: boolean;
    client?: { full_name: string; phone: string };
    invoice?: { invoice_number: string; total_amount: number };
  };
}

export type ReceiptAllocationStatus = 'fully_allocated' | 'partially_allocated' | 'no_expenses_allocated';
export type ReceiptProfitabilityStatus = 'profitable' | 'loss_making' | 'break_even';

export interface ReceiptProfitabilityRecord {
  payment_id: string;
  receipt_number: string;
  payment_date: string;
  client_id: string;
  client_name: string;
  client_phone?: string;
  invoice_id: string;
  invoice_number: string;
  service_request_id?: string | null;
  service_tracking_code?: string | null;
  service_name?: string | null;
  service_category?: string | null;
  verified_receipt_amount: number;
  total_allocated_expenses: number;
  net_contribution: number;
  net_contribution_margin_percent: number;
  allocation_status: ReceiptAllocationStatus;
  profitability_status: ReceiptProfitabilityStatus;
  is_verified: boolean;
  allocations_count: number;
}

export interface ExpenseAllocationLedgerRecord {
  expense_id: string;
  expense_date: string;
  category: string;
  description?: string | null;
  expense_amount: number;
  total_allocated: number;
  unallocated_amount: number;
  allocation_status: 'fully_allocated' | 'partially_allocated' | 'unallocated';
  linked_receipts: Array<{
    receipt_number: string;
    allocated_amount: number;
    client_name?: string;
  }>;
  vendor_name?: string;
  recorded_by?: string;
}

export interface ClientServiceProfitabilityRollup {
  entity_id: string;
  entity_name: string;
  entity_type: 'client' | 'service_category' | 'service_request';
  total_receipts_verified: number;
  total_allocated_expenses: number;
  net_contribution: number;
  margin_percent: number;
  receipts_count: number;
}
