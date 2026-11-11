-- ==============================================================================
-- ABLEBIZ SUITE — PHASE 1 MIGRATION
-- SMART TASK & WORKFLOW AUTOMATION + SLA & DEADLINE MANAGEMENT + CLIENT FOLLOW-UP AUTOMATION
-- ==============================================================================

-- 1. EXTEND PUBLIC.TASKS TABLE
alter table public.tasks add column if not exists category text not null default 'general';
alter table public.tasks add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.tasks add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.tasks add column if not exists start_date timestamptz default now();
alter table public.tasks add column if not exists notes text;
alter table public.tasks add column if not exists source text not null default 'manual';
alter table public.tasks add column if not exists is_escalated boolean not null default false;
alter table public.tasks add column if not exists escalated_at timestamptz;
alter table public.tasks add column if not exists escalation_notes text;

create index if not exists idx_tasks_business on public.tasks(business_id);
create index if not exists idx_tasks_lead on public.tasks(lead_id);
create index if not exists idx_tasks_category on public.tasks(category);
create index if not exists idx_tasks_escalated on public.tasks(is_escalated);

-- 2. EXTEND PUBLIC.FOLLOW_UPS TABLE
alter table public.follow_ups add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;
alter table public.follow_ups add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.follow_ups add column if not exists channel text not null default 'phone_call';
alter table public.follow_ups add column if not exists outcome text;
alter table public.follow_ups add column if not exists priority text not null default 'normal';
alter table public.follow_ups add column if not exists is_escalated boolean not null default false;

create index if not exists idx_follow_ups_service_req on public.follow_ups(service_request_id);
create index if not exists idx_follow_ups_business on public.follow_ups(business_id);
create index if not exists idx_follow_ups_lead on public.follow_ups(lead_id);
create index if not exists idx_follow_ups_channel on public.follow_ups(channel);

-- 3. CREATE SLA CONFIGURATIONS TABLE
create table if not exists public.sla_configurations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services_catalog(id) on delete cascade,
  service_category text not null default 'general',
  expected_duration_days numeric(6,2) not null default 5.0,
  time_unit text not null default 'days',
  warning_threshold_pct integer not null default 75,
  escalation_threshold_pct integer not null default 100,
  responsible_department text not null default 'Operations',
  default_priority text not null default 'normal',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sla_configurations_service on public.sla_configurations(service_id);
create index if not exists idx_sla_configurations_category on public.sla_configurations(service_category);

-- 4. CREATE WORKFLOW RULES TABLE
create table if not exists public.workflow_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_event text not null, -- 'service_request_created', 'missing_client_info', 'payment_verified', 'cac_stage_changed', 'service_completed', 'task_overdue'
  applicable_service_id uuid references public.services_catalog(id) on delete set null,
  applicable_category text default 'all',
  conditions jsonb not null default '{}'::jsonb,
  action_type text not null, -- 'create_task', 'create_follow_up', 'notify_officer', 'escalate_to_manager'
  action_payload jsonb not null default '{}'::jsonb,
  assignment_rule text not null default 'role_workload', -- 'role_workload', 'direct_role', 'service_owner', 'manager_queue'
  target_role text,
  due_days integer not null default 2,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_rules_trigger on public.workflow_rules(trigger_event);
create index if not exists idx_workflow_rules_active on public.workflow_rules(is_active);

-- 5. CREATE WORKFLOW EXECUTION LOGS TABLE (IDEMPOTENCY & AUDIT)
create table if not exists public.workflow_execution_logs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  rule_id uuid references public.workflow_rules(id) on delete set null,
  trigger_event text not null,
  entity_type text not null,
  entity_id uuid not null,
  action_taken text not null,
  status text not null default 'success', -- 'success', 'failed', 'retried'
  details jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_exec_logs_key on public.workflow_execution_logs(idempotency_key);
create index if not exists idx_workflow_exec_logs_entity on public.workflow_execution_logs(entity_type, entity_id);

-- 6. ENABLE ROW LEVEL SECURITY
alter table public.sla_configurations enable row level security;
alter table public.workflow_rules enable row level security;
alter table public.workflow_execution_logs enable row level security;

-- 7. RLS POLICIES FOR STAFF ACCESS
do $$
begin
  -- sla_configurations
  if not exists (select 1 from pg_policies where tablename = 'sla_configurations' and policyname = 'sla_configurations_read_all_staff') then
    create policy sla_configurations_read_all_staff on public.sla_configurations
      for select to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'sla_configurations' and policyname = 'sla_configurations_manage_mgr') then
    create policy sla_configurations_manage_mgr on public.sla_configurations
      for all to authenticated
      using (
        exists (
          select 1 from public.staff_profiles
          where auth_uid = auth.uid()
            and role in ('super_admin', 'admin', 'operations_manager')
        )
      );
  end if;

  -- workflow_rules
  if not exists (select 1 from pg_policies where tablename = 'workflow_rules' and policyname = 'workflow_rules_read_all_staff') then
    create policy workflow_rules_read_all_staff on public.workflow_rules
      for select to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'workflow_rules' and policyname = 'workflow_rules_manage_mgr') then
    create policy workflow_rules_manage_mgr on public.workflow_rules
      for all to authenticated
      using (
        exists (
          select 1 from public.staff_profiles
          where auth_uid = auth.uid()
            and role in ('super_admin', 'admin', 'operations_manager')
        )
      );
  end if;

  -- workflow_execution_logs
  if not exists (select 1 from pg_policies where tablename = 'workflow_execution_logs' and policyname = 'workflow_exec_logs_read_all_staff') then
    create policy workflow_exec_logs_read_all_staff on public.workflow_execution_logs
      for select to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'workflow_execution_logs' and policyname = 'workflow_exec_logs_insert_staff') then
    create policy workflow_exec_logs_insert_staff on public.workflow_execution_logs
      for insert to authenticated
      with check (true);
  end if;
end $$;
