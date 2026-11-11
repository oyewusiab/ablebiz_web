import { useEffect, useState } from "react";
import {
  Workflow,
  Plus,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Filter,
  Sliders,
  ChevronRight,
  Info,
  X,
  History,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  DEFAULT_WORKFLOW_RULES,
  getWorkflowExecutionLogs,
  getWorkflowRules,
  recordExecutionLog,
  saveWorkflowRule,
  WorkflowExecutionLog,
  WorkflowRule,
  WorkflowTriggerEvent,
} from "../../lib/automation/workflowEngine";

export function WorkflowsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [logs, setLogs] = useState<WorkflowExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<WorkflowRule>>({
    name: "",
    description: "",
    trigger_event: "service_request_created",
    applicable_category: "all",
    action_type: "create_task",
    assignment_rule: "role_workload",
    target_role: "registration_officer",
    due_days: 2,
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const isManager =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "operations_manager";

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesList, logsList] = await Promise.all([
        getWorkflowRules(),
        getWorkflowExecutionLogs(),
      ]);
      setRules(rulesList);
      setLogs(logsList);
    } catch (err) {
      console.error("[WorkflowsPage] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleRule = async (rule: WorkflowRule) => {
    if (!isManager) return;
    try {
      const updated = await saveWorkflowRule({
        ...rule,
        is_active: !rule.is_active,
      });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: any) {
      alert("Failed to update workflow rule: " + (err?.message || "Unknown error"));
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager || !formData.name?.trim()) return;

    setIsSubmitting(true);
    setStatusMsg("");
    try {
      const saved = await saveWorkflowRule(formData);
      setRules((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setIsModalOpen(false);
      setFormData({
        name: "",
        description: "",
        trigger_event: "service_request_created",
        applicable_category: "all",
        action_type: "create_task",
        assignment_rule: "role_workload",
        target_role: "registration_officer",
        due_days: 2,
        is_active: true,
      });
      setStatusMsg("Workflow rule saved successfully.");
    } catch (err: any) {
      alert("Failed to save rule: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryFailedLog = async (log: WorkflowExecutionLog) => {
    if (!isManager) return;
    try {
      await recordExecutionLog({
        idempotency_key: `${log.idempotency_key}_retry_${Date.now()}`,
        rule_id: log.rule_id,
        trigger_event: log.trigger_event,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        action_taken: `Manual retry for: ${log.action_taken}`,
        status: "retried",
        details: { originalLogId: log.id },
      });
      await loadData();
      alert("Activity was re-evaluated successfully.");
    } catch (err: any) {
      alert("Retry failed: " + (err?.message || "Unknown error"));
    }
  };

  const getTriggerLabel = (event: WorkflowTriggerEvent | string) => {
    switch (event) {
      case "service_request_created":
        return "When New Service Request is Submitted";
      case "missing_client_info":
        return "When Information or Documents are Missing";
      case "payment_verified":
        return "When Invoice Payment is Verified";
      case "cac_stage_changed":
        return "When CAC Application Changes Stage";
      case "service_completed":
        return "When Service is Officially Completed";
      case "task_overdue":
        return "When Operational Task Becomes Overdue";
      default:
        return event.replace(/_/g, " ");
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "create_task":
        return "Create Operational Task";
      case "create_follow_up":
        return "Schedule Client Follow-Up";
      case "notify_officer":
        return "Notify Assigned Officer";
      case "escalate_to_manager":
        return "Send to Manager for Attention";
      default:
        return action.replace(/_/g, " ");
    }
  };

  const getRoleLabel = (role?: string | null) => {
    switch (role) {
      case "registration_officer":
        return "Compliance & Registration Officer";
      case "accounts_officer":
        return "Accountant / Finance Officer";
      case "client_service_officer":
        return "Receptionist / Client Support";
      case "operations_manager":
        return "Operations Manager";
      case "super_admin":
        return "Managing Director";
      default:
        return role ? role.replace(/_/g, " ") : "Workload-Balanced Team";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workflows & Operational Automation</h1>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-[#0A2558]">
              Automated Business Rules
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Configure automated actions, intelligent staff assignment, and operational follow-ups triggered by business events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add Workflow Rule</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === "rules"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Active Rules ({rules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === "history"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Activity Processing Log ({logs.length})</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
          <RotateCw className="h-5 w-5 animate-spin mr-2" />
          Loading workflow rules...
        </div>
      ) : activeTab === "rules" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`rounded-2xl border p-5 transition flex flex-col justify-between ${
                  rule.is_active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-75"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-lg bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#0A2558]">
                      {getTriggerLabel(rule.trigger_event)}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.is_active}
                        onChange={() => handleToggleRule(rule)}
                        disabled={!isManager}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-slate-900">{rule.name}</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {rule.description || "Operational activity rule triggered upon verified business events."}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Required Action:</span>
                      <span className="font-semibold text-slate-800">{getActionLabel(rule.action_type)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Who Should Handle This:</span>
                      <span className="font-semibold text-[#0A2558]">
                        {rule.assignment_rule === "role_workload"
                          ? `Workload Balance (${getRoleLabel(rule.target_role)})`
                          : getRoleLabel(rule.target_role)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Completion Target:</span>
                      <span className="font-semibold text-slate-800">{rule.due_days} business day(s)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      rule.is_active ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${rule.is_active ? "bg-emerald-600" : "bg-slate-300"}`} />
                    {rule.is_active ? "Active" : "Inactive"}
                  </span>

                  {isManager && (
                    <button
                      onClick={() => {
                        setFormData(rule);
                        setIsModalOpen(true);
                      }}
                      className="text-xs font-semibold text-[#0A2558] hover:underline"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Activity Processing Log Tab */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Activity Processing History</h3>
              <p className="text-[11px] text-slate-500">
                Audit trail of automated business events, duplicate prevention checks, and execution status.
              </p>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No automated activities recorded yet. Business events will appear here when triggered.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          log.status === "success"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : log.status === "retried"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {log.status === "success" ? "Completed" : log.status === "retried" ? "Retried" : "Could Not Complete"}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{log.action_taken}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Event: {getTriggerLabel(log.trigger_event)}</span>
                      <span>•</span>
                      <span>Recorded: {new Date(log.created_at).toLocaleString()}</span>
                      {log.error_message && (
                        <>
                          <span>•</span>
                          <span className="text-rose-600 font-medium">{log.error_message}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {log.status === "failed" && isManager && (
                    <button
                      onClick={() => handleRetryFailedLog(log)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0A2558] hover:bg-blue-50 transition shrink-0"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Workflow Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {formData.id ? "Configure Workflow Rule" : "Create New Workflow Rule"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Incorporation Intake Task"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Explain what this automated rule accomplishes..."
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">When This Happens (Trigger Event) *</label>
                <select
                  value={formData.trigger_event || "service_request_created"}
                  onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value as WorkflowTriggerEvent })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                >
                  <option value="service_request_created">When a client submits a new service request</option>
                  <option value="missing_client_info">When registration info or documents are missing</option>
                  <option value="payment_verified">When an invoice payment is verified</option>
                  <option value="cac_stage_changed">When a CAC application advances to a new stage</option>
                  <option value="service_completed">When a service is officially completed</option>
                  <option value="task_overdue">When an operational task passes its deadline</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Required Action *</label>
                  <select
                    value={formData.action_type || "create_task"}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value as any })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="create_task">Create Operational Task</option>
                    <option value="create_follow_up">Schedule Client Follow-Up</option>
                    <option value="notify_officer">Notify Assigned Officer</option>
                    <option value="escalate_to_manager">Send to Manager for Attention</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Target Role *</label>
                  <select
                    value={formData.target_role || "registration_officer"}
                    onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="registration_officer">Compliance & Registration Officer</option>
                    <option value="accounts_officer">Accountant / Finance Officer</option>
                    <option value="client_service_officer">Receptionist / Client Support</option>
                    <option value="operations_manager">Operations Manager</option>
                    <option value="super_admin">Managing Director</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Who Should Handle This</label>
                  <select
                    value={formData.assignment_rule || "role_workload"}
                    onChange={(e) => setFormData({ ...formData, assignment_rule: e.target.value as any })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="role_workload">Lowest Workload in Target Role</option>
                    <option value="service_owner">Current Service / Case Owner</option>
                    <option value="manager_queue">Manager Attention Queue</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Completion Target (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.due_days || 2}
                    onChange={(e) => setFormData({ ...formData, due_days: Number(e.target.value) })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="rule_active"
                  checked={formData.is_active !== false}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-[#0A2558] focus:ring-[#0A2558]"
                />
                <label htmlFor="rule_active" className="font-semibold text-slate-700">
                  Active (enable automated execution for verified events)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
