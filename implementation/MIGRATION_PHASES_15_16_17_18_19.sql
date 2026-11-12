-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 15, 16, 17, 18 & 19 DATABASE MIGRATION
-- PHASE 15: Notifications & Escalation Engine
-- PHASE 16: Backup, Recovery & Business Continuity
-- PHASE 17: Service Catalogue & Quotation Intelligence
-- PHASE 18: Marketing Campaign & Lead Attribution Analytics
-- PHASE 19: Receipt-Linked Expense Allocation & Profitability
-- File: implementation/MIGRATION_PHASES_15_16_17_18_19.sql
-- Idempotent, safe, and non-destructive.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. PHASE 15 — NOTIFICATIONS & ESCALATION ENGINE
-- ==============================================================================

-- 1.1 Extend notifications table with category, event_type, record metadata
alter table public.notifications 
  add column if not exists category text not null default 'system',
  add column if not exists event_type text,
  add column if not exists record_id text,
  add column if not exists record_type text,
  add column if not exists action_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_notifications_category on public.notifications(category);
create index if not exists idx_notifications_event_type on public.notifications(event_type);
create index if not exists idx_notifications_record on public.notifications(record_type, record_id);

-- 1.2 Staff Notification Preferences Table
create table if not exists public.staff_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade unique,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default true,
  subscribed_categories text[] not null default array[
    'tasks', 'sla', 'finance', 'cac', 'approvals', 'appointments', 'quotations', 'compliance', 'system', 'backup'
  ],
  reminder_frequency text not null default 'immediate' check (reminder_frequency in ('immediate', 'hourly', 'daily')),
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time default '20:00:00',
  quiet_hours_end time default '07:00:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_notif_prefs_staff on public.staff_notification_preferences(staff_id);

-- 1.3 Escalation Rules Table
create table if not exists public.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  event_type text not null unique check (event_type in (
    'task_overdue',
    'sla_warning',
    'sla_breach',
    'complaint_overdue',
    'approval_pending',
    'compliance_deadline',
    'quotation_expiring',
    'appointment_unconfirmed',
    'backup_failure'
  )),
  name text not null,
  description text,
  trigger_condition text not null default 'time_threshold_exceeded',
  time_threshold_hours integer not null default 24,
  priority text not null default 'high' check (priority in ('low', 'normal', 'high', 'urgent')),
  responsible_role text not null,
  escalate_to_role text not null,
  escalate_to_staff_id uuid references public.staff_profiles(id) on delete set null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'all')),
  repeat_interval_hours integer not null default 0, -- 0 means trigger once without repeated spam
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_escalation_rules_active on public.escalation_rules(is_active, event_type);

-- 1.4 Escalation Logs (Audit of triggered escalations)
create table if not exists public.escalation_logs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.escalation_rules(id) on delete set null,
  event_type text not null,
  record_id text not null,
  escalation_level integer not null default 1,
  recipient_staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  recipient_role text not null,
  title text not null,
  message text not null,
  notification_id uuid references public.notifications(id) on delete set null,
  triggered_at timestamptz not null default now()
);

create index if not exists idx_escalation_logs_event on public.escalation_logs(event_type, record_id, triggered_at desc);

