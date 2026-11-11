import type { CanonicalStaffRole } from "../auth/roleConfig";

export type ApprovalCategory = "finance" | "commercial" | "operations" | "administration";

export type ApprovalRequestType =
  | "expense"
  | "refund"
  | "invoice_adjustment"
  | "financial_writeoff"
  | "budget_allocation"
  | "discount"
  | "campaign_pricing"
  | "special_quotation"
  | "document_release"
  | "deliverable_approval"
  | "process_exception"
  | "staff_change";

export type ApprovalStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "returned_for_revision"
  | "withdrawn"
  | "executed";

export type ExecutionStatus =
  | "not_required"
  | "pending_execution"
  | "executed"
  | "failed";

export interface SupportingDocument {
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploaded_at?: string;
}

export interface ApprovalRule {
  id: string;
  category: ApprovalCategory;
  request_type: ApprovalRequestType;
  name: string;
  description?: string | null;
  min_amount: number;
  max_amount?: number | null;
  required_approver_roles: CanonicalStaffRole[];
  sequential_stages: number;
  requires_supporting_documents: boolean;
  mandatory_comments: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalDecisionHistory {
  id: string;
  approval_request_id: string;
  stage: number;
  actor_id: string;
  action: "submitted" | "approved" | "rejected" | "returned_for_revision" | "withdrawn" | "reopened" | "executed" | "commented";
  comments: string;
  previous_status: ApprovalStatus;
  new_status: ApprovalStatus;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

export interface ApprovalRequest {
  id: string;
  reference_number: string;
  category: ApprovalCategory;
  request_type: ApprovalRequestType;
  title: string;
  description: string;
  justification: string;
  requested_by: string;
  amount?: number | null;
  currency: string;
  related_module?: string | null;
  related_record_id?: string | null;
  supporting_documents: SupportingDocument[];
  assigned_approver_roles: CanonicalStaffRole[];
  current_stage: number;
  total_stages: number;
  status: ApprovalStatus;
  decision_comments?: string | null;
  decision_by?: string | null;
  decision_at?: string | null;
  execution_status: ExecutionStatus;
  execution_notes?: string | null;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  decision_maker?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
  history?: ApprovalDecisionHistory[];
}

export interface CreateApprovalRequestInput {
  category: ApprovalCategory;
  request_type: ApprovalRequestType;
  title: string;
  description: string;
  justification: string;
  amount?: number | null;
  currency?: string;
  related_module?: string | null;
  related_record_id?: string | null;
  supporting_documents?: SupportingDocument[];
}

export interface ApprovalInboxFilters {
  tab: "pending" | "my_submissions" | "approved" | "rejected" | "returned" | "all" | "rules";
  category: string;
  searchTerm: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
}
