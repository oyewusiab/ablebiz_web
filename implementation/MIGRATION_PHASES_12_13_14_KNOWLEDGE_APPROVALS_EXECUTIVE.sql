-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 12, 13 & 14 DATABASE MIGRATION
-- PHASE 12: Internal Knowledge Base & SOP Management
-- PHASE 13: Approval & Decision Management
-- PHASE 14: Business Intelligence & Executive Dashboard Support
-- File: implementation/MIGRATION_PHASES_12_13_14_KNOWLEDGE_APPROVALS_EXECUTIVE.sql
-- Idempotent, safe, and non-destructive.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. PHASE 12 — INTERNAL KNOWLEDGE BASE & SOP MANAGEMENT
-- ==============================================================================

-- 1.1 Knowledge Categories Table
create table if not exists public.knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  icon text not null default 'BookOpen',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_categories_order on public.knowledge_categories(display_order, name);

-- 1.2 Knowledge Articles Table
create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  article_code text not null unique,
  title text not null,
  slug text not null unique,
  category_id uuid references public.knowledge_categories(id) on delete set null,
  summary text,
  content text not null,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'published', 'archived', 'returned_for_revision')),
  author_id uuid not null references public.staff_profiles(id) on delete restrict,
  reviewer_id uuid references public.staff_profiles(id) on delete set null,
  target_roles text[] not null default '{}', -- empty means all active staff can read once published
  department text,
  is_sop boolean not null default false,
  is_pinned boolean not null default false,
  view_count integer not null default 0,
  current_version integer not null default 1,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_articles_category on public.knowledge_articles(category_id);
create index if not exists idx_knowledge_articles_status on public.knowledge_articles(status);
create index if not exists idx_knowledge_articles_author on public.knowledge_articles(author_id);
create index if not exists idx_knowledge_articles_tags on public.knowledge_articles using gin(tags);
create index if not exists idx_knowledge_articles_target_roles on public.knowledge_articles using gin(target_roles);
create index if not exists idx_knowledge_articles_sop on public.knowledge_articles(is_sop) where is_sop = true;

-- 1.3 Knowledge Article Versions (Full Revision History)
create table if not exists public.knowledge_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  version_number integer not null,
  title text not null,
  summary text,
  content text not null,
  tags text[] not null default '{}',
  change_summary text not null,
  created_by uuid not null references public.staff_profiles(id) on delete restrict,
  review_status text not null default 'draft' check (review_status in ('draft', 'submitted', 'approved', 'rejected', 'published')),
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  unique(article_id, version_number)
);

create index if not exists idx_knowledge_versions_article on public.knowledge_article_versions(article_id, version_number desc);

-- 1.4 Automatic updated_at Triggers
drop trigger if exists trg_knowledge_categories_updated_at on public.knowledge_categories;
create trigger trg_knowledge_categories_updated_at
  before update on public.knowledge_categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_knowledge_articles_updated_at on public.knowledge_articles;
create trigger trg_knowledge_articles_updated_at
  before update on public.knowledge_articles
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 2. PHASE 13 — APPROVAL & DECISION MANAGEMENT ENGINE
-- ==============================================================================

-- 2.1 Configurable Approval Rules
create table if not exists public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('finance', 'commercial', 'operations', 'administration')),
  request_type text not null unique check (request_type in (
    'expense',
    'refund',
    'invoice_adjustment',
    'financial_writeoff',
    'budget_allocation',
    'discount',
    'campaign_pricing',
    'special_quotation',
    'document_release',
    'deliverable_approval',
    'process_exception',
    'staff_change'
  )),
  name text not null,
  description text,
  min_amount numeric(15,2) not null default 0,
  max_amount numeric(15,2),
  required_approver_roles text[] not null default array['super_admin', 'admin'],
  sequential_stages integer not null default 1 check (sequential_stages >= 1 and sequential_stages <= 5),
  requires_supporting_documents boolean not null default false,
  mandatory_comments boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_approval_rules_category on public.approval_rules(category);
create index if not exists idx_approval_rules_active on public.approval_rules(is_active) where is_active = true;

