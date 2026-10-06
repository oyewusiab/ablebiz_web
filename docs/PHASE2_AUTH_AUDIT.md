# ABLEBIZ SUITE — PHASE 2 AUTHENTICATION & RBAC AUDIT

**Audit Date:** 2026-10-06  
**Target Platform:** ABLEBIZ SUITE (`https://ksjphkqxudtkduuhnyvn.supabase.co`)  
**Objective:** Transition from mock/localStorage authentication to Supabase Auth (`auth.users`) + `public.staff_profiles` + `public.roles_permissions`.

---

## 1. Current Authentication Flow

Currently, the application uses a simulated in-browser authentication model implemented in `src/auth/AuthContext.tsx` and consumed by `src/pages/admin/Login.tsx`:
1. The user inputs email and password into the login form.
2. The form calls `login(email, password)` synchronously on `AuthContext`.
3. `login()` searches an in-memory array of users loaded from `localStorage` under the key `ablebiz_auth_users`.
4. If a record matches email and plaintext password, the sanitized user object is written to `sessionStorage` under `ablebiz_auth_user` and stored in React state.
5. `ProtectedRoute.tsx` checks if `user` exists in React state.

---

## 2. Current Session Storage

- **User Accounts Database:** Stored in `localStorage.getItem("ablebiz_auth_users")`.
- **Active User Session:** Stored in `sessionStorage.getItem("ablebiz_auth_user")`.
- **Vulnerabilities:**
  - Plaintext password comparison in browser JavaScript.
  - Accounts and session can be inspected, injected, or modified via browser Developer Tools.
  - No cryptographic tokens, no session expiration, no server-side identity verification.

---

## 3. Current Role Determination

- Roles are currently hardcoded to two legacy tiers: `"admin"` and `"superadmin"`.
- Permissions are represented as a static boolean dictionary:
  `{ dashboard: boolean, referrals: boolean, clients: boolean, reports: boolean, settings: boolean, users: boolean }`.
- `superadmin` bypasses all permission checks in `ProtectedRoute.tsx`:
  `(user.role !== "superadmin" && !user.permissions[requiredPermission])`.
- Role assignment and permission flags are stored inside the client-side user object in `localStorage` and can be tampered with in browser memory.

---

## 4. Current Protected Routes

In `src/App.tsx`:
- `/admin/login` (Public login screen)
- `/admin` (Guarded by `<ProtectedRoute><AdminPortalLayout /></ProtectedRoute>`)
  - `dashboard` → guarded by `requiredPermission="dashboard"`
  - `referrals` → guarded by `requiredPermission="referrals"`
  - `clients` → guarded by `requiredPermission="clients"`
  - `reports` → guarded by `requiredPermission="reports"`
  - `settings` → guarded by `requiredPermission="settings"`
- `/admin-porter/*` → Legacy redirect to `/admin`

---

## 5. Current Demo / Mock Credentials in Code

- Discovered in `src/auth/AuthContext.tsx` (lines 76–99) and displayed on `src/pages/admin/Login.tsx` (lines 106–113):
  - Standard Admin: `admin@ablebiz.com` / `admin123`
  - Super Admin: `super@ablebiz.com` / `super123`
- Discovered in `src/pages/admin/Settings.tsx`:
  - Password updating function `updateUserPassword()` and user CRUD `addUser()`, `updateUser()`, `removeUser()` all manipulate the local browser storage array.

---

## 6. Components Requiring Modification

| Component | Nature of Modification |
|---|---|
| `src/auth/AuthContext.tsx` | Complete rewrite to use `supabase.auth`, resolve `staff_profiles` via `auth.uid()`, query `roles_permissions`, eliminate `localStorage` user array and plaintext passwords. |
| `src/auth/ProtectedRoute.tsx` | Update to evaluate active staff status, new 8 staff roles, database-backed permissions, and render an unauthorized access state when an authenticated user lacks required privileges. |
| `src/pages/admin/Login.tsx` | Wire form directly to `supabase.auth.signInWithPassword()`, remove demo credentials footer, handle Supabase auth errors (e.g. invalid credentials, unconfirmed email, inactive staff profile). |
| `src/components/AdminPortalLayout.tsx` | Update user role and department display to match `staff_profiles` (e.g. `managing_director`, `operations_manager`, `accountant`, etc.), use dynamic permissions for navigation tabs, call `supabase.auth.signOut()`. |
| `src/pages/admin/Settings.tsx` | Remove or refactor local-user CRUD tabs ("accounts") to prevent misleading mock password updates; hook profile info to Supabase Auth. |

---

## 7. Components That Should Remain Unchanged

- All Public Website Pages:
  - `src/pages/Home.tsx`
  - `src/pages/About.tsx`
  - `src/pages/Services.tsx`
  - `src/pages/Contact.tsx`
  - `src/pages/BlogIndex.tsx`
  - `src/pages/BlogPost.tsx`
  - `src/pages/Referrals.tsx`
  - `src/pages/Testimonials.tsx`
- Public Layout and Header:
  - `src/components/Layout.tsx`
  - `src/components/Header.tsx`
  - `src/components/Footer.tsx`
- Gamification & Referrals Engine (public visitor tier):
  - `src/gamification/*`
  - `src/referrals/core.ts` (visitor-facing lead capture)
- Supabase Client Configuration:
  - `src/lib/supabaseClient.ts` (already properly configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
