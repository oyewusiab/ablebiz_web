import { useEffect, useState } from "react";
import {
  Clock,
  Plus,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Sliders,
  ShieldAlert,
  Edit2,
  X,
  Info,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  getSlaConfigurations,
  saveSlaConfiguration,
  SlaConfiguration,
  DEFAULT_SLA_CONFIGS,
} from "../../lib/sla/slaEngine";

export function SlaSettingsPage() {
  const { profile } = useAuth();
  const [configs, setConfigs] = useState<SlaConfiguration[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<SlaConfiguration>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isManager =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "operations_manager";

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getSlaConfigurations();
      setConfigs(list);
    } catch (err) {
      console.error("[SLA Settings] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (cfg: SlaConfiguration) => {
    if (!isManager) return;
    try {
      const updated = await saveSlaConfiguration({
        ...cfg,
        is_active: !cfg.is_active,
      });
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err: any) {
      alert("Failed to update SLA setting: " + (err?.message || "Unknown error"));
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager || !editingConfig.service_category?.trim()) return;

    setIsSubmitting(true);
    try {
      const saved = await saveSlaConfiguration(editingConfig);
      setConfigs((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setIsModalOpen(false);
      setEditingConfig({});
    } catch (err: any) {
      alert("Failed to save SLA configuration: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const avgTurnaround =
    configs.length > 0
      ? (
          configs.reduce((acc, c) => acc + Number(c.expected_duration_days || 0), 0) /
          configs.length
        ).toFixed(1)
      : "5.0";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">SLA & Deadline Management</h1>
            <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Operational Standards
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Define expected service delivery timelines, warning alerts, and management escalation rules across all ABLEBIZ services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={() => {
                setEditingConfig({
                  service_category: "",
                  expected_duration_days: 5,
                  time_unit: "days",
                  warning_threshold_pct: 75,
                  escalation_threshold_pct: 100,
                  responsible_department: "Operations",
                  default_priority: "normal",
                  is_active: true,
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Configure Service SLA</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Configured Services</span>
            <Clock className="h-4 w-4 text-[#0A2558]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{configs.length}</div>
          <p className="mt-1 text-[11px] text-slate-500">
            {configs.filter((c) => c.is_active).length} active delivery timelines
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Average Standard Turnaround</span>
            <Sliders className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{avgTurnaround} Days</div>
          <p className="mt-1 text-[11px] text-slate-500">Baseline target across all active offerings</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Warning Threshold</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">75% Consumed</div>
          <p className="mt-1 text-[11px] text-slate-500">Approaching deadline alert triggered</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Escalation Protocol</span>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">100% (Deadline Missed)</div>
          <p className="mt-1 text-[11px] text-slate-500">Operations Manager alerted automatically</p>
        </div>
      </div>

      {/* SLA Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900">Service Turnaround Standards</h3>
            <p className="text-[11px] text-slate-500">
              Timelines represent ABLEBIZ's internal target turnaround for operational execution, client satisfaction, and quality review.
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

        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
            <RotateCw className="h-5 w-5 animate-spin mr-2" />
            Loading SLA configurations...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Service / Category</th>
                  <th className="px-4 py-3">Expected Duration</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Warning Alert</th>
                  <th className="px-4 py-3">Escalation Alert</th>
                  <th className="px-4 py-3">Status</th>
                  {isManager && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{cfg.service_name || cfg.service_category}</div>
                      {cfg.notes && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cfg.notes}</p>}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-bold text-[#0A2558] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        {cfg.expected_duration_days} {cfg.time_unit}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">{cfg.responsible_department}</td>

                    <td className="px-4 py-3.5 text-amber-700 font-semibold">{cfg.warning_threshold_pct}% of duration</td>

                    <td className="px-4 py-3.5 text-rose-700 font-semibold">{cfg.escalation_threshold_pct}% of duration</td>

                    <td className="px-4 py-3.5">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfg.is_active}
                          onChange={() => handleToggleActive(cfg)}
                          disabled={!isManager}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                        <span className="ml-2 text-[11px] font-medium text-slate-600">
                          {cfg.is_active ? "Active" : "Inactive"}
                        </span>
                      </label>
                    </td>

                    {isManager && (
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setEditingConfig(cfg);
                            setIsModalOpen(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-[#0A2558] hover:bg-slate-100 transition"
                          title="Edit SLA Setting"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Create SLA Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingConfig.id ? "Edit Service SLA" : "Configure New Service SLA"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Service or Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Business Name Registration"
                  value={editingConfig.service_category || ""}
                  onChange={(e) => setEditingConfig({ ...editingConfig, service_category: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Expected Duration *</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    required
                    value={editingConfig.expected_duration_days ?? 5}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, expected_duration_days: Number(e.target.value) })
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Time Unit</label>
                  <select
                    value={editingConfig.time_unit || "days"}
                    onChange={(e) => setEditingConfig({ ...editingConfig, time_unit: e.target.value as any })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="days">Business Days</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Warning Alert (%)</label>
                  <input
                    type="number"
                    min={50}
                    max={95}
                    value={editingConfig.warning_threshold_pct ?? 75}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, warning_threshold_pct: Number(e.target.value) })
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Escalation Alert (%)</label>
                  <input
                    type="number"
                    min={90}
                    max={150}
                    value={editingConfig.escalation_threshold_pct ?? 100}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, escalation_threshold_pct: Number(e.target.value) })
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Responsible Department</label>
                <select
                  value={editingConfig.responsible_department || "Legal & Compliance"}
                  onChange={(e) => setEditingConfig({ ...editingConfig, responsible_department: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                >
                  <option value="Legal & Compliance">Legal & Compliance</option>
                  <option value="Operations">Operations</option>
                  <option value="Finance & Accounts">Finance & Accounts</option>
                  <option value="Client Relations">Client Relations</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Operational Notes</label>
                <textarea
                  rows={2}
                  placeholder="Internal notes regarding statutory filing steps or dependencies..."
                  value={editingConfig.notes || ""}
                  onChange={(e) => setEditingConfig({ ...editingConfig, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
                  {isSubmitting ? "Saving..." : "Save SLA Setting"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
