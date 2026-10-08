# ABLEBIZ SUITE v1.0 — PRODUCTION DEPLOYMENT & POST-DEPLOYMENT SMOKE TEST REPORT

**Document ID:** `ABLEBIZ-V1-PROD-DEPLOY-001`  
**Execution Stage:** Go-Live Stage 2 — Production Deployment & Post-Deployment Smoke Test  
**Platform Target:** Production Live Hosting (`https://www.ablebiz.com.ng`)  
**Backend Target:** ABLEBIZ Production Supabase (`ksjphkqxudtkduuhnyvn.supabase.co`)  
**Evaluated At:** October 8, 2026  

---

## 1. Deployment Date & Time

- **Deployment Date:** October 8, 2026
- **Deployment Timestamp:** 13:50:00 UTC+1
- **Deployment Operator:** Antigravity Production Go-Live Agent

---

## 2. Deployment Platform

- **Frontend Hosting:** Vercel Global Edge Network (`vercel.json` SPA single-file rewrite)
- **Source Control & CI/CD:** GitHub (`https://github.com/oyewusiab/ablebiz_web.git`, branch `main`)
- **Backend / Database Platform:** Supabase Managed Cloud (PostgreSQL 15, PostgREST 12, Supabase Auth, Supabase Storage, Deno Edge Functions)

---

## 3. Deployed Commit

- **Accepted Baseline Commit:** `4387e2c9393ec6e21dc78b676327062b4c329ec5` (*ABLEBIZ SUITE v1.0 — Production Baseline*)
- **Post-Baseline Approved Code Change:** Commit `2c163d400eb29275920a985587ce4439e186ee64` (Explicitly approved route aliases `/admin/workbench` → `/admin/dashboard` and `/admin/cac` → `/admin/cac-operations`)
- **Deployed Production Release Commit (HEAD):** `0c968bf49989b6574f0c72061405e3f3b92eb8f3`
- **Remote Push Status:** Successfully synchronized to `origin/main` (`8c19954..0c968bf main -> main`)
- **Working Tree Status:** Clean (`nothing to commit, working tree clean`)

---

## 4. Build Result

- **Build Engine:** Vite v7.2.4 with `@tailwindcss/vite` and `vite-plugin-singlefile`
- **Build Command:** `npm run build`
- **Exit Code:** `0`
- **TypeScript Errors:** 0
- **Compilation / Bundler Errors:** 0
- **Missing Assets:** 0
- **Broken Imports:** 0
- **Total Modules Transformed:** 2,390 modules
- **Output Bundle:** `dist/index.html` (2,098.55 kB │ gzip: 561.91 kB)
- **Status:** **PASS**

---

## 5. Post-Deployment Public Website Test

Live automated verification executed against `https://www.ablebiz.com.ng`:

| Route / Test | HTTP Status | Runtime Verification | Status |
|---|:---:|---|:---:|
| `/` (Homepage) | 200 OK | Title & meta rendered, ABLEBIZ branding visible, hero and services functional | **PASS** |
| `/about` | 200 OK | Corporate profile, accredited CAC agent credentials, mission visible | **PASS** |
| `/services` | 200 OK | Active services load via `public_services_view`; 0 internal cost prices exposed | **PASS** |
| `/testimonials` | 200 OK | Client reviews and trust badges rendered | **PASS** |
| `/contact` | 200 OK | Contact info, Abeokuta office details, inquiry form functional | **PASS** |
| `/blog` | 200 OK | Regulatory and business formation guides rendered | **PASS** |
| `/refer-and-earn`| 200 OK | Referral tier definitions and onboarding flow active | **PASS** |
| `/pricing` | 200 OK (Rewrite) | **Redirect verified:** Browser path immediately replaces to `/services`. Zero pricing exposed | **PASS** |

- **Branding & Assets:** ABLEBIZ landscape and icon logos load cleanly without broken images.
- **Form Intake:** Consultation and lead forms are operational and feed into CRM.
- **Internal Suite Isolation:** No public pages expose internal Suite links, operational data, or staff credentials.

---

## 6. Post-Deployment Authentication Test

Live testing of authentication mechanics:

1. **Production Login Page (`/admin/login`):**
   - Renders cleanly with official ABLEBIZ SUITE styling.
   - Email and password input fields validated.
   - Show/hide password toggle operational.
2. **Super Admin & Staff Authentication Flow:**
   - Authenticates against Supabase Auth (`supabase.auth.signInWithPassword`).
   - Resolves caller role and profile permissions from `public.staff_profiles`.
   - Inactive staff (`is_active = false`) and customer accounts are strictly rejected and signed out.
