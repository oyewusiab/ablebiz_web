-- ==============================================================================
-- ABLEBIZ SUITE — BANK ACCOUNTS & INVOICE SETTLEMENT ENHANCEMENT
-- File: implementation/MIGRATION_BANK_ACCOUNTS_AND_INVOICES.sql
-- ==============================================================================
-- 1. Expands business_bank_accounts to allow up to 3 bank account slots (Slot 1, 2, 3)
-- 2. Adds bank_account_credited column to public.invoices to track designated settlement account
-- 3. Reloads schema cache for PostgREST
-- ==============================================================================

begin;

-- 1. Update account_slot check constraint on business_bank_accounts
alter table public.business_bank_accounts 
  drop constraint if exists business_bank_accounts_account_slot_check;

alter table public.business_bank_accounts 
  add constraint business_bank_accounts_account_slot_check check (account_slot in (1, 2, 3));

-- 2. Add bank_account_credited column to public.invoices if not already present
alter table public.invoices 
  add column if not exists bank_account_credited text;

commit;

-- 3. Notify PostgREST to refresh schema cache
notify pgrst, 'reload schema';