-- 2.2 Unified Approval Requests Table
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  category text not null check (category in ('finance', 'commercial', 'operations', 'administration')),
  request_type text not null,
  title text not null,
  description text not null,
  justification text not null,
  requested_by uuid not null references public.staff_profiles(id) on delete restrict,
  amount numeric(15,2),
  currency text not null default 'NGN',
  related_module text, -- e.g. 'expenses', 'invoices', 'quotations', 'cac_operations', 'documents', 'campaigns', 'team'
  related_record_id text, -- ID of the originating record
  supporting_documents jsonb not null default '[]'::jsonb,
  assigned_approver_roles text[] not null default array['super_admin', 'admin'],
  current_stage integer not null default 1,
  total_stages integer not null default 1,
  status text not null default 'pending_approval' check (status in (
    'draft',
    'submitted',
    'pending_approval',
    'approved',
    'rejected',
    'returned_for_revision',
    'withdrawn',
    'executed'
  )),
  decision_comments text,
  decision_by uuid references public.staff_profiles(id) on delete restrict,
  decision_at timestamptz,
  execution_status text not null default 'not_required' check (execution_status in (
    'not_required',
    'pending_execution',
    'executed',
    'failed'
  )),
  execution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_approval_requests_status on public.approval_requests(status);
create index if not exists idx_approval_requests_category on public.approval_requests(category);
create index if not exists idx_approval_requests_requester on public.approval_requests(requested_by);
create index if not exists idx_approval_requests_created on public.approval_requests(created_at desc);
create index if not exists idx_approval_requests_related on public.approval_requests(related_module, related_record_id);

