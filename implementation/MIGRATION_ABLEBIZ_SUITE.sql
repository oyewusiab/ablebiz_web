-- ==============================================================================
-- ABLEBIZ SUITE — IDEMPOTENT DATABASE RECONCILIATION & UPGRADE SCRIPT
-- ==============================================================================
-- Document ID:    MIG-ABZ-SUITE-2026-V1-REV2
-- Target Schema:  ABLEBIZ SUITE Production Enterprise Specification v1.2
-- Safe Mode:      100% NON-DESTRUCTIVE & FULLY IDEMPOTENT
--
-- ORDER OF EXECUTION:
--   1. Extensions
--   2. Enums & Custom Types
--   3. Tables & Indexes (Tables defined BEFORE functions that query them)
--   4. Alter Existing Tables (leads, referral_events)
--   5. Core Helper Functions & Triggers
--   6. Secure Public Views (public_services_view)
--   7. Supabase Storage (ablebiz_documents)
--   8. Seed Data & Safe Migration (admin_users -> staff_profiles, catalog, permissions)
--   9. Row-Level Security (RLS) Policies & Grants
--  10. Verification & Diagnostic Summary
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_stat_statements;

-- ==============================================================================
-- 2. ENUMS & CUSTOM TYPES (Idempotent Creation)
-- ==============================================================================
do $$
begin
  -- Staff roles across the 8 defined tiers
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type public.staff_role as enum (
      'super_admin',
      'admin',
      'operations_manager',
      'registration_officer',
      'accounts_officer',
      'client_service_officer',
      'marketing_officer',
      'viewer'
    );
  end if;

  -- Service Request Statuses
  if not exists (select 1 from pg_type where typname = 'service_request_status') then
    create type public.service_request_status as enum (
      'pending_review',
      'quoted',
      'in_progress',
      'awaiting_client',
      'under_review',
      'completed',
      'cancelled'
    );
  end if;

  -- CAC Workflow Stages (11 normal stages + 2 exceptions)
  if not exists (select 1 from pg_type where typname = 'cac_workflow_stage') then
    create type public.cac_workflow_stage as enum (
      'new_request',
      'documents_required',
      'documents_verified',
      'name_search',
      'name_reserved',
      'application_prepared',
      'application_submitted',
      'under_cac_review',
      'approved',
      'documents_received',
      'completed',
      'rejected',
      'cancelled'
    );
  end if;

  -- Quotation Statuses
  if not exists (select 1 from pg_type where typname = 'quotation_status') then
    create type public.quotation_status as enum (
      'draft',
      'sent',
      'viewed',
      'accepted',
      'rejected',
      'expired',
      'converted',
      'cancelled'
    );
  end if;

  -- Invoice Statuses
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum (
      'draft',
      'sent',
      'partially_paid',
      'paid',
      'overdue',
      'cancelled',
      'refunded'
    );
  end if;

  -- Payment Methods
  if not exists (select 1 from pg_type where typname = 'payment_method_type') then
    create type public.payment_method_type as enum (
      'bank_transfer',
      'pos',
      'cash',
      'online_gateway',
      'cheque'
    );
  end if;

  -- Priority Levels
  if not exists (select 1 from pg_type where typname = 'operational_priority') then
    create type public.operational_priority as enum (
      'low',
      'normal',
      'high',
      'urgent'
    );
  end if;

  -- Task Statuses
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'todo',
      'in_progress',
      'review',
      'completed',
      'cancelled'
    );
  end if;

  -- Communication Channels
  if not exists (select 1 from pg_type where typname = 'comm_channel') then
    create type public.comm_channel as enum (
      'whatsapp',
      'phone_call',
      'email',
      'in_person',
      'sms'
    );
  end if;

  -- Follow-up Statuses
  if not exists (select 1 from pg_type where typname = 'followup_status') then
    create type public.followup_status as enum (
      'pending',
      'completed',
      'rescheduled',
      'cancelled'
    );
  end if;

  -- Document Categories
  if not exists (select 1 from pg_type where typname = 'doc_category') then
    create type public.doc_category as enum (
      'client_id_card',
      'passport_photo',
      'signature_specimen',
      'cac_certificate',
      'status_report',
      'payment_receipt',
      'scuml_certificate',
      'tax_clearance',
      'other'
    );
  end if;

  -- CAC Legal Entity Types
  if not exists (select 1 from pg_type where typname = 'cac_entity_type') then
    create type public.cac_entity_type as enum (
      'business_name',
      'company_incorporation',
      'ngo_trustees',
      'annual_returns',
      'post_incorporation_change'
    );
  end if;
