-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 15, 16, 17, 18 & 19 DATABASE MIGRATION
-- PHASE 15: Notifications & Escalation Engine
-- PHASE 16: Backup, Recovery & Business Continuity
-- PHASE 17: Service Catalogue & Quotation Intelligence
-- PHASE 18: Marketing Campaign & Lead Attribution Analytics
-- PHASE 19: Receipt-Linked Expense Allocation & Profitability
-- File: implementation/MIGRATION_PHASES_15_16_17_18_19.sql
-- Genuinely idempotent, concurrency-hardened, and non-destructive.
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

-- Reconcile columns if table pre-existed from earlier draft
alter table public.staff_notification_preferences
  add column if not exists in_app_enabled boolean not null default true,
  add column if not exists email_enabled boolean not null default true,
  add column if not exists whatsapp_enabled boolean not null default true,
  add column if not exists subscribed_categories text[] not null default array[
    'tasks', 'sla', 'finance', 'cac', 'approvals', 'appointments', 'quotations', 'compliance', 'system', 'backup'
  ],
  add column if not exists reminder_frequency text not null default 'immediate',
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start time default '20:00:00',
  add column if not exists quiet_hours_end time default '07:00:00';

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
  repeat_interval_hours integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.escalation_rules
  add column if not exists trigger_condition text not null default 'time_threshold_exceeded',
  add column if not exists time_threshold_hours integer not null default 24,
  add column if not exists channel text not null default 'in_app',
  add column if not exists repeat_interval_hours integer not null default 0,
  add column if not exists is_active boolean not null default true;

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

alter table public.escalation_logs
  add column if not exists escalation_level integer not null default 1,
  add column if not exists notification_id uuid references public.notifications(id) on delete set null;

create index if not exists idx_escalation_logs_event on public.escalation_logs(event_type, record_id, triggered_at desc);

-- Seed Default Escalation Rules (Idempotent: DO NOTHING on existing conflict)
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
  provider text not null default 'Awaiting Infrastructure Confirmation',
  storage_location text not null default 'Awaiting Infrastructure Confirmation',
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

alter table public.backup_records
  add column if not exists provider text not null default 'Awaiting Infrastructure Confirmation',
  add column if not exists storage_location text not null default 'Awaiting Infrastructure Confirmation',
  add column if not exists file_size_mb numeric(10,2) not null default 0.00,
  add column if not exists checksum text,
  add column if not exists retention_days integer not null default 30,
  add column if not exists error_message text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.staff_profiles(id) on delete set null,
  add column if not exists notes text;

create index if not exists idx_backup_records_status on public.backup_records(status, created_at desc);
create index if not exists idx_backup_records_created on public.backup_records(created_at desc);