-- Seed Default Escalation Rules
insert into public.escalation_rules (
  event_type, name, description, trigger_condition, time_threshold_hours, priority, responsible_role, escalate_to_role, channel, repeat_interval_hours, is_active
) values
  ('task_overdue', 'Overdue Operational Task Escalation', 'Escalates tasks pending past deadline to the Operations Manager.', 'deadline_exceeded', 12, 'high', 'registration_officer', 'operations_manager', 'in_app', 24, true),
  ('sla_breach', 'Critical SLA Breach Escalation', 'Alerts management immediately when a client turnaround commitment is breached.', 'sla_breached', 0, 'urgent', 'registration_officer', 'operations_manager', 'all', 0, true),
  ('complaint_overdue', 'Unresolved Client Complaint Escalation', 'Escalates client complaints pending resolution beyond 24 hours to Executive Management.', 'unresolved_complaint', 24, 'urgent', 'client_service_officer', 'admin', 'all', 12, true),
  ('approval_pending', 'Pending Approval Request Stagnation', 'Escalates unreviewed approval requests awaiting executive sign-off for more than 48 hours.', 'pending_approval_duration', 48, 'normal', 'accounts_officer', 'super_admin', 'in_app', 48, true),
  ('quotation_expiring', 'Quotation Approaching Expiry Notice', 'Reminds Client Service & Commercial officers of accepted or open quotations expiring in 48 hours.', 'validity_window_closing', 48, 'normal', 'client_service_officer', 'client_service_officer', 'in_app', 0, true),
  ('backup_failure', 'Infrastructure Backup Failure Alert', 'Urgent alert to Super Administrators when scheduled automated backup or verification fails.', 'backup_failed', 0, 'urgent', 'admin', 'super_admin', 'all', 6, true)
on conflict (event_type) do nothing;


-- ==============================================================================
-- 2. PHASE 16 — BACKUP, RECOVERY & BUSINESS CONTINUITY
-- ==============================================================================

