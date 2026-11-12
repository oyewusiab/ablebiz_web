# ABLEBIZ SUITE — Staging Validation Runbook (Phases 15–19)
**Document Version:** 1.0  
**Target Environment:** Isolated Supabase Staging Project (PostgreSQL 15+)  
**Applies to Commit:** `d91aadf` / Current Branch Head  
**Strict Policy:** NEVER EXECUTE AGAINST PRODUCTION (`ksjphkqxudtkduuhnyvn`)

---

## Overview & Safety Architecture

This runbook defines the step-by-step operational procedure for validating the database migrations, concurrency caps, audit triggers, RLS policies, and rollback mechanisms for **Phases 15, 16, 17, 18 & 19** in a dedicated, isolated Supabase staging environment.

### Safety Invariants
1. **Zero Production Contact:** No command or SQL statement in this runbook may connect to the production Supabase instance (`ksjphkqxudtkduuhnyvn.supabase.co`).
2. **Fail-Closed Gate:** The pre-flight verification script (`scripts/verify-staging-environment.mjs`) must pass with exit code `0` before any SQL is run.
3. **Synthetic Data Only:** All test records (staff profiles, payments, expenses, quotations) must use synthetic `TEST-` identifiers and be fully cleaned up after test completion.
4. **Empirical Evidence Required:** All command outputs, timestamps, and PostgreSQL error codes must be recorded in the final sign-off log.

---

## Step 1: Initial Staging Project Verification