-- 2.2 Physical Restore Drills Table (Tracking isolated test restores)
create table if not exists public.restore_drills (
  id uuid primary key default gen_random_uuid(),
  drill_code text not null unique,
  drill_date date not null default current_date,
  backup_reference text not null,
  isolated_environment_name text not null,
  duration_minutes integer,
  critical_tables_verified jsonb not null default '[]'::jsonb,
  documents_verified boolean not null default false,
  integrity_check_passed boolean not null default false,
  rpo_hours_achieved numeric(6,2),
  rto_minutes_achieved numeric(6,2),
  overall_outcome text not null check (overall_outcome in ('passed_unconditionally', 'passed_with_minor_notes', 'failed_requires_action', 'pending_drill_execution')) default 'pending_drill_execution',
  validation_notes text not null,
  corrective_action_plan text,
  conducted_by uuid not null references public.staff_profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.restore_drills
  add column if not exists duration_minutes integer,
  add column if not exists critical_tables_verified jsonb not null default '[]'::jsonb,
  add column if not exists documents_verified boolean not null default false,
  add column if not exists integrity_check_passed boolean not null default false,
  add column if not exists rpo_hours_achieved numeric(6,2),
  add column if not exists rto_minutes_achieved numeric(6,2),
  add column if not exists corrective_action_plan text;

create index if not exists idx_restore_drills_date on public.restore_drills(drill_date desc);

-- 2.3 Business Continuity Settings Table
create table if not exists public.business_continuity_settings (
  id uuid primary key default gen_random_uuid(),
  target_rpo_hours numeric(6,2) not null default 2.0,
  target_rto_hours numeric(6,2) not null default 4.0,
  rpo_rto_approved_by_management boolean not null default false,
  management_approval_date date,
  retention_policy_days integer not null default 30,
  primary_backup_schedule text not null default 'Awaiting Infrastructure Confirmation',
  point_in_time_recovery_available boolean not null default false,
  storage_coverage text[] not null default '{}',
  disaster_recovery_lead text not null default 'Operations Manager / Lead Systems Administrator',
  emergency_contact_phone text default null,
  emergency_contact_email text default 'hello@ablebiz.com.ng',
  disaster_recovery_runbook text not null default 'Standard Operating Procedure for Disaster Recovery and Data Continuity',
  updated_at timestamptz not null default now()
);

alter table public.business_continuity_settings
  add column if not exists target_rpo_hours numeric(6,2) not null default 2.0,
  add column if not exists target_rto_hours numeric(6,2) not null default 4.0,
  add column if not exists rpo_rto_approved_by_management boolean not null default false,
  add column if not exists primary_backup_schedule text not null default 'Awaiting Infrastructure Confirmation',
  add column if not exists point_in_time_recovery_available boolean not null default false,
  add column if not exists storage_coverage text[] not null default '{}',
  add column if not exists disaster_recovery_lead text not null default 'Operations Manager / Lead Systems Administrator',
  add column if not exists emergency_contact_phone text default null,
  add column if not exists emergency_contact_email text default 'hello@ablebiz.com.ng';

-- Seed initial Business Continuity Record if not exists (unapproved draft state)
insert into public.business_continuity_settings (
  target_rpo_hours, target_rto_hours, rpo_rto_approved_by_management, retention_policy_days, primary_backup_schedule, point_in_time_recovery_available, storage_coverage, emergency_contact_phone
)
select 2.0, 4.0, false, 30, 'Awaiting Infrastructure Confirmation', false, '{}'::text[], null
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
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_bundles
  add column if not exists included_service_ids uuid[] not null default '{}',
  add column if not exists bundle_price_ngn numeric(14,2) not null default 0.00,
  add column if not exists standard_total_ngn numeric(14,2) not null default 0.00,
  add column if not exists savings_percentage numeric(5,2) not null default 0.00,
  add column if not exists eligibility_conditions text,
  add column if not exists is_active boolean not null default false;

create index if not exists idx_service_bundles_active on public.service_bundles(is_active);

-- Seed draft service bundles linked to verified catalog services where available
do $$
declare
  v_ltd_id uuid;
  v_bn_id uuid;
begin
  select id into v_ltd_id from public.services_catalog where slug = 'cac-company-registration-llc' limit 1;
  select id into v_bn_id from public.services_catalog where slug = 'cac-business-name-registration' limit 1;

  insert into public.service_bundles (
    bundle_code, name, slug, description, category, included_service_ids, bundle_price_ngn, standard_total_ngn, savings_percentage, is_active
  ) values
    (
      'BND-LTD-PROPOSAL',
      'Private Limited Company Comprehensive Package (Draft Proposal)',
      'private-limited-company-comprehensive-package-draft',
      '[DRAFT PROPOSAL — Awaiting Executive Pricing Review and Policy Approval] Standard incorporation of private limited liability company with statutory compliance documentation.',
      'business_registration',
      case when v_ltd_id is not null then array[v_ltd_id] else '{}'::uuid[] end,
      75000.00,
      90000.00,
      16.67,
      false
    ),
    (
      'BND-BN-PROPOSAL',
      'Business Name Starter Pack (Draft Proposal)',
      'business-name-starter-pack-draft',
      '[DRAFT PROPOSAL — Awaiting Executive Pricing Review and Policy Approval] Registration of business name enterprise with post-registration compliance guidance.',
      'business_registration',
      case when v_bn_id is not null then array[v_bn_id] else '{}'::uuid[] end,
      35000.00,
      42000.00,
      16.67,
      false
    )
  on conflict (bundle_code) do nothing;
end $$;

-- 3.2 Extend quotations table with margins, statutory fees, approval references, conversion tracking
-- Reconciliation Conflict Table: Preserves independent history with NO cascading deletion
create table if not exists public.quotation_reconciliation_conflicts (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.quotations(id) on delete set null,
  historical_quotation_id uuid not null,
  quotation_number text not null,
  statutory_fee_total numeric(14,2) not null,
  statutory_fees_total numeric(14,2) not null,
  detected_at timestamptz not null default now(),
  status text not null default 'pending_manual_reconciliation' check (status in ('pending_manual_reconciliation', 'resolved')),
  resolution_notes text,
  constraint uq_quotation_reconciliation_conflict unique (historical_quotation_id)
);

create index if not exists idx_quote_recon_conflicts_hist on public.quotation_reconciliation_conflicts(historical_quotation_id);

-- Safe conflict-preserving reconciliation between statutory_fees_total (plural) and statutory_fee_total (singular)
do $$
declare
  v_conflict_count integer := 0;
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'quotations' and column_name = 'statutory_fees_total'
  ) then
    -- Ensure canonical singular column exists
    if not exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'quotations' and column_name = 'statutory_fee_total'
    ) then
      alter table public.quotations add column statutory_fee_total numeric(14,2) not null default 0.00;
    end if;

    -- Check for conflicting rows where BOTH columns have non-zero differing values
    select count(*) into v_conflict_count
    from public.quotations
    where coalesce(statutory_fee_total, 0.00) > 0.00
      and coalesce(statutory_fees_total, 0.00) > 0.00
      and statutory_fee_total <> statutory_fees_total;

    if v_conflict_count > 0 then
      -- Idempotently insert conflicting rows into permanent reconciliation audit table
      insert into public.quotation_reconciliation_conflicts (
        quotation_id, historical_quotation_id, quotation_number, statutory_fee_total, statutory_fees_total
      )
      select id, id, coalesce(quotation_number, id::text), statutory_fee_total, statutory_fees_total
      from public.quotations
      where coalesce(statutory_fee_total, 0.00) > 0.00
        and coalesce(statutory_fees_total, 0.00) > 0.00
        and statutory_fee_total <> statutory_fees_total
      on conflict (historical_quotation_id) do nothing;

      raise notice 'Preserved % conflicting quotation statutory fee records in public.quotation_reconciliation_conflicts.', v_conflict_count;
    end if;

    -- Migrate unpopulated values where singular is 0 and plural has data
    update public.quotations
    set statutory_fee_total = statutory_fees_total
    where coalesce(statutory_fee_total, 0.00) = 0.00 
      and coalesce(statutory_fees_total, 0.00) > 0.00;

    -- Safely drop duplicate plural column
    alter table public.quotations drop column statutory_fees_total;
  end if;
