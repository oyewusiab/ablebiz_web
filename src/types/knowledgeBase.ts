import type { CanonicalStaffRole } from "../auth/roleConfig";

export type KnowledgeArticleStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "published"
  | "archived"
  | "returned_for_revision";

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeArticleVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  summary?: string | null;
  content: string;
  tags: string[];
  change_summary: string;
  created_by: string;
  review_status: "draft" | "submitted" | "approved" | "rejected" | "published";
  reviewed_by?: string | null;
  review_notes?: string | null;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
}

export interface KnowledgeArticle {
  id: string;
  article_code: string;
  title: string;
  slug: string;
  category_id?: string | null;
  summary?: string | null;
  content: string;
  tags: string[];
  status: KnowledgeArticleStatus;
  author_id: string;
  reviewer_id?: string | null;
  target_roles: CanonicalStaffRole[];
  department?: string | null;
  is_sop: boolean;
  is_pinned: boolean;
  view_count: number;
  current_version: number;
  approved_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  category?: KnowledgeCategory | null;
  author?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
  versions?: KnowledgeArticleVersion[];
}

export interface KnowledgeArticleInput {
  title: string;
  category_id?: string | null;
  summary?: string | null;
  content: string;
  tags: string[];
  target_roles?: CanonicalStaffRole[];
  department?: string | null;
  is_sop?: boolean;
  is_pinned?: boolean;
  change_summary?: string;
}

export interface KnowledgeFilterState {
  searchTerm: string;
  categorySlug: string;
  status: string;
  tag: string;
  sopOnly: boolean;
}
