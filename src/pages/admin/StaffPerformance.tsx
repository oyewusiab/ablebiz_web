import { useEffect, useState, useMemo } from "react";
import {
  Users,
  CheckSquare,
  Clock,
  AlertCircle,
  Briefcase,
  TrendingUp,
  FileCheck2,
  Calendar,
  Filter,
  Search,
  ShieldAlert,
  ChevronRight,
  Info,
  Layers,
  Award,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  IndividualStaffPerformanceMetric,
  ServiceTurnaroundRecord,
  StaffWorkloadCapacityRecord,
  TaskComplexity,
  TaskPerformanceRecord,
  TeamPerformanceSummary,
} from "../../lib/performance/types";
import {
  computeMedian,
  computeStaffIndividualPerformance,
  computeTeamPerformanceSummary,
  calculateServiceTurnaroundSegmentation,
  DEFAULT_COMPLEXITY_WEIGHTS,
} from "../../lib/performance/performanceService";

export function StaffPerformancePage() {
  const { user, profile, hasPermission } = useAuth();
  const [tasks, setTasks] = useState<TaskPerformanceRecord[]>([]);
  const [turnarounds, setTurnarounds] = useState<ServiceTurnaroundRecord[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<"team" | "workload" | "turnaround" | "individual">("team");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const isManagement = ["super_admin", "admin", "operations_manager"].includes(profile?.role || "");

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Staff Profiles
      const { data: staffData } = await supabase
        .from("staff_profiles")
        .select("id, full_name, role, email, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (staffData) setStaffList(staffData);

      // 2. Tasks
      const { data: taskData } = await supabase
        .from("tasks")
        .select(`
          id, title, assigned_to, category, priority, status, due_date, start_date, completed_at, is_escalated,
          complexity, estimated_effort_hours, rework_count, external_wait_time_minutes, client_wait_time_minutes
        `);

      if (taskData) {
        setTasks(
          taskData.map((t: any) => ({
            ...t,
            complexity: (t.complexity || "medium") as TaskComplexity,
            rework_count: t.rework_count || 0,
            external_wait_time_minutes: t.external_wait_time_minutes || 0,
            client_wait_time_minutes: t.client_wait_time_minutes || 0,
          }))
        );
      }

      // 3. Service Requests / Turnarounds
      const { data: srData } = await supabase
        .from("service_requests")
        .select("id, service_id, client_id, created_at, updated_at, status, assigned_staff_id, services_catalog(name)");

      if (srData) {
        const mappedTurnarounds: ServiceTurnaroundRecord[] = srData.map((sr: any) => {
          const seg = calculateServiceTurnaroundSegmentation({
            createdAt: sr.created_at,
            completedAt: sr.status === "completed" ? sr.updated_at : null,
            targetDurationDays: 5,
            clientWaitMinutes: 0,
            externalAuthorityWaitMinutes: 0,
          });
          return {
            id: sr.id,
            service_id: sr.service_id,
            service_name: sr.services_catalog?.name,
            client_id: sr.client_id,
            created_at: sr.created_at,
            completed_at: sr.status === "completed" ? sr.updated_at : null,
            status: sr.status,
            assigned_officer_id: sr.assigned_staff_id,
            ...seg,
          };
        });
        setTurnarounds(mappedTurnarounds);
      }

      // 4. Quality reviews
      const { data: revData } = await supabase
        .from("service_quality_reviews")
        .select("reviewed_officer_id, outcome");

      if (revData) setReviewsList(revData);

      // 5. HR Attendance
      const { data: attData } = await supabase
        .from("hr_attendance_records")
        .select("staff_id, status");

      if (attData) setAttendanceRecords(attData);

      // 6. HR Leave
      const { data: leaveData } = await supabase
        .from("hr_leave_requests")
        .select("staff_id, status, days_count");

      if (leaveData) setLeaveRequests(leaveData);

      // 7. Follow-ups
      const { data: fuData } = await supabase
        .from("follow_ups")
        .select("id, assigned_to, status, due_date");

      if (fuData) setFollowUps(fuData);
    } catch (err) {
      console.error("Error loading staff performance data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute individual performance for each staff member
  const staffMetrics = useMemo(() => {
    return staffList.map((s) => {
      return computeStaffIndividualPerformance({
        staffId: s.id,
        staffName: s.full_name,
        role: s.role,
        department: "Operations",
        tasks,
        turnarounds,
        followUps,
        qualityReviews: reviewsList,
        attendanceRecords,
        leaveRequests,
      });
    });
  }, [staffList, tasks, turnarounds, followUps, reviewsList, attendanceRecords, leaveRequests]);

  // Compute aggregated team summary
  const teamSummary = useMemo(() => {
    return computeTeamPerformanceSummary(staffMetrics);
  }, [staffMetrics]);

  // Enforce role-based access:
  // Non-managers only view their own performance scorecard, not other staff members' scores
  const visibleStaffMetrics = useMemo(() => {
    if (isManagement) {
      if (selectedStaffId !== "all") {
        return staffMetrics.filter((m) => m.staffId === selectedStaffId);
      }
      return staffMetrics;
    }
    // Individual staff view: only current user
    return staffMetrics.filter((m) => m.staffId === profile?.id);
  }, [staffMetrics, isManagement, selectedStaffId, profile]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Staff Performance & Workload Analytics
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fair, context-aware operational analytics evaluating workload distribution, turnaround time, task complexity, and quality.
          </p>
        </div>

        {isManagement && (
          <div className="flex items-center gap-2">
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
            >
              <option value="all">Entire Team Overview</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fairness Notice / Context Banner */}
      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
          <p className="font-semibold">Context-Aware Management Principle</p>
          <p className="text-amber-800/90 dark:text-amber-300/80">
            Performance metrics distinguish time under ABLEBIZ control from paused external delays (CAC queries, client document waiting time). Metrics account for task complexity and quality reviews rather than raw task volume.
          </p>
        </div>
      </div>

      {/* High-Level Team KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Active Tasks</p>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{teamSummary.totalActiveTasks}</div>
          <span className="text-[10px] text-slate-400">Across {teamSummary.totalStaffCount} officers</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Overdue Tasks</p>
          <div className="text-2xl font-bold text-rose-500 mt-0.5">{teamSummary.totalOverdueTasks}</div>
          <span className="text-[10px] text-slate-400">Exceeded due date</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Internal Turnaround</p>
          <div className="text-2xl font-bold text-emerald-600 mt-0.5">{teamSummary.teamInternalTurnaroundDays}d</div>
          <span className="text-[10px] text-slate-400">Time under ABLEBIZ control</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">External Wait Time</p>
          <div className="text-2xl font-bold text-amber-500 mt-0.5">{teamSummary.teamExternalWaitDays}d</div>
          <span className="text-[10px] text-slate-400">Paused: CAC / client</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Balanced Capacity</p>
          <div className="text-2xl font-bold text-blue-600 mt-0.5">{teamSummary.balancedStaffCount}</div>
          <span className="text-[10px] text-slate-400">50-100% capacity</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Overloaded Staff</p>
          <div className="text-2xl font-bold text-rose-600 mt-0.5">{teamSummary.overloadedStaffCount}</div>
          <span className="text-[10px] text-slate-400">&gt; 100% workload limit</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4">
        {[
          { id: "team", label: "Team Workload & Distribution" },
          { id: "turnaround", label: "Service Turnaround & SLA Pauses" },
          { id: "individual", label: "Staff Scorecards & Capacity" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-semibold border-b-2 transition ${
              activeTab === tab.id
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: TEAM WORKLOAD DISTRIBUTION */}
      {activeTab === "team" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Workload Distribution</h3>
            <span className="text-xs text-slate-400">Target capacity: 15 active tasks per officer</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Staff Officer</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Active Tasks</th>
                  <th className="py-3 px-4">Weighted Points</th>
                  <th className="py-3 px-4">Overdue</th>
                  <th className="py-3 px-4">Capacity Utilization</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {visibleStaffMetrics.map((m) => (
                  <tr key={m.staffId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{m.staffName}</td>
                    <td className="py-3 px-4 capitalize text-slate-500">{m.role.replace(/_/g, " ")}</td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{m.activeTasksCount}</td>
                    <td className="py-3 px-4 font-bold text-amber-600">{m.weightedWorkloadPoints} pts</td>
                    <td className="py-3 px-4 font-bold text-rose-500">{m.overdueTasksCount}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              m.workloadUtilizationPct > 100
                                ? "bg-rose-500"
                                : m.workloadUtilizationPct >= 50
                                ? "bg-emerald-500"
                                : "bg-blue-400"
                            }`}
                            style={{ width: `${Math.min(100, m.workloadUtilizationPct)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                          {m.workloadUtilizationPct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.isOverCapacity
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                            : m.workloadUtilizationPct >= 50
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                        }`}
                      >
                        {m.isOverCapacity ? "Overloaded" : m.workloadUtilizationPct >= 50 ? "Balanced" : "Available Capacity"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE TURNAROUND & SLA PAUSES */}
      {activeTab === "turnaround" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Service Turnaround & SLA Segmentation</h3>
              <p className="text-xs text-slate-500">
                Separating active processing time under ABLEBIZ control from paused external authority and client wait intervals.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {turnarounds.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No service requests recorded.</div>
            ) : (
              turnarounds.slice(0, 15).map((r) => (
                <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{r.service_name || "Service Request"}</h4>
                    <p className="text-slate-500 text-[11px]">Request #{r.id.slice(0, 8)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Internal Time</span>
                      <strong className="text-emerald-600">{r.internalStaffHours} hrs</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Client Wait (Paused)</span>
                      <strong className="text-slate-600 dark:text-slate-300">{r.clientWaitHours} hrs</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">CAC / FIRS Wait (Paused)</span>
                      <strong className="text-slate-600 dark:text-slate-300">{r.externalAuthorityWaitHours} hrs</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Elapsed</span>
                      <strong className="text-slate-800 dark:text-slate-200">{r.totalElapsedHours} hrs</strong>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.isCompletedWithinTarget ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {r.isCompletedWithinTarget ? "Within SLA" : "Exceeded Target"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STAFF SCORECARDS & CAPACITY */}
      {activeTab === "individual" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleStaffMetrics.map((m) => (
            <div
              key={m.staffId}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{m.staffName}</h4>
                  <p className="text-xs text-slate-500 capitalize">{m.role.replace(/_/g, " ")} • {m.department}</p>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    m.isOverCapacity ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {m.workloadUtilizationPct}% Capacity
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 text-[10px] block">Active Tasks</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-bold">{m.activeTasksCount}</strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 text-[10px] block">Overdue Tasks</span>
                  <strong className="text-rose-500 font-bold">{m.overdueTasksCount}</strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 text-[10px] block">Weighted Points</span>
                  <strong className="text-amber-600 font-bold">{m.weightedWorkloadPoints}</strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 text-[10px] block">Avg Internal SLA</span>
                  <strong className="text-emerald-600 font-bold">{m.averageInternalTurnaroundDays}d</strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 text-[10px] block">Quality Passed</span>
                  <strong className="text-blue-600 font-bold">{m.qualityReviewsPassed}</strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 text-[10px] block">Attended Days</span>
                  <strong className="text-slate-700 dark:text-slate-300 font-bold">{m.attendedDaysCount}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
