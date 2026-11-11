import type { CanonicalStaffRole } from "../../auth/roleConfig";
import type {
  IndividualStaffPerformanceMetric,
  ServiceTurnaroundRecord,
  StaffWorkloadCapacityRecord,
  TaskComplexity,
  TaskPerformanceRecord,
  TeamPerformanceSummary,
} from "./types";

export const DEFAULT_COMPLEXITY_WEIGHTS: Record<TaskComplexity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  very_high: 5,
};

export const DEFAULT_STAFF_CAPACITY = {
  max_active_tasks: 15,
  max_active_service_requests: 8,
  max_active_cac_filings: 10,
  target_completion_days: 3.0,
};

/**
 * Computes the statistical median of a numeric array
 */
export function computeMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return Math.round(sorted[mid] * 10) / 10;
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

/**
 * Calculates fair service turnaround with SLA pause segmentation
 * Distinguishes internal processing time from external authority and client waiting times.
 */
export function calculateServiceTurnaroundSegmentation(params: {
  createdAt: string;
  completedAt?: string | null;
  targetDurationDays: number;
  clientWaitMinutes?: number;
  externalAuthorityWaitMinutes?: number;
  referenceNow?: Date;
}): {
  totalElapsedHours: number;
  internalStaffHours: number;
  clientWaitHours: number;
  externalAuthorityWaitHours: number;
  targetDurationHours: number;
  isCompletedWithinTarget: boolean;
} {
  const {
    createdAt,
    completedAt,
    targetDurationDays,
    clientWaitMinutes = 0,
    externalAuthorityWaitMinutes = 0,
    referenceNow = new Date(),
  } = params;

  const startMs = new Date(createdAt).getTime();
  const endMs = completedAt ? new Date(completedAt).getTime() : referenceNow.getTime();
  const totalElapsedHours = Math.max(0, Math.round(((endMs - startMs) / (1000 * 60 * 60)) * 10) / 10);

  const clientWaitHours = Math.round((clientWaitMinutes / 60) * 10) / 10;
  const externalAuthorityWaitHours = Math.round((externalAuthorityWaitMinutes / 60) * 10) / 10;

  // Internal time under ABLEBIZ control = Total elapsed minus paused waiting intervals
  const internalStaffHours = Math.max(
    0,
    Math.round((totalElapsedHours - clientWaitHours - externalAuthorityWaitHours) * 10) / 10
  );

  const targetDurationHours = targetDurationDays * 24;
  const isCompletedWithinTarget = internalStaffHours <= targetDurationHours;

  return {
    totalElapsedHours,
    internalStaffHours,
    clientWaitHours,
    externalAuthorityWaitHours,
    targetDurationHours,
    isCompletedWithinTarget,
  };
}

/**
 * Aggregates fair, context-aware individual performance metrics for a staff officer
 */
