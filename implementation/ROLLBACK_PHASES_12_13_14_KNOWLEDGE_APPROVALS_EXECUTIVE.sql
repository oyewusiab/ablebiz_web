-- ==============================================================================
-- ABLEBIZ SUITE — ROLLBACK PHASES 12, 13 & 14 DATABASE MIGRATION
-- File: implementation/ROLLBACK_PHASES_12_13_14_KNOWLEDGE_APPROVALS_EXECUTIVE.sql
-- ==============================================================================

begin;

-- Drop Approval Engine Triggers and Functions
drop trigger if exists trg_enforce_approval_maker_checker on public.approval_requests;
drop function if exists public.enforce_approval_maker_checker();
drop function if exists public.process_approval_decision(uuid, text, text, text);

-- Drop Approval Tables
drop table if exists public.approval_decision_history cascade;
drop table if exists public.approval_requests cascade;
drop table if exists public.approval_rules cascade;

-- Drop Knowledge Base Tables
drop table if exists public.knowledge_article_versions cascade;
drop table if exists public.knowledge_articles cascade;
drop table if exists public.knowledge_categories cascade;

commit;
