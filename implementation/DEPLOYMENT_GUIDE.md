# ABLEBIZ – Go‑Live Implementation (GitHub + Vercel + Supabase)

This guide is intentionally **simple, step‑by‑step**, and tells you **what**, **where**, and **exactly how** to launch the ABLEBIZ website with a real database on Supabase.

> Goal: Your website is hosted on **Vercel**, your data is stored in **Supabase**, and leads from:
> - Spin & Win
> - Consultation Requests
> - Checklist downloads
> - Referrals / Leaderboard
> …are saved in Supabase.

---

## A) Quick Launch Checklist (20–40 minutes)

### 1) Supabase: Create DB + backend logic
- [ ] Create a Supabase project
- [ ] Run `implementation/SUPABASE_BACKEND.sql` in Supabase SQL Editor (one paste)
- [ ] Confirm tables + functions exist

### 2) Frontend: Add Supabase credentials
- [ ] Create `.env.local` for local development
- [ ] Add the same environment variables in Vercel

### 3) Deploy
- [ ] Push to GitHub
- [ ] Import into Vercel
- [ ] Test Spin & Win + Consultation + Checklist + Leaderboard on production URL

---

## B) SUPABASE SETUP (Database)

### Step B1 — Create a Supabase project (WHERE)
1. Go to **https://supabase.com**
2. **New project**
3. Choose:
   - Organization
   - Project name: `ablebiz`
   - Region (choose closest to Nigeria for better latency)
   - Generate/save DB password
4. Wait until the project finishes provisioning.

### Step B2 — Run the backend SQL (WHAT + WHERE)
1. In Supabase, open: **SQL Editor**
2. Click: **New query**
3. Open this file in your repo:
   - `implementation/SUPABASE_BACKEND.sql`
4. Copy **everything** and paste into SQL Editor
5. Click **Run**

✅ Result: Supabase will automatically create:
- Enums / types
- Tables
- Indexes
- RLS policies
- RPC functions (server-side functions)

> Important: The SQL is written to be **idempotent** (safe to run again). If you paste it again later, it should not break.

### Step B3 — Confirm tables exist
Supabase → **Table Editor** should show these tables:
- `leads`
- `spin_rewards`
- `referral_events`
- `consultation_requests`
- `checklist_downloads`

### Step B4 — Confirm functions exist
Supabase → **Database → Functions** should show:
- `ablebiz_create_spin_and_reward`
- `ablebiz_create_consultation_request`
- `ablebiz_create_checklist_download`
- `ablebiz_get_monthly_leaderboard`

### Step B5 — Get your API credentials (WHERE)
Supabase → **Project Settings → API**:
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon public key** → `VITE_SUPABASE_ANON_KEY`

Do **NOT** expose:
- `service_role key` (keep private; only server-side)

---

## C) LOCAL DEVELOPMENT SETUP (Recommended before Vercel)

### Step C1 — Create `.env.local` (WHERE)
In the project root (same level as `package.json`), create a file named:
- `.env.local`

Put this inside (COPY/PASTE TEMPLATE):

```bash
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_SITE_URL="http://localhost:5173"
```

### Step C2 — Run the site locally
```bash
npm install
npm run dev
```

---

## D) CONNECT THE WEBSITE TO SUPABASE (Frontend wiring)

Right now, your MVP works visually and captures behavior. To **store data in Supabase**, you connect the frontend to the Supabase RPC functions.

### Step D1 — Install Supabase client library (WHAT)
Run locally:

```bash
npm i @supabase/supabase-js
```

### Step D2 — Create Supabase client file (WHERE)
Create:
- `src/lib/supabaseClient.ts`

Copy/paste:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step D3 — Replace local “storage” calls with RPC calls (WHAT + WHERE)
You will update these exact files:

1) **Spin & Win submission**
- File: `src/gamification/SpinAndWinModal.tsx`
- Call RPC: `ablebiz_create_spin_and_reward`

2) **Consultation form submission**
- File: `src/components/ConsultationForm.tsx`
- Call RPC: `ablebiz_create_consultation_request`

3) **Checklist lead capture**
- File: `src/components/checklists/LeadMagnetModal.tsx`
- Call RPC: `ablebiz_create_checklist_download`

