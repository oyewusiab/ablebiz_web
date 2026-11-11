export type FeedbackSource =
  | "in_suite_survey"
  | "external_bitly_form"
  | "client_portal"
  | "manual_call"
  | "email_reply";

export type ComplaintCategory =
  | "delayed_service"
  | "communication_issue"
  | "documentation_error"
  | "incorrect_information"
  | "billing_concern"
  | "service_quality"
  | "staff_conduct"
  | "other";

export type ComplaintPriority = "low" | "normal" | "high" | "urgent";

export type ComplaintStatus =
  | "received"
  | "under_review"
  | "assigned"
  | "awaiting_client_response"
  | "resolution_in_progress"
  | "resolved"
  | "closed"
  | "reopened";

export type QualityReviewOutcome =
  | "passed"
  | "passed_with_minor_notes"
  | "correction_required"
  | "failed_rework_needed";

export interface SurveyQuestion {
  id: string;
  question: string;
  type: "rating" | "nps" | "text" | "boolean";
  required: boolean;
}

export interface SurveyTemplateRecord {
  id: string;
  name: string;
  description?: string | null;
  service_category: string;
  questions: SurveyQuestion[];
  rating_scale: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClientFeedbackRecord {
  id: string;
  client_id?: string | null;
  client?: {
    id: string;
    full_name: string;
    phone: string;
    email?: string | null;
  } | null;
  business_id?: string | null;
  service_id?: string | null;
  service?: {
    id: string;
    name: string;
    category?: string;
  } | null;
  service_request_id?: string | null;
  cac_application_id?: string | null;
  assigned_officer_id?: string | null;
  assigned_officer?: {
    id: string;
    full_name: string;
    role?: string;
  } | null;
  rating: number; // 1-5
  professionalism_rating?: number | null; // 1-5
  timeliness_rating?: number | null; // 1-5
  communication_rating?: number | null; // 1-5
  recommendation_score?: number | null; // 1-10
  comments?: string | null;
  survey_response?: Record<string, any>;
  source: FeedbackSource;
  submission_token?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  service_date?: string;
  is_verified: boolean;
  status: "published" | "under_review" | "archived";
  created_at: string;
}

export interface ClientComplaintRecord {
  id: string;
  complaint_number: string; // CMP-2026-0001
  client_id: string;
  client?: {
    id: string;
    full_name: string;
    phone: string;
    email?: string | null;
  } | null;
  business_id?: string | null;
  service_id?: string | null;
  service?: {
    id: string;
    name: string;
  } | null;
  service_request_id?: string | null;
  feedback_id?: string | null;
  category: ComplaintCategory;
  title: string;
  description: string;
  date_received: string; // YYYY-MM-DD
  priority: ComplaintPriority;
  assigned_officer_id?: string | null;
  assigned_officer?: {
    id: string;
    full_name: string;
    role?: string;
  } | null;
  responsible_manager_id?: string | null;
  responsible_manager?: {
    id: string;
    full_name: string;
  } | null;
  response_target_hours: number;
  resolution_target_hours: number;
  status: ComplaintStatus;
  root_cause?: string | null;
  corrective_action?: string | null;
  resolution_notes?: string | null;
  resolution_date?: string | null;
  client_response?: string | null;
  is_verified_defect: boolean;
  is_escalated: boolean;
  escalated_at?: string | null;
  escalation_notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceQualityReviewRecord {
  id: string;
  review_number: string; // QREV-2026-0001
  service_request_id: string;
  cac_application_id?: string | null;
  reviewed_officer_id: string;
  reviewed_officer?: {
    id: string;
    full_name: string;
    role?: string;
  } | null;
  reviewer_id: string;
  reviewer?: {
    id: string;
    full_name: string;
  } | null;
  review_date: string;
  outcome: QualityReviewOutcome;
  documentation_accuracy_score?: number | null; // 1-5
  statutory_compliance_score?: number | null; // 1-5
  timeline_compliance_score?: number | null; // 1-5
  findings?: string | null;
  corrections_specified?: string | null;
  is_correction_resolved: boolean;
  correction_resolved_at?: string | null;
  created_at: string;
}

export interface QualitySummaryMetrics {
  totalFeedbackCount: number;
  averageSatisfaction: number; // e.g. 4.6
  ratingDistribution: Record<number, number>; // 1: n, 2: n, ...
  satisfiedPercentage: number; // percentage with rating >= 4
  npsScore: number | null; // Net Promoter Score (-100 to +100)
  totalComplaints: number;
  activeComplaints: number;
  overdueComplaints: number;
  resolvedComplaints: number;
  averageResolutionHours: number;
  complaintCategoryBreakdown: Record<ComplaintCategory, number>;
}

export interface OfficerQualitySummary {
  officerId: string;
  officerName: string;
  sampleSize: number;
  averageRating: number | null;
  verifiedComplaintCount: number;
  qualityReviewsPassed: number;
  qualityReviewsNeedingCorrection: number;
  isLowSampleSize: boolean; // sampleSize < 5 -> caution
}
