# ABLEBIZ – Go-Live Implementation Guide
# GitHub + Vercel + Supabase + Admin Portal

This guide is **step-by-step** and explains **what**, **where**, and **how** to launch
the full ABLEBIZ platform including the database backend, Admin Portal, and all dynamic
configurations.

> **Goal:** Website on **Vercel**, data in **Supabase**, Admin Portal secured with role-based
> access, and the Spin Wheel / Referral system fully wired to the live database.

---

## A) QUICK LAUNCH CHECKLIST (30–60 minutes)

### 1) Supabase Database
- [ ] Create Supabase project
- [ ] Run `implementation/SUPABASE_BACKEND.sql` in SQL Editor (single paste → Run)
- [ ] Confirm all tables, functions, and seed data exist
- [ ] Create first Superadmin user (see Section B5)

### 2) Add Credentials to the App
- [ ] Create `.env.local` with Supabase URL + anon key
- [ ] Add the same vars to Vercel environment

### 3) Deploy
- [ ] Push to GitHub
- [ ] Import into Vercel
- [ ] Test public features: Spin & Win, Consultation, Checklist, Leaderboard
- [ ] Test Admin Portal login and all portal modules

---

## B) SUPABASE SETUP

### B1 — Create a Supabase project
1. Go to **https://supabase.com** → **New project**
2. Settings:
   - Organization: your org
   - Project name: `ablebiz`
   - Region: **Europe West** (closest to Nigeria for best latency)
   - DB Password: generate and **save it securely**
3. Wait for provisioning (≈ 2 minutes)

### B2 — Run the backend SQL

1. In Supabase: **SQL Editor → New query**
2. Open `implementation/SUPABASE_BACKEND.sql` from your repo
3. Copy **everything** (Ctrl+A, Ctrl+C)
4. Paste into the SQL Editor
5. Click **Run**

✅ This creates everything in one shot:
| Created | What |
|---|---|
| Types/Enums | lead_source, reward_status, admin_role, etc. |
| Utility Functions | normalize email/phone, generate codes |
| Tables | leads, spin_rewards, referral_events, consultation_requests, checklist_downloads, admin_users, admin_audit_log, site_config, spin_reward_configs, referral_tier_configs |
| RLS Policies | Secure by default — public can only INSERT via RPC |
| RPC Functions | 15 functions for public and admin use |
| Triggers | Auto-update `updated_at` timestamps |
| Seed Data | 4 default spin wheel prizes + 4 referral tiers |

> The SQL is **idempotent** — safe to run again without breaking anything.

### B3 — Confirm tables exist

Supabase → **Table Editor** should show:

**Core tables:**
- `leads`
- `spin_rewards`
- `referral_events`
- `consultation_requests`
- `checklist_downloads`

**Admin tables:**
- `admin_users`
- `admin_audit_log`

**Configuration tables:**
- `site_config`
- `spin_reward_configs`
- `referral_tier_configs`

### B4 — Confirm RPC functions exist

Supabase → **Database → Functions**:

| Function | Who Calls It |
|---|---|
| `ablebiz_create_spin_and_reward` | Public (Spin & Win modal) |
| `ablebiz_create_consultation_request` | Public (Contact form) |
| `ablebiz_create_checklist_download` | Public (Checklist modal) |
| `ablebiz_get_monthly_leaderboard` | Public (Leaderboard) |
| `ablebiz_get_referral_stats` | Public (Client referral dashboard) |
| `ablebiz_admin_get_dashboard_stats` | Admin Portal |
| `ablebiz_admin_get_leads` | Admin Portal |
| `ablebiz_admin_get_rewards` | Admin Portal |
| `ablebiz_admin_fulfill_reward` | **Superadmin only** |
| `ablebiz_admin_link_referral` | Admin Portal |
| `ablebiz_admin_get_referral_report` | Admin Portal |
| `ablebiz_admin_upsert_site_config` | **Superadmin only** |
| `ablebiz_admin_get_site_config` | Admin Portal |
| `ablebiz_admin_sync_spin_rewards` | **Superadmin only** |
| `ablebiz_admin_sync_referral_tiers` | **Superadmin only** |

### B5 — Create your first Superadmin

> ⚠️ This step is required before you can log into the Admin Portal.

**Step 1:** In Supabase → **Authentication → Users → Invite user**
- Enter the admin's email address
- They will receive an email to set their password

**Step 2:** After they accept the invite, run this in the SQL Editor (replace the values):

```sql
INSERT INTO public.admin_users (auth_uid, email, name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@yourdomain.com'),
  'admin@yourdomain.com',
  'Your Full Name',
  'superadmin'
);
```

**Step 3:** To add a regular Admin (read-only, cannot fulfill rewards or change settings):

```sql
INSERT INTO public.admin_users (auth_uid, email, name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'staff@yourdomain.com'),
  'staff@yourdomain.com',
  'Staff Name',
  'admin'
);
```

### B6 — Get API credentials

