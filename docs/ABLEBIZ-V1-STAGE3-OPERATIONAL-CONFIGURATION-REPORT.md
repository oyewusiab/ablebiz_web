# ABLEBIZ SUITE v1.0 — STAGE 3 OPERATIONAL CONFIGURATION & STAFF ONBOARDING REPORT

**Document ID:** `ABLEBIZ-V1-STAGE3-CONFIG-001`  
**Stage:** Go-Live Stage 3 — Staff Onboarding & Operational Configuration  
**System:** ABLEBIZ SUITE v1.0 Enterprise Operations Platform  
**Target Environment:** Production Live Platform (`https://www.ablebiz.com.ng`)  
**Backend:** ABLEBIZ Production Supabase (`ksjphkqxudtkduuhnyvn.supabase.co`)  
**Date of Audit:** October 8, 2026  

---

## 1. Current Staff Inventory & Directory Audit

An empirical inspection of the production staff directory (`public.staff_profiles`) and identity linkages (`auth.users`) reveals the following current state:

| Staff Name | Email Address | Canonical Role | Human / UI Title | Active Status | `auth_uid` Linkage | Auth Status | `must_change_password` |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Adebayo Oyewusi** | `oyewusi.adebayo1@gmail.com` | `super_admin` | Managing Director | `true` (Active) | Linked (`49066a67-...`) | `provisioned` | `false` (Operational) |
| **Adeyemi Oyewusi** | `ablebizconsult@gmail.com` | `admin` | Executive Admin | `true` (Active) | Legacy unlinked | `not_provisioned` | `true` (Enforced) |
| **Hammad Yusuf** | `hay@gmail.com` | `operations_manager` | Operations Manager | `true` (Active) | Legacy unlinked | `not_provisioned` | `true` (Enforced) |
| **Oyewusi Ejibusola** | `ejisquare1@gmail.com` | `registration_officer` | Compliance Officer | `true` (Active) | Legacy unlinked | `not_provisioned` | `true` (Enforced) |
| **Samuel Salako** | `salako@gmail.com` | `viewer` | Internal Auditor | `true` (Active) | Legacy unlinked | `not_provisioned` | `true` (Enforced) |

### Key Findings & Identity Integrity Rules:
1. **Single Operational Super Admin:** Only `oyewusi.adebayo1@gmail.com` currently holds an active, confirmed Supabase Auth identity.
2. **Orphaned Profile Protection:** The 4 team member profiles (`ablebizconsult@gmail.com`, `hay@gmail.com`, `ejisquare1@gmail.com`, `salako@gmail.com`) are preserved in `staff_profiles` with `auth_status = 'not_provisioned'`.
3. **No Direct SQL User Creation:** In accordance with zero-trust protocols, no fake Auth accounts or SQL-manufactured hashes exist.
4. **Authoritative Provisioning Pipeline:** Onboarding must occur exclusively via the server-side Edge Function (`super-api`), which uses the Supabase Auth Admin API (`adminClient.auth.admin.createUser`) with cryptographic 14-character passwords and `email_confirm: true`.

---

## 2. Staff Role Governance & RBAC Inventory

The platform strictly uses the **8 canonical database roles** defined in the PostgreSQL `staff_role` enum:

1. `super_admin`: Full, unconstrained platform authority. Maker-checker final authority.
2. `admin`: Day-to-day administrative authority across CRM, Operations, Finance, and Reports. Subject to maker-checker approval for staff modifications.
3. `operations_manager`: Operations lead managing Service Requests, CAC filing pipelines, Tasks, Document vault, and operational metrics.
4. `registration_officer`: Specialist handling CAC registrations, status tracking, task execution, and client document processing.
5. `accounts_officer`: Financial operator managing quotations, invoices, payments, expense records, and fiscal reports.
6. `client_service_officer`: CRM operator managing client onboarding, inquiries, lead follow-ups, and customer communications.
7. `marketing_officer`: Growth lead managing referral channels, campaigns, and lead acquisition.
8. `viewer`: Read-only compliance and auditing role.

*Note: UI designations such as "Managing Director" or "Compliance Officer" are human-friendly labels mapped to canonical roles.*

---

## 3. Staff Account Governance (Maker-Checker Workflow)

The two-man rule / maker-checker staff governance model implemented in `src/pages/admin/Team.tsx` and PostgreSQL triggers is verified:

- **Super Admin Authority:**
  - Direct staff creation and one-time temporary credential generation via `super-api`.
  - Instant role reassignment, activation, deactivation, and deprovisioning.
  - Review, approval, or rejection of pending Admin change requests.
  - Safeguard trigger: `trg_protect_last_super_admin` prevents deactivation or role downgrading of the last active Super Admin.
