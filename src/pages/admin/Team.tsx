import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  UserCheck,
  UserX,
  Lock,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Eye,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth, type StaffRole, type RolePermissionRule } from "../../auth/AuthContext";
import {
  ROLE_DEFINITIONS,
  normalizeStaffRole,
  getRoleTitle,
  getRoleConfig,
  type CanonicalStaffRole,
} from "../../auth/roleConfig";

export interface StaffProfileRecord {
  id: string;
  auth_uid: string;
  email: string;
  full_name: string;
  role: StaffRole;
  department: string;
  phone?: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

const CANONICAL_ROLES_LIST: CanonicalStaffRole[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "registration_officer",
  "accounts_officer",
  "client_service_officer",
  "marketing_officer",
  "viewer",
];

export function StaffRbacPage() {
  const { profile } = useAuth();
  const [staffList, setStaffList] = useState<StaffProfileRecord[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<RolePermissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"staff" | "rbac_matrix">("staff");

  // Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Role Edit Modal for SuperAdmin
  const [editingStaff, setEditingStaff] = useState<StaffProfileRecord | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<CanonicalStaffRole>("viewer");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const isSuperAdmin = profile?.role === "super_admin" || (profile?.role as string) === "managing_director";

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    setActionError("");
    try {
      const [staffRes, permRes] = await Promise.all([
        supabase
          .from("staff_profiles")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("roles_permissions")
          .select("*")
          .order("role", { ascending: true }),
      ]);

      if (staffRes.data) {
        setStaffList(staffRes.data as StaffProfileRecord[]);
      }
      if (permRes.data) {
        setPermissionsMatrix(permRes.data as RolePermissionRule[]);
      }
    } catch (err) {
      console.error("[StaffRbacPage] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenEdit = (staff: StaffProfileRecord) => {
    if (!isSuperAdmin) return;
    setEditingStaff(staff);
    setSelectedNewRole(normalizeStaffRole(staff.role));
    setSelectedDepartment(staff.department);
    setActionError("");
    setActionSuccess("");
  };

  const handleUpdateStaffRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !isSuperAdmin || !editingStaff) return;

    setIsUpdating(true);
    setActionError("");
    setActionSuccess("");

    try {
      const { error } = await supabase
        .from("staff_profiles")
        .update({
          role: selectedNewRole,
          department: selectedDepartment.trim() || editingStaff.department,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingStaff.id);

      if (error) {
        setActionError(`Database error: ${error.message}`);
      } else {
        // Log to activity timeline
        await supabase.from("activity_timeline").insert({
          entity_type: "staff_profile",
          entity_id: editingStaff.id,
          actor_type: "staff",
          actor_id: profile?.id,
          event_type: "role_updated",
          event_title: `Role updated for ${editingStaff.full_name} to ${getRoleTitle(selectedNewRole)}`,
        });

        setActionSuccess(`Role for ${editingStaff.full_name} updated successfully.`);
        setTimeout(() => {
          setEditingStaff(null);
          setActionSuccess("");
        }, 1200);
        await fetchData();
      }
    } catch (err: any) {
      setActionError(err?.message || "Failed to update staff role.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActiveStatus = async (staff: StaffProfileRecord) => {
    if (!supabase || !isSuperAdmin) return;

    // Prevent deactivating own account
    if (staff.id === profile?.id) {
      alert("You cannot deactivate your own account.");
      return;
    }

    const confirmToggle = window.confirm(
      `Are you sure you want to ${staff.is_active ? "deactivate" : "reactivate"} staff member ${staff.full_name}?`
    );
    if (!confirmToggle) return;

    try {
      const { error } = await supabase
        .from("staff_profiles")
        .update({
          is_active: !staff.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", staff.id);

      if (error) {
        alert(`Failed to update status: ${error.message}`);
      } else {
        await supabase.from("activity_timeline").insert({
          entity_type: "staff_profile",
          entity_id: staff.id,
          actor_type: "staff",
          actor_id: profile?.id,
          event_type: "staff_status_toggled",
          event_title: `Staff ${staff.full_name} status changed to ${!staff.is_active ? "active" : "inactive"}`,
        });
        await fetchData();
      }
    } catch (err: any) {
      alert(err?.message || "Failed to toggle status.");
    }
  };

  const filteredStaff = staffList.filter((staff) => {
    const matchesSearch =
      staff.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (staff.phone && staff.phone.includes(searchQuery)) ||
      staff.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || normalizeStaffRole(staff.role) === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && staff.is_active) ||
      (statusFilter === "inactive" && !staff.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff & Role-Based Access</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Security & Team
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Internal team members, canonical role assignments, and granular system permission enforcement.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("staff")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "staff" ? "bg-[#043F2E] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Staff Directory ({staffList.length})
          </button>
          <button
            onClick={() => setActiveTab("rbac_matrix")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "rbac_matrix" ? "bg-[#043F2E] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            RBAC Permission Matrix
          </button>
        </div>
      </div>

      {/* SuperAdmin Authority Notice */}
      <div className={`rounded-xl border p-4 text-xs ${
        isSuperAdmin
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={`h-5 w-5 shrink-0 ${isSuperAdmin ? "text-emerald-700" : "text-slate-500"}`} />
          <div>
            <span className="font-bold">
              {isSuperAdmin ? "Super Administrator Authority Verified" : "Administrative Read Access Active"}
            </span>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              {isSuperAdmin
                ? "You have full executive authority to assign canonical roles, alter departments, and toggle active/inactive staff states. Changes are enforced directly by PostgreSQL Row-Level Security."
                : "You are currently viewing staff profiles and system permissions under standard administrator policy. Staff role elevations and status changes are reserved for the Managing Director (super_admin)."}
            </p>
          </div>
        </div>
      </div>

      {activeTab === "staff" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, email, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
              >
                <option value="all">All Canonical Roles</option>
                {CANONICAL_ROLES_LIST.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_DEFINITIONS[r].title}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Staff Directory Table */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading staff profiles...</div>
          ) : filteredStaff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <Shield className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
              <p className="text-xs font-semibold text-slate-700">No staff members found</p>
              <p className="text-[11px] text-slate-400 mt-1">Adjust search filters to view staff records.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5">Staff Member</th>
                    <th className="px-4 py-3.5">Assigned Role</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5">Contact</th>
                    <th className="px-4 py-3.5">Status</th>
                    {isSuperAdmin && <th className="px-4 py-3.5 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((st) => {
                    const normRole = normalizeStaffRole(st.role);
                    const cfg = getRoleConfig(normRole);

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs uppercase">
                              {st.full_name?.charAt(0) || "U"}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{st.full_name}</p>
                              <p className="text-[11px] text-slate-400">{st.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-900 block">{cfg.title}</span>
                            <span className="font-mono text-[10px] text-slate-400">{normRole}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {st.department || cfg.department}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                          {st.phone || "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              st.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {st.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEdit(st)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition"
                              >
                                Edit Role
                              </button>
                              <button
                                onClick={() => handleToggleActiveStatus(st)}
                                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                                  st.is_active
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {st.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "rbac_matrix" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900">Canonical Role Architecture & Privileges</h2>
            <p className="mt-1 text-xs text-slate-500">
              Each staff member is assigned exactly one canonical role. Permissions are enforced by PostgreSQL RLS.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {CANONICAL_ROLES_LIST.map((roleKey) => {
                const def = ROLE_DEFINITIONS[roleKey];
                return (
                  <div key={roleKey} className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{def.title}</span>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {def.canonical}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{def.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        Dept: {def.department}
                      </span>
                      {def.canManageTeam && (
                        <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 font-semibold">
                          Staff Management
                        </span>
                      )}
                      {def.canViewFinance && (
                        <span className="rounded bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 font-semibold">
                          Finance Access
                        </span>
                      )}
                      {def.canManageSystem && (
                        <span className="rounded bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 font-semibold">
                          System Admin
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal for SuperAdmin */}
      {editingStaff && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Modify Staff Role & Assignment</h2>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                {actionSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateStaffRole} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Staff Member</label>
                <p className="mt-1 font-bold text-slate-900 text-sm">{editingStaff.full_name}</p>
                <p className="text-[11px] text-slate-400">{editingStaff.email}</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Canonical Role *</label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value as CanonicalStaffRole)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600 font-medium"
                >
                  {CANONICAL_ROLES_LIST.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_DEFINITIONS[r].title} ({r})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  {ROLE_DEFINITIONS[selectedNewRole]?.description}
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Department</label>
                <input
                  type="text"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  placeholder="e.g. Operations, Finance, Client Relations"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-xl bg-[#043F2E] px-4 py-2 font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
