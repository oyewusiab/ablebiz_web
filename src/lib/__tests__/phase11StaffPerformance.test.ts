import test from "node:test";
import assert from "node:assert/strict";

import {
  computeMedian,
  calculateServiceTurnaroundSegmentation,
  computeStaffIndividualPerformance,
  computeTeamPerformanceSummary,
} from "../performance/performanceService";
import type { ServiceTurnaroundRecord, TaskPerformanceRecord } from "../performance/types";

test("Phase 11 — Staff Performance: Median calculation is mathematically sound", () => {
  assert.equal(computeMedian([2, 5, 8]), 5);
  assert.equal(computeMedian([2, 4, 6, 8]), 5); // (4 + 6) / 2
  assert.equal(computeMedian([10]), 10);
  assert.equal(computeMedian([]), 0);
});

test("Phase 11 — Staff Performance: Fair SLA turnaround segmentation separates internal vs paused external wait time", () => {
  // Scenario: Service created on May 1 at 00:00, completed on May 6 at 00:00 (120 hours total elapsed = 5 days)
  // Target duration = 3 days (72 hours)
  // Client waited for documents for 24 hours (1,440 mins)
  // CAC portal external query wait was 36 hours (2,160 mins)
  // Internal time under ABLEBIZ control = 120 - 24 - 36 = 60 hours
  // Target = 72 hours. Since internal staff time 60h <= 72h, it was COMPLETED WITHIN TARGET!

  const result = calculateServiceTurnaroundSegmentation({
    createdAt: "2026-05-01T00:00:00Z",
    completedAt: "2026-05-06T00:00:00Z",
    targetDurationDays: 3,
    clientWaitMinutes: 1440,
    externalAuthorityWaitMinutes: 2160,
  });

  assert.equal(result.totalElapsedHours, 120);
  assert.equal(result.clientWaitHours, 24);
  assert.equal(result.externalAuthorityWaitHours, 36);
  assert.equal(result.internalStaffHours, 60);
  assert.equal(result.targetDurationHours, 72);
  assert.equal(result.isCompletedWithinTarget, true);
});

test("Phase 11 — Staff Performance: Individual performance accounts for task complexity and workload capacity", () => {
  const refNow = new Date("2026-05-15T00:00:00Z");

  const tasks: TaskPerformanceRecord[] = [
    // Active task 1: High complexity (weight 3), due in future
    { id: "t1", title: "LTD Incorporation", assigned_to: "staff-1", category: "cac", priority: "high", status: "in_progress", due_date: "2026-05-20", is_escalated: false, complexity: "high", rework_count: 0, external_wait_time_minutes: 0, client_wait_time_minutes: 0 },
    // Active task 2: Very high complexity (weight 5), overdue
    { id: "t2", title: "Complex NGO Restructuring", assigned_to: "staff-1", category: "cac", priority: "urgent", status: "pending", due_date: "2026-05-10", is_escalated: true, complexity: "very_high", rework_count: 1, external_wait_time_minutes: 0, client_wait_time_minutes: 0 },
    // Completed task: Medium complexity
    { id: "t3", title: "Business Name Filing", assigned_to: "staff-1", category: "cac", priority: "normal", status: "completed", start_date: "2026-05-01", completed_at: "2026-05-03", due_date: "2026-05-04", is_escalated: false, complexity: "medium", rework_count: 0, external_wait_time_minutes: 0, client_wait_time_minutes: 0 },
  ];

  const turnarounds: ServiceTurnaroundRecord[] = [
    {
      id: "sr-1",
      assigned_officer_id: "staff-1",
      created_at: "2026-05-01T00:00:00Z",
      completed_at: "2026-05-04T00:00:00Z",
      status: "completed",
      totalElapsedHours: 72,
      internalStaffHours: 48, // 2 days
      clientWaitHours: 12,
      externalAuthorityWaitHours: 12,
      targetDurationHours: 72,
      isCompletedWithinTarget: true,
    },
  ];

  const attendance = [
    { staff_id: "staff-1", status: "present" },
    { staff_id: "staff-1", status: "present" },
    { staff_id: "staff-1", status: "present" },
  ];

  const leave = [
    { staff_id: "staff-1", status: "approved", days_count: 2 },
  ];

  const perf = computeStaffIndividualPerformance({
    staffId: "staff-1",
    staffName: "Babajide Cole",
    role: "registration_officer",
    department: "Legal & Compliance",
    tasks,
    turnarounds,
    cacApplicationsProcessedCount: 5,
    attendanceRecords: attendance,
    leaveRequests: leave,
    capacityConfig: {
      staff_id: "staff-1",
      max_active_tasks: 10,
      max_active_service_requests: 5,
      max_active_cac_filings: 5,
      target_completion_days: 3.0,
      complexity_weights: { low: 1, medium: 2, high: 3, very_high: 5 },
    },
    referenceDate: refNow,
  });

  assert.equal(perf.activeTasksCount, 2);
  assert.equal(perf.overdueTasksCount, 1);
  assert.equal(perf.completedTasksCount, 1);
  assert.equal(perf.weightedWorkloadPoints, 8); // 3 (high) + 5 (very_high) = 8
  assert.equal(perf.capacityLimit, 10);
  assert.equal(perf.workloadUtilizationPct, 20); // 2 / 10 = 20%
  assert.equal(perf.isOverCapacity, false);
  assert.equal(perf.tasksReturnedForCorrection, 1);
  assert.equal(perf.averageInternalTurnaroundDays, 2.0);
  assert.equal(perf.cacApplicationsProcessed, 5);
  assert.equal(perf.attendedDaysCount, 3);
  assert.equal(perf.approvedLeaveDaysCount, 2);
  assert.equal(perf.availableWorkingDays, 5);
});

test("Phase 11 — Staff Performance: Team performance summary categorizes capacity distribution", () => {
  const staff1: any = {
    staffId: "s1",
    activeTasksCount: 16,
    overdueTasksCount: 2,
    averageTaskCompletionDays: 2.5,
    averageInternalTurnaroundDays: 2.0,
    averageExternalWaitDays: 1.0,
    isOverCapacity: true,
    workloadUtilizationPct: 106,
  };

  const staff2: any = {
    staffId: "s2",
    activeTasksCount: 8,
    overdueTasksCount: 0,
    averageTaskCompletionDays: 3.0,
    averageInternalTurnaroundDays: 2.2,
    averageExternalWaitDays: 1.5,
    isOverCapacity: false,
    workloadUtilizationPct: 60,
  };

  const staff3: any = {
    staffId: "s3",
    activeTasksCount: 3,
    overdueTasksCount: 0,
    averageTaskCompletionDays: 1.5,
    averageInternalTurnaroundDays: 1.8,
    averageExternalWaitDays: 0.5,
    isOverCapacity: false,
    workloadUtilizationPct: 25,
  };

  const team = computeTeamPerformanceSummary([staff1, staff2, staff3]);
  assert.equal(team.totalStaffCount, 3);
  assert.equal(team.totalActiveTasks, 27);
  assert.equal(team.totalOverdueTasks, 2);
  assert.equal(team.overloadedStaffCount, 1); // s1
  assert.equal(team.balancedStaffCount, 1); // s2
  assert.equal(team.availableCapacityStaffCount, 1); // s3
});
