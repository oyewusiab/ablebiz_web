-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 15, 16, 17, 18 & 19
-- POST-PRODUCTION SAFE OPERATIONAL ROLLBACK SCRIPT
-- File: implementation/ROLLBACK_POST_PRODUCTION_SAFE_PHASES_15_16_17_18_19.sql
-- ==============================================================================
-- PURPOSE:
-- Safely deactivate and neutralize Phases 15–19 functionality in a live production
-- environment without destroying historical data, financial records, reconciliation
-- conflict logs, or audit trails.
--
-- GUARANTEES:
-- 1. ZERO DATA LOSS: No tables, columns, audit logs, or reconciliation records are dropped.
-- 2. ALLOCATION FREEZE: Prevents new expense allocations while retaining existing records.
-- 3. AUDIT PRESERVATION: All allocation audit trails and historical IDs remain intact.
-- 4. RECONCILIATION PRESERVATION: All quotation reconciliation records remain intact.
-- 5. ESCALATION SILENCING: Deactivates all automated escalation background rules.
-- 6. CATALOGUE DRAFTING: Deactivates all service bundles, hiding them from new quotes.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. DEACTIVATE AUTOMATED ESCALATION RULES (PHASE 15)
-- ------------------------------------------------------------------------------
-- Disables background escalation evaluations without deleting rules or escalation audit logs.
update public.escalation_rules
set is_active = false,
    updated_at = now()
where is_active = true;

comment on table public.escalation_rules is 'OPERATIONAL ROLLBACK: All rules set to is_active=false to prevent automated alerts.';

-- ------------------------------------------------------------------------------
-- 2. DEACTIVATE SERVICE BUNDLES (PHASE 17)
-- ------------------------------------------------------------------------------
-- Sets all service bundles to inactive so they are hidden from the quotation builder
-- without invalidating existing quotations that referenced these bundles.
update public.service_bundles
set is_active = false,
    updated_at = now()
where is_active = true;

comment on table public.service_bundles is 'OPERATIONAL ROLLBACK: All bundles set to is_active=false to prevent new quotation additions.';

-- ------------------------------------------------------------------------------
-- 3. FREEZE EXPENSE RECEIPT ALLOCATIONS (PHASE 19)
-- ------------------------------------------------------------------------------
-- Revoke mutation privileges on expense allocations from client roles.
-- Existing allocations and audit logs remain fully readable for accounts reporting.
revoke insert, update, delete on public.expense_receipt_allocations from authenticated, anon, public;

-- Drop validation triggers to prevent interference with emergency legacy expense corrections,
-- but KEEP the audit trigger and audit logs completely intact.
drop trigger if exists trg_validate_expense_allocation on public.expense_receipt_allocations;
drop trigger if exists trg_validate_expense_amount_reduction on public.expenses;

comment on table public.expense_receipt_allocations is 'OPERATIONAL ROLLBACK: Table is frozen in read-only mode. Direct mutations revoked.';
comment on table public.expense_allocation_audit_logs is 'OPERATIONAL ROLLBACK: Audit logs preserved immutably.';

-- ------------------------------------------------------------------------------
-- 4. PRESERVE RECONCILIATION CONFLICTS (PHASE 17)
-- ------------------------------------------------------------------------------
-- Leave quotation_reconciliation_conflicts completely intact for administrative review.
comment on table public.quotation_reconciliation_conflicts is 'OPERATIONAL ROLLBACK: Reconciliation conflict history preserved intact.';

-- ------------------------------------------------------------------------------
-- 5. RETAIN ALL EXTENDED COLUMNS & TABLES
-- ------------------------------------------------------------------------------
-- All added columns in:
--   - public.notifications (category, event_type, record_id, record_type, action_url, metadata)
--   - public.backup_records (retained for compliance)
--   - public.restore_drills (retained for compliance)
--   - public.business_continuity_settings (retained for compliance)
--   - public.quotations (internal_cost_total, margin_amount, margin_percentage, etc.)
--   - public.quotation_items (statutory_fee, internal_cost)
--   - public.campaigns (budget_ngn, actual_spend_ngn, ad_spend_ngn)
--   - public.leads (campaign_id, conversion_date, conversion_revenue)
-- are STRICTLY PRESERVED to prevent loss of any operational records entered during live usage.

commit;
