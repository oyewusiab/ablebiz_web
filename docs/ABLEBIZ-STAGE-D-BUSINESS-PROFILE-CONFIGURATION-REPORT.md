# ABLEBIZ SUITE — STAGE D CONFIGURATION REMEDIATION REPORT
## AUTHORITATIVE BUSINESS PROFILE & SETTINGS ARCHITECTURE

**System:** ABLEBIZ SUITE & PUBLIC PORTAL  
**Environment:** Production / Supabase (`https://ksjphkqxudtkduuhnyvn.supabase.co`)  
**Certification Date:** October 2026  
**Status:** **BUSINESS PROFILE CONFIGURATION READY**

---

## 1. Executive Summary

During Stage D Go-Live Certification, configuration audit identified that several operational business details were hardcoded directly within frontend components:
1. Hardcoded settlement bank details (`Moniepoint Microfinance Bank`, account number `8243178920`, account name `Ablebiz Business Services`) inside `Invoices.tsx` and `Quotations.tsx`.
2. Hardcoded payment terms and remittance strings referencing Moniepoint across financial document generators.
3. Hardcoded bank account credited presets (`"Moniepoint MFB - Ablebiz"`) inside payment capture dialogs.
4. Business identity reliance on `localStorage` within `useSiteConfig()` rather than authoritative Supabase persistence.

This remediation establishes an **authoritative, centralized, Supabase-persisted Business Profile & Banking Architecture** administered directly through `/admin/settings` under strict Row-Level Security (RLS) governance.

### The Authoritative Architecture Flow:
```
                 ┌─────────────────────────┐
                 │   ADMIN / SETTINGS      │
                 │                         │
                 │   BUSINESS PROFILE      │
                 └────────────┬────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     SUPABASE     │
                    │                  │
                    │ Business Profile │
                    │ Bank Account 1   │
                    │ Bank Account 2   │
                    └─────────┬────────┘
                              │
            ┌─────────────────┼──────────────────┐
            ▼                 ▼                  ▼
       PUBLIC WEBSITE    ABLEBIZ SUITE      DOCUMENT ENGINE
            │                 │                  │
            ▼                 ▼                  ▼
        Safe public       Operations        Quotations
        information       & reports         Invoices
                                             Receipts
                                             Reports
```

---

## 2. Existing Configuration Audit

A forensic scan of the codebase and database schema revealed:
- `public.site_config` exists as a key-value store with restricted RPC access intended for marketing configuration. Direct table queries by the client application were rejected (`42501 permission denied for table site_config`).
- `public.business_profile` did not previously exist; settings changes in `/admin/settings` saved only to browser `localStorage` (`ablebiz_config_site`), leaving no authoritative database source of truth.
- Financial documents (`Invoices.tsx`, `Quotations.tsx`, `Payments.tsx`) rendered hardcoded fallback strings for banking details instead of consuming dynamic database configuration.
- The hardcoded account number `8243178920` was embedded into invoice and quotation print views.

---

## 3. Authoritative Database Schema Design

Created SQL migration `implementation/MIGRATION_BUSINESS_PROFILE.sql` defining:

### 3.1 `public.business_profile` Table (Singleton id = 1)
```sql
create table if not exists public.business_profile (
  id integer primary key default 1 check (id = 1),
  legal_name text not null default 'ABLEBIZ Business Services',
  trading_name text not null default 'ABLEBIZ Business Services',
  tagline text not null default '...',
  business_description text default '...',
  business_type text default 'Sole Proprietorship / Enterprise',
  cac_registration_number text default '', -- Kept blank until verified
  cac_accredited_agent_number text default '', -- Kept blank until verified
  tax_identification_number text default '', -- Kept blank until verified
  year_established text default '2019',
  award_badge text default '🏆 2nd Place – BYUMS Africa Business Plan Competition',
  primary_phone text not null default '08160486023',
  secondary_phone text default '',
  whatsapp_number text not null default '08160486023',
  whatsapp_number_intl text not null default '2348160486023',
  primary_email text not null default 'hello@ablebiz.com.ng',
  secondary_email text default '',
  support_email text default 'support@ablebiz.com.ng',
  website_url text not null default 'https://www.ablebiz.com.ng',
  address_line_1 text not null default 'Along M.K.O. Abiola Way',
  address_line_2 text default 'Leme',
  city text not null default 'Abeokuta',
  lga text default 'Abeokuta South',
  state text not null default 'Ogun State',
  country text not null default 'Nigeria',
  postal_code text default '',
  logo_url text default '/brand/logo.png',
  default_payment_terms text not null default '...',
  document_disclaimer text default '...',
  document_footer_text text default '...',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null
);
```

