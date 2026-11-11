import type {
  ClientComplaintRecord,
  ClientFeedbackRecord,
  ComplaintCategory,
  OfficerQualitySummary,
  QualitySummaryMetrics,
  ServiceQualityReviewRecord,
} from "./types";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../communications/emailConfig";

/**
 * Evaluates the status of the external ABLEBIZ feedback URL
 */
export function getFeedbackIntegrationConfig() {
  return {
    officialFeedbackUrl: OFFICIAL_BUSINESS_EMAIL_CONFIG.feedbackUrl, // http://bit.ly/ablefeedback
    isAutomatedWebhookAvailable: false,
    integrationType: "manual_and_native",
    description:
      "The historical http://bit.ly/ablefeedback URL links to an external form provider without direct webhook credentials. The Suite supports native in-app survey collection, secure direct tokens, and manual logging of external form submissions.",
  };
}

/**
 * Generates an idempotent complaint reference number
 * Format: CMP-YYYY-XXXX (e.g. CMP-2026-1042)
 */
export function generateComplaintNumber(seed?: number | string): string {
  const year = new Date().getFullYear();
  let randomPart: string;
  if (seed !== undefined && seed !== null) {
    const num = Math.abs(typeof seed === "number" ? seed : seed.split("").reduce((a, b) => a + b.charCodeAt(0), 0));
    randomPart = (num % 9000 + 1000).toString();
  } else {
    randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return `CMP-${year}-${randomPart}`;
}

/**
 * Generates an idempotent quality review reference number
 * Format: QREV-YYYY-XXXX (e.g. QREV-2026-0812)
 */
export function generateQualityReviewNumber(seed?: number | string): string {
  const year = new Date().getFullYear();
  let randomPart: string;
  if (seed !== undefined && seed !== null) {
    const num = Math.abs(typeof seed === "number" ? seed : seed.split("").reduce((a, b) => a + b.charCodeAt(0), 0));
    randomPart = (num % 9000 + 1000).toString();
  } else {
    randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return `QREV-${year}-${randomPart}`;
}

/**
 * Computes satisfaction and service quality metrics across feedback submissions and complaints
 */
export function computeQualitySummaryMetrics(params: {
  feedbackList: ClientFeedbackRecord[];
  complaintsList: ClientComplaintRecord[];
  satisfactionThreshold?: number; // default: 4 (out of 5)
  referenceDate?: Date;
}): QualitySummaryMetrics {
  const { feedbackList, complaintsList, satisfactionThreshold = 4, referenceDate = new Date() } = params;

  // 1. Feedback Ratings & Distribution
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let satisfiedCount = 0;

  // NPS Counters
  let promoters = 0;
  let detractors = 0;
  let npsEligibleCount = 0;

  for (const fb of feedbackList) {
    const r = Math.min(5, Math.max(1, Math.round(fb.rating)));
    ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
    ratingSum += r;

    if (r >= satisfactionThreshold) {
      satisfiedCount++;
    }

    if (fb.recommendation_score !== null && fb.recommendation_score !== undefined) {
      npsEligibleCount++;
      if (fb.recommendation_score >= 9) {
        promoters++;
      } else if (fb.recommendation_score <= 6) {
        detractors++;
      }
    }
  }

  const totalFeedbackCount = feedbackList.length;
  const averageSatisfaction = totalFeedbackCount > 0
    ? Math.round((ratingSum / totalFeedbackCount) * 10) / 10
    : 0;

  const satisfiedPercentage = totalFeedbackCount > 0
    ? Math.round((satisfiedCount / totalFeedbackCount) * 100)
    : 0;

  const npsScore = npsEligibleCount > 0
    ? Math.round(((promoters - detractors) / npsEligibleCount) * 100)
    : null;

  // 2. Complaints Analysis
  const complaintCategoryBreakdown: Record<ComplaintCategory, number> = {
    delayed_service: 0,
    communication_issue: 0,
    documentation_error: 0,
    incorrect_information: 0,
    billing_concern: 0,
    service_quality: 0,
    staff_conduct: 0,
    other: 0,
  };

  let activeComplaints = 0;
  let overdueComplaints = 0;
  let resolvedComplaints = 0;
  let totalResolutionHours = 0;
  let resolvedWithHoursCount = 0;

  for (const cmp of complaintsList) {
    complaintCategoryBreakdown[cmp.category] = (complaintCategoryBreakdown[cmp.category] || 0) + 1;

    const isResolved = ["resolved", "closed"].includes(cmp.status);
    if (isResolved) {
      resolvedComplaints++;
      if (cmp.resolution_date && cmp.created_at) {
        const start = new Date(cmp.created_at).getTime();
        const end = new Date(cmp.resolution_date).getTime();
        if (end > start) {
          totalResolutionHours += (end - start) / (1000 * 60 * 60);
          resolvedWithHoursCount++;
        }
      }
    } else {
      activeComplaints++;
      // Check if overdue
      const createdTime = new Date(cmp.created_at || cmp.date_received).getTime();
      const hoursElapsed = (referenceDate.getTime() - createdTime) / (1000 * 60 * 60);
      if (hoursElapsed > cmp.resolution_target_hours) {
        overdueComplaints++;
      }
    }
  }

  const averageResolutionHours = resolvedWithHoursCount > 0
    ? Math.round((totalResolutionHours / resolvedWithHoursCount) * 10) / 10
    : 0;

  return {
    totalFeedbackCount,
    averageSatisfaction,
    ratingDistribution,
    satisfiedPercentage,
    npsScore,
    totalComplaints: complaintsList.length,
    activeComplaints,
    overdueComplaints,
    resolvedComplaints,
    averageResolutionHours,
    complaintCategoryBreakdown,
  };
}

/**
 * Checks deadline compliance and determines whether a complaint requires escalation
 */
export function evaluateComplaintEscalation(
  complaint: ClientComplaintRecord,
  referenceDate = new Date()
): {
  isOverdue: boolean;
  hoursElapsed: number;
  shouldEscalate: boolean;
  escalationReason?: string;
} {
  const isConcluded = ["resolved", "closed"].includes(complaint.status);
  if (isConcluded) {
    return { isOverdue: false, hoursElapsed: 0, shouldEscalate: false };
  }

  const createdTime = new Date(complaint.created_at || complaint.date_received).getTime();
  const hoursElapsed = Math.max(0, Math.round((referenceDate.getTime() - createdTime) / (1000 * 60 * 60)));

  const isOverdue = hoursElapsed > complaint.resolution_target_hours;
  const shouldEscalate = isOverdue && !complaint.is_escalated;

  let escalationReason: string | undefined;
  if (shouldEscalate) {
    escalationReason = `Complaint ${complaint.complaint_number} has exceeded its resolution target of ${complaint.resolution_target_hours}h (${hoursElapsed}h elapsed) without resolution. Escalated for management intervention.`;
  }

  return {
    isOverdue,
    hoursElapsed,
    shouldEscalate,
    escalationReason,
  };
}

/**
 * Fair, context-aware aggregation of officer-level service quality
 * Protects staff by separating verified defects from unverified subjective comments,
 * and highlights low sample sizes to prevent misleading conclusions.
 */
export function aggregateOfficerQualitySummary(params: {
  officerId: string;
  officerName: string;
  feedbackList: ClientFeedbackRecord[];
  complaintsList: ClientComplaintRecord[];
  reviewsList: ServiceQualityReviewRecord[];
}): OfficerQualitySummary {
  const { officerId, officerName, feedbackList, complaintsList, reviewsList } = params;

  const officerFeedback = feedbackList.filter(
    (fb) => fb.assigned_officer_id === officerId
  );

  const sampleSize = officerFeedback.length;
  let averageRating: number | null = null;
  if (sampleSize > 0) {
    const sum = officerFeedback.reduce((acc, curr) => acc + curr.rating, 0);
    averageRating = Math.round((sum / sampleSize) * 10) / 10;
  }

  // Only count VERIFIED defects, not unverified allegations
  const verifiedComplaintCount = complaintsList.filter(
    (cmp) => cmp.assigned_officer_id === officerId && cmp.is_verified_defect === true
  ).length;

  const officerReviews = reviewsList.filter(
    (rev) => rev.reviewed_officer_id === officerId
  );

  const qualityReviewsPassed = officerReviews.filter((r) =>
    ["passed", "passed_with_minor_notes"].includes(r.outcome)
  ).length;

  const qualityReviewsNeedingCorrection = officerReviews.filter((r) =>
    ["correction_required", "failed_rework_needed"].includes(r.outcome)
  ).length;

  return {
    officerId,
    officerName,
    sampleSize,
    averageRating,
    verifiedComplaintCount,
    qualityReviewsPassed,
    qualityReviewsNeedingCorrection,
    isLowSampleSize: sampleSize < 5,
  };
}
