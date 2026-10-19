import { ROLE_DEFINITIONS, getRoleTitle } from "../../auth/roleConfig";
import { getHrPermissions, canAccessHrManagementWorkspace } from "../hrPermissions";
import {
  SUITE_CAPABILITY_INVENTORY,
  canCallerAccessModule,
  canCallerAccessRoute,
  resolveAuthorizedLinks,
} from "./capabilityCatalogue";
import { formatDateTimeLagos } from "./dateUtils";
import type {
  AssistantCallerContext,
  AssistantResponsePayload,
  GuideTopicEntry,
  SuiteLinkItem,
  SuiteModuleId,
} from "./types";

export const SUITE_GUIDE_TOPICS: GuideTopicEntry[] = [
  {
    id: "guide_service_request",
    moduleId: "service_requests",
    title: "How to Create and Manage a Service Request",
    route: "/admin/service-requests",
    routeLabel: "Service Requests Workbench",
    keywords: [
      "service request",
      "create service request",
      "new service request",
      "tracking code",
      "sr-",
      "requirements checklist",
      "engagement",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:create|open|start|add|log|manage|update)\s+(?:a\s+)?service\s+request/i,
      /service\s+request\s+workflow/i,
    ],
    summary:
      "A **Service Request** (`public.service_requests`) is the central operational record in ABLEBIZ SUITE that links a client, optional business entity, catalogue service, assigned staff member, requirements checklist, and target completion date.",
    prerequisites: [
      "An active **Client** record must already exist in **Clients 360°** (`/admin/clients`). If the prospect is still a Lead, convert the lead first in **Leads Pipeline** (`/admin/leads`).",
      "At least one active service must exist in **Services Catalogue** (`/admin/services-catalog`).",
      "Your role must have `operations.create` permission (`Super Admin`, `System Administrator`, `Operations Manager`, or `Client Service Officer`).",
    ],
    steps: [
      "Open **OPERATIONS → Service Requests** (`/admin/service-requests`) from the left navigation sidebar.",
      "Click the **New Request** button in the top-right header.",
      "Select the **Client** (required) and optionally link an existing **Business Entity** belonging to that client.",
      "Select the **Catalogue Service** (required), choose the **Priority** (`low`, `normal`, `high`, or `urgent`), assign an **Operations Staff Member**, and optionally set a **Target Completion Date** and internal notes.",
      "Click **Create Service Request** to save the engagement.",
      "To update progress later, select the request in the workbench list, toggle items in the **Requirements Checklist**, or click a status pill under **Quick Status Transition** (`pending_review` → `quoted` → `in_progress` → `awaiting_client` → `under_review` → `completed` / `cancelled`).",
    ],
    requiredFieldsAndValidation: [
      "**Client (`client_id`)** and **Service (`service_id`)** are mandatory; submitting without either triggers: *'Client and Service selection are required.'*",
      "**Tracking Code (`tracking_code`)** is generated automatically in the format `SR-YYYY-XXXXX`.",
      "**Progress (`progress_percent`)** is constrained between `0` and `100` and recalculates automatically as checklist items are checked off.",
    ],
    postSubmissionBehavior: [
      "Inserts a new row into `public.service_requests` with initial status `pending_review` and populates `requirements_checklist` from the selected service's template.",
      "Logs a `service_request_created` event into `public.activity_timeline`.",
      "**Important Financial Boundary:** Creating a Service Request does **not** automatically generate an invoice. Quotations (`/admin/quotations`) and Invoices (`/admin/invoices`) are created explicitly.",
    ],
    roleAndApprovalRules: [
      "**Can Create:** `Super Admin`, `Admin`, `Operations Manager`, `Client Service Officer`.",
      "**Can Edit / Update Status & Checklist:** `Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, `Client Service Officer`.",
      "**View Only:** `Accounts Officer`, `Viewer`.",
    ],
    troubleshootingMissingOrFailed: [
      "If the **New Request** button is hidden, your role does not have `operations.create` permission.",
      "If a client does not appear in the dropdown, check **Leads Pipeline** (`/admin/leads`) to ensure the lead has been converted to an active client.",
    ],
    relatedPrompts: [
      { label: "Open service requests summary", prompt: "Which service requests are currently open or need intervention?" },
      { label: "How to process a CAC application", prompt: "How do I process a CAC application and move it to the next stage?" },
      { label: "How to create a quotation", prompt: "How do I create or revise a quotation?" },
    ],
  },

  {
    id: "guide_cac_application",
    moduleId: "cac_operations",
    title: "How to Process a CAC Application & Advance Workflow Stages",
    route: "/admin/cac-operations",
    routeLabel: "CAC Operations Workbench",
    keywords: [
      "cac",
      "cac application",
      "cac filing",
      "next stage",
      "advance stage",
      "move application",
      "name search",
      "name reserved",
      "under cac review",
      "cac query",
      "certificate number",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:process|create|update|advance|move|submit)\s+(?:a\s+|an\s+)?(?:cac\s+)?application/i,
      /move\s+an\s+application\s+to\s+its\s+next\s+stage/i,
      /cac\s+(?:workflow|stages|process)/i,
    ],
    summary:
      "The **CAC Operations Workbench** (`/admin/cac-operations`) tracks Corporate Affairs Commission filings across an **11-stage operational workflow** plus `rejected` (queried) and `cancelled` exception states.",
    prerequisites: [
      "An active **Client** record (`public.clients`).",
      "A linked **Service Request** (if you do not select one during creation, the system automatically creates or links a parent Service Request for traceability).",
      "Your role must have `operations.create` / `operations.edit` permission (`Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, or `Client Service Officer` for initial creation).",
    ],
    steps: [
      "Navigate to **OPERATIONS → CAC Operations** (`/admin/cac-operations`).",
      "**To start a new filing:** Click **New CAC Filing**, select the **Client**, optional **Business** and **Service Request**, choose the **Application Type** (`business_name`, `company_incorporation`, `ngo_trustees`, `annual_returns`, or `post_incorporation_change`), enter **Proposed Name Option 1** (required) and **Option 2**, assign an officer, and click **Create Filing**.",
      "**To edit filing particulars:** Select the filing in the left list and click **Edit Particulars** in the workbench panel to record the **Approved Name**, **CAC Availability/Reservation Code**, **Filing Reference Number**, **Submission Date**, **Approval Date**, or **Certificate Number**.",
      "**To move an application to its next stage:** Select the application and click **Advance / Change Stage** in the workbench header.",
      "Choose the target stage from the 11-stage flow (`new_request` → `documents_required` → `documents_verified` → `name_search` → `name_reserved` → `application_prepared` → `application_submitted` → `under_cac_review` → `approved` → `documents_received` → `completed`, or `rejected` / `cancelled`) and click **Confirm Stage Update**.",
    ],
    requiredFieldsAndValidation: [
      "**Creation:** `Client` and `Proposed Name 1` are mandatory.",
      "**Approval / Completion Validation:** Moving to `approved`, `documents_received`, or `completed` **requires** a valid **Certificate / RC / BN Number** (`certificate_number`). The UI blocks the transition until provided.",
      "**Rejection / Query Validation:** Moving to `rejected` **requires** a **Rejection / Query Reason** (`rejection_reason`) so rectification steps are documented.",
    ],
    postSubmissionBehavior: [
      "Updates `public.cac_applications.current_stage` and relevant dates/particulars.",
      "When marked `completed`, automatically updates the linked `public.service_requests` status to `completed` (`progress_percent = 100`) and writes the `registration_number` to the linked `public.businesses` record.",
      "Appends a stage-transition entry into `public.activity_timeline`.",
    ],
    roleAndApprovalRules: [
      "**Can Create:** `Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, `Client Service Officer`.",
      "**Can Edit Particulars & Advance Stages:** `Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`.",
      "**Read-Only:** `Accounts Officer`, `Viewer`.",
    ],
    troubleshootingMissingOrFailed: [
      "If **Advance / Change Stage** or **Edit Particulars** is not visible, verify that your role is `Registration Officer`, `Operations Manager`, `Admin`, or `Super Admin`.",
      "If stage update fails with a validation message, ensure you entered the **Certificate / RC / BN Number** (for approved/completed stages) or **Rejection Reason** (for rejected stage).",
    ],
    relatedPrompts: [
      { label: "Which CAC applications are overdue?", prompt: "Which CAC applications are overdue or waiting for review?" },
      { label: "How to upload CAC documents", prompt: "How do I upload or verify a document in the Document Vault?" },
    ],
  },

  {
    id: "guide_quotation",
    moduleId: "quotations",
    title: "How to Create, Revise, or Convert a Quotation to an Invoice",
    route: "/admin/quotations",
    routeLabel: "Quotations Workspace",
    keywords: [
      "quotation",
      "quote",
      "create quotation",
      "revise quotation",
      "convert quotation",
      "price snapshot",
      "min fee",
      "discount",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:create|issue|revise|edit|convert|send)\s+(?:a\s+)?quotation/i,
      /quotation\s+to\s+invoice/i,
    ],
    summary:
      "Quotations (`/admin/quotations`) provide formal client cost estimates with snapshotted unit prices from `services_catalog` and explicit one-click conversion into an enforceable Invoice upon client acceptance.",
    prerequisites: [
      "An active **Client** in `/admin/clients` (and optionally an open **Service Request**).",
      "Your role must hold `finance.create` permission (`Super Admin`, `Admin`, or `Accounts Officer`).",
    ],
    steps: [
      "Open **FINANCE → Quotations** (`/admin/quotations`).",
      "Click **New Quotation** in the top-right header.",
      "Select the **Client** (required), optional **Business Entity**, and optional **Service Request**.",
      "Add line items either by selecting a service from the **Add Service from Catalogue** dropdown (which pre-fills `default_fee_ngn`) or by adjusting the description, quantity, and unit price.",
      "Optionally set **Validity Days** (default 14 days), **Discount Amount (₦)**, **VAT / Tax (%)**, and **Terms & Conditions**, then click **Generate Quotation**.",
      "**To update status or convert:** Use the row actions to mark a `draft` quotation as **Sent**, mark a `sent` quotation as **Accepted** or **Rejected**, and click **Convert to Invoice** on an `accepted` quotation.",
      "**Note on revising a quotation:** To preserve financial auditability, issued quotations do not overwrite historical line items in place; create a new quotation revision with updated line items or discounts and mark the superseded draft/quote as `cancelled`.",
    ],
    requiredFieldsAndValidation: [
      "**Client** and at least **one line item** are required.",
      "**Floor Price Safeguard (`min_fee_ngn`):** If a non-executive user sets a line item's `unit_price` below the service's catalogue `min_fee_ngn`, submission is blocked unless performed/approved by `Super Admin` or `Admin`.",
      "**Sequential Numbering:** Automatically generates `QT-YYYYMM-XXXX`.",
    ],
    postSubmissionBehavior: [
      "Inserts the header into `public.quotations` and line items into `public.quotation_items` with snapshotted `unit_price`.",
      "When **Convert to Invoice** is clicked, creates a new `public.invoices` record (`INV-YYYYMM-XXXX`) and copies all `quotation_items` into `public.invoice_items`, marking the quotation status as `converted`.",
    ],
    roleAndApprovalRules: [
      "**Can Create, Update Status & Convert to Invoice:** `Super Admin`, `Admin`, `Accounts Officer`.",
      "**Can Override Minimum Catalogue Floor Price (`min_fee_ngn`):** `Super Admin`, `Admin`.",
      "**View Only:** `Operations Manager`, `Viewer`.",
    ],
    troubleshootingMissingOrFailed: [
      "If **New Quotation** or **Convert to Invoice** is unavailable, your role does not have `finance.create` permission.",
      "If **Convert to Invoice** is not shown on a quotation row, first mark the quotation status as **Accepted** (`status = 'accepted'`).",
    ],
    relatedPrompts: [
      { label: "Show active quotations", prompt: "Summarize our quotations and conversion pipeline." },
      { label: "How to issue an invoice", prompt: "How do I issue an invoice?" },
    ],
  },

  {
    id: "guide_invoice",
    moduleId: "invoices",
    title: "How to Issue an Invoice & Manage Receivables",
    route: "/admin/invoices",
    routeLabel: "Invoices & Billing",
    keywords: [
      "issue invoice",
      "create invoice",
      "new invoice",
      "billing",
      "invoice status",
      "settlement account",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:issue|create|generate|send|print)\s+(?:an\s+)?invoice/i,
      /invoice\s+workflow/i,
    ],
    summary:
      "Invoices (`/admin/invoices`) represent enforceable client billing records with frozen line-item prices, designated corporate settlement bank accounts, and automated balance tracking.",
    prerequisites: [
      "An active **Client** record in `/admin/clients`.",
      "Either an **Accepted Quotation** ready for conversion in `/admin/quotations`, or authorization to issue a direct invoice (`Super Admin`, `Admin`, or `Accounts Officer`).",
    ],
    steps: [
      "**Method A (Recommended — From Accepted Quotation):** Go to **FINANCE → Quotations** (`/admin/quotations`), mark the quotation as **Accepted**, and click **Convert to Invoice**.",
      "**Method B (Direct Invoice Issuance):** Go to **FINANCE → Invoices** (`/admin/invoices`) and click **Issue Direct Invoice**.",
      "Select the **Client** (required), optional **Business** and **Service Request**, set **Payment Due (Days)** (default 7 days), and choose the **Designated Settlement Bank Account** (populated from `public.business_bank_accounts`).",
      "Add services from the catalogue or custom line items, apply any discount or tax percentage, and click **Create & Issue Invoice**.",
      "Click **View / Print** on any invoice row to open the branded ABLEBIZ invoice preview or click **Record Payment** to log a verified receipt directly against that invoice.",
    ],
    requiredFieldsAndValidation: [
      "**Client** and at least **one line item** with a positive total are required.",
      "**Immutable Snapshot:** Once created, `invoice_items.unit_price` and `total_amount` are permanently frozen so future catalogue price edits never alter issued invoices.",
      "**Invoice Number:** Auto-generated sequentially as `INV-YYYYMM-XXXX`.",
    ],
    postSubmissionBehavior: [
      "Inserts `public.invoices` (`status = 'sent'`, `balance_due = total_amount`) and `public.invoice_items`.",
      "Writes an `invoice_created` event to `public.activity_timeline` and `public.audit_logs`.",
    ],
    roleAndApprovalRules: [
      "**Can Issue Invoices & Record Payments:** `Super Admin`, `Admin`, `Accounts Officer`.",
      "**Can View Invoices:** `Super Admin`, `Admin`, `Accounts Officer`, `Operations Manager`, `Viewer`.",
      "**Restricted:** `Registration Officer`, `Client Service Officer`, and `Marketing Officer` cannot access `/admin/invoices`.",
    ],
    troubleshootingMissingOrFailed: [
      "If settlement bank account details look incomplete on the printed invoice, ask a `Super Admin` or `Admin` to verify the active bank slots in **System Settings → Business Profile** (`/admin/settings`).",
    ],
    relatedPrompts: [
      { label: "Show outstanding invoices", prompt: "Show outstanding and overdue invoices." },
      { label: "How to record a payment", prompt: "How do I record or verify a payment?" },
    ],
  },

  {
    id: "guide_payment",
    moduleId: "payments",
    title: "How to Record or Verify a Payment & Issue a Receipt",
    route: "/admin/payments",
    routeLabel: "Payments & Receipts",
    keywords: [
      "record payment",
      "verify payment",
      "log payment",
      "payment receipt",
      "reconcile payment",
      "moniepoint",
      "rec-",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:record|verify|log|reconcile|issue)\s+(?:a\s+)?(?:payment|receipt)/i,
      /payment\s+(?:verification|workflow|process)/i,
    ],
    summary:
      "Payments (`/admin/payments`) record verified client inflows against open invoices, automatically recalculating invoice balances via a PostgreSQL trigger and generating an official Electronic Payment Receipt (`REC-YYYYMM-XXXX`).",
    prerequisites: [
      "**Mandatory SOP Dual-Check Rule:** Never record a payment based solely on a client-submitted transfer screenshot. First verify that the funds have settled in the official ABLEBIZ corporate bank account (e.g. Moniepoint MFB).",
      "An unpaid or partially paid **Invoice** (`balance_due > 0`) must exist in `/admin/invoices`.",
      "Your role must be `Super Admin`, `Admin`, or `Accounts Officer` (`finance.create`).",
    ],
    steps: [
      "Navigate to **FINANCE → Payments** (`/admin/payments`) and click **Record Payment** (or click **Record Payment** directly on an open invoice row in `/admin/invoices`).",
      "Select the **Target Unpaid Invoice** from the dropdown (this automatically links the client and pre-fills the remaining `balance_due`).",
      "Enter the **Amount Received (₦)**, choose the **Payment Method** (`bank_transfer`, `pos`, `cash`, `online_gateway`, or `cheque`), and select the **Bank Account Credited**.",
      "Enter the **Bank Transaction Reference / Session ID** and any reconciliation notes, then click **Confirm & Generate Receipt**.",
      "Click **Receipt** on the recorded payment row to view or print the branded ABLEBIZ Electronic Payment Receipt for delivery to the client.",
    ],
    requiredFieldsAndValidation: [
      "**Target Invoice (`invoice_id`)** is mandatory, and **Amount (`amount`)** must be strictly greater than zero (`amount > 0`).",
      "If the entered amount exceeds the invoice's `balance_due`, the UI prompts for explicit confirmation before proceeding.",
      "Receipt numbers are generated sequentially as `REC-YYYYMM-XXXX`.",
    ],
    postSubmissionBehavior: [
      "Inserts a verified payment row (`is_verified = true`) into `public.payments`.",
      "PostgreSQL trigger `trg_recalculate_invoice_payment` automatically sums verified payments for that invoice, updates `invoices.amount_paid` and `invoices.balance_due`, and transitions `invoices.status` to `partially_paid` or `paid`.",
      "Logs `payment_recorded` in `public.activity_timeline` and `public.audit_logs`.",
    ],
    roleAndApprovalRules: [
      "**Can Record Payments & Generate Receipts:** `Super Admin`, `Admin`, `Accounts Officer`.",
      "**Can View Payments:** `Super Admin`, `Admin`, `Accounts Officer`, `Operations Manager`, `Viewer`.",
    ],
    troubleshootingMissingOrFailed: [
      "If an invoice does not appear in the **Record Payment** dropdown, check `/admin/invoices`—only invoices with `balance_due > 0` are listed.",
      "If the **Record Payment** button is hidden, your role does not have `finance.create` permission.",
    ],
    relatedPrompts: [
      { label: "Payments & reconciliation report", prompt: "Which payments and invoices need reconciliation?" },
      { label: "Financial health summary", prompt: "Summarize our financial collections, invoices, and outstanding receivables." },
    ],
  },

  {
    id: "guide_referrals",
    moduleId: "referrals",
    title: "How to Manage Referrals, Link a Referred Customer & Fulfill Rewards",
    route: "/admin/referrals",
    routeLabel: "Referrals & Partners",
    keywords: [
      "referral",
      "fulfill reward",
      "fulfil reward",
      "spin reward",
      "spin and earn",
      "referred customer",
      "manual link",
      "referrer code",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:manage|link|register|fulfill|fulfil)\s+(?:a\s+)?(?:referral|reward|referred\s+customer)/i,
      /referral\s+(?:workflow|program|reward)/i,
    ],
    summary:
      "The **Referrals & Partners** module (`/admin/referrals`) manages partner leaderboard rankings, attributed lead conversions, promotional **Spin & Earn** and referral rewards fulfillment, and manual referral attribution.",
    prerequisites: [
      "For manual linking: both an active **Referrer Code** and an existing **Lead** record (`public.leads`) must exist.",
      "For reward fulfillment: per ABLEBIZ SOP, verify qualifying client payment or voucher eligibility before marking a reward as fulfilled.",
    ],
    steps: [
      "Open **GROWTH → Referrals & Partners** (`/admin/referrals`).",
      "**To inspect partners & conversions:** Use the **Referrers** tab to view partner codes, total referrals, points, and conversions, or switch to the **Conversions** tab to audit attributed leads.",
      "**To link or register a referred customer manually:** Switch to the **Manual link** tab (`activeTab = 'manual'`). Select the partner's **Referrer Code** (or type the code), search and select the **Referred Lead** from the leads lookup, and click **Link Conversion** (`rpcAdminLinkReferral`).",
      "**To convert a referred prospect into a paying client:** Open **CRM → Leads Pipeline** (`/admin/leads`), locate the lead, and click **Convert to Client**—the system automatically preserves `referral_code` and `referred_by_code` on the new client record and links `referral_events.client_id`.",
      "**To fulfill a pending reward:** In `/admin/referrals`, switch to the **Rewards** tab (`activeTab = 'redemptions'`), filter by Spin or Referral rewards, and click **Mark Fulfilled** on any `pending` reward (`rpcAdminFulfillReward`).",
    ],
    requiredFieldsAndValidation: [
      "**Manual Link:** Both `Referrer Code` and `Target Lead` selection are required.",
      "**Reward Fulfillment:** Records `fulfilled_at` timestamp and staff attribution note (`Fulfilled by <email>`).",
    ],
    postSubmissionBehavior: [
      "Manual linking updates `leads.referred_by` and inserts a manual attribution entry in `public.referral_events` (50 points default).",
      "Fulfilling a reward updates `public.spin_rewards.status` to `fulfilled` (or appends fulfillment metadata on spin lead records).",
    ],
    roleAndApprovalRules: [
      "**Can View & Manage Referrals:** Accessible to authenticated Suite staff (`Super Admin`, `Admin`, `Operations Manager`, `Marketing Officer`, `Client Service Officer`).",
      "**Cash Payout Governance:** Cash payouts or fee discounts require finance verification against settled client invoices.",
    ],
    troubleshootingMissingOrFailed: [
      "If a referred customer forgot to use their partner's referral link when submitting the website form, use the **Manual link** tab in `/admin/referrals` to attribute their lead to the partner's code.",
    ],
    relatedPrompts: [
      { label: "Which rewards are awaiting fulfillment?", prompt: "Which referral and Spin & Earn rewards are awaiting fulfillment?" },
      { label: "Which referrals need follow-up?", prompt: "Which referred leads and referrals need follow-up?" },
    ],
  },

  {
    id: "guide_tasks",
    moduleId: "tasks",
    title: "How to Create, Assign, and Track an Operational Task",
    route: "/admin/tasks",
    routeLabel: "Operational Tasks",
    keywords: [
      "assign a task",
      "create a task",
      "delegate task",
      "task status",
      "task comment",
      "overdue task",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:assign|create|delegate|complete|update)\s+(?:a\s+)?task/i,
    ],
    summary:
      "The **Operational Tasks** module (`/admin/tasks`) enables managers and officers to delegate discrete work items with priority levels, SLA deadlines, and threaded staff discussions.",
    prerequisites: [
      "To create/delegate a task, your role must have `operations.create` permission (`Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, or `Client Service Officer`).",
    ],
    steps: [
      "Navigate to **OPERATIONS → Tasks** (`/admin/tasks`).",
      "Click **Delegate Task** in the top-right header.",
      "Enter the **Task Title** (required) and **Description**, select the **Assigned Staff Member** (`assigned_to`), choose the **Priority** (`low`, `normal`, `high`, `urgent`), and pick a **Due Date**.",
      "Click **Assign Task** to create the record.",
      "**To update status or comment:** Click any task card to open the discussion drawer, post updates in **Task Comments**, or change the status dropdown (`todo`, `in_progress`, `review`, `completed`, `cancelled`).",
      "**Self-Service View:** Every staff member can also view tasks assigned to them under **TEAM → HR & Staff Portal → My Responsibilities** (`/admin/hr/portal`).",
    ],
    requiredFieldsAndValidation: [
      "**Task Title (`title`)** is mandatory.",
      "Tasks with a `due_date` earlier than the current timestamp and `status !== 'completed'` are automatically flagged as **Overdue SLA**.",
    ],
    postSubmissionBehavior: [
      "Inserts a new row into `public.tasks` (`status = 'todo'`) and logs `task_created` in `public.activity_timeline`.",
      "When marked `completed`, stamps `completed_at` with the current timestamp.",
    ],
    roleAndApprovalRules: [
      "**Can Create & Edit Tasks:** `Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, `Client Service Officer`.",
      "**View Only in `/admin/tasks`:** `Accounts Officer`, `Viewer` (all roles can view their own assigned tasks in `/admin/hr/portal`).",
    ],
    troubleshootingMissingOrFailed: [
      "If **Delegate Task** is hidden, your role lacks `operations.create` permission.",
    ],
    relatedPrompts: [
      { label: "Show overdue tasks", prompt: "Which operational tasks are currently overdue?" },
      { label: "What requires attention today?", prompt: "What requires management attention today?" },
    ],
  },

  {
    id: "guide_hr_leave_portal",
    moduleId: "hr_workspace",
    title: "How to Submit a Leave Request, View Employment Details & Check Attendance",
    route: "/admin/hr",
    routeLabel: "HR & Staff Portal",
    keywords: [
      "submit a leave",
      "leave request",
      "apply for leave",
      "employment details",
      "check my attendance",
      "clock in",
      "clock out",
      "attendance correction",
      "my profile",
      "staff portal",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:submit|apply\s+for|request|cancel)\s+(?:a\s+)?leave/i,
      /where\s+can\s+i\s+view\s+my\s+employment\s+details/i,
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:check|log|record|correct)\s+(?:my\s+)?attendance/i,
    ],
    summary:
      "Every active staff member across all 8 roles has access to **My Staff Portal** inside **TEAM → HR & Staff Portal** (`/admin/hr` or `/admin/hr/portal`) for self-service profile viewing, attendance clock-in/out, leave applications, personal HR documents, and company announcements.",
    prerequisites: [
      "An active, provisioned `public.staff_profiles` account.",
      "For HR database persistence (`hr_leave_requests`, `hr_attendance_records`, `hr_staff_details`), `implementation/MIGRATION_HR_WORKSPACE.sql` must be active on the Supabase database.",
    ],
    steps: [
      "**To view your employment & personal details:** Open **TEAM → HR & Staff Portal** (`/admin/hr`), ensure you are in **My Staff Portal** mode (top-right mode switcher for managers, default view for officers), and open the **My Profile** tab. You can view your canonical role, department, employment type/status, reporting manager, and hire date, and update your phone number, residential address, date of birth, and emergency contact details.",
      "**To check or log your attendance:** Switch to the **My Attendance** tab in **My Staff Portal**. When self clock-in is enabled, click **Clock In** at the start of the workday and **Clock Out** when signing off. If an attendance entry needs adjustment, click **Request Correction**, select the date and requested status, enter a reason, and submit.",
      "**To submit a leave request:** Switch to the **My Leave** tab in **My Staff Portal** and click **Apply for Leave**.",
      "Select the **Leave Type** (`annual`, `sick`, `casual`, `maternity`, `paternity`, `compassionate`, `study`, or `unpaid`), pick the **Start Date** and **End Date**, enter a clear **Reason**, and click **Submit Leave Application**.",
      "**To cancel or resubmit a leave request:** You can cancel your own request while it is `pending` or `correction_requested`, or edit and resubmit a request marked `correction_requested`.",
    ],
    requiredFieldsAndValidation: [
      "**Leave Dates:** `start_date` and `end_date` are required, and `end_date` cannot be earlier than `start_date`.",
      "**Working Days Calculation:** The system automatically calculates working days (Monday–Friday inclusive) between your selected dates.",
      "**Overlap Prevention:** Both the client and PostgreSQL trigger `trg_validate_hr_leave_request` block any leave application that overlaps an existing `pending`, `approved`, or `correction_requested` leave request for the same staff member.",
    ],
    postSubmissionBehavior: [
      "Inserts a `pending` record into `public.hr_leave_requests` with an initial `status_history` entry and logs `hr_leave_requested` in `public.audit_logs`.",
      "Once reviewed by management, you receive an in-app notification in `/admin/notifications` with the decision (`approved`, `rejected`, or `correction_requested`) and reviewer comments.",
    ],
    roleAndApprovalRules: [
      "**Self-Service Access:** All 8 active roles (`Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, `Accounts Officer`, `Client Service Officer`, `Marketing Officer`, `Viewer`) can view their own profile, attendance, and submit leave requests.",
      "**Who Can Approve Leave (`Maker-Checker`):** `Operations Manager` can decide leave for operational officers; `Admin` can decide leave for non-Super-Admin staff; `Super Admin` can decide leave for all staff. **Separation of Duties:** No staff member can approve or decide their own leave request (unless they are the sole active Super Admin).",
    ],
    troubleshootingMissingOrFailed: [
      "If submitting leave or saving personal details shows a **Database migration required** message, ask the Super Administrator to apply `implementation/MIGRATION_HR_WORKSPACE.sql` in the Supabase SQL Editor.",
      "If you get an `OVERLAPPING_LEAVE_REQUEST` error, check your **My Leave** table for an existing pending or approved request covering those dates.",
    ],
    relatedPrompts: [
      { label: "Staff on leave in next 3 weeks", prompt: "Which staff will be on leave in the next three weeks?" },
      { label: "My attendance & leave status", prompt: "Show our current HR leave and attendance summary." },
    ],
  },

  {
    id: "guide_approvals_governance",
    moduleId: "staff_rbac",
    title: "How to Submit or Approve a Request (Staff RBAC & HR Maker-Checker Workflows)",
    route: "/admin/team",
    routeLabel: "Staff & RBAC Governance",
    keywords: [
      "submit a request for approval",
      "maker-checker",
      "maker checker",
      "staff approval",
      "role change request",
      "provision staff",
      "add staff",
      "deprovision staff",
      "pending approvals",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:submit\s+a\s+request\s+for\s+approval|request\s+a\s+role\s+change|provision\s+staff|add\s+new\s+staff|approve\s+a\s+request)/i,
      /approval\s+(?:workflow|requirements|rules)/i,
    ],
    summary:
      "ABLEBIZ SUITE enforces **Maker-Checker Governance** across two primary approval workflows: **1) Staff & RBAC Change Requests** (`/admin/team`) and **2) HR Leave & Attendance Corrections** (`/admin/hr`).",
    prerequisites: [
      "**For Staff & RBAC (`/admin/team`):** You must be a `System Administrator (admin)` (Maker) or `Managing Director / Super Admin (super_admin)` (Direct Executor & Checker).",
      "**For HR Approvals (`/admin/hr`):** You must be `Operations Manager`, `Admin`, or `Super Admin`.",
    ],
    steps: [
      "**Workflow 1 — Submitting a Staff / Role Change Request as Admin (`/admin/team`):** Open **TEAM → Staff & RBAC** (`/admin/team`). Click **Request New Staff** (to propose onboarding) or click **Request Role Change** / **Request Deactivation** / **Request Deprovisioning** on an existing staff row. Enter the required justification **Reason** and submit. Track your proposal in the **My Requests** tab.",
      "**Workflow 2 — Approving a Staff Change Request as Super Admin (`/admin/team`):** Open **TEAM → Staff & RBAC → Pending Approvals** tab. Click **Review & Approve** or **Reject** on any `pending` request. Approving a `create_staff` request provisions the account via the `staff-provision` Edge Function and displays a **One-Time 14-Character Temporary Password Modal** (`must_change_password = true`).",
      "**Workflow 3 — Approving Leave or Attendance Corrections (`/admin/hr`):** Open **TEAM → HR & Staff Portal** (`/admin/hr`), switch to **HR Management**, and open the **Leave Management** or **Attendance** tab. Click **Approve**, **Request Correction**, or **Reject** (with mandatory comment on rejection/correction).",
    ],
    requiredFieldsAndValidation: [
      "**Staff Change Requests (`public.staff_change_requests`):** Justification `reason` is mandatory for all proposals; `rejection_reason` is mandatory when a Super Admin rejects a request.",
      "**Last Super Admin Safeguard:** Database trigger `check_last_super_admin_safeguard()` blocks deactivating, deprovisioning, or changing the role of the final active `super_admin`.",
      "**HR Separation of Duties:** Database triggers `trg_validate_hr_leave_request` and `trg_validate_hr_attendance_correction` prohibit any staff member from approving their own request.",
    ],
    postSubmissionBehavior: [
      "Admin staff proposals enter `status = 'pending'` without mutating `public.staff_profiles` until a Super Admin approves them (`status = 'executed'`).",
      "Every proposal, approval, and rejection is recorded in `public.audit_logs` and `public.activity_timeline`.",
    ],
    roleAndApprovalRules: [
      "**Staff & RBAC Proposals (`Maker`):** `Admin` (`admin`).",
      "**Staff & RBAC Final Approval (`Checker`) & Direct Execution:** Exclusively `Super Admin` (`super_admin`).",
      "**HR Leave & Attendance Approvals:** `Super Admin` (all staff), `Admin` (non-Super-Admin staff), `Operations Manager` (operational officers only).",
    ],
    troubleshootingMissingOrFailed: [
      "If you do not see **TEAM → Staff & RBAC** (`/admin/team`) in the sidebar, your role is not `Super Admin` or `Admin`.",
      "If you cannot click **Approve** on an HR leave request in `/admin/hr/leave`, check whether the request belongs to yourself (blocked by separation of duties) or to a staff member above your role hierarchy.",
    ],
    relatedPrompts: [
      { label: "Pending approvals & audit summary", prompt: "Are there any pending staff approvals or leave requests awaiting review?" },
      { label: "Why is a button unavailable to my role?", prompt: "Why is a button or module unavailable to my role?" },
    ],
  },

  {
    id: "guide_leads_crm",
    moduleId: "leads",
    title: "How to Triage a Lead, Convert to Client & Schedule Follow-ups",
    route: "/admin/leads",
    routeLabel: "Leads Pipeline",
    keywords: [
      "convert lead",
      "qualify lead",
      "lead to client",
      "schedule follow-up",
      "followup",
      "log communication",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:convert|qualify|triage|manage)\s+(?:a\s+)?lead/i,
      /how\s+(?:do\s+i|to|can\s+i)\s+schedule\s+(?:a\s+)?follow[- ]?up/i,
    ],
    summary:
      "Inbound prospects from the website enter **CRM → Leads Pipeline** (`/admin/leads`) and progress through qualification (`new` → `contacted` → `qualified`) before conversion into an active **Client 360°** profile (`/admin/clients`).",
    prerequisites: [
      "Your role must have `crm.view` and `crm.edit` / `crm.create` permission (`Super Admin`, `Admin`, `Operations Manager`, `Client Service Officer`, or `Marketing Officer`).",
    ],
    steps: [
      "Open **CRM → Leads Pipeline** (`/admin/leads`) and filter by `new` to view uncontacted prospects (15-minute response SLA during business hours).",
      "After contacting the prospect on WhatsApp or phone, use the stage buttons on the lead card to advance status to `contacted` and `qualified`.",
      "When ready to onboard, click **Convert to Client** on the lead card. Choose either **Create New Client Profile** or link to an **Existing Client**, then click **Confirm Conversion**.",
      "To schedule a callback or reminder, open **CRM → Follow-ups** (`/admin/follow-ups`) and click **Schedule Follow-up**.",
      "To record a summary of a WhatsApp chat or phone call, open **COMMUNICATION → Client Communications** (`/admin/communications`) and click **Log Communication**.",
    ],
    requiredFieldsAndValidation: [
      "Lead conversion preserves the original row in `public.leads` (`is_converted = true`, `qualification_status = 'converted'`, `converted_client_id = <uuid>`) and automatically carries over `referral_code` and `referred_by_code`.",
      "Creating a direct client in `/admin/clients` checks existing phone numbers and emails to warn against duplicate profiles.",
    ],
    postSubmissionBehavior: [
      "Creates the `public.clients` record, links any associated `public.referral_events`, and writes a `lead_converted` event to `public.activity_timeline`.",
    ],
    roleAndApprovalRules: [
      "**Can Manage Leads, Clients, Follow-ups & Communications:** `Super Admin`, `Admin`, `Operations Manager`, `Client Service Officer`, `Marketing Officer`.",
      "**View Only:** `Viewer`.",
    ],
    troubleshootingMissingOrFailed: [
      "If stage buttons or **Convert to Client** are disabled, your role has read-only CRM access (`Viewer`) or lacks `crm.edit` permission.",
    ],
    relatedPrompts: [
      { label: "Show leads pipeline stats", prompt: "Summarize our leads pipeline and conversion stats." },
      { label: "Show pending follow-ups", prompt: "Which client follow-ups are pending or overdue?" },
    ],
  },

  {
    id: "guide_documents",
    moduleId: "documents",
    title: "How to Upload, Download, or Verify Documents in the Document Vault",
    route: "/admin/documents",
    routeLabel: "Document Vault",
    keywords: [
      "upload document",
      "document vault",
      "download document",
      "signed url",
      "verify document",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:upload|download|view|verify)\s+(?:a\s+)?document/i,
    ],
    summary:
      "The **Document Vault** (`/admin/documents`) stores client identification, CAC certificates, status reports, and receipts inside the private Supabase Storage bucket `ablebiz_documents`.",
    prerequisites: [
      "Your role must have `operations.create` permission to upload (`Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, `Client Service Officer`).",
      "File must be `20 MB` or smaller (`application/pdf`, `image/jpeg`, `image/png`, or `image/webp`).",
    ],
    steps: [
      "Open **OPERATIONS → Documents** (`/admin/documents`).",
      "Click **Upload Document** in the top-right header.",
      "Enter a clear **Document Title** (e.g., `Director 1 NIN Slip`), select the **Category** (`client_id_card`, `passport_photo`, `signature_specimen`, `cac_certificate`, `status_report`, `payment_receipt`, `scuml_certificate`, or `other`), optionally select the **Client**, and choose the file.",
      "Click **Upload to Vault**.",
      "To view or download an existing file, click **View / Download** on the document card—the Suite generates a temporary 60-second authenticated signed URL.",
    ],
    requiredFieldsAndValidation: [
      "**Document Title** and **File** are mandatory; files larger than `20 MB` (`20,971,520` bytes) are rejected before upload.",
    ],
    postSubmissionBehavior: [
      "Uploads the binary file to `storage.objects` (`bucket_id = 'ablebiz_documents'`), inserts metadata in `public.documents`, and logs `document_uploaded` in `public.activity_timeline`.",
    ],
    roleAndApprovalRules: [
      "**Can Upload:** `Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, `Client Service Officer`.",
      "**Can View / Download:** All roles with `operations.view` permission.",
    ],
    troubleshootingMissingOrFailed: [
      "If a downloaded document link expires, simply click **View / Download** again in `/admin/documents` to generate a fresh 60-second signed URL.",
    ],
    relatedPrompts: [
      { label: "Document verification backlog", prompt: "How many documents are in the vault and how many are unverified?" },
    ],
  },

  {
    id: "guide_expenses_vendors",
    moduleId: "expenses",
    title: "How to Record an Expense & Manage Statutory Vendors",
    route: "/admin/expenses",
    routeLabel: "Expenses & Vendors",
    keywords: [
      "record expense",
      "log expense",
      "disbursement",
      "vendor",
      "statutory filing fee",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:record|log|add)\s+(?:an\s+)?(?:expense|disbursement|vendor)/i,
    ],
    summary:
      "The **Expenses** (`/admin/expenses`) and **Vendors** (`/admin/vendors`) modules track statutory regulatory filing fees (CAC, FIRS, SCUML, stamp duty) and operational overhead disbursements.",
    prerequisites: [
      "Your role must hold `finance.create` permission (`Super Admin`, `Admin`, or `Accounts Officer`).",
    ],
    steps: [
      "**To add a statutory authority or supplier:** Open **FINANCE → Vendors** (`/admin/vendors`), click **Add Vendor**, enter the **Vendor Name**, **Category**, contact person, and bank details, and click **Save Vendor**.",
      "**To record an expense:** Open **FINANCE → Expenses** (`/admin/expenses`) and click **Record Disbursement**.",
      "Enter the **Amount (₦)**, **Expense Date**, **Category** (`cac_filing_fee`, `firs_tax_fee`, `scuml_fee`, `stamp_duty`, `office_operations`, `utilities`, `marketing`, `logistics`, or `other`), and **Payment Method**.",
      "Optionally link a **Vendor** and a **Service Request** (for direct job costing) and click **Save Expense**.",
    ],
    requiredFieldsAndValidation: [
      "**Expense Amount (`amount`)** must be strictly greater than zero (`amount > 0`).",
    ],
    postSubmissionBehavior: [
      "Inserts a row in `public.expenses`, logs `expense_recorded` in `public.activity_timeline`, and immediately updates Net Operating Margin (`Total Collected Revenue - Recorded Expenses`).",
    ],
    roleAndApprovalRules: [
      "**Can Record Expenses & Manage Vendors:** `Super Admin`, `Admin`, `Accounts Officer`.",
      "**Can View:** `Super Admin`, `Admin`, `Accounts Officer`, `Operations Manager`, `Viewer`.",
    ],
    troubleshootingMissingOrFailed: [
      "If **Record Disbursement** or **Add Vendor** is hidden, your role lacks `finance.create` permission.",
    ],
    relatedPrompts: [
      { label: "Show expenses breakdown", prompt: "Summarize our recorded operating expenses and vendor disbursements." },
    ],
  },

  {
    id: "guide_settings_catalog",
    moduleId: "settings",
    title: "How to Configure Business Profile, Settlement Bank Accounts & Services Catalogue",
    route: "/admin/settings",
    routeLabel: "System Settings",
    keywords: [
      "business profile",
      "bank account",
      "settlement account",
      "nuban",
      "service catalog",
      "services catalogue",
      "default fee",
    ],
    questionPatterns: [
      /how\s+(?:do\s+i|to|can\s+i)\s+(?:update|change|configure|edit)\s+(?:the\s+)?(?:business\s+profile|bank\s+account|settlement\s+account|service\s+catalog|pricing)/i,
    ],
    summary:
      "Company identity and corporate settlement bank accounts are managed in **System Settings** (`/admin/settings`), while service offerings and internal reference fees are managed in **OPERATIONS → Services Catalogue** (`/admin/services-catalog`).",
    prerequisites: [
      "**For System Settings (`/admin/settings`):** `Super Admin` or `System Administrator (admin)`.",
      "**For Services Catalogue (`/admin/services-catalog`):** `Super Admin`, `Admin`, or `Operations Manager`.",
    ],
    steps: [
      "**To update company details or bank accounts:** Open **SETTINGS → System Settings** (`/admin/settings`). In the **Business Profile** tab, edit company contact info, address, default payment terms, and up to **3 Corporate Bank Account Slots** (`account_slot` 1, 2, 3), mark one active slot as **Default Settlement**, and click **Save Business Profile**.",
      "**To add or edit a service offering:** Open **OPERATIONS → Services Catalogue** (`/admin/services-catalog`), click **New Service** or select a service and click **Edit**, configure turnaround days, deliverables, requirements, and internal fees (`default_fee_ngn`, `min_fee_ngn`, `internal_cost_estimate`), and save.",
    ],
    requiredFieldsAndValidation: [
      "**Bank Accounts:** Active bank slots require a valid **10-digit Nigerian NUBAN** account number, bank name, and account name.",
      "**Nigerian Phone Numbers:** Normalized and validated for Nigerian mobile/landline formats.",
    ],
    postSubmissionBehavior: [
      "Updates `public.business_profile` and `public.business_bank_accounts`, immediately reflecting on printed Quotations, Invoices, and Payment Receipts, and logs changes to `public.audit_logs`.",
    ],
    roleAndApprovalRules: [
      "**System Settings (`/admin/settings`):** `Super Admin` and `Admin`.",
      "**Services Catalogue (`/admin/services-catalog`):** `Super Admin`, `Admin`, `Operations Manager`.",
    ],
    troubleshootingMissingOrFailed: [
      "If saving a bank account fails, verify that the account number contains exactly 10 digits (NUBAN standard).",
    ],
    relatedPrompts: [
      { label: "Show active bank accounts & profile", prompt: "What are our configured business profile details and settlement bank accounts?" },
      { label: "Show services catalogue", prompt: "List the active services in our Services Catalogue." },
    ],
  },
];