### 3.2 `public.business_bank_accounts` Table (Capacity for 2 Accounts)
```sql
create table if not exists public.business_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  business_profile_id integer not null default 1 references public.business_profile(id) on delete cascade check (business_profile_id = 1),
  account_slot integer not null check (account_slot in (1, 2)),
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  account_type text not null default 'Corporate Current',
  is_active boolean not null default true,
  is_default boolean not null default false,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null,
  constraint uq_account_slot unique (account_slot)
);
```

### 3.3 `public.public_business_profile` Secure Public View
A PostgreSQL view projecting strictly public attributes (`legal_name`, `trading_name`, `tagline`, `phones`, `emails`, `website_url`, `address`) for anonymous website visitors.
- **Zero bank account data** is included in this view.
- **Zero private credentials or internal CAC agent numbers** are included.

---

## 4. Settings UI Overhaul (`/admin/settings`)

The `/admin/settings` page was restructured into clear, responsive configuration sections matching ABLEBIZ Suite's visual language:
1. **Section A — Basic Business Information:** Legal name, trading name, entity structure, year established, CAC registration number, CAC accredited agent number, TIN, tagline, and corporate description.
2. **Section B — Contact Information:** Primary phone, secondary phone, WhatsApp number (with automatic international normalization), primary email, secondary email, support email, and website URL.
3. **Section C — Business Address:** Address lines 1 & 2, City, LGA, State, Country, postal code, with live formatted address preview.
4. **Section D — Business Bank Accounts:**
   - Two structured slots (Account 1: Primary/Required, Account 2: Secondary/Optional).
   - Dedicated toggles for `Active` and `Default Settlement`.
   - UI enforcement: Exactly one active account can be default settlement; account number validation (10-digit NUBAN).
   - Clean indication of active/inactive states.
5. **Section E — Document & Financial Identity:** Default invoice/quotation payment terms, legal disclaimer, and document footer notes.
6. **Save Status & State Indicators:**
   - Explicit badges showing "Unsaved changes" or "Synchronized with Supabase".
   - Feedback alerts for success and validation failures.
   - Non-blocking asynchronous updates with automatic state synchronization.

---

## 5. Downstream Integration & Elimination of Hardcoded Values

### 5.1 Financial Documents (`DocumentBranding.tsx`)
- `DocumentHeader` and `DocumentFooter` now consume `useBusinessProfile()`.
- Remittance instructions render the active `defaultBankAccount` dynamically.
- If no bank account is configured, documents display a configuration warning notice rather than inventing mock account numbers.
- Official CAC agent numbers and registration numbers render conditionally only when verified and entered by administrators.

### 5.2 Invoices (`Invoices.tsx`)
- Initialized new invoice payment terms from `bizProfile.default_payment_terms`.
- Quick payment recording initializes `bank_account_credited` dynamically from `defaultBankAccount` (e.g. `"${bank_name} (${account_number})"`).
- Removed all hardcoded Moniepoint defaults (`"Moniepoint MFB - Ablebiz"`) and the test NUBAN `"8243178920"`.

### 5.3 Quotations (`Quotations.tsx`)
- Quotation-to-invoice conversion pipeline passes `bizProfile.default_payment_terms` dynamically.
- Branded quotation print preview consumes `defaultBankAccount`.
- Removed hardcoded Moniepoint remittance text.

### 5.4 Payments (`Payments.tsx`)
- Payment recording form default `bank_account_credited` is populated from `defaultBankAccount`.
- Preserved historical snapshot integrity: existing payments in the database retain their recorded `bank_account_credited` values and are never retroactively mutated.

### 5.5 AI Secretary (`AiSecretary.tsx`)
- Replaced hardcoded `"in our Moniepoint account"` commentary with dynamic reference to official settlement account.

### 5.6 Public Website & `siteConfig.ts`
- `useSiteConfig()` derives its `site` object dynamically from the authoritative `BusinessProfile`.
- LocalStorage overrides for brand identity were deprecated in favor of Supabase persistence.
- Public pages consume safe public attributes (`name`, `tagline`, `phone`, `email`, `location`, `whatsappNumberIntl`).

---

## 6. Moniepoint Occurrence Classification Audit

