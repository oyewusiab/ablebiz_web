# ABLEBIZ SUITE — PHASE 5 OPERATIONS DATA & SCHEMA AUDIT

**Audit Date:** 2026-10-07  
**Database Target:** ABLEBIZ SUITE Production Supabase (`https://ksjphkqxudtkduuhnyvn.supabase.co`)  
**Scope:** Investigation of PostgreSQL schemas, foreign keys, enums, RLS policies, and storage settings for CAC Operations, Tasks, and Document Vault.

---

## 1. Existing CAC Schema (`public.cac_applications`)

The table `public.cac_applications` was created in Phase 1 as an 11-stage specialized filing engine linked to service requests:

| Column Name | Type | Constraints / Default | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary Key, `gen_random_uuid()` | Unique Application Identifier |
| `service_request_id` | `uuid` | Foreign Key `service_requests(id)` on delete cascade, NOT NULL | Originating Service Request |
| `business_id` | `uuid` | Foreign Key `businesses(id)` on delete set null | Linked Corporate Entity |
| `client_id` | `uuid` | Foreign Key `clients(id)` on delete restrict, NOT NULL | Paying Client / Contact |
| `assigned_officer_id` | `uuid` | Foreign Key `staff_profiles(id)` on delete set null | Assigned Compliance Officer |
| `application_type` | `public.cac_entity_type` | Default `'business_name'` | Entity Classification |
| `current_stage` | `public.cac_workflow_stage`| Default `'new_request'` | 11-Stage Workflow Engine |
| `proposed_name_1` | `text` | Nullable | Primary Option for Name Search |
| `proposed_name_2` | `text` | Nullable | Alternate Option for Name Search |
| `approved_name` | `text` | Nullable | Officially Reserved / Approved Name |
| `reservation_code` | `text` | Nullable | CAC Name Availability Code |
| `submission_date` | `date` | Nullable | Date submitted on CAC portal |
| `approval_date` | `date` | Nullable | Official registration certificate date |
| `certificate_number` | `text` | Nullable | Issued RC / BN / IT Number |
| `rejection_reason` | `text` | Nullable | CAC Query / Disapproval explanation |
| `rectification_notes`| `text` | Nullable | Officer's query resolution notes |
| `filing_reference_number` | `text` | Nullable | CAC CRP / Remita reference |
| `notes` | `text` | Nullable | Internal notes |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` | Audit Timestamps |

---

## 2. Existing Task Schema (`public.tasks` & `public.task_comments`)

The task delegation architecture is completely modeled and ready:

### A. `public.tasks`
- `id` (`uuid`, PK)
- `title` (`text`, NOT NULL)
- `description` (`text`)
- `service_request_id` (`uuid` FK `service_requests(id)`)
- `cac_application_id` (`uuid` FK `cac_applications(id)`)
- `client_id` (`uuid` FK `clients(id)`)
- `assigned_to` (`uuid` FK `staff_profiles(id)`)
- `created_by` (`uuid` FK `staff_profiles(id)`)
- `priority` (`public.operational_priority`, Default `'normal'`)
- `status` (`public.task_status`, Default `'todo'`)
- `due_date` (`timestamptz`)
- `completed_at` (`timestamptz`)
- `created_at` / `updated_at` (`timestamptz`)

### B. `public.task_comments`
- `id` (`uuid`, PK)
- `task_id` (`uuid` FK `tasks(id)` on delete cascade)
- `staff_id` (`uuid` FK `staff_profiles(id)` on delete cascade)
- `comment` (`text`, NOT NULL)
- `created_at` (`timestamptz`)

---

## 3. Existing Document Schema (`public.documents`) & Storage Bucket

### A. Document Metadata Table
- `id` (`uuid`, PK)
- `title` (`text`, NOT NULL)
- `file_path` (`text`, NOT NULL — points to object inside bucket)
- `file_size` (`bigint`)
- `mime_type` (`text`)
- `category` (`public.doc_category`, Default `'other'`)
- `client_id` (`uuid` FK `clients(id)`)
- `business_id` (`uuid` FK `businesses(id)`)
- `service_request_id` (`uuid` FK `service_requests(id)`)
- `cac_application_id` (`uuid` FK `cac_applications(id)`)
- `uploaded_by` (`uuid` FK `staff_profiles(id)`)
- `is_verified` (`boolean`, Default `false`)
- `verified_by` (`uuid` FK `staff_profiles(id)`)
- `expiry_date` (`date`)
- `created_at` / `updated_at` (`timestamptz`)

### B. Supabase Storage Bucket: `ablebiz_documents`
- **Visibility:** `public = false` (Strictly **PRIVATE**)
- **File Size Limit:** 20,971,520 bytes (20 MB)
- **Allowed MIME Types:** `['application/pdf', 'image/jpeg', 'image/png', 'image/webp']`
- **Storage Policies:**
  - `Staff upload ablebiz_documents`: Authenticated staff where `is_active_staff() = true`
  - `Staff view ablebiz_documents`: Authenticated staff where `is_active_staff() = true`

---

## 4. Operational Relationships & Enums

### A. Service Request Connection
The operational chain is preserved at the database level:
`clients` (1) ──► (N) `businesses` (1) ──► (N) `service_requests` (1) ──► (1) `cac_applications` (1) ──► (N) `tasks` & `documents`.

### B. Exact Production Enums

1. **`public.cac_workflow_stage`**:
   - `new_request`
   - `documents_required`
   - `documents_verified`
   - `name_search`
   - `name_reserved`
   - `application_prepared`
   - `application_submitted`
   - `under_cac_review`
   - `approved`
   - `documents_received`
   - `completed`
   - `rejected` (Exception)
   - `cancelled` (Exception)

2. **`public.cac_entity_type`**:
   - `business_name`
   - `company_incorporation`
   - `ngo_trustees`
   - `annual_returns`
   - `post_incorporation_change`

3. **`public.task_status`**:
   - `todo`
   - `in_progress`
   - `review`
   - `completed`
   - `cancelled`

4. **`public.operational_priority`**:
   - `low`
   - `normal`
   - `high`
   - `urgent`

5. **`public.doc_category`**:
   - `client_id_card`
   - `passport_photo`
   - `signature_specimen`
   - `cac_certificate`
   - `status_report`
   - `payment_receipt`
   - `scuml_certificate`
   - `tax_clearance`
   - `other`

---

## 5. Security & RLS Audit

- **Tables Protected:** `cac_applications`, `tasks`, `task_comments`, `documents`, `service_requests`.
- **Policy Enforcement:** All tables have active Row-Level Security requiring `public.is_active_staff()`.
- **Anonymous Access:** Strictly returns `0 rows`.
- **Storage Security:** Anonymous downloads and unauthenticated bucket listing are blocked by Supabase Storage RLS. Signed URLs will be used for staff viewing and downloading.

---

## 6. Schema Gaps / Changes Required

**NO DATABASE SCHEMA CHANGES REQUIRED.**  
The Phase 1 database migration (`MIGRATION_ABLEBIZ_SUITE.sql`) already completely provisioned all 5 required tables, indexes, constraints, 11-stage workflow enums, and private document storage.

We can proceed directly with the frontend implementation without modifying the database.
