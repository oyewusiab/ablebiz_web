import { normalizeStaffRole, getRoleTitle, type CanonicalStaffRole } from "../../auth/roleConfig";
import { canAccessHrManagementWorkspace } from "../hrPermissions";
import type {
  AssistantCallerContext,
  CapabilityModuleSpec,
  SuiteLinkItem,
  SuiteModuleId,
} from "./types";

export const CAPABILITY_CATALOGUE_VERSION = "2026.10.2";

export const SUITE_CAPABILITY_INVENTORY: Record<SuiteModuleId, CapabilityModuleSpec> = {
  dashboard: {
    moduleId: "dashboard",
    name: "Manager Workbench & Dashboard",
    domain: "OVERVIEW",
    route: "/admin/dashboard",
    purpose:
      "Surfaces daily operational priorities ('What requires attention today?'), critical/rejected CAC filings, overdue tasks, overdue invoices, pending service requests, and recent activity timeline events.",
    tables: [
      "public.clients",
      "public.businesses",
      "public.service_requests",
      "public.cac_applications",
      "public.tasks",
      "public.invoices",
      "public.payments",
      "public.expenses",
      "public.activity_timeline",
    ],
    relationships: [
      "service_requests.client_id -> clients.id",
      "cac_applications.service_request_id -> service_requests.id",
      "invoices.client_id -> clients.id",
    ],
    supportedQueries: [
      "What requires attention today?",
      "Operational exception summary",
      "Overdue items across tasks, CAC, and invoices",
    ],
    supportedWorkflows: [
      "Inspect prioritized attention cards and navigate to underlying operational modules",
      "Refresh live workbench counters",
    ],
    permissionModule: "workbench",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
    ],
    approvalRules: "Financial KPIs (revenue, expenses, unpaid invoice balances) are dynamically masked unless caller holds finance view permission.",
    knownLimitations: "Read-only executive aggregation screen; mutations occur in target operational modules.",
    dataFreshness: "Live PostgreSQL query on load and manual refresh (Africa/Lagos).",
  },

  notifications: {
    moduleId: "notifications",
    name: "Notifications & Staff Alerts",
    domain: "OVERVIEW",
    route: "/admin/notifications",
    purpose:
      "Delivers user-scoped operational alerts, leave review decisions, SLA deadline warnings, and task dispatch notifications.",
    tables: ["public.notifications", "public.staff_profiles"],
    relationships: ["notifications.recipient_staff_id -> staff_profiles.id"],
    supportedQueries: [
      "Unread notifications count",
      "Urgent and high-priority staff alerts",
      "Recent notification inbox summary",
    ],
    supportedWorkflows: [
      "Filter All vs Unread notifications",
      "Mark individual or all notifications as read",
      "Follow deep links to target Suite records",
    ],
    permissionModule: null,
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    approvalRules: "Each staff member only views notifications where recipient_staff_id matches their own staff_profiles.id.",
    knownLimitations: "In-app notification center; external WhatsApp/email dispatches are triggered via human outreach or Supabase Auth.",
    dataFreshness: "Live PostgreSQL query scoped to authenticated staff_profiles.id.",
  },

  leads: {
    moduleId: "leads",
    name: "Leads Pipeline & Inbound Acquisition",
    domain: "CRM",
    route: "/admin/leads",
    purpose:
      "Tracks prospective clients from website consultation forms, checklist downloads, Spin & Earn promotions, and partner referrals through qualification to formal client conversion.",
    tables: [
      "public.leads",
      "public.consultation_requests",
      "public.checklist_downloads",
      "public.clients",
      "public.referral_events",
      "public.activity_timeline",
    ],
    relationships: [
      "leads.converted_client_id -> clients.id",
      "leads.assigned_staff_id -> staff_profiles.id",
      "consultation_requests.lead_id -> leads.id",
    ],
    supportedQueries: [
      "Total leads and breakdown by qualification status (new, contacted, qualified, converted, lost)",
      "Inbound leads by acquisition source (consultation, spin, checklist, referral)",
      "Uncontacted new leads requiring 15-minute SLA outreach",
    ],
    supportedWorkflows: [
      "Advance lead qualification_status (new -> contacted -> qualified -> lost)",
      "Convert Lead to Client (creates new clients record or links existing client, preserves lead record and referral attribution)",
    ],
    permissionModule: "crm",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
    ],
    approvalRules: "Requires CRM edit permission to update qualification stage or convert a lead into a client.",
    knownLimitations: "Lead conversion preserves the original lead row (zero destructive deletion).",
    dataFreshness: "Live PostgreSQL query against public.leads.",
  },

  clients: {
    moduleId: "clients",
    name: "Clients 360° Directory",
    domain: "CRM",
    route: "/admin/clients",
    purpose:
      "Maintains the central paying client registry with a unified 360° profile spanning businesses, service requests, follow-ups, communications, activity timeline, and invoices.",
    tables: [
      "public.clients",
      "public.businesses",
      "public.service_requests",
      "public.follow_ups",
      "public.communications",
      "public.activity_timeline",
      "public.invoices",
    ],
    relationships: [
      "businesses.client_id -> clients.id",
      "service_requests.client_id -> clients.id",
      "invoices.client_id -> clients.id",
      "communications.client_id -> clients.id",
    ],
    supportedQueries: [
      "Total active and registered clients",
      "Client acquisition source and state breakdown",
      "Recently onboarded clients",
    ],
    supportedWorkflows: [
      "Create new client with real-time duplicate phone/email detection",
      "Inspect Client 360° tabs (Overview, Businesses, Requests, Follow-ups, Timeline, Finance)",
    ],
    permissionModule: "crm",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
    ],
    approvalRules: "The Finance tab inside Client 360° is gated by finance.view permission.",
    knownLimitations: "Forward-engineered portal_user_id column exists for future client portal, but external client login is not active in v1.",
    dataFreshness: "Live PostgreSQL query against public.clients.",
  },

  businesses: {
    moduleId: "businesses",
    name: "Registered Businesses & Entities",
    domain: "CRM",
    route: "/admin/businesses",
    purpose:
      "Tracks corporate and legal entities (Business Name, Company Incorporation LLC, NGO/Incorporated Trustees, Annual Returns entities) linked to client owners, RC/BN numbers, TIN, and annual return due dates.",
    tables: ["public.businesses", "public.clients", "public.activity_timeline"],
    relationships: ["businesses.client_id -> clients.id"],
    supportedQueries: [
      "Total registered businesses and breakdown by entity_type",
      "Businesses with or without RC/BN registration numbers or TIN",
      "Upcoming annual return due dates",
    ],
    supportedWorkflows: [
      "Link a new business entity to an active client",
      "Filter businesses by legal structure or search by name / RC / BN number",
    ],
    permissionModule: "crm",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
    ],
    approvalRules: "Requires CRM create permission to register/link a new business record.",
    knownLimitations: "Client owner (client_id) is mandatory (ON DELETE RESTRICT) before creating a business entity.",
    dataFreshness: "Live PostgreSQL query against public.businesses.",
  },

  follow_ups: {
    moduleId: "follow_ups",
    name: "Client Follow-ups & Scheduled Touchpoints",
    domain: "CRM",
    route: "/admin/follow-ups",
    purpose:
      "Schedules and tracks client consultation calls, quotation follow-ups, document reminders, annual return reminders, and payment reminders.",
    tables: ["public.follow_ups", "public.clients", "public.leads", "public.staff_profiles"],
    relationships: [
      "follow_ups.client_id -> clients.id",
      "follow_ups.lead_id -> leads.id",
      "follow_ups.assigned_staff_id -> staff_profiles.id",
    ],
    supportedQueries: [
      "Pending and overdue follow-ups",
      "Follow-ups scheduled for today or upcoming dates",
      "Follow-up breakdown by type and status",
    ],
    supportedWorkflows: [
      "Schedule a new follow-up with date/time, type, and client link",
      "Mark pending follow-ups as completed with outcome notes",
    ],
    permissionModule: "crm",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
    ],
    approvalRules: "Requires CRM create/edit permission.",
    knownLimitations: "Manual outreach logging; does not auto-dial phone lines.",
    dataFreshness: "Live PostgreSQL query against public.follow_ups.",
  },

  communications: {
    moduleId: "communications",
    name: "Client Communications Log",
    domain: "COMMUNICATION",
    route: "/admin/communications",
    purpose:
      "Maintains an auditable log of inbound and outbound client interactions across WhatsApp, phone calls, email, in-person visits, and SMS.",
    tables: [
      "public.communications",
      "public.clients",
      "public.service_requests",
      "public.staff_profiles",
      "public.activity_timeline",
    ],
    relationships: [
      "communications.client_id -> clients.id",
      "communications.service_request_id -> service_requests.id",
      "communications.staff_id -> staff_profiles.id",
    ],
    supportedQueries: [
      "Recent client communications by channel (whatsapp, phone_call, email, in_person, sms)",
      "Inbound vs outbound communication volume",
    ],
    supportedWorkflows: [
      "Log a client communication linked to a client and optional service request",
      "Filter communication logs by channel and direction",
    ],
    permissionModule: "crm",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
    ],
    approvalRules: "Requires CRM create permission to log new communication entries.",
    knownLimitations: "WhatsApp conversations occur externally and must be logged in Suite per SOP.",
    dataFreshness: "Live PostgreSQL query against public.communications.",
  },

  services_catalog: {
    moduleId: "services_catalog",
    name: "Services Catalogue & Internal Reference Pricing",
    domain: "OPERATIONS",
    route: "/admin/services-catalog",
    purpose:
      "Configures ABLEBIZ service offerings, turnaround times, deliverables, requirements, and protected internal pricing (default_fee_ngn, min_fee_ngn, internal_cost_estimate).",
    tables: ["public.services_catalog", "public.public_services_view"],
    relationships: [
      "service_requests.service_id -> services_catalog.id",
      "quotation_items.service_id -> services_catalog.id",
      "invoice_items.service_id -> services_catalog.id",
    ],
    supportedQueries: [
      "Active services in catalogue by category and turnaround days",
      "Internal reference fees, minimum floor fees, and estimated statutory costs (for finance-authorized roles)",
    ],
    supportedWorkflows: [
      "Create or edit a catalogue service (Super Admin, Admin, Operations Manager)",
      "Toggle service active status or public website visibility",
    ],
    permissionModule: "operations",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "viewer",
    ],
    allowedCreateEditRoles: ["super_admin", "admin", "operations_manager"],
    approvalRules:
      "Internal pricing columns (default_fee_ngn, min_fee_ngn, internal_cost_estimate) are only displayed to roles with finance view permission (Super Admin, Admin, Accounts Officer, Operations Manager, Viewer). Catalogue creation/editing is restricted to Super Admin, Admin, and Operations Manager.",
    knownLimitations:
      "Updating default_fee_ngn never alters historical quotations or invoices because prices are snapshotted at creation.",
    dataFreshness: "Live PostgreSQL query against public.services_catalog.",
  },

  service_requests: {
    moduleId: "service_requests",
    name: "Service Requests (Central Operational Hub)",
    domain: "OPERATIONS",
    route: "/admin/service-requests",
    purpose:
      "Serves as the central operational engagement record connecting the client, business entity, catalogue service, assigned staff, progress percentage, requirements checklist, and target completion date.",
    tables: [
      "public.service_requests",
      "public.clients",
      "public.businesses",
      "public.services_catalog",
      "public.staff_profiles",
      "public.activity_timeline",
    ],
    relationships: [
      "service_requests.client_id -> clients.id",
      "service_requests.business_id -> businesses.id",
      "service_requests.service_id -> services_catalog.id",
      "service_requests.assigned_staff_id -> staff_profiles.id",
    ],
    supportedQueries: [
      "Open, pending review, awaiting client, under review, and completed service requests",
      "High-priority and urgent service requests or requests past target_completion_date",
      "Service request workload by assigned officer",
    ],
    supportedWorkflows: [
      "Create a new Service Request (auto-generates SR-YYYY-XXXXX tracking code and populates requirements checklist from catalog)",
      "Transition status across 7 states (pending_review, quoted, in_progress, awaiting_client, under_review, completed, cancelled)",
      "Check off requirements checklist items to automatically recalculate progress_percent",
    ],
    permissionModule: "operations",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "client_service_officer",
    ],
    approvalRules: "Creating a service request does NOT auto-generate an invoice; quotations and invoices follow an explicit financial workflow.",
    knownLimitations: "Requires an existing client record and active service catalog item.",
    dataFreshness: "Live PostgreSQL query against public.service_requests.",
  },

  cac_operations: {
    moduleId: "cac_operations",
    name: "CAC Operations & 11-Stage Filing Engine",
    domain: "OPERATIONS",
    route: "/admin/cac-operations",
    purpose:
      "Manages Corporate Affairs Commission (CAC) registrations and statutory filings across an 11-stage workflow (new_request -> documents_required -> documents_verified -> name_search -> name_reserved -> application_prepared -> application_submitted -> under_cac_review -> approved -> documents_received -> completed) plus rejected/cancelled exception states.",
    tables: [
      "public.cac_applications",
      "public.service_requests",
      "public.clients",
      "public.businesses",
      "public.staff_profiles",
      "public.tasks",
      "public.documents",
      "public.activity_timeline",
    ],
    relationships: [
      "cac_applications.service_request_id -> service_requests.id",
      "cac_applications.client_id -> clients.id",
      "cac_applications.business_id -> businesses.id",
      "cac_applications.assigned_officer_id -> staff_profiles.id",
    ],
    supportedQueries: [
      "Total, active in-progress, completed, rejected/queried, and pending review CAC applications",
      "Breakdown of CAC applications by current_stage and application_type",
      "Overdue or stalled CAC filings (e.g., awaiting documents, under CAC review, or rejected)",
    ],
    supportedWorkflows: [
      "New CAC Filing (links or auto-creates a parent Service Request)",
      "Edit Filing Particulars (proposed names, approved name, reservation code, filing ref, certificate number, officer)",
      "Advance / Change Stage modal (enforces Certificate/RC/BN number for approved/completed, and Rejection Reason for rejected)",
    ],
    permissionModule: "operations",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
    ],
    approvalRules:
      "Transitioning to 'approved', 'documents_received', or 'completed' requires a Certificate/RC/BN number; transitioning to 'rejected' requires a Rejection/Query reason.",
    knownLimitations: "CAC CRP portal submission occurs on the government portal; officers record reservation codes, filing references, and certificates in Suite.",
    dataFreshness: "Live PostgreSQL query against public.cac_applications.",
  },

  tasks: {
    moduleId: "tasks",
    name: "Operational Tasks & SLA Tracking",
    domain: "OPERATIONS",
    route: "/admin/tasks",
    purpose:
      "Tracks staff task assignments, priorities, SLA due dates, completion status, and threaded staff comments.",
    tables: [
      "public.tasks",
      "public.task_comments",
      "public.staff_profiles",
      "public.clients",
      "public.service_requests",
      "public.cac_applications",
    ],
    relationships: [
      "tasks.assigned_to -> staff_profiles.id",
      "tasks.created_by -> staff_profiles.id",
      "tasks.service_request_id -> service_requests.id",
      "tasks.cac_application_id -> cac_applications.id",
      "task_comments.task_id -> tasks.id",
    ],
    supportedQueries: [
      "Pending, in-progress, review, completed, and overdue tasks",
      "Tasks due today or in a specified future window",
      "Task workload by assigned staff member",
    ],
    supportedWorkflows: [
      "Create/Delegate Task with title, description, assignee, priority, and due date",
      "Transition task status (todo, in_progress, review, completed, cancelled)",
      "Post threaded comments on a task",
    ],
    permissionModule: "operations",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "client_service_officer",
    ],
    approvalRules: "Requires operations.create to delegate new tasks and operations.edit to change task status.",
    knownLimitations: "All active staff can also view tasks assigned directly to them inside HR & Staff Portal -> My Responsibilities.",
    dataFreshness: "Live PostgreSQL query against public.tasks.",
  },

  documents: {
    moduleId: "documents",
    name: "Document Vault & Compliance Repository",
    domain: "OPERATIONS",
    route: "/admin/documents",
    purpose:
      "Stores and verifies client identity documents, passport photos, signatures, CAC certificates, status reports, SCUML certificates, and payment receipts in the private Supabase bucket 'ablebiz_documents'.",
    tables: [
      "public.documents",
      "public.clients",
      "public.businesses",
      "public.service_requests",
      "public.cac_applications",
      "storage.objects (ablebiz_documents)",
    ],
    relationships: [
      "documents.client_id -> clients.id",
      "documents.business_id -> businesses.id",
      "documents.service_request_id -> service_requests.id",
      "documents.cac_application_id -> cac_applications.id",
    ],
    supportedQueries: [
      "Total uploaded documents, verified vs unverified backlog",
      "Documents by category (client_id_card, cac_certificate, status_report, etc.)",
      "Documents approaching or past expiry_date",
    ],
    supportedWorkflows: [
      "Upload document (max 20MB; PDF, JPEG, PNG, WEBP) to private bucket and log metadata",
      "Download/View via 60-second authenticated signed URL",
    ],
    permissionModule: "operations",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "client_service_officer",
    ],
    approvalRules: "Direct public URLs are disabled; access requires an active staff session to generate a 60-second signed URL.",
    knownLimitations: "Employee HR documents are stored separately in 'ablebiz_hr_documents' via the HR Workspace (/admin/hr).",
    dataFreshness: "Live PostgreSQL query against public.documents.",
  },

  quotations: {
    moduleId: "quotations",
    name: "Quotations & Estimates",
    domain: "FINANCE",
    route: "/admin/quotations",
    purpose:
      "Creates formal client quotations with snapshotted service pricing, floor-price validation, discount/tax calculation, branded PDF print layout, and explicit conversion to enforceable invoices.",
    tables: [
      "public.quotations",
      "public.quotation_items",
      "public.clients",
      "public.businesses",
      "public.service_requests",
      "public.services_catalog",
      "public.invoices",
      "public.invoice_items",
    ],
    relationships: [
      "quotation_items.quotation_id -> quotations.id",
      "quotations.client_id -> clients.id",
      "quotations.service_request_id -> service_requests.id",
      "quotations.created_by -> staff_profiles.id",
    ],
    supportedQueries: [
      "Quotations count and value by status (draft, sent, viewed, accepted, rejected, expired, converted, cancelled)",
      "Pending or expiring quotations awaiting client acceptance",
      "Quotation-to-invoice conversion rate",
    ],
    supportedWorkflows: [
      "Create Quotation (generates QT-YYYYMM-XXXX, snapshots unit_price from services_catalog, validates against min_fee_ngn for non-super-admins)",
      "Update status (Send, Mark Accepted, Reject)",
      "Explicitly Convert Accepted Quotation to Invoice (creates INV-YYYYMM-XXXX and copies quotation_items into invoice_items)",
      "Open Print / PDF preview with official ABLEBIZ branding",
    ],
    permissionModule: "finance",
    allowedViewRoles: ["super_admin", "admin", "operations_manager", "accounts_officer", "viewer"],
    allowedCreateEditRoles: ["super_admin", "admin", "accounts_officer"],
    approvalRules:
      "Unit prices below services_catalog.min_fee_ngn are blocked for non-executive roles unless approved by Super Admin / Admin.",
    knownLimitations: "Quotations do not count as revenue or receivables until explicitly converted into an Invoice.",
    dataFreshness: "Live PostgreSQL query against public.quotations.",
  },

  invoices: {
    moduleId: "invoices",
    name: "Invoices & Receivables Ledger",
    domain: "FINANCE",
    route: "/admin/invoices",
    purpose:
      "Manages enforceable client billing records with immutable price snapshots, automated balance_due tracking, designated bank settlement account attribution, and overdue receivable monitoring.",
    tables: [
      "public.invoices",
      "public.invoice_items",
      "public.payments",
      "public.clients",
      "public.businesses",
      "public.service_requests",
      "public.quotations",
    ],
    relationships: [
      "invoice_items.invoice_id -> invoices.id",
      "payments.invoice_id -> invoices.id",
      "invoices.client_id -> clients.id",
      "invoices.quotation_id -> quotations.id",
    ],
    supportedQueries: [
      "Total invoiced amount, amount paid, and outstanding balance_due",
      "Overdue invoices past due_date with balance_due > 0",
      "Invoices breakdown by status (draft, sent, partially_paid, paid, overdue, cancelled, refunded)",
    ],
    supportedWorkflows: [
      "Issue Direct Invoice (generates INV-YYYYMM-XXXX with designated settlement bank account)",
      "Record Quick Payment directly against an open invoice",
      "Print / Export official Invoice with ABLEBIZ settlement bank details",
    ],
    permissionModule: "finance",
    allowedViewRoles: ["super_admin", "admin", "operations_manager", "accounts_officer", "viewer"],
    allowedCreateEditRoles: ["super_admin", "admin", "accounts_officer"],
    approvalRules:
      "Invoice line items are frozen upon creation. Payment balance and status (partially_paid / paid) are automatically recalculated by database trigger trg_recalculate_invoice_payment.",
    knownLimitations: "Financial details are restricted from non-finance roles (e.g. registration_officer, marketing_officer, client_service_officer).",
    dataFreshness: "Live PostgreSQL query against public.invoices.",
  },

  payments: {
    moduleId: "payments",
    name: "Payments, Receipts & Reconciliation",
    domain: "FINANCE",
    route: "/admin/payments",
    purpose:
      "Records verified cash inflows against client invoices, generates sequential electronic receipts (REC-YYYYMM-XXXX), and tracks settlement bank accounts and payment methods.",
    tables: [
      "public.payments",
      "public.invoices",
      "public.clients",
      "public.staff_profiles",
      "public.activity_timeline",
    ],
    relationships: [
      "payments.invoice_id -> invoices.id",
      "payments.client_id -> clients.id",
      "payments.received_by -> staff_profiles.id",
    ],
    supportedQueries: [
      "Total verified revenue collected (sum of payments.amount)",
      "Payments breakdown by payment_method (bank_transfer, pos, cash, online_gateway, cheque) and settlement account",
      "Recent payment receipts and unverified payment checks",
    ],
    supportedWorkflows: [
      "Record Payment against an unpaid invoice (mandatory SOP dual-check in Moniepoint/bank portal before logging)",
      "View and print official Electronic Payment Receipt (REC-YYYYMM-XXXX)",
    ],
    permissionModule: "finance",
    allowedViewRoles: ["super_admin", "admin", "operations_manager", "accounts_officer", "viewer"],
    allowedCreateEditRoles: ["super_admin", "admin", "accounts_officer"],
    approvalRules:
      "Mandatory Dual-Check SOP: Staff must verify bank settlement in the official corporate bank account before recording a payment.",
    knownLimitations: "Payments are recorded by authorized finance staff after bank verification; no automated payment gateway webhook is active.",
    dataFreshness: "Live PostgreSQL query against public.payments.",
  },

  expenses: {
    moduleId: "expenses",
    name: "Expenses, Disbursements & Job Costing",
    domain: "FINANCE",
    route: "/admin/expenses",
    purpose:
      "Tracks statutory filing fee disbursements (CAC, FIRS, SCUML, stamp duty) and operational overhead costs, linking direct expenses to service requests and vendors.",
    tables: [
      "public.expenses",
      "public.vendors",
      "public.service_requests",
      "public.staff_profiles",
    ],
    relationships: [
      "expenses.vendor_id -> vendors.id",
      "expenses.service_request_id -> service_requests.id",
      "expenses.paid_by -> staff_profiles.id",
    ],
    supportedQueries: [
      "Total recorded operating expenses",
      "Statutory filing fees vs operational overhead breakdown",
      "Expenses by category and vendor",
    ],
    supportedWorkflows: [
      "Record Disbursement / Expense with amount, date, category, payment method, optional vendor, and optional service request",
    ],
    permissionModule: "finance",
    allowedViewRoles: ["super_admin", "admin", "operations_manager", "accounts_officer", "viewer"],
    allowedCreateEditRoles: ["super_admin", "admin", "accounts_officer"],
    approvalRules: "Requires finance.create permission (Super Admin, Admin, Accounts Officer).",
    knownLimitations: "Distinguishes actual recorded expenses (public.expenses) from catalog estimated internal costs (services_catalog.internal_cost_estimate).",
    dataFreshness: "Live PostgreSQL query against public.expenses.",
  },

  vendors: {
    moduleId: "vendors",
    name: "Vendors & Statutory Authorities",
    domain: "FINANCE",
    route: "/admin/vendors",
    purpose:
      "Maintains the directory of statutory regulatory authorities (CAC, FIRS, SCUML), service contractors, and operational suppliers.",
    tables: ["public.vendors", "public.expenses"],
    relationships: ["expenses.vendor_id -> vendors.id"],
    supportedQueries: [
      "Active and inactive vendors count",
      "Vendors by category (statutory_authority, supplies, technology, logistics, professional_services)",
    ],
    supportedWorkflows: [
      "Add or edit vendor profile, contact details, and bank account details",
      "Toggle vendor active status",
    ],
    permissionModule: "finance",
    allowedViewRoles: ["super_admin", "admin", "operations_manager", "accounts_officer", "viewer"],
    allowedCreateEditRoles: ["super_admin", "admin", "accounts_officer"],
    approvalRules: "Requires finance.create / finance.edit permission.",
    knownLimitations: "Directory and cost-attribution registry; does not initiate automated bank transfers.",
    dataFreshness: "Live PostgreSQL query against public.vendors.",
  },

  referrals: {
    moduleId: "referrals",
    name: "Referrals, Partner Program & Spin & Earn Rewards",
    domain: "GROWTH",
    route: "/admin/referrals",
    purpose:
      "Tracks referral partners, referral codes, attributed lead conversions, milestone points, Spin & Earn promotional prizes, reward fulfillment, and manual referral linking.",
    tables: [
      "public.leads",
      "public.referral_events",
      "public.spin_rewards",
    ],
    relationships: [
      "referral_events.referee_lead_id -> leads.id",
      "spin_rewards.lead_id -> leads.id",
    ],
    supportedQueries: [
      "Active referrers, total referral conversions, and top partner leaderboard",
      "Rewards awaiting fulfillment vs fulfilled rewards (Spin & Earn and Referral prizes)",
      "Referred leads needing follow-up or conversion",
    ],
    supportedWorkflows: [
      "Inspect Referrers leaderboard and Conversions history",
      "Fulfill pending rewards in the Rewards tab (rpcAdminFulfillReward)",
      "Manually link an existing lead to a referrer code in the Manual Link tab (rpcAdminLinkReferral)",
    ],
    permissionModule: null,
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "client_service_officer",
      "marketing_officer",
    ],
    approvalRules: "Per SOP, cash or voucher referral rewards require verified client payment before fulfillment.",
    knownLimitations: "Combines authoritative RPCs (ablebiz_admin_get_referral_report, ablebiz_admin_get_rewards) with direct table fallback.",
    dataFreshness: "Live Supabase RPC and table query.",
  },

  reports: {
    moduleId: "reports",
    name: "Executive Reports & Analytics",
    domain: "REPORTING",
    route: "/admin/reports",
    purpose:
      "Provides period-filtered executive analytics across 5 tabs (Overview, Operations, Finance, Staff Workload, Growth) with CSV export and print support.",
    tables: [
      "public.clients",
      "public.businesses",
      "public.leads",
      "public.service_requests",
      "public.cac_applications",
      "public.tasks",
      "public.documents",
      "public.invoices",
      "public.payments",
      "public.expenses",
      "public.staff_profiles",
    ],
    relationships: ["Aggregates across CRM, Operations, Finance, and Staff tables"],
    supportedQueries: [
      "Executive performance summary for today, this week, this month, this quarter, this year, or all time",
      "Net operating margin (Total Collected Revenue minus Actual Recorded Expenses)",
    ],
    supportedWorkflows: [
      "Filter reports by date range (today, this_week, this_month, this_quarter, this_year, all)",
      "Export executive summary to CSV or Print PDF",
    ],
    permissionModule: "reports",
    allowedViewRoles: ["super_admin", "admin", "operations_manager", "accounts_officer"],
    allowedCreateEditRoles: ["super_admin", "admin", "accounts_officer"],
    approvalRules: "Requires reports.view permission; financial metrics within Reports also require finance.view.",
    knownLimitations: "Read-only analytical aggregation.",
    dataFreshness: "Live PostgreSQL aggregation on selected period.",
  },

  hr_workspace: {
    moduleId: "hr_workspace",
    name: "HR & Staff Portal (Leave, Attendance, Directory, Documents & Announcements)",
    domain: "TEAM",
    route: "/admin/hr",
    purpose:
      "Provides dual-mode Human Resources management (/admin/hr/* for Super Admin, Admin, Operations Manager) and self-service My Staff Portal (/admin/hr/portal for all 8 roles) covering employment profiles, attendance clock-in/corrections, leave requests/approvals, HR document vault, and company announcements.",
    tables: [
      "public.staff_profiles",
      "public.hr_policy_settings",
      "public.hr_staff_details",
      "public.hr_leave_policies",
      "public.hr_leave_requests",
      "public.hr_attendance_records",
      "public.hr_attendance_corrections",
      "public.hr_documents",
      "public.hr_announcements",
    ],
    relationships: [
      "hr_leave_requests.staff_id -> staff_profiles.id",
      "hr_leave_requests.reviewed_by -> staff_profiles.id",
      "hr_attendance_records.staff_id -> staff_profiles.id",
      "hr_attendance_corrections.staff_id -> staff_profiles.id",
      "hr_documents.staff_id -> staff_profiles.id",
      "hr_staff_details.staff_id -> staff_profiles.id",
    ],
    supportedQueries: [
      "Staff currently on leave or scheduled to be on leave in any date window (e.g., next 3 weeks / 21 days), distinguishing approved leave from pending/correction_requested requests",
      "Own or team attendance records and pending attendance correction requests",
      "HR announcements, leave policy categories, and HR document verification status",
      "Staff directory by department, role, and employment status",
    ],
    supportedWorkflows: [
      "Submit, cancel, or resubmit a Leave Request in My Staff Portal -> My Leave",
      "Review and Approve / Reject / Request Correction on team leave requests (HR Management -> Leave Management)",
      "Self clock-in / clock-out and submit attendance correction requests (My Attendance)",
      "Update own personal & emergency contact details (My Profile)",
      "Upload or access confidential HR documents and publish staff announcements",
    ],
    permissionModule: "hr",
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    approvalRules:
      "Enforces strict separation of duties: a requester cannot approve their own leave or attendance correction (unless sole active Super Admin). Operations Manager can only decide leave for operational officers; Admin cannot decide leave for Super Admin. Private residential/emergency details in hr_staff_details are visible only to the employee themselves, Admin, and Super Admin.",
    knownLimitations:
      "Requires implementation/MIGRATION_HR_WORKSPACE.sql for extended HR tables. Does not include automated payroll calculation, tax deduction remittance, or biometric hardware integration.",
    dataFreshness: "Live PostgreSQL query across HR tables and staff_profiles.",
  },

  staff_rbac: {
    moduleId: "staff_rbac",
    name: "Staff & RBAC Governance (Maker-Checker Approvals)",
    domain: "TEAM",
    route: "/admin/team",
    purpose:
      "Manages staff account provisioning, 8-tier role assignments, account activation/deprovisioning, and the Maker-Checker governance workflow (staff_change_requests) where Admin proposals require Super Admin approval.",
    tables: [
      "public.staff_profiles",
      "public.roles_permissions",
      "public.staff_change_requests",
      "public.audit_logs",
    ],
    relationships: [
      "staff_change_requests.requested_by -> staff_profiles.id",
      "staff_change_requests.target_staff_profile_id -> staff_profiles.id",
      "staff_change_requests.reviewed_by -> staff_profiles.id",
    ],
    supportedQueries: [
      "Active vs inactive staff count and breakdown by canonical role and department",
      "Pending, approved, executed, rejected, or failed staff_change_requests",
      "Role permission matrix across modules",
    ],
    supportedWorkflows: [
      "Super Admin: Directly provision staff (generates 14-char one-time password with must_change_password=true), change roles, deactivate/reactivate, or deprovision staff",
      "Admin: Submit Maker-Checker requests (create_staff, change_role, deactivate_staff, reactivate_staff, deprovision_staff) and track in My Requests tab",
      "Super Admin: Review and Approve or Reject pending Admin requests in Pending Approvals tab",
      "Reconcile unlinked Auth accounts via staff-provision Edge Function",
    ],
    permissionModule: "team",
    superOrAdminOnly: true,
    allowedViewRoles: ["super_admin", "admin"],
    allowedCreateEditRoles: ["super_admin", "admin"],
    approvalRules:
      "Only Super Admin can directly mutate staff roles/accounts or approve staff_change_requests. Database trigger check_last_super_admin_safeguard prevents deactivating or demoting the last active Super Admin.",
    knownLimitations: "Accessible only to Super Admin and System Administrator (/admin/team).",
    dataFreshness: "Live PostgreSQL query against staff_profiles and staff_change_requests.",
  },

  audit_logs: {
    moduleId: "audit_logs",
    name: "Governance & Security Audit Ledger",
    domain: "TEAM",
    route: "/admin/audit-logs",
    purpose:
      "Displays immutable security and governance audit logs (public.audit_logs) alongside the chronological operational activity timeline (public.activity_timeline).",
    tables: ["public.audit_logs", "public.activity_timeline"],
    relationships: ["audit_logs.staff_id -> staff_profiles.id"],
    supportedQueries: [
      "Recent security audit events (role changes, logins, staff provisioning, HR decisions)",
      "Recent operational activity timeline events by entity_type",
    ],
    supportedWorkflows: [
      "Toggle between Security Audit Logs and Operational Activity tabs",
      "Filter by entity type or search by action/staff email",
      "Inspect JSON old_values and new_values diff payload",
    ],
    permissionModule: null,
    superOrAdminOnly: true,
    allowedViewRoles: ["super_admin", "admin"],
    allowedCreateEditRoles: [],
    approvalRules: "Strictly read-only immutable ledger restricted to Super Admin and Admin.",
    knownLimitations: "Audit records cannot be edited or deleted by any user.",
    dataFreshness: "Live PostgreSQL query (latest 100 entries).",
  },

  settings: {
    moduleId: "settings",
    name: "Business Profile, Settlement Bank Accounts & System Settings",
    domain: "SETTINGS",
    route: "/admin/settings",
    purpose:
      "Configures the authoritative company identity (public.business_profile), up to 3 corporate bank settlement accounts (public.business_bank_accounts), document disclaimers, and referral/gamification parameters.",
    tables: [
      "public.business_profile",
      "public.business_bank_accounts",
      "public.public_business_profile",
    ],
    relationships: [
      "business_bank_accounts.business_profile_id -> business_profile.id",
    ],
    supportedQueries: [
      "Official business profile details (legal name, address, phone, WhatsApp, email, default payment terms)",
      "Active corporate bank settlement accounts (NUBAN, bank name, account name, default slot)",
    ],
    supportedWorkflows: [
      "Update Business Profile and Document Branding settings (Super Admin & Admin)",
      "Configure up to 3 corporate bank account slots (10-digit NUBAN validation) and designate default invoice settlement account",
    ],
    permissionModule: "settings",
    superOrAdminOnly: true,
    allowedViewRoles: ["super_admin", "admin"],
    allowedCreateEditRoles: ["super_admin", "admin"],
    approvalRules:
      "All active staff can read business_profile and business_bank_accounts for invoice/quotation document rendering, but only Super Admin and Admin can modify settings in /admin/settings.",
    knownLimitations: "Requires 10-digit Nigerian NUBAN format for active bank slots.",
    dataFreshness: "Live PostgreSQL query against business_profile and business_bank_accounts.",
  },

  account_security: {
    moduleId: "account_security",
    name: "Authentication, Session & Password Security",
    domain: "SETTINGS",
    route: "/admin/change-password",
    purpose:
      "Handles Supabase Auth sign-in (/admin/login), password recovery (/admin/reset-password), and mandatory first-login temporary password replacement (/admin/change-password).",
    tables: ["auth.users", "public.staff_profiles"],
    relationships: ["staff_profiles.auth_uid -> auth.users.id"],
    supportedQueries: [
      "How first-login password change and session verification work",
      "Troubleshooting login or 'must_change_password' redirect",
    ],
    supportedWorkflows: [
      "Complete first-login password change at /admin/change-password (clears must_change_password via clear_own_password_change_flag RPC)",
      "Request password reset email at /admin/reset-password",
    ],
    permissionModule: null,
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    approvalRules: "ProtectedRoute enforces must_change_password redirect before any other /admin/* route can be accessed.",
    knownLimitations: "Passwords must be at least 8 characters and cannot use predictable defaults like 'Welcome1' or 'password123'.",
    dataFreshness: "Real-time Supabase Auth session state.",
  },

  general: {
    moduleId: "general",
    name: "ABLEBIZ AI Secretary",
    domain: "AI",
    route: "/admin/ai-secretary",
    purpose:
      "Role-aware, read-only operational intelligence and interactive Suite Guide assistant grounded in live PostgreSQL records and verified Suite workflows.",
    tables: ["All authorized public.* operational tables"],
    relationships: ["Enforces caller's canonical role and RLS boundaries"],
    supportedQueries: [
      "Operational reports across all Suite modules",
      "Step-by-step user guidance and workflow explanations",
      "Permission explanations and error troubleshooting",
    ],
    supportedWorkflows: ["Interactive Q&A, contextual follow-ups, and deep-linking to authorized Suite pages"],
    permissionModule: null,
    allowedViewRoles: [
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "accounts_officer",
      "client_service_officer",
      "marketing_officer",
      "viewer",
    ],
    allowedCreateEditRoles: [],
    approvalRules: "Strictly read-only; never executes autonomous database mutations.",
    knownLimitations: "Cannot execute write operations on behalf of the user; provides exact instructions and direct links instead.",
    dataFreshness: "Live query per turn (Africa/Lagos).",
  },
} as Record<SuiteModuleId, CapabilityModuleSpec>;

