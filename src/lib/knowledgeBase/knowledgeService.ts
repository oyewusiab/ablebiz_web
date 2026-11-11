import { supabase } from "../supabaseClient";
import type { CanonicalStaffRole } from "../../auth/roleConfig";
import type {
  KnowledgeArticle,
  KnowledgeArticleInput,
  KnowledgeArticleVersion,
  KnowledgeCategory,
  KnowledgeFilterState,
} from "../../types/knowledgeBase";

/**
 * Standard illustrative initial SOPs and guides for ABLEBIZ.
 * Used as reliable fallback if DB is still synchronizing.
 */
export const ILLUSTRATIVE_SOP_GUIDES: KnowledgeArticle[] = [
  {
    id: "sop-001-company-reg",
    article_code: "SOP-001",
    title: "Standard Company Registration Procedure (Part A — Private Limited)",
    slug: "sop-001-company-registration-private-limited",
    category_id: "cat-comp-reg",
    summary:
      "Step-by-step statutory procedure for registering a private limited liability company with the Corporate Affairs Commission (CAC).",
    content: `### 1. Objective & Scope
This Standard Operating Procedure (SOP) governs the preparation, client document vetting, CAC CRP portal submission, and certificate retrieval for Private Limited Liability Companies (Ltd).

### 2. Required Client Information & Documents
Before initiating filing on the CAC portal, the Compliance & Registration Officer must verify:
- **Two Proposed Company Names** (in order of client preference).
- **Principal Business Activity & Objects** (drafted in standard legal clause format).
- **Registered Office Address** in Nigeria (P.O. Box alone is unacceptable).
- **Director Details**: Minimum of one adult director. Full legal name, date of birth, residential address, valid National Identification Number (NIN), phone number, email address, and signature specimen.
- **Share Capital Structure**: Minimum issued share capital of 100,000 shares (or as required by regulated industry thresholds).
- **Shareholders / Persons with Significant Control (PSC)**: Identification and percentage split.

### 3. Step-by-Step Execution Workflow
1. **Name Reservation**: Submit name reservation via CAC CRP. Turnaround SLA: 24 to 48 hours.
2. **Document Vetting**: Review the Approved Name Availability Notice. Cross-check client NIN on the NIMC verification gateway.
3. **Application Drafting**: Complete Form CAC 1.1 (Memorandum & Articles of Association, Statement of Issued Share Capital, and Particulars of Directors/Secretary).
4. **Stamp Duty Assessment & Payment**: Pay FIRS stamp duty via Remita portal and CAC statutory filing fee.
5. **Final Submission**: Upload scanned signature pages, government-issued IDs, and passport photographs.
6. **Query Resolution**: If CAC issues a query, address the registrar's requirement within 24 working hours.
7. **Certificate Retrieval & Handover**: Download the electronic Certificate of Incorporation (bearing RC Number and Tax Identification Number), Status Report, and certified MEMART. Deposit in Client 360° Documents.

### 4. Quality Standards & Turnaround Time
- Standard processing SLA: 3 to 7 working days from name approval.
- All documents must be legibly scanned at 300 DPI in PDF format.`,
    tags: ["CAC", "Company Registration", "SOP", "Incorporation", "Legal"],
    status: "published",
    author_id: "staff-lead-legal",
    reviewer_id: "staff-ops-mgr",
    target_roles: [],
    department: "Legal & Compliance",
    is_sop: true,
    is_pinned: true,
    view_count: 142,
    current_version: 1,
    approved_at: "2026-10-01T10:00:00Z",
    published_at: "2026-10-01T12:00:00Z",
    created_at: "2026-10-01T08:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    category: {
      id: "cat-comp-reg",
      name: "Company Registration & Business Formation",
      slug: "company-registration",
      icon: "Building2",
      display_order: 1,
      is_active: true,
    },
    author: {
      id: "staff-lead-legal",
      full_name: "Compliance Team Lead",
      email: "compliance@ablebizservices.com",
      role: "registration_officer",
    },
    reviewer: {
      id: "staff-ops-mgr",
      full_name: "Operations Manager",
      email: "operations@ablebizservices.com",
      role: "operations_manager",
    },
  },
  {
    id: "sop-002-ngo-reg",
    article_code: "SOP-002",
    title: "Incorporated Trustees (NGO/Church/Foundation) Registration Protocol",
    slug: "sop-002-incorporated-trustees-ngo-registration",
    category_id: "cat-ngo-reg",
    summary:
      "Statutory protocol for non-governmental organizations, foundations, and religious bodies under Part F of CAMA 2020.",
    content: `### 1. Statutory Context
Registration of Incorporated Trustees is governed by Part F of the Companies and Allied Matters Act (CAMA) 2020. Strict newspaper publication and constitution vetting rules apply.

### 2. Mandatory Documentation
- Two proposed organizational names (e.g., "... Foundation" or "... Initiative").
- Aims and Objectives clearly highlighting non-profit, educational, philanthropic, or community purpose.
- Minimum of two Trustees with valid government IDs, NIN, passport photographs, and signed oaths.
- Draft Constitution incorporating the mandatory CAC Dissolution Clause (assets transferred to institutions of similar purpose).
- Impression of the Common Seal of the proposed association.

### 3. Newspaper Advertisement Requirement
- Under CAMA statutory rules, notice of application must be published in **two daily national newspapers** (one widely circulating in the locality of the organization).
- Allow 28 statutory waiting days from the date of the latest publication for public objections before final submission.

### 4. Submission & Follow-up
- Upload newspaper cutting clippings, sworn trustee affidavit of compliance, application form, and vetted constitution.
- Monitor filing status every 48 hours in CAC Operations (/admin/cac-operations).`,
    tags: ["NGO", "Incorporated Trustees", "CAMA 2020", "CAC", "SOP"],
    status: "published",
    author_id: "staff-lead-legal",
    reviewer_id: "staff-ops-mgr",
    target_roles: [],
    department: "Legal & Compliance",
    is_sop: true,
    is_pinned: true,
    view_count: 98,
    current_version: 1,
    approved_at: "2026-10-02T11:00:00Z",
    published_at: "2026-10-02T14:00:00Z",
    created_at: "2026-10-02T09:00:00Z",
    updated_at: "2026-10-02T14:00:00Z",
    category: {
      id: "cat-ngo-reg",
      name: "NGO & Incorporated Trustees",
      slug: "ngo-incorporated-trustees",
      icon: "FileText",
      display_order: 2,
      is_active: true,
    },
    author: {
      id: "staff-lead-legal",
      full_name: "Compliance Team Lead",
      email: "compliance@ablebizservices.com",
      role: "registration_officer",
    },
    reviewer: {
      id: "staff-ops-mgr",
      full_name: "Operations Manager",
      email: "operations@ablebizservices.com",
      role: "operations_manager",
    },
  },
  {
    id: "sop-003-client-complaints",
    article_code: "SOP-003",
    title: "Client Complaints Resolution & Escalation Protocol",
    slug: "sop-003-client-complaints-resolution-protocol",
    category_id: "cat-client-care",
    summary:
      "Operational guidelines for logging, investigating, and resolving client grievances within agreed SLA targets.",
    content: `### 1. Purpose & Standards
ABLEBIZ is committed to delivering professional client service. Every grievance must be logged immediately upon receipt and resolved in accordance with our Service Quality SLA standards.

### 2. Complaint Intake & Logging
- Inbound complaints from WhatsApp, phone call, email, or in-person visits must be recorded in Service Quality (/admin/service-quality).
- Assign a priority rating:
  - **Critical / Urgent**: Potential legal exposure, severe CAC deadline breach, or payment dispute. Acknowledgment SLA: 1 hour. Resolution target: 24 hours.
  - **High**: Filing delay or missing documentation. Acknowledgment SLA: 2 hours. Resolution target: 48 hours.
  - **Normal**: Routine inquiry or general dissatisfaction. Acknowledgment SLA: 4 hours. Resolution target: 72 hours.

### 3. Investigation & Communication
1. Send an official acknowledgment message using the approved template from Client Communications (/admin/communications).
2. Contact the assigned registration officer or accountant to establish root cause.
3. Update the client at each stage. Do not make false commitments or fabricate government portal turnaround claims.
4. Record all customer interactions and internal notes in the Complaint Activity Log.

### 4. Closure & Quality Review
A complaint is only closed when the client expresses satisfaction or an authorized remediation (e.g., fee waiver or expedited service) is completed. Management conducts weekly quality reviews to eliminate recurring root causes.`,
    tags: ["Client Service", "Complaints", "SOP", "Service Quality", "Escalation"],
    status: "published",
    author_id: "staff-client-service",
    reviewer_id: "staff-ops-mgr",
    target_roles: [],
    department: "Client Relations",
    is_sop: true,
    is_pinned: false,
    view_count: 85,
    current_version: 1,
    approved_at: "2026-10-05T10:00:00Z",
    published_at: "2026-10-05T11:00:00Z",
    created_at: "2026-10-05T09:00:00Z",
    updated_at: "2026-10-05T11:00:00Z",
    category: {
      id: "cat-client-care",
      name: "Client Care & Communication Standards",
      slug: "client-care",
      icon: "MessageSquare",
      display_order: 6,
      is_active: true,
    },
    author: {
      id: "staff-client-service",
      full_name: "Client Relations Officer",
      email: "support@ablebizservices.com",
      role: "client_service_officer",
    },
    reviewer: {
      id: "staff-ops-mgr",
      full_name: "Operations Manager",
      email: "operations@ablebizservices.com",
      role: "operations_manager",
    },
  },
  {
    id: "sop-004-quotations-invoicing",
    article_code: "SOP-004",
    title: "Client Quotation & Invoicing Procedures",
    slug: "sop-004-quotations-and-invoicing-procedure",
    category_id: "cat-finance",
    summary:
      "Standard accounting workflow for issuing professional fee quotations, generating invoices, and verifying bank payments.",
    content: `### 1. Scope
Applies to all quotations, pro-forma invoices, and tax invoices prepared for corporate registration, tax consulting, and compliance services.

### 2. Quotation Preparation
- Select the applicable service item from the Services Catalogue (/admin/services-catalog) to inherit official pricing.
- Clearly separate **Statutory Government Fees** (e.g., CAC filing fees, FIRS stamp duty) from **ABLEBIZ Professional Service Fees**.
- Standard quotation validity is **30 calendar days**.
- If a client requests a price discount exceeding 10%, an Approval Request must be submitted to Management under Commercial Approvals (/admin/approvals).

### 3. Invoicing & Payment Verification
- Convert the approved quotation into an Invoice in Invoices (/admin/invoices).
- Provide our verified corporate bank accounts as designated on the official invoice template.
- Payments must be verified against bank transfer credit alerts or official teller receipts before marking an invoice as Paid.
- Never commence statutory payments to CAC before verified receipt of client funds unless explicit management authorization exists.`,
    tags: ["Finance", "Quotations", "Invoicing", "Accounts", "SOP"],
    status: "published",
    author_id: "staff-accountant",
    reviewer_id: "staff-super-admin",
    target_roles: ["super_admin", "admin", "accounts_officer", "operations_manager"],
    department: "Finance & Accounts",
    is_sop: true,
    is_pinned: false,
    view_count: 110,
    current_version: 1,
    approved_at: "2026-10-06T15:00:00Z",
    published_at: "2026-10-06T16:00:00Z",
    created_at: "2026-10-06T12:00:00Z",
    updated_at: "2026-10-06T16:00:00Z",
    category: {
      id: "cat-finance",
      name: "Accounting & Financial Procedures",
      slug: "finance-accounting",
      icon: "DollarSign",
      display_order: 5,
      is_active: true,
    },
    author: {
      id: "staff-accountant",
      full_name: "Senior Accounts Officer",
      email: "finance@ablebizservices.com",
      role: "accounts_officer",
    },
    reviewer: {
      id: "staff-super-admin",
      full_name: "Managing Director",
      email: "md@ablebizservices.com",
      role: "super_admin",
    },
  },
  {
    id: "sop-005-refunds-adjustments",
    article_code: "SOP-005",
    title: "Client Refund & Invoice Adjustment Policy",
    slug: "sop-005-client-refund-and-invoice-adjustment-policy",
    category_id: "cat-finance",
    summary:
      "Governance rules and multi-stage approval workflow required for client refunds and billing adjustments.",
    content: `### 1. Policy Overview
ABLEBIZ maintains strict accountability over client funds. Because statutory filing fees paid to government bodies (CAC, FIRS, SCUML) are non-refundable by those agencies once remitted, refunds are governed by strict eligibility rules.

### 2. Refund Eligibility Criteria
- **Pre-Filing Cancellation**: If a client cancels before statutory name reservation or filing submission, professional service fees may be refunded less a 10% administrative processing charge.
- **Unfiled Statutory Fees**: Government fees not yet remitted to Remita or CAC are refundable in full.
- **Service Defects**: Where ABLEBIZ failed to meet statutory commitments due to internal error, management may approve full or partial refund.

### 3. Multi-Stage Approval Workflow
1. The Accounts Officer logs a Refund Approval Request in Approvals (/admin/approvals) referencing the Payment Record ID, client name, and reason.
2. Stage 1: Operations Manager reviews service progress and confirms no pending statutory debits.
3. Stage 2: Super Admin / Managing Director provides final financial disbursement sign-off.
4. Requester CANNOT approve their own refund request (enforced via Maker-Checker controls).
5. Once approved, the refund is executed through bank transfer and the receipt is uploaded to the approval record.`,
    tags: ["Refund", "Invoice Adjustment", "Finance", "SOP", "Approvals"],
    status: "published",
    author_id: "staff-accountant",
    reviewer_id: "staff-super-admin",
    target_roles: ["super_admin", "admin", "accounts_officer", "operations_manager"],
    department: "Finance & Accounts",
    is_sop: true,
    is_pinned: false,
    view_count: 67,
    current_version: 1,
    approved_at: "2026-10-07T11:00:00Z",
    published_at: "2026-10-07T12:00:00Z",
    created_at: "2026-10-07T10:00:00Z",
    updated_at: "2026-10-07T12:00:00Z",
    category: {
      id: "cat-finance",
      name: "Accounting & Financial Procedures",
      slug: "finance-accounting",
      icon: "DollarSign",
      display_order: 5,
      is_active: true,
    },
    author: {
      id: "staff-accountant",
      full_name: "Senior Accounts Officer",
      email: "finance@ablebizservices.com",
      role: "accounts_officer",
    },
    reviewer: {
      id: "staff-super-admin",
      full_name: "Managing Director",
      email: "md@ablebizservices.com",
      role: "super_admin",
    },
  },
];

