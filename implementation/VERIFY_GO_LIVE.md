# ABLEBIZ SUITE — VERIFICATION & TEST SCRIPTS (GO-LIVE)

**Target Environment:** ABLEBIZ Supabase Production (`ksjphkqxudtkduuhnyvn.supabase.co`)  
**Purpose:** End-to-end verification script suite for operational scenarios and boundary tests.

---

## Part 1: Automated SQL Security & Schema Integrity Verification

Run the following queries in the Supabase SQL Editor to verify database hardening:

```sql
-- 1. Verify All 22 Production Tables Have RLS Enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'staff_profiles', 'roles_permissions', 'clients', 'businesses',
    'service_catalog', 'service_requests', 'cac_applications', 'tasks',
    'quotations', 'quotation_items', 'invoices', 'invoice_items',
    'payments', 'receipts', 'expenses', 'vendors', 'leads',
    'follow_ups', 'activity_timeline', 'audit_logs', 'notifications',
    'document_vault'
  );
-- EXPECTED: rowsecurity = true for all 22 tables.

-- 2. Verify Anonymous Access Denial on Financial Records
SET ROLE anon;
SELECT count(*) FROM public.invoices;
-- EXPECTED: 0 records returned (Permission Denied / RLS filter)

SELECT count(*) FROM public.payments;
-- EXPECTED: 0 records returned

SELECT count(*) FROM public.staff_profiles;
-- EXPECTED: 0 records returned
RESET ROLE;

-- 3. Verify Public Services View Accessibility for Public Website
SET ROLE anon;
SELECT count(*), min(name) FROM public.public_services_view;
-- EXPECTED: Returns active public services without exposing cost_price or margins.
RESET ROLE;
```

---

## Part 2: Financial Calculation & Constraint Test Scenarios

### Scenario A: Partial Payment Followed by Full Payment Reconciliation
1. **Quotation Issuance:** Create quotation for ₦100,000 with ₦7,500 VAT = ₦107,500 total.
2. **Invoice Generation:** Convert quotation to invoice (`INV-2026-0001`). `total_amount` = 107,500, `amount_paid` = 0, `balance_due` = 107,500, `status` = 'unpaid'.
3. **Partial Payment (50% Deposit):** Record payment of ₦50,000 via Bank Transfer.
   - **Verification:** Invoice automatically updates to `amount_paid` = 50,000, `balance_due` = 57,500, `status` = 'partially_paid'.
   - **Receipt Check:** Receipt `REC-2026-XXXX` generated for ₦50,000 with matched payment transaction reference.
4. **Final Payment (Balance):** Record payment of ₦57,500.
   - **Verification:** Invoice automatically updates to `amount_paid` = 107,500, `balance_due` = 0, `status` = 'paid'.
   - **Receipt Check:** Receipt generated for ₦57,500 with zero outstanding balance.

### Scenario B: Overpayment Validation
1. Attempt to record a payment of ₦60,000 against an invoice with a `balance_due` of ₦50,000.
2. **Expected Behavior:** System halts transaction with validation error: *"Payment amount (₦60,000) exceeds current balance due (₦50,000). Overpayments must be authorized as account credit."*

---

## Part 3: Document Vault Privacy & Signed URL Verification

```bash
# 1. Direct Unauthenticated Storage Access (Must Fail)
curl -I https://ksjphkqxudtkduuhnyvn.supabase.co/storage/v1/object/public/ablebiz_documents/test-document.pdf
# EXPECTED: HTTP/1.1 400 Bad Request or 404 Not Found (Bucket is private)

# 2. Authenticated Signed URL Access (Must Succeed)
# Generated via supabase.storage.from('ablebiz_documents').createSignedUrl(path, 60)
# Returns HTTP 200 with temporary exp token valid for 60 seconds.
```

---

## Part 4: Staff Role Route Guard Matrix

| URL / Route | Allowed Roles | Disallowed Behavior |
|---|---|---|
| `/admin/reports` | `super_admin`, `admin`, `operations_manager`, `accounts_officer` | Redirect to `/admin` or show 403 Forbidden |
| `/admin/audit-logs` | `super_admin`, `admin` | Redirect to `/admin` |
| `/admin/finance` | `super_admin`, `admin`, `accounts_officer` | Hidden or read-only based on role policy |
| `/admin/operations` | `super_admin`, `admin`, `operations_manager`, `registration_officer` | Read-only for non-operations staff |
