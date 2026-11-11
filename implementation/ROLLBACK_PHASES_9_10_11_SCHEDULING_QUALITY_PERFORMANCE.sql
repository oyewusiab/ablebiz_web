-- ==============================================================================
-- ABLEBIZ SUITE — ROLLBACK PHASES 9, 10 & 11
-- ==============================================================================

begin;

drop table if exists public.service_quality_reviews cascade;
drop table if exists public.complaint_activity_logs cascade;
drop table if exists public.client_complaints cascade;
drop table if exists public.client_feedback cascade;
drop table if exists public.survey_templates cascade;
drop table if exists public.staff_workload_capacities cascade;
drop table if exists public.appointment_reminders cascade;
drop table if exists public.appointments cascade;
drop table if exists public.staff_availability_rules cascade;
drop table if exists public.appointment_types cascade;

alter table public.tasks drop column if exists complexity;
alter table public.tasks drop column if exists estimated_effort_hours;
alter table public.tasks drop column if exists external_wait_time_minutes;
alter table public.tasks drop column if exists client_wait_time_minutes;
alter table public.tasks drop column if exists quality_score;
alter table public.tasks drop column if exists rework_count;

commit;

notify pgrst, 'reload schema';