export const INITIAL_KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  {
    id: "cat-comp-reg",
    name: "Company Registration & Business Formation",
    slug: "company-registration",
    description: "SOPs, checklists, and statutory guidelines for Limited Liability Companies and Business Names.",
    icon: "Building2",
    display_order: 1,
    is_active: true,
  },
  {
    id: "cat-ngo-reg",
    name: "NGO & Incorporated Trustees",
    slug: "ngo-incorporated-trustees",
    description: "Procedures, newspaper publication guidelines, constitution vetting, and CAC requirements for NGOs.",
    icon: "FileText",
    display_order: 2,
    is_active: true,
  },
  {
    id: "cat-cac-post",
    name: "CAC Post-Incorporation & Compliance",
    slug: "cac-post-incorporation",
    description: "Annual returns, change of directors/objects, share capital increases, and statutory compliance.",
    icon: "FileCheck2",
    display_order: 3,
    is_active: true,
  },
  {
    id: "cat-tax",
    name: "Taxation, TIN & SCUML",
    slug: "taxation-tin-scuml",
    description: "FIRS Tax Identification Number, SCUML anti-money laundering certifications, and VAT registration.",
    icon: "ShieldCheck",
    display_order: 4,
    is_active: true,
  },
  {
    id: "cat-finance",
    name: "Accounting & Financial Procedures",
    slug: "finance-accounting",
    description: "Internal expense submission, client quotation standards, invoicing, and refund policies.",
    icon: "DollarSign",
    display_order: 5,
    is_active: true,
  },
  {
    id: "cat-client-care",
    name: "Client Care & Communication Standards",
    slug: "client-care",
    description: "Official messaging templates, WhatsApp/phone guidelines, consultations, and complaint escalation.",
    icon: "MessageSquare",
    display_order: 6,
    is_active: true,
  },
  {
    id: "cat-staff",
    name: "Staff Onboarding & Office Policies",
    slug: "staff-onboarding",
    description: "Working hours, leave policies, document retention, confidentiality, and professional code of conduct.",
    icon: "Users",
    display_order: 7,
    is_active: true,
  },
  {
    id: "cat-sop",
    name: "Standard Operating Procedures (SOPs)",
    slug: "standard-operating-procedures",
    description: "Master standard operating procedures across all ABLEBIZ operational workflows.",
    icon: "Briefcase",
    display_order: 8,
    is_active: true,
  },
];

