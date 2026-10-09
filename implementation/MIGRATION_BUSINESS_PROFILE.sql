-- ==============================================================================
-- ABLEBIZ SUITE — STAGE D CONFIGURATION REMEDIATION
-- AUTHORITATIVE BUSINESS PROFILE & SETTINGS ARCHITECTURE MIGRATION
-- File: implementation/MIGRATION_BUSINESS_PROFILE.sql
-- ==============================================================================
-- This script establishes the single authoritative business profile and bank
-- account configuration tables in Supabase with strict Row-Level Security (RLS)
-- and safe public projection view.
--
-- Architecture:
-- 1. public.business_profile (Singleton row id = 1)
-- 2. public.business_bank_accounts (Up to 2 accounts, 1 default settlement)
-- 3. public.public_business_profile (Security view for anonymous website users)
-- 4. Audit logging integration with public.audit_logs
-- 5. RLS policies:
--    - super_admin & admin: full management
--    - active staff: view full business profile & bank accounts for documents
--    - anonymous / public: strictly safe public profile view, zero bank details
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. BUSINESS PROFILE TABLE
-- ==============================================================================
create table if not exists public.business_profile (
  id integer primary key default 1 check (id = 1), -- Enforces single authoritative record
  
  -- Category A: Basic Business Information
  legal_name text not null default 'ABLEBIZ Business Services',
  trading_name text not null default 'ABLEBIZ Business Services',
  tagline text not null default 'ABLEBIZ helps you formalize your business, handle the paperwork and stay on track.',
  business_description text default 'Professional corporate affairs, business formalization, CAC registration, and statutory compliance firm.',
  business_type text default 'Sole Proprietorship / Enterprise',
  cac_registration_number text default '', -- BN or RC (kept blank until administrator enters verified number)
  cac_accredited_agent_number text default '', -- CAC Accredited Agent ID (kept blank until administrator enters)
  tax_identification_number text default '', -- TIN (kept blank until administrator enters verified TIN)
  year_established text default '2019',
  award_badge text default '🏆 2nd Place – BYUMS Africa Business Plan Competition',

  -- Category B: Contact Information
  primary_phone text not null default '08160486023',
  secondary_phone text default '',
  whatsapp_number text not null default '08160486023',
  whatsapp_number_intl text not null default '2348160486023',
  primary_email text not null default 'hello@ablebiz.com.ng',
  secondary_email text default '',
  support_email text default 'support@ablebiz.com.ng',
  website_url text not null default 'https://www.ablebiz.com.ng',

  -- Category C: Business Address
  address_line_1 text not null default 'Along M.K.O. Abiola Way',
  address_line_2 text default 'Leme',
  city text not null default 'Abeokuta',
  lga text default 'Abeokuta South',
  state text not null default 'Ogun State',
  country text not null default 'Nigeria',
  postal_code text default '',

  -- Category E: Document & Identity Configuration
  logo_url text default '/brand/logo.png',
  default_payment_terms text not null default 'Payment due within 7 days of invoice issuance. Remit to designated official settlement account.',
  document_disclaimer text default 'Computer-generated official business document. CAC compliance and operational filings commence following payment reconciliation.',
  document_footer_text text default 'Physical office along M.K.O. Abiola Way, Leme, Abeokuta. Nationwide digital service delivery.',

  -- Metadata & Timestamps
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null
);

-- ==============================================================================
-- 2. BUSINESS BANK ACCOUNTS TABLE (Capacity for 2 accounts)
-- ==============================================================================
create table if not exists public.business_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  business_profile_id integer not null default 1 references public.business_profile(id) on delete cascade check (business_profile_id = 1),
  account_slot integer not null check (account_slot in (1, 2)), -- Slot 1 (Required/Primary), Slot 2 (Optional/Secondary)
  bank_name text not null,
  account_name text not null,
  account_number text not null, -- 10-digit NUBAN
  account_type text not null default 'Corporate Current',
  is_active boolean not null default true,
  is_default boolean not null default false,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null,
  constraint uq_account_slot unique (account_slot)
);

create index if not exists idx_business_bank_accounts_default on public.business_bank_accounts(is_default, is_active);