Supabase → **Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY`

> ❌ **Never expose** the `service_role` key in frontend code.

---

## C) LOCAL DEVELOPMENT SETUP

### C1 — Create `.env.local`

In the project root (same folder as `package.json`), create `.env.local`:

```bash
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_SITE_URL="http://localhost:5173"
```

### C2 — Run locally

```bash
npm install
npm run dev
```

The app auto-detects whether Supabase is configured. If `VITE_SUPABASE_URL` is set,
it uses the live database. Otherwise, it falls back to localStorage (MVP mode).

---

## D) FRONTEND → SUPABASE WIRING

The Supabase client is already set up in `src/lib/supabaseClient.ts`. These are the
files and the RPC functions they should call when Supabase is enabled:

### Public Features

| Feature | File | RPC Function |
|---|---|---|
| Spin & Win | `src/gamification/SpinAndWinModal.tsx` | `ablebiz_create_spin_and_reward` |
| Consultation | `src/components/ConsultationForm.tsx` | `ablebiz_create_consultation_request` |
| Checklist | `src/components/checklists/LeadMagnetModal.tsx` | `ablebiz_create_checklist_download` |
| Leaderboard | `src/gamification/ReferralLeaderboard.tsx` | `ablebiz_get_monthly_leaderboard` |
| Referral Dashboard | `src/pages/Referrals.tsx` | `ablebiz_get_referral_stats` |

### Admin Portal Features

| Feature | File | RPC Function |
|---|---|---|
| Dashboard | `src/pages/admin/Dashboard.tsx` | `ablebiz_admin_get_dashboard_stats` |
| Clients | `src/pages/admin/Clients.tsx` | `ablebiz_admin_get_leads` |
| Rewards | `src/pages/admin/Referrals.tsx` | `ablebiz_admin_get_rewards` |
| Fulfill Reward | `src/pages/admin/Referrals.tsx` | `ablebiz_admin_fulfill_reward` |
| Link Referral | `src/pages/admin/Referrals.tsx` | `ablebiz_admin_link_referral` |
| Reports | `src/pages/admin/Reports.tsx` | `ablebiz_admin_get_referral_report` |
| Settings Sync | `src/pages/admin/Settings.tsx` | `ablebiz_admin_sync_spin_rewards` + `ablebiz_admin_sync_referral_tiers` |

### Example RPC call pattern

```ts
import { supabase } from '@/lib/supabaseClient'

// Public call (no auth needed)
const { data, error } = await supabase.rpc('ablebiz_create_spin_and_reward', {
  p_name:              name,
  p_email:             email,
  p_phone:             phone,
  p_referred_by:       referredBy ?? null,
  p_consent_marketing: true,
  p_page_path:         window.location.pathname,
  p_utm_source:        new URLSearchParams(window.location.search).get('utm_source'),
})
if (error) throw error
// data = { lead_id, referral_code, reward_type, reward_title, reward_code }
```

```ts
// Admin call (requires authenticated Supabase session)
const { data, error } = await supabase.rpc('ablebiz_admin_fulfill_reward', {
  p_reward_id:        rewardId,
  p_fulfillment_note: 'Discount applied via WhatsApp',
})
if (error) throw error  // Will throw 'superadmin_required' if not a superadmin
```

---

## E) TEST BEFORE GOING LIVE

### E1 — Test via Supabase SQL Editor

```sql
-- Test spin creation
SELECT public.ablebiz_create_spin_and_reward(
  'Test User', 'test@example.com', '08160000001',
  null, true, '/', null, null, null, null, null
);

-- Test monthly leaderboard
SELECT * FROM public.ablebiz_get_monthly_leaderboard(5);

-- View active spin rewards on the wheel
SELECT * FROM public.spin_reward_configs WHERE is_active = true ORDER BY sort_order;

-- View referral tiers
SELECT * FROM public.referral_tier_configs WHERE is_active = true ORDER BY referrals_required;

-- View all leads
SELECT id, name, email, source, created_at FROM public.leads ORDER BY created_at DESC LIMIT 10;
```

### E2 — Test via HTTP (Postman / curl)

**Endpoint:** `POST https://YOUR_PROJECT_ID.supabase.co/rest/v1/rpc/ablebiz_create_spin_and_reward`

**Headers:**
```
apikey: YOUR_ANON_KEY
Authorization: Bearer YOUR_ANON_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "p_name": "Test User",
  "p_email": "test@example.com",
  "p_phone": "08160000001",
  "p_referred_by": null,
  "p_consent_marketing": true,
  "p_page_path": "/"
}
```

**Expected response:**
```json
{
  "lead_id": "...",
  "referral_code": "ABCDE12345",
  "reward_type": "free_consultation",
  "reward_title": "Free Consultation",
  "reward_code": "ABLE-A1B2C3D4"
}
```

---

## F) GITHUB (Source Control)

The project is already pushed to GitHub at: `https://github.com/oyewusiab/ablebiz_web`

To push future changes:
```bash
git add .
git commit -m "Your descriptive commit message"
git push
```

---

## G) VERCEL DEPLOYMENT (Hosting)

