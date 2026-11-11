import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  DollarSign,
  Briefcase,
  Users,
  ShieldCheck,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Send,
  X,
  History,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Paperclip,
  Check,
  Ban,
  FileText,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { CanonicalStaffRole, getRoleTitle } from "../../auth/roleConfig";
import type {
  ApprovalCategory,
  ApprovalDecisionHistory,
  ApprovalInboxFilters,
  ApprovalRequest,
  ApprovalRequestType,
  ApprovalRule,
  ApprovalStatus,
  CreateApprovalRequestInput,
  SupportingDocument,
} from "../../types/approvals";
import {
  fetchApprovalRequests,
  fetchApprovalRules,
  fetchApprovalRequestDetails,
  createApprovalRequest,
  processApprovalDecision,
  canUserApprove,
  canUserWithdraw,
  DEFAULT_APPROVAL_RULES,
} from "../../lib/approvals/approvalService";

export function ApprovalsPage() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = (profile?.role as CanonicalStaffRole) || "viewer";
  const userId = profile?.id || "";
  const isSuper = userRole === "super_admin" || userRole === "admin";

  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [rules, setRules] = useState<ApprovalRule[]>(DEFAULT_APPROVAL_RULES);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [activeTab, setActiveTab] = useState<ApprovalInboxFilters["tab"]>(
    (searchParams.get("tab") as ApprovalInboxFilters["tab"]) || "pending"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Detail Modal State
  const [activeRequest, setActiveRequest] = useState<ApprovalRequest | null>(null);
  const [activeHistory, setActiveHistory] = useState<ApprovalDecisionHistory[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Decision Modal State
  const [decisionAction, setDecisionAction] = useState<
    "approved" | "rejected" | "returned_for_revision" | "withdrawn" | "executed" | null
  >(null);
  const [decisionComments, setDecisionComments] = useState("");
  const [executionNotes, setExecutionNotes] = useState("");
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Create Request Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<ApprovalCategory>("finance");
  const [createType, setCreateType] = useState<ApprovalRequestType>("expense");
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createJustification, setCreateJustification] = useState("");
  const [createAmount, setCreateAmount] = useState<string>("");
  const [createRelatedModule, setCreateRelatedModule] = useState("expenses");
  const [createRelatedRecordId, setCreateRelatedRecordId] = useState("");
  const [createDocUrl, setCreateDocUrl] = useState("");
  const [createDocName, setCreateDocName] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Notifications / Alerts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allReqs, allRules] = await Promise.all([
        fetchApprovalRequests(
          {
            tab: activeTab,
            category: selectedCategory,
            searchTerm: searchTerm,
            status: "all",
          },
          userRole,
          userId
        ),
        fetchApprovalRules(),
      ]);
      setRequests(allReqs);
      setRules(allRules);

      // Check if deep link request id exists
      const deepId = searchParams.get("id");
      if (deepId) {
        const found = allReqs.find((r) => r.id === deepId || r.reference_number === deepId);
        if (found) {
          openDetailModal(found);
        }
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, selectedCategory, userRole, userId]);

  const openDetailModal = async (req: ApprovalRequest) => {
    setActiveRequest(req);
    setIsDetailOpen(true);
    setDecisionAction(null);
    setDecisionComments("");
    setExecutionNotes("");
    setActionError(null);

    const { history } = await fetchApprovalRequestDetails(req.id);
    setActiveHistory(history);
  };

  const closeDetailModal = () => {
    setIsDetailOpen(false);
    setActiveRequest(null);
    setActiveHistory([]);
    setDecisionAction(null);
    searchParams.delete("id");
    setSearchParams(searchParams);
  };

  const handleProcessDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest || !decisionAction) return;

    if (!decisionComments.trim()) {
      setActionError("Decision comments are mandatory for governance and audit purposes.");
      return;
    }

    setIsSubmittingDecision(true);
    setActionError(null);

    const res = await processApprovalDecision(
      activeRequest.id,
      decisionAction,
      decisionComments.trim(),
      userId,
      userRole,
      executionNotes.trim() || undefined
    );

    if (!res.ok) {
      setActionError(res.message || "Failed to process approval decision.");
      setIsSubmittingDecision(false);
      return;
    }

    setActionSuccess(
      `Request ${activeRequest.reference_number} successfully marked as ${decisionAction.replace("_", " ")}.`
    );
    setIsSubmittingDecision(false);
    closeDetailModal();
    await loadData();
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createDesc.trim() || !createJustification.trim()) {
      setActionError("Title, description, and business justification are mandatory.");
      return;
    }

    setIsSubmittingCreate(true);
    setActionError(null);

    const supportingDocs: SupportingDocument[] = [];
    if (createDocName.trim() && createDocUrl.trim()) {
      supportingDocs.push({
        name: createDocName.trim(),
        url: createDocUrl.trim(),
        uploaded_at: new Date().toISOString(),
      });
    }

    const input: CreateApprovalRequestInput = {
      category: createCategory,
      request_type: createType,
      title: createTitle.trim(),
      description: createDesc.trim(),
      justification: createJustification.trim(),
      amount: createAmount ? parseFloat(createAmount) : null,
      related_module: createRelatedModule || null,
      related_record_id: createRelatedRecordId || null,
      supporting_documents: supportingDocs,
    };

    const res = await createApprovalRequest(input, userId);
    if (!res.ok) {
      setActionError(res.message || "Failed to create approval request.");
      setIsSubmittingCreate(false);
      return;
    }

    setActionSuccess(`Approval request submitted successfully (${res.request?.reference_number}).`);
    setIsSubmittingCreate(false);
    setIsCreateOpen(false);

    // Reset form
    setCreateTitle("");
    setCreateDesc("");
    setCreateJustification("");
    setCreateAmount("");
    setCreateDocName("");
    setCreateDocUrl("");

    await loadData();
  };

  // Metrics summary
  const counts = useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === "pending_approval" || r.status === "submitted").length,
      my_submissions: requests.filter((r) => r.requested_by === userId).length,
      approved: requests.filter((r) => r.status === "approved" || r.status === "executed").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      returned: requests.filter((r) => r.status === "returned_for_revision").length,
      rules: rules.length,
    };
  }, [requests, rules, userId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            Governance & Decision Engine
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Approval & Decision Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Formal maker-checker authorizations for expenses, refunds, invoice adjustments, discounts, and administrative decisions.
          </p>
        </div>

        <button
          onClick={() => {
            setActionError(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Approval Request
        </button>
      </div>

      {/* Success Alert */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs & Inbox Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by reference (e.g. APP-2026-0001), title, or requester..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by approval category"
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            <option value="finance">Finance (Expenses, Refunds, Write-offs)</option>
            <option value="commercial">Commercial (Discounts, Special Pricing)</option>
            <option value="operations">Operations (Document Releases, Exceptions)</option>
            <option value="administration">Administration (Staff Modifications)</option>
          </select>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800 scrollbar-none text-sm">
          {[
            { id: "pending", label: "My Pending Approvals", count: counts.pending },
            { id: "my_submissions", label: "Requests I Submitted", count: counts.my_submissions },
            { id: "approved", label: "Approved Decisions", count: counts.approved },
            { id: "rejected", label: "Rejected Requests", count: counts.rejected },
            { id: "returned", label: "Returned for Revision", count: counts.returned },
            { id: "all", label: "All Authorized Requests", count: requests.length },
            ...(isSuper ? [{ id: "rules", label: "Approval Rules & Policies", count: counts.rules }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSearchParams({ tab: tab.id });
              }}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Rules View (if Rules tab is selected) */}
      {activeTab === "rules" ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Configured Approval Rules & Authority Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-configured thresholds and maker-checker requirements across ABLEBIZ operational modules.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">
              Enterprise Governance Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Approval Rule</th>
                  <th className="px-4 py-3">Minimum Value</th>
                  <th className="px-4 py-3">Authorized Approver Roles</th>
                  <th className="px-4 py-3">Stages</th>
                  <th className="px-4 py-3">Supporting Docs</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 capitalize font-medium text-slate-900 dark:text-white">
                      {rule.category}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{rule.name}</div>
                      <div className="text-xs text-slate-400">{rule.description}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {rule.min_amount > 0 ? `₦${rule.min_amount.toLocaleString("en-NG")}` : "Any Amount"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.required_approver_roles.map((r) => (
                          <span
                            key={r}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {getRoleTitle(r)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{rule.sequential_stages} stage(s)</td>
                    <td className="px-4 py-3">
                      {rule.requires_supporting_documents ? (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Mandatory</span>
                      ) : (
                        <span className="text-xs text-slate-400">Optional</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Requests Table */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Clock className="w-5 h-5 text-emerald-600 animate-spin mr-2" />
              <span className="text-sm text-slate-500">Loading approval requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 p-8">
              <FileCheck2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                No approval requests found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                There are currently no approval requests matching your selected filter or pending your decision.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Title & Request</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {requests.map((req) => {
                    const isRequester = req.requested_by === userId;
                    const { canApprove } = canUserApprove(req, userRole, userId);

                    return (
                      <tr
                        key={req.id}
                        onClick={() => openDetailModal(req)}
                        className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {req.reference_number}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                            {req.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{req.title}</div>
                          <div className="text-xs text-slate-400 line-clamp-1">{req.description}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {req.amount ? `₦${Math.round(req.amount).toLocaleString("en-NG")}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {req.requester?.full_name || "Staff Member"}
                          </div>
                          {isRequester && (
                            <span className="text-[10px] text-emerald-600 font-semibold">(You)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                              req.status === "approved" || req.status === "executed"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : req.status === "pending_approval" || req.status === "submitted"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : req.status === "rejected"
                                ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {req.status === "approved" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {req.status === "pending_approval" && <Clock className="w-3 h-3 text-amber-600" />}
                            {req.status === "rejected" && <Ban className="w-3 h-3 text-red-600" />}
                            {req.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 hover:underline">
                            Inspect
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
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

      {/* Detail & Decision Drawer / Modal */}
      {isDetailOpen && activeRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    {activeRequest.reference_number}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded capitalize bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                    {activeRequest.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    Stage {activeRequest.current_stage} of {activeRequest.total_stages}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {activeRequest.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>Requester: {activeRequest.requester?.full_name || "Staff Member"}</span>
                  <span>•</span>
                  <span>Submitted: {new Date(activeRequest.created_at).toLocaleString()}</span>
                  {activeRequest.amount && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Value: ₦{Math.round(activeRequest.amount).toLocaleString("en-NG")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={closeDetailModal}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* Maker-Checker Safeguard Banner */}
              {activeRequest.requested_by === userId ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Maker-Checker Control:</strong> You are the requester of this item. You cannot approve your own request.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl text-blue-900 dark:text-blue-200 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>
                    Authorized decision maker role required: {activeRequest.assigned_approver_roles?.join(", ") || "super_admin"}.
                  </span>
                </div>
              )}

              {/* Description & Justification */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Request Description
                  </h4>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    {activeRequest.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Business Justification
                  </h4>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    {activeRequest.justification}
                  </p>
                </div>
              </div>

              {/* Related Record Link */}
              {activeRequest.related_module && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Originating Module: <strong className="capitalize">{activeRequest.related_module}</strong>
                      {activeRequest.related_record_id && ` (${activeRequest.related_record_id.slice(0, 8)})`}
                    </span>
                  </div>
                  <Link
                    to={`/admin/${activeRequest.related_module}`}
                    className="text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Open Source Record
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Supporting Documents */}
              {activeRequest.supporting_documents && activeRequest.supporting_documents.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Supporting Documents
                  </h4>
                  <div className="space-y-1.5">
                    {activeRequest.supporting_documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-900 dark:text-white">{doc.name}</span>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:underline inline-flex items-center gap-1"
                        >
                          View Document
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision History Timeline */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-600" />
                  Decision & Governance Audit History
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {activeHistory.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400">Initial submission awaiting review.</div>
                  ) : (
                    activeHistory.map((h) => (
                      <div key={h.id} className="p-3 text-xs space-y-1 bg-white dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white capitalize">
                              {h.action.replace("_", " ")}
                            </span>
                            <span className="text-slate-400">by {h.actor?.full_name || "Staff"}</span>
                          </div>
                          <span className="text-slate-400">{new Date(h.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 italic">{h.comments}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Decision Action Form (if decision button clicked) */}
              {decisionAction && (
                <form
                  onSubmit={handleProcessDecision}
                  className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                      Confirm {decisionAction.replace("_", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDecisionAction(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Decision Comments (Mandatory for Audit Trail) *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Explain the justification, budget verification, or correction instructions..."
                      value={decisionComments}
                      onChange={(e) => setDecisionComments(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  {decisionAction === "executed" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Execution Reference / Bank Teller Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bank transfer reference #NIP/20261019/39291"
                        value={executionNotes}
                        onChange={(e) => setExecutionNotes(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setDecisionAction(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingDecision}
                      className={`px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors ${
                        decisionAction === "approved" || decisionAction === "executed"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : decisionAction === "rejected"
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-amber-600 hover:bg-amber-700"
                      }`}
                    >
                      {isSubmittingDecision ? "Recording..." : `Confirm ${decisionAction.replace("_", " ")}`}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Current Status: <strong className="capitalize">{activeRequest.status.replace("_", " ")}</strong>
              </div>

              <div className="flex items-center gap-2">
                {/* Withdraw button for requester */}
                {canUserWithdraw(activeRequest, userId, userRole) && !decisionAction && (
                  <button
                    onClick={() => setDecisionAction("withdrawn")}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Withdraw Request
                  </button>
                )}

                {/* Execution button for approved financial/admin items */}
                {activeRequest.status === "approved" &&
                  activeRequest.execution_status === "pending_execution" &&
                  isSuper &&
                  !decisionAction && (
                    <button
                      onClick={() => setDecisionAction("executed")}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Execute Approved Action
                    </button>
                  )}

                {/* Decision Buttons for Approvers */}
                {canUserApprove(activeRequest, userRole, userId).canApprove && !decisionAction && (
                  <>
                    <button
                      onClick={() => setDecisionAction("returned_for_revision")}
                      className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                    >
                      Return for Revision
                    </button>
                    <button
                      onClick={() => setDecisionAction("rejected")}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => setDecisionAction("approved")}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Request
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Approval Request Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Submit Formal Approval Request
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Initiate a formal decision workflow with maker-checker accountability.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Approval Category *
                  </label>
                  <select
                    value={createCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ApprovalCategory;
                      setCreateCategory(cat);
                      if (cat === "finance") setCreateType("expense");
                      else if (cat === "commercial") setCreateType("discount");
                      else if (cat === "operations") setCreateType("document_release");
                      else setCreateType("staff_change");
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="finance">Finance & Disbursements</option>
                    <option value="commercial">Commercial & Quotation Pricing</option>
                    <option value="operations">Operations & Document Release</option>
                    <option value="administration">Management & Staff Governance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Request Type *
                  </label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as ApprovalRequestType)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    {createCategory === "finance" && (
                      <>
                        <option value="expense">Operational Expense</option>
                        <option value="refund">Client Refund</option>
                        <option value="invoice_adjustment">Invoice Adjustment / Credit Note</option>
                        <option value="budget_allocation">Budget Allocation</option>
                      </>
                    )}
                    {createCategory === "commercial" && (
                      <>
                        <option value="discount">Quotation Fee Discount</option>
                        <option value="campaign_pricing">Campaign Special Pricing</option>
                        <option value="special_quotation">Non-Standard Service Quotation</option>
                      </>
                    )}
                    {createCategory === "operations" && (
                      <>
                        <option value="document_release">Sensitive Document Release</option>
                        <option value="process_exception">Statutory Process Exception</option>
                        <option value="deliverable_approval">Deliverable Sign-Off</option>
                      </>
                    )}
                    {createCategory === "administration" && (
                      <>
                        <option value="staff_change">Staff Profile / Role Change</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Request Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Refund of statutory filing fees for cancelled LLC application"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Details of the requested decision or transaction..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Business Justification *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain why this decision is justified and compliant with ABLEBIZ policy..."
                  value={createJustification}
                  onChange={(e) => setCreateJustification(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Value / Amount (NGN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 75000"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Related Source Module
                  </label>
                  <select
                    value={createRelatedModule}
                    onChange={(e) => setCreateRelatedModule(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="expenses">Expenses</option>
                    <option value="invoices">Invoices</option>
                    <option value="quotations">Quotations</option>
                    <option value="payments">Payments</option>
                    <option value="cac-operations">CAC Operations</option>
                    <option value="documents">Documents</option>
                    <option value="team">Team / Staff</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 block">
                  Supporting Document Link (Optional)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Document Name (e.g. Bank Teller / Receipt)"
                    value={createDocName}
                    onChange={(e) => setCreateDocName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                  />
                  <input
                    type="url"
                    placeholder="URL (https://...)"
                    value={createDocUrl}
                    onChange={(e) => setCreateDocUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
                >
                  {isSubmittingCreate ? "Submitting..." : "Submit Approval Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