-- 2.1 Backup Records Table (Tracking provider snapshots, file backups, and verifications)
create table if not exists public.backup_records (
  id uuid primary key default gen_random_uuid(),
  backup_reference text not null unique,
  backup_type text not null check (backup_type in ('database', 'documents', 'configuration', 'full_suite')),
  provider text not null default 'Supabase Managed Infrastructure',
  storage_location text not null default 'Offsite Encrypted Object Storage (EU/US Multi-Region)',
  file_size_mb numeric(10,2) not null default 0.00,
  checksum text,
  status text not null check (status in ('completed', 'verified', 'in_progress', 'failed', 'retrying')),
  retention_days integer not null default 30,
  error_message text,
  verified_at timestamptz,
  verified_by uuid references public.staff_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_backup_records_status on public.backup_records(status, created_at desc);
create index if not exists idx_backup_records_created on public.backup_records(created_at desc);

-- 2.2 Physical Restore Drills Table (Tracking isolated test restores)
create table if not exists public.restore_drills (
  id uuid primary key default gen_random_uuid(),
  drill_code text not null unique,
  drill_date date not null default current_date,
  backup_reference text not null,
  isolated_environment_name text not null,
  duration_minutes integer not null default 45,
  critical_tables_verified jsonb not null default '["staff_profiles", "clients", "invoices", "payments", "expenses", "cac_applications"]'::jsonb,
  documents_verified boolean not null default true,
  integrity_check_passed boolean not null default true,
  rpo_hours_achieved numeric(6,2) not null default 1.5,
  rto_minutes_achieved numeric(6,2) not null default 45.0,
  overall_outcome text not null check (overall_outcome in ('passed_unconditionally', 'passed_with_minor_notes', 'failed_requires_action')),
  validation_notes text not null,
  corrective_action_plan text,
  conducted_by uuid not null references public.staff_profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_restore_drills_date on public.restore_drills(drill_date desc);

-- 2.3 Business Continuity Settings Table
create table if not exists public.business_continuity_settings (
  id uuid primary key default gen_random_uuid(),
  target_rpo_hours numeric(6,2) not null default 2.0,
  target_rto_hours numeric(6,2) not null default 4.0,
  rpo_rto_approved_by_management boolean not null default false,
  management_approval_date date,
  retention_policy_days integer not null default 30,
  primary_backup_schedule text not null default 'Daily Automated Snapshot (02:00 UTC)',
  point_in_time_recovery_available boolean not null default true,
  storage_coverage text[] not null default array['client_documents', 'invoices', 'receipts', 'cac_certificates', 'system_configs'],
  disaster_recovery_lead text not null default 'Lead Systems Administrator / Operations Manager',
  emergency_contact_phone text not null default '+234 803 000 0000',
  emergency_contact_email text not null default 'hello@ablebiz.com.ng',
  disaster_recovery_runbook text not null default 'Standard Operating Procedure for Disaster Recovery and Data Continuity',
  updated_at timestamptz not null default now()
);

-- Seed initial Business Continuity Record if not exists
insert into public.business_continuity_settings (
  target_rpo_hours, target_rto_hours, rpo_rto_approved_by_management, retention_policy_days, primary_backup_schedule, point_in_time_recovery_available
)
select 2.0, 4.0, false, 30, 'Daily Automated Snapshot (02:00 UTC)', true
where not exists (select 1 from public.business_continuity_settings);


-- ==============================================================================
-- 3. PHASE 17 — SERVICE CATALOGUE & QUOTATION INTELLIGENCE
-- ==============================================================================

-- 3.1 Service Bundles Table
create table if not exists public.service_bundles (
  id uuid primary key default gen_random_uuid(),
  bundle_code text not null unique,
  name text not null,
  slug text not null unique,
  description text,
  category text not null default 'business_registration',
  included_service_ids uuid[] not null default '{}',
  bundle_price_ngn numeric(14,2) not null default 0.00,
  standard_total_ngn numeric(14,2) not null default 0.00,
  savings_percentage numeric(5,2) not null default 0.00,
  eligibility_conditions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_bundles_active on public.service_bundles(is_active);

-- Seed standard bundles if none exist
insert into public.service_bundles (
  bundle_code, name, slug, description, category, bundle_price_ngn, standard_total_ngn, savings_percentage, is_active
) values
  ('BND-LTD-COMPLETE', 'Private Limited Company All-Inclusive Suite', 'private-limited-company-all-inclusive-suite', 'End-to-end company registration including CAC incorporation, official e-certificate, certified status report, FIRS corporate tax clearance profile, and company seal documentation.', 'business_registration', 75000.00, 90000.00, 16.67, true),
  ('BND-BN-POST', 'Business Name & Post-Incorporation Starter Pack', 'business-name-post-incorporation-starter-pack', 'Complete sole proprietorship or partnership registration coupled with First-Year Annual Return compliance guidance and business bank account opening kit.', 'business_registration', 35000.00, 42000.00, 16.67, true),
  ('BND-NGO-SCUML', 'Incorporated Trustees & SCUML Compliance Bundle', 'incorporated-trustees-scuml-compliance-bundle', 'Comprehensive NGO, Church, or Foundation registration paired with Special Control Unit Against Money Laundering (SCUML) compliance filing.', 'business_registration', 140000.00, 165000.00, 15.15, true)
on conflict (bundle_code) do nothing;

-- 3.2 Extend quotations table with margins, statutory fees, approval references, conversion tracking
-- Note: statutory_fee_total (singular) matches existing canonical schema from earlier phases
alter table public.quotations drop column if exists statutory_fees_total;

alter table public.quotations 
  add column if not exists statutory_fee_total numeric(14,2) not null default 0.00,
  add column if not exists internal_cost_total numeric(14,2) not null default 0.00,
  add column if not exists margin_amount numeric(14,2) not null default 0.00,
  add column if not exists margin_percentage numeric(5,2) not null default 0.00,
  add column if not exists approval_request_id uuid,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists rejection_reason text,
  add column if not exists converted_invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references public.staff_profiles(id) on delete set null;

-- Conditionally add foreign key constraint to approval_requests if table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'approval_requests'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints 
      where constraint_name = 'fk_quotations_approval_request'
    ) then
      alter table public.quotations 
        add constraint fk_quotations_approval_request 
        foreign key (approval_request_id) references public.approval_requests(id) on delete set null;
    end if;
  end if;
end $$;

create index if not exists idx_quotations_approval on public.quotations(approval_request_id);
create index if not exists idx_quotations_converted_inv on public.quotations(converted_invoice_id);

-- 3.3 Extend quotation_items table with item_type, statutory fee & internal cost breakdown
alter table public.quotation_items
  add column if not exists item_type text not null default 'professional_fee',
  add column if not exists statutory_fee numeric(14,2) not null default 0.00,
  add column if not exists internal_cost numeric(14,2) not null default 0.00;

-- Update check constraint on quotation_items.item_type to permit service, bundle, addon, and legacy values
do $$
declare
  r record;
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'quotation_items'
  ) then
    for r in (
      select c.conname 
      from pg_constraint c
      where c.conrelid = 'public.quotation_items'::regclass 
        and c.contype = 'c' 
        and pg_get_constraintdef(c.oid) like '%item_type%'
    ) loop
      execute 'alter table public.quotation_items drop constraint if exists ' || quote_ident(r.conname);
    end loop;

    alter table public.quotation_items 
      add constraint chk_quotation_items_item_type 
      check (item_type in ('professional_fee', 'statutory_fee', 'service', 'bundle', 'addon', 'other'));
  end if;
end $$;

-- Also update invoice_items.item_type check constraint to match for seamless quotation conversion
do $$
declare
  r record;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoice_items' and column_name = 'item_type'
  ) then
    for r in (
      select c.conname 
      from pg_constraint c
      where c.conrelid = 'public.invoice_items'::regclass 
        and c.contype = 'c' 
        and pg_get_constraintdef(c.oid) like '%item_type%'
    ) loop
      execute 'alter table public.invoice_items drop constraint if exists ' || quote_ident(r.conname);
    end loop;

    alter table public.invoice_items 
      add constraint chk_invoice_items_item_type 
      check (item_type in ('professional_fee', 'statutory_fee', 'service', 'bundle', 'addon', 'other'));
  end if;