/**
 * Builds a tailored explanation when a user asks why a button, feature, or module is unavailable to their role.
 */
export function buildRolePermissionResponse(
  query: string,
  caller: AssistantCallerContext
): AssistantResponsePayload {
  const role = caller.canonicalRole;
  const roleConfig = ROLE_DEFINITIONS[role];
  const hrPerms = getHrPermissions(role);
  const q = query.toLowerCase();

  const modules: Array<{ label: string; module: string; route: string }> = [
    { label: "Manager Workbench", module: "workbench", route: "/admin/dashboard" },
    { label: "CRM (Leads, Clients, Businesses, Follow-ups, Communications)", module: "crm", route: "/admin/clients" },
    { label: "Operations (Services Catalogue, Service Requests, CAC, Tasks, Documents)", module: "operations", route: "/admin/service-requests" },
    { label: "Finance (Quotations, Invoices, Payments, Expenses, Vendors)", module: "finance", route: "/admin/invoices" },
    { label: "HR & Staff Portal", module: "hr", route: "/admin/hr" },
    { label: "Executive Reports", module: "reports", route: "/admin/reports" },
  ];

  const rows = modules.map((m) => {
    const canView = role === "super_admin" || caller.hasPermission(m.module, "view");
    const canCreate = role === "super_admin" || caller.hasPermission(m.module, "create");
    const canEdit = role === "super_admin" || caller.hasPermission(m.module, "edit");
    const canApprove = role === "super_admin" || caller.hasPermission(m.module, "approve");
    return [
      m.label,
      canView ? "Yes" : "No",
      canCreate ? "Yes" : "No",
      canEdit ? "Yes" : "No",
      canApprove ? "Yes" : "No",
    ];
  });

  // Add governance modules
  rows.push([
    "Staff & RBAC (/admin/team)",
    role === "super_admin" || role === "admin" ? "Yes" : "No",
    role === "super_admin" ? "Direct" : role === "admin" ? "Maker Request" : "No",
    role === "super_admin" ? "Direct" : role === "admin" ? "Maker Request" : "No",
    role === "super_admin" ? "Yes (Checker)" : "No",
  ]);
  rows.push([
    "Security Audit Logs (/admin/audit-logs)",
    role === "super_admin" || role === "admin" ? "Yes (Read-Only)" : "No",
    "Immutable",
    "Immutable",
    "N/A",
  ]);

  let specificExplanation = "";
  if (q.includes("finance") || q.includes("invoice") || q.includes("payment") || q.includes("quotation") || q.includes("expense")) {
    specificExplanation =
      "Financial creation and editing actions (**New Quotation**, **Issue Direct Invoice**, **Record Payment**, **Record Disbursement**) are restricted to **Accounts Officers**, **System Administrators**, and **Super Administrators** (`finance.create` / `finance.edit`).";
  } else if (q.includes("staff") || q.includes("team") || q.includes("role") || q.includes("provision") || q.includes("deprovision")) {
    specificExplanation =
      "Staff account provisioning and role mutations in **Staff & RBAC** (`/admin/team`) are governed by **Maker-Checker Security**: **System Administrators (`admin`)** can submit change requests, while only a **Super Administrator (`super_admin`)** can directly mutate staff profiles or approve pending requests.";
  } else if (q.includes("leave") || q.includes("attendance") || q.includes("hr")) {
    specificExplanation = `In **HR & Staff Portal** (\`/admin/hr\`), your role (**${caller.roleTitle}**) has **${canAccessHrManagementWorkspace(role) ? "HR Management + My Staff Portal" : "Self-Service (My Staff Portal)"}** access. Note that **Separation of Duties** prohibits any staff member from approving their own leave or attendance correction request.`;
  } else if (q.includes("cac") || q.includes("stage") || q.includes("service request")) {
    specificExplanation =
      "Operational creation and stage transition buttons in **CAC Operations** (`/admin/cac-operations`) and **Service Requests** (`/admin/service-requests`) require `operations.create` / `operations.edit` permissions (`Super Admin`, `Admin`, `Operations Manager`, `Registration Officer`, and `Client Service Officer` for intake).";
  }

  const markdown = [
    `### 🔐 Role & Permission Scope for ${caller.roleTitle} (\`${role}\`)`,
    "",
    `**Executive Summary:** Your authenticated session is bound to the canonical role **${caller.roleTitle}** in the **${roleConfig.department}** department (*${roleConfig.description}*). ABLEBIZ SUITE hides or disables action buttons when your role does not hold the required module action permission (` +
      "`view`, `create`, `edit`, `approve`, `export`" +
      `) or when **Maker-Checker Separation of Duties** applies.`,
    specificExplanation ? `\n> **Specific Context:** ${specificExplanation}` : "",
    "",
    "#### Why a Button or Action May Be Unavailable",
    "1. **Module Action Gate:** Each route and modal button checks `hasPermission(module, action)` from `public.roles_permissions`.",
    "2. **Maker-Checker Governance (`/admin/team`):** Only `super_admin` can execute direct staff role/status changes or approve `staff_change_requests`. `admin` sees **Request Role Change / Request New Staff** instead of direct mutation buttons.",
    "3. **HR Separation of Duties (`/admin/hr`):** Even if you are an `Admin` or `Operations Manager`, you cannot click **Approve** on your own leave request or on a request from a higher role tier.",
    "4. **Workflow State Preconditions:** Some buttons only appear when a record reaches a specific status (for example, **Convert to Invoice** on `/admin/quotations` requires the quotation status to be `accepted`, and **Record Payment** requires `balance_due > 0`).",
    "",
    "#### What You Should Do Next",
    "- Check the **Role Permission Matrix** below to confirm which actions your role supports.",
    "- If you need a restricted action executed (such as a fee floor override, invoice issuance, or role update), route the request to an authorized officer or **Super Administrator**.",
  ]
    .filter(Boolean)
    .join("\n");

  const rawLinks: SuiteLinkItem[] = [
    { label: "Manager Workbench", path: "/admin/dashboard" },
    { label: "HR & My Staff Portal", path: "/admin/hr" },
    { label: "Staff & RBAC Matrix", path: "/admin/team" },
  ];

  return {
    id: `perm-${Date.now()}`,
    intentType: "permission_explanation",
    moduleId: "staff_rbac",
    status: "ok",
    headline: `Role & Permission Scope: ${caller.roleTitle}`,
    markdown,
    metrics: [
      { label: "Your Canonical Role", value: caller.roleTitle, sublabel: role, tone: "purple" },
      { label: "Department", value: roleConfig.department, tone: "blue" },
      { label: "Finance Access", value: caller.hasPermission("finance", "view") ? "Authorized" : "Restricted", tone: caller.hasPermission("finance", "view") ? "emerald" : "amber" },
      { label: "HR Scope", value: hrPerms.view_hr_overview ? "Management + Portal" : "My Staff Portal", tone: "emerald" },
    ],
    expandableSections: [
      {
        title: `Permission Matrix for ${caller.roleTitle} (${role})`,
        badge: "RBAC Policy",
        defaultOpen: true,
        table: {
          headers: ["Suite Domain / Module", "View", "Create", "Edit", "Approve"],
          rows,
        },
      },
    ],
    links: resolveAuthorizedLinks(caller, rawLinks),
    freshness: {
      queriedAtIso: new Date().toISOString(),
      queriedAtFormatted: formatDateTimeLagos(),
      timezone: "Africa/Lagos",
      dateRangeLabel: "Current Authenticated Session Policy",
      sources: ["auth.users", "public.staff_profiles", "public.roles_permissions"],
    },
    followUpSuggestions: [
      { label: "How do I submit a request for approval?", prompt: "How do I submit a request for approval?" },
      { label: "How do I submit a leave request?", prompt: "How do I submit a leave request?" },
      { label: "What requires attention today?", prompt: "What requires attention today?" },
    ],
  };
}

