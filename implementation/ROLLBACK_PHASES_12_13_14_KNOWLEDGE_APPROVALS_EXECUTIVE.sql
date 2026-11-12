-- ==============================================================================
-- ABLEBIZ SUITE — ROLLBACK PHASES 12, 13 & 14 DATABASE MIGRATION
-- File: implementation/ROLLBACK_PHASES_12_13_14_KNOWLEDGE_APPROVALS_EXECUTIVE.sql
-- Safe & Idempotent (can be run even if tables do not exist yet)
-- ==============================================================================

begin;

-- 1. Drop Tables with CASCADE (PostgreSQL CASCADE automatically drops all triggers attached to these tables)
drop table if exists public.approval_decision_history cascade;
drop table if exists public.approval_requests cascade;
drop table if exists public.approval_rules cascade;

drop table if exists public.knowledge_article_versions cascade;
drop table if exists public.knowledge_articles cascade;
drop table if exists public.knowledge_categories cascade;

-- 2. Drop Functions
drop function if exists public.enforce_approval_maker_checker() cascade;
drop function if exists public.process_approval_decision(uuid, text, text, text) cascade;

commit;