/**
 * Checks if a given staff role can view a specific article based on its target_roles.
 */
export function canRoleAccessArticle(
  article: KnowledgeArticle,
  userRole?: CanonicalStaffRole | null,
  userId?: string | null
): boolean {
  if (!userRole) return false;

  // Super admin and admin can access everything
  if (userRole === "super_admin" || userRole === "admin") return true;

  // Authors can always access their own articles
  if (userId && article.author_id === userId) return true;

  // Operations managers can access all operational SOPs
  if (userRole === "operations_manager" && article.is_sop) return true;

  // If article is not published, ordinary staff cannot view it
  if (article.status !== "published") return false;

  // If no target roles specified, available to all active staff
  if (!article.target_roles || article.target_roles.length === 0) return true;

  // Otherwise check if role is explicitly listed
  return article.target_roles.includes(userRole);
}

/**
 * Checks if a staff member can edit an article.
 */
export function canEditArticle(
  article: KnowledgeArticle,
  userRole?: CanonicalStaffRole | null,
  userId?: string | null
): boolean {
  if (!userRole) return false;
  if (userRole === "super_admin" || userRole === "admin") return true;
  if (userRole === "operations_manager" && article.is_sop) return true;

  // Authors can edit their own draft or returned_for_revision articles
  if (userId && article.author_id === userId) {
    return article.status === "draft" || article.status === "returned_for_revision";
  }

  return false;
}