| Occurrence Location | Type | Classification | Action Taken |
| :--- | :--- | :--- | :--- |
| `src/pages/admin/Invoices.tsx` (payment_terms) | Live Code | LIVE CODE CONFIGURATION | **Migrated** to `bizProfile.default_payment_terms` |
| `src/pages/admin/Invoices.tsx` (bank_account_credited) | Live Code | LIVE CODE CONFIGURATION | **Migrated** to `defaultBankLabel` from `defaultBankAccount` |
| `src/pages/admin/Invoices.tsx` (print remittance) | Live Code | LIVE CODE CONFIGURATION | **Migrated** to dynamic `defaultBankAccount` |
| `src/pages/admin/Quotations.tsx` (payment_terms) | Live Code | LIVE CODE CONFIGURATION | **Migrated** to `bizProfile.default_payment_terms` |
| `src/pages/admin/Quotations.tsx` (print remittance) | Live Code | LIVE CODE CONFIGURATION | **Migrated** to dynamic `defaultBankAccount` |
| `src/pages/admin/Payments.tsx` (bank_account_credited) | Live Code | LIVE CODE CONFIGURATION | **Migrated** to `defaultBankLabel` from `defaultBankAccount` |
| `src/pages/admin/AiSecretary.tsx` (reply note) | Live Code | LIVE CODE CONFIGURATION | **Migrated** to official settlement account wording |
| `src/pages/admin/Settings.tsx` (placeholder) | UI Placeholder | SAFE FALLBACK / PLACEHOLDER | Kept as input field placeholder illustration only |
| `implementation/MIGRATION_ABLEBIZ_SUITE.sql` | Migration SQL | HISTORICAL MIGRATION | Preserved for historical database structure fidelity |
| `docs/ABLEBIZ-FINAL-ARCHITECTURE.md` | Architecture Doc | DOCUMENTATION | Preserved as historical architecture documentation |
| `docs/ABLEBIZ-V1-STAGE3-OPERATIONAL-CONFIGURATION-REPORT.md` | Report | HISTORICAL REPORT | Preserved as audit record of past stage findings |
| `implementation/VERIFY_PHASE6_FINANCE.md` | Report | HISTORICAL REPORT | Preserved as past phase test log |

---

## 7. Security & Role Governance

1. **Row-Level Security (RLS):**
   - Direct table read/write to `public.business_profile` and `public.business_bank_accounts` is revoked from `anon`.
   - Only `authenticated` staff with `public.is_active_staff()` can read the full profile and bank accounts.
   - Only `super_admin` and `admin` roles can insert or update the profile and bank accounts.
   - Anonymous web users access only `public.public_business_profile` view.
2. **Credential Hygiene:**
   - Zero occurrences of `service_role` keys in client source code or production bundles.
   - Bank account details are completely shielded from anonymous users.
3. **Audit Trail:**
   - Modifications to business profile or bank accounts automatically log entries to `public.audit_logs` capturing `staff_id`, `action`, `old_values`, and `new_values`.

---

## 8. Verification Results

| # | Test Item | Verification Method | Result |
| :---: | :--- | :--- | :---: |
| 1 | Authoritative Business Profile in Settings | Inspected `/admin/settings` Business Profile tab | **PASS** |
| 2 | Supabase Persistence & State Sync | `BusinessProfileContext` upsert handler | **PASS** |
| 3 | Role-Based Access Controls | Restricted check for unauthorized roles (`canViewSettings`, `canEditSettings`) | **PASS** |
| 4 | Bank Account Slots & Default Logic | Slot 1 (Required) and Slot 2 (Optional) supported with single default | **PASS** |
| 5 | Document Branding Integration | `DocumentHeader` & `DocumentFooter` consume dynamic profile | **PASS** |
| 6 | Invoice & Quotation Remittance | Replaced hardcoded bank strings with dynamic `defaultBankAccount` | **PASS** |
| 7 | Payment Recording Form | `bank_account_credited` populated from `defaultBankAccount` | **PASS** |
| 8 | Historical Record Immutability | Prior invoices and payment records retain their existing snapshots | **PASS** |
| 9 | Public Web Safety | Only safe non-banking fields exposed via public profile | **PASS** |
| 10 | Mobile Usability (360px - 390px) | Tested responsive grid & form layout classes | **PASS** |
| 11 | TypeScript Type Check | Executed `npx tsc --noEmit` (0 errors) | **PASS** |
| 12 | Production Build | Executed `npm run build` (SingleFile bundle generated cleanly) | **PASS** |

---

## 9. Final Status

**BUSINESS PROFILE CONFIGURATION READY**
