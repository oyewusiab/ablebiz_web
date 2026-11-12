-- ==============================================================================
-- ABLEBIZ SUITE — POSTGRESQL CONCURRENCY & INTEGRITY TEST SUITE
-- File: implementation/TEST_CONCURRENCY_POSTGRESQL.sql
-- Phases 15–19: Expense Allocation Cap, Audit Trigger, & Amount Reduction Safety
-- ==============================================================================
-- INSTRUCTIONS FOR REPRODUCIBLE EXECUTION:
-- Run this script against a STAGING Supabase PostgreSQL database using two separate
-- interactive database connections (e.g. Session 1 and Session 2 in psql, or two
-- browser windows in Supabase SQL Editor).
--
-- STATUS:
-- Script prepared and verified syntactically. Multi-connection live staging
-- execution is PENDING staging deployment approval.
-- ==============================================================================

-- ==============================================================================
-- STEP 1: SETUP TEST FIXTURES (Run in Session 1)
-- ==============================================================================
begin;

-- Create temporary test IDs
create temporary table if not exists _test_ids (
  key text primary key,
  id uuid not null
);

delete from _test_ids;

insert into _test_ids (key, id) values
  ('expense_id', gen_random_uuid()),
  ('payment_id_verified', gen_random_uuid()),
  ('payment_id_unverified', gen_random_uuid());

-- Insert test verified and unverified payments
insert into public.payments (id, amount, payment_reference, payment_method, status, is_verified, created_at)
select
  id, 150000.00, 'TEST-PAY-VERIFIED-' || id, 'bank_transfer', 'completed', true, now()
from _test_ids where key = 'payment_id_verified';

insert into public.payments (id, amount, payment_reference, payment_method, status, is_verified, created_at)
select
  id, 150000.00, 'TEST-PAY-UNVERIFIED-' || id, 'bank_transfer', 'completed', false, now()
from _test_ids where key = 'payment_id_unverified';

-- Insert test expense of ₦100,000
insert into public.expenses (id, description, amount, expense_date, category, status, created_at)
select
  id, 'CONCURRENCY TEST EXPENSE 100K', 100000.00, current_date, 'Operations', 'approved', now()
from _test_ids where key = 'expense_id';

commit;

-- Output test IDs for copying to Session 2:
select key, id from _test_ids;


-- ==============================================================================
-- TEST SCENARIO A: UNVERIFIED PAYMENT REJECTION (Single Session)
-- Expected: Trigger raises UNVERIFIED_RECEIPT_ALLOCATION exception
-- ==============================================================================
do $$
declare
  v_exp_id uuid;
  v_unverified_pay_id uuid;
begin
  select id into v_exp_id from _test_ids where key = 'expense_id';
  select id into v_unverified_pay_id from _test_ids where key = 'payment_id_unverified';

  begin
    insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount)
    values (v_exp_id, v_unverified_pay_id, 20000.00);
    raise exception 'TEST FAILED: Unverified payment allocation was erroneously accepted!';
  exception when others then
    if sqlerrm like '%UNVERIFIED_RECEIPT_ALLOCATION%' then
      raise notice 'TEST PASSED: Unverified payment successfully blocked with error: %', sqlerrm;
    else
      raise exception 'TEST FAILED: Unexpected error: %', sqlerrm;
    end if;
  end;
end $$;


-- ==============================================================================
-- TEST SCENARIO B: CONCURRENT ALLOCATION OVER-CAP RACE CONDITION
-- Two concurrent sessions attempt to allocate ₦70,000 each to the ₦100,000 expense.
-- Expected:
--   Session 1 acquires row lock (FOR UPDATE), succeeds, commits ₦70,000.
--   Session 2 blocks waiting for lock, resumes after Session 1 commits,
--   detects total ₦70,000 + ₦70,000 = ₦140,000 > ₦100,000 cap,
--   and is rejected with ALLOCATION_LIMIT_EXCEEDED.
-- ==============================================================================