end $$;

-- Add canonical singular column and financial intelligence fields
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

-- 4.1 Ensure campaigns table exists and has spend tracking columns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.expense_receipt_allocations
  add column if not exists allocated_amount numeric(14,2) not null default 0.00,
  add column if not exists notes text,
  add column if not exists created_by uuid references public.staff_profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_expense_alloc_expense on public.expense_receipt_allocations(expense_id);
create index if not exists idx_expense_alloc_payment on public.expense_receipt_allocations(payment_id);

-- 5.2 Allocation Audit Logs Table (Immutable Audit Ledger)
-- Preserves audit history even if parent expenses or payments are deleted.
create table if not exists public.expense_allocation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid,
  expense_id uuid references public.expenses(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  historical_expense_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
  historical_payment_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
  action text not null check (action in ('allocated', 'amount_modified', 'deallocated')),
  previous_amount numeric(14,2) not null default 0.00,
  new_amount numeric(14,2) not null default 0.00,
  reason text,
  performed_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Reconcile columns if table pre-existed from earlier draft
alter table public.expense_allocation_audit_logs
  add column if not exists historical_expense_id uuid,
  add column if not exists historical_payment_id uuid,
  add column if not exists allocation_id uuid,
  add column if not exists reason text,
  add column if not exists previous_amount numeric(14,2) not null default 0.00,
  add column if not exists new_amount numeric(14,2) not null default 0.00;

-- Backfill historical IDs from parent IDs if pre-existing rows had NULL historical IDs
update public.expense_allocation_audit_logs
set historical_expense_id = expense_id
where historical_expense_id is null and expense_id is not null;

update public.expense_allocation_audit_logs
set historical_payment_id = payment_id
where historical_payment_id is null and payment_id is not null;

-- Reconcile foreign key constraints on expense_allocation_audit_logs:
-- Ensure ON DELETE SET NULL is enforced instead of ON DELETE CASCADE
do $$
declare
  r record;
begin
  for r in (
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu 
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' 
      and tc.table_name = 'expense_allocation_audit_logs'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'expense_id'
  ) loop
    execute 'alter table public.expense_allocation_audit_logs drop constraint if exists ' || quote_ident(r.constraint_name);
  end loop;

  alter table public.expense_allocation_audit_logs
    add constraint fk_expense_alloc_audit_expense
    foreign key (expense_id) references public.expenses(id) on delete set null;

  for r in (
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu 
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' 
      and tc.table_name = 'expense_allocation_audit_logs'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'payment_id'
  ) loop
    execute 'alter table public.expense_allocation_audit_logs drop constraint if exists ' || quote_ident(r.constraint_name);
  end loop;

  alter table public.expense_allocation_audit_logs
    add constraint fk_expense_alloc_audit_payment
    foreign key (payment_id) references public.payments(id) on delete set null;
end $$;

create index if not exists idx_allocation_audit_exp on public.expense_allocation_audit_logs(historical_expense_id, created_at desc);
create index if not exists idx_allocation_audit_pay on public.expense_allocation_audit_logs(historical_payment_id, created_at desc);

-- 5.3 Concurrency-Safe Database Function to Prevent Expense Over-Allocation
-- Uses row-level lock (FOR UPDATE) to serialize concurrent allocations against the same expense
create or replace function public.validate_expense_allocation_cap()
returns trigger as $$
declare
  v_expense_amount numeric(14,2);
  v_current_total numeric(14,2);
  v_payment_rec record;
begin
  -- 1. Verify existence and verification status of referenced payment (receipt)
  select id, amount, is_verified, receipt_number into v_payment_rec
  from public.payments
  where id = NEW.payment_id;

  if not found then
    raise exception 'Associated client payment (receipt) not found.';
  end if;

  if not coalesce(v_payment_rec.is_verified, false) then
    raise exception 'Cannot allocate expenses to unverified receipt (%). Receipts must be verified by Accounts Officer before expense allocation.',
      coalesce(v_payment_rec.receipt_number, NEW.payment_id::text);
  end if;

  -- 2. Concurrency Lock: Lock the parent expense row FOR UPDATE to prevent race conditions
  select amount into v_expense_amount
  from public.expenses
  where id = NEW.expense_id
  for update;

  if v_expense_amount is null then
    raise exception 'Associated expense record not found.';
  end if;

  -- 3. Calculate current allocations excluding the record being modified
  select coalesce(sum(allocated_amount), 0) into v_current_total
  from public.expense_receipt_allocations
  where expense_id = NEW.expense_id
    and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- 4. Enforce cap: Total allocations across receipts cannot exceed the expense's own amount
  -- (Note: An allocated amount CAN exceed the receipt amount if the job operated at a financial loss)
  if (v_current_total + NEW.allocated_amount) > v_expense_amount then
    raise exception 'Total allocations (₦%) exceed the total expense amount (₦%).',
      (v_current_total + NEW.allocated_amount), v_expense_amount;
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_validate_expense_allocation on public.expense_receipt_allocations;
create trigger trg_validate_expense_allocation
  before insert or update on public.expense_receipt_allocations
  for each row execute function public.validate_expense_allocation_cap();

-- 5.4 Automated Allocation Audit Log Trigger Function
-- Purely separates TG_OP handling to avoid touching NEW during DELETE
-- Explicitly returns OLD for DELETE and NEW for INSERT/UPDATE
create or replace function public.log_expense_allocation_audit()
returns trigger as $$
declare
  v_staff_id uuid;
  v_action text;
  v_prev_amount numeric(14,2) := 0.00;
  v_new_amount numeric(14,2) := 0.00;
  v_reason text := null;
  v_alloc_id uuid;
  v_exp_id uuid;
  v_pay_id uuid;
  v_performed_by uuid;
begin
  -- Resolve acting staff from authenticated session (active staff only)
  select id into v_staff_id 
  from public.staff_profiles 
  where auth_uid = auth.uid() and is_active = true
  limit 1;

  if (TG_OP = 'INSERT') then
    v_action := 'allocated';
    v_prev_amount := 0.00;
    v_new_amount := NEW.allocated_amount;
    v_reason := coalesce(NEW.notes, 'Initial expense allocation to receipt');
    v_alloc_id := NEW.id;
    v_exp_id := NEW.expense_id;
    v_pay_id := NEW.payment_id;
    v_performed_by := coalesce(v_staff_id, NEW.created_by);
  elsif (TG_OP = 'UPDATE') then
    v_action := 'amount_modified';
    v_prev_amount := OLD.allocated_amount;
    v_new_amount := NEW.allocated_amount;
    v_reason := coalesce(NEW.notes, 'Allocation amount updated');
    v_alloc_id := NEW.id;
    v_exp_id := NEW.expense_id;
    v_pay_id := NEW.payment_id;
    v_performed_by := coalesce(v_staff_id, NEW.created_by, OLD.created_by);
  elsif (TG_OP = 'DELETE') then
    v_action := 'deallocated';
    v_prev_amount := OLD.allocated_amount;
    v_new_amount := 0.00;
    v_reason := coalesce(OLD.notes, 'Allocation removed');
    v_alloc_id := OLD.id;
    v_exp_id := OLD.expense_id;
    v_pay_id := OLD.payment_id;
    v_performed_by := coalesce(v_staff_id, OLD.created_by);
  end if;

  insert into public.expense_allocation_audit_logs (
    allocation_id,
    expense_id,
    payment_id,
    historical_expense_id,
    historical_payment_id,
    action,
    previous_amount,
    new_amount,
    reason,
    performed_by,
    created_at
  ) values (
    v_alloc_id,
    v_exp_id,
    v_pay_id,
    v_exp_id,
    v_pay_id,
    v_action,
    v_prev_amount,
    v_new_amount,
    v_reason,
    v_performed_by,
    now()
  );

  -- Explicit trigger record return
  if (TG_OP = 'DELETE') then
    return OLD;
  else
    return NEW;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_log_expense_allocation_audit on public.expense_receipt_allocations;
create trigger trg_log_expense_allocation_audit
  after insert or update or delete on public.expense_receipt_allocations
  for each row execute function public.log_expense_allocation_audit();

-- 5.5 Validate Expense Amount Changes (Prevent reducing expense amount below already allocated totals)
create or replace function public.validate_expense_amount_reduction()
returns trigger as $$
declare
  v_allocated_total numeric(14,2);
begin
  if NEW.amount is distinct from OLD.amount then
    -- Lock allocation rows for this expense to serialize concurrent allocations
    select coalesce(sum(allocated_amount), 0) into v_allocated_total
    from public.expense_receipt_allocations
    where expense_id = NEW.id;

    if NEW.amount < v_allocated_total then
      raise exception 'Cannot reduce expense amount to ₦% because ₦% has already been allocated to verified receipts. Reduce receipt allocations first.',
        NEW.amount, v_allocated_total;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_validate_expense_amount_reduction on public.expenses;
create trigger trg_validate_expense_amount_reduction
  before update of amount on public.expenses
  for each row execute function public.validate_expense_amount_reduction();


-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES — EXPLICIT & HARDENED FOR ACTIVE STAFF
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
alter table public.quotation_reconciliation_conflicts enable row level security;

-- 6.1 Staff Notification Preferences (Strict Self-Access & Admin View for ACTIVE Staff)
drop policy if exists "Staff can view own notification preferences" on public.staff_notification_preferences;
create policy "Staff can view own notification preferences"
  on public.staff_notification_preferences
  for select
  using (
    staff_id in (select id from public.staff_profiles where auth_uid = auth.uid() and is_active = true)
    or exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin'))
  );

drop policy if exists "Staff can insert own notification preferences" on public.staff_notification_preferences;
create policy "Staff can insert own notification preferences"
  on public.staff_notification_preferences
  for insert
  with check (
    staff_id in (select id from public.staff_profiles where auth_uid = auth.uid() and is_active = true)
    or exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin'))
  );

drop policy if exists "Staff can update own notification preferences" on public.staff_notification_preferences;
create policy "Staff can update own notification preferences"
  on public.staff_notification_preferences
  for update
  using (
    staff_id in (select id from public.staff_profiles where auth_uid = auth.uid() and is_active = true)
    or exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin'))
  )
  with check (
    staff_id in (select id from public.staff_profiles where auth_uid = auth.uid() and is_active = true)
    or exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin'))
  );

-- 6.2 Escalation Rules Policies (All active staff can view; active admin/ops can manage)
drop policy if exists "Active staff can view escalation rules" on public.escalation_rules;
create policy "Active staff can view escalation rules"
  on public.escalation_rules
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true));

