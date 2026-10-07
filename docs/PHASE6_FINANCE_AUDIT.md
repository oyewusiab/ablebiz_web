# ABLEBIZ SUITE — PHASE 6A: FINANCE DATA & SCHEMA AUDIT REPORT

**Date:** 2026-10-07  
**Module:** Phase 6 — Operational Finance (Quotations, Invoices, Payments, Receipts & Expenses)  
**Database Specification:** ABLEBIZ SUITE Production Enterprise Specification v1.2 (Executed in Phase 1)  
**Status:** **AUDIT COMPLETE — 0 SCHEMA GAPS (100% READY FOR IMPLEMENTATION)**

---

## 1. Executive Summary

A comprehensive audit of the production Supabase database schema, enums, triggers, RLS policies, and frontend finance dependencies was performed in accordance with the Phase 6 directives.

The verified Phase 1 schema already contains:
1. Complete normalized financial tables (`quotations`, `quotation_items`, `invoices`, `invoice_items`, `payments`, `vendors`, `expenses`).
2. Exact custom enums for statuses and payment methods (`quotation_status`, `invoice_status`, `payment_method_type`).
3. Automated database trigger `trg_recalculate_invoice_payment` executing `public.recalculate_invoice_payment_balance()` to maintain invoice balance due, amount paid, and status integrity.
4. Active Row-Level Security (RLS) guaranteeing staff-only access.
5. Strict separation between internal pricing in `services_catalog` and the sanitized `public_services_view`.

**Conclusion:** **Zero schema modifications, zero DDL migrations, and zero database alterations are required.**

---

## 2. Production Financial Tables Inventory

### 2.1 `public.quotations`
- **Columns:**
  - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
  - `quotation_number`: `text not null unique`
  - `service_request_id`: `uuid references public.service_requests(id) on delete set null`
  - `client_id`: `uuid not null references public.clients(id) on delete restrict`
  - `business_id`: `uuid references public.businesses(id) on delete set null`
  - `quotation_date`: `date not null default current_date`
  - `valid_until`: `date not null default (current_date + interval '14 days')`
  - `subtotal`: `numeric(14,2) not null default 0.00`
  - `discount_amount`: `numeric(14,2) not null default 0.00`
  - `tax_amount`: `numeric(14,2) not null default 0.00`
  - `total_amount`: `numeric(14,2) not null default 0.00`
  - `terms_and_conditions`: `text`
  - `internal_notes`: `text`
  - `status`: `public.quotation_status not null default 'draft'`
  - `created_by`: `uuid references public.staff_profiles(id) on delete set null`
  - `approved_by`: `uuid references public.staff_profiles(id) on delete set null`
  - `created_at`: `timestamptz not null default now()`
  - `updated_at`: `timestamptz not null default now()`
- **Indexes:** `idx_quotations_sr_id`, `idx_quotations_client_id`, `idx_quotations_status`.

### 2.2 `public.quotation_items`
- **Columns:**
  - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
  - `quotation_id`: `uuid not null references public.quotations(id) on delete cascade`
  - `service_id`: `uuid references public.services_catalog(id) on delete set null`
  - `description`: `text not null`
  - `quantity`: `integer not null default 1`
  - `unit_price`: `numeric(14,2) not null default 0.00` *(Price snapshot at quotation creation)*
  - `total_price`: `numeric(14,2) not null default 0.00`
  - `created_at`: `timestamptz not null default now()`
- **Indexes:** `idx_quotation_items_qid`.

### 2.3 `public.invoices`
- **Columns:**
  - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
  - `invoice_number`: `text not null unique`
  - `quotation_id`: `uuid references public.quotations(id) on delete set null`
  - `service_request_id`: `uuid references public.service_requests(id) on delete set null`
  - `client_id`: `uuid not null references public.clients(id) on delete restrict`
  - `business_id`: `uuid references public.businesses(id) on delete set null`
  - `issue_date`: `date not null default current_date`
  - `due_date`: `date not null default (current_date + interval '7 days')`
  - `subtotal`: `numeric(14,2) not null default 0.00`
  - `discount`: `numeric(14,2) not null default 0.00`
  - `tax`: `numeric(14,2) not null default 0.00`
  - `total_amount`: `numeric(14,2) not null default 0.00`
  - `amount_paid`: `numeric(14,2) not null default 0.00`
  - `balance_due`: `numeric(14,2) not null default 0.00`
  - `status`: `public.invoice_status not null default 'draft'`
  - `payment_terms`: `text`
  - `notes`: `text`
  - `created_by`: `uuid references public.staff_profiles(id) on delete set null`
  - `created_at`: `timestamptz not null default now()`
  - `updated_at`: `timestamptz not null default now()`
- **Indexes:** `idx_invoices_client_id`, `idx_invoices_sr_id`, `idx_invoices_status`.

### 2.4 `public.invoice_items`
- **Columns:**
  - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
  - `invoice_id`: `uuid not null references public.invoices(id) on delete cascade`
  - `service_id`: `uuid references public.services_catalog(id) on delete set null`
  - `description`: `text not null`
  - `quantity`: `integer not null default 1`
  - `unit_price`: `numeric(14,2) not null default 0.00` *(Price snapshot frozen at invoice creation)*
  - `total_price`: `numeric(14,2) not null default 0.00`
  - `created_at`: `timestamptz not null default now()`