/**
 * Checks if a staff member can approve or publish an article.
 */
export function canApproveArticle(
  userRole?: CanonicalStaffRole | null,
  isSop?: boolean
): boolean {
  if (!userRole) return false;
  if (userRole === "super_admin" || userRole === "admin") return true;
  if (userRole === "operations_manager" && isSop) return true;
  return false;
}

/**
 * Fetches all knowledge categories from Supabase (or fallback).
 */
export async function fetchKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  if (!supabase) return INITIAL_KNOWLEDGE_CATEGORIES;

  try {
    const { data, error } = await supabase
      .from("knowledge_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return INITIAL_KNOWLEDGE_CATEGORIES;
    }

    return data as KnowledgeCategory[];
  } catch {
    return INITIAL_KNOWLEDGE_CATEGORIES;
  }
}

/**
 * Fetches knowledge articles filtered by user role and filter state.
 */
export async function fetchKnowledgeArticles(
  userRole?: CanonicalStaffRole | null,
  userId?: string | null,
  filters?: Partial<KnowledgeFilterState>
): Promise<KnowledgeArticle[]> {
  let articles: KnowledgeArticle[] = [];

  if (supabase) {
    try {
      let query = supabase
        .from("knowledge_articles")
        .select(`
          *,
          category:knowledge_categories(*),
          author:staff_profiles!author_id(id, full_name, email, role),
          reviewer:staff_profiles!reviewer_id(id, full_name, email, role)
        `)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        articles = data as KnowledgeArticle[];
      } else {
        articles = ILLUSTRATIVE_SOP_GUIDES;
      }
    } catch {
      articles = ILLUSTRATIVE_SOP_GUIDES;
    }
  } else {
    articles = ILLUSTRATIVE_SOP_GUIDES;
  }

  // Filter based on role access
  let accessible = articles.filter((art) => canRoleAccessArticle(art, userRole, userId));

  // Apply filters if provided
  if (filters?.searchTerm && filters.searchTerm.trim()) {
    const term = filters.searchTerm.toLowerCase().trim();
    accessible = accessible.filter(
      (a) =>
        a.title.toLowerCase().includes(term) ||
        (a.summary && a.summary.toLowerCase().includes(term)) ||
        a.content.toLowerCase().includes(term) ||
        a.article_code.toLowerCase().includes(term) ||
        a.tags.some((t) => t.toLowerCase().includes(term))
    );
  }

  if (filters?.categorySlug && filters.categorySlug !== "all") {
    accessible = accessible.filter((a) => a.category?.slug === filters.categorySlug);
  }

  if (filters?.status && filters.status !== "all") {
    accessible = accessible.filter((a) => a.status === filters.status);
  }

  if (filters?.tag && filters.tag !== "all") {
    accessible = accessible.filter((a) => a.tags.includes(filters.tag!));
  }

  if (filters?.sopOnly) {
    accessible = accessible.filter((a) => a.is_sop);
  }

  return accessible;
}