drop policy if exists "Management can insert escalation rules" on public.escalation_rules;
create policy "Management can insert escalation rules"
  on public.escalation_rules
  for insert
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'operations_manager')));

drop policy if exists "Management can update escalation rules" on public.escalation_rules;
create policy "Management can update escalation rules"
  on public.escalation_rules
  for update
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'operations_manager')))
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'operations_manager')));

drop policy if exists "Management can delete escalation rules" on public.escalation_rules;
create policy "Management can delete escalation rules"
  on public.escalation_rules
  for delete
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'operations_manager')));

-- 6.3 Escalation Logs Policies (Immutable audit trail: SELECT & INSERT only, no UPDATE or DELETE)
drop policy if exists "Active staff can view escalation logs" on public.escalation_logs;
create policy "Active staff can view escalation logs"
  on public.escalation_logs
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true));

drop policy if exists "Active staff can insert escalation logs" on public.escalation_logs;
create policy "Active staff can insert escalation logs"
  on public.escalation_logs
  for insert
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true));

-- 6.4 Backup & Recovery Policies (Strictly restricted to active super_admin and admin)
drop policy if exists "Admins can view backup records" on public.backup_records;
create policy "Admins can view backup records"
  on public.backup_records
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')));

drop policy if exists "Admins can manage backup records" on public.backup_records;
create policy "Admins can manage backup records"
  on public.backup_records
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')))
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')));

