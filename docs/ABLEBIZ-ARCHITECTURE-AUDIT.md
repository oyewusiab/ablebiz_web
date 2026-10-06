# ABLEBIZ SUITE — Architecture Audit & System Inventory
**Phase 0.5: Repository Inspection & Discovery Baseline**
**Date:** October 2026  
**System:** ABLEBIZ BUSINESS SERVICES (Abeokuta, Ogun State, Nigeria)  
**Target Platform:** ABLEBIZ SUITE – Internal Business Management & Operations Platform

---

## 1. Executive Summary

This audit establishes the baseline state of the **ABLEBIZ BUSINESS SERVICES** codebase before beginning the migration to **ABLEBIZ SUITE**. The repository currently contains a functional marketing website paired with an early-stage admin portal that relies primarily on browser `localStorage` and demo credentials.

A partial Supabase backend was previously architected (`implementation/SUPABASE_BACKEND.sql`), but was never connected to the frontend forms or the admin portal. This document details the exact technical inventory, architectural gaps, duplicate files, security findings, and migration requirements.

---

## 2. Environment & Security Audit

### 2.1 Git Status & Tracked Files
- **Tracked Files**: Git currently tracks the main website and admin pages on branch `main`.
- **Untracked Duplicate Files**: Over 120 files with Windows copy suffixes (` (2).*`, ` (3).*`) exist in `src/`, `public/`, and the root directory. These are uncommitted explorer duplicate artifacts.

### 2.2 Environment Variables & Key Exposure Audit
- **Root `.env` / `.env.local`**: Not currently present in the project root.
- **`implementation/.env.local`**:
  - `VITE_SUPABASE_URL`: `https://ksjphkqxudtkduuhnyvn.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (Verified: Contains payload `{"role":"anon"}`)
  - `VITE_SITE_URL`: `http://localhost:5173`
- **Git History Key Scan**:
  - Full search of all commits (`git log -S "service_role" --all`) verified that **NO Supabase `service_role` or secret key has ever been committed** to this repository.
  - The only occurrences of `"service_role"` in git history are advisory documentation notes in `implementation/DEPLOYMENT_GUIDE.md` instructing administrators never to expose the service-role key.
- **Gitignore Audit**:
  - Current `.gitignore` contains `*.local`, which successfully prevented `implementation/.env.local` from being tracked.
  - **Required Hardening**: `.gitignore` must explicitly include `.env`, `.env*.local`, and `.env.production` to prevent accidental credential leakage in future commits.

### 2.3 Authentication Security Gap
- Current `src/auth/AuthContext.tsx` implements **mock localStorage authentication**:
  - Default users with plaintext passwords (`admin@ablebiz.com` / `admin123`, `super@ablebiz.com` / `super123`) are loaded if localStorage is empty.
  - Session is stored in plaintext in `sessionStorage.getItem("ablebiz_auth_user")`.
  - Passwords are stored in plaintext in `localStorage.getItem("ablebiz_auth_users")`.
  - **Correction**: Must be completely replaced with Supabase Auth (`supabase.auth.signInWithPassword`, JWT verification, and RLS).

---

## 3. Inventory of Existing Pages & Components

### 3.1 Public Website Pages (To Be Preserved)
| File | Role & Status | Data Interactions |
|---|---|---|
| `src/pages/Home.tsx` | Main landing page, video walkthrough, trust badges | Leads to WhatsApp / Spin / Consultation |
| `src/pages/About.tsx` | Company profile, founder bio, accreditation details | Static presentation |
| `src/pages/Services.tsx` | Service catalog (individual services, checklists) | Spin & Win banner, consultation form link |
| `src/pages/Testimonials.tsx` | Client reviews & WhatsApp proof screenshots | Static presentation |
| `src/pages/Contact.tsx` | Office address (M.K.O. Abiola Way, Abeokuta), map, form | Embeds `ConsultationForm` |
| `src/pages/BlogIndex.tsx` | Articles on CAC compliance, business structuring | Static markdown content |
| `src/pages/BlogPost.tsx` | Individual blog post reader | Static markdown content |
| `src/pages/Referrals.tsx` | Partner program portal with milestone reward tiers | Reads/writes `localStorage` referral client |
| `src/pages/NotFound.tsx` | 404 handler | Static |

