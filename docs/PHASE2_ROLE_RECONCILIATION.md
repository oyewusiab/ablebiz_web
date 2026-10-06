# ABLEBIZ SUITE — PHASE 2 ROLE ARCHITECTURE RECONCILIATION REPORT

**Audit Date:** 2026-10-06  
**Status:** **ROLE ARCHITECTURE — RECONCILIATION REQUIRED**  
**Database Target:** ABLEBIZ SUITE Production Supabase (`https://ksjphkqxudtkduuhnyvn.supabase.co`)  
**Scope:** Investigation of PostgreSQL enums, database tables, architecture specifications, and frontend RBAC implementations.

---

## 1. Executive Summary & Root Cause Analysis

In the previous instructions, two different role sets appeared:
1. **The Phase 0.5 Business Persona Set (User Request):**  
   `managing_director`, `operations_manager`, `compliance_officer`, `accountant`, `legal_officer`, `receptionist_support`, `customer`.  
   *(Notice: Mentioned in conversational prompts as desired executive job titles, including `customer` as a non-staff role).*
2. **The Approved Architecture & Migration DDL Set (`docs/ABLEBIZ-FINAL-ARCHITECTURE.md` §4.1 & `MIGRATION_ABLEBIZ_SUITE.sql` §2):**  
   `super_admin`, `admin`, `operations_manager`, `registration_officer`, `accounts_officer`, `client_service_officer`, `marketing_officer`, `viewer`.

Because `MIGRATION_ABLEBIZ_SUITE.sql` created PostgreSQL enum `public.staff_role` using the approved architectural tiers (with `super_admin`, `admin`, `operations_manager`, `registration_officer`, `accounts_officer`, `client_service_officer`, `marketing_officer`, `viewer`), the Phase 2 frontend implementation created compatibility aliases (`managing_director` -> `super_admin`, `compliance_officer`/`legal_officer` -> `registration_officer`, `accountant` -> `accounts_officer`, `receptionist_support` -> `client_service_officer`) to accept both naming conventions without breaking.

Below is the exhaustive, component-by-component audit.

---

## 2. Detailed Findings

### A. Database Enum Inspection
- **Enum Name in Database:** `public.staff_role` (Defined in `MIGRATION_ABLEBIZ_SUITE.sql` line 36).
- **Note on `public.user_role`:** In the PostgreSQL database, the enum was created as `public.staff_role` (there is no `public.user_role` enum type in the database).
- **Exact Values in `public.staff_role`:**
  1. `super_admin`
  2. `admin`
  3. `operations_manager`
  4. `registration_officer`
  5. `accounts_officer`
  6. `client_service_officer`
  7. `marketing_officer`
  8. `viewer`

### B. Staff Roles in `public.staff_profiles`
- **Column Definition:** `public.staff_profiles.role public.staff_role not null default 'viewer'`
- **Allowed Values:** Strictly constrained by the enum `public.staff_role` (`super_admin`, `admin`, `operations_manager`, `registration_officer`, `accounts_officer`, `client_service_officer`, `marketing_officer`, `viewer`).
- **Current Data State:** All existing active staff profiles in the database conform to this enum. Any attempt to insert an unregistered string (e.g., `'managing_director'`) directly into `staff_profiles.role` without the enum value results in PostgreSQL error `22P02: invalid input value for enum staff_role`.

### C. Permission Roles in `public.roles_permissions`
- **Table Definition:** `public.roles_permissions (role public.staff_role, module text, can_view, can_create, ...)`
- **Foreign / Type Constraint:** `role` is typed as `public.staff_role`.
- **Exact Seeded Role Keys in Database:**
  - `super_admin` (6 modules: `workbench`, `crm`, `operations`, `finance`, `team`, `settings`)
  - `admin` (6 modules: `workbench`, `crm`, `operations`, `finance`, `team`, `settings`)
  - `operations_manager` (4 modules: `workbench`, `crm`, `operations`, `finance`)
  - `registration_officer` (2 modules: `workbench`, `operations`)
  - `accounts_officer` (3 modules: `workbench`, `finance`, `operations`)
  - `client_service_officer` (3 modules: `workbench`, `crm`, `operations`)
  - `marketing_officer` (2 modules: `workbench`, `crm`)
  - `viewer` (4 modules: `workbench`, `crm`, `operations`, `finance`)

### D. Frontend Roles Implementation
- **In `src/auth/AuthContext.tsx`:**
  - `StaffRole` type includes both the canonical 8 database roles AND the 6 conversational aliases (`managing_director`, `compliance_officer`, `accountant`, `legal_officer`, `receptionist_support`, `customer`).
  - A runtime normalization function maps aliases to database canonicals:
    - `managing_director` → `super_admin`
    - `compliance_officer` / `legal_officer` → `registration_officer`
    - `accountant` → `accounts_officer`
    - `receptionist_support` → `client_service_officer`
- **In `src/auth/ProtectedRoute.tsx`:**
  - Guards check `profile.role` against canonical roles and aliases (`super_admin` / `managing_director`).
  - Evaluates `hasPermission(module, action)`.
  - Rejects `customer` role or deactivated staff from accessing internal Suite routes.
- **In `src/components/AdminPortalLayout.tsx`:**
  - Displays human-readable formatted role string (e.g. `Super Admin`, `Operations Manager`, `Accounts Officer`).
  - Renders the `ShieldCheck` icon for executive roles (`super_admin` / `managing_director`).

---

## 3. Role Mapping & Classification Table

