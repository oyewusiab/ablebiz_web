import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  ExternalLink,
  ShieldAlert,
  Settings2,
  Search,
  Filter,
  Layers,
  Sparkles,
  Zap,
  Save,
  Play,
  RotateCcw,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchStaffNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  fetchStaffPreferences,
  updateStaffPreferences,
  fetchEscalationRules,
  saveEscalationRule,
  fetchEscalationLogs,
  evaluateOperationalEscalations,
  DEFAULT_CATEGORIES,
} from "../../lib/notifications/notificationService";
import type {
  SuiteNotification,
  StaffNotificationPreference,
  EscalationRule,
  EscalationLog,
  NotificationCategory,
} from "../../types/suitePhases15To19";

export function NotificationsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"inbox" | "preferences" | "escalation">("inbox");
  const [notifications, setNotifications] = useState<SuiteNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Staff Preferences
  const [prefs, setPrefs] = useState<StaffNotificationPreference | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);

  // Escalation Engine (Management only)
  const isManagement =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "operations_manager";

  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [logs, setLogs] = useState<EscalationLog[]>([]);
  const [runningEscalation, setRunningEscalation] = useState(false);
  const [escalationResult, setEscalationResult] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
      loadPreferences();
      if (isManagement) {
        loadEscalationData();
      }
    }
  }, [profile?.id, categoryFilter, filter]);

  const loadNotifications = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const data = await fetchStaffNotifications(
        profile.id,
        categoryFilter,
        filter === "unread"
      );
      setNotifications(data);
    } catch (err) {
      console.error("[Notifications] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    if (!profile?.id) return;
    try {
      const data = await fetchStaffPreferences(profile.id);
      setPrefs(data);
    } catch (err) {
      console.error("[Notifications] Preferences load error:", err);
    }
  };

  const loadEscalationData = async () => {
    try {
      const [rulesList, logsList] = await Promise.all([
        fetchEscalationRules(),
        fetchEscalationLogs(),
      ]);
      setRules(rulesList);
      setLogs(logsList);
    } catch (err) {
      console.error("[Notifications] Escalation load error:", err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const ok = await markNotificationAsRead(id);
    if (ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile?.id) return;
    const ok = await markAllNotificationsAsRead(profile.id);
    if (ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !prefs) return;
    setSavingPrefs(true);
    setPrefsMessage(null);

    try {
      await updateStaffPreferences({
        ...prefs,
        staff_id: profile.id,
      });
      setPrefsMessage("Your notification preferences have been saved successfully.");
    } catch (err: any) {
      setPrefsMessage(err.message || "Failed to save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleRunEscalationCycle = async () => {
    setRunningEscalation(true);
    setEscalationResult(null);
    try {
      const res = await evaluateOperationalEscalations();
      setEscalationResult(
        `Escalation check complete: evaluated ${res.evaluated} pending records and triggered ${res.escalationsTriggered} notifications.`
      );
      loadNotifications();
      loadEscalationData();
    } catch (err: any) {
      setEscalationResult(err.message || "Escalation check encountered an issue.");
    } finally {
      setRunningEscalation(false);
    }
  };

  const toggleCategorySubscription = (cat: NotificationCategory) => {
    if (!prefs) return;
    const current = prefs.subscribed_categories || [];
    const exists = current.includes(cat);
    const updated = exists ? current.filter((c) => c !== cat) : [...current, cat];
    setPrefs({ ...prefs, subscribed_categories: updated });
  };

  const filteredNotifications = notifications.filter((n) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q) ||
      (n.category && n.category.toLowerCase().includes(q));

    if (filter === "unread") return !n.is_read && matchesSearch;
    return matchesSearch;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200 shadow-2xs">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Notifications & Escalation Engine</h1>
              <p className="text-xs text-slate-500">
                Operational dispatch, task deadline escalations, financial approvals, and continuity alerts
              </p>
            </div>
          </div>
        </div>

        {activeTab === "inbox" && unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("inbox")}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === "inbox"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          My Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ""}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === "preferences"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Notification Preferences
        </button>
        {isManagement && (
          <button
            type="button"
            onClick={() => setActiveTab("escalation")}
            className={`pb-2.5 text-xs font-bold transition border-b-2 ${
              activeTab === "escalation"
                ? "border-[#0A2558] text-[#0A2558]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Escalation Engine & Rules ({rules.length})
          </button>
        )}
      </div>

      {/* Tab 1: Inbox */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  filter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  filter === "unread" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Unread Only ({unreadCount})
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All Categories</option>
                <option value="tasks">Tasks & SLA</option>
                <option value="approvals">Approvals</option>
                <option value="finance">Finance & Receipts</option>
                <option value="quotations">Quotations</option>
                <option value="cac">CAC Operations</option>
                <option value="backup">Backup & Continuity</option>
                <option value="appointments">Appointments</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0A2558]"
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400">
                <Bell className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                No notifications found. You're completely up to date!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 transition flex items-start justify-between gap-4 text-xs ${
                      n.is_read ? "bg-white hover:bg-slate-50/60" : "bg-blue-50/30 hover:bg-blue-50/60 border-l-2 border-[#0A2558]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                          n.is_read ? "bg-slate-300" : "bg-[#0A2558]"
                        }`}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">{n.title}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              n.priority === "urgent"
                                ? "bg-red-100 text-red-800"
                                : n.priority === "high"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {n.priority}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 capitalize">
                            {n.category}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 leading-relaxed">{n.message}</p>
                        <span className="mt-1.5 block text-[10px] text-slate-400">
                          {new Date(n.created_at).toLocaleString("en-GB")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {n.link && (
                        <Link
                          to={n.link}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-[#0A2558] hover:text-[#0A2558] transition"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(n.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Preferences */}
      {activeTab === "preferences" && prefs && (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Staff Notification Preferences</h2>
            <p className="text-xs text-slate-500">Configure how and when you receive operational alerts.</p>
          </div>

          {prefsMessage && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-medium text-blue-900">
              {prefsMessage}
            </div>
          )}

          <form onSubmit={handleSavePreferences} className="space-y-5 text-xs">
            {/* Channels */}
            <div className="space-y-3">
              <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">Active Notification Channels</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.in_app_enabled}
                    onChange={(e) => setPrefs({ ...prefs, in_app_enabled: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">In-App Notification Center & Bell</span>
                    <span className="text-[11px] text-slate-500">Instant notification badges and panel inside ABLEBIZ Suite.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.email_enabled}
                    onChange={(e) => setPrefs({ ...prefs, email_enabled: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Email Alerts (hello@ablebiz.com.ng)</span>
                    <span className="text-[11px] text-slate-500">Official email dispatch for urgent task escalations and approvals.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.whatsapp_enabled}
                    onChange={(e) => setPrefs({ ...prefs, whatsapp_enabled: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">WhatsApp Click-to-Chat Quick Links</span>
                    <span className="text-[11px] text-slate-500">Prepare direct operator WhatsApp links for fast communication.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Subscribed Categories */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">Subscribed Categories</span>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={prefs.subscribed_categories.includes(cat)}
                      onChange={() => toggleCategorySubscription(cat)}
                      className="rounded border-slate-300"
                    />
                    <span className="capitalize font-medium text-slate-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Frequency & Quiet Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reminder Frequency:</label>
                <select
                  value={prefs.reminder_frequency}
                  onChange={(e) => setPrefs({ ...prefs, reminder_frequency: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                >
                  <option value="immediate">Immediate as events occur</option>
                  <option value="hourly">Hourly Digest</option>
                  <option value="daily">Daily Morning Digest (08:00)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    id="quietHours"
                    checked={prefs.quiet_hours_enabled}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_enabled: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="quietHours" className="font-semibold text-slate-700">Enable Quiet Hours</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    disabled={!prefs.quiet_hours_enabled}
                    value={prefs.quiet_hours_start || "20:00"}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                    className="w-1/2 rounded-lg border border-slate-200 p-2 text-xs disabled:opacity-50"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="time"
                    disabled={!prefs.quiet_hours_enabled}
                    value={prefs.quiet_hours_end || "07:00"}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                    className="w-1/2 rounded-lg border border-slate-200 p-2 text-xs disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingPrefs}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-5 py-2 font-semibold text-white shadow-xs hover:bg-[#061738] disabled:opacity-50 transition"
              >
                <Save className="h-4 w-4" />
                <span>{savingPrefs ? "Saving..." : "Save Preferences"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Escalation Engine (Management only) */}
      {activeTab === "escalation" && isManagement && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active Operational Escalation Policies</h2>
              <p className="text-xs text-slate-500">
                Automated escalation triggers when tasks, approvals, complaints, or backups exceed commitment windows
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunEscalationCycle}
              disabled={runningEscalation}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#061738] disabled:opacity-50 transition"
            >
              <Zap className="h-4 w-4 text-amber-400" />
              <span>{runningEscalation ? "Evaluating..." : "Run Escalation Check Now"}</span>
            </button>
          </div>

          {escalationResult && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-medium text-blue-900">
              {escalationResult}
            </div>
          )}

          {/* Rules Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Configured Escalation Rules</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">Rule Name</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Threshold</th>
                    <th className="py-2.5 px-3">Responsible Role</th>
                    <th className="py-2.5 px-3">Escalate To</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{r.name}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{r.event_type}</td>
                      <td className="py-2.5 px-3">{r.time_threshold_hours} Hours</td>
                      <td className="py-2.5 px-3 capitalize">{r.responsible_role.replace(/_/g, " ")}</td>
                      <td className="py-2.5 px-3 font-medium text-[#0A2558] capitalize">
                        {r.escalate_to_role.replace(/_/g, " ")}
                      </td>
                      <td className="py-2.5 px-3 uppercase">{r.channel}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {r.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Escalation Audit Trail</h3>
            </div>
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No escalations triggered yet. Policies are evaluating pending tasks and approvals smoothly.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {logs.slice(0, 10).map((l) => (
                  <div key={l.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{l.title}</span>
                        <span className="text-[10px] rounded bg-amber-100 px-1.5 py-0.2 font-semibold text-amber-800">
                          Level {l.escalation_level}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">{l.message}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(l.triggered_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
