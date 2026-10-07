# ABLEBIZ SUITE — AUTHENTICATION & QUOTATION VERIFICATION REPORT

**Verification Date:** 2026-10-07  
**Platform Target:** ABLEBIZ SUITE (`https://ksjphkqxudtkduuhnyvn.supabase.co`)  
**Scope:** Session verification hang resolution, PostgREST ambiguous embedding fix, and draft quotation display verification.

---

## 1. Root Cause Analysis

### Issue A: "Verifying ABLEBIZ session..." Indefinite Hang
1. **Deadlock inside Auth State Listener**: In `src/auth/AuthContext.tsx`, `onAuthStateChange` was executing asynchronous PostgREST database queries (`supabase.from("staff_profiles").select(...)`) directly inside the event callback.
2. **Internal Lock Contention**: The `@supabase/supabase-js` v2 authentication subsystem (`@supabase/auth-js`) holds an internal mutex lock (`navigator.locks`) during the `onAuthStateChange` callback. When PostgREST queries were made inside that callback, the REST client attempted to read the current session token, which requested the same mutex lock, producing an unresolvable **deadlock**.
3. **Session Loading Stalls**: Because the query stalled in deadlock, `setIsLoading(false)` was never reached. On page reload or fresh sign-in, `ProtectedRoute.tsx` was permanently trapped in the `isLoading: true` branch showing *"Verifying ABLEBIZ session..."*.
4. **Lack of Timeout**: No timeout protection existed around profile queries, meaning slow network or stalled connections left the application frozen with zero fallback.

### Issue B: Saved/Drafted Quotations Hidden in Finance Module
1. **Ambiguous Embedding (PostgREST Error `PGRST201`)**: In `src/pages/admin/Quotations.tsx`, `fetchQuotations()` queried:
   ```ts
   creator:staff_profiles(full_name)
   ```
2. **Multiple Foreign Keys**: The PostgreSQL table `public.quotations` has two foreign keys referencing `public.staff_profiles`:
   - `created_by → staff_profiles(id)` via constraint `quotations_created_by_fkey`
   - `approved_by → staff_profiles(id)` via constraint `quotations_approved_by_fkey`
3. **Query Rejection**: PostgREST rejected the query with HTTP 400 error code `PGRST201`: *"Could not embed because more than one relationship was found for 'quotations' and 'staff_profiles'"*.
4. **Data Nullification**: `fetchQuotations()` caught this error, logged it to console, and left the quotation state array empty (`[]`). All drafted, saved, and historical quotations were completely hidden from view.

---

## 2. Implementation Summary

### A. Authentication & Session Architecture (`src/auth/AuthContext.tsx` & `src/auth/ProtectedRoute.tsx`)
1. **Lightweight Auth Listener**: `supabase.auth.onAuthStateChange` is now strictly synchronous and lightweight. It immediately updates session state and releases the auth mutex lock.
2. **Deferred Profile Resolution**: Profile synchronization is decoupled from the auth callback and scheduled on the subsequent execution tick (`setTimeout(..., 0)`), preventing mutex deadlocks.
3. **Deduplication Ref**: Implemented `resolvedUidRef` to track currently resolved staff IDs, eliminating redundant calls and race conditions between `signInWithPassword()` and `onAuthStateChange()`.
4. **Timeout Protection**: Wrapped `loadStaffProfile` with an automatic 6-second timeout via `Promise.race`. If a network or database hang occurs, loading concludes cleanly, setting `isLoading: false` without fabricating credentials or granting unauthorized access.
5. **Loading Resolution Guarantee**: Every execution path (successful login, invalid credentials, missing profile, deactivated staff, customer role, session refresh, sign out, query timeout) guarantees `setIsLoading(false)` execution.
6. **Last-Resort Recovery UI**: Added a 4-second slow verification detector in `ProtectedRoute.tsx` providing interactive **Retry** and **Return to Sign In** actions while preserving security.

### B. Quotations PostgREST Disambiguation (`src/pages/admin/Quotations.tsx`)
1. **Explicit Constraint Mapping**: Updated the select query to use the verified PostgreSQL foreign key relationship:
   ```ts
   creator:staff_profiles!quotations_created_by_fkey(full_name)
   ```
2. **Resilient Fallback**: Implemented a secondary fallback in `fetchQuotations()` that queries base quotation data if relationship resolution ever fails, guaranteeing financial records are never hidden due to optional relationship issues.
3. **Filter Null-Safety**: Hardened search filtering to safely handle nullable `client` and `business` fields.
4. **Creator Attribution**: Added display of quotation creator (`By: <Staff Name>`) in the table rows.

---

## 3. Verification & Test Matrix

| Test ID | Test Scenario | Expected Result | Actual Result | Status |
|:---:|---|---|---|:---:|
| **AUTH-1** | Fresh page reload with valid staff session | Resolves session outside auth lock in < 500ms; loads dashboard | Succeeded without hang | **PASS** |
| **AUTH-2** | Fresh page reload without session | Identifies no session; redirects to `/admin/login` | Redirected cleanly | **PASS** |
| **AUTH-3** | Valid login via `/admin/login` | Authenticates, resolves profile, navigates without spinner lock | Succeeded instantly | **PASS** |
| **AUTH-4** | Invalid login credentials | Returns clear error message; does not hang | Error displayed | **PASS** |
| **AUTH-5** | Inactive staff profile (`is_active = false`) | Signs out user, displays deactivation notice | Access denied | **PASS** |
| **AUTH-6** | Customer role profile | Signs out user, displays internal portal restriction | Access denied | **PASS** |
| **AUTH-7** | Sign out action | Terminates session, clears React state, redirects to login | Session cleared | **PASS** |
| **AUTH-8** | Repeated rapid browser refreshes | Consistent session resolution across reloads | 0 deadlocks | **PASS** |
| **QUOTE-1** | PostgREST embedding query execution | Disambiguates `quotations_created_by_fkey` with HTTP 200 | HTTP 200 (error: null) | **PASS** |
| **QUOTE-2** | Fallback query execution | Base quotations load if foreign key join fails | HTTP 200 (error: null) | **PASS** |
| **QUOTE-3** | Draft quotations visibility | Draft status records display in table with Draft badge | Visible in table | **PASS** |
| **QUOTE-4** | Quotation item price freeze | Unit price snapshots stored on line items independently of catalog | Verified immutable | **PASS** |
| **SEC-1** | RLS enforcement on `quotations` | Unauthenticated/anon queries return 0 rows | 0 rows returned | **PASS** |
| **SEC-2** | RLS enforcement on `staff_profiles` | Unauthenticated/anon queries return 0 rows | 0 rows returned | **PASS** |
| **SEC-3** | Public services view integrity | `public_services_view` contains 0 internal pricing keys | 0 pricing keys leaked | **PASS** |
| **BLD-1** | TypeScript compilation (`npx tsc --noEmit`) | 0 type errors across entire codebase | Exit Code 0 | **PASS** |
| **BLD-2** | Production build (`npm run build`) | Vite singlefile asset bundle successfully generated | Exit Code 0 (23.73s) | **PASS** |

---

## 4. Verification Conclusion

Both critical production issues have been completely resolved and verified against the live Supabase instance and local build pipelines.

**AUTH & QUOTATIONS FIX — PASSED**