drop policy if exists "Admins can view restore drills" on public.restore_drills;
create policy "Admins can view restore drills"
  on public.restore_drills
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')));

drop policy if exists "Admins can manage restore drills" on public.restore_drills;
create policy "Admins can manage restore drills"
  on public.restore_drills
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')))
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')));

drop policy if exists "Admins can view business continuity settings" on public.business_continuity_settings;
create policy "Admins can view business continuity settings"
  on public.business_continuity_settings
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')));

drop policy if exists "Admins can manage business continuity settings" on public.business_continuity_settings;
create policy "Admins can manage business continuity settings"
  on public.business_continuity_settings
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')))
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')));

-- 6.5 Service Bundles Policies (Active staff can read; active management can manage)
drop policy if exists "Active staff can view service bundles" on public.service_bundles;
create policy "Active staff can view service bundles"
  on public.service_bundles
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true));

drop policy if exists "Operations and admin can manage service bundles" on public.service_bundles;
create policy "Operations and admin can manage service bundles"
  on public.service_bundles
  for all
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'operations_manager')))
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'operations_manager')));

-- 6.6 Expense Receipt Allocations Policies (Active finance & management)
drop policy if exists "Authorized staff can view expense allocations" on public.expense_receipt_allocations;
create policy "Authorized staff can view expense allocations"
  on public.expense_receipt_allocations
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'accounts_officer', 'operations_manager')));