/**
 * Builds an actionable troubleshooting guide when a user asks how to fix an error or failed operation.
 */
export function buildTroubleshootingResponse(
  query: string,
  caller: AssistantCallerContext
): AssistantResponsePayload {
  const q = query.toLowerCase();

  let targetedSection = "";
  if (q.includes("leave") || q.includes("overlap") || q.includes("hr") || q.includes("migration")) {
    targetedSection = [
      "#### Targeted Diagnosis: HR / Leave Operation Error",
      "- **`OVERLAPPING_LEAVE_REQUEST`:** You already have a `pending`, `approved`, or `correction_requested` leave application whose date range overlaps your selected dates. Open **HR & Staff Portal → My Leave** (`/admin/hr/portal`), cancel or revise the existing request, and try again.",
      "- **`MAKER_CHECKER_VIOLATION` / `UNAUTHORIZED_LEAVE_SCOPE`:** Separation of duties prevents you from approving your own leave request or approving leave for a role above your tier. Ask another authorized manager or `Super Admin` to review it.",
      "- **`Database migration required (MIGRATION_HR_WORKSPACE.sql)`:** The extended HR tables are not yet applied in Supabase. A `Super Admin` should execute `implementation/MIGRATION_HR_WORKSPACE.sql` in the Supabase SQL Editor.",
    ].join("\n");
  } else if (q.includes("cac") || q.includes("certificate") || q.includes("stage")) {
    targetedSection = [
      "#### Targeted Diagnosis: CAC Stage Transition Error",
      "- **Missing Certificate / RC / BN Number:** Moving a CAC filing to `approved`, `documents_received`, or `completed` requires `certificate_number` to be filled in.",
      "- **Missing Rejection Reason:** Moving a CAC filing to `rejected` requires a non-empty `rejection_reason` explaining the CAC query.",
    ].join("\n");
  } else if (q.includes("quotation") || q.includes("invoice") || q.includes("payment") || q.includes("min_fee")) {
    targetedSection = [
      "#### Targeted Diagnosis: Quotation / Invoice / Payment Error",
      "- **Unit Price Below Minimum Fee (`min_fee_ngn`):** Non-executive staff cannot price a quotation item below `services_catalog.min_fee_ngn`. Request a `Super Admin` or `Admin` to issue or approve the discounted quotation.",
      "- **Invoice Not Selectable in Record Payment:** Only invoices with `balance_due > 0` appear in `/admin/payments`. Verify the invoice in `/admin/invoices`.",
    ].join("\n");
  } else if (q.includes("login") || q.includes("password") || q.includes("session") || q.includes("provision")) {
    targetedSection = [
      "#### Targeted Diagnosis: Login, Provisioning, or Password Change Error",
      "- **Redirected to `/admin/change-password`:** Your account has `must_change_password = true` (mandatory first-login security guard). Enter your 14-character temporary password and set a new password of at least 8 characters (do not use `Welcome1` or `password123`).",
      "- **`Access Denied: not linked to a provisioned staff profile`:** Ask a `Super Admin` to open **TEAM → Staff & RBAC** (`/admin/team`) and provision or reconcile your email via the `staff-provision` workflow.",
    ].join("\n");
  }

  const markdown = [
    "### 🛠️ Troubleshooting Failed Operations & Recovery Steps",
    "",
    "**Executive Summary:** In ABLEBIZ SUITE, failed operations are protected by PostgreSQL constraints, Row-Level Security (RLS), and pre-submission validation so partial or corrupted data is never written to Browser `localStorage`.",
    targetedSection ? `\n${targetedSection}` : "",
    "",
    "#### Step-by-Step Recovery Checklist",
    "1. **Check the Validation Banner:** Read the exact red alert banner inside the form modal (for example, missing required fields, NUBAN 10-digit check, 20 MB file size cap, or overlapping leave dates).",
    "2. **Verify Role & Maker-Checker Boundaries:** Confirm your role (**" +
      caller.roleTitle +
      "**) holds `create`, `edit`, or `approve` permission for that module, and that you are not attempting to approve your own request.",
    "3. **Verify Record Preconditions:**",
    "   - **CAC Operations (`/admin/cac-operations`):** Enter the **Certificate / RC / BN Number** before marking `approved`/`completed`, or the **Rejection Reason** before marking `rejected`.",
    "   - **Quotations (`/admin/quotations`):** Mark the quotation `accepted` before clicking **Convert to Invoice**.",
    "   - **Payments (`/admin/payments`):** Select an invoice with `balance_due > 0` and enter an amount `> 0` after verifying settlement in Moniepoint.",
    "   - **Staff & RBAC (`/admin/team`):** If a `staff_change_requests` item shows `status = 'failed'`, inspect the `execution_error` message in **Pending Approvals** and re-run provisioning or reconciliation as `Super Admin`.",
    "4. **Network / Session Timeout Recovery:** If a query times out, click the **Retry** button or refresh your session via **Sign Out → Sign In** (`/admin/login`).",
  ]
    .filter(Boolean)
    .join("\n");

  const rawLinks: SuiteLinkItem[] = [
    { label: "Manager Workbench", path: "/admin/dashboard" },
    { label: "Service Requests", path: "/admin/service-requests" },
    { label: "CAC Operations", path: "/admin/cac-operations" },
    { label: "HR & Staff Portal", path: "/admin/hr" },
    { label: "Staff & RBAC", path: "/admin/team" },
  ];

  return {
    id: `troubleshoot-${Date.now()}`,
    intentType: "troubleshooting",
    moduleId: "general",
    status: "ok",
    headline: "Troubleshooting & Error Recovery Guide",
    markdown,
    links: resolveAuthorizedLinks(caller, rawLinks),
    freshness: {
      queriedAtIso: new Date().toISOString(),
      queriedAtFormatted: formatDateTimeLagos(),
      timezone: "Africa/Lagos",
      dateRangeLabel: `Suite Architecture v${SUITE_CAPABILITY_INVENTORY.general ? "2026.10.2" : "1.2"}`,
      sources: ["ABLEBIZ Operational SOP v1", "Database Constraints & RLS Rules"],
    },
    followUpSuggestions: [
      { label: "Why is a button unavailable to my role?", prompt: "Why is a button unavailable to my role?" },
      { label: "How do I process a CAC application?", prompt: "How do I process a CAC application?" },
      { label: "How do I submit a leave request?", prompt: "How do I submit a leave request?" },
    ],
  };
}

