import test from "node:test";
import assert from "node:assert/strict";

import {
  generateComplaintNumber,
  generateQualityReviewNumber,
  computeQualitySummaryMetrics,
  evaluateComplaintEscalation,
  aggregateOfficerQualitySummary,
  getFeedbackIntegrationConfig,
} from "../quality/qualityService";
import type { ClientComplaintRecord, ClientFeedbackRecord, ServiceQualityReviewRecord } from "../quality/types";

test("Phase 10 — Service Quality: References follow CMP-YYYY-XXXX and QREV-YYYY-XXXX format", () => {
  const cmp = generateComplaintNumber(1024);
  const qrev = generateQualityReviewNumber(2048);
  assert.match(cmp, /^CMP-\d{4}-\d{4}$/);
  assert.match(qrev, /^QREV-\d{4}-\d{4}$/);
});

test("Phase 10 — Service Quality: External feedback link configuration evaluates historical bit.ly status", () => {
  const cfg = getFeedbackIntegrationConfig();
  assert.equal(cfg.officialFeedbackUrl, "http://bit.ly/ablefeedback");
  assert.equal(cfg.isAutomatedWebhookAvailable, false);
  assert.match(cfg.description, /external form provider without direct webhook credentials/i);
});

test("Phase 10 — Service Quality: Satisfaction metrics compute CSAT average and NPS accurately", () => {
  const feedback: ClientFeedbackRecord[] = [
    // 5 stars, NPS promoter (10)
    { id: "f1", rating: 5, recommendation_score: 10, source: "in_suite_survey", is_verified: true, status: "published", created_at: "2026-05-01" },
    // 5 stars, NPS promoter (9)
    { id: "f2", rating: 5, recommendation_score: 9, source: "in_suite_survey", is_verified: true, status: "published", created_at: "2026-05-02" },
    // 4 stars, NPS passive (8)
    { id: "f3", rating: 4, recommendation_score: 8, source: "external_bitly_form", is_verified: true, status: "published", created_at: "2026-05-03" },
    // 2 stars, NPS detractor (4)
    { id: "f4", rating: 2, recommendation_score: 4, source: "manual_call", is_verified: true, status: "published", created_at: "2026-05-04" },
  ];

  // Ratings: (5 + 5 + 4 + 2) / 4 = 16 / 4 = 4.0
  // Satisfied (>= 4): 3 / 4 = 75%
  // NPS: 2 promoters (50%), 1 passive (25%), 1 detractor (25%) -> NPS = 50 - 25 = +25
  const metrics = computeQualitySummaryMetrics({
    feedbackList: feedback,
    complaintsList: [],
    satisfactionThreshold: 4,
  });

  assert.equal(metrics.totalFeedbackCount, 4);
  assert.equal(metrics.averageSatisfaction, 4.0);
  assert.equal(metrics.satisfiedPercentage, 75);
  assert.equal(metrics.npsScore, 25);
  assert.equal(metrics.ratingDistribution[5], 2);
  assert.equal(metrics.ratingDistribution[4], 1);
  assert.equal(metrics.ratingDistribution[2], 1);
});

test("Phase 10 — Service Quality: Complaint escalation identifies overdue tickets based on resolution target", () => {
  const refNow = new Date("2026-05-10T12:00:00Z");

  // Complaint received 4 days ago (96 hours ago) with target 72h -> Overdue
  const overdueComplaint: ClientComplaintRecord = {
    id: "cmp-1",
    complaint_number: "CMP-2026-5012",
    client_id: "client-1",
    category: "delayed_service",
    title: "CAC Certificate Delay",
    description: "Certificate took longer than standard SLA",
    date_received: "2026-05-06",
    created_at: "2026-05-06T10:00:00Z",
    priority: "high",
    response_target_hours: 24,
    resolution_target_hours: 72,
    status: "received",
    is_verified_defect: false,
    is_escalated: false,
    updated_at: "2026-05-06T10:00:00Z",
  };

  const escalation = evaluateComplaintEscalation(overdueComplaint, refNow);
  assert.equal(escalation.isOverdue, true);
  assert.equal(escalation.shouldEscalate, true);
  assert.match(escalation.escalationReason || "", /exceeded its resolution target/i);

  // Resolved complaints do not escalate
  const resolvedComplaint = { ...overdueComplaint, status: "resolved" as const };
  const resEscalation = evaluateComplaintEscalation(resolvedComplaint, refNow);
  assert.equal(resEscalation.isOverdue, false);
  assert.equal(resEscalation.shouldEscalate, false);
});

test("Phase 10 — Service Quality: Officer quality summary highlights low sample sizes and verifies defects", () => {
  const feedback: ClientFeedbackRecord[] = [
    { id: "f1", assigned_officer_id: "officer-kemi", rating: 5, source: "in_suite_survey", is_verified: true, status: "published", created_at: "2026-05-01" },
    { id: "f2", assigned_officer_id: "officer-kemi", rating: 4, source: "in_suite_survey", is_verified: true, status: "published", created_at: "2026-05-02" },
  ]; // Only 2 feedback -> low sample size

  const complaints: ClientComplaintRecord[] = [
    // Unverified complaint
    { id: "c1", complaint_number: "CMP-1", client_id: "c1", assigned_officer_id: "officer-kemi", category: "communication_issue", title: "Unreachable", description: "Called once", date_received: "2026-05-01", priority: "normal", response_target_hours: 24, resolution_target_hours: 72, status: "resolved", is_verified_defect: false, is_escalated: false, created_at: "2026-05-01", updated_at: "2026-05-01" },
    // Verified complaint
    { id: "c2", complaint_number: "CMP-2", client_id: "c2", assigned_officer_id: "officer-kemi", category: "documentation_error", title: "Wrong spelling in form", description: "Typo in director name", date_received: "2026-05-02", priority: "high", response_target_hours: 24, resolution_target_hours: 72, status: "resolved", is_verified_defect: true, is_escalated: false, created_at: "2026-05-02", updated_at: "2026-05-02" },
  ];

  const reviews: ServiceQualityReviewRecord[] = [
    { id: "r1", review_number: "QREV-1", service_request_id: "sr-1", reviewed_officer_id: "officer-kemi", reviewer_id: "mgr-1", review_date: "2026-05-03", outcome: "passed", is_correction_resolved: false, created_at: "2026-05-03" },
    { id: "r2", review_number: "QREV-2", service_request_id: "sr-2", reviewed_officer_id: "officer-kemi", reviewer_id: "mgr-1", review_date: "2026-05-04", outcome: "correction_required", is_correction_resolved: false, created_at: "2026-05-04" },
  ];

  const summary = aggregateOfficerQualitySummary({
    officerId: "officer-kemi",
    officerName: "Kemi Adeleke",
    feedbackList: feedback,
    complaintsList: complaints,
    reviewsList: reviews,
  });

  assert.equal(summary.sampleSize, 2);
  assert.equal(summary.isLowSampleSize, true); // < 5
  assert.equal(summary.averageRating, 4.5);
  assert.equal(summary.verifiedComplaintCount, 1); // Only c2, not c1!
  assert.equal(summary.qualityReviewsPassed, 1);
  assert.equal(summary.qualityReviewsNeedingCorrection, 1);
});