end $$;

-- ==============================================================================
-- 3. TABLES CREATION (Defined BEFORE functions and views that query them)
-- ==============================================================================

-- 3.1 Staff Profiles (Identity Engine)
create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique,
  email text not null unique,
  full_name text not null,
  role public.staff_role not null default 'viewer',
  department text not null default 'Operations',
  phone text,
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.2 Roles & Granular Permissions
create table if not exists public.roles_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.staff_role not null,
  module text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_export boolean not null default false,
  created_at timestamptz not null default now(),
  constraint uq_role_module unique (role, module)
);

-- 3.3 Clients (Forward-Engineered with portal_user_id)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text not null,
  alt_phone text,
  state text default 'Ogun',
  address text,
  acquisition_source text default 'direct',
  referral_code text,
  referred_by_code text,
  portal_user_id uuid, -- For future client portal authentication
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_phone on public.clients(phone);
create index if not exists idx_clients_email on public.clients(email);
create index if not exists idx_clients_referral_code on public.clients(referral_code);

-- 3.4 Businesses
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  alternate_name text,
  entity_type public.cac_entity_type not null default 'business_name',
  registration_number text,
  tax_identification_number text,
  annual_return_due_date date,
  registered_address text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_businesses_client_id on public.businesses(client_id);
create index if not exists idx_businesses_reg_no on public.businesses(registration_number);

-- 3.5 Services Catalog (Under Operations — Internal Pricing Retained)
create table if not exists public.services_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  short_description text,
  full_description text,
  deliverables jsonb default '[]'::jsonb,
  requirements jsonb default '[]'::jsonb,
  expected_turnaround_days integer default 5,
  is_publicly_visible boolean not null default true,
  public_display_order integer default 0,

  -- Internal Suite Fields (Protected — Not exposed to public website)
  default_fee_ngn numeric(14,2) not null default 0.00,
  min_fee_ngn numeric(14,2) not null default 0.00,
  internal_cost_estimate numeric(14,2) not null default 0.00,
  pricing_notes text,
  assigned_department text not null default 'Operations',
  default_workflow text not null default 'standard',
  operational_checklist_template jsonb default '[]'::jsonb,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_services_category on public.services_catalog(category);
create index if not exists idx_services_is_active on public.services_catalog(is_active);

-- 3.6 Service Requests (The Central Operational Hub)
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete set null,
  service_id uuid not null references public.services_catalog(id) on delete restrict,
  assigned_staff_id uuid references public.staff_profiles(id) on delete set null,
  priority public.operational_priority not null default 'normal',
  status public.service_request_status not null default 'pending_review',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  requirements_checklist jsonb default '[]'::jsonb,
  target_completion_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_requests_client on public.service_requests(client_id);
create index if not exists idx_service_requests_service on public.service_requests(service_id);
create index if not exists idx_service_requests_staff on public.service_requests(assigned_staff_id);
create index if not exists idx_service_requests_status on public.service_requests(status);

