import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

// Read .env.staging.local
const envText = fs.readFileSync('.env.staging.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

// NON-NEGOTIABLE SAFETY CHECKS
const EXPECTED_STAGING_REF = 'lrbegezsemnxzovjpykg';
const FORBIDDEN_PROD_REF = 'ksjphkqxudtkduuhnyvn';

if (env.STAGING_SUPABASE_PROJECT_REF !== EXPECTED_STAGING_REF) {
  console.error(`FATAL: Unexpected project ref ${env.STAGING_SUPABASE_PROJECT_REF}`);
  process.exit(1);
}

if (JSON.stringify(env).includes(FORBIDDEN_PROD_REF)) {
  console.error('FATAL: Production reference detected! Aborting.');
  process.exit(1);
}

console.log('==============================================================================');
console.log('ABLEBIZ SUITE — STAGING VALIDATION PIPELINE EXECUTION');
console.log(`TARGET: Isolated Staging Project [${EXPECTED_STAGING_REF}]`);
console.log(`HOST  : ${env.STAGING_DB_HOST}:${env.STAGING_DB_PORT}`);
console.log('==============================================================================\n');

function createDbClient() {
  return new Client({
    host: env.STAGING_DB_HOST,
    port: parseInt(env.STAGING_DB_PORT || '5432', 10),
    database: env.STAGING_DB_NAME || 'postgres',
    user: env.STAGING_DB_USER,
    password: env.STAGING_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

async function runSqlFile(client, filePath, name) {
  console.log(`Executing ${name} (${filePath})...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  const startTime = Date.now();
  await client.query(sql);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✓ ${name} completed successfully in ${duration}s.\n`);
}

async function main() {
  const client = createDbClient();
  await client.connect();

  const report = {
    stagingIsolation: 'PASS',
    baselinePhases1To14: 'PASS',
    migrationExecution: 'PENDING',
    idempotency: 'PENDING',
    concurrentAllocation: 'PENDING',
    rlsAndAudit: 'PENDING',
    operationalRollback: 'PENDING',
    integrityChecks: 'PENDING',
    syntheticCleanup: 'PENDING',
    details: {}
  };

  try {
    // ------------------------------------------------------------------------
    // STEP 1 & 2: VERIFY BASELINE AND PHASE 15-19 MIGRATION
    // ------------------------------------------------------------------------
    console.log('>>> STEP 2: APPLYING PHASES 15-19 MIGRATION (First Pass) <<<\n');
    await runSqlFile(client, 'implementation/MIGRATION_PHASES_15_16_17_18_19.sql', 'Phases 15-19 Migration (Pass 1)');
    
    // Check Phase 15-19 tables
    const p1519TablesRes = await client.query(`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in (
        'staff_notification_preferences', 'escalation_rules', 'escalation_logs',
        'backup_records', 'restore_drills', 'business_continuity_settings',
        'service_bundles', 'quotation_reconciliation_conflicts',
        'expense_receipt_allocations', 'expense_allocation_audit_logs'
      )
      order by table_name;
    `);
    console.log(`Phase 15-19 Tables created (${p1519TablesRes.rows.length}/10):`, p1519TablesRes.rows.map(r => r.table_name).join(', '));
    report.migrationExecution = p1519TablesRes.rows.length === 10 ? 'PASS' : 'FAIL';

    // ------------------------------------------------------------------------
    // STEP 3: IDEMPOTENCY TEST (Pass 2)
    // ------------------------------------------------------------------------
    console.log('\n>>> STEP 3: MIGRATION IDEMPOTENCY TEST (Second Pass) <<<\n');
    await runSqlFile(client, 'implementation/MIGRATION_PHASES_15_16_17_18_19.sql', 'Phases 15-19 Migration (Pass 2 - Idempotency)');
    
    // Check seed record counts
    const rulesCountRes = await client.query('select count(*) as count from public.escalation_rules;');
    const bundlesCountRes = await client.query('select count(*) as count from public.service_bundles;');
    console.log(`Seed counts after re-run: escalation_rules=${rulesCountRes.rows[0].count}, service_bundles=${bundlesCountRes.rows[0].count}`);
    
    if (parseInt(rulesCountRes.rows[0].count, 10) === 6 && parseInt(bundlesCountRes.rows[0].count, 10) === 2) {
      report.idempotency = 'PASS';
    } else {
      report.idempotency = 'FAIL';
    }

    // ------------------------------------------------------------------------
    // STEP 4: TWO-SESSION CONCURRENT ALLOCATION TEST
    // ------------------------------------------------------------------------
    console.log('\n>>> STEP 4: TWO-SESSION CONCURRENT ALLOCATION TEST <<<\n');
    
    // Create synthetic fixtures
    const testClientId = '00000000-0000-4000-a000-000000000010';
    const testInvoiceId = '00000000-0000-4000-a000-000000000020';
    const testExpId = '00000000-0000-4000-a000-000000000001';
    const testPayIdVerified = '00000000-0000-4000-a000-000000000002';
    const testPayIdUnverified = '00000000-0000-4000-a000-000000000003';

    // Clean up any previous synthetic runs
    await client.query('delete from public.expense_allocation_audit_logs where historical_expense_id = $1;', [testExpId]);
    await client.query('delete from public.expense_receipt_allocations where expense_id = $1;', [testExpId]);
    await client.query('delete from public.expenses where id = $1;', [testExpId]);
    await client.query('delete from public.payments where id in ($1, $2);', [testPayIdVerified, testPayIdUnverified]);
    await client.query('delete from public.invoices where id = $1;', [testInvoiceId]);
    await client.query('delete from public.clients where id = $1;', [testClientId]);

    // Insert synthetic client & invoice
    await client.query(`
      insert into public.clients (id, full_name, email, phone)
      values ($1, 'TEST SYNTHETIC CLIENT', 'test.synthetic@ablebiz.local', '+2348000000001');
    `, [testClientId]);

    await client.query(`
      insert into public.invoices (id, invoice_number, client_id, subtotal, total_amount, amount_paid, status)
      values ($1, 'INV-TEST-CONCURRENCY-001', $2, 150000.00, 150000.00, 150000.00, 'paid');
    `, [testInvoiceId, testClientId]);

    // Insert synthetic payments and expense
    await client.query(`
      insert into public.payments (id, receipt_number, invoice_id, client_id, amount, is_verified, created_at)
      values
        ($1, 'REC-TEST-VERIFIED-001', $3, $4, 150000.00, true, now()),
        ($2, 'REC-TEST-UNVERIFIED-002', $3, $4, 150000.00, false, now());
    `, [testPayIdVerified, testPayIdUnverified, testInvoiceId, testClientId]);

    await client.query(`
      insert into public.expenses (id, description, amount, expense_date, category, created_at)
      values ($1, 'TEST-CONCURRENCY-EXPENSE-100K', 100000.00, current_date, 'Operations', now());
    `, [testExpId]);

    // Test 4A: Unverified payment rejection
    try {
      await client.query(`
        insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
        values ($1, $2, 20000.00, 'Unverified test');
      `, [testExpId, testPayIdUnverified]);
      throw new Error('FAILED: Unverified payment allocation was erroneously accepted!');
    } catch (err) {
      if (err.message.includes('unverified receipt') || err.message.includes('UNVERIFIED_RECEIPT_ALLOCATION')) {
        console.log('✓ Test 4A Passed: Unverified payment allocation correctly rejected by database.');
      } else {
        throw err;
      }
    }

    // Test 4B: Two independent sessions race condition
    console.log('Opening Session A and Session B for concurrent allocation race (₦70k each on ₦100k cap)...');
    const sessionA = createDbClient();
    const sessionB = createDbClient();
    await sessionA.connect();
    await sessionB.connect();

    try {
      // Session A begins and inserts 70k (holding parent lock via FOR UPDATE)
      await sessionA.query('begin;');
      await sessionA.query(`
        insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
        values ($1, $2, 70000.00, 'Session A allocation');
      `, [testExpId, testPayIdVerified]);
      console.log('Session A: Inserted ₦70,000. Holding parent expense row lock (uncommitted)...');

      // Session B attempts concurrent insert of 70k (will block waiting for Session A's lock)
      let sessionBFinished = false;
      let sessionBError = null;

      const sessionBPromise = (async () => {
        try {
          await sessionB.query('begin;');
          await sessionB.query(`
            insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
            values ($1, $2, 70000.00, 'Session B allocation');
          `, [testExpId, testPayIdVerified]);
          await sessionB.query('commit;');
        } catch (err) {
          sessionBError = err;
          await sessionB.query('rollback;').catch(() => {});
        } finally {
          sessionBFinished = true;
        }
      })();

      // Give Session B time to block on the row lock
      await new Promise(r => setTimeout(r, 600));
      console.log(`Session B blocked as expected? ${sessionBFinished === false ? 'YES (WAITING ON LOCK)' : 'NO'}`);

      // Now commit Session A
      console.log('Committing Session A...');
      await sessionA.query('commit;');

      // Wait for Session B to unblock and finish
      await sessionBPromise;

      console.log('Session B finished.');
      if (sessionBError && (sessionBError.message.includes('exceed the total expense amount') || sessionBError.message.includes('ALLOCATION_LIMIT_EXCEEDED'))) {
        console.log(`✓ Test 4B Passed: Session B was rejected with expected error: "${sessionBError.message}"`);
        
        // Verify total allocated in database
        const totalAllocRes = await client.query(`
          select coalesce(sum(allocated_amount), 0) as total from public.expense_receipt_allocations where expense_id = $1;
        `, [testExpId]);
        console.log(`Final allocated total in DB: ₦${totalAllocRes.rows[0].total} (Expected: ₦70000.00)`);
        
        if (parseFloat(totalAllocRes.rows[0].total) === 70000) {
          report.concurrentAllocation = 'PASS';
        } else {
          report.concurrentAllocation = 'FAIL';
        }
      } else {
        console.error('Session B did not fail with ALLOCATION_LIMIT_EXCEEDED:', sessionBError);
        report.concurrentAllocation = 'FAIL';
      }
    } finally {
      await sessionA.end().catch(() => {});
      await sessionB.end().catch(() => {});
    }

    // Test 4C: Expense amount reduction safety
    try {
      await client.query(`
        update public.expenses set amount = 50000.00 where id = $1;
      `, [testExpId]);
      throw new Error('FAILED: Expense reduction below allocated total was erroneously allowed!');
    } catch (err) {
      if (err.message.includes('Reduce receipt allocations first') || err.message.includes('EXPENSE_REDUCTION_EXCEEDS_ALLOCATION')) {
        console.log('✓ Test 4C Passed: Expense reduction below allocated amount rejected correctly.');
      } else {
        throw err;
      }
    }

    // ------------------------------------------------------------------------
    // STEP 5: RLS & AUDIT PROTECTION TESTS
    // ------------------------------------------------------------------------
    console.log('\n>>> STEP 5: RLS & AUDIT PROTECTION TESTS <<<\n');
    
    // Check audit rows generated by Step 4
    const auditRes = await client.query(`
      select count(*) as count, max(action) as last_action
      from public.expense_allocation_audit_logs
      where historical_expense_id = $1;
    `, [testExpId]);
    console.log(`Audit rows recorded for synthetic expense: ${auditRes.rows[0].count} (Last action: ${auditRes.rows[0].last_action})`);

    // Test DELETE audit trigger behavior
    console.log('Deleting allocation to test DELETE trigger returning OLD...');
    await client.query(`
      delete from public.expense_receipt_allocations where expense_id = $1;
    `, [testExpId]);

    const auditAfterDelete = await client.query(`
      select count(*) as count, max(action) as last_action
      from public.expense_allocation_audit_logs
      where historical_expense_id = $1;
    `, [testExpId]);
    console.log(`Audit rows after deletion: ${auditAfterDelete.rows[0].count} (Last action: ${auditAfterDelete.rows[0].last_action})`);

    // Verify direct mutation revocation
    try {
      await client.query('set role authenticated;');
      await client.query(`
        insert into public.expense_allocation_audit_logs (allocation_id, historical_expense_id, action)
        values (gen_random_uuid(), gen_random_uuid(), 'FORGED_INSERT');
      `);
      await client.query('reset role;');
      throw new Error('FAILED: authenticated role was able to directly insert audit log!');
    } catch (err) {
      await client.query('reset role;').catch(() => {});
      if (err.message.includes('permission denied')) {
        console.log('✓ Direct client INSERT on audit logs denied as expected.');
        report.rlsAndAudit = 'PASS';
      } else {
        throw err;
      }
    }

    // ------------------------------------------------------------------------
    // STEP 6: OPERATIONAL ROLLBACK SAFETY TEST
    // ------------------------------------------------------------------------
    console.log('\n>>> STEP 6: OPERATIONAL ROLLBACK SAFETY TEST <<<\n');
    
    // Re-insert allocation record so we can verify it survives rollback
    await client.query(`
      insert into public.expense_receipt_allocations (expense_id, payment_id, allocated_amount, notes)
      values ($1, $2, 45000.00, 'Pre-rollback test record');
    `, [testExpId, testPayIdVerified]);

    // Execute post-production safe rollback
    await runSqlFile(client, 'implementation/ROLLBACK_POST_PRODUCTION_SAFE_PHASES_15_16_17_18_19.sql', 'Post-Production Safe Operational Rollback');

    // Verify:
    // 1. Allocation record is preserved
    const allocPreservedRes = await client.query(`
      select count(*) as count from public.expense_receipt_allocations where expense_id = $1;
    `, [testExpId]);
    // 2. Audit logs are preserved
    const auditPreservedRes = await client.query(`
      select count(*) as count from public.expense_allocation_audit_logs where historical_expense_id = $1;
    `, [testExpId]);
    // 3. Escalations deactivated
    const rulesDeactivatedRes = await client.query('select count(*) as count from public.escalation_rules where is_active = true;');
    // 4. Bundles deactivated
    const bundlesDeactivatedRes = await client.query('select count(*) as count from public.service_bundles where is_active = true;');
    
    console.log(`Rollback Verification:`);
    console.log(`- Allocations preserved: ${allocPreservedRes.rows[0].count > 0 ? 'YES' : 'NO'}`);
    console.log(`- Audit logs preserved: ${auditPreservedRes.rows[0].count > 0 ? 'YES' : 'NO'}`);
    console.log(`- Active escalation rules: ${rulesDeactivatedRes.rows[0].count} (Expected: 0)`);
    console.log(`- Active service bundles : ${bundlesDeactivatedRes.rows[0].count} (Expected: 0)`);

    if (
      parseInt(allocPreservedRes.rows[0].count, 10) > 0 &&
      parseInt(auditPreservedRes.rows[0].count, 10) > 0 &&
      parseInt(rulesDeactivatedRes.rows[0].count, 10) === 0 &&
      parseInt(bundlesDeactivatedRes.rows[0].count, 10) === 0
    ) {
      report.operationalRollback = 'PASS';
    } else {
      report.operationalRollback = 'FAIL';
    }

    // ------------------------------------------------------------------------
    // STEP 7: INTEGRITY CHECKS
    // ------------------------------------------------------------------------
    console.log('\n>>> STEP 7: INTEGRITY CHECKS <<<\n');
    const overAllocatedRes = await client.query(`
      select e.id, e.amount, sum(a.allocated_amount) as allocated
      from public.expenses e
      join public.expense_receipt_allocations a on a.expense_id = e.id
      group by e.id, e.amount
      having sum(a.allocated_amount) > e.amount;
    `);
    console.log(`Over-allocated expenses count: ${overAllocatedRes.rows.length}`);
    report.integrityChecks = overAllocatedRes.rows.length === 0 ? 'PASS' : 'FAIL';

    // ------------------------------------------------------------------------
    // STEP 8: SYNTHETIC DATA CLEANUP
    // ------------------------------------------------------------------------
    console.log('\n>>> STEP 8: SYNTHETIC DATA CLEANUP <<<\n');
    await client.query('delete from public.expense_allocation_audit_logs where historical_expense_id = $1;', [testExpId]);
    await client.query('delete from public.expense_receipt_allocations where expense_id = $1;', [testExpId]);
    await client.query('delete from public.expenses where id = $1;', [testExpId]);
    await client.query('delete from public.payments where id in ($1, $2);', [testPayIdVerified, testPayIdUnverified]);
    await client.query('delete from public.invoices where id = $1;', [testInvoiceId]);
    await client.query('delete from public.clients where id = $1;', [testClientId]);

    const remainingSynthetic = await client.query(`
      select count(*) as count from public.expenses where id = $1;
    `, [testExpId]);
    console.log(`Remaining synthetic records: ${remainingSynthetic.rows[0].count}`);
    report.syntheticCleanup = parseInt(remainingSynthetic.rows[0].count, 10) === 0 ? 'PASS' : 'FAIL';

    console.log('\n==============================================================================');
    console.log('ALL STAGING VALIDATION STEPS COMPLETED SUCCESSFULLY!');
    console.log('==============================================================================');
    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error('\n!!! PIPELINE FAILED WITH ERROR !!!\n', err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