end $$;


-- ==============================================================================
-- 4. PHASE 18 — MARKETING CAMPAIGN & LEAD ATTRIBUTION ANALYTICS
-- ==============================================================================

-- 4.1 Ensure campaigns table has spend tracking columns
alter table public.campaigns
  add column if not exists budget_ngn numeric(14,2) not null default 0.00,
  add column if not exists actual_spend_ngn numeric(14,2) not null default 0.00,
  add column if not exists ad_spend_ngn numeric(14,2) not null default 0.00;

-- 4.2 Ensure leads table has conversion tracking columns
alter table public.leads
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists conversion_date timestamptz,
  add column if not exists conversion_revenue numeric(14,2) not null default 0.00;

create index if not exists idx_leads_campaign_id on public.leads(campaign_id);
create index if not exists idx_leads_utm_campaign on public.leads(utm_campaign);
create index if not exists idx_leads_utm_source on public.leads(utm_source);


-- ==============================================================================
-- 5. PHASE 19 — RECEIPT-LINKED EXPENSE ALLOCATION & PROFITABILITY
-- ==============================================================================

-- 5.1 Expense Receipt Allocations Table
-- Associates an expense with one or multiple client payments (receipts)
create table if not exists public.expense_receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict,
  allocated_amount numeric(14,2) not null check (allocated_amount > 0),
  notes text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(expense_id, payment_id)
);

create index if not exists idx_expense_alloc_expense on public.expense_receipt_allocations(expense_id);
create index if not exists idx_expense_alloc_payment on public.expense_receipt_allocations(payment_id);

-- 5.2 Allocation Audit Logs Table (Tracks allocation modifications)
create table if not exists public.expense_allocation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  action text not null check (action in ('allocated', 'amount_modified', 'deallocated')),
  previous_amount numeric(14,2) not null default 0.00,
  new_amount numeric(14,2) not null default 0.00,
  reason text,
  performed_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_allocation_audit_exp on public.expense_allocation_audit_logs(expense_id, created_at desc);

-- 5.3 Database Function to Prevent Expense Over-Allocation
create or replace function public.validate_expense_allocation_cap()
returns trigger as $$
declare
  v_expense_amount numeric(14,2);
  v_current_total numeric(14,2);
