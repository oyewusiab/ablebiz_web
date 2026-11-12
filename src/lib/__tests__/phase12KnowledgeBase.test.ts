import test from "node:test";
import assert from "node:assert/strict";

import {
  canRoleAccessArticle,
  canEditArticle,
  canApproveArticle,
  slugifyTitle,
  ILLUSTRATIVE_SOP_GUIDES,
  INITIAL_KNOWLEDGE_CATEGORIES,
} from "../knowledgeBase/knowledgeService";
import type {
  KnowledgeArticle,
  KnowledgeCategory,
} from "../../types/knowledgeBase";

test("Phase 12 — Knowledge Base: Approval authority strictly conforms to canonical staff roles", () => {
  // Super Admin and Admin can approve any article or SOP
  assert.equal(canApproveArticle("super_admin", false), true);
  assert.equal(canApproveArticle("super_admin", true), true);
  assert.equal(canApproveArticle("admin", false), true);
  assert.equal(canApproveArticle("admin", true), true);

  // Operations Manager can approve SOPs, but not non-SOP organizational policies
  assert.equal(canApproveArticle("operations_manager", true), true);
  assert.equal(canApproveArticle("operations_manager", false), false);

  // Line staff cannot approve articles
  assert.equal(canApproveArticle("registration_officer", true), false);
  assert.equal(canApproveArticle("accounts_officer", true), false);
  assert.equal(canApproveArticle("client_service_officer", false), false);
  assert.equal(canApproveArticle("marketing_officer", false), false);
  assert.equal(canApproveArticle("viewer", true), false);
  assert.equal(canApproveArticle(null, true), false);
});

test("Phase 12 — Knowledge Base: Role-based access control enforces article visibility rules", () => {
  const publicArticle: KnowledgeArticle = {
    id: "art-pub",
    article_code: "SOP-001",
    title: "Company Registration Procedure",
    slug: "company-registration-procedure",
    summary: "Standard company registration steps.",
    content: "Step 1: Check name availability...",
    status: "published",
    author_id: "staff-lead-legal",
    target_roles: [], // empty = all active staff
    tags: ["cac", "company"],
    is_sop: true,
    is_pinned: false,
    view_count: 10,
    current_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const financeRestrictedArticle: KnowledgeArticle = {
    id: "art-finance",
    article_code: "SOP-004",
    title: "Client Refund & Financial Write-Off Procedure",
    slug: "client-refund-procedure",
    summary: "Mandatory approvals for issuing client refunds.",
    content: "Refunds require dual authorization...",
    status: "published",
    author_id: "staff-finance",
    target_roles: ["accounts_officer", "super_admin", "admin"],
    tags: ["finance", "refunds"],
    is_sop: true,
    is_pinned: false,
    view_count: 4,
    current_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const draftArticle: KnowledgeArticle = {
    id: "art-draft",
    article_code: "SOP-009",
    title: "Unapproved Internal Note",
    slug: "unapproved-internal-note",
    summary: "Work in progress draft.",
    content: "Unverified rough ideas...",
    status: "draft",
    author_id: "staff-author-1",
    target_roles: [],
    tags: ["draft"],
    is_sop: false,
    is_pinned: false,
    view_count: 0,
    current_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  // Public article is visible to everyone
  assert.equal(canRoleAccessArticle(publicArticle, "registration_officer"), true);
  assert.equal(canRoleAccessArticle(publicArticle, "accounts_officer"), true);
  assert.equal(canRoleAccessArticle(publicArticle, "viewer"), true);

  // Finance restricted article is visible to accounts_officer and super_admin, but hidden from registration_officer
  assert.equal(canRoleAccessArticle(financeRestrictedArticle, "accounts_officer"), true);
  assert.equal(canRoleAccessArticle(financeRestrictedArticle, "super_admin"), true);
  assert.equal(canRoleAccessArticle(financeRestrictedArticle, "registration_officer"), false);
  assert.equal(canRoleAccessArticle(financeRestrictedArticle, "viewer"), false);

  // Draft article is only visible to the author and super_admin/admin, hidden from other staff
  assert.equal(canRoleAccessArticle(draftArticle, "super_admin"), true);
  assert.equal(canRoleAccessArticle(draftArticle, "registration_officer", "staff-author-1"), true); // Author
  assert.equal(canRoleAccessArticle(draftArticle, "registration_officer", "staff-other-user"), false); // Non-author
});

test("Phase 12 — Knowledge Base: Editing permissions protect published documents from silent modification", () => {
  const publishedSop: KnowledgeArticle = {
    id: "art-published-sop",
    article_code: "SOP-001",
    title: "Company Registration",
    slug: "company-registration",
    content: "Official procedure...",
    status: "published",
    author_id: "staff-author-1",
    target_roles: [],
    tags: [],
    is_sop: true,
    is_pinned: false,
    view_count: 5,
    current_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const draftArticle: KnowledgeArticle = {
    id: "art-draft-1",
    article_code: "KB-010",
    title: "Draft Guide",
    slug: "draft-guide",
    content: "Working copy...",
    status: "draft",
    author_id: "staff-author-1",
    target_roles: [],
    tags: [],
    is_sop: false,
    is_pinned: false,
    view_count: 0,
    current_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  // Author can edit draft
  assert.equal(canEditArticle(draftArticle, "registration_officer", "staff-author-1"), true);
  // Non-author cannot edit draft
  assert.equal(canEditArticle(draftArticle, "registration_officer", "staff-author-2"), false);

  // Author CANNOT directly edit a published article unless they are admin/super_admin or operations manager (on SOPs)
  assert.equal(canEditArticle(publishedSop, "registration_officer", "staff-author-1"), false);
  assert.equal(canEditArticle(publishedSop, "operations_manager", "staff-author-1"), true);
  assert.equal(canEditArticle(publishedSop, "super_admin", "staff-boss"), true);
});

test("Phase 12 — Knowledge Base: Slug generator creates clean, URL-safe identifiers", () => {
  const slug = slugifyTitle("Standard CAC Company Registration (Part A) — 2026 Update!");
  assert.equal(slug, "standard-cac-company-registration-part-a-2026-update");
});

test("Phase 12 — Knowledge Base: Illustrative fallback SOPs exist for cold-start resilience", () => {
  assert.ok(ILLUSTRATIVE_SOP_GUIDES.length >= 5, "Must include at least 5 standard SOPs");
  
  const codes = ILLUSTRATIVE_SOP_GUIDES.map((s) => s.article_code);
  assert.ok(codes.includes("SOP-001"), "Includes SOP-001 Private Limited Company Registration");
  assert.ok(codes.includes("SOP-002"), "Includes SOP-002 NGO & Incorporated Trustees Registration");
  assert.ok(codes.includes("SOP-003"), "Includes SOP-003 Client Complaint Resolution Procedure");
  assert.ok(codes.includes("SOP-004"), "Includes SOP-004 Client Refund & Financial Adjustment Policy");
  assert.ok(codes.includes("SOP-005"), "Includes SOP-005 Quotation & Retainer Agreement Preparation");

  // Every illustrative SOP must be marked as published and have clean markdown content
  for (const sop of ILLUSTRATIVE_SOP_GUIDES) {
    assert.equal(sop.status, "published");
    assert.ok(sop.content.length > 100, `SOP ${sop.article_code} content must be detailed`);
    assert.ok(sop.summary && sop.summary.length > 20, `SOP ${sop.article_code} summary must be informative`);
  }
});