| # | Database Enum (`staff_role`) | Frontend Role / Alias | Display Name | Permission Group | Architectural Status |
|:---:|---|---|---|---|---|
| **1** | `super_admin` | `super_admin` / `managing_director` | Managing Director / Super Admin | Executive Management (Full unrestricted Suite access, settings, staff) | **Canonical Production Role** (with MD alias) |
| **2** | `admin` | `admin` | Administrator | General Operations & Management (Broad access excluding team deletion) | **Canonical Production Role** |
| **3** | `operations_manager` | `operations_manager` | Operations Manager | Operations & CAC Delivery (Filing review, tasks, clients, CAC workflows) | **Canonical Production Role** |
| **4** | `registration_officer` | `registration_officer` / `compliance_officer` / `legal_officer` | Compliance & Registration Officer | CAC Filing Operations (Name search, submissions, status updates) | **Canonical Production Role** (Compliance/Legal aliases) |
| **5** | `accounts_officer` | `accounts_officer` / `accountant` | Accounts Officer / Accountant | Operational Finance (Invoicing, payments, expenses, quotations, reconciliation) | **Canonical Production Role** (Accountant alias) |
| **6** | `client_service_officer` | `client_service_officer` / `receptionist_support` | Client Service / Support | Client Intake & CRM (Leads, client onboarding, inquiries, follow-ups) | **Canonical Production Role** (Receptionist alias) |
| **7** | `marketing_officer` | `marketing_officer` | Marketing & Growth Officer | Growth & Referrals (Referrals, campaigns, lead attribution) | **Canonical Production Role** |
| **8** | `viewer` | `viewer` | Read-Only Observer | Auditing & Oversight (Read-only on assigned records) | **Canonical Production Role** |
| **—** | *N/A (Not in DB enum)* | `customer` | Customer / Client | Future Client Portal (Strictly BLOCKED from internal Suite) | **External Future Role** (Client portal, non-staff) |

---

## 4. Architecture Comparison

### A. What Matches Exactly
1. **Separation of Concerns:** Executive oversight, operational management, financial administration, client intake, and CAC filing are cleanly partitioned in both models.
2. **Security Gate:** Non-staff/customer accounts are strictly denied Suite entry.
3. **Database RLS Alignment:** Row Level Security policies (`public.current_staff_role()`, `public.is_active_staff()`) function seamlessly with the current database enum values.

### B. What is Discrepant
1. **Enum Naming vs. Prompt Naming:**
   - The database enum uses **functional software roles**: `super_admin`, `admin`, `operations_manager`, `registration_officer`, `accounts_officer`, `client_service_officer`, `marketing_officer`, `viewer`.
   - The conversational prompt used **office job titles**: `managing_director`, `operations_manager`, `compliance_officer`, `accountant`, `legal_officer`, `receptionist_support`.
2. **Missing Granularity in Job Titles:**
   - In an enterprise firm like ABLEBIZ, `marketing_officer` and `viewer` are essential roles present in the database but omitted from the 7-item prompt list.
   - `compliance_officer` and `legal_officer` are two legal/compliance specialties that currently map to the single operational filing role `registration_officer`.

---

## 5. Strategic Recommendation

### Option 1 (Recommended — Zero DDL Friction, Zero Risk to Live Data):
**Adopt the Database 8-Tier Functional Model with Professional UI Labeling:**
- Keep the database enum `public.staff_role` and `public.roles_permissions` exactly as they are (`super_admin`, `admin`, `operations_manager`, `registration_officer`, `accounts_officer`, `client_service_officer`, `marketing_officer`, `viewer`).
- In the frontend, map display labels to the user's preferred business titles:
  - `super_admin` → displayed in UI as **Managing Director**
  - `operations_manager` → displayed in UI as **Operations Manager**
  - `registration_officer` → displayed in UI as **Compliance & Registration Officer**
  - `accounts_officer` → displayed in UI as **Accountant / Finance Officer**
  - `client_service_officer` → displayed in UI as **Receptionist / Client Support**
  - `marketing_officer` → displayed in UI as **Marketing Officer**
  - `admin` → displayed in UI as **System Administrator**
  - `viewer` → displayed in UI as **Staff Observer**
- **Advantage:** No SQL migration required, no database risk, no enum recreation, instant compatibility with the verified Phase 1 schema.

---

### Option 2 (Strict Job Title Migration — Requires New Database Migration):
If you specifically want the PostgreSQL enum values to literally be `managing_director`, `compliance_officer`, `accountant`, `legal_officer`, `receptionist_support`:
- A separate database migration script would be required to:
  1. Add new enum labels to `public.staff_role` (e.g. `ALTER TYPE public.staff_role ADD VALUE 'managing_director'`, etc.).
  2. Update rows in `roles_permissions` to seed rules for the new enum values.
  3. Update `current_staff_role()` RLS checks where applicable.
- **Tradeoff:** Additional SQL migration step before Phase 3 can begin.

---

## 6. Implementation Gate Status

In accordance with your explicit instructions:
- **Zero database modifications** were performed.
- **Zero data was altered**.
- Work is paused for your decision.

**Status:** **ROLE ARCHITECTURE — RECONCILIATION REQUIRED**

Please indicate whether you approve **Option 1 (Clean UI mapping to verified database roles)** or prefer **Option 2 (New SQL migration to add/alter enum values in PostgreSQL)** before we unlock **Phase 3 (Enterprise Shell & Manager Workbench)**.