- **Indexes:** `idx_invoice_items_inv_id`.

### 2.5 `public.payments`
- **Columns:**
  - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
  - `receipt_number`: `text not null unique`
  - `invoice_id`: `uuid not null references public.invoices(id) on delete restrict`
  - `client_id`: `uuid not null references public.clients(id) on delete restrict`
  - `amount`: `numeric(14,2) not null check (amount > 0)`
  - `payment_date`: `timestamptz not null default now()`
  - `payment_method`: `public.payment_method_type not null default 'bank_transfer'`
  - `transaction_reference`: `text`
  - `bank_account_credited`: `text default 'Moniepoint MFB - Ablebiz'`
  - `notes`: `text`
  - `received_by`: `uuid references public.staff_profiles(id) on delete set null`
  - `is_verified`: `boolean not null default true`
  - `created_at`: `timestamptz not null default now()`
- **Indexes:** `idx_payments_invoice_id`, `idx_payments_client_id`.

### 2.6 `public.vendors`
- **Columns:**
  - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
  - `name`: `text not null`
  - `category`: `text not null default 'statutory_authority'`
  - `contact_person`: `text`
  - `phone`: `text`
  - `email`: `text`
  - `account_details`: `text`
  - `notes`: `text`
  - `is_active`: `boolean not null default true`
  - `created_at`: `timestamptz not null default now()`
  - `updated_at`: `timestamptz not null default now()`

### 2.7 `public.expenses`
- **Columns:**
  - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
  - `vendor_id`: `uuid references public.vendors(id) on delete set null`
  - `service_request_id`: `uuid references public.service_requests(id) on delete set null`
  - `amount`: `numeric(14,2) not null check (amount > 0)`
  - `expense_date`: `date not null default current_date`
  - `category`: `text not null`
  - `receipt_document_id`: `uuid`
  - `paid_by`: `uuid references public.staff_profiles(id) on delete set null`
  - `payment_method`: `text default 'bank_transfer'`
  - `description`: `text`
  - `created_at`: `timestamptz not null default now()`
- **Indexes:** `idx_expenses_sr_id`.

---

## 3. Financial Custom Types & Enums

| Enum Name | Canonical Database Values |
|---|---|
| `public.quotation_status` | `'draft'`, `'sent'`, `'viewed'`, `'accepted'`, `'rejected'`, `'expired'`, `'converted'`, `'cancelled'` |
| `public.invoice_status` | `'draft'`, `'sent'`, `'partially_paid'`, `'paid'`, `'overdue'`, `'cancelled'`, `'refunded'` |
| `public.payment_method_type` | `'bank_transfer'`, `'pos'`, `'cash'`, `'online_gateway'`, `'cheque'` |

---

## 4. Trigger & Database Balance Engine

The database trigger `trg_recalculate_invoice_payment` executes:
```sql
create or replace function public.recalculate_invoice_payment_balance()
returns trigger language plpgsql as $$
declare
  v_invoice_id uuid;
  v_total_paid numeric(14,2);
  v_total_amount numeric(14,2);
  v_new_balance numeric(14,2);
  v_new_status public.invoice_status;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(amount), 0.00)
  into v_total_paid
  from public.payments
  where invoice_id = v_invoice_id and is_verified = true;

  select total_amount, status
  into v_total_amount, v_new_status
  from public.invoices
  where id = v_invoice_id;

  v_new_balance := greatest(0.00, v_total_amount - v_total_paid);

  if v_total_paid >= v_total_amount and v_total_amount > 0 then
    v_new_status := 'paid'::public.invoice_status;
  elsif v_total_paid > 0 then
    v_new_status := 'partially_paid'::public.invoice_status;
  end if;

  update public.invoices
  set
    amount_paid = v_total_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    updated_at = now()
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;
```
**Architecture Rule:** The frontend will **never** manually overwrite `amount_paid` or `balance_due`. Inserting or updating a record in `public.payments` invokes this trigger, which guarantees atomic consistency.

---

## 5. Security & Row-Level Security (RLS)

- **RLS Enabled:** `quotations`, `quotation_items`, `invoices`, `invoice_items`, `payments`, `vendors`, `expenses`.
- **Policy:** `"Active staff full access on <table>"` restricted to authenticated users where `public.is_active_staff() = true`.
- **Public Protection:** Public visitors only query `public.public_services_view`, which strips `default_fee_ngn`, `min_fee_ngn`, `internal_cost_estimate`, and `pricing_notes`.

---

## 6. Documented Gap & Schema Alignment Result

- **No Schema Additions Required:** All tables, enums, foreign keys, triggers, and RLS policies are in place.
- **Frontend Dashboard Adjustment:** In `src/pages/admin/Dashboard.tsx`, adjust legacy column aliases (`amount_ngn` -> `amount`, `payment_status` -> `status`, `total_amount_ngn` -> `total_amount`) to strictly align with canonical column names.
- **Sequential Numbering:** Human-readable numbers generated with standard format:
  - Quotations: `QT-YYYYMM-XXXX`
  - Invoices: `INV-YYYYMM-XXXX`
  - Receipts: `REC-YYYYMM-XXXX`