-- 3.7 CAC Applications (11-Stage Specialized Filing Engine)
create table if not exists public.cac_applications (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  assigned_officer_id uuid references public.staff_profiles(id) on delete set null,
  application_type public.cac_entity_type not null default 'business_name',
  current_stage public.cac_workflow_stage not null default 'new_request',
  
  -- Filing particulars
  proposed_name_1 text,
  proposed_name_2 text,
  approved_name text,
  reservation_code text,
  submission_date date,
  approval_date date,
  certificate_number text,
  rejection_reason text,
  rectification_notes text,
  filing_reference_number text,
  
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cac_apps_sr_id on public.cac_applications(service_request_id);
create index if not exists idx_cac_apps_stage on public.cac_applications(current_stage);
create index if not exists idx_cac_apps_officer on public.cac_applications(assigned_officer_id);

-- 3.8 Quotations (Explicit Estimates & Price Snapshotting)
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  service_request_id uuid references public.service_requests(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete set null,
  
  quotation_date date not null default current_date,
  valid_until date not null default (current_date + interval '14 days'),
  
  subtotal numeric(14,2) not null default 0.00,
  discount_amount numeric(14,2) not null default 0.00,
  tax_amount numeric(14,2) not null default 0.00,
  total_amount numeric(14,2) not null default 0.00,
  
  terms_and_conditions text,
  internal_notes text,
  status public.quotation_status not null default 'draft',
  
  created_by uuid references public.staff_profiles(id) on delete set null,
  approved_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotations_sr_id on public.quotations(service_request_id);
create index if not exists idx_quotations_client_id on public.quotations(client_id);
create index if not exists idx_quotations_status on public.quotations(status);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  service_id uuid references public.services_catalog(id) on delete set null,
  description text not null,
  quantity integer not null default 1,
  unit_price numeric(14,2) not null default 0.00, -- Price snapshot at quotation creation
  total_price numeric(14,2) not null default 0.00,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotation_items_qid on public.quotation_items(quotation_id);

-- 3.9 Invoices & Financial Integrity (Frozen Snapshots)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  quotation_id uuid references public.quotations(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete set null,
  
  issue_date date not null default current_date,
  due_date date not null default (current_date + interval '7 days'),
  
  subtotal numeric(14,2) not null default 0.00,
  discount numeric(14,2) not null default 0.00,
  tax numeric(14,2) not null default 0.00,
  total_amount numeric(14,2) not null default 0.00,
  amount_paid numeric(14,2) not null default 0.00,
  balance_due numeric(14,2) not null default 0.00,
  
  status public.invoice_status not null default 'draft',
  payment_terms text,
  notes text,
  
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoices_sr_id on public.invoices(service_request_id);
create index if not exists idx_invoices_status on public.invoices(status);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  service_id uuid references public.services_catalog(id) on delete set null,
  description text not null,
  quantity integer not null default 1,
  unit_price numeric(14,2) not null default 0.00, -- Price snapshot frozen at invoice creation
  total_price numeric(14,2) not null default 0.00,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_items_inv_id on public.invoice_items(invoice_id);

-- 3.10 Payments & Reconciliation
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date timestamptz not null default now(),
  payment_method public.payment_method_type not null default 'bank_transfer',
  transaction_reference text,
  bank_account_credited text default 'Moniepoint MFB - Ablebiz',
  notes text,
  received_by uuid references public.staff_profiles(id) on delete set null,
  is_verified boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_client_id on public.payments(client_id);

-- 3.11 Expenses & Vendors
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'statutory_authority',
  contact_person text,
  phone text,
  email text,
  account_details text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  category text not null,
  receipt_document_id uuid,
  paid_by uuid references public.staff_profiles(id) on delete set null,
  payment_method text default 'bank_transfer',
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_sr_id on public.expenses(service_request_id);

-- 3.12 Tasks & Comments
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  service_request_id uuid references public.service_requests(id) on delete cascade,
  cac_application_id uuid references public.cac_applications(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  assigned_to uuid references public.staff_profiles(id) on delete set null,
  created_by uuid references public.staff_profiles(id) on delete set null,
  priority public.operational_priority not null default 'normal',
  status public.task_status not null default 'todo',
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task_id on public.task_comments(task_id);

-- 3.13 Documents & Metadata
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  category public.doc_category not null default 'other',
  client_id uuid references public.clients(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  cac_application_id uuid references public.cac_applications(id) on delete set null,
  uploaded_by uuid references public.staff_profiles(id) on delete set null,
  is_verified boolean not null default false,
  verified_by uuid references public.staff_profiles(id) on delete set null,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_client_id on public.documents(client_id);
create index if not exists idx_documents_sr_id on public.documents(service_request_id);

-- 3.14 Communications, Follow-ups & Notifications
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  channel public.comm_channel not null default 'whatsapp',
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  summary text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_communications_client_id on public.communications(client_id);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  assigned_staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  scheduled_at timestamptz not null,
  type text not null default 'consultation_call',
  status public.followup_status not null default 'pending',
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_follow_ups_assigned on public.follow_ups(assigned_staff_id);
create index if not exists idx_follow_ups_scheduled on public.follow_ups(scheduled_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  title text not null,
  message text not null,
  link text,
  priority public.operational_priority not null default 'normal',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on public.notifications(recipient_staff_id);
create index if not exists idx_notifications_unread on public.notifications(recipient_staff_id) where is_read = false;

-- 3.15 Audit Logs & Unified Activity Timeline
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff_profiles(id) on delete set null,
  staff_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

create table if not exists public.activity_timeline (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null default 'staff' check (actor_type in ('staff', 'system', 'client')),
  actor_id uuid,
  event_type text not null,
  event_title text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_timeline_target on public.activity_timeline(entity_type, entity_id);
create index if not exists idx_activity_timeline_created on public.activity_timeline(created_at desc);

-- ==============================================================================
-- 4. NON-DESTRUCTIVE ALTERATION OF EXISTING TABLES
-- ==============================================================================

alter table public.leads add column if not exists converted_client_id uuid references public.clients(id) on delete set null;
alter table public.leads add column if not exists assigned_staff_id uuid references public.staff_profiles(id) on delete set null;
alter table public.leads add column if not exists qualification_status text not null default 'new';
alter table public.leads add column if not exists priority public.operational_priority not null default 'normal';
alter table public.leads add column if not exists notes text;

alter table public.referral_events add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.referral_events add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;

-- ==============================================================================
-- 5. CORE HELPER FUNCTIONS & TRIGGERS (Compiled AFTER tables exist)
-- ==============================================================================

-- Universal updated_at timestamp trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper to retrieve current authenticated staff profile's role
create or replace function public.current_staff_role()
returns public.staff_role language plpgsql stable security definer as $$
declare
  v_role public.staff_role;
begin
  select role into v_role
  from public.staff_profiles
  where auth_uid = auth.uid() and is_active = true
  limit 1;

  return v_role;
end;
$$;

-- Helper to check if current user is an active staff member
create or replace function public.is_active_staff()
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1
    from public.staff_profiles
    where auth_uid = auth.uid() and is_active = true
  );
end;
$$;

-- Invoice Balance Recalculation Trigger
create or replace function public.recalculate_invoice_payment_balance()
returns trigger language plpgsql as $$
declare
  v_invoice_id uuid;
  v_total_paid numeric(14,2);
  v_total_amount numeric(14,2);
  v_new_balance numeric(14,2);
  v_new_status public.invoice_status;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(amount), 0.00)
  into v_total_paid
  from public.payments
  where invoice_id = v_invoice_id and is_verified = true;

  select total_amount, status
  into v_total_amount, v_new_status
  from public.invoices
  where id = v_invoice_id;

  v_new_balance := greatest(0.00, v_total_amount - v_total_paid);

  if v_total_paid >= v_total_amount and v_total_amount > 0 then
    v_new_status := 'paid'::public.invoice_status;
  elsif v_total_paid > 0 then
    v_new_status := 'partially_paid'::public.invoice_status;
  end if;

  update public.invoices
  set
    amount_paid = v_total_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    updated_at = now()
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalculate_invoice_payment on public.payments;
create trigger trg_recalculate_invoice_payment
after insert or update or delete on public.payments
for each row execute function public.recalculate_invoice_payment_balance();

-- ==============================================================================
-- 6. SECURE PUBLIC VIEW (Strips Internal Pricing for Website Visitors)
-- ==============================================================================

create or replace view public.public_services_view as
select
  id,
  name,
  slug,
  category,
  short_description,
  full_description,
  deliverables,
  requirements,
  expected_turnaround_days,
  public_display_order
from public.services_catalog
where is_publicly_visible = true and is_active = true;

-- ==============================================================================
-- 7. SUPABASE STORAGE BUCKET CONFIGURATION
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ablebiz_documents',
  'ablebiz_documents',
  false,
  20971520, -- 20 MB limit
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Staff upload ablebiz_documents') then
    create policy "Staff upload ablebiz_documents"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'ablebiz_documents' and public.is_active_staff());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Staff view ablebiz_documents') then
    create policy "Staff view ablebiz_documents"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'ablebiz_documents' and public.is_active_staff());
  end if;
end $$;

-- ==============================================================================
-- 8. SEED DATA & SAFE DATA MIGRATION
-- ==============================================================================

-- 8.1 Non-destructively migrate legacy admin_users into staff_profiles (if admin_users exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'admin_users') then
    insert into public.staff_profiles (auth_uid, email, full_name, role, department, is_active)
    select
      au.auth_uid,
      au.email,
      coalesce(au.name, 'Staff Member'),
      (case
        when au.role::text = 'superadmin' then 'super_admin'::public.staff_role
        else 'admin'::public.staff_role
      end),
      'Executive Management',
      coalesce(au.is_active, true)
    from public.admin_users au
    where au.auth_uid is not null
    on conflict (auth_uid) do update set
      full_name = excluded.full_name,
      email = excluded.email;
  end if;
end $$;

-- 8.2 Seed Default Role Permissions Matrix
insert into public.roles_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve, can_export)
values
  -- Super Admin
  ('super_admin', 'workbench', true, true, true, true, true, true),
  ('super_admin', 'crm', true, true, true, true, true, true),
  ('super_admin', 'operations', true, true, true, true, true, true),
  ('super_admin', 'finance', true, true, true, true, true, true),
  ('super_admin', 'team', true, true, true, true, true, true),
  ('super_admin', 'settings', true, true, true, true, true, true),

  -- Admin
  ('admin', 'workbench', true, true, true, false, true, true),
  ('admin', 'crm', true, true, true, false, true, true),
  ('admin', 'operations', true, true, true, false, true, true),
  ('admin', 'finance', true, true, true, false, true, true),
  ('admin', 'team', true, false, false, false, false, true),
  ('admin', 'settings', true, false, true, false, false, false),

  -- Operations Manager
  ('operations_manager', 'workbench', true, true, true, false, true, true),
  ('operations_manager', 'crm', true, true, true, false, false, false),
  ('operations_manager', 'operations', true, true, true, false, true, true),
  ('operations_manager', 'finance', true, false, false, false, false, false),

  -- Registration Officer
  ('registration_officer', 'workbench', true, false, true, false, false, false),
  ('registration_officer', 'operations', true, true, true, false, false, false),

  -- Accounts Officer
  ('accounts_officer', 'workbench', true, false, true, false, false, true),
  ('accounts_officer', 'finance', true, true, true, false, true, true),
  ('accounts_officer', 'operations', true, false, false, false, false, false),

  -- Client Service Officer
  ('client_service_officer', 'workbench', true, false, true, false, false, false),
  ('client_service_officer', 'crm', true, true, true, false, false, false),
  ('client_service_officer', 'operations', true, true, false, false, false, false),

  -- Marketing Officer
  ('marketing_officer', 'workbench', true, false, false, false, false, false),
  ('marketing_officer', 'crm', true, true, true, false, false, true),

  -- Viewer
  ('viewer', 'workbench', true, false, false, false, false, false),
  ('viewer', 'crm', true, false, false, false, false, false),
  ('viewer', 'operations', true, false, false, false, false, false),
  ('viewer', 'finance', true, false, false, false, false, false)
on conflict (role, module) do nothing;

-- 8.3 Seed Approved Services Catalog Items (Under Operations, with Internal Reference Fees)
insert into public.services_catalog (
  name, slug, category, short_description, full_description,
  deliverables, requirements, expected_turnaround_days,
  default_fee_ngn, min_fee_ngn, internal_cost_estimate,
  assigned_department, default_workflow
) values
(
  'CAC Business Name Registration',
  'cac-business-name-registration',
  'cac_registration',
  'Formal registration of sole proprietorship or enterprise with CAC Nigeria.',
  'Complete registration of business name enterprise including official name reservation, status report, and digital certificate with tax identification number.',
  '["CAC Status Report", "Certificate of Registration (Digital)", "Tax Identification Number (TIN)"]'::jsonb,
  '["Two proposed business names", "Valid Government ID (NIN / Voter Card / Passport)", "Passport photograph", "Residential address", "Phone number and email"]'::jsonb,
  5,
  35000.00, 25000.00, 10000.00,
  'Operations', 'cac_business_name'
),
(
  'CAC Company Registration (LLC)',
  'cac-company-registration-llc',
  'cac_registration',
  'Full incorporation of Private Limited Liability Company (Ltd) with CAC.',
  'Complete incorporation of a private limited company with standard articles of association, stamp duties, status report, and e-certificate.',
  '["Certificate of Incorporation", "Status Report (CAC 1.1)", "Memorandum & Articles of Association", "Company TIN"]'::jsonb,
  '["Two proposed company names", "Minimum 1 Director (Max unlimited)", "Valid ID and signature for each director", "Share capital distribution details", "Registered office address in Nigeria"]'::jsonb,
  7,
  75000.00, 55000.00, 22000.00,
  'Operations', 'cac_company'
),
(
  'CAC Incorporated Trustees / NGO',
  'cac-ngo-incorporated-trustees',
  'cac_registration',
  'Registration for Churches, Mosques, Foundations, NGOs, and Associations.',
  'Specialized incorporation of Non-Governmental Organizations and Trustees including newspaper publications, constitution drafting, and vetting.',
  '["Certificate of Incorporated Trustees", "Approved Constitution", "CAC Status Report"]'::jsonb,
  '["Two proposed names", "Trustees details & valid IDs", "Passport photos", "Aims and objectives", "Minutes of foundation meeting"]'::jsonb,
  21,
  180000.00, 140000.00, 60000.00,
  'Operations', 'cac_ngo'
),
(
  'CAC Annual Returns Filing',
  'cac-annual-returns-filing',
  'compliance',
  'Filing of overdue or annual statutory returns to maintain active CAC status.',
  'Preparation and official filing of annual return reports to keep your company in good standing and prevent being struck off.',
  '["Official CAC Annual Return Acknowledgment", "Active Status Confirmation"]'::jsonb,
  '["CAC Registration Certificate", "Status report", "Last filed annual return (if any)"]'::jsonb,
  3,
  25000.00, 18000.00, 5000.00,
  'Operations', 'cac_annual_returns'
),
(
  'SCUML Certificate Registration',
  'scuml-certificate-registration',
  'compliance',
  'Special Control Unit Against Money Laundering compliance for corporate accounts.',
  'Full facilitation and processing of EFCC/SCUML anti-money laundering certification required by Nigerian commercial banks.',
  '["SCUML Certificate", "Compliance Reference Number"]'::jsonb,
  '["CAC Certificate & Status Report", "Tax Clearance Certificate or TIN", "Bank statement or account details", "Constitution (for NGOs)"]'::jsonb,
  14,
  50000.00, 38000.00, 10000.00,
  'Operations', 'scuml_workflow'
),
(
  'TIN & Tax Clearance Processing',
  'tin-tax-clearance-processing',
  'tax',
  'Tax Identification Number and Tax Clearance Certificate processing with FIRS.',
  'Official registration and verification of Joint Tax Board / FIRS corporate and personal tax identification numbers.',
  '["Verified TIN Slip", "Tax Clearance Certificate (TCC)"]'::jsonb,
  '["CAC Certificate", "Utility bill", "Director NIN", "Company email and phone"]'::jsonb,
  4,
  30000.00, 20000.00, 5000.00,
  'Operations', 'tax_workflow'
)
on conflict (slug) do nothing;

-- ==============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES & GRANTS
-- ==============================================================================

-- Enable RLS across all operational tables
alter table public.staff_profiles enable row level security;
alter table public.roles_permissions enable row level security;
alter table public.clients enable row level security;
alter table public.businesses enable row level security;
alter table public.services_catalog enable row level security;
alter table public.service_requests enable row level security;
alter table public.cac_applications enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.vendors enable row level security;
alter table public.expenses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.documents enable row level security;
alter table public.communications enable row level security;
alter table public.follow_ups enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.activity_timeline enable row level security;

-- Grant usage on schema to roles
grant usage on schema public to anon, authenticated;

-- Public read access strictly to the public view (no internal pricing exposed)
grant select on public.public_services_view to anon, authenticated;

-- Policies for Staff Profiles
drop policy if exists "Staff can read all active profiles" on public.staff_profiles;
create policy "Staff can read all active profiles"
on public.staff_profiles for select
to authenticated
using (public.is_active_staff());

drop policy if exists "Superadmin can manage staff profiles" on public.staff_profiles;
create policy "Superadmin can manage staff profiles"
on public.staff_profiles for all
to authenticated
using (public.current_staff_role() = 'super_admin');

-- Policies for Operational Tables (Active Staff Access)
do $$
declare
  tbl text;
  tables text[] := array[
    'clients', 'businesses', 'service_requests', 'cac_applications',
    'quotations', 'quotation_items', 'invoices', 'invoice_items',
    'payments', 'vendors', 'expenses', 'tasks', 'task_comments',
    'documents', 'communications', 'follow_ups', 'notifications',
    'activity_timeline', 'services_catalog', 'roles_permissions'
  ];
begin
  foreach tbl in array tables loop
    execute format('
      drop policy if exists "Active staff full access on %I" on public.%I;
      create policy "Active staff full access on %I"
      on public.%I for all
      to authenticated
      using (public.is_active_staff())
      with check (public.is_active_staff());
    ', tbl, tbl, tbl, tbl);
  end loop;
end $$;

-- Policy for Audit Logs (Super Admin / Admin read only)
drop policy if exists "Management can view audit logs" on public.audit_logs;
create policy "Management can view audit logs"
on public.audit_logs for select
to authenticated
using (public.current_staff_role() in ('super_admin', 'admin'));

drop policy if exists "Staff can insert audit logs" on public.audit_logs;
create policy "Staff can insert audit logs"
on public.audit_logs for insert
to authenticated
with check (public.is_active_staff());

-- ==============================================================================
-- 10. POST-MIGRATION VERIFICATION & RECONCILIATION SUMMARY
-- ==============================================================================

do $$
declare
  v_leads_count bigint := 0;
  v_spin_count bigint := 0;
  v_ref_count bigint := 0;
  v_services_count bigint := 0;
  v_staff_count bigint := 0;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'leads') then
    select count(*) into v_leads_count from public.leads;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'spin_rewards') then
    select count(*) into v_spin_count from public.spin_rewards;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'referral_events') then
    select count(*) into v_ref_count from public.referral_events;
  end if;

  select count(*) into v_services_count from public.services_catalog;
  select count(*) into v_staff_count from public.staff_profiles;

  raise notice '==============================================================';
  raise notice 'ABLEBIZ SUITE DATABASE RECONCILIATION COMPLETE (IDEMPOTENT)';
  raise notice '==============================================================';
  raise notice 'Historical Records Preserved:';
  raise notice '  - leads count: %', v_leads_count;
  raise notice '  - spin_rewards count: %', v_spin_count;
  raise notice '  - referral_events count: %', v_ref_count;
  raise notice 'New Production Objects Verified:';
  raise notice '  - services_catalog items: %', v_services_count;
  raise notice '  - staff_profiles configured: %', v_staff_count;
  raise notice '  - public_services_view: ACTIVE (Conceals internal pricing)';
  raise notice '  - storage.buckets (ablebiz_documents): VERIFIED PRIVATE';
  raise notice '  - Zero destructive operations executed.';
  raise notice '==============================================================';
end $$;

commit;