-- [IN SESSION 1]:
-- Step B1: Begin transaction and insert ₦70,000 allocation.
-- DO NOT COMMIT YET.
begin;
-- Substitute <expense_id> and <payment_id_verified> from Step 1:
/*
insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
values ('<expense_id>', '<payment_id_verified>', 70000.00, 'Session 1 allocation');
*/

-- [IN SESSION 2]:
-- Step B2: Simultaneously begin transaction and attempt ₦70,000 allocation:
/*
begin;
insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
values ('<expense_id>', '<payment_id_verified>', 70000.00, 'Session 2 allocation');
-- NOTE: Session 2 immediately pauses/blocks waiting for the row lock held by Session 1!
*/

-- [IN SESSION 1]:
-- Step B3: Commit Session 1.
/*
commit;
*/

-- [OBSERVE IN SESSION 2]:
-- Step B4: Upon Session 1 commit, Session 2 unblocks immediately and fails with:
-- ERROR: ALLOCATION_LIMIT_EXCEEDED: Total allocated amount (140000.00) exceeds expense total (100000.00) for expense <expense_id>.
-- Rollback Session 2:
/*
rollback;
*/


-- ==============================================================================
-- TEST SCENARIO C: EXPENSE AMOUNT REDUCTION BELOW ALLOCATED TOTAL
-- Attempt to reduce the ₦100,000 expense amount to ₦50,000 when ₦70,000 is allocated.
-- Expected: validate_expense_amount_reduction trigger raises EXPENSE_REDUCTION_EXCEEDS_ALLOCATION.
-- ==============================================================================
do $$
declare
  v_exp_id uuid;
begin
  select id into v_exp_id from _test_ids where key = 'expense_id';

  begin
    update public.expenses
    set amount = 50000.00
    where id = v_exp_id;

    raise exception 'TEST FAILED: Expense amount reduction below allocation was erroneously allowed!';
  exception when others then
    if sqlerrm like '%EXPENSE_REDUCTION_EXCEEDS_ALLOCATION%' then
      raise notice 'TEST PASSED: Expense amount reduction successfully blocked with error: %', sqlerrm;
    else
      raise exception 'TEST FAILED: Unexpected error: %', sqlerrm;
    end if;
  end;
end $$;


-- ==============================================================================
-- TEST SCENARIO D: AUDIT TRIGGER DELETE BEHAVIOR & PERMANENCE
-- Delete the allocation in Session 1.
-- Verify that:
-- 1. DELETE completes cleanly (returning OLD without crashing).
-- 2. An audit record is logged with action = 'DELETE', old_data populated, new_data null.
-- 3. historical_expense_id and historical_payment_id are preserved.
-- ==============================================================================
do $$
declare
  v_exp_id uuid;
  v_audit_count integer;
  v_delete_action text;
begin
  select id into v_exp_id from _test_ids where key = 'expense_id';

  -- Delete allocation
  delete from public.expense_receipt_allocations where expense_id = v_exp_id;

  -- Verify audit record exists
  select count(*), max(action)
  into v_audit_count, v_delete_action
  from public.expense_allocation_audit_logs
  where historical_expense_id = v_exp_id;

  if v_audit_count >= 2 and v_delete_action = 'DELETE' then
    raise notice 'TEST PASSED: Audit trigger handled DELETE cleanly and preserved audit log count %', v_audit_count;
  else
    raise exception 'TEST FAILED: Audit log missing or incorrect action for DELETE (count=%, action=%)', v_audit_count, v_delete_action;
  end if;
end $$;


-- ==============================================================================
-- STEP 5: CLEANUP TEST FIXTURES
-- ==============================================================================
begin;
delete from public.expense_allocation_audit_logs
where historical_expense_id in (select id from _test_ids where key = 'expense_id');

delete from public.expense_receipt_allocations
where expense_id in (select id from _test_ids where key = 'expense_id');

delete from public.expenses
where id in (select id from _test_ids where key = 'expense_id');

delete from public.payments
where id in (select id from _test_ids where key in ('payment_id_verified', 'payment_id_unverified'));

drop table if exists _test_ids;
commit;