export const CAPABILITY_CATALOGUE: Record<string, CapabilityModuleSpec> = Object.fromEntries(
  Object.entries(SUITE_CAPABILITY_INVENTORY)
    .filter(([k]) => k !== "general")
    .map(([k, v]) => [
      k,
      {
        ...v,
        id: v.moduleId,
        displayName: v.name,
        supportedOperations: v.supportedWorkflows,
        requiredPermissions: v.permissionModule ? [`${v.permissionModule}.view`] : [],
        allowedRolesSummary: v.allowedViewRoles.map((r) => getRoleTitle(r)).join(", "),
      },
    ])
);

function normalizeModuleId(moduleId: SuiteModuleId): SuiteModuleId {
  if (moduleId === "hr") return "hr_workspace";
  if (moduleId === "team") return "staff_rbac";
  if (moduleId === "change_password") return "account_security";
  return moduleId;
}

export function getModuleSpec(moduleId: SuiteModuleId): CapabilityModuleSpec & {
  id: SuiteModuleId;
  displayName: string;
  supportedOperations: string[];
  requiredPermissions: string[];
  allowedRolesSummary: string;
  knownLimitations: string[];
} {
  const canonicalId = normalizeModuleId(moduleId);
  const raw = SUITE_CAPABILITY_INVENTORY[canonicalId] || SUITE_CAPABILITY_INVENTORY.dashboard;
  return {
    ...raw,
    id: moduleId,
    displayName: raw.name,
    supportedOperations: raw.supportedWorkflows,
    requiredPermissions: raw.permissionModule ? [`${raw.permissionModule}.view`] : [],
    allowedRolesSummary: raw.allowedViewRoles.map((r) => getRoleTitle(r)).join(", "),
    knownLimitations: Array.isArray(raw.knownLimitations)
      ? raw.knownLimitations
      : [raw.knownLimitations],
  };
}