/**
 * Fetches single article with complete version history.
 */
export async function fetchArticleWithHistory(
  articleId: string
): Promise<{ article: KnowledgeArticle | null; versions: KnowledgeArticleVersion[] }> {
  if (!supabase) {
    const found = ILLUSTRATIVE_SOP_GUIDES.find((a) => a.id === articleId || a.slug === articleId);
    return {
      article: found || null,
      versions: found
        ? [
            {
              id: `v1-${found.id}`,
              article_id: found.id,
              version_number: 1,
              title: found.title,
              summary: found.summary,
              content: found.content,
              tags: found.tags,
              change_summary: "Initial document release and approved baseline.",
              created_by: found.author_id,
              review_status: "published",
              created_at: found.created_at,
            },
          ]
        : [],
    };
  }

  try {
    const { data: articleData, error: artErr } = await supabase
      .from("knowledge_articles")
      .select(`
        *,
        category:knowledge_categories(*),
        author:staff_profiles!author_id(id, full_name, email, role),
        reviewer:staff_profiles!reviewer_id(id, full_name, email, role)
      `)
      .eq("id", articleId)
      .single();

    if (artErr || !articleData) {
      const found = ILLUSTRATIVE_SOP_GUIDES.find((a) => a.id === articleId || a.slug === articleId);
      return { article: found || null, versions: [] };
    }

    const { data: versionData } = await supabase
      .from("knowledge_article_versions")
      .select(`
        *,
        author:staff_profiles!created_by(id, full_name, email, role),
        reviewer:staff_profiles!reviewed_by(id, full_name, email, role)
      `)
      .eq("article_id", articleId)
      .order("version_number", { ascending: false });

    return {
      article: articleData as KnowledgeArticle,
      versions: (versionData || []) as KnowledgeArticleVersion[],
    };
  } catch {
    const found = ILLUSTRATIVE_SOP_GUIDES.find((a) => a.id === articleId);
    return { article: found || null, versions: [] };
  }
}

