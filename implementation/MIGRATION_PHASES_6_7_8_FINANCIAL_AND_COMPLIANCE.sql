-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 6, 7 & 8 DATABASE MIGRATION
-- PHASE 6: Service Profitability & Cost Analysis
-- PHASE 7: Cash Flow Forecasting & Financial Planning
-- PHASE 8: Annual Compliance & Recurring Service Management
-- File: implementation/MIGRATION_PHASES_6_7_8_FINANCIAL_AND_COMPLIANCE.sql
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. PHASE 6 — EXPENSE COST ATTRIBUTION & SERVICE PROFITABILITY
-- ==============================================================================

-- 1.1 Allow direct cost attribution to services, clients, and CAC applications
alter table public.expenses 
  add column if not exists service_id uuid references public.services_catalog(id) on delete set null;

alter table public.expenses 
  add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.expenses 
  add column if not exists cac_application_id uuid references public.cac_applications(id) on delete set null;

alter table public.expenses 
  add column if not exists cost_type text not null default 'direct';

-- Check constraint for cost_type
alter table public.expenses 
  drop constraint if exists expenses_cost_type_check;

alter table public.expenses 
  add constraint expenses_cost_type_check check (cost_type in ('direct', 'allocated', 'estimated', 'unallocated'));

create index if not exists idx_expenses_service_id on public.expenses(service_id);
create index if not exists idx_expenses_client_id on public.expenses(client_id);
create index if not exists idx_expenses_cac_app_id on public.expenses(cac_application_id);
create index if not exists idx_expenses_cost_type on public.expenses(cost_type);

-- ==============================================================================
-- 2. PHASE 7 — CASH FLOW FORECASTING & FINANCIAL PLANNING
-- ==============================================================================

-- 2.1 Enhance invoices with collection estimation adjustments
alter table public.invoices 
  add column if not exists expected_payment_date date;

alter table public.invoices 
  add column if not exists collection_notes text;

alter table public.invoices 
  add column if not exists collection_confidence text not null default 'standard';

alter table public.invoices 
  drop constraint if exists invoices_collection_confidence_check;

alter table public.invoices 
  add constraint invoices_collection_confidence_check 
  check (collection_confidence in ('high', 'standard', 'at_risk', 'doubtful'));

-- 2.2 Projected Future Expenses (Operating expenses, rent, salaries, software, etc.)
create table if not exists public.projected_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 'rent', 'salaries', 'utilities', 'internet', 'software_subscription', 'taxes_statutory', 'marketing', 'office_supplies', 'statutory_fees', 'other'
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  expected_payment_date date not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly', 'quarterly', 'annually')),
  status text not null default 'projected' check (status in ('projected', 'confirmed', 'paid', 'cancelled')),
  responsible_officer_id uuid references public.staff_profiles(id) on delete set null,
  notes text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projected_expenses_date on public.projected_expenses(expected_payment_date);
create index if not exists idx_projected_expenses_category on public.projected_expenses(category);
create index if not exists idx_projected_expenses_status on public.projected_expenses(status);

-- 2.3 Financial Budgets (Monthly & Annual budget targets)
create table if not exists public.financial_budgets (
  id uuid primary key default gen_random_uuid(),
  period_type text not null default 'monthly' check (period_type in ('monthly', 'quarterly', 'annual')),
  period_key text not null, -- e.g. '2026-05' or '2026-Q2' or '2026'
  category_type text not null check (category_type in ('income', 'expense')),
  category_name text not null,
  budgeted_amount numeric(14,2) not null default 0.00 check (budgeted_amount >= 0),
  notes text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_key, category_type, category_name)
);

create index if not exists idx_financial_budgets_period on public.financial_budgets(period_key);

-- ==============================================================================
-- 3. PHASE 8 — ANNUAL COMPLIANCE & RECURRING SERVICE MANAGEMENT
-- ==============================================================================

