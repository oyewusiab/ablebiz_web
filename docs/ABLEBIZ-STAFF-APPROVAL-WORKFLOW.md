# ABLEBIZ SUITE — STAFF MANAGEMENT & SUPER ADMIN APPROVAL WORKFLOW REPORT
**Audit & Implementation Date:** October 7, 2026  
**Status:** PASS  
**Scope:** Maker-Checker Governance Workflow for Staff & RBAC Module (`/admin/team`)

---

## 1. Architecture & Workflow Design

The Staff & RBAC module (`/admin/team`) has been enhanced with a robust, persistent **Maker-Checker Governance Approval Workflow** separating administrative proposal capabilities from executive authorization.

### Governance Roles:
- **SUPER ADMIN (`super_admin`)**:
  - Direct executive staff actions: Provision staff directly, deactivate, reactivate, change roles, and safely deprovision staff.
  - Reviewer of Admin proposals: Inspect pending requests, approve with automated execution, or reject with mandatory justification reason.
- **ADMIN (`admin`)**:
  - Proposal (Maker) actions: Submit requests for new staff creation, staff deactivation, reactivation, role changes, and deprovisioning.
  - All submitted requests enter `pending` state and **never modify** underlying staff profiles or credentials until approved by a Super Admin.
  - Track submission progress in the **My Requests** tab.

---

## 2. Request Lifecycle & Status Semantics

The workflow implements a state model on `public.staff_change_requests`:
- `pending`: Waiting for Super Admin review.
- `approved`: Super Admin approved the requested change; execution is in progress.
- `executed`: Underlying operational change completed successfully in PostgreSQL.
- `failed`: Approval was confirmed but underlying database execution encountered an error.
- `rejected`: Super Admin rejected the request with formal rejection feedback.
- `cancelled`: Request cancelled prior to execution.

---

## 3. Database Objects & RLS Boundaries

### A. Table: `public.staff_change_requests`
Defined in `implementation/MIGRATION_STAFF_APPROVAL_WORKFLOW.sql`:
- `id` (uuid, primary key)
- `request_type` (`staff_change_request_type`: `create_staff`, `deactivate_staff`, `reactivate_staff`, `change_role`, `deprovision_staff`)
- `requested_by` (uuid, references `public.staff_profiles(id)` **ON DELETE RESTRICT** — preserves historical attribution)
- `target_staff_profile_id` (uuid, references `public.staff_profiles(id)` ON DELETE SET NULL)
- `current_role` (`staff_role`)
- `requested_role` (`staff_role`)
- `requested_changes` (jsonb)
- `reason` (text, not null)
- `status` (`staff_change_request_status`: `pending`, `approved`, `rejected`, `executed`, `failed`, `cancelled`)
- `reviewed_by` (uuid, references `public.staff_profiles(id)` ON DELETE RESTRICT)
- `reviewed_at` (timestamptz)
- `rejection_reason` (text)
- `execution_error` (text)
- `created_at` / `updated_at` / `completed_at` (timestamptz)

### B. Row-Level Security (RLS) Policies:
1. `Staff view change requests` (SELECT):
   - Super Admins can select **all** requests.
   - Admins can select **only their own** submitted requests (`requested_by = profile.id`).
2. `Staff insert change requests` (INSERT):
   - Active staff (`is_active_staff()`) can insert requests where `requested_by` matches their own identity.
3. `Superadmin update change requests` (UPDATE):
   - Strictly reserved for `super_admin` (`current_staff_role() = 'super_admin'`). Admins cannot modify or approve requests.
4. **DELETE**:
   - Disallowed for all roles; requests are permanent governance records.

### C. Last Active Super Admin Safeguard:
Trigger function `public.check_last_super_admin_safeguard()` enforces at the database level that no update can deactivate, deprovision, or alter the role of the final active `super_admin`.

---

## 4. Auth User Provisioning & Zero `service_role` Exposure

- **Security Constraint:** The frontend code, environment, and bundles **never** receive or reference the `service_role` secret.
- **Verification:**
  - Automated ripgrep scans on `src/` and `dist/index.html` confirm `0` instances of `service_role`.
- **Provisioning Flow:**
  - Admin submission only writes a `staff_change_requests` record with candidate details. No auth user is created.
  - Super Admin direct creation or request approval provisions the profile in `staff_profiles` and dispatches standard Auth invitation/reset to the user's email via the Supabase Auth client, requiring zero server secrets in the browser.

---

## 5. Safe Deprovisioning Policy

Rather than destructive hard deletion:
- User action is titled **"Deprovision Staff"**.
- Access is revoked immediately by setting `is_active = false`.
- Historical attribution on invoices (`creator`), quotations, verified documents, tasks, and communications is preserved.
- Audit records (`staff_deprovision_requested`, `staff_deprovision_executed`) are generated in `public.audit_logs` and `public.activity_timeline`.

---

## 6. Staff & RBAC UI Enhancements (`/admin/team`)

1. **Staff Directory Tab**:
   - Filter by name, email, department, canonical role, and status.
   - Badges indicate active, inactive, and pending request states.
   - Super Admin has direct controls ("Edit Role", "Deactivate"/"Reactivate", "Deprovision", "Add Staff Directly").
   - Admin has request controls ("Request Role Change", "Request Deactivation", "Request Deprovisioning", "Request New Staff").
2. **Pending Approvals Tab** (Super Admin only):
   - Review pending queue with target diffs and requester justification.
   - Approval confirmation modal with execution notice.
   - Rejection modal requiring structured feedback.
3. **My Requests Tab**:
   - Real-time status tracking for Admins (`pending`, `approved`, `executed`, `rejected`).
4. **RBAC Matrix Tab**:
   - Preserves standard canonical 8-tier role matrix visualization.

---

## 7. Security & Functional Test Results

| Test ID | Test Scenario | Expected Outcome | Result |
| :---: | :--- | :--- | :---: |
| **TEST A** | Admin submits create-staff request | Status `pending`; no staff profile created | **PASS** |
| **TEST B** | Admin submits deactivation request | Status `pending`; staff remains active until review | **PASS** |
| **TEST C** | Admin submits role change request | Status `pending`; role remains unchanged | **PASS** |
| **TEST D** | Super Admin approves request | Underlying database mutation executes; status `executed` | **PASS** |
| **TEST E** | Super Admin rejects request | Request status `rejected`; staff profile unchanged | **PASS** |
| **TEST F** | Admin attempts direct staff mutation | Denied by Supabase RLS | **PASS** |
| **TEST G** | Admin attempts to approve request | Denied by Supabase RLS | **PASS** |
| **TEST H** | Super Admin direct staff action | Executes directly with audit trail | **PASS** |
| **TEST I** | Attempt to deactivate last super_admin | Blocked by self-protection safeguard | **PASS** |
| **TEST J** | Historical attribution survives deprovisioning | Foreign keys and activity records preserved | **PASS** |
| **TEST K** | `service_role` security check | Absent from frontend source and build bundle | **PASS** |
| **TEST L** | Failed execution error handling | Sets status to `failed` with error details, not `executed` | **PASS** |
| **TEST M** | Build verification (`npm run build`) | 0 TypeScript errors, 0 bundling errors | **PASS** |

---

## 8. Git Commit Reference
- **Commit Message:** `feat(admin): implement maker-checker staff management approval workflow`
- **Git Commit Hash:** `b9b3092294dbf45d82a43dbd3d5e6928438bea3f`
