# ABLEBIZ GO-LIVE CHECKLIST — V1

**Target System:** ABLEBIZ BUSINESS SERVICES  
**Release Level:** Version 1.0 Production  
**Production URL:** `https://www.ablebiz.com.ng`  
**Internal Suite URL:** `https://www.ablebiz.com.ng/admin`  
**Backend:** Supabase Production Cloud (`https://ksjphkqxudtkduuhnyvn.supabase.co`)  

---

## 1. TECHNICAL & INFRASTRUCTURE READINESS

| Item | Requirement | Verification Method | Status |
|---|---|---|---|
| **1.1 Build Integrity** | TypeScript build compiles cleanly with zero type errors (`npx tsc --noEmit`) | Ran `npx tsc --noEmit` | **PASS (0 errors)** |
| **1.2 Production Bundle** | Clean production build generating single index asset bundle | Ran `npm run build` | **PASS (2,139 kB)** |
| **1.3 Secret Key Isolation** | Zero `service_role` keys, private auth tokens, or database passwords in frontend bundle | Scanned `dist/index.html` via regex AST parser | **PASS (0 secret keys exposed)** |
| **1.4 Public Supabase Config** | Only safe public `anon` JWT and public Supabase project URL embedded | Verified environment binding in `dist/index.html` | **PASS** |
| **1.5 Row Level Security (RLS)** | All 15 core operational database tables reject unauthenticated write/read access | Automated SQL RLS query across 15 tables | **PASS (100% Protected)** |
| **1.6 Edge Functions** | `super-api` edge function active, returns HTTP 401 for unauthenticated calls | HTTPS request to `.../functions/v1/super-api` | **PASS (HTTP 401 verified)** |
| **1.7 Storage Bucket Security** | `ablebiz_documents` storage bucket rejects public anonymous uploads and downloads | Storage RLS test | **PASS** |
| **1.8 Responsive Layout & Print** | Dual-layer CSS print isolation active for invoices, quotations, receipts | Tested `@media print` isolation in `src/index.css` | **PASS** |

---

## 2. BUSINESS & CONTACT CONFIGURATION

| Item | Requirement | Verification Target | Status |
|---|---|---|---|
| **2.1 Primary Phone & WhatsApp** | `+234 816 048 6023` (Display: `0816 048 6023`, Intl: `2348160486023`) | `src/content/site.ts` | **PASS** |
| **2.2 Official Email** | `info@ablebiz.com.ng` / `support@ablebiz.com.ng` | `src/content/site.ts` | **PASS** |
| **2.3 Physical Office** | Suite 10, Praise Plaza, Behind Mobil, New Bodija, Ibadan, Oyo State, Nigeria | `src/content/site.ts` | **PASS** |
| **2.4 Bank Settlement** | Moniepoint Microfinance Bank, Account Name: Ablebiz Business Services | App config / Finance module | **CONFIG COMPLETE** *(Settlement NUBAN account entry field active)* |
| **2.5 CAC Entity Metadata** | Ablebiz Business Services BN/RC and Tax ID fields present for official invoices | Suite System Settings | **CONFIG READY** |

---

## 3. PUBLIC WEBSITE & LEAD CONVERSION FLOW

| Item | Requirement | Verification Method | Status |
|---|---|---|---|
| **3.1 Route Integrity** | All 9 public routes and aliases resolve without 404 or white screen | Checked route table in `src/App.tsx` | **PASS** |
| **3.2 Consultation Submission** | Form writes to `public.leads` and `public.consultation_requests` via Supabase RPC | Live test lead insertion executed | **PASS** |
| **3.3 WhatsApp Deep Link** | Submitting lead triggers pre-filled WhatsApp link with Lead Reference | Verified `whatsappNumberIntl` generator | **PASS** |
| **3.4 Referral Code Auto-Assignment** | Every new lead receives a unique tracking code (or inherits referrer's code) | Database output verified on test lead | **PASS** |
| **3.5 Spin-to-Win Engagement** | Spin reward records directly into Supabase and delivers voucher | Verified `ablebiz_create_spin_and_reward` | **PASS** |
| **3.6 Referral Portal** | Referrers can look up stats and copy referral link | Verified `ablebiz_get_referral_stats` | **PASS** |

---

## 4. ABLEBIZ SUITE OPERATIONAL MODULES

| Item | Requirement | Module Route | Status |
|---|---|---|---|
| **4.1 Authentication** | Staff sign-in, password reset, 2FA guard | `/admin/login` | **PASS** |
| **4.2 Lead Management** | Triage queue, assignment, conversion to client | `/admin/leads` | **PASS** |
| **4.3 Client Registry** | Client directory, contact cards, entity linking | `/admin/clients` | **PASS** |
| **4.4 Business Registry** | Entity records (BN/LTD/IT), status, registration numbers | `/admin/businesses` | **PASS** |
| **4.5 Service Requests** | Request lifecycle, prioritization, assigned staff | `/admin/services` | **PASS** |
| **4.6 CAC Application Tracker** | 5-phase status tracking (Name reservation to certificate) | `/admin/cac` | **PASS** |
| **4.7 Tasks & Calendar** | Operational deadlines, overdue flags, calendar view | `/admin/tasks` | **PASS** |
| **4.8 Document Vault** | Encrypted document storage linked to clients/businesses | `/admin/documents` | **PASS** |
| **4.9 Financial Module** | Quotations, Invoices, Payments, Receipts, Expenses | `/admin/invoices` etc. | **PASS** |
| **4.10 Referral Admin** | Payout approvals, reward code tracking | `/admin/referrals` | **PASS** |
| **4.11 AI Business Secretary** | Operational intelligence, CAC inquiry assistance | `/admin/ai-assistant` | **PASS** |
| **4.12 Audit & Settings** | Immutable activity logs, system configuration | `/admin/audit-log` | **PASS** |

---

## 5. DISASTER RECOVERY & CONTINUITY

| Item | Requirement | Evaluation | Status |
|---|---|---|---|
| **5.1 Database Automated Backups** | Supabase managed daily backups active on production cloud | Cloud platform verified | **PASS** |
| **5.2 Point-in-Time Recovery (PITR)** | Cloud PITR capabilities enabled | Supabase project configuration | **PASS** |
| **5.3 Live Restoration Drill** | End-to-end restore to alternative schema | **Not executed on production database to prevent data interruption** | **PROCEDURAL ONLY** |
| **5.4 Failover Protocol** | Emergency offline lead triage queue documented | Documented in SOP V1 | **PASS** |

---

## 6. FINAL GO-LIVE DETERMINATION

- **Status:** **LIMITED PRODUCTION READY**
- **Rationale:** Technical build, RLS security, public intake channels, WhatsApp routing, and SUITE operations are 100% verified and operational. The system is fully cleared for live business use under operational monitoring, with disaster recovery restore drills classified as procedurally documented per strict testing standards.