### G1 — Import into Vercel
1. **https://vercel.com** → **Add New → Project**
2. Import `oyewusiab/ablebiz_web` from GitHub
3. Framework: **Vite** (auto-detected)

### G2 — Add environment variables

**Vercel → Project → Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_ID.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |
| `VITE_SITE_URL` | Your production domain (e.g. `https://ablebiz.com.ng`) |

Click **Redeploy** after adding variables.

### G3 — Build settings (leave as defaults)
- Build command: `npm run build`
- Output directory: `dist`

---

## H) ADMIN PORTAL ACCESS

After deployment, your Admin Portal is at: `https://yourdomain.com/admin`

| URL | Page |
|---|---|
| `/admin` | Redirects to `/admin/login` if not authenticated |
| `/admin/login` | Login page (uses Supabase Auth) |
| `/admin/dashboard` | Real-time business overview |
| `/admin/clients` | All leads and client database |
| `/admin/referrals` | Referral ecosystem + reward fulfillment |
| `/admin/reports` | Conversion pipeline + business analytics |
| `/admin/settings` | **Superadmin only** — site config, spin wheel, referral tiers |

### Role Permissions Summary

| Action | Admin | Superadmin |
|---|---|---|
| View all leads | ✅ | ✅ |
| View referrals & conversions | ✅ | ✅ |
| View pending rewards | ✅ | ✅ |
| Manually link referrals | ✅ | ✅ |
| Fulfill/redeem rewards | ❌ | ✅ |
| Edit site settings | ❌ | ✅ |
| Configure spin wheel prizes | ❌ | ✅ |
| Configure referral tiers | ❌ | ✅ |

---

## I) OPERATIONS — WHERE TO VIEW YOUR DATA

| What to see | Where to look |
|---|---|
| All leads | Supabase → Table Editor → `leads` |
| Spin rewards + status | Supabase → Table Editor → `spin_rewards` |
| Referral events | Supabase → Table Editor → `referral_events` |
| Consultation requests | Supabase → Table Editor → `consultation_requests` |
| Admin activity log | Supabase → Table Editor → `admin_audit_log` |
| Spin wheel prizes | Supabase → Table Editor → `spin_reward_configs` |
| Referral tiers | Supabase → Table Editor → `referral_tier_configs` |

---

## J) SPIN WHEEL — HOW PROBABILITIES WORK

The new backend uses a **weighted probability** system instead of equal odds:

- Each prize in `spin_reward_configs` has a `weight` (e.g. 30, 25, 25, 20)
- Total weight = sum of all active prize weights
- A random number between 0 and total_weight is drawn
- Winner is determined by which prize's cumulative range contains the number

**Example (default setup):**

| Prize | Weight | Probability |
|---|---|---|
| ₦1,000 Discount | 30 | 30% |
| Free Consultation | 25 | 25% |
| Free Name Search | 25 | 25% |
| Free E-book | 20 | 20% |

You can change weights anytime from **Admin Portal → Settings → Spin Wheel**.
Changes take effect immediately for new spins.

---

## K) TROUBLESHOOTING

### "RLS violation" error
- **Cause:** Trying to read/write tables directly
- **Fix:** Use the RPC functions. Never access tables directly from the frontend.

### "not_authorized" from admin RPC
- **Cause:** The logged-in user's `auth.uid()` doesn't exist in `public.admin_users`
- **Fix:** Run the INSERT into `admin_users` with the correct `auth_uid` (see Section B5)

### "superadmin_required" error
- **Cause:** A regular admin tried to call a superadmin-only function (e.g., fulfill reward)
- **Fix:** Expected behavior — have a superadmin perform the action

### "Function not found"
- **Cause:** SQL script did not run completely
- **Fix:** Re-run `SUPABASE_BACKEND.sql` in SQL Editor (it is safe to re-run)

### Blank website after Vercel deploy
- **Cause:** Missing environment variables
- **Fix:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel → redeploy

### Spin wheel shows old prizes after settings change
- **Cause:** The admin saved new prizes locally but hasn't synced to Supabase
- **Fix:** When Supabase is enabled, call `ablebiz_admin_sync_spin_rewards()` on save

---

## L) FUTURE EXPANSION ROADMAP

The backend is built to scale. These features can be added without restructuring:

1. **Email Notifications** — Supabase Edge Function triggered on new `leads` insert
2. **WhatsApp Webhook** — POST to Twilio/WhatsApp Business when a reward is pending
3. **Lead Scoring Automation** — DB trigger to auto-upgrade engagement_score based on activity
4. **Admin Audit Trail UI** — Display `admin_audit_log` in the Admin Portal
5. **Custom Domains** — Update `VITE_SITE_URL` in Vercel and configure DNS
6. **Analytics Dashboard** — Connect to Metabase or Grafana using Supabase read-only credentials
7. **Automated Referral Payouts** — Edge function checks tiers weekly and sends reward notifications
8. **NDPR Compliance** — Add data deletion RPC that removes a lead by email on request
9. **Multi-branch Support** — Add `branch` column to leads for franchise/partnership tracking

---

*Last updated: April 2026 — Covers Admin Portal Optimization Suite v2*