/**
 * Evaluates whether the caller is authorized to view/access a specific Suite module.
 */
export function canCallerAccessModule(
  caller: AssistantCallerContext,
  moduleId: SuiteModuleId,
  action: "view" | "create" | "edit" | "delete" | "approve" | "export" = "view"
): boolean {
  const role = caller.canonicalRole || caller.role;
  if (role === "super_admin") return true;

  const canonicalId = normalizeModuleId(moduleId);
  const spec = SUITE_CAPABILITY_INVENTORY[canonicalId];
  if (!spec) return false;

  if (spec.superOrAdminOnly) {
    if (role !== "admin") return false;
    if (action === "view") return spec.allowedViewRoles.includes(role);
    return spec.allowedCreateEditRoles.includes(role);
  }

  if (spec.permissionModule) {
    return caller.hasPermission(spec.permissionModule, action);
  }

  if (action === "view") {
    return spec.allowedViewRoles.includes(role);
  }
  return spec.allowedCreateEditRoles.includes(role);
}

/**
 * Evaluates whether the caller can navigate to a specific internal route path.
 */
export function canCallerAccessRoute(caller: AssistantCallerContext, path: string): boolean {
  const cleanPath = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/admin/dashboard";
  const role = caller.canonicalRole || caller.role;
  if (role === "super_admin") return true;

  if (
    cleanPath === "/admin" ||
    cleanPath === "/admin/dashboard" ||
    cleanPath === "/admin/workbench" ||
    cleanPath === "/admin/notifications" ||
    cleanPath === "/admin/ai-secretary" ||
    cleanPath === "/admin/referrals" ||
    cleanPath === "/admin/change-password"
  ) {
    return true;
  }

  if (cleanPath.startsWith("/admin/hr")) {
    if (cleanPath === "/admin/hr" || cleanPath === "/admin/hr/portal") {
      return caller.hasPermission("hr", "view") || true;
    }
    return canAccessHrManagementWorkspace(role);
  }

  if (cleanPath === "/admin/team" || cleanPath === "/admin/audit-logs" || cleanPath === "/admin/audit") {
    return role === "admin";
  }

  if (cleanPath === "/admin/settings") {
    return role === "admin" || caller.hasPermission("settings", "view");
  }

  if (cleanPath === "/admin/reports") {
    return caller.hasPermission("reports", "view");
  }

  if (
    cleanPath === "/admin/leads" ||
    cleanPath === "/admin/clients" ||
    cleanPath === "/admin/businesses" ||
    cleanPath === "/admin/follow-ups" ||
    cleanPath === "/admin/communications"
  ) {
    return caller.hasPermission("crm", "view");
  }

  if (
    cleanPath === "/admin/services-catalog" ||
    cleanPath === "/admin/service-requests" ||
    cleanPath === "/admin/cac-operations" ||
    cleanPath === "/admin/cac" ||
    cleanPath === "/admin/tasks" ||
    cleanPath === "/admin/documents"
  ) {
    return caller.hasPermission("operations", "view");
  }

  if (
    cleanPath === "/admin/quotations" ||
    cleanPath === "/admin/invoices" ||
    cleanPath === "/admin/payments" ||
    cleanPath === "/admin/expenses" ||
    cleanPath === "/admin/vendors"
  ) {
    return caller.hasPermission("finance", "view");
  }

  return false;
}

