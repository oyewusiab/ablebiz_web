import { useEffect, useState } from "react";
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  MessageSquare,
  ShieldCheck,
  Send,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  service_request_id?: string | null;
  cac_application_id?: string | null;
  client_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  priority: string;
  status: string;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  assigned_staff?: { full_name: string; email: string };
  client?: { full_name: string };
}

export function TasksPage() {
  const { profile, hasPermission } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Create Task Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    priority: "normal",
    due_date: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Task Comments Drawer
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const canCreate = hasPermission("operations", "create");
  const canEdit = hasPermission("operations", "edit");

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [tasksRes, staffRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, assigned_staff:staff_profiles!tasks_assigned_to_fkey(full_name, email), client:clients(full_name)")
          .order("due_date", { ascending: true }),
        supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data as any[]);
      if (staffRes.data) setStaffList(staffRes.data);
    } catch (err) {
      console.error("[Tasks] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (taskId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("task_comments")
        .select("*, staff:staff_profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      setComments(data || []);
    } catch (err) {
      console.error("[Task Comments] Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      fetchComments(selectedTask.id);
    }
  }, [selectedTask]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate) return;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          assigned_to: formData.assigned_to || null,
          created_by: profile?.id,
          priority: formData.priority,
          status: "todo",
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Log to Activity Timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "task",
        entity_id: data.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "task_created",
        event_title: `Task delegated: ${data.title}`,
      });

      setIsCreateOpen(false);
      setFormData({
        title: "",
        description: "",
        assigned_to: "",
        priority: "normal",
        due_date: "",
      });
      await fetchData();
    } catch (err: any) {
      alert("Failed to create task: " + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, nextStatus: string) => {
    if (!supabase || !canEdit) return;
    try {
      await supabase
        .from("tasks")
        .update({
          status: nextStatus,
          completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      await fetchData();
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err) {
      console.error("[Tasks] Status error:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedTask || !newComment.trim()) return;
    setIsSubmittingComment(true);

    try {
      await supabase.from("task_comments").insert({
        task_id: selectedTask.id,
        staff_id: profile?.id,
        comment: newComment.trim(),
      });
      setNewComment("");
      await fetchComments(selectedTask.id);
    } catch (err) {
      console.error("[Comments] Error:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assigned_staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Operational Tasks</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Task Delegation
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Filing tasks, document collection, compliance reviews, and team responsibility tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#043F2E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#06553F] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks by title, assigned officer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          {["all", "todo", "in_progress", "review", "completed"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#043F2E] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Task List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
              No tasks match this filter.
            </div>
          ) : (
            filteredTasks.map((t) => {
              const isSelected = selectedTask?.id === t.id;
              const isOverdue = t.status !== "completed" && t.due_date && new Date(t.due_date) < new Date();
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-700/30"
                      : "border-slate-200 bg-white hover:border-emerald-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                          t.priority === "urgent"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : t.priority === "high"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {t.priority}
                        </span>
                        {isOverdue && (
                          <span className="rounded bg-red-100 text-red-800 px-1.5 py-0.2 text-[10px] font-bold">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-slate-900">{t.title}</h3>
                      {t.description && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{t.description}</p>}
                    </div>

                    <select
                      value={t.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Officer: {t.assigned_staff?.full_name || "Unassigned"}</span>
                    <span>
                      {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Task Discussion & Comments (5 cols) */}
        <div className="lg:col-span-5">
          {!selectedTask ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-xs text-slate-400">
              Select a task to review description and collaborate in discussion.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden p-5 space-y-4">
              <div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                  {selectedTask.status.replace(/_/g, " ")}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{selectedTask.title}</h3>
                <p className="text-xs text-slate-600 mt-1">{selectedTask.description || "No full description provided."}</p>
              </div>

              {/* Comments Stream */}
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                  Operational Notes & Comments ({comments.length})
                </h4>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No notes posted on this task yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-800">{c.staff?.full_name || "Staff"}</span>
                          <span>{new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-slate-700">{c.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Post Comment Form */}
                <form onSubmit={handleAddComment} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    required
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write operational note..."
                    className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-emerald-600"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment}
                    className="flex items-center justify-center rounded-xl bg-[#043F2E] px-3 text-white hover:bg-[#06553F] transition disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Delegate Operational Task</h2>
            <form onSubmit={handleCreateTask} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Task Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Conduct CAC name availability search"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Assign To Officer</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                >
                  <option value="">-- Unassigned (Pool) --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Instructions / Context</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Task guidance for the officer..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#043F2E] px-4 py-2 font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