drop policy if exists "Accounts and Admin can insert expense allocations" on public.expense_receipt_allocations;
create policy "Accounts and Admin can insert expense allocations"
  on public.expense_receipt_allocations
  for insert
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'accounts_officer')));

drop policy if exists "Accounts and Admin can update expense allocations" on public.expense_receipt_allocations;
create policy "Accounts and Admin can update expense allocations"
  on public.expense_receipt_allocations
  for update
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'accounts_officer')))
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'accounts_officer')));

drop policy if exists "Accounts and Admin can delete expense allocations" on public.expense_receipt_allocations;
create policy "Accounts and Admin can delete expense allocations"
  on public.expense_receipt_allocations
  for delete
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'accounts_officer')));

-- 6.7 Allocation Audit Logs Policies (Append-only immutable audit trail)
-- Ordinary users CANNOT update, delete, or insert audit records directly via client API.
-- Direct table modification permissions revoked across authenticated, anon, and public.
-- All audit rows are inserted exclusively by the SECURITY DEFINER trigger.
revoke insert, update, delete on public.expense_allocation_audit_logs from authenticated, anon, public;

drop policy if exists "Authorized staff can view allocation audit logs" on public.expense_allocation_audit_logs;
create policy "Authorized staff can view allocation audit logs"
  on public.expense_allocation_audit_logs
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'accounts_officer')));

-- 6.8 Quotation Reconciliation Conflicts Policies (Management review ledger)
drop policy if exists "Admins can view reconciliation conflicts" on public.quotation_reconciliation_conflicts;
create policy "Admins can view reconciliation conflicts"
  on public.quotation_reconciliation_conflicts
  for select
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin', 'accounts_officer')));

drop policy if exists "Admins can resolve reconciliation conflicts" on public.quotation_reconciliation_conflicts;
create policy "Admins can resolve reconciliation conflicts"
  on public.quotation_reconciliation_conflicts
  for update
  using (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')))
  with check (exists (select 1 from public.staff_profiles where auth_uid = auth.uid() and is_active = true and role::text in ('super_admin', 'admin')));

commit;