/**
 * Annotates and filters Suite links so unauthorized links are clearly marked or excluded.
 * Accepts either SuiteLinkItem[] or SuiteModuleId[].
 */
export function resolveAuthorizedLinks(
  caller: AssistantCallerContext,
  linksOrModules: Array<SuiteLinkItem | SuiteModuleId>
): SuiteLinkItem[] {
  const items: SuiteLinkItem[] = linksOrModules.map((entry) => {
    if (typeof entry === "string") {
      const spec = getModuleSpec(entry);
      return {
        label: spec.displayName,
        path: spec.route,
        route: spec.route,
        moduleId: entry,
      };
    }
    return {
      ...entry,
      path: entry.path || entry.route,
      route: entry.route || entry.path,
    };
  });

  const seen = new Set<string>();
  return items
    .map((link) => ({
      ...link,
      authorized: canCallerAccessRoute(caller, link.path),
    }))
    .filter((link) => {
      if (!link.authorized || seen.has(link.path)) return false;
      seen.add(link.path);
      return true;
    });
}

function buildRolePermissionsList(role: CanonicalStaffRole): string[] {
  switch (role) {
    case "super_admin":
    case "admin":
      return [
        "workbench.view",
        "crm.view",
        "crm.create",
        "crm.edit",
        "operations.view",
        "operations.create",
        "operations.edit",
        "finance.view",
        "finance.create",
        "finance.edit",
        "reports.view",
        "hr.view",
        "hr.manage",
        "team.view",
        "audit_logs.view",
        "settings.view",
      ];
    case "operations_manager":
      return [
        "workbench.view",
        "crm.view",
        "crm.create",
        "crm.edit",
        "operations.view",
        "operations.create",
        "operations.edit",
        "reports.view",
        "hr.view",
        "hr.manage",
      ];
    case "registration_officer":
      return [
        "workbench.view",
        "crm.view",
        "operations.view",
        "operations.create",
        "operations.edit",
        "hr.view",
      ];
    case "accounts_officer":
      return [
        "workbench.view",
        "crm.view",
        "operations.view",
        "finance.view",
        "finance.create",
        "finance.edit",
        "reports.view",
        "hr.view",
      ];
    case "client_service_officer":
      return [
        "workbench.view",
        "crm.view",
        "crm.create",
        "crm.edit",
        "operations.view",
        "operations.create",
        "hr.view",
      ];
    case "marketing_officer":
      return ["workbench.view", "crm.view", "crm.create", "crm.edit", "reports.view", "hr.view"];
    case "viewer":
    default:
      return ["workbench.view", "crm.view", "operations.view", "reports.view", "hr.view"];
  }
}

