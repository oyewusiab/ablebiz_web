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
  Check,
  X,
  AlertTriangle,
  Plus,
  FileText,
  UserPlus,
  ArrowRight,
  RefreshCw,
  Send,
  HelpCircle,
  Copy,
  KeyRound,
} from "lucide-react";
import { supabase, createIsolatedSupabaseClient } from "../../lib/supabaseClient";
import { useAuth, type StaffRole, type RolePermissionRule } from "../../auth/AuthContext";
import {
  ROLE_DEFINITIONS,
  normalizeStaffRole,
  getRoleTitle,
  getRoleConfig,
  type CanonicalStaffRole,
} from "../../auth/roleConfig";

/**
 * Generate a cryptographically secure, high-entropy unique temporary password
 * for initial staff onboarding. Contains uppercase, lowercase, numbers, and symbols.
 * Never uses predictable or shared values like "Welcome1".
 */
function generateSecureTempPassword(): string {
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%&*";
  const allChars = lowercase + uppercase + numbers + symbols;

  const array = new Uint8Array(14);
  crypto.getRandomValues(array);

  const chars = [
    lowercase[array[0] % lowercase.length],
    uppercase[array[1] % uppercase.length],
    numbers[array[2] % numbers.length],
    symbols[array[3] % symbols.length],
  ];
  for (let i = 4; i < 14; i++) {
    chars.push(allChars[array[i] % allChars.length]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}


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

export type StaffChangeRequestType =
  | "create_staff"
  | "deactivate_staff"
  | "reactivate_staff"
  | "change_role"
  | "deprovision_staff";

export type StaffChangeRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "cancelled";

export interface StaffChangeRequestRecord {
  id: string;
  request_type: StaffChangeRequestType;
  requested_by: string;
  target_staff_profile_id?: string | null;
  current_role?: StaffRole | null;
  requested_role?: StaffRole | null;
  requested_changes: {
    full_name?: string;
    email?: string;
    phone?: string;
    department?: string;
    notes?: string;
  };
  reason: string;
  status: StaffChangeRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  execution_error?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  // PostgREST Joins
  requester?: { id: string; full_name: string; email: string } | null;
  target?: { id: string; full_name: string; email: string; role: StaffRole; is_active: boolean } | null;
  reviewer?: { id: string; full_name: string; email: string } | null;
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
  const [changeRequests, setChangeRequests] = useState<StaffChangeRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<"staff" | "pending_approvals" | "my_requests" | "rbac_matrix">("staff");

  // Filtering for Staff Directory
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filtering for Requests
  const [reqStatusFilter, setReqStatusFilter] = useState<string>("all");
  const [reqTypeFilter, setReqTypeFilter] = useState<string>("all");

  // Role Edit / Role Change Request Modal
  const [editingStaff, setEditingStaff] = useState<StaffProfileRecord | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<CanonicalStaffRole>("viewer");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [changeReason, setChangeReason] = useState("");

  // New Staff Modal (Direct for Super Admin / Request for Admin)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    department: "Operations",
    role: "viewer" as CanonicalStaffRole,
    reason: "",
  });

  // Action Confirmation Modals
  const [confirmActionModal, setConfirmActionModal] = useState<{
    targetStaff: StaffProfileRecord;
    actionType: StaffChangeRequestType;
    newRole?: CanonicalStaffRole;
    department?: string;
  } | null>(null);
  const [actionReasonInput, setActionReasonInput] = useState("");

  // Super Admin Approval / Rejection Modal
  const [reviewModalRequest, setReviewModalRequest] = useState<StaffChangeRequestRecord | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approve" | "reject">("approve");
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // One-Time Credential Modal (for newly provisioned staff)
  const [credentialModalInfo, setCredentialModalInfo] = useState<{
    fullName: string;
    email: string;
    role: StaffRole;
    tempPassword: string;
    loginUrl: string;
  } | null>(null);
  const [credentialCopied, setCredentialCopied] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const isSuperAdmin = profile?.role === "super_admin" || (profile?.role as string) === "managing_director";

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    setActionError("");
    try {
      const [staffRes, permRes, requestsRes] = await Promise.all([
        supabase
          .from("staff_profiles")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("roles_permissions")
          .select("*")
          .order("role", { ascending: true }),
        supabase
          .from("staff_change_requests")
          .select(`
            id,
            request_type,
            requested_by,
            target_staff_profile_id,
            current_role,
            requested_role,
            requested_changes,
            reason,
            status,
            reviewed_by,
            reviewed_at,
            rejection_reason,
            execution_error,
            created_at,
            updated_at,
            completed_at,
            requester:staff_profiles!staff_change_requests_requested_by_fkey(id, full_name, email),
            target:staff_profiles!staff_change_requests_target_staff_profile_id_fkey(id, full_name, email, role, is_active),
            reviewer:staff_profiles!staff_change_requests_reviewed_by_fkey(id, full_name, email)
          `)
          .order("created_at", { ascending: false }),
      ]);

      if (staffRes.data) {
        setStaffList(staffRes.data as StaffProfileRecord[]);
      }
      if (permRes.data) {
        setPermissionsMatrix(permRes.data as RolePermissionRule[]);
      }
      if (requestsRes.data) {
        setChangeRequests(requestsRes.data as unknown as StaffChangeRequestRecord[]);
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

  // Check how many active super_admins exist
  const activeSuperAdminsCount = staffList.filter(
    (s) => s.role === "super_admin" && s.is_active
  ).length;

  // Has pending request for a target staff
  const getPendingRequestForTarget = (targetId: string) => {
    return changeRequests.find(
      (r) => r.target_staff_profile_id === targetId && r.status === "pending"
    );
  };

  // ------------------------------------------------------------------------
  // Helper: Log Structured Audit Record & Activity Timeline
  // ------------------------------------------------------------------------
  const logAuditEvent = async (
    action: string,
    entityId: string,
    oldVals: any,
    newVals: any,
    eventTitle: string
  ) => {
    try {
      await Promise.all([
        supabase.from("audit_logs").insert({
          staff_id: profile?.id,
          staff_email: profile?.email,
          action,
          entity_type: "staff_profile",
          entity_id: entityId,
          old_values: oldVals,
          new_values: newVals,
        }),
        supabase.from("activity_timeline").insert({
          entity_type: "staff_profile",
          entity_id: entityId,
          actor_type: "staff",
          actor_id: profile?.id,
          event_type: action,
          event_title: eventTitle,
          metadata: { ...newVals },
        }),
      ]);
    } catch (err) {
      console.warn("[AuditLog] Failed to record audit log entry:", err);
    }
  };

  // ------------------------------------------------------------------------
  // 1. ADD / CREATE STAFF (Direct for Super Admin / Request for Admin)
  // ------------------------------------------------------------------------
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!newStaffForm.fullName.trim() || !newStaffForm.email.trim()) {
      setActionError("Full name and email address are required.");
      return;
    }

    if (!isSuperAdmin && !newStaffForm.reason.trim()) {
      setActionError("A business reason is required for staff change approval.");
      return;
    }

    setIsSubmitting(true);
    setActionError("");
    setActionSuccess("");

    try {
      if (isSuperAdmin) {
        // Direct Provisioning by Super Admin
        const tempPassword = generateSecureTempPassword();
        let authUid = crypto.randomUUID();

        // 1. Attempt to create Auth account using isolated client (preserves Super Admin session)
        try {
          const isolatedClient = createIsolatedSupabaseClient();
          const { data: signUpData, error: signUpErr } = await isolatedClient.auth.signUp({
            email: newStaffForm.email.trim().toLowerCase(),
            password: tempPassword,
            options: {
              data: {
                full_name: newStaffForm.fullName.trim(),
              },
            },
          });

          if (signUpData?.user?.id) {
            authUid = signUpData.user.id;
          } else if (signUpErr) {
            console.warn("[SuperAdmin] Auth account initialization notice:", signUpErr.message);
          }
        } catch (authErr) {
          console.warn("[SuperAdmin] Isolated auth client error:", authErr);
        }

        // 2. Create staff_profiles record with must_change_password = true
        const { data: createdStaff, error: dbErr } = await supabase
          .from("staff_profiles")
          .insert({
            auth_uid: authUid,
            email: newStaffForm.email.trim().toLowerCase(),
            full_name: newStaffForm.fullName.trim(),
            role: newStaffForm.role,
            department: newStaffForm.department.trim() || "Operations",
            phone: newStaffForm.phone.trim() || null,
            is_active: true,
            must_change_password: true,
          })
          .select()
          .single();

        if (dbErr) {
          throw new Error(`Database error: ${dbErr.message}`);
        }

        // 3. Log audit event (never log passwords!)
        await logAuditEvent(
          "staff_create_executed",
          createdStaff.id,
          null,
          {
            email: newStaffForm.email,
            role: newStaffForm.role,
            department: newStaffForm.department,
            must_change_password: true,
          },
          `Staff user directly created: ${newStaffForm.fullName} (${getRoleTitle(newStaffForm.role)}) with mandatory first-login password change`
        );

        // 4. Prepare portal login URL and open one-time credential modal
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const loginUrl = isLocal
          ? `${window.location.origin}/admin/login`
          : "https://www.ablebiz.com.ng/admin/login";

        setCredentialModalInfo({
          fullName: newStaffForm.fullName.trim(),
          email: newStaffForm.email.trim().toLowerCase(),
          role: newStaffForm.role,
          tempPassword,
          loginUrl,
        });
        setCredentialCopied(false);

        setIsAddStaffOpen(false);
        setNewStaffForm({
          fullName: "",
          email: "",
          phone: "",
          department: "Operations",
          role: "viewer",
          reason: "",
        });
        await fetchData();
      } else {
        // Maker Workflow: Admin creates a pending staff_change_requests record
        const { data: newReq, error: reqErr } = await supabase
          .from("staff_change_requests")
          .insert({
            request_type: "create_staff",
            requested_by: profile.id,
            requested_role: newStaffForm.role,
            requested_changes: {
              full_name: newStaffForm.fullName.trim(),
              email: newStaffForm.email.trim().toLowerCase(),
              phone: newStaffForm.phone.trim() || null,
              department: newStaffForm.department.trim() || "Operations",
            },
            reason: newStaffForm.reason.trim(),
            status: "pending",
          })
          .select()
          .single();

        if (reqErr) {
          throw new Error(`Failed to submit request: ${reqErr.message}`);
        }

        await logAuditEvent(
          "staff_create_requested",
          newReq.id,
          null,
          { requested_role: newStaffForm.role, email: newStaffForm.email },
          `Staff creation requested by ${profile.full_name} for ${newStaffForm.fullName} (Pending Approval)`
        );

        setActionSuccess("Staff creation request submitted for Super Admin approval.");
        setIsAddStaffOpen(false);
        setNewStaffForm({
          fullName: "",
          email: "",
          phone: "",
          department: "Operations",
          role: "viewer",
          reason: "",
        });
        await fetchData();
        setActiveTab("my_requests");
      }
    } catch (err: any) {
      setActionError(err?.message || "Failed to process staff creation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------------
  // 2. ROLE CHANGE (Direct for Super Admin / Request for Admin)
  // ------------------------------------------------------------------------
  const handleOpenRoleModal = (staff: StaffProfileRecord) => {
    setEditingStaff(staff);
    setSelectedNewRole(normalizeStaffRole(staff.role));
    setSelectedDepartment(staff.department);
    setChangeReason("");
    setActionError("");
    setActionSuccess("");
  };

  const handleRoleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !editingStaff) return;

    // Self-Protection check
    if (editingStaff.id === profile.id && selectedNewRole !== "super_admin" && isSuperAdmin) {
      if (activeSuperAdminsCount <= 1) {
        setActionError("Security Safeguard: You cannot remove the last active Super Admin.");
        return;
      }
    }

    if (!isSuperAdmin && !changeReason.trim()) {
      setActionError("A justification reason is required for role modification approval.");
      return;
    }

    setIsSubmitting(true);
    setActionError("");
    setActionSuccess("");

    try {
      if (isSuperAdmin) {
        // Direct Action by Super Admin
        const { error: updErr } = await supabase
          .from("staff_profiles")
          .update({
            role: selectedNewRole,
            department: selectedDepartment.trim() || editingStaff.department,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingStaff.id);

        if (updErr) {
          throw new Error(updErr.message);
        }

        await logAuditEvent(
          "staff_role_change_executed",
          editingStaff.id,
          { role: editingStaff.role, department: editingStaff.department },
          { role: selectedNewRole, department: selectedDepartment },
          `Role changed for ${editingStaff.full_name} from ${getRoleTitle(editingStaff.role)} to ${getRoleTitle(selectedNewRole)}`
        );

        setActionSuccess(`Role for ${editingStaff.full_name} updated successfully.`);
        setTimeout(() => {
          setEditingStaff(null);
          setActionSuccess("");
        }, 1200);
        await fetchData();
      } else {
        // Maker Workflow: Admin creates request
        // Duplicate check
        const existingReq = getPendingRequestForTarget(editingStaff.id);
        if (existingReq) {
          throw new Error("A pending request already exists for this staff member.");
        }

        const { data: newReq, error: reqErr } = await supabase
          .from("staff_change_requests")
          .insert({
            request_type: "change_role",
            requested_by: profile.id,
            target_staff_profile_id: editingStaff.id,
            current_role: editingStaff.role,
            requested_role: selectedNewRole,
            requested_changes: {
              department: selectedDepartment.trim() || editingStaff.department,
            },
            reason: changeReason.trim(),
            status: "pending",
          })
          .select()
          .single();

        if (reqErr) {
          throw new Error(reqErr.message);
        }

        await logAuditEvent(
          "staff_role_change_requested",
          newReq.id,
          { current_role: editingStaff.role },
          { requested_role: selectedNewRole, reason: changeReason },
          `Role change requested for ${editingStaff.full_name} to ${getRoleTitle(selectedNewRole)} (Pending Approval)`
        );

        setActionSuccess(`Role change request for ${editingStaff.full_name} submitted for Super Admin review.`);
        setTimeout(() => {
          setEditingStaff(null);
          setActionSuccess("");
        }, 1200);
        await fetchData();
        setActiveTab("my_requests");
      }
    } catch (err: any) {
      setActionError(err?.message || "Failed to process role change.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------------
  // 3. LIFECYCLE ACTIONS (Deactivate, Reactivate, Deprovision)
  // ------------------------------------------------------------------------
  const handleInitiateLifecycleAction = (
    staff: StaffProfileRecord,
    actionType: StaffChangeRequestType
  ) => {
    // Self-Protection Safeguards
    if (staff.id === profile?.id && (actionType === "deactivate_staff" || actionType === "deprovision_staff")) {
      alert("Self-Protection Guard: You cannot deactivate or deprovision your own active staff account.");
      return;
    }

    if (
      staff.role === "super_admin" &&
      staff.is_active &&
      (actionType === "deactivate_staff" || actionType === "deprovision_staff") &&
      activeSuperAdminsCount <= 1
    ) {
      alert("Security Violation: Cannot deactivate or deprovision the last active Super Administrator.");
      return;
    }

    // Duplicate check
    const existingReq = getPendingRequestForTarget(staff.id);
    if (existingReq) {
      alert(`There is already a pending '${existingReq.request_type.replace(/_/g, " ")}' request for this staff member.`);
      return;
    }

    setConfirmActionModal({
      targetStaff: staff,
      actionType,
    });
    setActionReasonInput("");
    setActionError("");
  };

  const handleExecuteLifecycleAction = async () => {
    if (!confirmActionModal || !profile?.id) return;
    const { targetStaff, actionType } = confirmActionModal;

    if (!isSuperAdmin && !actionReasonInput.trim()) {
      setActionError("A justification reason is required for administrative submission.");
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      if (isSuperAdmin) {
        // Direct Action by Super Admin
        let newIsActive = targetStaff.is_active;
        let eventType = "";
        let eventTitle = "";

        if (actionType === "deactivate_staff") {
          newIsActive = false;
          eventType = "staff_deactivation_executed";
          eventTitle = `Staff member ${targetStaff.full_name} deactivated`;
        } else if (actionType === "reactivate_staff") {
          newIsActive = true;
          eventType = "staff_reactivation_executed";
          eventTitle = `Staff member ${targetStaff.full_name} reactivated`;
        } else if (actionType === "deprovision_staff") {
          // Safe Deprovisioning: Deactivate operational status while preserving attribution
          newIsActive = false;
          eventType = "staff_deprovision_executed";
          eventTitle = `Staff member ${targetStaff.full_name} deprovisioned (Access revoked, history retained)`;
        }

        const { error: updErr } = await supabase
          .from("staff_profiles")
          .update({
            is_active: newIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetStaff.id);

        if (updErr) {
          throw new Error(updErr.message);
        }

        await logAuditEvent(
          eventType,
          targetStaff.id,
          { is_active: targetStaff.is_active },
          { is_active: newIsActive, reason: actionReasonInput || "Super Admin Direct Action" },
          eventTitle
        );

        setConfirmActionModal(null);
        await fetchData();
      } else {
        // Maker Workflow: Admin submits change request
        const { data: newReq, error: reqErr } = await supabase
          .from("staff_change_requests")
          .insert({
            request_type: actionType,
            requested_by: profile.id,
            target_staff_profile_id: targetStaff.id,
            current_role: targetStaff.role,
            reason: actionReasonInput.trim(),
            status: "pending",
          })
          .select()
          .single();

        if (reqErr) {
          throw new Error(reqErr.message);
        }

        const reqTitle =
          actionType === "deactivate_staff"
            ? "deactivation"
            : actionType === "reactivate_staff"
            ? "reactivation"
            : "deprovisioning";

        await logAuditEvent(
          `staff_${reqTitle}_requested`,
          newReq.id,
          { is_active: targetStaff.is_active },
          { actionType, reason: actionReasonInput },
          `Staff ${reqTitle} requested for ${targetStaff.full_name} by ${profile.full_name} (Pending Approval)`
        );

        setConfirmActionModal(null);
        await fetchData();
        setActiveTab("my_requests");
      }
    } catch (err: any) {
      setActionError(err?.message || "Failed to execute staff action.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------------
  // 4. SUPER ADMIN REVIEW: APPROVE OR REJECT REQUEST
  // ------------------------------------------------------------------------
  const handleOpenReviewModal = (req: StaffChangeRequestRecord, decision: "approve" | "reject") => {
    if (!isSuperAdmin) return;
    setReviewModalRequest(req);
    setReviewDecision(decision);
    setRejectionReasonInput("");
    setActionError("");
  };

  const handleProcessReviewDecision = async () => {
    if (!reviewModalRequest || !profile?.id || !isSuperAdmin) return;
    const req = reviewModalRequest;

    if (reviewDecision === "reject" && !rejectionReasonInput.trim()) {
      setActionError("A formal rejection reason is required.");
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      if (reviewDecision === "reject") {
        // Super Admin Rejection:
        // Update request status to rejected with rejection_reason
        const { error: rejErr } = await supabase
          .from("staff_change_requests")
          .update({
            status: "rejected",
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReasonInput.trim(),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", req.id);

        if (rejErr) throw new Error(rejErr.message);

        const eventName = `staff_${req.request_type.replace(/_staff$/, "")}_rejected`;
        await logAuditEvent(
          eventName,
          req.id,
          { status: "pending" },
          { status: "rejected", rejection_reason: rejectionReasonInput },
          `Change request #${req.id.slice(0, 8)} rejected by Super Admin: ${rejectionReasonInput}`
        );

        setReviewModalRequest(null);
        await fetchData();
      } else {
        // Super Admin Approval:
        // Step 1: Execute the underlying action
        let executionSuccess = true;
        let execErrorMsg = "";

        if (req.request_type === "create_staff") {
          // Provision new staff profile
          const changes = req.requested_changes || {};
          const targetEmail = (changes.email || "").trim().toLowerCase();
          const targetFullName = (changes.full_name || "").trim();
          const targetRole = req.requested_role || "viewer";
          const targetDept = (changes.department || "").trim() || "Operations";
          const targetPhone = (changes.phone || "").trim() || null;

          const tempPassword = generateSecureTempPassword();
          let authUid = crypto.randomUUID();

          // 1. Attempt to create Auth account using isolated client (preserves Super Admin session)
          try {
            const isolatedClient = createIsolatedSupabaseClient();
            const { data: signUpData, error: signUpErr } = await isolatedClient.auth.signUp({
              email: targetEmail,
              password: tempPassword,
              options: {
                data: {
                  full_name: targetFullName,
                },
              },
            });

            if (signUpData?.user?.id) {
              authUid = signUpData.user.id;
            } else if (signUpErr) {
              console.warn("[SuperAdmin Approval] Auth initialization notice:", signUpErr.message);
            }
          } catch (authErr) {
            console.warn("[SuperAdmin Approval] Isolated auth client error:", authErr);
          }

          // 2. Insert into staff_profiles with must_change_password = true
          const { error: insertErr } = await supabase.from("staff_profiles").insert({
            auth_uid: authUid,
            email: targetEmail,
            full_name: targetFullName,
            role: targetRole,
            department: targetDept,
            phone: targetPhone,
            is_active: true,
            must_change_password: true,
          });

          if (insertErr) {
            executionSuccess = false;
            execErrorMsg = insertErr.message;
          } else {
            // 3. Prepare login URL and show One-Time Credential Modal
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            const loginUrl = isLocal
              ? `${window.location.origin}/admin/login`
              : "https://www.ablebiz.com.ng/admin/login";

            setCredentialModalInfo({
              fullName: targetFullName,
              email: targetEmail,
              role: targetRole,
              tempPassword,
              loginUrl,
            });
            setCredentialCopied(false);
          }
        } else if (req.target_staff_profile_id) {
          const target = staffList.find((s) => s.id === req.target_staff_profile_id);

          if (!target) {
            executionSuccess = false;
            execErrorMsg = "Target staff record no longer found.";
          } else {
            let updatePayload: any = { updated_at: new Date().toISOString() };

            if (req.request_type === "deactivate_staff") {
              // Safeguard check
              if (target.role === "super_admin" && activeSuperAdminsCount <= 1) {
                throw new Error("Cannot approve deactivation: target is the last active Super Admin.");
              }
              updatePayload.is_active = false;
            } else if (req.request_type === "reactivate_staff") {
              updatePayload.is_active = true;
            } else if (req.request_type === "deprovision_staff") {
              // Safe Deprovisioning: Deactivate while preserving attribution
              if (target.role === "super_admin" && activeSuperAdminsCount <= 1) {
                throw new Error("Cannot approve deprovisioning: target is the last active Super Admin.");
              }
              updatePayload.is_active = false;
            } else if (req.request_type === "change_role") {
              if (target.role === "super_admin" && req.requested_role !== "super_admin" && activeSuperAdminsCount <= 1) {
                throw new Error("Cannot approve role demotion: target is the last active Super Admin.");
              }
              updatePayload.role = req.requested_role;
              if (req.requested_changes?.department) {
                updatePayload.department = req.requested_changes.department;
              }
            }

            const { error: updErr } = await supabase
              .from("staff_profiles")
              .update(updatePayload)
              .eq("id", target.id);

            if (updErr) {
              executionSuccess = false;
              execErrorMsg = updErr.message;
            }
          }
        }

        // Step 2: Update request status according to execution result
        const finalStatus = executionSuccess ? "executed" : "failed";

        const { error: finalErr } = await supabase
          .from("staff_change_requests")
          .update({
            status: finalStatus,
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString(),
            execution_error: executionSuccess ? null : execErrorMsg,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", req.id);

        if (finalErr) throw new Error(finalErr.message);

        // Step 3: Record audit events
        const eventPrefix = `staff_${req.request_type.replace(/_staff$/, "")}`;
        await logAuditEvent(
          `${eventPrefix}_approved`,
          req.id,
          { status: "pending" },
          { status: finalStatus, execution_error: execErrorMsg || null },
          `Change request #${req.id.slice(0, 8)} approved and ${finalStatus} by Super Admin`
        );

        setReviewModalRequest(null);
        await fetchData();
      }
    } catch (err: any) {
      setActionError(err?.message || "Failed to process approval decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------------
  // Filtered Lists
  // ------------------------------------------------------------------------
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

  const pendingApprovalsList = changeRequests.filter((r) => r.status === "pending");

  const myRequestsList = changeRequests.filter((r) => r.requested_by === profile?.id);

  const getStatusBadge = (status: StaffChangeRequestStatus) => {
    switch (status) {
      case "pending":
        return <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">Pending Approval</span>;
      case "approved":
        return <span className="rounded-full bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">Approved</span>;
      case "executed":
        return <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">Executed</span>;
      case "rejected":
        return <span className="rounded-full bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 text-[10px] font-bold">Rejected</span>;
      case "failed":
        return <span className="rounded-full bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 text-[10px] font-bold">Execution Failed</span>;
      case "cancelled":
        return <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold">Cancelled</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize">{status}</span>;
    }
  };

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
            Internal team members, canonical role assignments, maker-checker governance, and system permission enforcement.
          </p>
        </div>

        {/* Global Action / Add Staff */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsAddStaffOpen(true);
              setActionError("");
              setActionSuccess("");
            }}
            className="flex items-center gap-2 rounded-xl bg-[#043F2E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#06553F] shadow-xs transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>{isSuperAdmin ? "Add Staff Directly" : "Request New Staff"}</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "staff"
              ? "bg-[#043F2E] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Staff Directory ({staffList.length})</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("pending_approvals")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition relative ${
              activeTab === "pending_approvals"
                ? "bg-[#043F2E] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Pending Approvals</span>
            {pendingApprovalsList.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.2 text-[10px] font-black text-slate-950">
                {pendingApprovalsList.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab("my_requests")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "my_requests"
              ? "bg-[#043F2E] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>My Requests ({myRequestsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("rbac_matrix")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "rbac_matrix"
              ? "bg-[#043F2E] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>RBAC Matrix</span>
        </button>
      </div>

      {/* Authority Notice */}
      <div
        className={`rounded-xl border p-4 text-xs ${
          isSuperAdmin
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck
            className={`h-5 w-5 shrink-0 ${isSuperAdmin ? "text-emerald-700" : "text-amber-700"}`}
          />
          <div>
            <span className="font-bold">
              {isSuperAdmin
                ? "Super Administrator Authority (Direct Control & Maker-Checker Approver)"
                : "Administrator Mode: Maker-Checker Governance Active"}
            </span>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              {isSuperAdmin
                ? "You hold full executive authority to create, deactivate, reactivate, change roles, and safely deprovision staff. You can also review, approve, or reject administrative staff change requests. All events are enforced via PostgreSQL RLS."
                : "All staff creation, role modifications, deactivations, reactivations, and deprovisioning initiated by administrators enter a 'Pending Super Admin Approval' state and cannot take effect until explicitly approved."}
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: STAFF DIRECTORY */}
      {/* ------------------------------------------------------------------ */}
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

          {/* Directory Table */}
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
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((st) => {
                    const normRole = normalizeStaffRole(st.role);
                    const cfg = getRoleConfig(normRole);
                    const pendingReq = getPendingRequestForTarget(st.id);

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
                          <div className="space-y-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold inline-block ${
                                st.is_active
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {st.is_active ? "Active" : "Inactive"}
                            </span>
                            {pendingReq && (
                              <div>
                                <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[9px] font-semibold">
                                  Pending {pendingReq.request_type.replace(/_staff$/, "")}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Role Modification Button */}
                            <button
                              onClick={() => handleOpenRoleModal(st)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition"
                            >
                              {isSuperAdmin ? "Edit Role" : "Request Role Change"}
                            </button>

                            {/* Activation / Deactivation */}
                            <button
                              onClick={() =>
                                handleInitiateLifecycleAction(
                                  st,
                                  st.is_active ? "deactivate_staff" : "reactivate_staff"
                                )
                              }
                              disabled={st.id === profile?.id}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                                st.is_active
                                  ? "text-amber-700 hover:bg-amber-50"
                                  : "text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {st.is_active
                                ? isSuperAdmin
                                  ? "Deactivate"
                                  : "Request Deactivation"
                                : isSuperAdmin
                                ? "Reactivate"
                                : "Request Reactivation"}
                            </button>

                            {/* Safe Deprovisioning */}
                            <button
                              onClick={() => handleInitiateLifecycleAction(st, "deprovision_staff")}
                              disabled={st.id === profile?.id}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isSuperAdmin ? "Deprovision" : "Request Deprovisioning"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: PENDING APPROVALS (SUPER ADMIN ONLY) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "pending_approvals" && isSuperAdmin && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Governance & Approval Queue</h2>
                <p className="text-xs text-slate-500">
                  Staff actions submitted by administrators requiring explicit Super Admin review and authorization.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 text-amber-900 font-bold px-3 py-1 text-xs">
                {pendingApprovalsList.length} Awaiting Approval
              </span>
            </div>

            {pendingApprovalsList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2 opacity-60" />
                <p className="font-semibold text-slate-700">Approval queue is empty</p>
                <p className="text-slate-400 mt-0.5">All staff change requests have been processed.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {pendingApprovalsList.map((req) => (
                  <div key={req.id} className="p-4 hover:bg-slate-50/60 transition text-xs space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 uppercase">
                            {req.request_type.replace(/_/g, " ")}
                          </span>
                          {getStatusBadge(req.status)}
                        </div>
                        <p className="text-slate-600">
                          Submitted by <strong className="text-slate-900">{req.requester?.full_name || "Admin"}</strong> ({req.requester?.email}) on {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenReviewModal(req, "approve")}
                          className="flex items-center gap-1 rounded-lg bg-[#043F2E] px-3 py-1.5 font-bold text-white hover:bg-[#06553F] transition shadow-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Review & Approve</span>
                        </button>
                        <button
                          onClick={() => handleOpenReviewModal(req, "reject")}
                          className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* Change Details Box */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs space-y-1.5">
                      {req.request_type === "create_staff" ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Candidate Name</span>
                            <p className="font-bold text-slate-900">{req.requested_changes?.full_name}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Email</span>
                            <p className="font-bold text-slate-900">{req.requested_changes?.email}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Department</span>
                            <p className="font-bold text-slate-900">{req.requested_changes?.department}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Requested Role</span>
                            <p className="font-bold text-emerald-800">{getRoleTitle(req.requested_role)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Target Staff</span>
                            <p className="font-bold text-slate-900">{req.target?.full_name}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Current State</span>
                            <p className="font-medium text-slate-700">
                              {getRoleTitle(req.current_role)} ({req.target?.is_active ? "Active" : "Inactive"})
                            </p>
                          </div>
                          {req.requested_role && (
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">Target Role</span>
                              <p className="font-bold text-emerald-800">{getRoleTitle(req.requested_role)}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-1 border-t border-slate-200/60 mt-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Requester's Stated Reason</span>
                        <p className="text-slate-800 italic mt-0.5">"{req.reason}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: MY REQUESTS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "my_requests" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">Submitted Staff Change Requests</h2>
            <p className="text-xs text-slate-500">
              Complete history of change requests you have submitted to Super Admin.
            </p>

            {myRequestsList.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2 opacity-50" />
                <p className="font-semibold text-slate-700">No requests submitted yet</p>
                <p className="text-slate-400 mt-0.5">Requests initiated for staff additions or modifications will appear here.</p>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3.5">Action Type</th>
                      <th className="px-4 py-3.5">Target / Candidate</th>
                      <th className="px-4 py-3.5">Requested Changes</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Reviewed By</th>
                      <th className="px-4 py-3.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myRequestsList.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3.5 font-bold text-slate-900 uppercase">
                          {req.request_type.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3.5">
                          {req.request_type === "create_staff" ? (
                            <div>
                              <p className="font-semibold text-slate-900">{req.requested_changes?.full_name}</p>
                              <p className="text-[11px] text-slate-400">{req.requested_changes?.email}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-slate-900">{req.target?.full_name}</p>
                              <p className="text-[11px] text-slate-400">{req.target?.email}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {req.requested_role ? (
                            <span>Role: <strong>{getRoleTitle(req.requested_role)}</strong></span>
                          ) : (
                            <span className="text-slate-500 capitalize">{req.request_type.replace(/_/g, " ")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {getStatusBadge(req.status)}
                          {req.rejection_reason && (
                            <p className="text-[10px] text-red-600 mt-1 italic">
                              Rejection: "{req.rejection_reason}"
                            </p>
                          )}
                          {req.execution_error && (
                            <p className="text-[10px] text-orange-600 mt-1 italic">
                              Error: {req.execution_error}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {req.reviewer?.full_name || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: RBAC MATRIX */}
      {/* ------------------------------------------------------------------ */}
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

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: ADD STAFF / REQUEST NEW STAFF */}
      {/* ------------------------------------------------------------------ */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isSuperAdmin ? "Direct Staff Provisioning" : "Submit Staff Creation Request"}
                </h2>
                <p className="text-xs text-slate-500">
                  {isSuperAdmin
                    ? "Directly provision internal staff member with active credentials."
                    : "Propose new internal staff member for Super Admin approval."}
                </p>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(false)}
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

            <form onSubmit={handleAddStaffSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Babatunde Adeyemi"
                  value={newStaffForm.fullName}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="staff@ablebiz.com"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="08012345678"
                    value={newStaffForm.phone}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Department</label>
                  <input
                    type="text"
                    placeholder="Operations, Finance, Legal"
                    value={newStaffForm.department}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Canonical Role *</label>
                  <select
                    value={newStaffForm.role}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value as CanonicalStaffRole })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600 font-medium"
                  >
                    {CANONICAL_ROLES_LIST.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_DEFINITIONS[r].title} ({r})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  {isSuperAdmin ? "Administrative Onboarding Notes (Optional)" : "Business Justification Reason *"}
                </label>
                <textarea
                  rows={2}
                  required={!isSuperAdmin}
                  placeholder="Explain why this staff account is required..."
                  value={newStaffForm.reason}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, reason: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-emerald-600"
                />
              </div>

              {!isSuperAdmin && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                  <p className="font-bold">Maker-Checker Notice:</p>
                  <p className="mt-0.5">
                    This action will not create the staff record immediately. It will be placed into the Super Admin queue as <strong>Pending Super Admin Approval</strong>.
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#043F2E] px-4 py-2 font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Processing..."
                    : isSuperAdmin
                    ? "Provision Staff Directly"
                    : "Submit Request for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: ROLE MODIFICATION (DIRECT FOR SUPER / REQUEST FOR ADMIN) */}
      {/* ------------------------------------------------------------------ */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {isSuperAdmin ? "Direct Role Assignment" : "Request Role Change"}
              </h2>
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

            <form onSubmit={handleRoleChangeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Staff Member</label>
                <p className="mt-1 font-bold text-slate-900 text-sm">{editingStaff.full_name}</p>
                <p className="text-[11px] text-slate-400">
                  Current Role: <strong>{getRoleTitle(editingStaff.role)}</strong> ({editingStaff.email})
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Target Canonical Role *</label>
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

              <div>
                <label className="font-semibold text-slate-700">
                  {isSuperAdmin ? "Reason / Notes (Optional)" : "Reason for Role Modification *"}
                </label>
                <textarea
                  rows={2}
                  required={!isSuperAdmin}
                  placeholder="Explain why this role change is requested..."
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-emerald-600"
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
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#043F2E] px-4 py-2 font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : isSuperAdmin
                    ? "Save Changes Directly"
                    : "Submit Role Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: LIFECYCLE ACTION CONFIRMATION (DEACTIVATE, REACTIVATE, DEPROVISION) */}
      {/* ------------------------------------------------------------------ */}
      {confirmActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900 capitalize">
                  {isSuperAdmin ? "Confirm Staff Action" : "Request Staff Action"}
                </h2>
              </div>
              <button
                onClick={() => setConfirmActionModal(null)}
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

            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-slate-600">
                  Target Staff Member: <strong className="text-slate-900">{confirmActionModal.targetStaff.full_name}</strong>
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Current Role: {getRoleTitle(confirmActionModal.targetStaff.role)} | Email: {confirmActionModal.targetStaff.email}
                </p>
                <p className="mt-2 text-slate-800 font-semibold uppercase">
                  Proposed Action: {confirmActionModal.actionType.replace(/_/g, " ")}
                </p>
              </div>

              {confirmActionModal.actionType === "deprovision_staff" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 text-[11px] leading-relaxed">
                  <p className="font-bold">Safe Deprovisioning Policy:</p>
                  <p className="mt-0.5">
                    Deprovisioning permanently revokes operational portal access and sets the staff record inactive.
                    Historical receipts, invoices, quotations, documents, and task attributions are preserved for statutory compliance.
                  </p>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700">
                  {isSuperAdmin ? "Administrative Reason (Optional)" : "Justification Reason *"}
                </label>
                <textarea
                  rows={2}
                  required={!isSuperAdmin}
                  placeholder="State the operational reason for this action..."
                  value={actionReasonInput}
                  onChange={(e) => setActionReasonInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmActionModal(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteLifecycleAction}
                  disabled={isSubmitting}
                  className={`rounded-xl px-4 py-2 font-bold text-white transition disabled:opacity-50 ${
                    confirmActionModal.actionType === "deprovision_staff"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-[#043F2E] hover:bg-[#06553F]"
                  }`}
                >
                  {isSubmitting
                    ? "Processing..."
                    : isSuperAdmin
                    ? "Confirm & Execute"
                    : "Submit Action Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 4: SUPER ADMIN DECISION MODAL (APPROVE / REJECT) */}
      {/* ------------------------------------------------------------------ */}
      {reviewModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {reviewDecision === "approve" ? "Super Admin Approval Confirmation" : "Reject Change Request"}
              </h2>
              <button
                onClick={() => setReviewModalRequest(null)}
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

            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1">
                <p className="text-slate-500 uppercase text-[10px] font-bold">Request Summary</p>
                <p className="font-bold text-slate-900 text-sm">
                  {reviewModalRequest.request_type.replace(/_/g, " ").toUpperCase()}
                </p>
                <p className="text-slate-600">
                  Requested by: <strong>{reviewModalRequest.requester?.full_name}</strong>
                </p>
                <p className="text-slate-600">
                  Target / Candidate:{" "}
                  <strong>
                    {reviewModalRequest.target?.full_name || reviewModalRequest.requested_changes?.full_name}
                  </strong>
                </p>
                <p className="text-slate-600 italic">"{reviewModalRequest.reason}"</p>
              </div>

              {reviewDecision === "approve" ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                  <p className="font-bold">Security & Execution Impact Notice:</p>
                  <p className="mt-0.5">
                    Approving this request will immediately execute the underlying operational change in PostgreSQL and grant/revoke access accordingly.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="font-semibold text-slate-700">Rejection Reason *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide detailed feedback on why this request is rejected..."
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-red-600"
                  />
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModalRequest(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessReviewDecision}
                  disabled={isSubmitting}
                  className={`rounded-xl px-4 py-2 font-bold text-white transition disabled:opacity-50 ${
                    reviewDecision === "approve"
                      ? "bg-[#043F2E] hover:bg-[#06553F]"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isSubmitting
                    ? "Processing..."
                    : reviewDecision === "approve"
                    ? "Authorize & Execute Change"
                    : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 5: ONE-TIME ONBOARDING CREDENTIAL MODAL */}
      {/* ------------------------------------------------------------------ */}
      {credentialModalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Staff Account Provisioned
                  </h2>
                  <p className="text-xs text-slate-500">
                    One-time initial login credentials
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredentialModalInfo(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Account Details Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Full Name:</span>
                  <span className="font-bold text-slate-800">{credentialModalInfo.fullName}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Email Address:</span>
                  <span className="font-bold text-slate-800 font-mono">{credentialModalInfo.email}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Assigned Role:</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    {getRoleTitle(credentialModalInfo.role)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Login URL:</span>
                  <span className="font-mono text-slate-700 select-all">{credentialModalInfo.loginUrl}</span>
                </div>
              </div>

              {/* Temporary Password Highlight Box */}
              <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-50/50 p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                    Generated Temporary Password
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(credentialModalInfo.tempPassword);
                      setCredentialCopied(true);
                      setTimeout(() => setCredentialCopied(false), 2500);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition active:scale-95 shadow-xs"
                  >
                    {credentialCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Password</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-white px-3.5 py-2.5 border border-emerald-200 shadow-inner">
                  <code className="font-mono text-base font-bold text-slate-900 tracking-wider select-all">
                    {credentialModalInfo.tempPassword}
                  </code>
                </div>
              </div>

              {/* Security Warning Notice */}
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-bold text-amber-950">
                    Mandatory First-Login Password Change Active
                  </p>
                  <p>
                    Provide this temporary password securely to the staff member. Upon signing in, they will be automatically redirected to change their password before they can access the ABLEBIZ Suite.
                  </p>
                  <p className="font-semibold text-amber-800 pt-0.5">
                    For security reasons, this temporary password is not stored in plaintext and will not be displayed again after closing this window.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex justify-between items-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const onboardingText = `ABLEBIZ SUITE — Staff Account Credentials\n\nFull Name: ${credentialModalInfo.fullName}\nEmail: ${credentialModalInfo.email}\nRole: ${getRoleTitle(credentialModalInfo.role)}\nLogin URL: ${credentialModalInfo.loginUrl}\nTemporary Password: ${credentialModalInfo.tempPassword}\n\nNote: You will be required to create your own secure password upon your first login.`;
                    navigator.clipboard.writeText(onboardingText);
                    setCredentialCopied(true);
                    setTimeout(() => setCredentialCopied(false), 2500);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Full Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCredentialModalInfo(null)}
                  className="rounded-xl bg-[#043F2E] px-5 py-2 font-bold text-white hover:bg-[#06553F] transition shadow-xs"
                >
                  Done / Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