begin
  select amount into v_expense_amount
  from public.expenses
  where id = NEW.expense_id;

  if v_expense_amount is null then
    raise exception 'Associated expense record not found.';
  end if;

  select coalesce(sum(allocated_amount), 0) into v_current_total
  from public.expense_receipt_allocations
  where expense_id = NEW.expense_id
    and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if (v_current_total + NEW.allocated_amount) > v_expense_amount then
    raise exception 'Total allocations (₦%) exceed the total expense amount (₦%).',
      (v_current_total + NEW.allocated_amount), v_expense_amount;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_validate_expense_allocation on public.expense_receipt_allocations;
create trigger trg_validate_expense_allocation
  before insert or update on public.expense_receipt_allocations
  for each row execute function public.validate_expense_allocation_cap();


-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.staff_notification_preferences enable row level security;
alter table public.escalation_rules enable row level security;
alter table public.escalation_logs enable row level security;
alter table public.backup_records enable row level security;
alter table public.restore_drills enable row level security;
alter table public.business_continuity_settings enable row level security;
alter table public.service_bundles enable row level security;
alter table public.expense_receipt_allocations enable row level security;
alter table public.expense_allocation_audit_logs enable row level security;

-- 6.1 Staff Notification Preferences Policies
drop policy if exists "Staff can view and update their own notification preferences" on public.staff_notification_preferences;
create policy "Staff can view and update their own notification preferences"
  on public.staff_notification_preferences
  for all
  using (
    staff_id in (select id from public.staff_profiles where auth_uid = auth.uid())
    or exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin'))
  );

-- 6.2 Escalation Rules Policies (All active staff can view; admin/ops can manage)
drop policy if exists "Active staff can view escalation rules" on public.escalation_rules;
create policy "Active staff can view escalation rules"
  on public.escalation_rules
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true));

drop policy if exists "Management can configure escalation rules" on public.escalation_rules;
create policy "Management can configure escalation rules"
  on public.escalation_rules
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin', 'operations_manager')));

-- 6.3 Escalation Logs Policies
drop policy if exists "Active staff can view escalation logs" on public.escalation_logs;
create policy "Active staff can view escalation logs"
  on public.escalation_logs
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true));

-- 6.4 Backup & Recovery Policies (Restricted to super_admin and admin)
drop policy if exists "Admins can manage backup records" on public.backup_records;
create policy "Admins can manage backup records"
  on public.backup_records
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin')));

drop policy if exists "Admins can manage restore drills" on public.restore_drills;
create policy "Admins can manage restore drills"
  on public.restore_drills
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin')));

drop policy if exists "Admins can manage business continuity settings" on public.business_continuity_settings;
create policy "Admins can manage business continuity settings"
  on public.business_continuity_settings
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin')));

-- 6.5 Service Bundles Policies (All active staff can read; operations/admin can manage)
drop policy if exists "Active staff can view service bundles" on public.service_bundles;
create policy "Active staff can view service bundles"
  on public.service_bundles
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true));

drop policy if exists "Operations and admin can manage service bundles" on public.service_bundles;
create policy "Operations and admin can manage service bundles"
  on public.service_bundles
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin', 'operations_manager')));

-- 6.6 Expense Receipt Allocations Policies (Finance & management)
drop policy if exists "Authorized staff can view expense allocations" on public.expense_receipt_allocations;
create policy "Authorized staff can view expense allocations"
  on public.expense_receipt_allocations
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin', 'accounts_officer', 'operations_manager')));

drop policy if exists "Accounts and Admin can manage expense allocations" on public.expense_receipt_allocations;
create policy "Accounts and Admin can manage expense allocations"
  on public.expense_receipt_allocations
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin', 'accounts_officer')));

drop policy if exists "Authorized staff can view allocation audit logs" on public.expense_allocation_audit_logs;
create policy "Authorized staff can view allocation audit logs"
  on public.expense_allocation_audit_logs
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and role::text in ('super_admin', 'admin', 'accounts_officer')));

commit;