const FRIENDLY_SOURCE_LABELS: Record<string, string> = {
  clients: "Client Directory",
  businesses: "Registered Business Records",
  leads: "CRM Leads Pipeline",
  follow_ups: "Client Follow-up Schedule",
  client_communications: "Client Communication Logs",
  services_catalog: "Services Catalogue",
  service_requests: "Service Requests",
  cac_applications: "CAC Filing Records",
  tasks: "Operational Tasks & Deadlines",
  documents: "Document Vault",
  quotations: "Quotations",
  invoices: "Invoices Ledger",
  payments: "Payment Receipts",
  expenses: "Operating Expenses",
  vendors: "Vendor Directory",
  referrals: "Referral Records",
  spin_rewards: "Spin & Earn Rewards",
  reports: "Executive Reports",
  hr_leave_requests: "Staff Leave Records",
  hr_attendance_logs: "Attendance Records",
  hr_documents: "HR Documents",
  hr_announcements: "Staff Announcements",
  staff_profiles: "Staff Directory",
  staff_change_requests: "Staff Approval Requests",
  roles_permissions: "Role Permission Rules",
  audit_logs: "Security Audit Trail",
  activity_timeline: "Activity Timeline",
  business_profile: "Company Profile Settings",
  business_bank_accounts: "Settlement Bank Accounts",
  notifications: "Staff Notifications",
};