-- 2.3 Immutable Approval Decision History
create table if not exists public.approval_decision_history (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  stage integer not null default 1,
  actor_id uuid not null references public.staff_profiles(id) on delete restrict,
  action text not null check (action in (
    'submitted',
    'approved',
    'rejected',
    'returned_for_revision',
    'withdrawn',
    'reopened',
    'executed',
    'commented'
  )),
  comments text not null,
  previous_status text not null,
  new_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_history_request on public.approval_decision_history(approval_request_id, created_at desc);

-- 2.4 Triggers for Approval Updated At
drop trigger if exists trg_approval_rules_updated_at on public.approval_rules;
create trigger trg_approval_rules_updated_at
  before update on public.approval_rules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_approval_requests_updated_at on public.approval_requests;
create trigger trg_approval_requests_updated_at
  before update on public.approval_requests
  for each row execute function public.set_updated_at();

-- 2.5 Database Maker-Checker Safeguard Trigger
-- A requester MUST NEVER approve their own request!
create or replace function public.enforce_approval_maker_checker()
returns trigger language plpgsql as $$
begin
  if (new.status = 'approved' and new.decision_by is not null and new.decision_by = new.requested_by) then
    raise exception 'MAKER_CHECKER_VIOLATION: Requester cannot approve their own request.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_approval_maker_checker on public.approval_requests;
create trigger trg_enforce_approval_maker_checker
  before update on public.approval_requests
  for each row execute function public.enforce_approval_maker_checker();

-- 2.6 Atomic Stored Procedure for Decision Execution
create or replace function public.process_approval_decision(
  p_request_id uuid,
  p_action text, -- 'approved', 'rejected', 'returned_for_revision', 'withdrawn', 'executed'
  p_comments text,
  p_execution_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile public.staff_profiles%rowtype;
  v_request public.approval_requests%rowtype;
  v_new_status text;
  v_new_exec_status text;
  v_history_id uuid;
begin
  -- Validate caller
  select * into v_caller_profile
  from public.staff_profiles
  where auth_uid = auth.uid() and is_active = true
  limit 1;

  if v_caller_profile.id is null then
    raise exception 'UNAUTHORIZED: Active staff profile not found.';
  end if;

  -- Lock request row
  select * into v_request
  from public.approval_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'NOT_FOUND: Approval request does not exist.';
  end if;

  -- Handle Withdrawal (Requester only)
  if p_action = 'withdrawn' then
    if v_request.requested_by <> v_caller_profile.id and v_caller_profile.role not in ('super_admin') then
      raise exception 'UNAUTHORIZED: Only the requester can withdraw a pending approval request.';
    end if;
    v_new_status := 'withdrawn';
    v_new_exec_status := v_request.execution_status;

  -- Handle Decisions: Approve, Reject, Return
  elsif p_action in ('approved', 'rejected', 'returned_for_revision') then
    -- Enforce Maker-Checker
    if p_action = 'approved' and v_request.requested_by = v_caller_profile.id then
      raise exception 'MAKER_CHECKER_VIOLATION: You cannot approve your own request.';
    end if;

    -- Verify Approver Role
    if v_caller_profile.role not in ('super_admin', 'admin') and
       not (v_caller_profile.role::text = any(v_request.assigned_approver_roles)) then
      raise exception 'UNAUTHORIZED: Your staff role is not authorized to decide this approval request.';
    end if;

    if p_action = 'approved' then
      v_new_status := 'approved';
      v_new_exec_status := case when v_request.execution_status = 'pending_execution' then 'pending_execution' else 'not_required' end;
    elsif p_action = 'rejected' then
      v_new_status := 'rejected';
      v_new_exec_status := 'not_required';
    else
      v_new_status := 'returned_for_revision';
      v_new_exec_status := 'not_required';
    end if;

  -- Handle Execution
  elsif p_action = 'executed' then
    if v_request.status <> 'approved' then
      raise exception 'INVALID_STATE: Only approved requests can be executed.';
    end if;
    if v_caller_profile.role not in ('super_admin', 'admin', 'accounts_officer', 'operations_manager') then
      raise exception 'UNAUTHORIZED: You do not have permission to execute this approved action.';
    end if;
    v_new_status := 'executed';
    v_new_exec_status := 'executed';
  else
    raise exception 'INVALID_ACTION: Unknown approval action.';
  end if;

  -- Update request
  update public.approval_requests
  set
    status = v_new_status,
    decision_by = v_caller_profile.id,
    decision_at = now(),
    decision_comments = p_comments,
    execution_status = v_new_exec_status,
    execution_notes = coalesce(p_execution_notes, execution_notes),
    updated_at = now()
  where id = v_request.id;

  -- Record in decision history
  insert into public.approval_decision_history (
    approval_request_id,
    stage,
    actor_id,
    action,
    comments,
    previous_status,
    new_status,
    created_at
  ) values (
    v_request.id,
    v_request.current_stage,
    v_caller_profile.id,
    p_action,
    coalesce(p_comments, 'Decision recorded.'),
    v_request.status,
    v_new_status,
    now()
  ) returning id into v_history_id;

  -- Write to central audit_logs
  insert into public.audit_logs (
    staff_id,
    staff_email,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) values (
    v_caller_profile.id,
    v_caller_profile.email,
    'APPROVAL_' || upper(p_action),
    'approval_request',
    v_request.id,
    jsonb_build_object('status', v_request.status, 'stage', v_request.current_stage),
    jsonb_build_object('status', v_new_status, 'actor', v_caller_profile.full_name, 'comments', p_comments),
    now()
  );

  -- Send Notification to Requester if not self-action
  if v_request.requested_by <> v_caller_profile.id then
    insert into public.notifications (
      recipient_staff_id,
      title,
      message,
      link,
      priority,
      created_at
    ) values (
      v_request.requested_by,
      'Approval Request ' || v_request.reference_number || ' ' || initcap(replace(v_new_status, '_', ' ')),
      'Your request "' || v_request.title || '" was marked as ' || replace(v_new_status, '_', ' ') || ' by ' || v_caller_profile.full_name || '.',
      '/admin/approvals?id=' || v_request.id::text,
      case when v_new_status = 'approved' then 'high' else 'normal' end::public.operational_priority,
      now()
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_request.id,
    'reference_number', v_request.reference_number,
    'status', v_new_status,
    'history_id', v_history_id
  );
end;
$$;

revoke all on function public.process_approval_decision(uuid, text, text, text) from public, anon;
grant execute on function public.process_approval_decision(uuid, text, text, text) to authenticated;

-- ==============================================================================
-- 3. ROW LEVEL SECURITY POLICIES (LEAST-PRIVILEGE & ACTIVE STAFF GATED)
-- ==============================================================================

-- 3.1 Knowledge Categories RLS
alter table public.knowledge_categories enable row level security;

drop policy if exists "knowledge_categories_select_active_staff" on public.knowledge_categories;
create policy "knowledge_categories_select_active_staff" on public.knowledge_categories
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "knowledge_categories_manage_management" on public.knowledge_categories;
create policy "knowledge_categories_manage_management" on public.knowledge_categories
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  );

-- 3.2 Knowledge Articles RLS
alter table public.knowledge_articles enable row level security;

-- View:
-- Management (super_admin, admin) can view all articles.
-- Operations Manager can view all operational SOPs and published articles.
-- Authors can view their own drafts/submissions.
-- All active staff can view published articles that match their role or have no role restriction.
drop policy if exists "knowledge_articles_select_authorized" on public.knowledge_articles;
create policy "knowledge_articles_select_authorized" on public.knowledge_articles
  for select to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin') or
      (public.current_staff_role() = 'operations_manager' and is_sop = true) or
      author_id in (select id from public.staff_profiles where auth_uid = auth.uid()) or
      (
        status = 'published' and (
          cardinality(target_roles) = 0 or
          public.current_staff_role()::text = any(target_roles)
        )
      )
    )
  );