### 1.1 Provisioning Staging
Create a new, isolated project in the [Supabase Dashboard](https://supabase.com/dashboard). Note the distinct **Project Reference** (e.g. `xyzabcopqrstuvwx1234`).

### 1.2 Configuration
Copy the staging template to the git-ignored local file:
```bash
cp .env.staging.example .env.staging.local
```

Edit `.env.staging.local` with your staging credentials:
```bash
STAGING_SUPABASE_PROJECT_REF="<your-isolated-staging-project-ref>"
STAGING_SUPABASE_URL="https://<your-isolated-staging-project-ref>.supabase.co"
STAGING_SUPABASE_ANON_KEY="<your-staging-anon-key>"
STAGING_SUPABASE_SERVICE_ROLE_KEY="<your-staging-service-role-key>"
STAGING_DB_HOST="db.<your-isolated-staging-project-ref>.supabase.co"
STAGING_DB_PORT="5432"
STAGING_DB_NAME="postgres"
STAGING_DB_USER="postgres"
STAGING_DB_PASSWORD="<your-staging-db-password>"
STAGING_ENVIRONMENT_CONFIRMED="true"
```

### 1.3 Pre-Flight Safety Verification
Run the automated pre-flight safety guard:
```bash
node scripts/verify-staging-environment.mjs
```
- **Expected Outcome:** Exit code `0`, `[PRE-FLIGHT VERIFICATION: PASSED]`.
- **Abort Condition:** If exit code is `1` (missing) or `2` (points to production `ksjphkqxudtkduuhnyvn`), **HALT IMMEDIATELY**.

---

## Step 2: Staging Schema Preparation

Ensure the staging database has the baseline schema (Phases 1–14).  
If initializing a fresh staging database, execute the baseline schema migrations first:
1. `implementation/SUPABASE_BACKEND.sql`
2. `implementation/MIGRATION_ABLEBIZ_SUITE.sql`
3. `implementation/MIGRATION_PHASES_6_7_8_FINANCIAL_AND_COMPLIANCE.sql`
4. `implementation/MIGRATION_PHASES_9_10_11_SCHEDULING_QUALITY_PERFORMANCE.sql`
5. `implementation/MIGRATION_PHASES_12_13_14_KNOWLEDGE_APPROVALS_EXECUTIVE.sql`

Verify base tables exist:
```sql
select table_name from information_schema.tables 
where table_schema = 'public' 
  and table_name in ('staff_profiles', 'expenses', 'payments', 'quotations', 'quotation_items', 'notifications', 'leads', 'campaigns');
```

---

## Step 3: Migration Execution (First Pass)

Execute the Phase 15–19 migration script via `psql` or the Supabase SQL Editor against the staging database:

```bash
# Using psql:
psql -h $STAGING_DB_HOST -p $STAGING_DB_PORT -U $STAGING_DB_USER -d $STAGING_DB_NAME -f implementation/MIGRATION_PHASES_15_16_17_18_19.sql
```

### Verification Checks
Verify that all new tables and columns were created:
```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'staff_notification_preferences',
    'escalation_rules',
    'escalation_logs',
    'backup_records',
    'restore_drills',
    'business_continuity_settings',
    'service_bundles',
    'quotation_reconciliation_conflicts',
    'expense_receipt_allocations',
    'expense_allocation_audit_logs'
  );
-- Expected: 10 rows returned
```

---

## Step 4: Migration Rerun & Idempotency Testing (Second Pass)

Re-execute the exact same migration script against the already-migrated staging schema:
```bash
psql -h $STAGING_DB_HOST -p $STAGING_DB_PORT -U $STAGING_DB_USER -d $STAGING_DB_NAME -f implementation/MIGRATION_PHASES_15_16_17_18_19.sql
```

### Invariants to Verify
1. Script completes with `COMMIT` and `0` errors.
2. Seed record counts are unchanged:
   ```sql
   select count(*) from public.escalation_rules; -- Exactly 4 seed rules
   select count(*) from public.business_continuity_settings; -- Exactly 1 seed config
   select count(*) from public.service_bundles; -- Exactly 3 seed bundles
   ```
3. Check constraints are not duplicated:
   ```sql
   select conname, count(*) 
   from pg_constraint 
   where conrelid = 'public.quotation_items'::regclass and conname = 'chk_quotation_item_type'
   group by conname;
   -- Expected count: 1
   ```

---

## Step 5: Two-Session Concurrency Testing

Open two independent terminal sessions or two Supabase SQL Editor tabs connected to the staging database.

### 5.1 Step-by-Step Test Procedure (from `implementation/TEST_CONCURRENCY_POSTGRESQL.sql`)

#### In Session 1 (Setup Fixtures):
```sql
begin;
create temporary table _test_ids as
select gen_random_uuid() as exp_id, gen_random_uuid() as pay_id;

insert into public.payments (id, amount, payment_reference, payment_method, status, is_verified, created_at)
select pay_id, 150000.00, 'TEST-CONCURRENCY-PAY', 'bank_transfer', 'completed', true, now()
from _test_ids;

insert into public.expenses (id, description, amount, expense_date, category, status, created_at)
select exp_id, 'TEST-CONCURRENCY-EXP-100K', 100000.00, current_date, 'Operations', 'approved', now()
from _test_ids;

select exp_id, pay_id from _test_ids;
commit;
```
*(Copy the generated `exp_id` and `pay_id` for use below).*

#### Concurrent Execution:
1. **Session 1 (Acquire Lock & Insert):**
   ```sql
   begin;
   insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
   values ('<exp_id>', '<pay_id>', 70000.00, 'Session 1 Allocation');
   -- DO NOT COMMIT YET
   ```

2. **Session 2 (Simultaneous Allocation Attempt):**
   ```sql
   begin;
   insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
   values ('<exp_id>', '<pay_id>', 70000.00, 'Session 2 Allocation');
   -- OBSERVE: Session 2 blocks waiting for the row lock on public.expenses!
   ```

3. **Session 1 (Commit):**
   ```sql
   commit;
   ```

4. **Session 2 (Result Observation):**
   - Session 2 unblocks immediately and fails with:
     ```
     ERROR: ALLOCATION_LIMIT_EXCEEDED: Total allocated amount (140000.00) exceeds expense total (100000.00) for expense <exp_id>.
     ```
   - Rollback Session 2:
     ```sql
     rollback;
     ```

5. **Verify Allocation State:**
   ```sql
   select sum(allocated_amount) from public.expense_receipt_allocations where expense_id = '<exp_id>';
   -- Expected: 70000.00 (NOT 140000.00)
   ```

---

## Step 6: RLS, Privileges & Audit Integrity Validation

### 6.1 Direct Audit Write Denial
Verify that client roles (`authenticated`, `anon`) cannot directly modify audit logs:
```sql
set role authenticated;
insert into public.expense_allocation_audit_logs (allocation_id, historical_expense_id, action)
values (gen_random_uuid(), gen_random_uuid(), 'FORGED_INSERT');
-- Expected: ERROR: permission denied for table expense_allocation_audit_logs
reset role;
```

### 6.2 Trigger Execution Verification
Verify that the `SECURITY DEFINER` trigger logs valid mutations:
```sql
select count(*), action, historical_expense_id 
from public.expense_allocation_audit_logs 
where historical_expense_id = '<exp_id>'
group by action, historical_expense_id;
-- Expected: 1 row with action = 'INSERT'
```

### 6.3 Audit Longevity on Parent Deletion
Delete the parent expense allocation in Session 1 and verify audit retention:
```sql
delete from public.expense_receipt_allocations where expense_id = '<exp_id>';

select count(*), action 
from public.expense_allocation_audit_logs 
where historical_expense_id = '<exp_id>'
group by action;
-- Expected: 2 rows (1 'INSERT', 1 'DELETE')
-- The DELETE action must record old_data and return OLD cleanly without crashing.
```

---

## Step 7: Post-Production Safe Rollback Validation

Execute the safe operational rollback script against staging:
```bash
psql -h $STAGING_DB_HOST -p $STAGING_DB_PORT -U $STAGING_DB_USER -d $STAGING_DB_NAME -f implementation/ROLLBACK_POST_PRODUCTION_SAFE_PHASES_15_16_17_18_19.sql
```

### Invariants to Verify
1. **Zero Dropped Tables:**
   ```sql
   select table_name from information_schema.tables 
   where table_schema = 'public' and table_name in ('expense_receipt_allocations', 'expense_allocation_audit_logs', 'quotation_reconciliation_conflicts');
   -- Expected: All 3 tables remain present.
   ```
2. **Audit Preservation:**
   ```sql
   select count(*) from public.expense_allocation_audit_logs;
   -- Expected: Audit rows are NOT deleted.
   ```
3. **Allocation Mutation Freeze:**
   ```sql
   -- Verify write privileges are revoked:
   select privilege_type from information_schema.table_privileges 
   where table_name = 'expense_receipt_allocations' and grantee in ('authenticated', 'anon');
   -- Expected: Only SELECT (no INSERT, UPDATE, or DELETE).
   ```
4. **Escalations & Bundles Deactivated:**
   ```sql
   select count(*) from public.escalation_rules where is_active = true; -- Expected: 0
   select count(*) from public.service_bundles where is_active = true; -- Expected: 0
   ```

---

## Step 8: Post-Test Integrity Checks

Run sanity queries against existing core tables:
```sql
-- Ensure core operational records are undamaged:
select count(*) from public.invoices;
select count(*) from public.expenses;
select count(*) from public.payments;
select count(*) from public.quotations;
```

---

## Step 9: Evidence Capture & Logging

Save the execution outputs into a markdown or text evidence file (e.g. `implementation/STAGING_EVIDENCE_LOG.md`) documenting:
- Exact date and time of staging test.
- Staging Supabase project reference.
- SQL output of the two-session concurrency race.
- Output of RLS permission checks.
- Output of the post-production rollback verification.

---

## Step 10: Staging Cleanup Instructions

After empirical testing is completed and evidence is captured, clean up synthetic test fixtures:
```sql
begin;
delete from public.expense_allocation_audit_logs where historical_expense_id in (select id from public.expenses where description like 'TEST-%');
delete from public.expense_receipt_allocations where expense_id in (select id from public.expenses where description like 'TEST-%');
delete from public.expenses where description like 'TEST-%';
delete from public.payments where payment_reference like 'TEST-%';
commit;
```

> [!WARNING]
> Do NOT execute `implementation/ROLLBACK_PRE_PRODUCTION_PHASES_15_16_17_18_19.sql` unless you intend to completely wipe the Phase 15–19 schema in the staging environment. Never execute pre-production teardown in any production environment.
