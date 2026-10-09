# ABLEBIZ OPERATIONAL STANDARD OPERATING PROCEDURE (SOP) — V1

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Authoritative Organization:** ABLEBIZ BUSINESS SERVICES  
**Scope:** Public Website (`https://www.ablebiz.com.ng`), Supabase Backend, ABLEBIZ SUITE (`/admin/*`), WhatsApp Business Service Channels  

---

## 1. PURPOSE & ARCHITECTURAL FOUNDATION

This Standard Operating Procedure (SOP) defines the mandatory, step-by-step business workflows for managing leads, client onboarding, service execution, document handling, financial accounting, and referral operations within ABLEBIZ BUSINESS SERVICES.

### Non-Negotiable System Architecture
All ABLEBIZ staff must adhere to the single authoritative operating chain:

```
Public Website / Direct Inquiries
           ↓
    Supabase (Database of Record)
           ↓
    ABLEBIZ SUITE (/admin/*)
           ↓
WhatsApp / Staff Human Communications
```

- **Database of Record:** Supabase (`https://ksjphkqxudtkduuhnyvn.supabase.co`) is the sole authoritative store. Browser `localStorage` or `sessionStorage` must **never** be used for business transactions, client records, or financial statuses.
- **WhatsApp Role:** WhatsApp is the direct human communication channel. WhatsApp is **not** a database. Details agreed on WhatsApp must immediately be entered into ABLEBIZ SUITE.

---

## 2. LIFECYCLE 1: LEAD TO CLIENT CONVERSION WORKFLOW

### Step 1: Lead Capture & Automatic Ingestion
1. **Public Intake Points:**
   - Consultation Form (`/` and `/services`)
   - Direct Contact Form (`/contact`)
   - Interactive Diagnostic Tool (`/`)
   - Spin-to-Win Referral/Voucher Engine (`/refer-and-earn`)
2. **System Behavior:**
   - The public website invokes hardened Supabase RPCs (e.g. `ablebiz_create_consultation_request`).
   - The record is written directly into `public.leads` and `public.consultation_requests`.
   - A unique tracking referral code is generated or assigned.
   - The client is redirected or provided a deep link to initiate a pre-filled WhatsApp conversation with the official company line: `+234 816 048 6023`.

### Step 2: Operational Triage & SLA Follow-up
1. **Staff Action in Suite:**
   - The Intake Officer or Desk Consultant opens **ABLEBIZ SUITE → Leads (`/admin/leads`)**.
   - Inspect new incoming records with status `new`.
   - **SLA Commitment:** Every new lead must receive an initial WhatsApp or phone contact within **15 minutes** during business hours (8:00 AM – 6:00 PM WAT, Mon–Sat).
2. **WhatsApp Outreach:**
   - Use the pre-templated greeting:
     > *"Hello [Client Name], thank you for reaching out to ABLEBIZ Business Services regarding [Service Interested]. I have reviewed your submission (Ref: [Lead Ref]). How may we best assist you with your business registration/compliance requirements today?"*
   - Update the lead status in Suite to `contacted`.

### Step 3: Qualification & Discovery
1. Clarify the client's business type:
   - Business Name (sole proprietorship/partnership)
   - Private Limited Company (LTD)
   - Incorporated Trustee (NGO, Church, Association, Foundation)
   - Post-incorporation compliance, Annual Returns, SCUML, Trademark, or Tax/TIN services.
2. Confirm client availability of statutory requirements (valid government ID, passport photograph, signature specimen, 2 proposed business names).
3. If viable, update status to `qualified`.

### Step 4: Client & Business Entity Conversion
1. In the lead detail drawer, click **Convert to Client**.
2. ABLEBIZ SUITE automatically creates a formal record in `public.clients` and sets up the primary entity profile in `public.businesses`.
3. If an existing client returns for an additional business entity, link the new business to the existing client UUID.

---

## 3. LIFECYCLE 2: SERVICE REQUEST & CAC OPERATIONS WORKFLOW

### Step 1: Service Request Initiation
1. Navigate to **ABLEBIZ SUITE → Services (`/admin/services`)**.
2. Click **New Service Request**, select the Client and Target Business.
3. Select the Service Category:
   - `CAC Registration` (Business Name, Company, NGO)
   - `Post-Incorporation` (Annual Returns, Change of Directors, Share Increase)
   - `Regulatory & Compliance` (SCUML, NAFDAC, Trademarks, Tax Clearance/TIN)
4. Assign an **Operational Owner** (Staff member) and set initial Priority (`normal` or `urgent`).
5. Status initializes to `pending`.

### Step 2: CAC Application Tracking & Workflow
For CAC registrations:
1. Navigate to **CAC Applications (`/admin/cac`)**.
2. **Phase A: Name Availability Search & Reservation**
   - Record Proposed Name Option 1 and Option 2.
   - Submit reservation on the CAC CRP portal.
   - Upon reservation, update status to `Name Reserved` and input the **CAC Availability Code**.
3. **Phase B: Document Collection & Validation**
   - Collect statutory documents via WhatsApp or email.
   - Upload all files directly to the client's record in **Document Vault (`/admin/documents`)** stored in the secure `ablebiz_documents` storage bucket.
   - Verify: Clear photo resolution, valid BVN/NIN match, accurate address with state and LGA.
4. **Phase C: Portal Filing & Payment**
   - Record official CAC filing fees in **ABLEBIZ SUITE → Expenses (`/admin/expenses`)** linked to the service request.
   - Upload the paid CAC filing slip to the Document Vault.
   - Update CAC application status to `Filing Submitted`.