-- Insert: active staff can create drafts where author_id is their own profile ID
drop policy if exists "knowledge_articles_insert_active_staff" on public.knowledge_articles;
create policy "knowledge_articles_insert_active_staff" on public.knowledge_articles
  for insert to authenticated
  with check (
    public.is_active_staff() and
    author_id in (select id from public.staff_profiles where auth_uid = auth.uid())
  );

-- Update:
-- Management can update any article.
-- Author can update their own article if status is draft or returned_for_revision.
drop policy if exists "knowledge_articles_update_authorized" on public.knowledge_articles;
create policy "knowledge_articles_update_authorized" on public.knowledge_articles
  for update to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin') or
      (public.current_staff_role() = 'operations_manager' and is_sop = true) or
      (author_id in (select id from public.staff_profiles where auth_uid = auth.uid()) and status in ('draft', 'returned_for_revision'))
    )
  )
  with check (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin') or
      (public.current_staff_role() = 'operations_manager' and is_sop = true) or
      (author_id in (select id from public.staff_profiles where auth_uid = auth.uid()) and status in ('draft', 'submitted', 'returned_for_revision'))
    )
  );

-- Delete: Strictly Super Admin
drop policy if exists "knowledge_articles_delete_super_admin" on public.knowledge_articles;
create policy "knowledge_articles_delete_super_admin" on public.knowledge_articles
  for delete to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() = 'super_admin'
  );

-- 3.3 Knowledge Article Versions RLS
alter table public.knowledge_article_versions enable row level security;

drop policy if exists "knowledge_versions_select_authorized" on public.knowledge_article_versions;
create policy "knowledge_versions_select_authorized" on public.knowledge_article_versions
  for select to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager') or
      created_by in (select id from public.staff_profiles where auth_uid = auth.uid()) or
      exists (
        select 1 from public.knowledge_articles a
        where a.id = article_id and a.status = 'published' and (
          cardinality(a.target_roles) = 0 or
          public.current_staff_role()::text = any(a.target_roles)
        )
      )
    )
  );

drop policy if exists "knowledge_versions_insert_authorized" on public.knowledge_article_versions;
create policy "knowledge_versions_insert_authorized" on public.knowledge_article_versions
  for insert to authenticated
  with check (
    public.is_active_staff() and
    created_by in (select id from public.staff_profiles where auth_uid = auth.uid())
  );

-- 3.4 Approval Rules RLS
alter table public.approval_rules enable row level security;

drop policy if exists "approval_rules_select_active_staff" on public.approval_rules;
create policy "approval_rules_select_active_staff" on public.approval_rules
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "approval_rules_manage_management" on public.approval_rules;
create policy "approval_rules_manage_management" on public.approval_rules
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin')
  );

-- 3.5 Approval Requests RLS
alter table public.approval_requests enable row level security;

-- Select:
-- Super admin and admin can view all requests.
-- Requesters can view their own requests.
-- Approvers can view requests assigned to their role.
drop policy if exists "approval_requests_select_authorized" on public.approval_requests;
create policy "approval_requests_select_authorized" on public.approval_requests
  for select to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin') or
      requested_by in (select id from public.staff_profiles where auth_uid = auth.uid()) or
      public.current_staff_role()::text = any(assigned_approver_roles)
    )
  );

-- Insert: Active staff can submit approval requests where requested_by is self
drop policy if exists "approval_requests_insert_authorized" on public.approval_requests;
create policy "approval_requests_insert_authorized" on public.approval_requests
  for insert to authenticated
  with check (
    public.is_active_staff() and
    requested_by in (select id from public.staff_profiles where auth_uid = auth.uid())
  );

-- Update: Handled via process_approval_decision RPC or by requester if draft/returned
drop policy if exists "approval_requests_update_authorized" on public.approval_requests;
create policy "approval_requests_update_authorized" on public.approval_requests
  for update to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin') or
      (requested_by in (select id from public.staff_profiles where auth_uid = auth.uid()) and status in ('draft', 'returned_for_revision')) or
      public.current_staff_role()::text = any(assigned_approver_roles)
    )
  )
  with check (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin') or
      (requested_by in (select id from public.staff_profiles where auth_uid = auth.uid()) and status in ('draft', 'submitted', 'returned_for_revision', 'withdrawn')) or
      public.current_staff_role()::text = any(assigned_approver_roles)
    )
  );

-- 3.6 Approval Decision History RLS
alter table public.approval_decision_history enable row level security;

