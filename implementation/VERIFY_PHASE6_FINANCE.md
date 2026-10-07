# ABLEBIZ SUITE — PHASE 6 FINANCE VERIFICATION MATRIX

## 1. Executive Summary
- **Module:** Phase 6 — Operational Finance (Quotations, Invoices, Payments, Receipts, Expenses & Vendors)
- **Status:** **PASSED (All Verification Criteria Satisfied)**
- **Database Modality:** 100% Non-destructive. Zero schema alterations, leveraging verified Phase 1 schema and atomic PostgreSQL trigger `trg_recalculate_invoice_payment`.
- **Financial Immutability:** Enforced. Frozen price snapshots from catalog to quotation and invoice items. Invoices with recorded payments are locked against financial modification.

---

## 2. Component Inventory & Verification Matrix

| Area | Route | Canonical Tables / Trigger | Verified Capabilities |
|---|---|---|---|
| **Quotations** | `/admin/quotations` | `public.quotations`<br>`public.quotation_items`<br>`public.services_catalog` | • Pre-populates unit prices from catalogue default fees<br>• Stores independent price snapshots in `quotation_items.unit_price`<br>• Enforces minimum price warning if unit price < `min_fee_ngn`<br>• Real-time calculations: subtotal, discount, tax (VAT), total<br>• Controlled lifecycle: `draft` → `sent` → `accepted` / `rejected` → `converted`<br>• Unique human-readable numbering: `QT-YYYYMM-XXXX`<br>• Professional branded print view (terms, client info, Moniepoint account) |
| **Invoice Conversion** | `/admin/quotations` & `/admin/invoices` | `public.quotations`<br>`public.invoices`<br>`public.invoice_items` | • Explicit **"Convert to Invoice"** action button (no silent creation)<br>• Copies quotation items to invoice items with frozen snapshots<br>• Transitions quotation status to `converted`<br>• Prevents duplicate conversion<br>• Unique sequential invoice numbering: `INV-YYYYMM-XXXX`<br>• Audit event logged in `public.activity_timeline` |
| **Tax Invoices** | `/admin/invoices` | `public.invoices`<br>`public.invoice_items`<br>`public.clients`<br>`public.businesses` | • Direct invoice issuance and quote-converted invoices<br>• Issue date and due date controls (7 days net, 14 days, 30 days)<br>• Immutability lock when `amount_paid > 0`<br>• Official branded printable invoice view with remittance instructions<br>• Status progression: `draft` → `sent` → `partially_paid` → `paid` / `overdue` |
| **Payments & Balance Engine** | `/admin/payments` | `public.payments`<br>`trg_recalculate_invoice_payment`<br>`public.invoices` | • Validation: `amount > 0`, invoice linkage<br>• Payment methods: `bank_transfer`, `pos`, `cash`, `online_gateway`, `cheque`<br>• Database trigger automatically recalculates `amount_paid`, `balance_due`, and updates invoice status to `paid` or `partially_paid`<br>• Zero localStorage dependency; database is authoritative |
| **Official Receipts** | `/admin/payments` & `/admin/invoices` | `public.payments`<br>`public.invoices` | • Unique sequential numbering: `REC-YYYYMM-XXXX`<br>• Official ABLEBIZ BUSINESS SERVICES printable receipt format<br>• Details: Client name, applied invoice, transaction amount, cumulative paid to date, outstanding balance, reference, bank account credited<br>• Verified transactions only |
| **Vendors** | `/admin/vendors` | `public.vendors` | • Registry for statutory authorities (CAC, FIRS, SCUML) and suppliers<br>• Contact details, bank settlement accounts, active toggles<br>• Category classification and search |
| **Expenses & Disbursements** | `/admin/expenses` | `public.expenses`<br>`public.vendors`<br>`public.service_requests` | • Record disbursements linked to vendors and optional service requests<br>• Categories: CAC filing fees, FIRS taxes, SCUML fees, overheads<br>• Direct cost tracking per service request for margin visibility |
| **Client 360° Financial History** | `/admin/clients` | `public.clients`<br>`public.invoices` | • Integrated "Finance & Invoices" tab in Client 360° drawer<br>• Real-time invoice listing, total amount, paid, and balance due |

---

## 3. Financial Integrity & Price Snapshot Trail

Verified end-to-end price snapshot workflow:
1. **Catalog Default Fee:** Configured in `services_catalog.default_fee_ngn` (e.g., ₦35,000).
2. **Quotation Snapshot:** Copied into `quotation_items.unit_price` = ₦35,000. If `services_catalog` is updated later, `quotation_items.unit_price` remains ₦35,000.
3. **Invoice Snapshot:** When converted, copied into `invoice_items.unit_price` = ₦35,000. Changes to quotation or catalog do not alter the invoice.
4. **Payment Execution:** Client remits partial payment (₦20,000). Payment recorded in `public.payments`.
5. **Database Balance Engine:** PostgreSQL trigger fires:
   - `amount_paid` = ₦20,000
   - `balance_due` = ₦15,000
   - `status` = `partially_paid`
6. **Receipt Issuance:** Official receipt `REC-YYYYMM-XXXX` generated referencing `INV-YYYYMM-XXXX`, showing ₦20,000 paid and ₦15,000 remaining.

---

## 4. Public Protection & RBAC
- **Zero Public Pricing:** Public website routes (`/`, `/about`, `/services`, `/contact`, `/blog`, `/refer-and-earn`) display zero prices or financial figures.
- **RBAC Guards:** Routes `/admin/quotations`, `/admin/invoices`, `/admin/payments`, `/admin/expenses`, `/admin/vendors` are protected by `<ProtectedRoute requiredModule="finance">`.
- **Database RLS:** Table policies require `public.is_active_staff() = true`.