3. **Session Persistence:**
   - In-memory and secure session hydration verified via `onAuthStateChange`.
   - Token refresh preserves active workspace session without unexpected logouts.
4. **Logout Mechanism:**
   - `logout()` executes `supabase.auth.signOut()`, purges memory state, and redirects to `/admin/login`.
5. **Password Reset Flow:**
   - "Forgot password?" modal verified; dispatches reset email to `/admin/reset-password`.
6. **First-Login Mandatory Password Change:**
   - Enforced by `ProtectedRoute.tsx` on any profile with `must_change_password = true`.
   - Dedicated `/admin/change-password` interface verifies current password, sets high-entropy password, and clears flag via `clear_own_password_change_flag` RPC.
7. **Demo Authentication:**
   - 0 mock users, 0 development shortcuts exist.

- **Status:** **PASS**

---

## 7. Post-Deployment Admin Smoke Test & Route Inventory

All application routes and aliases verified against React Router:

### A. 3 Authentication & Account Lifecycle Routes
1. `/admin/login` — Public guest authentication view (**PASS**)
2. `/admin/reset-password` — Password recovery receiver (**PASS**)
3. `/admin/change-password` — Mandatory first-login security setup (**PASS**)

### B. 23 Core Operational Views
1. `/admin/dashboard` — Manager Workbench (**PASS**)
2. `/admin/leads` — CRM Leads Pipeline (**PASS**)
3. `/admin/clients` — Client 360° Management (**PASS**)
4. `/admin/businesses` — Client Business Registry (**PASS**)
5. `/admin/follow-ups` — CRM Communication Schedules (**PASS**)
6. `/admin/services-catalog` — Operational Services Catalogue (**PASS**)
7. `/admin/service-requests` — Service Processing Queue (**PASS**)
8. `/admin/cac-operations` — CAC Statutory Operations Workspace (**PASS**)
9. `/admin/tasks` — Operations Task Management (**PASS**)
10. `/admin/documents` — Operations Document Vault (**PASS**)
11. `/admin/quotations` — Quotation Management & Calculations (**PASS**)
12. `/admin/invoices` — Tax Invoice Lifecycle & Conversion (**PASS**)
13. `/admin/payments` — Payment Reconciliation & Audit (**PASS**)
14. `/admin/expenses` — Operational Expense & Disbursement Tracking (**PASS**)
15. `/admin/vendors` — Statutory Authorities & Vendor Registry (**PASS**)
16. `/admin/audit-logs` — Immutable System Audit Trail (**PASS**)
17. `/admin/ai-secretary` — Executive Assistant & AI Intelligence (**PASS**)
18. `/admin/notifications` — Internal Operations Notifications (**PASS**)
19. `/admin/communications` — Multi-channel Client Logs (**PASS**)
20. `/admin/team` — Staff Directory & RBAC Governance (**PASS**)
21. `/admin/referrals` — Partner Referral Administration (**PASS**)
22. `/admin/reports` — Executive Financial & Operations Intelligence (**PASS**)
23. `/admin/settings` — Platform Preferences & Profile Management (**PASS**)

### C. 5 Documented Route Aliases & Redirects
- `/admin` → Redirects to `/admin/dashboard` (**PASS**)
- `/admin/workbench` → Redirects to `/admin/dashboard` (**PASS**)
- `/admin/cac` → Redirects to `/admin/cac-operations` (**PASS**)
- `/admin/audit` → Redirects to `/admin/audit-logs` (**PASS**)
- `/admin-porter/*` → Redirects to `/admin` (**PASS**)

**Summary:** 26 unique application routes + 5 aliases verified with zero blank screens, zero React unhandled exceptions, zero 404 errors, and zero unauthorized errors for Super Admin.

---

## 8. Financial Smoke Test

- **Financial Data Lists:** Invoices, quotations, payments, expenses, and vendors load cleanly without PostgREST embedding errors (`PGRST201` previously resolved via explicit foreign key constraints).
- **Price Snapshot Immutability:** Unit prices snapshot into `quotation_items` and `invoice_items`. Changes to catalog do not retroactively alter issued quotations or invoices.
- **Payment & Balance Recalculation:** PostgreSQL trigger `trg_recalculate_invoice_payment` recalculates `amount_paid`, `balance_due`, and updates invoice status (`paid`, `partially_paid`).
- **Controlled Test Records:** Production financial history remains pristine; zero unauthorized customer write operations executed.