-- 3.1 Configurable Statutory Compliance Rules (Statutory Templates)
create table if not exists public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  obligation_type text not null, -- 'cac_annual_returns', 'scuml_periodic_filing', 'tax_clearance_renewal', 'trademark_renewal', 'other_compliance'
  applicable_entity_type text not null default 'all', -- 'business_name', 'company', 'incorporated_trustee', 'individual', 'all'
  service_id uuid references public.services_catalog(id) on delete set null,
  statutory_reference text not null, -- e.g. 'CAMA 2020 s. 822 / CAC Annual Return Guidelines'
  verification_status text not null default 'verified' check (verification_status in ('verified', 'requires_verification')),
  verified_by text,
  date_last_verified date default current_date,
  default_recurrence text not null default 'annual' check (default_recurrence in ('annual', 'semi_annual', 'quarterly', 'monthly', 'one_time')),
  default_reminder_days integer[] default array[90, 60, 30, 14, 7, 0],
  description text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_compliance_rules_type on public.compliance_rules(obligation_type);
create index if not exists idx_compliance_rules_active on public.compliance_rules(is_active);
create unique index if not exists idx_compliance_rules_name_unique on public.compliance_rules(name);

-- Seed verified baseline statutory compliance rules
insert into public.compliance_rules (
  name, obligation_type, applicable_entity_type, statutory_reference, verification_status, verified_by, date_last_verified, default_recurrence, default_reminder_days, description
) values
(
  'CAC Annual Returns — Business Name',
  'cac_annual_returns',
  'business_name',
  'CAMA 2020 s. 822 / CAC Filing Regulations (Due not later than 30th June each year)',
  'verified',
  'Legal & Compliance Department',
  '2026-01-15',
  'annual',
  array[90, 60, 30, 14, 7, 0],
  'Statutory annual return filing for registered business names under the Companies and Allied Matters Act.'
),
(
  'CAC Annual Returns — Limited Liability Company (LTD)',
  'cac_annual_returns',
  'company',
  'CAMA 2020 s. 377 / CAC Statutory Guidelines (Due within 42 days of Annual General Meeting)',
  'verified',
  'Legal & Compliance Department',
  '2026-01-15',
  'annual',
  array[90, 60, 30, 14, 7, 0],
  'Statutory annual return filing accompanied by audited financial statements or balance sheet extract.'
),
(
  'CAC Annual Returns — Incorporated Trustee (IT / NGO / Church)',
  'cac_annual_returns',
  'incorporated_trustee',
  'CAMA 2020 s. 848 (Due between 30th June and 31st December each year)',
  'verified',
  'Legal & Compliance Department',
  '2026-01-15',
  'annual',
  array[90, 60, 30, 14, 7, 0],
  'Statutory annual return submission for NGOs, foundations, associations, and religious bodies.'
),
(
  'SCUML Periodic Compliance & Transaction Reporting',
  'scuml_periodic_filing',
  'company',
  'Money Laundering (Prevention and Prohibition) Act 2022 / SCUML Guidelines',
  'verified',
  'Legal & Compliance Department',
  '2026-02-01',
  'quarterly',
  array[30, 14, 7, 0],
  'Periodic anti-money laundering reporting and compliance certificates for designated non-financial businesses.'
),
(
  'Tax Clearance Certificate (TCC) Annual Renewal',
  'tax_clearance_renewal',
  'all',
  'Companies Income Tax Act (CITA) / Personal Income Tax Act (PITA)',
  'verified',
  'Finance & Tax Advisory',
  '2026-01-20',
  'annual',
  array[60, 30, 14, 7, 0],
  'Annual application for Federal Inland Revenue Service (FIRS) or State Board of Internal Revenue Tax Clearance Certificate.'
)
on conflict do nothing;

