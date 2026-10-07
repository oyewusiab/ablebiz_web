# ABLEBIZ SUITE — TARGETED ROUTING FIX REPORT
**Date:** 2026-10-07  
**Status:** PASS  
**Task Scope:** Broken Admin Modules: Communications (`/admin/communications`) & Team (`/admin/team`)

---

## 1. Executive Summary

A targeted production bug fix was applied to resolve the 404 issue when navigating to `/admin/communications` and `/admin/team`. Both routes are now fully restored inside the authenticated `AdminPortalLayout` wrapped by `ProtectedRoute`, with complete Supabase backing, canonical RBAC security enforcement, and zero database schema changes or localStorage usage.

---

## 2. Root Cause Analysis

### A. Failure of `/admin/communications`
- **Root Cause:**
  1. The link `{ name: "Client Communications", path: "/admin/communications", icon: MessageSquare, module: "crm" }` existed in `AdminPortalLayout.tsx`.
  2. The underlying database table `public.communications` existed with full columns (`id, client_id, service_request_id, staff_id, channel, direction, summary, details, created_at`) and active RLS policies.
  3. However, no route for `"communications"` was ever registered inside `<Route path="/admin" element={<ProtectedRoute><AdminPortalLayout /></ProtectedRoute>}>` in `src/App.tsx`.
  4. In addition, no page component existed in `src/pages/admin/` for Communications.
  5. As a result, navigating to `/admin/communications` caused React Router to fall through to the public catch-all route `<Route path="*" element={<NotFoundPage />} />` wrapped in `<Layout />`, displaying the public 404 page.

### B. Failure of `/admin/team`
- **Root Cause:**
  1. The link `{ name: "Staff & RBAC", path: "/admin/team", icon: ShieldCheck, superOnly: true }` existed in `AdminPortalLayout.tsx`.
  2. The underlying database tables `public.staff_profiles` and `public.roles_permissions` were defined in PostgreSQL with canonical roles and security policies.
  3. However, no route for `"team"` was ever registered inside `src/App.tsx`.
  4. In addition, no page component existed in `src/pages/admin/` for Staff & RBAC.
  5. When navigating to `/admin/team`, React Router fell through to the public catch-all route, rendering the public 404 page.

---

## 3. Files Changed and Components Created / Reused

### Files Created:
1. `src/pages/admin/Communications.tsx`
   - **Component:** `ClientCommunicationsPage`
   - **Capabilities:**
     - Interactive communications log table querying `public.communications`, joined with `clients`, `staff_profiles`, and `service_requests`.
     - KPI metrics: Total Interactions, Outbound Messages, Inbound Inquiries, WhatsApp Records.
     - Search by client name, staff name, summary, or details.
     - Filtering by communication channel (`whatsapp`, `phone_call`, `email`, `in_person`, `sms`) and direction (`inbound`, `outbound`).
     - "Log Communication" modal for authorized staff (`crm.create`) to record client interactions directly into Supabase and log an event into `activity_timeline`.
     - Zero localStorage / sessionStorage usage.
2. `src/pages/admin/Team.tsx`
   - **Component:** `StaffRbacPage`
   - **Capabilities:**
     - Staff directory table listing active and inactive team members from `public.staff_profiles`.
     - Displays canonical roles mapped to human-readable titles using existing `getRoleConfig` and `getRoleTitle` from `src/auth/roleConfig.ts`.
     - RBAC permissions matrix tab explaining capabilities for each canonical role.
     - Role elevation & status toggle modal restricted strictly to `super_admin` (`managing_director`) both in UI and database RLS.
     - Zero localStorage / sessionStorage usage.

### Files Modified:
1. `src/App.tsx`
   - Imported `ClientCommunicationsPage` and `StaffRbacPage`.
   - Registered under `/admin`:
     ```tsx
     {/* Communications */}
     <Route path="communications" element={<ProtectedRoute requiredModule="crm"><ClientCommunicationsPage /></ProtectedRoute>} />
     {/* Team / Staff & RBAC */}
     <Route path="team" element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffRbacPage /></ProtectedRoute>} />
     ```

### Components Reused:
- `AdminPortalLayout` (`src/components/AdminPortalLayout.tsx`)
- `ProtectedRoute` (`src/auth/ProtectedRoute.tsx`)
- `roleConfig.ts` (`src/auth/roleConfig.ts`: `ROLE_DEFINITIONS`, `normalizeStaffRole`, `getRoleTitle`, `getRoleConfig`)
- `AuthContext` (`src/auth/AuthContext.tsx`)
- Lucide React icons matching Ablebiz brand standards (`ShieldCheck`, `MessageSquare`, `Search`, etc.)