5. **Phase D: Query Resolution (If Applicable)**
   - If CAC issues a query, change status to `Queried`.
   - Log exact query reason in the application notes.
   - Notify the client via WhatsApp within **2 hours** detailing the required modification.
   - Resubmit and update status to `Query Resubmitted`.
6. **Phase E: Approval & Certificate Issuance**
   - Once approved, download the Digital Certificate of Registration, Status Report, and Certified Memorandum & Articles of Association (for LTDs).
   - Enter the official **RC Number / BN Number / IT Number** into the Business record.
   - Upload certificates to the Document Vault.
   - Mark CAC status as `Approved` and Service Request as `Completed`.

---

## 4. LIFECYCLE 3: DOCUMENT MANAGEMENT & VAULT PROTOCOL

1. **Storage Authorization:**
   - Documents are stored exclusively in the Supabase Cloud Storage bucket `ablebiz_documents`.
   - Direct public access without authentication is disabled by Storage RLS policies.
2. **File Naming Standard:**
   - ID Cards: `ID_[CLIENT_NAME]_[NIN/DL]_[DATE].[ext]`
   - Passport Photos: `PHOTO_[CLIENT_NAME]_[DATE].[ext]`
   - CAC Certificates: `CERT_[BN/RC_NUM]_[BUSINESS_NAME].[pdf]`
   - Status Reports: `STATUS_REPORT_[BN/RC_NUM]_[BUSINESS_NAME].[pdf]`
3. **Retention & Privacy:**
   - In accordance with the Nigeria Data Protection Act (NDPA), sensitive client credentials (passwords to government portals, national identity slips) must only be accessed by authorized staff.
   - Staff must never store client identity files on unencrypted local personal workstations.

---

## 5. LIFECYCLE 4: FINANCIAL WORKFLOW (QUOTATION TO RECEIPT)

### Step 1: Quotation Issuance
1. Open **ABLEBIZ SUITE → Finance → Quotations (`/admin/quotations`)**.
2. Generate a new Quotation with line items:
   - Official Statutory Fees (Government disbursements)
   - Professional Service / Processing Fees
   - Incidental / Stamp Duty / Search Fees
3. Set validity period (Default: 14 days).
4. Export or generate client-ready PDF / WhatsApp quotation summary.

### Step 2: Invoice Creation
1. Upon client acceptance, convert Quotation to Invoice or generate a new Invoice in **Invoices (`/admin/invoices`)**.
2. Note official payment bank account:
   - **Bank:** Moniepoint Microfinance Bank
   - **Account Name:** Ablebiz Business Services
   - **Authorized Account Number:** [Authoritative Moniepoint Settlement NUBAN]
3. Status begins as `issued` or `sent`.

### Step 3: Payment Verification & Recording
1. **Mandatory Dual-Check Rule:**
   - Staff must **never** mark an invoice paid based solely on a client-submitted screenshot of a transfer receipt.
   - Staff must verify receipt in the authoritative Moniepoint banking app / enterprise portal before logging payment.
2. Navigate to **Payments (`/admin/payments`)**.
3. Click **Record Payment**:
   - Reference the target Invoice number.
   - Enter Amount Paid, Payment Method (Bank Transfer), and Bank Transaction Reference ID.
4. If payment is 100%, invoice auto-transitions to `paid`. If partial, status transitions to `partially_paid`.

### Step 4: Electronic Receipt Generation & Delivery
1. Generate the official ABLEBIZ Electronic Payment Receipt.
2. Deliver the receipt immediately to the client via WhatsApp with transaction confirmation.
3. The receipt reflects real-time status and balance due (if any).

---

## 6. LIFECYCLE 5: REFERRAL & REWARD LIFECYCLE

1. **Attribution:**
   - Referrers receive a unique 10-character code via `/refer-and-earn` or generated by staff.
   - When a referred client submits an inquiry with this code, a `public.referral_events` record is initiated.
2. **Qualification Threshold:**
   - A referral is considered **Qualified** only when the referred client has completed payment on a qualifying registration or compliance service.
3. **Review & Approval:**
   - The Managing Consultant reviews pending referrals weekly in **ABLEBIZ SUITE → Growth & Referrals (`/admin/referrals`)**.
   - Confirm verified revenue matching before approving cash payouts or service credit vouchers.
4. **Fulfillment:**
   - Payouts are transferred to the referrer's verified Nigerian bank account.
   - Staff uploads proof of transfer to the referral record and sets status to `fulfilled`.

---

## 7. ROLES & ACCESS MATRIX (RBAC)

| Role | Permitted Areas | Restricted Areas |
|---|---|---|
| **Super Admin / MD** | Complete access across all 23 Suite modules, user provisioning, database audits, financial overrides, system settings | None |
| **Desk Consultant / Ops** | Leads, Inquiries, Clients, Businesses, Service Requests, CAC Applications, Document Vault, Tasks | User creation, role changes, financial overrides, deletion of audit logs |
| **Finance Officer** | Quotations, Invoices, Payments, Receipts, Expense Logging, Vendor management | Staff role elevation, CAC filing deletion |
| **External Referrer / Public** | Public website, Referral status checker (`/refer-and-earn`) | Any `/admin/*` route or operational backend table |

---

## 8. INCIDENT ESCALATION & EXCEPTION HANDLING

1. **System Unavailability:**
   - Contact Technical Administrator immediately.
   - Fall back to offline intake protocol (Google Form / WhatsApp triage queue).
2. **CAC Portal Downtime:**
   - Issue automated WhatsApp service notification to affected clients advising of statutory portal maintenance.
3. **Financial Discrepancy:**
   - Immediate freeze on invoice completion until reconciled against Moniepoint bank statement by Managing Consultant.