/**
 * Generates next unique article code (e.g. KB-006 or SOP-006).
 */
export async function generateNextArticleCode(isSop: boolean): Promise<string> {
  const prefix = isSop ? "SOP" : "KB";
  if (!supabase) {
    return `${prefix}-00${ILLUSTRATIVE_SOP_GUIDES.length + 1}`;
  }

  try {
    const { count, error } = await supabase
      .from("knowledge_articles")
      .select("*", { count: "exact", head: true })
      .eq("is_sop", isSop);

    if (error || count === null) {
      return `${prefix}-00${Math.floor(Math.random() * 900) + 100}`;
    }

    const nextNum = (count || 0) + 1;
    return `${prefix}-${nextNum.toString().padStart(3, "0")}`;
  } catch {
    return `${prefix}-001`;
  }
}

/**
 * Helper to slugify a title safely.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates a new article in Draft status and records version 1.
 */
export async function createKnowledgeArticle(
  input: KnowledgeArticleInput,
  authorId: string
): Promise<{ ok: boolean; article?: KnowledgeArticle; message?: string }> {
  if (!input.title || !input.content) {
    return { ok: false, message: "Title and content are required." };
  }

  const isSop = Boolean(input.is_sop);
  const code = await generateNextArticleCode(isSop);
  const baseSlug = slugifyTitle(input.title);
  const uniqueSlug = `${code.toLowerCase()}-${baseSlug}`.slice(0, 90);

  if (!supabase) {
    const newArt: KnowledgeArticle = {
      id: `local-${Date.now()}`,
      article_code: code,
      title: input.title,
      slug: uniqueSlug,
      category_id: input.category_id || null,
      summary: input.summary || null,
      content: input.content,
      tags: input.tags || [],
      status: "draft",
      author_id: authorId,
      target_roles: input.target_roles || [],
      department: input.department || null,
      is_sop: isSop,
      is_pinned: Boolean(input.is_pinned),
      view_count: 0,
      current_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { ok: true, article: newArt };
  }

  try {
    const { data: art, error: artErr } = await supabase
      .from("knowledge_articles")
      .insert({
        article_code: code,
        title: input.title,
        slug: uniqueSlug,
        category_id: input.category_id || null,
        summary: input.summary || null,
        content: input.content,
        tags: input.tags || [],
        status: "draft",
        author_id: authorId,
        target_roles: input.target_roles || [],
        department: input.department || null,
        is_sop: isSop,
        is_pinned: Boolean(input.is_pinned),
        current_version: 1,
      })
      .select()
      .single();

    if (artErr || !art) {
      return { ok: false, message: artErr?.message || "Failed to create knowledge article." };
    }

    // Insert version 1
    await supabase.from("knowledge_article_versions").insert({
      article_id: art.id,
      version_number: 1,
      title: input.title,
      summary: input.summary || null,
      content: input.content,
      tags: input.tags || [],
      change_summary: input.change_summary || "Initial draft creation.",
      created_by: authorId,
      review_status: "draft",
    });

    return { ok: true, article: art as KnowledgeArticle };
  } catch (err: any) {
    return { ok: false, message: err?.message || "An unexpected error occurred." };
  }
}

/**
 * Updates an article.
 * Crucial Rule: If the article is already published, a new revision MUST be created.
 * It cannot be silently modified without review.
 */
export async function updateKnowledgeArticle(
  articleId: string,
  input: KnowledgeArticleInput,
  editorId: string,
  isManager: boolean
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) {
    return { ok: true };
  }

  try {
    const { data: currentArt, error: fetchErr } = await supabase
      .from("knowledge_articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (fetchErr || !currentArt) {
      return { ok: false, message: "Article not found." };
    }

    const isPublished = currentArt.status === "published";
    const nextVersion = (currentArt.current_version || 1) + 1;

    // If already published, editing creates a new revision and sets status to 'submitted' or requires review
    const newStatus = isPublished
      ? isManager
        ? "published" // Authorized managers can directly approve updates
        : "submitted"
      : currentArt.status;

    // Record new version in versions table
    await supabase.from("knowledge_article_versions").insert({
      article_id: articleId,
      version_number: nextVersion,
      title: input.title,
      summary: input.summary || null,
      content: input.content,
      tags: input.tags || [],
      change_summary: input.change_summary || "Updated document revision.",
      created_by: editorId,
      review_status: isPublished ? (isManager ? "published" : "submitted") : "draft",
    });

    // Update article table
    const { error: updateErr } = await supabase
      .from("knowledge_articles")
      .update({
        title: input.title,
        category_id: input.category_id || null,
        summary: input.summary || null,
        content: input.content,
        tags: input.tags || [],
        target_roles: input.target_roles || currentArt.target_roles,
        department: input.department || currentArt.department,
        is_sop: input.is_sop !== undefined ? input.is_sop : currentArt.is_sop,
        is_pinned: input.is_pinned !== undefined ? input.is_pinned : currentArt.is_pinned,
        current_version: nextVersion,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId);

    if (updateErr) {
      return { ok: false, message: updateErr.message };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to update article." };
  }
}

/**
 * Submits an article for review.
 */
export async function submitArticleForReview(
  articleId: string
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: true };

  try {
    const { error } = await supabase
      .from("knowledge_articles")
      .update({
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId);

    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to submit for review." };
  }
}

/**
 * Approves and publishes an article (restricted to authorized managers).
 */
export async function approveAndPublishArticle(
  articleId: string,
  reviewerId: string
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: true };

  try {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("knowledge_articles")
      .update({
        status: "published",
        reviewer_id: reviewerId,
        approved_at: nowIso,
        published_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", articleId);

    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to publish article." };
  }
}

/**
 * Returns an article for revision.
 */
export async function returnArticleForRevision(
  articleId: string,
  reviewerId: string,
  notes: string
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: true };

  try {
    const { error } = await supabase
      .from("knowledge_articles")
      .update({
        status: "returned_for_revision",
        reviewer_id: reviewerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId);

    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to return article." };
  }
}

/**
 * Archives an article.
 */
export async function archiveArticle(
  articleId: string
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: true };

  try {
    const { error } = await supabase
      .from("knowledge_articles")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId);

    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to archive article." };
  }
}

/**
 * Restores a previous version of an article.
 */
export async function restoreArticleVersion(
  articleId: string,
  versionNumber: number,
  restoredByStaffId: string
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: true };

  try {
    const { data: ver, error: verErr } = await supabase
      .from("knowledge_article_versions")
      .select("*")
      .eq("article_id", articleId)
      .eq("version_number", versionNumber)
      .single();

    if (verErr || !ver) {
      return { ok: false, message: "Specified version not found." };
    }

    const { data: currentArt } = await supabase
      .from("knowledge_articles")
      .select("current_version")
      .eq("id", articleId)
      .single();

    const newVersionNumber = ((currentArt?.current_version as number) || 1) + 1;

    // Record the restore as a new version
    await supabase.from("knowledge_article_versions").insert({
      article_id: articleId,
      version_number: newVersionNumber,
      title: ver.title,
      summary: ver.summary,
      content: ver.content,
      tags: ver.tags,
      change_summary: `Restored from version ${versionNumber}.`,
      created_by: restoredByStaffId,
      review_status: "published",
    });

    // Update the live article
    const { error: artErr } = await supabase
      .from("knowledge_articles")
      .update({
        title: ver.title,
        summary: ver.summary,
        content: ver.content,
        tags: ver.tags,
        current_version: newVersionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId);

    if (artErr) return { ok: false, message: artErr.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to restore version." };
  }
}