---

## 4. Routes Registered

| Path | Layout | Protection | Allowed Roles / Permissions |
| :--- | :--- | :--- | :--- |
| `/admin/communications` | `AdminPortalLayout` | `ProtectedRoute` | `requiredModule="crm"` (view: all active staff with CRM view permission; create: `crm.create`) |
| `/admin/team` | `AdminPortalLayout` | `ProtectedRoute` | `requiredRole={["super_admin", "admin"]}` (Superadmin has full management rights, Admin has read-only policy) |

---

## 5. Security & RBAC Enforcement

1. **Hierarchy & Layout:**
   - Both `/admin/communications` and `/admin/team` are nested strictly inside `<Route path="/admin" element={<ProtectedRoute><AdminPortalLayout /></ProtectedRoute>}>`.
   - The public layout (`<Layout />`) and catch-all 404 route (`NotFoundPage`) cannot intercept valid `/admin/*` routes.
2. **Authentication Check:**
   - Unauthenticated requests are intercepted by `ProtectedRoute` and redirected to `/admin/login`.
3. **Authorization Check for Team (`/admin/team`):**
   - Non-authorized roles (e.g. `client_service_officer`, `registration_officer`, `viewer`, `customer`) are denied access by `ProtectedRoute` (`requiredRole={["super_admin", "admin"]}`).
   - Modification of staff roles or activation states is restricted to `super_admin` in UI and backed by the PostgreSQL policy:
     `create policy "Superadmin can manage staff profiles" on public.staff_profiles for all using (public.current_staff_role() = 'super_admin');`
4. **Authorization Check for Communications (`/admin/communications`):**
   - Module access guarded by `requiredModule="crm"`.
   - Creation of communication logs guarded by `hasPermission("crm", "create")`.
   - Staff insertion uses current authenticated staff profile ID (`profile.id`) and commits directly to Supabase `public.communications`.
5. **No Client-Side Authorization Bypass:**
   - Zero use of `localStorage` or `sessionStorage` for role, permissions, or session validation.

---

## 6. Verification and Test Results

| Test Case | Description | Result |
| :--- | :--- | :--- |
| **Direct URL: `/admin/communications`** | Direct navigation resolves inside AdminPortalLayout without triggering public 404 | **PASS** |
| **Direct URL: `/admin/team`** | Direct navigation resolves inside AdminPortalLayout without triggering public 404 | **PASS** |
| **Sidebar Navigation** | Clicking "Client Communications" and "Staff & RBAC" routes correctly | **PASS** |
| **Browser Refresh** | Refreshing `/admin/communications` and `/admin/team` retains Admin shell | **PASS** |
| **Unauthenticated Direct Access** | Accessing `/admin/communications` or `/admin/team` without session redirects to `/admin/login` | **PASS** |
| **Role-Based Protection on Team** | Non-authorized roles cannot access `/admin/team`; restricted to `super_admin` and `admin` | **PASS** |
| **Role Elevation Safeguard** | Only `super_admin` can edit staff roles or toggle active status | **PASS** |
| **CRM Module Permission** | Access to `/admin/communications` requires CRM permission | **PASS** |
| **SPA Fallback Routing** | `vercel.json` wildcard rewrite `/(.*) -> /index.html` preserves client-side routing | **PASS** |
| **Public Routes Regression** | `/`, `/about`, `/services`, `/testimonials`, `/contact`, `/blog` functional | **PASS** |
| **Public 404 Fallback** | Non-existent public routes (e.g. `/random-invalid-page`) still render public 404 | **PASS** |
| **Existing Admin Routes Regression** | All 18 existing admin routes (`/admin/dashboard`, `/admin/clients`, `/admin/leads`, `/admin/follow-ups`, `/admin/services-catalog`, `/admin/service-requests`, `/admin/cac-operations`, `/admin/tasks`, `/admin/documents`, `/admin/quotations`, `/admin/invoices`, `/admin/payments`, `/admin/expenses`, `/admin/vendors`, `/admin/reports`, `/admin/audit-logs`, `/admin/ai-secretary`, `/admin/settings`) intact | **PASS** |
| **Build & Typecheck** | `npm run build` completed with 0 errors (Vite production build bundled cleanly in 48s) | **PASS** |

---

## 7. Database & Schema Integrity
- **Tables modified:** None (0)
- **RLS policies modified:** None (0)
- **Enums modified:** None (0)
- **Supabase client modified:** None (0)

---

## 8. Commit Information
- **Commit Message:** `fix(admin): restore communications and team routes`
- **Git Commit Hash:** `5aa8945e6b2a765186b47fa07e66b443ec5acc13`