### 3.2 Lead Capture & Website Components
| Component | Current Implementation | Target Supabase Integration |
|---|---|---|
| `ConsultationForm.tsx` | Writes to `localStorage.getItem("ablebiz_consultation_leads")` | Must call `rpcCreateConsultationRequest` / `leads` |
| `SpinAndWinModal.tsx` | Writes to `localStorage.getItem("ablebiz_spin_users")` & `rewards` | Must call `rpcCreateSpinAndReward` / `leads` |
| `LeadMagnetModal.tsx` | Writes to `localStorage.getItem("ablebiz_leads")` | Must call `rpcCreateChecklistDownload` / `leads` |
| `ReferralsPage.tsx` | Writes to `localStorage.getItem("ablebiz_ref_clients")` | Must call `leads` / `referral_events` |

### 3.3 Existing Admin Portal Pages (To Be Overhauled into ABLEBIZ SUITE)
| File | Current Implementation | Status / Disposition |
|---|---|---|
| `src/pages/admin/Login.tsx` | Plaintext localStorage authentication | **REPLACE**: Supabase Auth login |
| `src/pages/admin/Dashboard.tsx` | LocalStorage aggregations for leads and spins | **REPLACE**: Manager Workbench & Ops Dashboard |
| `src/pages/admin/Clients.tsx` | LocalStorage client table and basic editor modal | **OVERHAUL**: Enterprise Client 360° Profile |
| `src/pages/admin/Referrals.tsx` | LocalStorage referral tracking and manual points | **MIGRATE**: Supabase-backed Referral Management |
| `src/pages/admin/Reports.tsx` | LocalStorage 6-month trends and referral chart | **OVERHAUL**: Operational & Financial Analytics |
| `src/pages/admin/Settings.tsx` | LocalStorage site config including obsolete package pricing | **REFACTOR**: Remove package pricing; keep staff/site config |

---

## 4. Existing Supabase Assets & Database Inventory

The file `implementation/SUPABASE_BACKEND.sql` contains an initial schema designed for marketing funnels:

### 4.1 Existing Tables (Preserved & Extended)
1. `public.leads`: Captures inbound contacts (source: spin, consultation, checklist, referral, direct).
2. `public.spin_rewards`: Spin wheel reward codes, types, and fulfillment statuses.
3. `public.referral_events`: Log of referee-referrer connections and reward points.
4. `public.consultation_requests`: Inbound consultation inquiries with service needed and urgency.
5. `public.checklist_downloads`: Log of PDF guide downloads.
6. `public.admin_users`: Preliminary admin account mapping linked to `auth_uid`.
7. `public.admin_audit_log`: Primitive action logger.
8. `public.site_config`: Key-value store for site settings.
9. `public.spin_reward_configs`: Dynamic configuration for spin wheel prizes.
10. `public.referral_tier_configs`: Dynamic configuration for referral milestones.

### 4.2 Existing RPC Functions (Preserved)
- `ablebiz_create_spin_and_reward`: Atomic lead generation and reward assignment.
- `ablebiz_create_consultation_request`: Atomic lead creation and consultation filing.
- `ablebiz_create_checklist_download`: Atomic lead creation and download tracking.
- `ablebiz_get_monthly_leaderboard`: Public monthly referral rankings.
- `ablebiz_get_referral_stats`: Public status check for referrer codes.

---

## 5. Architectural Deficiencies & Obsolete Features

1. **Disconnected Public Inflow**:
   Public website components never actually call `src/lib/supabaseApi.ts`; submissions are trapped in the visitor's local browser storage.
2. **Missing Operational Entities**:
   There are currently **no database tables or UI modules** for:
   - Businesses (incorporated entities)
   - Independent Services Catalog
   - Service Requests (the central operational object)
   - CAC Operations & Applications
   - Quotations & Quotation Items
   - Invoices & Invoice Items
   - Payments & Receipts
   - Expenses & Vendors
   - Operational Tasks & Assignees
   - Supabase Storage Documents
   - Client Communications (Calls, WhatsApp, Emails)
   - Staff Profiles & Granular Permission Gates
