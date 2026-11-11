-- ==============================================================================
-- ABLEBIZ SUITE — PHASE 1 ROLLBACK SCRIPT
-- ROLLBACK SMART TASK & WORKFLOW AUTOMATION + SLA & DEADLINE MANAGEMENT + CLIENT FOLLOW-UP
-- ==============================================================================

drop table if exists public.workflow_execution_logs cascade;
drop table if exists public.workflow_rules cascade;
drop table if exists public.sla_configurations cascade;

alter table public.tasks drop column if exists category;
alter table public.tasks drop column if exists business_id;
alter table public.tasks drop column if exists lead_id;
alter table public.tasks drop column if exists start_date;
alter table public.tasks drop column if exists notes;
alter table public.tasks drop column if exists source;
alter table public.tasks drop column if exists is_escalated;
alter table public.tasks drop column if exists escalated_at;
alter table public.tasks drop column if exists escalation_notes;

alter table public.follow_ups drop column if exists service_request_id;
alter table public.follow_ups drop column if exists business_id;
alter table public.follow_ups drop column if exists channel;
alter table public.follow_ups drop column if exists outcome;
alter table public.follow_ups drop column if exists priority;
alter table public.follow_ups drop column if exists is_escalated;
