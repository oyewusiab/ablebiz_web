import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  Filter,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { ROLE_DEFINITIONS, type CanonicalStaffRole } from "../../auth/roleConfig";
import { CommunicationComposerModal } from "../../components/admin/communication/CommunicationComposerModal";
import {
  getChannelIcon,
  getStatusBadgeStyle,
} from "../../components/admin/communication/CommunicationHistoryPanel";
import {
  canManageTemplates,
  canSendCommunication,
} from "../../lib/communications/communicationPermissions";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../../lib/communications/emailConfig";
import { checkOfficialEmailServiceStatus } from "../../lib/communications/emailService";
import {
  deleteOrDeactivateTemplate,
  duplicateMessageTemplate,
  loadCommunicationsHistory,
  loadMessageTemplates,
  saveMessageTemplate,
  toggleMessageTemplateActive,
  updateCommunicationStatusAndOutcome,
} from "../../lib/communications/communicationStorage";
import {
  filterTemplates,
  getCategoryMeta,
  TEMPLATE_CATEGORIES,
} from "../../lib/communications/templateCatalogue";
import type {
  ClientContactContext,
  CommunicationChannel,
  CommunicationLogRecord,
  CommunicationStatus,
  MessageTemplate,
  TemplateCategoryId,
  VerificationGuardType,
  WorkflowContextType,
} from "../../lib/communications/types";
import {
  resolveTemplateVariables,
  VARIABLE_REGISTRY,
} from "../../lib/communications/variableEngine";
import { supabase } from "../../lib/supabaseClient";

interface ClientDirectoryItem {
  id: string;
  full_name: string;
  phone: string;
  alt_phone?: string | null;
  email?: string | null;
  referral_code?: string | null;
}

const SAMPLE_PREVIEW_CONTEXT = {
  client_name: "Adebayo Ogunlesi",
  client_phone: "+234 803 123 4567",
  client_email: "adebayo@primegate.com.ng",
  client_business_name: "Primegate Global Ventures",
  contact_person: "Adebayo Ogunlesi",
  business_name: "Primegate Global Ventures",
  business_type: "Business Name Registration",
  business_registration_number: "BN 4192831",
  service_name: "Business Name Registration",
  service_request_reference: "SR-2026-0188",
  assigned_officer: "Chidinma Okafor",
  current_status: "In Progress",
  request_date: "10 Nov 2026",
  relevant_next_step:
    "Verification of uploaded identification documents and CAC portal filing.",
  missing_information_list:
    "• Residential Street Name and LGA\n• Proposed Business Name Option 2",
  registration_type: "Business Name Registration",
  application_reference: "CAC-BN-2026-094",
  current_stage: "Approved",
  approval_date: "10 Nov 2026",
  submission_date: "08 Nov 2026",
  certificate_number: "BN 4192831",
  missing_documents:
    "• Clear photograph of Valid Government ID\n• Signature on plain white paper",
  correction_reason:
    "Uploaded ID card image was slightly blurry on the date of birth.",
  required_correction:
    "Kindly send a clearer photograph of your ID card showing all corners.",
  invoice_number: "INV-2026-0092",
  invoice_amount: "₦35,000.00",
  outstanding_balance: "₦15,000.00",
  due_date: "17 Nov 2026",
  verified_payment_date: "10 Nov 2026",
  receipt_number: "RCP-2026-0211",
  payment_instructions:
    "Bank: Moniepoint MFB\nAccount Name: ABLEBIZ BUSINESS SERVICES\nAccount Number: 8122399110",
  delivery_email: "adebayo@primegate.com.ng",
  delivery_date: "10 Nov 2026",
  feedback_link: "http://bit.ly/ablefeedback",
  referral_code: "ABLE-REF-204",
  referral_link: "https://ablebiz.com.ng/?ref=ABLE-REF-204",
  staff_name: "Oluwaseun Adewale",
  staff_designation: "Client Service Officer",
  business_contact_info: "hello@ablebiz.com.ng | +234 812 239 9110",
};

// Alias for route import
export const ClientCommunicationsPage: React.FC = (props) => <AdminCommunications {...props} />;