3. **Clarification of Pricing Architecture (Public Website vs. ABLEBIZ SUITE)**:
   - **Public Website**: Must NOT display pricing, package tiers (Starter/Standard/Premium), or package comparison tables. Service pages present deliverables, requirements, and CTAs for inquiries.
   - **ABLEBIZ SUITE (Internal Portal)**: Retains and enhances complete pricing control. Staff need to configure internal service fees, prepare editable quotations with discount authority, generate invoices with line-item prices, record payments, calculate balances, and analyze financial performance.
   - **Historical Package Structures**: Existing package structures (`src/content/pricing.ts`) are **DEPRECATED & ARCHIVED** for historical price reference without destroying any historical financial or transactional records. The Admin Settings package editor is **MIGRATED** into internal Service Catalog & Fee Configuration.
4. **Duplicate Untracked File Clutter**:
   120+ uncommitted files with ` (2).*` and ` (3).*` in their names clutter the filesystem.

---

## 6. Concise Inventory Classification: KEEP / MODIFY / REMOVE / ADD / MIGRATE

| Classification | Items |
|---|---|
| **KEEP** | - All public website pages (`Home`, `About`, `Services`, `Testimonials`, `Contact`, `BlogIndex`, `BlogPost`, `NotFound`)<br>- Public branding, logos, infographics, and PDF generators (`checklistPdf.ts`, `ebookPdf.ts`)<br>- Existing public Supabase RPC functions (`ablebiz_create_*`)<br>- Tailwind CSS & Vite build configuration<br>- **All historical customer, transaction, and quotation records (zero data destruction)** |
| **MODIFY** | - `.gitignore` (explicitly ignore `.env`, `.env*.local`)<br>- `src/auth/AuthContext.tsx` (switch to Supabase Auth)<br>- `src/auth/ProtectedRoute.tsx` (enforce database permissions)<br>- `src/components/AdminPortalLayout.tsx` (redesign into ABLEBIZ SUITE shell)<br>- `ConsultationForm.tsx`, `SpinAndWinModal.tsx`, `LeadMagnetModal.tsx`, `Referrals.tsx` (connect to Supabase with user-facing error handling)<br>- `src/pages/admin/Clients.tsx` (upgrade to full Client 360° Profile)<br>- `src/pages/admin/Reports.tsx` (expand into real operational financial reporting)<br>- `src/pages/admin/Settings.tsx` (transition to Internal Service Catalog & Fee Configuration) |
| **REMOVE** | - Insecure demo credentials and plaintext password storage in `AuthContext.tsx`<br>- Public pricing page (`src/pages/Pricing.tsx`) from public routes and navigation<br>- Public package comparison tables and public Starter/Standard/Premium cards<br>- LocalStorage as a database for leads and admin records<br>- Stray untracked Windows duplicate copy files (`* (2).*`, `* (3).*`) |
| **ADD** | - Root `.env.local` configured with verified Supabase URL & anon key<br>- Comprehensive SQL migration (`implementation/MIGRATION_ABLEBIZ_SUITE.sql`)<br>- 18 database tables for operations, finance, and CAC + `public_services_view`<br>- Services Catalog with internal fee management (`default_fee_ngn`, `min_fee_ngn`, etc.)<br>- 8-role Staff & Permissions matrix<br>- Manager Workbench dashboard<br>- Quotations architecture with editable amounts & discounts (`quotations`, `quotation_items`)<br>- Central Service Request architecture<br>- 11-stage CAC Operations module<br>- Operational Finance (Invoices, Payments, Expenses, Vendors)<br>- Task Management & Activity Timeline<br>- Document Management backed by Supabase Storage bucket `ablebiz_documents`<br>- Communications and Internal Notifications modules |
| **MIGRATE** | - Authentication from localStorage to Supabase Auth (`auth.users` + `public.staff_profiles`)<br>- Lead capture from browser storage to Supabase PostgreSQL<br>- Referral program tracking from localStorage to `referral_events` table<br>- Settings overrides from localStorage to `site_config` table<br>- `src/content/pricing.ts` package tiers deprecated & archived for historical reference |

---