/**
 * Formats a matched GuideTopicEntry into a structured AssistantResponsePayload,
 * including role-specific authorization notes for the current user.
 */
export function formatGuideTopicResponse(
  topic: GuideTopicEntry,
  caller: AssistantCallerContext
): AssistantResponsePayload {
  const canView = canCallerAccessModule(caller, topic.moduleId, "view");
  const canCreateOrEdit =
    canCallerAccessModule(caller, topic.moduleId, "create") ||
    canCallerAccessModule(caller, topic.moduleId, "edit");
  const canOpenRoute = canCallerAccessRoute(caller, topic.route);

  const roleStatusLine = canOpenRoute
    ? canCreateOrEdit
      ? `✅ **Your Role Access (${caller.roleTitle}):** You are authorized to open **${topic.routeLabel}** (\`${topic.route}\`) and perform create/edit actions subject to validation and maker-checker rules.`
      : `👁️ **Your Role Access (${caller.roleTitle}):** You have **read-only / self-service** access to **${topic.routeLabel}** (\`${topic.route}\`). Creation or approval actions require an authorized officer or manager.`
    : `🔒 **Your Role Access (${caller.roleTitle}):** Your role does not have direct route access to \`${topic.route}\`. The workflow steps below explain how authorized officers execute this process.`;

  const markdown = [
    `### 📘 ${topic.title}`,
    "",
    topic.summary,
    "",
    `> ${roleStatusLine}`,
    "",
    `#### 1. Page & Route`,
    `- **Workspace:** **${topic.routeLabel}** (\`${topic.route}\`)`,
    "",
    `#### 2. Prerequisites Before Starting`,
    ...topic.prerequisites.map((p) => `- ${p}`),
    "",
    `#### 3. Step-by-Step UI Navigation & Actions`,
    ...topic.steps.map((s, idx) => `${idx + 1}. ${s}`),
    "",
    `#### 4. Required Fields & Validation Rules`,
    ...topic.requiredFieldsAndValidation.map((r) => `- ${r}`),
    "",
    `#### 5. What Happens After Submission`,
    ...topic.postSubmissionBehavior.map((b) => `- ${b}`),
    "",
    `#### 6. Role Permissions & Approval Requirements`,
    ...topic.roleAndApprovalRules.map((a) => `- ${a}`),
    "",
    `#### 7. If an Expected Button or Record Is Missing`,
    ...topic.troubleshootingMissingOrFailed.map((t) => `- ${t}`),
  ].join("\n");

  const links = resolveAuthorizedLinks(caller, [
    { label: `Open ${topic.routeLabel}`, path: topic.route },
    { label: "Manager Workbench", path: "/admin/dashboard" },
  ]);

  return {
    id: `guide-${topic.id}-${Date.now()}`,
    intentType: "suite_guide",
    moduleId: topic.moduleId,
    status: "ok",
    headline: topic.title,
    markdown,
    links,
    freshness: {
      queriedAtIso: new Date().toISOString(),
      queriedAtFormatted: formatDateTimeLagos(),
      timezone: "Africa/Lagos",
      dateRangeLabel: "Verified Suite Workflow Guide",
      sources: [`Route: ${topic.route}`, "ABLEBIZ Operational SOP v1"],
    },
    followUpSuggestions: topic.relatedPrompts,
  };
}

/**
 * Finds the best matching GuideTopicEntry for a user question.
 */
export function matchGuideTopic(
  query: string,
  fallbackModuleId?: SuiteModuleId
): GuideTopicEntry | null {
  const q = query.toLowerCase().trim();

  // 1. Check explicit regex patterns first
  for (const topic of SUITE_GUIDE_TOPICS) {
    if (topic.questionPatterns.some((rx) => rx.test(q))) {
      return topic;
    }
  }

  // 2. Score by keyword matches
  let bestTopic: GuideTopicEntry | null = null;
  let bestScore = 0;

  for (const topic of SUITE_GUIDE_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += kw.split(" ").length * 2;
      }
    }
    if (fallbackModuleId && topic.moduleId === fallbackModuleId) {
      score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  return bestScore >= 2 ? bestTopic : null;
}

export function getGuideTopicById(id: string): GuideTopicEntry | null {
  return (
    SUITE_GUIDE_TOPICS.find(
      (t) => t.id === id || t.id === `guide_${id.replace(/^create_|^process_|^issue_|^record_|^manage_|^assign_|^submit_/, "")}`
    ) || null
  );
}