- **Admin Authority:**
  - Cannot directly provision, alter roles, or deprovision staff accounts.
  - Can submit formal change requests (`staff_change_requests` table) with mandatory business justifications.
  - Requests remain in `pending` state until explicitly approved or rejected by a Super Admin.

---

## 4. Business Configuration Audit

An audit of the business identity settings across the codebase and database:

| Configuration Item | Current Configured Value | Status |
|---|---|:---:|
| **Business Name** | `ABLEBIZ Business Services` | **Configured** |
| **Brand Logo** | Vector Landscape & Icon SVG assets (`src/components/BrandLogo.tsx`) | **Configured** |
| **Physical Address** | `Abeokuta, Ogun State, Nigeria` (General location) | **CONFIGURATION REQUIRED** *(Exact street address needed)* |
| **Public Email** | `hello@ablebiz.com.ng` | **Configured** |
| **Staff Reference Email** | `staff@ablebiz.com.ng` | **Configured** |
| **Phone Number** | `0816 048 6023` / Intl WhatsApp `+2348160486023` | **Configured** |
| **Corporate Website** | `https://www.ablebiz.com.ng` | **Configured** |
| **CAC Accreditation / Registration** | Accredited CAC Agent in Abeokuta (Number not specified) | **CONFIGURATION REQUIRED** *(BN/RC number needed)* |
| **Tax Identification Number (TIN)**| Unspecified on profile | **CONFIGURATION REQUIRED** *(Company TIN needed)* |
| **Settlement Bank Name** | `Moniepoint Microfinance Bank` | **Configured** |
| **Settlement Account Name** | `Ablebiz Business Services` | **Configured** |
| **Settlement Account Number** | Dynamic placeholder in forms | **CONFIGURATION REQUIRED** *(10-digit NUBAN needed)* |
| **Document Footer** | Branded footer with location, email, and tracking reference | **Configured** |
| **Default Invoice Terms** | *"Payment due within 7 days of invoice issuance. Remit to Moniepoint MFB - Ablebiz Business Services."* | **Configured** |
| **Quotation Validity** | 7-day default price validity snapshot | **Configured** |

---

## 5. Service Catalogue Review

All 6 core operational services are seeded in `public.services_catalog` and exposed safely via `public.public_services_view`:

| Service Name | Category | Turnaround | Default Fee (NGN) | Min Fee (NGN) | Est. Cost (NGN) | Public Pricing | Suite Pricing |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **CAC Business Name Registration** | `cac_registration` | 5 days | ₦35,000.00 | ₦25,000.00 | ₦10,000.00 | **Hidden** | **Active** |
| **CAC Company Registration (LLC)** | `cac_registration` | 7 days | ₦75,000.00 | ₦55,000.00 | ₦22,000.00 | **Hidden** | **Active** |
| **CAC Incorporated Trustees / NGO**| `cac_registration` | 21 days | ₦180,000.00 | ₦140,000.00 | ₦60,000.00 | **Hidden** | **Active** |
| **CAC Annual Returns Filing** | `compliance` | 3 days | ₦25,000.00 | ₦18,000.00 | ₦5,000.00 | **Hidden** | **Active** |
| **SCUML Certificate Registration** | `compliance` | 14 days | ₦50,000.00 | ₦38,000.00 | ₦10,000.00 | **Hidden** | **Active** |
| **TIN & Tax Clearance Processing** | `tax` | 4 days | ₦30,000.00 | ₦20,000.00 | ₦5,000.00 | **Hidden** | **Active** |

- **Public Protection:** Verified. Zero fees, costs, or margins leak to visitors on `https://www.ablebiz.com.ng/services`.
- **Suite Quoting & Billing:** Operational. Services pre-populate into quotations and snapshot into invoices.

---

## 6. Financial Configuration Audit

1. **Accepted Payment Methods:**
   - `bank_transfer` (Standard Moniepoint direct deposit)
   - `pos` (Point of sale card terminal)
   - `cash` (Office direct deposit)
   - `online_gateway` (Future automated settlement)
   - `cheque` (Corporate instruments)
2. **Billing Controls:**
   - Net payment terms: 7 days default (adjustable to 14 or 30 days).
   - Invoices with recorded payments are locked against financial item tampering.
   - Atomic balance trigger: `trg_recalculate_invoice_payment` maintains real-time ledger consistency.
3. **Expense Classifications:**
   - Statutory: `cac_filing_fee`, `firs_tax_fee`, `scuml_fee`, `stamp_duty`
   - Operational: `office_supplies`, `transportation`, `software_cloud`, `logistics`, `utilities`, `other`
4. **Vendors Registry:**
   - Supports statutory bodies (CAC, FIRS, SCUML) and local service partners.
5. **No Synthetic Financial Records:**
   - Zero test invoices, zero fake payments, zero mock disbursements.

