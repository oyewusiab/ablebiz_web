import type { CanonicalStaffRole } from "../../auth/roleConfig";

export type TaskComplexity = "low" | "medium" | "high" | "very_high";

export interface TaskPerformanceRecord {
  id: string;
  title: string;
  assigned_to?: string | null;
  assigned_to_profile?: {
    id: string;
    full_name: string;
    role: CanonicalStaffRole;
  } | null;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  is_escalated: boolean;
  complexity: TaskComplexity;
  estimated_effort_hours?: number;
  quality_score?: number | null;
  rework_count: number;
  external_wait_time_minutes: number;
  client_wait_time_minutes: number;
}

export interface ServiceTurnaroundRecord {
  id: string;
  service_id?: string | null;
  service_name?: string;
  client_id?: string | null;
  created_at: string;
  completed_at?: string | null;
  status: string;
  assigned_officer_id?: string | null;
  // Time segmentation in hours
  totalElapsedHours: number;
  internalStaffHours: number; // Time under ABLEBIZ control
  clientWaitHours: number; // Waiting for client documents / replies (Paused)
  externalAuthorityWaitHours: number; // Waiting for CAC, FIRS, SCUML (Paused)
  targetDurationHours: number;
  isCompletedWithinTarget: boolean;
}

export interface StaffWorkloadCapacityRecord {
  staff_id: string;
  max_active_tasks: number;
  max_active_service_requests: number;
  max_active_cac_filings: number;
  target_completion_days: number;
  complexity_weights: Record<TaskComplexity, number>;
}

export interface IndividualStaffPerformanceMetric {
  staffId: string;
  staffName: string;
  role: CanonicalStaffRole;
  department: string;
  // Workload & Tasks
  activeTasksCount: number;
  overdueTasksCount: number;
  completedTasksCount: number;
  completionRate: number; // %
  averageTaskCompletionDays: number;
  tasksCompletedWithinTarget: number;
  tasksReturnedForCorrection: number;
  weightedWorkloadPoints: number; // sum of complexity points for active tasks
  capacityLimit: number;
  workloadUtilizationPct: number; // (active / capacity) * 100
  isOverCapacity: boolean;
  // Services & Turnaround
  serviceRequestsCompleted: number;
  cacApplicationsProcessed: number;
  averageInternalTurnaroundDays: number; // strictly ABLEBIZ control time
  averageExternalWaitDays: number; // external pause time
  // Follow-ups
  followUpsAssigned: number;
  followUpsCompleted: number;
  followUpsOverdue: number;
  // Quality & HR Context
  qualityReviewsPassed: number;
  qualityReviewsNeedingCorrection: number;
  availableWorkingDays: number;
  attendedDaysCount: number;
  approvedLeaveDaysCount: number;
}

export interface TeamPerformanceSummary {
  totalStaffCount: number;
  totalActiveTasks: number;
  totalOverdueTasks: number;
  teamAverageTaskTurnaroundDays: number;
  teamServiceTurnaroundDays: number;
  teamInternalTurnaroundDays: number;
  teamExternalWaitDays: number;
  servicesCompletedWithinTargetPct: number;
  overloadedStaffCount: number;
  balancedStaffCount: number;
  availableCapacityStaffCount: number;
}