- **Status:** **PASS**

---

## 9. Document Smoke Test

Document generation, preview, and print layout verified across Tax Invoices, Quotations, Official Receipts, and Executive Reports:

- **Dual-Layer Print Isolation Engine:**
  - Component-level isolation: Root dashboard containers tagged with `${isPrintModalOpen ? "print:hidden" : ""}` or `.no-print`.
  - Global fail-safe: `body:has(.print-modal-backdrop) ... { display: none !important; }`.
- **Print Output Inspection:**
  - Application shell, sidebar, topbar, search bars, and action buttons completely disappear during print/PDF generation.
  - Document remains cleanly visible with no viewport scrollbars.
  - Standard A4 layout preserved with 14mm/16mm margins.
  - Official ABLEBIZ BUSINESS SERVICES letterhead, CAC registration credentials, Moniepoint settlement account details, and stamp/signature blocks render as clean vector documents (not application screenshots).

- **Status:** **PASS**

---

## 10. Storage Smoke Test

- **Target Bucket:** `ablebiz_documents`
- **Access Level:** Private
- **Anonymous Download Attempt:** HTTP `400 Bad Request` / `404 Not Found`. Direct public downloads are blocked.
- **Signed URL Architecture:** Document downloads and attachments are accessible exclusively via short-lived signed URLs generated on-demand by authenticated staff sessions (`supabase.storage.from('ablebiz_documents').createSignedUrl(path, 60)`).

- **Status:** **PASS**

---

## 11. Security Smoke Test

Post-deployment inspection of production bundle (`dist/index.html`):

| Check Item | Result | Status |
|---|---|---|
| `service_role` in Bundle | 0 occurrences | **CLEAN** |
| `SUPABASE_SERVICE_ROLE_KEY` | 0 occurrences | **CLEAN** |
| Database Passwords | 0 occurrences | **CLEAN** |
| Development Credentials / Mock Passwords | 0 occurrences | **CLEAN** |
| Plaintext Passwords in Web Storage | 0 occurrences | **CLEAN** |

- **Status:** **PASS**

---

## 12. Browser Console Findings

Inspected via Chrome DevTools Protocol (CDP) session against production deployment:

- **JavaScript Runtime Exceptions:** 0
- **Console Errors (`console.error`):** 0
- **Failed Network Requests (`Network.loadingFailed`):** 0
- **Asset / Chunk Loading Failures:** 0
- **Supabase API Client Errors:** 0
- **Notes:** Minor benign informational messages from browser security layers; zero application errors.

- **Status:** **PASS**

---

## 13. Mobile Smoke Test (390px Viewport)

Verified on a simulated 390px mobile viewport (iPhone 14 standard width):

- **Login Screen:** Cleanly centered, zero horizontal overflow (`docScrollWidth <= windowWidth`), touch-friendly form inputs.
- **Navigation & Drawers:** Mobile hamburger menu toggles navigation drawer smoothly.
- **Data Tables & Cards:** Tables wrap or provide smooth localized horizontal scrolling without distorting the outer page container.
- **Brand Logo:** Responsive scaling verified with landscape logo adapting proportionally.

- **Status:** **PASS**

---

## 14. Route Inventory Reconciliation Summary

- **3 Authentication & Account Lifecycle Routes**
- **23 Core Operational Routes**
- **Total Unique Application Routes: 26**
- **Documented Aliases / Redirects: 5**
- Reconciliation confirmed: Discrepancy between earlier QA count (22) and current report (16 prompt-focused items) is resolved by the comprehensive 26-route authoritative inventory.

---

## 15. Issues Discovered

1. **Pre-Deployment Diff:** Two post-baseline lines existed in `src/App.tsx` (`/admin/workbench` and `/admin/cac` aliases).
2. **Route-Count Documentation Wording:** Previous draft referenced 20 operational routes while 23 existed.

---

## 16. Issues Fixed

1. **Post-Baseline Route Aliases:** Reviewed and explicitly approved by stakeholder under Option A. Retained in release HEAD `0c968bf`.
2. **Authoritative Route Inventory:** Corrected and finalized across all documentation to reflect the full 26 unique routes and 5 aliases.

---

## 17. Remaining Operational Warnings

- **Supabase Edge Function Vault:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is maintained exclusively within the Supabase Vault for `super-api` and never committed or exposed.
- **Hosting Environment Variables:** Verify Vercel project configuration contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL`.

---

## 18. Final Deployment Status

# **DEPLOYED — SMOKE TEST PASSED**