export const AdminCommunications: React.FC = () => {
  const { user, profile } = useAuth();
  const staffFullName = profile?.full_name || user?.name || "ABLEBIZ Officer";
  const staffRole = profile?.role || user?.role || "viewer";
  const location = useLocation();

  const isTemplatesRoute = location.pathname.includes(
    "communication-templates"
  );

  const [activeTab, setActiveTab] = useState<
    "history" | "templates" | "email_identity"
  >(isTemplatesRoute ? "templates" : "history");

  useEffect(() => {
    if (isTemplatesRoute) {
      setActiveTab("templates");
    }
  }, [isTemplatesRoute]);

  const canSend = canSendCommunication(staffRole);
  const canEditTemplates = canManageTemplates(staffRole);

  // Data state
  const [communications, setCommunications] = useState<
    CommunicationLogRecord[]
  >([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [clients, setClients] = useState<ClientDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // History filters
  const [historySearch, setHistorySearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedCommId, setExpandedCommId] = useState<string | null>(null);

  // Client selector for initiating new communication from Center
  const [selectedClientIdForNewComm, setSelectedClientIdForNewComm] =
    useState<string>("");
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTemplateId, setComposerTemplateId] = useState<string | null>(
    null
  );

  // Template library filters
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<
    TemplateCategoryId | "all"
  >("all");
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] =
    useState<MessageTemplate | null>(null);

  // Template Editor Modal state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<
    string | undefined
  >(undefined);
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState<TemplateCategoryId>(
    "general_communication"
  );
  const [tplDescription, setTplDescription] = useState("");
  const [tplDefaultChannel, setTplDefaultChannel] =
    useState<CommunicationChannel>("whatsapp");
  const [tplSupportedChannels, setTplSupportedChannels] = useState<
    CommunicationChannel[]
  >(["whatsapp", "email"]);
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplIsActive, setTplIsActive] = useState(true);
  const [tplAllowedRoles, setTplAllowedRoles] = useState<CanonicalStaffRole[]>([
    "super_admin",
    "admin",
    "operations_manager",
    "registration_officer",
    "client_service_officer",
  ]);
  const [tplWorkflowContexts, setTplWorkflowContexts] = useState<
    WorkflowContextType[]
  >(["client_360", "service_request"]);
  const [tplVerificationGuard, setTplVerificationGuard] =
    useState<VerificationGuardType>(null);
  const [templateFeedback, setTemplateFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  // Email Diagnostic state
  const [emailDiag, setEmailDiag] = useState<{
    checked: boolean;
    loading: boolean;
    configured: boolean;
    provider: string;
    message: string;
  }>({
    checked: false,
    loading: false,
    configured: false,
    provider: "unknown",
    message: "",
  });

  const fetchAllData = async () => {
    setLoading(true);
    const [commList, tplList, clientRes] = await Promise.all([
      loadCommunicationsHistory({ limit: 250 }),
      loadMessageTemplates(),
      supabase
        .from("clients")
        .select("id, full_name, phone, alt_phone, email, referral_code")
        .order("full_name", { ascending: true }),
    ]);

    setCommunications(commList);
    setTemplates(tplList);
    if (clientRes.data) {
      setClients(clientRes.data as ClientDirectoryItem[]);
      if (clientRes.data.length > 0 && !selectedClientIdForNewComm) {
        setSelectedClientIdForNewComm(clientRes.data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return communications.filter((c) => {
      if (channelFilter !== "all" && c.channel !== channelFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.summary} ${c.template_name || ""} ${
          c.client?.full_name || c.recipient_name || ""
        } ${c.recipient_phone || ""} ${c.recipient_email || ""} ${
          c.service_request?.tracking_code || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [communications, historySearch, channelFilter, statusFilter]);

  const filteredTemplatesList = useMemo(
    () =>
      filterTemplates(templates, {
        searchQuery: templateSearch,
        category: templateCategoryFilter,
        includeInactive: showInactiveTemplates || canEditTemplates,
        role: canEditTemplates ? null : (user?.role as CanonicalStaffRole),
      }),
    [
      templates,
      templateSearch,
      templateCategoryFilter,
      showInactiveTemplates,
      canEditTemplates,
      user?.role,
    ]
  );

  const selectedClientRecord = useMemo(
    () => clients.find((c) => c.id === selectedClientIdForNewComm) || null,
    [clients, selectedClientIdForNewComm]
  );

  const activeClientContactContext: ClientContactContext = useMemo(() => {
    if (!selectedClientRecord) {
      return {
        clientName: "Select a Client",
      };
    }
    return {
      clientId: selectedClientRecord.id,
      clientName: selectedClientRecord.full_name,
      phone: selectedClientRecord.phone,
      whatsappPhone:
        selectedClientRecord.alt_phone || selectedClientRecord.phone,
      altPhone: selectedClientRecord.alt_phone,
      email: selectedClientRecord.email,
      referralCode: selectedClientRecord.referral_code,
    };
  }, [selectedClientRecord]);

  const handleOpenCreateTemplate = () => {
    setEditingTemplateId(undefined);
    setTplName("");
    setTplCategory("general_communication");
    setTplDescription("");
    setTplDefaultChannel("whatsapp");
    setTplSupportedChannels(["whatsapp", "email"]);
    setTplSubject("");
    setTplBody("Dear {{client_name}},\n\n");
    setTplIsActive(true);
    setTplAllowedRoles([
      "super_admin",
      "admin",
      "operations_manager",
      "registration_officer",
      "client_service_officer",
    ]);
    setTplWorkflowContexts(["client_360", "service_request"]);
    setTplVerificationGuard(null);
    setTemplateFeedback(null);
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tpl: MessageTemplate) => {
    setEditingTemplateId(tpl.id);
    setTplName(tpl.name);
    setTplCategory(tpl.category);
    setTplDescription(tpl.description);
    setTplDefaultChannel(tpl.defaultChannel);
    setTplSupportedChannels([...tpl.supportedChannels]);
    setTplSubject(tpl.subject || "");
    setTplBody(tpl.body);
    setTplIsActive(tpl.isActive);
    setTplAllowedRoles([...tpl.allowedRoles]);
    setTplWorkflowContexts([...tpl.workflowContexts]);
    setTplVerificationGuard(tpl.verificationGuard || null);
    setTemplateFeedback(null);
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const res = await saveMessageTemplate(
      {
        id: editingTemplateId,
        name: tplName,
        category: tplCategory,
        description: tplDescription,
        defaultChannel: tplDefaultChannel,
        supportedChannels: tplSupportedChannels,
        subject: tplSubject || undefined,
        body: tplBody,
        isActive: tplIsActive,
        allowedRoles: tplAllowedRoles,
        workflowContexts: tplWorkflowContexts,
        verificationGuard: tplVerificationGuard,
      },
      {
        staffId: user.id,
        staffName: staffFullName,
        role: staffRole,
      }
    );

    if (!res.success) {
      setTemplateFeedback({
        type: "error",
        text: res.error || "Failed to save template.",
      });
      return;
    }

    const refreshed = await loadMessageTemplates();
    setTemplates(refreshed);
    setIsTemplateModalOpen(false);
    setTemplateFeedback({
      type: res.warnings?.length ? "warning" : "success",
      text: res.warnings?.length
        ? `Template saved with notice: ${res.warnings.join(" ")}`
        : `Template "${res.template?.name}" saved and logged.`,
    });
  };

  const handleDuplicateTemplate = async (tpl: MessageTemplate) => {
    if (!user?.id) return;
    const res = await duplicateMessageTemplate(tpl.id, {
      staffId: user.id,
      staffName: staffFullName,
      role: staffRole,
    });
    if (res.success) {
      const refreshed = await loadMessageTemplates();
      setTemplates(refreshed);
      setTemplateFeedback({
        type: "success",
        text: `Duplicated as "${res.template?.name}".`,
      });
    }
  };

  const handleToggleTemplateStatus = async (tpl: MessageTemplate) => {
    if (!user?.id) return;
    const res = await toggleMessageTemplateActive(tpl.id, !tpl.isActive, {
      staffId: user.id,
      staffName: staffFullName,
      role: staffRole,
    });
    if (res.success) {
      const refreshed = await loadMessageTemplates();
      setTemplates(refreshed);
      setTemplateFeedback({
        type: "success",
        text: `Template "${tpl.name}" is now ${
          !tpl.isActive ? "Active" : "Inactive"
        }.`,
      });
    }
  };

  const handleDeleteTemplate = async (tpl: MessageTemplate) => {
    if (!user?.id) return;
    const res = await deleteOrDeactivateTemplate(tpl.id, {
      staffId: user.id,
      staffName: staffFullName,
      role: staffRole,
    });
    const refreshed = await loadMessageTemplates();
    setTemplates(refreshed);
    setTemplateFeedback({
      type: res.actionTaken === "deactivated" ? "warning" : "success",
      text: res.message,
    });
  };

  const handleQuickMarkSent = async (
    comm: CommunicationLogRecord,
    nextStatus: CommunicationStatus
  ) => {
    if (!user?.id) return;
    await updateCommunicationStatusAndOutcome(
      comm.id,
      { status: nextStatus },
      { staffId: user.id, role: staffRole }
    );
    await fetchAllData();
  };

  const handleRunEmailDiagnostic = async () => {
    setEmailDiag((prev) => ({ ...prev, loading: true }));
    const res = await checkOfficialEmailServiceStatus();
    setEmailDiag({
      checked: true,
      loading: false,
      configured: res.configured,
      provider: res.provider,
      message: res.message,
    });
  };

  // Summary KPIs
  const whatsappCount = communications.filter(
    (c) => c.channel === "whatsapp"
  ).length;
  const emailCount = communications.filter((c) => c.channel === "email").length;
  const confirmedCount = communications.filter(
    (c) => c.status === "sent" || c.status === "confirmed_by_client"
  ).length;
  const activeTemplateCount = templates.filter((t) => t.isActive).length;

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">
              Client Communication & Engagement Workspace
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Official Email: {OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Contact clients via Phone, WhatsApp, and Official Email using
            personalized ABLEBIZ prepared templates, and track full engagement
            history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canEditTemplates && (
            <button
              type="button"
              onClick={handleOpenCreateTemplate}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4 text-emerald-600" />
              New Message Template
            </button>
          )}

          {canSend && (
            <button
              type="button"
              onClick={() => {
                setComposerTemplateId(null);
                setIsClientPickerOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
            >
              <Send className="h-4 w-4" />
              Contact a Client
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Logged Activities
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {communications.length}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              {confirmedCount} confirmed sent / responded
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <MessageSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              WhatsApp Engagements
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {whatsappCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click-to-chat (+234 & Intl E.164)
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <MessageSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Official Client Emails
            </p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {emailCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              From: {OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Mail className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Prepared Templates
            </p>
            <p className="text-2xl font-bold text-purple-700 mt-1">
              {activeTemplateCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Across {TEMPLATE_CATEGORIES.length} official categories
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Communication History ({communications.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "templates"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Prepared Message Library & Templates ({templates.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("email_identity")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "email_identity"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Official Email Identity ({OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail})
        </button>
      </div>

      {templateFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            templateFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : templateFeedback.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{templateFeedback.text}</span>
          <button
            type="button"
            onClick={() => setTemplateFeedback(null)}
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: CLIENT COMMUNICATION HISTORY                                 */}
      {/* =================================================================== */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by client, template, phone, email, or summary..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                aria-label="Filter by communication channel"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
              >
                <option value="all">All Channels</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Official Email</option>
                <option value="phone_call">Phone Call</option>
                <option value="in_person">In Person</option>
                <option value="sms">SMS</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by communication status"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="opened_in_whatsapp">Opened in WhatsApp</option>
                <option value="opened_in_email">Opened in Email App</option>
                <option value="opened_in_phone">Dialed in Phone App</option>
                <option value="sent">Sent</option>
                <option value="confirmed_by_client">Confirmed by Client</option>
                <option value="prepared">Prepared</option>
                <option value="failed">Failed</option>
              </select>

              <button
                type="button"
                onClick={fetchAllData}
                className="p-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
                title="Refresh History"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Date & Channel
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Client & Recipient
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Template & Summary
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Logged By
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-sm text-slate-500"
                      >
                        Loading organization communication history...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-sm text-slate-500"
                      >
                        No communication entries match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((comm) => {
                      const badge = getStatusBadgeStyle(comm.status);
                      const isExpanded = expandedCommId === comm.id;
                      return (
                        <React.Fragment key={comm.id}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                  {getChannelIcon(comm.channel)}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 capitalize">
                                    {comm.channel.replace(/_/g, " ")}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {new Date(comm.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-xs font-bold text-slate-900">
                                {comm.client?.full_name ||
                                  comm.recipient_name ||
                                  "Client"}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {comm.recipient_phone ||
                                  comm.recipient_email ||
                                  comm.client?.phone ||
                                  ""}
                              </div>
                              {comm.service_request?.tracking_code && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded">
                                  Ref: {comm.service_request.tracking_code}
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 max-w-md">
                              {comm.template_name && (
                                <span className="inline-block mb-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {comm.template_name}
                                </span>
                              )}
                              <div className="text-xs font-semibold text-slate-900 line-clamp-1">
                                {comm.subject || comm.summary}
                              </div>
                              <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {comm.message_body || comm.details || ""}
                              </div>
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${badge.classes}`}
                              >
                                {badge.label}
                              </span>
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-700 font-medium">
                              {comm.staff?.full_name || "Staff"}
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {canSend &&
                                  (comm.status === "opened_in_whatsapp" ||
                                    comm.status === "opened_in_email" ||
                                    comm.status === "opened_in_phone" ||
                                    comm.status === "prepared") && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleQuickMarkSent(comm, "sent")
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      Mark Sent
                                    </button>
                                  )}

                                {canSend && comm.status === "sent" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickMarkSent(
                                        comm,
                                        "confirmed_by_client"
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded-lg"
                                  >
                                    <UserCheck className="h-3 w-3" />
                                    Client Confirmed
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedCommId(
                                      isExpanded ? null : comm.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg"
                                >
                                  <Eye className="h-3 w-3" />
                                  {isExpanded ? "Hide" : "View"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={6} className="px-6 py-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 border-b border-slate-100 pb-2">
                                    <div>
                                      <strong>Channel:</strong>{" "}
                                      {comm.channel.toUpperCase()} •{" "}
                                      <strong>Status:</strong> {badge.label}
                                      {comm.channel === "email" && (
                                        <>
                                          {" "}
                                          • <strong>From:</strong>{" "}
                                          {
                                            OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedDisplayFrom
                                          }
                                        </>
                                      )}
                                    </div>
                                    {comm.provider_message_id && (
                                      <span className="font-mono text-[11px] text-slate-500">
                                        Provider Ref: {comm.provider_message_id}
                                      </span>
                                    )}
                                  </div>
                                  {comm.subject && (
                                    <p className="text-xs font-bold text-slate-900">
                                      Subject: {comm.subject}
                                    </p>
                                  )}
                                  <pre className="text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    {comm.message_body ||
                                      comm.details ||
                                      comm.summary}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: PREPARED MESSAGE LIBRARY & TEMPLATE MANAGEMENT               */}
      {/* =================================================================== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {/* Category Pills & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search prepared templates by name, keyword, or variable..."
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <select
                  value={templateCategoryFilter}
                  onChange={(e) =>
                    setTemplateCategoryFilter(
                      e.target.value as TemplateCategoryId | "all"
                    )
                  }
                  aria-label="Filter by template category"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold text-slate-700"
                >
                  <option value="all">
                    All 12 Categories ({templates.length})
                  </option>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                {canEditTemplates && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showInactiveTemplates}
                      onChange={(e) =>
                        setShowInactiveTemplates(e.target.checked)
                      }
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Show Inactive</span>
                  </label>
                )}
              </div>
            </div>

            {/* Category Quick Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setTemplateCategoryFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                  templateCategoryFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All Templates
              </button>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTemplateCategoryFilter(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                    templateCategoryFilter === cat.id
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplatesList.map((tpl) => {
              const catMeta = getCategoryMeta(tpl.category);
              const canManageThis = canManageTemplates(
                user?.role,
                tpl.category
              );

              return (
                <div
                  key={tpl.id}
                  className={`bg-white rounded-xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
                    tpl.isActive
                      ? "border-slate-200 hover:border-slate-300"
                      : "border-slate-200 bg-slate-50/70 opacity-75"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {catMeta.name}
                          </span>
                          {!tpl.isActive && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-200 text-slate-700">
                              Inactive
                            </span>
                          )}
                          {tpl.verificationGuard && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-800">
                              <Lock className="h-2.5 w-2.5" />
                              Guard: {tpl.verificationGuard.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5">
                          {tpl.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {tpl.supportedChannels.map((ch) => (
                          <span
                            key={ch}
                            className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-slate-100 text-slate-700"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">{tpl.description}</p>

                    {tpl.subject && (
                      <div className="text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">
                        <strong>Email Subject:</strong> {tpl.subject}
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap line-clamp-5 font-sans leading-relaxed">
                      {tpl.body}
                    </div>

                    {tpl.supportedVariables.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Variables:
                        </span>
                        {tpl.supportedVariables.map((v) => (
                          <code
                            key={v}
                            className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-700 rounded border border-slate-200"
                          >
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400">
                      Used {tpl.usageCount || 0} times • Updated{" "}
                      {new Date(tpl.updatedAt).toLocaleDateString()}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewingTemplate(tpl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Sample Preview
                      </button>

                      {canSend && tpl.isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setComposerTemplateId(tpl.id);
                            setIsClientPickerOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Use Template
                        </button>
                      )}

                      {canManageThis && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditTemplate(tpl)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit Template"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicateTemplate(tpl)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Duplicate Template"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleTemplateStatus(tpl)}
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title={
                              tpl.isActive
                                ? "Deactivate Template"
                                : "Activate Template"
                            }
                          >
                            <Power className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete or Deactivate Template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: OFFICIAL BUSINESS EMAIL IDENTITY & DIAGNOSTICS               */}
      {/* =================================================================== */}
      {activeTab === "email_identity" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Official ABLEBIZ Business Email Configuration
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                All outbound client emails sent from ABLEBIZ Suite enforce this
                centralized sender identity.
              </p>
            </div>
            <button
              type="button"
              disabled={emailDiag.loading}
              onClick={handleRunEmailDiagnostic}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${emailDiag.loading ? "animate-spin" : ""}`}
              />
              {emailDiag.loading
                ? "Checking Email Service..."
                : "Test Server Email Readiness"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase">
                Official Sender Name
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase">
                Official Sender Email (From)
              </div>
              <div className="text-sm font-bold text-emerald-700 mt-1">
                {OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase">
                Official Reply-To Address
              </div>
              <div className="text-sm font-bold text-blue-700 mt-1">
                {OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail}
              </div>
            </div>
          </div>

          {emailDiag.checked && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                emailDiag.configured
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              {emailDiag.configured ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {emailDiag.configured
                    ? `Server Email Provider Active (${emailDiag.provider.toUpperCase()})`
                    : "Server Email Provider Secret Required for Direct Dispatch"}
                </p>
                <p className="mt-1">{emailDiag.message}</p>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-slate-700 space-y-2">
            <h4 className="font-bold text-slate-900">
              Domain Authentication & Deliverability Checklist for
              ablebiz.com.ng:
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>SPF Record:</strong> Authorize your transactional email
                provider on <code>ablebiz.com.ng</code> so receiving servers
                verify <code>hello@ablebiz.com.ng</code>.
              </li>
              <li>
                <strong>DKIM Signing:</strong> Add the provider's DKIM TXT/CNAME
                records to <code>ablebiz.com.ng</code> DNS.
              </li>
              <li>
                <strong>DMARC Policy:</strong> Publish a <code>_dmarc</code> TXT
                record on <code>ablebiz.com.ng</code> to protect brand
                reputation.
              </li>
              <li>
                <strong>Edge Function Secret:</strong> Set{" "}
                <code>RESEND_API_KEY</code>, <code>BREVO_API_KEY</code>, or{" "}
                <code>SENDGRID_API_KEY</code> in Supabase Edge Function secrets
                for <code>send-client-email</code>.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CLIENT PICKER FOR NEW COMMUNICATION                          */}
      {/* =================================================================== */}
      {isClientPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Select Client to Contact
              </h3>
              <button
                type="button"
                onClick={() => setIsClientPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client Profile
              </label>
              <select
                value={selectedClientIdForNewComm}
                onChange={(e) => setSelectedClientIdForNewComm(e.target.value)}
                aria-label="Select client profile"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.phone || c.email || "No contact"})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClientPickerOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedClientRecord}
                onClick={() => {
                  setIsClientPickerOpen(false);
                  setComposerOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
              >
                Open Communication Studio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SAMPLE TEMPLATE PREVIEW                                      */}
      {/* =================================================================== */}
      {previewingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Sample Preview: {previewingTemplate.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Rendered with sample ABLEBIZ client & registration data
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingTemplate(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {previewingTemplate.subject && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950">
                <div>
                  <strong>From:</strong>{" "}
                  {OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedDisplayFrom}
                </div>
                <div className="mt-1">
                  <strong>Subject:</strong>{" "}
                  {
                    resolveTemplateVariables(
                      previewingTemplate.body,
                      SAMPLE_PREVIEW_CONTEXT,
                      { subject: previewingTemplate.subject }
                    ).resolvedSubject
                  }
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {
                resolveTemplateVariables(
                  previewingTemplate.body,
                  SAMPLE_PREVIEW_CONTEXT
                ).resolvedText
              }
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewingTemplate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE / EDIT PREPARED TEMPLATE                              */}
      {/* =================================================================== */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingTemplateId
                  ? "Edit Prepared Message Template"
                  : "Create Prepared Message Template"}
              </h3>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplateForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="e.g. Post-Incorporation TIN Update"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={tplCategory}
                    onChange={(e) =>
                      setTplCategory(e.target.value as TemplateCategoryId)
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  value={tplDescription}
                  onChange={(e) => setTplDescription(e.target.value)}
                  placeholder="Brief explanation of when staff should use this template..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Default Channel
                  </label>
                  <select
                    value={tplDefaultChannel}
                    onChange={(e) =>
                      setTplDefaultChannel(
                        e.target.value as CommunicationChannel
                      )
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Official Email</option>
                    <option value="phone_call">Phone Call</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Verification Guard
                  </label>
                  <select
                    value={tplVerificationGuard || ""}
                    onChange={(e) =>
                      setTplVerificationGuard(
                        (e.target.value || null) as VerificationGuardType
                      )
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">None (Standard)</option>
                    <option value="cac_approved">
                      Require Confirmed CAC Approval
                    </option>
                    <option value="cac_submitted">
                      Require CAC Submission
                    </option>
                    <option value="payment_verified">
                      Require Verified Payment
                    </option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tplIsActive}
                      onChange={(e) => setTplIsActive(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>Template is Active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Subject (used when sending via Official Email)
                </label>
                <input
                  type="text"
                  value={tplSubject}
                  onChange={(e) => setTplSubject(e.target.value)}
                  placeholder="e.g. Update Regarding {{business_name}} — ABLEBIZ BUSINESS SERVICES"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              {/* Dynamic Variable Insertion Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Insert Supported Dynamic Variable:
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Click any token below to append to message body
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {VARIABLE_REGISTRY.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setTplBody((prev) => `${prev}${v.token}`)}
                      title={`${v.label}: ${v.description}`}
                      className="px-2 py-0.5 text-[11px] font-mono bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 rounded transition-colors"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message Body *
                </label>
                <textarea
                  rows={9}
                  required
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  className="w-full p-3 text-xs font-sans border border-slate-300 rounded-xl leading-relaxed"
                />
              </div>

              {/* Role Access Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Permitted Staff Roles
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(ROLE_DEFINITIONS)
                    .filter((r) => r.canonical !== "viewer")
                    .map((roleDef) => {
                      const checked = tplAllowedRoles.includes(
                        roleDef.canonical
                      );
                      return (
                        <label
                          key={roleDef.canonical}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTplAllowedRoles((prev) => [
                                  ...prev,
                                  roleDef.canonical,
                                ]);
                              } else {
                                setTplAllowedRoles((prev) =>
                                  prev.filter((r) => r !== roleDef.canonical)
                                );
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600"
                          />
                          <span>{roleDef.title}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Composer Modal */}
      <CommunicationComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        contactContext={activeClientContactContext}
        workflowContext="general"
        initialTemplateId={composerTemplateId}
        onCommunicationLogged={() => fetchAllData()}
        onContactUpdated={() => fetchAllData()}
      />
    </div>
  );
};