/**
 * Converts internal table names into business-friendly source labels for user-facing display.
 */
export function formatFriendlySourceNames(tables: string[]): string {
  if (!tables || tables.length === 0) return "Verified Suite Guidance";
  const labels = Array.from(
    new Set(
      tables.map((t) => {
        const clean = t.replace(/^public\./, "").trim();
        return FRIENDLY_SOURCE_LABELS[clean] || clean.replace(/_/g, " ");
      })
    )
  );
  return labels.join(" • ");
}

function sanitizeDisplayName(candidate: string | null | undefined, email?: string | null): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  // Never use an email address or the raw local-part of the user's email (e.g. oyewusi.adebayo1) as a person's display name
  if (trimmed.includes("@")) return null;
  if (email) {
    const emailPrefix = email.split("@")[0]?.trim().toLowerCase();
    if (emailPrefix && trimmed.toLowerCase() === emailPrefix) {
      return null;
    }
  }
  if (/^[a-z0-9._-]+$/i.test(trimmed) && /[._\d]/.test(trimmed) && !trimmed.includes(" ")) {
    return null;
  }
  return trimmed;
}

/**
 * Helper to build an AssistantCallerContext from AuthContext values (profile, hasPermission, user)
 * or a caller descriptor object.
 * Never trusts job_title for authorization and never falls back to an email prefix for greetings.
 */