4) **Leaderboard**
- File: `src/gamification/ReferralLeaderboard.tsx`
- Call RPC: `ablebiz_get_monthly_leaderboard`

#### Example RPC call pattern (copy/paste)
```ts
import { supabase } from '@/lib/supabaseClient'

const { data, error } = await supabase.rpc('ablebiz_create_spin_and_reward', {
  p_name: name,
  p_email: email,
  p_phone: phone,
  p_referred_by: referredBy || null,
  p_consent_marketing: consentMarketing,
  p_page_path: window.location.pathname,
})

if (error) throw error
```

✅ This approach is safe for MVP because:
- We don’t allow public reads on sensitive tables
- Writes happen through controlled RPC functions + RLS is enabled

---

## E) QUICK TESTS (Before deploying)

### Test E1 — Test RPC via Supabase (easy)
Supabase → **SQL Editor** → Run:

```sql
select public.ablebiz_get_monthly_leaderboard(5);
```

(It may return empty until you have referrals.)

### Test E2 — Test RPC via HTTP (optional but powerful)
Use Postman/Insomnia or curl.

Endpoint format:
- `POST https://YOUR_PROJECT_ID.supabase.co/rest/v1/rpc/ablebiz_create_spin_and_reward`

Headers:
- `apikey: YOUR_ANON_KEY`
- `Authorization: Bearer YOUR_ANON_KEY`
- `Content-Type: application/json`

Body example:
```json
{
  "p_name": "Test User",
  "p_email": "test@example.com",
  "p_phone": "08160000000",
  "p_referred_by": null,
  "p_consent_marketing": true,
  "p_page_path": "/"
}
```

---

## F) GITHUB SETUP (Source control)

### Step F1 — Create GitHub repo
1. Create a new repo in GitHub: `ablebiz-website`
2. Push your code:

```bash
git init
git add .
git commit -m "Initial Ablebiz MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ablebiz-website.git
git push -u origin main
```

---

## G) VERCEL DEPLOYMENT (Hosting)

### Step G1 — Import project into Vercel
1. Go to **https://vercel.com**
2. **Add New → Project**
3. Import your GitHub repo
4. Framework preset: **Vite** (auto detected)

### Step G2 — Add environment variables (WHERE)
Vercel → Project → **Settings → Environment Variables**
Add:
- `VITE_SUPABASE_URL` = your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
- `VITE_SITE_URL` = your production URL (your Vercel domain or custom domain)

Then redeploy.

### Step G3 — Build settings
Leave defaults:
- Build command: `npm run build`
- Output directory: `dist`

---

## H) WHERE TO VIEW YOUR DATA (Operations)

Supabase → Table Editor:
- `leads` = all captured leads (spin/consultation/checklist)
- `consultation_requests` = qualified requests (budget/urgency/contact method)
- `spin_rewards` = reward type + reward code
- `referral_events` = points credited

---

## I) IMPORTANT NOTES (to avoid “constraints” surprises)

### 1) Spin fairness rules (already handled by backend)
- 25% equal chance for each reward (server-side)
- One spin per phone and one spin per email (enforced)
- If someone tries again, backend returns the original reward instead of crashing

### 2) Why you might still see an error
Usually only when:
- Required fields are empty
- Someone already spun with the same email/phone

Your frontend should show a friendly message and/or reuse existing reward.

---

## J) TROUBLESHOOTING

### “RLS violation”
Cause: You tried to insert/select tables directly.
Fix: Use the RPC functions listed above (`ablebiz_create_*`) and ensure you used the **anon key**.

### “Function not found”
Cause: SQL didn’t run completely.
Fix: Re-run `SUPABASE_BACKEND.sql` in SQL Editor.

### Blank website after deploy
Cause: Missing env vars.
Fix: Add Vercel env vars and redeploy.

---

## K) NEXT (Optional but recommended after go-live)

1) Admin notifications (faster closing)
- Use a Supabase Edge Function or Vercel Serverless route to notify ABLEBIZ when a high-intent lead comes in.

2) NDPR consent wording
- Add a clear consent checkbox for contact/marketing follow-up.

3) Spam protection
- Add rate-limiting (server route) or a simple anti-bot honeypot field.