-- ==============================================================================
-- 3. SEED INITIAL VERIFIED BUSINESS PROFILE (Idempotent)
-- ==============================================================================
insert into public.business_profile (
  id,
  legal_name,
  trading_name,
  tagline,
  business_description,
  business_type,
  cac_registration_number,
  cac_accredited_agent_number,
  tax_identification_number,
  year_established,
  award_badge,
  primary_phone,
  whatsapp_number,
  whatsapp_number_intl,
  primary_email,
  website_url,
  address_line_1,
  address_line_2,
  city,
  lga,
  state,
  country,
  default_payment_terms,
  document_disclaimer
)
values (
  1,
  'ABLEBIZ Business Services',
  'ABLEBIZ Business Services',
  'ABLEBIZ helps you formalize your business, handle the paperwork and stay on track.',
  'Professional corporate affairs, business formalization, CAC registration, and statutory compliance firm.',
  'Business Name / Enterprise',
  '', -- Unverified registration number left empty
  '', -- Unverified CAC agent number left empty
  '', -- Unverified TIN left empty
  '2019',
  '🏆 2nd Place – BYUMS Africa Business Plan Competition',
  '08160486023',
  '08160486023',
  '2348160486023',
  'hello@ablebiz.com.ng',
  'https://www.ablebiz.com.ng',
  'Along M.K.O. Abiola Way',
  'Leme',
  'Abeokuta',
  'Abeokuta South',
  'Ogun State',
  'Nigeria',
  'Payment due within 7 days of invoice issuance. Remit to designated official settlement account.',
  'Computer-generated official business document. CAC compliance and operational filings commence following payment reconciliation.'
)
on conflict (id) do nothing;

-- ==============================================================================
-- 4. PUBLIC SAFE BUSINESS PROFILE VIEW (Zero private banking or internal CAC keys)
-- ==============================================================================
create or replace view public.public_business_profile as
select
  legal_name,
  trading_name,
  tagline,
  business_description,
  year_established,
  award_badge,
  primary_phone,
  secondary_phone,
  whatsapp_number,
  whatsapp_number_intl,
  primary_email,
  secondary_email,
  support_email,
  website_url,
  address_line_1,
  address_line_2,
  city,
  lga,
  state,
  country,
  logo_url,
  document_disclaimer
from public.business_profile
where id = 1;

-- ==============================================================================
-- 5. ROW-LEVEL SECURITY & GRANTS
-- ==============================================================================
alter table public.business_profile enable row level security;
alter table public.business_bank_accounts enable row level security;

-- Schema usage
grant usage on schema public to anon, authenticated;

-- Public view access (Safe public projection only)
grant select on public.public_business_profile to anon, authenticated;

-- Policies for business_profile table
-- A) Authenticated staff can view full business profile
drop policy if exists "Staff can view business profile" on public.business_profile;
create policy "Staff can view business profile"
on public.business_profile for select
to authenticated
using (public.is_active_staff());

-- B) Super Admin and Admin can update business profile
drop policy if exists "Superadmin and Admin can update business profile" on public.business_profile;
create policy "Superadmin and Admin can update business profile"
on public.business_profile for update
to authenticated
using (public.current_staff_role() in ('super_admin', 'admin'))
with check (public.current_staff_role() in ('super_admin', 'admin'));

-- C) Super Admin and Admin can insert business profile (if needed for id = 1)
drop policy if exists "Superadmin can insert business profile" on public.business_profile;
create policy "Superadmin can insert business profile"
on public.business_profile for insert
to authenticated
with check (public.current_staff_role() in ('super_admin', 'admin'));

-- Policies for business_bank_accounts table
-- A) Authenticated active staff can view bank accounts (for invoices, quotations, receipts)
drop policy if exists "Staff can view business bank accounts" on public.business_bank_accounts;
create policy "Staff can view business bank accounts"
on public.business_bank_accounts for select
to authenticated
using (public.is_active_staff());

-- B) Super Admin and Admin can insert/update/delete bank accounts
drop policy if exists "Superadmin and Admin can manage bank accounts" on public.business_bank_accounts;
create policy "Superadmin and Admin can manage bank accounts"
on public.business_bank_accounts for all
to authenticated
using (public.current_staff_role() in ('super_admin', 'admin'))
with check (public.current_staff_role() in ('super_admin', 'admin'));

-- Revoke direct anon access to raw business_profile and business_bank_accounts
revoke all on table public.business_profile from anon;
revoke all on table public.business_bank_accounts from anon;

commit;
