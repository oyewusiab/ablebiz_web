# ABLEBIZ DAILY OPERATIONS CHECKLIST — V1

**Frequency:** Daily (Monday – Saturday)  
**Operating Hours:** 08:00 – 18:00 West Africa Time (WAT)  
**Target Roles:** Managing Consultant, Operations Desk Consultant, Finance Officer, Administrative Support  

---

## 1. MORNING SHIFT OPENING ROUTINE (08:00 – 09:00 WAT)

### A. Lead & Inbox Triage
- [ ] Log in to **ABLEBIZ SUITE (`/admin`)** using 2FA/Authorized credentials.
- [ ] Inspect **Leads (`/admin/leads`)**:
  - Filter by status `new`.
  - Check for inquiries submitted overnight via website consultation forms, spin-to-win, or WhatsApp.
  - Verify every new inquiry has an assigned operational owner.
- [ ] Review WhatsApp Business channel (`+234 816 048 6023`):
  - Check overnight messages and unread inquiries.
  - Reconcile incoming WhatsApp numbers against open `public.leads` entries.

### B. CAC & Compliance Pipeline Inspection
- [ ] Navigate to **CAC Applications (`/admin/cac`)**:
  - Review all active filings currently in `Filing Submitted` or `Name Reserved`.
  - Check CAC CRP portal for status changes (Approvals, Availability Query, or Document Queries).
  - Note any queries requiring immediate document updates or client clarification.
- [ ] Inspect **Tasks & Calendar (`/admin/tasks`)**:
  - Review tasks due today.
  - Identify overdue tasks and escalate to operational owners.

### C. Financial Opening Balances & Invoices
- [ ] Inspect **Finance → Invoices (`/admin/invoices`)**:
  - Identify invoices due today or overdue.
  - Prepare gentle reminder messages for clients with outstanding balances past 48 hours.
- [ ] Verify bank connectivity / Moniepoint banking app access for the day.

---

## 2. MID-DAY OPERATIONAL CADENCE (09:00 – 16:00 WAT)

### A. Lead Conversion & Client Consultations
- [ ] Keep lead response time under the **15-minute SLA** for new web arrivals.
- [ ] Qualify prospective clients:
  - Explain Business Name vs. Limited Liability Company (LTD) requirements.
  - Review validity of client-provided identification (NIN, Voter's Card, Driver's License, International Passport).
- [ ] Convert qualified leads to formal **Clients (`/admin/clients`)** and register initial **Businesses (`/admin/businesses`)**.

### B. Service Delivery & Filings
- [ ] Execute Name Availability submissions on CAC portal within **2 hours** of client payment confirmation.
- [ ] Upload all statutory client documents into the secure **Document Vault (`/admin/documents`)**.
- [ ] Execute Company / Business filings on CAC portal:
  - Accurately input Director/Proprietor details, object clauses, share distribution, and PSC (Persons with Significant Control).
  - Log official CAC fees in **Expenses (`/admin/expenses`)** with payment receipts attached.
- [ ] Send milestone updates to clients via WhatsApp upon Name Reservation and Filing Submission.

### C. Invoicing & Payment Verification
- [ ] Issue formal **Quotations (`/admin/quotations`)** and **Invoices (`/admin/invoices`)** for agreed services.
- [ ] Process incoming payments:
  - Cross-examine client payment claims against actual credits in Moniepoint MFB account.
  - Record verified credits in **Payments (`/admin/payments`)**.
  - Generate and dispatch official Electronic Payment Receipts.

---

## 3. EVENING SHIFT CLOSING ROUTINE (16:00 – 18:00 WAT)

### A. Operational Quality & Zero-Lead Audit
- [ ] Filter **Leads (`/admin/leads`)**:
  - Ensure **0 leads remain in uncontacted/unassigned state**.
  - Update all lead statuses to `contacted`, `qualified`, `follow_up`, or `lost`.
  - Set specific follow-up dates for leads awaiting customer decisions.
- [ ] Check **CAC Applications**:
  - Ensure all CAC queries received today were addressed or clients contacted for required materials.
  - Attach newly approved CAC Certificates and Status Reports to respective Business profiles.

### B. Daily Financial Reconciliation
- [ ] Total up all payments recorded in Suite for the day.
- [ ] Reconcile total payments recorded against Moniepoint statement closing inflow.
  - *Discrepancy Check:* Discrepancies must be flagged to Managing Consultant before shift close.
- [ ] Ensure all operational expenses disbursed during the day have an invoice or receipt attached in `/admin/expenses`.

### C. Referral & Growth Check
- [ ] Review **Growth & Referrals (`/admin/referrals`)**:
  - Confirm newly referred clients who completed transactions today.
  - Mark eligible referral commissions as `approved` for scheduled payout.

### D. System Security & Logoff
- [ ] Ensure no client sensitive documents remain on local desktop downloads folders.
- [ ] Log out of active Suite sessions on shared office terminals.
- [ ] Hand over unresolved emergency WhatsApp threads to on-call supervisor.