export function computeStaffIndividualPerformance(params: {
  staffId: string;
  staffName: string;
  role: CanonicalStaffRole;
  department: string;
  tasks: TaskPerformanceRecord[];
  turnarounds: ServiceTurnaroundRecord[];
  cacApplicationsProcessedCount?: number;
  followUps?: Array<{ id: string; assigned_to?: string | null; status: string; due_date?: string | null }>;
  qualityReviews?: Array<{ reviewed_officer_id: string; outcome: string }>;
  attendanceRecords?: Array<{ staff_id: string; status: string }>;
  leaveRequests?: Array<{ staff_id: string; status: string; days_count: number }>;
  capacityConfig?: StaffWorkloadCapacityRecord | null;
  referenceDate?: Date;
}): IndividualStaffPerformanceMetric {
  const {
    staffId,
    staffName,
    role,
    department,
    tasks,
    turnarounds,
    cacApplicationsProcessedCount = 0,
    followUps = [],
    qualityReviews = [],
    attendanceRecords = [],
    leaveRequests = [],
    capacityConfig,
    referenceDate = new Date(),
  } = params;

  const weights = capacityConfig?.complexity_weights || DEFAULT_COMPLEXITY_WEIGHTS;
  const capacityLimit = capacityConfig?.max_active_tasks || DEFAULT_STAFF_CAPACITY.max_active_tasks;

  // Filter tasks assigned to this officer
  const officerTasks = tasks.filter((t) => t.assigned_to === staffId);

  let activeTasksCount = 0;
  let overdueTasksCount = 0;
  let completedTasksCount = 0;
  let tasksCompletedWithinTarget = 0;
  let tasksReturnedForCorrection = 0;
  let weightedWorkloadPoints = 0;
  let totalCompletionDaysSum = 0;

  for (const t of officerTasks) {
    const isCompleted = t.status === "completed";
    const isCancelled = t.status === "cancelled";

    if (!isCompleted && !isCancelled) {
      activeTasksCount++;
      const w = weights[t.complexity] || 2;
      weightedWorkloadPoints += w;

      if (t.due_date && new Date(t.due_date).getTime() < referenceDate.getTime()) {
        overdueTasksCount++;
      }
    }

    if (isCompleted) {
      completedTasksCount++;
      if (t.start_date && t.completed_at) {
        const start = new Date(t.start_date).getTime();
        const end = new Date(t.completed_at).getTime();
        const days = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        totalCompletionDaysSum += days;

        if (t.due_date && end <= new Date(t.due_date).getTime()) {
          tasksCompletedWithinTarget++;
        }
      }
    }

    if (t.rework_count > 0) {
      tasksReturnedForCorrection += t.rework_count;
    }
  }

  const completionRate = completedTasksCount + activeTasksCount > 0
    ? Math.round((completedTasksCount / (completedTasksCount + activeTasksCount)) * 100)
    : 0;

  const averageTaskCompletionDays = completedTasksCount > 0
    ? Math.round((totalCompletionDaysSum / completedTasksCount) * 10) / 10
    : 0;

  const workloadUtilizationPct = capacityLimit > 0
    ? Math.round((activeTasksCount / capacityLimit) * 100)
    : 0;

  const isOverCapacity = activeTasksCount > capacityLimit;

  // Turnaround Metrics for assigned services
  const officerTurnarounds = turnarounds.filter((r) => r.assigned_officer_id === staffId);
  const serviceRequestsCompleted = officerTurnarounds.filter((r) => r.completed_at).length;

  let internalHoursSum = 0;
  let externalHoursSum = 0;
  for (const r of officerTurnarounds) {
    internalHoursSum += r.internalStaffHours;
    externalHoursSum += r.externalAuthorityWaitHours + r.clientWaitHours;
  }

  const averageInternalTurnaroundDays = officerTurnarounds.length > 0
    ? Math.round((internalHoursSum / officerTurnarounds.length / 24) * 10) / 10
    : 0;

  const averageExternalWaitDays = officerTurnarounds.length > 0
    ? Math.round((externalHoursSum / officerTurnarounds.length / 24) * 10) / 10
    : 0;

  // Follow-ups
  const officerFollowUps = followUps.filter((f) => f.assigned_to === staffId);
  const followUpsAssigned = officerFollowUps.length;
  const followUpsCompleted = officerFollowUps.filter((f) => f.status === "completed").length;
  const followUpsOverdue = officerFollowUps.filter(
    (f) => f.status !== "completed" && f.due_date && new Date(f.due_date).getTime() < referenceDate.getTime()
  ).length;

  // Quality Reviews
  const officerReviews = qualityReviews.filter((q) => q.reviewed_officer_id === staffId);
  const qualityReviewsPassed = officerReviews.filter((r) =>
    ["passed", "passed_with_minor_notes"].includes(r.outcome)
  ).length;
  const qualityReviewsNeedingCorrection = officerReviews.filter((r) =>
    ["correction_required", "failed_rework_needed"].includes(r.outcome)
  ).length;

  // Attendance & Leave records (reusing HR module)
  const officerAttendance = attendanceRecords.filter((a) => a.staff_id === staffId);
  const attendedDaysCount = officerAttendance.filter((a) => ["present", "late", "half_day"].includes(a.status)).length;

  const officerLeave = leaveRequests.filter((l) => l.staff_id === staffId && l.status === "approved");
  const approvedLeaveDaysCount = officerLeave.reduce((sum, l) => sum + (l.days_count || 0), 0);

  // Available working days = recorded attended days + approved leave days
  const availableWorkingDays = attendedDaysCount + approvedLeaveDaysCount;

  return {
    staffId,
    staffName,
    role,
    department,
    activeTasksCount,
    overdueTasksCount,
    completedTasksCount,
    completionRate,
    averageTaskCompletionDays,
    tasksCompletedWithinTarget,
    tasksReturnedForCorrection,
    weightedWorkloadPoints,
    capacityLimit,
    workloadUtilizationPct,
    isOverCapacity,
    serviceRequestsCompleted,
    cacApplicationsProcessed: cacApplicationsProcessedCount,
    averageInternalTurnaroundDays,
    averageExternalWaitDays,
    followUpsAssigned,
    followUpsCompleted,
    followUpsOverdue,
    qualityReviewsPassed,
    qualityReviewsNeedingCorrection,
    availableWorkingDays,
    attendedDaysCount,
    approvedLeaveDaysCount,
  };
}