export function buildCallerContext(
  profileOrParams:
    | AssistantCallerContext["profile"]
    | {
        role?: string | null;
        userId?: string | null;
        userName?: string | null;
        email?: string | null;
        jobTitle?: string | null;
        department?: string | null;
        profile?: AssistantCallerContext["profile"];
        user?: {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          department?: string;
        } | null;
      }
    | null,
  hasPermissionFn?: AssistantCallerContext["hasPermission"],
  suiteUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    department?: string;
  } | null
): AssistantCallerContext {
  const isDescriptor =
    profileOrParams !== null &&
    typeof profileOrParams === "object" &&
    ("userId" in profileOrParams ||
      "userName" in profileOrParams ||
      "jobTitle" in profileOrParams ||
      "user" in profileOrParams ||
      !("is_active" in profileOrParams));

  const resolvedProfile: AssistantCallerContext["profile"] = isDescriptor
    ? (profileOrParams as any)?.profile || null
    : (profileOrParams as any) || null;

  const resolvedSuiteUser = isDescriptor
    ? (profileOrParams as any)?.user || suiteUser || null
    : suiteUser || null;

  const rawProfileRole = resolvedProfile?.role ? String(resolvedProfile.role).trim() : "";
  const rawUserRole = resolvedSuiteUser?.role ? String(resolvedSuiteUser.role).trim() : "";
  const rawDescriptorRole =
    isDescriptor && (profileOrParams as any)?.role
      ? String((profileOrParams as any).role).trim()
      : "";

  // Check if identity & role sources are present and consistent
  const hasAnyRoleSource = Boolean(rawProfileRole || rawUserRole || rawDescriptorRole);
  let identityVerified = hasAnyRoleSource;
  let identityWarning: string | undefined;

  if (resolvedProfile && resolvedProfile.is_active === false) {
    identityVerified = false;
    identityWarning =
      "Your staff profile is currently marked inactive. Access is restricted until an administrator activates your profile.";
  } else if (
    rawProfileRole &&
    rawUserRole &&
    normalizeStaffRole(rawProfileRole) !== normalizeStaffRole(rawUserRole)
  ) {
    identityVerified = false;
    identityWarning =
      "Your session role and staff profile role did not match. Enforcing your verified staff profile role.";
  } else if (!hasAnyRoleSource) {
    identityVerified = false;
    identityWarning =
      "Your staff role could not be verified for this session. Showing read-only guidance until your profile finishes loading.";
  }

  // Authoritative role resolution: staff_profiles.role -> suiteUser.role -> descriptor.role (never job_title!)
  const authoritativeRawRole = rawProfileRole || rawUserRole || rawDescriptorRole;
  const canonicalRole: CanonicalStaffRole = hasAnyRoleSource
    ? normalizeStaffRole(authoritativeRawRole)
    : "viewer";

  const roleTitle = hasAnyRoleSource
    ? getRoleTitle(canonicalRole)
    : "Unverified Staff Identity";

  // Separate job title from authorization role
  const rawJobTitle =
    resolvedProfile?.job_title ||
    (isDescriptor ? (profileOrParams as any)?.jobTitle : null) ||
    null;
  const jobTitle = rawJobTitle && String(rawJobTitle).trim() ? String(rawJobTitle).trim() : null;

  const department =
    resolvedProfile?.department ||
    resolvedSuiteUser?.department ||
    (isDescriptor ? (profileOrParams as any)?.department : null) ||
    null;

  const email =
    resolvedProfile?.email ||
    resolvedSuiteUser?.email ||
    (isDescriptor ? (profileOrParams as any)?.email : null) ||
    null;

  const userId =
    resolvedProfile?.id ||
    resolvedSuiteUser?.id ||
    (isDescriptor ? (profileOrParams as any)?.userId : null) ||
    null;

  // Resolve clean human display name (never a raw email handle like oyewusi.adebayo1)
  const userName =
    sanitizeDisplayName(resolvedProfile?.full_name, email) ||
    sanitizeDisplayName(resolvedSuiteUser?.name, email) ||
    sanitizeDisplayName(isDescriptor ? (profileOrParams as any)?.userName : null, email) ||
    "Staff Member";

  const permissions = hasAnyRoleSource
    ? buildRolePermissionsList(canonicalRole)
    : ["workbench.view"];

  const isManagement =
    hasAnyRoleSource &&
    (canonicalRole === "super_admin" ||
      canonicalRole === "admin" ||
      canonicalRole === "operations_manager");

  const canManageHr = hasAnyRoleSource && canAccessHrManagementWorkspace(canonicalRole);
  const hrAccess = {
    canViewDirectory: hasAnyRoleSource,
    canManageStaffRecords: canManageHr,
    canSubmitOwnLeave: hasAnyRoleSource,
    canViewAllLeave: canManageHr,
    canApproveLeave: canManageHr,
    canLogOwnAttendance: hasAnyRoleSource,
    canViewAllAttendance: canManageHr,
    canManageShiftSettings: canManageHr,
    canViewHrDocuments: hasAnyRoleSource,
    canManageHrDocuments: canManageHr,
    canPostAnnouncements: canManageHr,
  };

  const defaultHasPermission: AssistantCallerContext["hasPermission"] = (
    module: string,
    action: string = "view"
  ) => {
    if (!hasAnyRoleSource) return false;
    if (canonicalRole === "super_admin" || canonicalRole === "admin") return true;
    const key = `${module}.${action}`;
    if (permissions.includes(key)) return true;
    if (action === "view" && permissions.some((p) => p.startsWith(`${module}.`))) {
      return true;
    }
    return false;
  };

  const effectiveHasPermission: AssistantCallerContext["hasPermission"] = (
    module: string,
    action: any = "view"
  ) => {
    if (!hasAnyRoleSource) return false;
    if (hasPermissionFn) {
      return hasPermissionFn(module, action);
    }
    return defaultHasPermission(module, action);
  };

  return {
    profile: resolvedProfile,
    canonicalRole,
    role: canonicalRole,
    roleTitle,
    roleLabel: roleTitle,
    jobTitle,
    department,
    userId,
    userName,
    email,
    identityVerified,
    identityWarning,
    permissions,
    isManagement,
    hrAccess,
    hasPermission: effectiveHasPermission,
  };
}


