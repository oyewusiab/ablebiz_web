import { useEffect, useState, useMemo } from "react";
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
  AlertTriangle,
  RotateCw,
  Building2,
  Briefcase,
  FileText,
  UserCheck,
  ShieldAlert,
  ArrowUpRight,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { calculateSlaStatus } from "../../lib/sla/slaEngine";
import { triggerOnTaskOverdue } from "../../lib/automation/workflowEngine";

export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  service_request_id?: string | null;
  cac_application_id?: string | null;
  client_id?: string | null;
  business_id?: string | null;
  lead_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  category?: string;
  source?: string;
  priority: string;
  status: string;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  is_escalated?: boolean;
  escalated_at?: string | null;
  escalation_notes?: string | null;
  notes?: string | null;
  created_at: string;
  assigned_staff?: { full_name: string; email: string; department?: string; role?: string };
  client?: { full_name: string; phone?: string };
  business?: { name: string };
  service_request?: { tracking_code: string };
}

export function TasksPage() {
  const { profile, hasPermission } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [businessesList, setBusinessesList] = useState<any[]>([]);
  const [serviceRequestsList, setServiceRequestsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: my_tasks, team_tasks, overdue, upcoming, completed
  const [activeTab, setActiveTab] = useState<"my_tasks" | "team_tasks" | "overdue" | "upcoming" | "completed">("my_tasks");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assignedStaffFilter, setAssignedStaffFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Create Task Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "general",
    assigned_to: "",
    client_id: "",
    business_id: "",
    service_request_id: "",
    priority: "normal",
    start_date: new Date().toISOString().split("T")[0],
    due_date: "",
    status: "todo",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Task Comments / Details Drawer
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Reassign Modal State (for managers)
  const [reassigningStaffId, setReassigningStaffId] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);

  const canCreate = hasPermission("operations", "create");
  const canEdit = hasPermission("operations", "edit");
  const isManager =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "operations_manager";

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [tasksRes, staffRes, clientsRes, bizRes, srRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(`
            *,
            assigned_staff:staff_profiles!tasks_assigned_to_fkey(full_name, email, department, role),
            client:clients(full_name, phone),
            business:businesses(name),
            service_request:service_requests(tracking_code)
          `)
          .order("due_date", { ascending: true }),
        supabase.from("staff_profiles").select("id, full_name, role, department").eq("is_active", true),
        supabase.from("clients").select("id, full_name").eq("is_active", true).order("full_name"),
        supabase.from("businesses").select("id, name, client_id").order("name"),
        supabase.from("service_requests").select("id, tracking_code, client_id").order("created_at", { ascending: false }),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data as any[]);
      if (staffRes.data) setStaffList(staffRes.data);
      if (clientsRes.data) setClientsList(clientsRes.data);
      if (bizRes.data) setBusinessesList(bizRes.data);
      if (srRes.data) setServiceRequestsList(srRes.data);
    } catch (err) {
      console.error("[Tasks] Fetch error:", err);
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
      setReassigningStaffId(selectedTask.assigned_to || "");
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
          category: formData.category,
          assigned_to: formData.assigned_to || null,
          client_id: formData.client_id || null,
          business_id: formData.business_id || null,
          service_request_id: formData.service_request_id || null,
          created_by: profile?.id,
          priority: formData.priority,
          status: formData.status || "todo",
          start_date: formData.start_date ? new Date(formData.start_date).toISOString() : new Date().toISOString(),
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
          notes: formData.notes.trim() || null,
          source: "manual",
        })
        .select()
        .single();

      if (error) throw error;

      // Activity timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "task",
        entity_id: data.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "task_created",
        event_title: `Task assigned: ${data.title}`,
      });

      // Notify assigned staff
      if (formData.assigned_to && formData.assigned_to !== profile?.id) {
        await supabase.from("notifications").insert({
          recipient_staff_id: formData.assigned_to,
          title: "New Operational Task Assigned",
          message: `You were assigned the task: ${data.title}`,
          link: "/admin/tasks",
          priority: formData.priority as any,
          is_read: false,
        });
      }

      setIsCreateOpen(false);
      setFormData({
        title: "",
        description: "",
        category: "general",
        assigned_to: "",
        client_id: "",
        business_id: "",
        service_request_id: "",
        priority: "normal",
        start_date: new Date().toISOString().split("T")[0],
        due_date: "",
        status: "todo",
        notes: "",
      });
      await fetchData();
    } catch (err: any) {
      alert("Failed to create task: " + (err?.message || "Unknown error"));
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

  const handleReassignStaff = async () => {
    if (!supabase || !isManager || !selectedTask) return;
    setIsReassigning(true);
    try {
      await supabase
        .from("tasks")
        .update({
          assigned_to: reassigningStaffId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTask.id);

      if (reassigningStaffId) {
        await supabase.from("notifications").insert({
          recipient_staff_id: reassigningStaffId,
          title: "Task Reassigned to You",
          message: `The task "${selectedTask.title}" has been reassigned to you by management.`,
          link: "/admin/tasks",
          priority: selectedTask.priority as any,
          is_read: false,
        });
      }

      await fetchData();
      setSelectedTask((prev) => (prev ? { ...prev, assigned_to: reassigningStaffId } : null));
      alert("Task reassigned successfully.");
    } catch (err: any) {
      alert("Reassignment failed: " + (err?.message || "Unknown error"));
    } finally {
      setIsReassigning(false);
    }
  };

  const handleEscalateTask = async (task: TaskRecord) => {
    if (!supabase) return;
    try {
      await triggerOnTaskOverdue({
        task,
        actorStaffId: profile?.id,
      });
      await fetchData();
      alert("Task has been escalated to Operations Management for review.");
    } catch (err: any) {
      alert("Escalation failed: " + (err?.message || "Unknown error"));
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

  // Workload analysis for managers
  const staffWorkload = useMemo(() => {
    const map: Record<string, { staff: any; totalOpen: number; overdue: number }> = {};
    staffList.forEach((s) => {
      map[s.id] = { staff: s, totalOpen: 0, overdue: 0 };
    });

    const now = new Date();
    tasks.forEach((t) => {
      if (t.assigned_to && map[t.assigned_to]) {
        if (t.status !== "completed" && t.status !== "cancelled") {
          map[t.assigned_to].totalOpen++;
          if (t.due_date && new Date(t.due_date) < now) {
            map[t.assigned_to].overdue++;
          }
        }
      }
    });

    return Object.values(map);
  }, [staffList, tasks]);

  // Tab Filtering
  const tabFilteredTasks = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    return tasks.filter((t) => {
      const isCompleted = t.status === "completed";
      const isCancelled = t.status === "cancelled";
      const isOverdue = t.due_date ? new Date(t.due_date) < now && !isCompleted && !isCancelled : false;

      switch (activeTab) {
        case "my_tasks":
          return t.assigned_to === profile?.id && !isCompleted && !isCancelled;
        case "team_tasks":
          return !isCompleted && !isCancelled;
        case "overdue":
          return isOverdue;
        case "upcoming":
          return (
            !isCompleted &&
            !isCancelled &&
            t.due_date &&
            new Date(t.due_date) >= now &&
            new Date(t.due_date) <= sevenDaysLater
          );
        case "completed":
          return isCompleted;
        default:
          return true;
      }
    });
  }, [tasks, activeTab, profile?.id]);

  // Secondary Filters
  const filteredTasks = useMemo(() => {
    return tabFilteredTasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assigned_staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.business?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      const matchesStaff = assignedStaffFilter === "all" || t.assigned_to === assignedStaffFilter;
      const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesStaff && matchesCategory;
    });
  }, [tabFilteredTasks, searchTerm, statusFilter, priorityFilter, assignedStaffFilter, categoryFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "todo":
        return <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold">Not Started</span>;
      case "in_progress":
        return <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">In Progress</span>;
      case "awaiting_client":
        return <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">Waiting for Client</span>;
      case "review":
        return <span className="rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[10px] font-bold">Internal Review</span>;
      case "completed":
        return <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">Completed</span>;
      case "cancelled":
        return <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-bold">Cancelled</span>;
      default:
        return <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Urgent</span>;
      case "high":
        return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">High</span>;
      case "normal":
        return <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Normal</span>;
      default:
        return <span className="text-[10px] text-slate-500">{priority}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Task Management & Team Workload</h1>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-[#0A2558]">
              Operational Execution
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Intelligent task distribution, statutory deadline tracking, client follow-up sequences, and team accountability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("my_tasks")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === "my_tasks"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>My Tasks</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px]">
            {tasks.filter((t) => t.assigned_to === profile?.id && t.status !== "completed" && t.status !== "cancelled").length}
          </span>
        </button>

        {isManager && (
          <button
            onClick={() => setActiveTab("team_tasks")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "team_tasks"
                ? "border-[#0A2558] text-[#0A2558]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Team Tasks & Workload</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px]">
              {tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("overdue")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === "overdue"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>Overdue Tasks</span>
          <span className="rounded-full bg-rose-50 text-rose-700 px-1.5 py-0.2 text-[10px] font-bold">
            {
              tasks.filter(
                (t) =>
                  t.due_date &&
                  new Date(t.due_date) < new Date() &&
                  t.status !== "completed" &&
                  t.status !== "cancelled"
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setActiveTab("upcoming")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === "upcoming"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Due This Week</span>
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === "completed"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Completed ({tasks.filter((t) => t.status === "completed").length})</span>
        </button>
      </div>

      {/* Manager Workload Section (Shown on Team Tasks Tab) */}
      {activeTab === "team_tasks" && isManager && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Officer Workload & Capacity Overview</h3>
              <p className="text-[11px] text-slate-500">Live active task count across departments for balanced delegation.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {staffWorkload.map(({ staff, totalOpen, overdue }) => (
              <div
                key={staff.id}
                onClick={() => setAssignedStaffFilter(staff.id)}
                className={`cursor-pointer rounded-xl border p-3 transition hover:border-[#0A2558] ${
                  assignedStaffFilter === staff.id ? "border-[#0A2558] bg-blue-50/50" : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">{staff.full_name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{staff.role.replace(/_/g, " ")}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Open Tasks: <strong className="text-slate-900">{totalOpen}</strong></span>
                  {overdue > 0 ? (
                    <span className="text-rose-600 font-bold">{overdue} overdue</span>
                  ) : (
                    <span className="text-emerald-700 font-semibold">On schedule</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks, client name, business entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0A2558] focus:outline-none focus:ring-1 focus:ring-[#0A2558] transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="todo">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_client">Waiting for Client</option>
            <option value="review">Internal Review</option>
            <option value="completed">Completed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Assigned Staff Filter */}
          {isManager && (
            <select
              value={assignedStaffFilter}
              onChange={(e) => setAssignedStaffFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Assigned Officers</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          )}

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="filing">Filing & CAC</option>
            <option value="document_collection">Document Collection</option>
            <option value="compliance_review">Compliance Review</option>
            <option value="payment_follow_up">Payment Follow-Up</option>
            <option value="post_service_followup">Post-Service Follow-Up</option>
            <option value="general">General</option>
          </select>

          {(statusFilter !== "all" || priorityFilter !== "all" || assignedStaffFilter !== "all" || categoryFilter !== "all" || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setAssignedStaffFilter("all");
                setCategoryFilter("all");
                setSearchTerm("");
              }}
              className="text-xs font-semibold text-[#0A2558] hover:underline whitespace-nowrap px-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Task List Grid / Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
          <RotateCw className="h-5 w-5 animate-spin mr-2" />
          Loading tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center bg-white">
          <CheckSquare className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-2 text-sm font-bold text-slate-900">No tasks found</h3>
          <p className="mt-1 text-xs text-slate-500">
            {activeTab === "overdue"
              ? "All deadlines are currently on track! No overdue tasks."
              : "No tasks match your selected view or filter criteria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredTasks.map((task) => {
            const sla = calculateSlaStatus({
              startDate: task.start_date || task.created_at,
              targetCompletionDate: task.due_date,
              completedAt: task.completed_at,
              status: task.status,
            });

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`cursor-pointer rounded-2xl border p-4.5 transition hover:border-[#0A2558] hover:shadow-xs bg-white ${
                  task.is_escalated ? "border-rose-200 bg-rose-50/20" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}

                      {task.category && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded capitalize">
                          {task.category.replace(/_/g, " ")}
                        </span>
                      )}

                      {task.source === "automation" && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Automated Rule
                        </span>
                      )}

                      {task.is_escalated && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          Escalated to Management
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 hover:text-[#0A2558] transition">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-500">
                      {task.client && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Users className="h-3 w-3 text-slate-400" />
                          {task.client.full_name}
                        </span>
                      )}

                      {task.business && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {task.business.name}
                        </span>
                      )}

                      {task.service_request && (
                        <span className="flex items-center gap-1 text-[#0A2558] font-semibold">
                          <Briefcase className="h-3 w-3 text-[#0A2558]" />
                          {task.service_request.tracking_code}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-slate-400" />
                        Assigned: <strong>{task.assigned_staff?.full_name || "Unassigned Queue"}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Deadline & SLA Column */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        sla.status === "overdue"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : sla.status === "due_soon"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : sla.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {sla.remainingText}
                    </span>

                    {task.due_date && (
                      <span className="text-[10px] text-slate-400">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}

                    {/* Quick status dropdown */}
                    {canEdit && (
                      <select
                        value={task.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                        className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 focus:outline-none hover:border-[#0A2558]"
                      >
                        <option value="todo">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="awaiting_client">Waiting for Client</option>
                        <option value="review">Internal Review</option>
                        <option value="completed">Mark Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Details & Comments Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="p-6 space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedTask.status)}
                    {getPriorityBadge(selectedTask.priority)}
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-2">{selectedTask.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Description & Notes */}
              {selectedTask.description && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-400 text-[10px] uppercase block mb-1">Details</span>
                  {selectedTask.description}
                </div>
              )}

              {/* Particulars Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-100 p-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Client</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {selectedTask.client?.full_name || "Not linked"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Business</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {selectedTask.business?.name || "Not linked"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Assigned Officer</span>
                  <p className="font-semibold text-[#0A2558] mt-0.5">
                    {selectedTask.assigned_staff?.full_name || "Unassigned"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Target Due Date</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : "No deadline set"}
                  </p>
                </div>
              </div>

              {/* Manager Reassign Control */}
              {isManager && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs space-y-2">
                  <span className="font-bold text-[#0A2558] text-[11px] block">Manager Delegation Control</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={reassigningStaffId}
                      onChange={(e) => setReassigningStaffId(e.target.value)}
                      className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="">Select Officer...</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.role.replace(/_/g, " ")})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleReassignStaff}
                      disabled={isReassigning || reassigningStaffId === selectedTask.assigned_to}
                      className="h-8 rounded-lg bg-[#0A2558] px-3 text-xs font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                    >
                      {isReassigning ? "Updating..." : "Reassign"}
                    </button>
                  </div>
                </div>
              )}

              {/* Escalation Control */}
              {!selectedTask.is_escalated && selectedTask.status !== "completed" && (
                <div className="pt-2">
                  <button
                    onClick={() => handleEscalateTask(selectedTask)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:underline"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>Send to Manager for Attention (Escalate Overdue)</span>
                  </button>
                </div>
              )}

              {/* Comments Section */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                  <span>Activity Notes & Team Comments ({comments.length})</span>
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No notes added to this task yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <strong className="text-slate-700">{c.staff?.full_name || "Staff"}</strong>
                          <span>{new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-slate-800">{c.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add an internal note or progress update..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="h-8 flex-1 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0A2558]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="h-8 rounded-xl bg-[#0A2558] px-3 text-xs font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>

              {canEdit && selectedTask.status !== "completed" && (
                <button
                  onClick={() => handleUpdateStatus(selectedTask.id, "completed")}
                  className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Task Creation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Create Operational Task</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verify director identification documents for ABC Limited"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Specific requirements, statutory guidelines, or instructions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Task Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="general">General</option>
                    <option value="filing">Filing & CAC</option>
                    <option value="document_collection">Document Collection</option>
                    <option value="compliance_review">Compliance Review</option>
                    <option value="payment_follow_up">Payment Follow-Up</option>
                    <option value="post_service_followup">Post-Service Follow-Up</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Related Client</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="">Select Client (Optional)...</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Assigned Officer</label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="">Unassigned Queue</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