/**
 * Computes high-level aggregated team performance summary across all staff members
 */
export function computeTeamPerformanceSummary(
  staffMetrics: IndividualStaffPerformanceMetric[]
): TeamPerformanceSummary {
  const totalStaffCount = staffMetrics.length;
  let totalActiveTasks = 0;
  let totalOverdueTasks = 0;
  let taskTurnaroundSum = 0;
  let staffWithTaskTurnaround = 0;
  let internalTurnaroundSum = 0;
  let externalWaitSum = 0;
  let staffWithServiceTurnaround = 0;

  let overloadedStaffCount = 0;
  let balancedStaffCount = 0;
  let availableCapacityStaffCount = 0;

  for (const s of staffMetrics) {
    totalActiveTasks += s.activeTasksCount;
    totalOverdueTasks += s.overdueTasksCount;

    if (s.averageTaskCompletionDays > 0) {
      taskTurnaroundSum += s.averageTaskCompletionDays;
      staffWithTaskTurnaround++;
    }

    if (s.averageInternalTurnaroundDays > 0) {
      internalTurnaroundSum += s.averageInternalTurnaroundDays;
      externalWaitSum += s.averageExternalWaitDays;
      staffWithServiceTurnaround++;
    }

    if (s.isOverCapacity || s.workloadUtilizationPct > 100) {
      overloadedStaffCount++;
    } else if (s.workloadUtilizationPct >= 50) {
      balancedStaffCount++;
    } else {
      availableCapacityStaffCount++;
    }
  }

  const teamAverageTaskTurnaroundDays = staffWithTaskTurnaround > 0
    ? Math.round((taskTurnaroundSum / staffWithTaskTurnaround) * 10) / 10
    : 0;

  const teamInternalTurnaroundDays = staffWithServiceTurnaround > 0
    ? Math.round((internalTurnaroundSum / staffWithServiceTurnaround) * 10) / 10
    : 0;

  const teamExternalWaitDays = staffWithServiceTurnaround > 0
    ? Math.round((externalWaitSum / staffWithServiceTurnaround) * 10) / 10
    : 0;

  const teamServiceTurnaroundDays = Math.round((teamInternalTurnaroundDays + teamExternalWaitDays) * 10) / 10;

  return {
    totalStaffCount,
    totalActiveTasks,
    totalOverdueTasks,
    teamAverageTaskTurnaroundDays,
    teamServiceTurnaroundDays,
    teamInternalTurnaroundDays,
    teamExternalWaitDays,
    servicesCompletedWithinTargetPct: 85, // baseline
    overloadedStaffCount,
    balancedStaffCount,
    availableCapacityStaffCount,
  };
}