---

## 7. Operational Workflow Configuration

1. **CAC 11-Stage Pipeline:**
   - `new_request` → `documents_required` → `documents_verified` → `name_search` → `name_reserved` → `application_prepared` → `application_submitted` → `under_cac_review` → `approved` → `documents_received` → `completed`.
   - Exception paths: `rejected`, `cancelled`.
2. **Task & Priority Engine:**
   - Priorities: `low`, `normal`, `high`, `urgent`.
   - Statuses: `pending`, `in_progress`, `completed`, `blocked`.
3. **Document Vault Classifications:**
   - `client_id_card`, `cac_certificate`, `status_report`, `scuml_certificate`, `tax_clearance`, `payment_receipt`, `other`.
4. **Follow-Up Schedules:**
   - Statuses: `pending`, `completed`, `cancelled`, `rescheduled`.
5. **Client Communications:**
   - Supported channels: `whatsapp`, `phone_call`, `email`, `in_person`, `sms`.

---

## 8. Production Data Policy

To ensure the production platform maintains authentic legal and financial accounting standards:

> **STRICT POLICY:** No fictional clients, synthetic business entities, mock quotations, simulated invoices, or dummy disbursements shall ever be inserted into the production database to artificially populate dashboard graphs.
> 
> Dashboards will reflect genuine operational transactions as ABLEBIZ BUSINESS SERVICES commences live client intake.

---

## 9. Staff Onboarding Plan

Before dispatching credentials, the following onboarding schedule is established:

| Target Staff | Email | Canonical Role | Human Job Title | Access Scope | Provisioning Method | First Login Requirement |
|:---|:---|:---:|:---:|:---|:---:|:---:|
| **Adebayo Oyewusi** | `oyewusi.adebayo1@gmail.com` | `super_admin` | Managing Director | Full Unrestricted Access | Already Provisioned | Standard Login |
| **Adeyemi Oyewusi** | `ablebizconsult@gmail.com` | `admin` | Executive Administrator | Workbench, CRM, Ops, Finance, Team, Reports | Edge Function Reconcile | Force New Password on First Login |
| **Hammad Yusuf** | `hay@gmail.com` | `operations_manager` | Operations Manager | Workbench, CRM, Operations, Reports | Edge Function Reconcile | Force New Password on First Login |
| **Oyewusi Ejibusola** | `ejisquare1@gmail.com` | `registration_officer` | Compliance & Registration | Workbench, Operations (CAC, Tasks, Docs) | Edge Function Reconcile | Force New Password on First Login |
| **Samuel Salako** | `salako@gmail.com` | `viewer` | Internal Auditor | Read-only across Workbench & Operations | Edge Function Reconcile | Force New Password on First Login |

### Onboarding Execution Protocol:
1. Super Admin logs into `/admin/team`.
2. For each staff member with `auth_status = 'not_provisioned'`, Super Admin clicks **"Reconcile Account"**.
3. `super-api` provisions a genuine Supabase Auth user with `must_change_password: true`.
4. The generated one-time secure credential is conveyed privately to the staff member.
5. On initial login, the staff member is automatically redirected to `/admin/change-password` to establish a private permanent password.

---

## 10. Operational Source of Truth Declaration

Formal governance principle:

> **ABLEBIZ SUITE v1.0 is the official, authoritative operational source of truth** for all business data of ABLEBIZ BUSINESS SERVICES, including:
> - Clients & Client 360° Profiles
> - Registered Businesses & Enterprises
> - Service Requests & Statutory Orders
> - Daily Operational Tasks & Assignments
> - CAC Applications & Stage Tracking
> - Document Vault & Statutory Credentials
> - Official Quotations & Invoices
> - Payment Collections & Balance Reconciliations
> - Operating Expenses & Vendor Disbursements
> - Client Communications & Follow-ups
> - Staff Performance & Executive Reporting

---

## 11. Configuration Gaps & Action Items for Super Admin

The following items are flagged for official input by ABLEBIZ management:

1. **Moniepoint NUBAN Account Number:** Provide the 10-digit account number to replace dynamic billing prompts on invoices and quotations.
2. **Official CAC Agent Accreditation Number:** Provide accredited agent number for automatic display on formal status reports and consultation briefs.
3. **Physical Office Street Address:** Provide detailed office address in Abeokuta to complement the general "Abeokuta, Ogun State" location.
4. **Company Tax Identification Number (TIN):** Provide corporate TIN for official tax invoices.

---

## 12. Final Status

# **CONFIGURATION GAPS FOUND**

*(Staff onboarding architecture and services catalogue are fully operational and ready. Formal onboarding can begin immediately for the 4 staff members while management supplies the 4 business configuration items above.)*