-- 3.2 Client Compliance Obligations (Client-specific active obligations)
create table if not exists public.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  rule_id uuid references public.compliance_rules(id) on delete set null,
  obligation_name text not null,
  obligation_type text not null default 'cac_annual_returns',
  applicable_entity_type text not null default 'business_name',
  service_id uuid references public.services_catalog(id) on delete set null,
  due_date date not null,
  recurrence_frequency text not null default 'annual' check (recurrence_frequency in ('annual', 'semi_annual', 'quarterly', 'monthly', 'one_time')),
  reminder_schedule integer[] default array[90, 60, 30, 14, 7, 0],
  assigned_officer_id uuid references public.staff_profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'upcoming', 'due_soon', 'overdue', 'in_progress', 'completed', 'exempt')),
  statutory_source text,
  verification_status text not null default 'verified' check (verification_status in ('verified', 'requires_verification')),
  verified_by text,
  date_last_verified date,
  last_completed_date date,
  next_due_date date,
  linked_service_request_id uuid references public.service_requests(id) on delete set null,
  opportunity_status text not null default 'identified' check (opportunity_status in ('none', 'identified', 'contacted', 'interested', 'quoted', 'converted', 'declined')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_compliance_obligations_client on public.compliance_obligations(client_id);
create index if not exists idx_compliance_obligations_business on public.compliance_obligations(business_id);
create index if not exists idx_compliance_obligations_due on public.compliance_obligations(due_date);
create index if not exists idx_compliance_obligations_status on public.compliance_obligations(status);
create index if not exists idx_compliance_obligations_opp on public.compliance_obligations(opportunity_status);

-- 3.3 Compliance Scheduled Reminders (Audit trail & dispatch schedule)
create table if not exists public.compliance_reminders (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  days_before_due integer not null,
  scheduled_date date not null,
  channel text not null default 'email' check (channel in ('email', 'whatsapp', 'phone', 'notification')),
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'opened', 'cancelled', 'failed')),
  sent_at timestamptz,
  sent_by uuid references public.staff_profiles(id) on delete set null,
  recipient_contact text,
  message_preview text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_compliance_reminders_obligation on public.compliance_reminders(obligation_id);
create index if not exists idx_compliance_reminders_date on public.compliance_reminders(scheduled_date);
create index if not exists idx_compliance_reminders_status on public.compliance_reminders(status);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.projected_expenses enable row level security;
alter table public.financial_budgets enable row level security;
alter table public.compliance_rules enable row level security;
alter table public.compliance_obligations enable row level security;
alter table public.compliance_reminders enable row level security;

-- 4.1 Projected Expenses & Budgets Policies
drop policy if exists "Staff can view projected expenses" on public.projected_expenses;
create policy "Staff can view projected expenses" on public.projected_expenses
  for select using (auth.role() = 'authenticated');

drop policy if exists "Authorized finance officers can manage projected expenses" on public.projected_expenses;
create policy "Authorized finance officers can manage projected expenses" on public.projected_expenses
  for all using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.auth_uid = auth.uid()
        and sp.is_active = true
        and sp.role in ('super_admin', 'admin', 'accounts_officer')
    )
  );

drop policy if exists "Staff can view financial budgets" on public.financial_budgets;
create policy "Staff can view financial budgets" on public.financial_budgets
  for select using (auth.role() = 'authenticated');

drop policy if exists "Authorized finance officers can manage financial budgets" on public.financial_budgets;
create policy "Authorized finance officers can manage financial budgets" on public.financial_budgets
  for all using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.auth_uid = auth.uid()
        and sp.is_active = true
        and sp.role in ('super_admin', 'admin', 'accounts_officer')
    )
  );

-- 4.2 Compliance Rules & Obligations Policies
drop policy if exists "Staff can view compliance rules" on public.compliance_rules;
create policy "Staff can view compliance rules" on public.compliance_rules
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can manage compliance rules" on public.compliance_rules;
create policy "Admins can manage compliance rules" on public.compliance_rules
  for all using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.auth_uid = auth.uid()
        and sp.is_active = true
        and sp.role in ('super_admin', 'admin', 'operations_manager')
    )
  );

drop policy if exists "Staff can view compliance obligations" on public.compliance_obligations;
create policy "Staff can view compliance obligations" on public.compliance_obligations
  for select using (auth.role() = 'authenticated');

drop policy if exists "Staff can manage compliance obligations" on public.compliance_obligations;
create policy "Staff can manage compliance obligations" on public.compliance_obligations
  for all using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.auth_uid = auth.uid()
        and sp.is_active = true
        and sp.role in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer', 'accounts_officer')
    )
  );

drop policy if exists "Staff can view and manage compliance reminders" on public.compliance_reminders;
create policy "Staff can view and manage compliance reminders" on public.compliance_reminders
  for all using (auth.role() = 'authenticated');

commit;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