drop policy if exists "approval_history_select_authorized" on public.approval_decision_history;
create policy "approval_history_select_authorized" on public.approval_decision_history
  for select to authenticated
  using (
    public.is_active_staff() and
    exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id and (
        public.current_staff_role() in ('super_admin', 'admin') or
        ar.requested_by in (select id from public.staff_profiles where auth_uid = auth.uid()) or
        public.current_staff_role()::text = any(ar.assigned_approver_roles)
      )
    )
  );

drop policy if exists "approval_history_insert_authorized" on public.approval_decision_history;
create policy "approval_history_insert_authorized" on public.approval_decision_history
  for insert to authenticated
  with check (public.is_active_staff());

-- ==============================================================================
-- 4. SEED INITIAL CANONICAL DATA (IDEMPOTENT)
-- ==============================================================================

-- 4.1 Canonical Knowledge Categories
insert into public.knowledge_categories (name, slug, description, icon, display_order)
values
  ('Company Registration & Business Formation', 'company-registration', 'SOPs, checklists, and statutory guidelines for Limited Liability Companies and Business Names.', 'Building2', 1),
  ('NGO & Incorporated Trustees', 'ngo-incorporated-trustees', 'Procedures, newspaper publication guidelines, constitution vetting, and CAC requirements for NGOs.', 'FileText', 2),
  ('CAC Post-Incorporation & Compliance', 'cac-post-incorporation', 'Annual returns, change of directors/objects, share capital increases, and statutory compliance.', 'FileCheck2', 3),
  ('Taxation, TIN & SCUML', 'taxation-tin-scuml', 'FIRS Tax Identification Number, SCUML anti-money laundering certifications, and VAT registration.', 'ShieldCheck', 4),
  ('Accounting & Financial Procedures', 'finance-accounting', 'Internal expense submission, client quotation standards, invoicing, and refund policies.', 'DollarSign', 5),
  ('Client Care & Communication Standards', 'client-care', 'Official messaging templates, WhatsApp/phone guidelines, consultations, and complaint escalation.', 'MessageSquare', 6),
  ('Staff Onboarding & Office Policies', 'staff-onboarding', 'Working hours, leave policies, document retention, confidentiality, and professional code of conduct.', 'Users', 7),
  ('Standard Operating Procedures (SOPs)', 'standard-operating-procedures', 'Master standard operating procedures across all ABLEBIZ operational workflows.', 'Briefcase', 8)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  display_order = excluded.display_order;

-- 4.2 Initial Canonical Approval Rules
insert into public.approval_rules (
  category,
  request_type,
  name,
  description,
  min_amount,
  max_amount,
  required_approver_roles,
  sequential_stages,
  requires_supporting_documents,
  mandatory_comments
) values
  ('finance', 'expense', 'Operational Expense Approval', 'Approval requirement for corporate disbursements and operational expenses.', 50000, null, array['super_admin', 'admin', 'accounts_officer'], 1, true, true),
  ('finance', 'refund', 'Client Refund Approval', 'Rigorous review and sign-off for client payment refunds.', 1, null, array['super_admin', 'admin'], 2, true, true),
  ('finance', 'invoice_adjustment', 'Invoice Adjustment & Credit Note', 'Approval for modifying issued invoices or issuing write-offs.', 1, null, array['super_admin', 'admin', 'accounts_officer'], 1, false, true),
  ('commercial', 'discount', 'Quotation Discount Approval', 'Approval for granting service fee discounts exceeding standard promotional rates.', 10000, null, array['super_admin', 'admin'], 1, false, true),
  ('commercial', 'campaign_pricing', 'Campaign Special Pricing', 'Approval for non-standard promotional tariffs or bundled packages.', 0, null, array['super_admin', 'admin'], 1, false, true),
  ('operations', 'document_release', 'Sensitive Document Release', 'Release sign-off for original client incorporation certificates and statutory documents.', 0, null, array['super_admin', 'admin', 'operations_manager'], 1, false, true),
  ('operations', 'process_exception', 'Operational Process Exception', 'Waiver or deadline extension for statutory filings or expedited turnaround.', 0, null, array['super_admin', 'admin', 'operations_manager'], 1, false, true),
  ('administration', 'staff_change', 'Staff Profile & Role Modification', 'Executive authorization for changing staff access levels, departments, or employment states.', 0, null, array['super_admin'], 1, false, true)
on conflict (request_type) do update set
  name = excluded.name,
  description = excluded.description,
  min_amount = excluded.min_amount,
  required_approver_roles = excluded.required_approver_roles,
  sequential_stages = excluded.sequential_stages,
  requires_supporting_documents = excluded.requires_supporting_documents,
  mandatory_comments = excluded.mandatory_comments;

commit;
