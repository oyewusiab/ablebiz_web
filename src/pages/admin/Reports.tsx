import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Gift,
  HeartPulse,
  History,
  Info,
  Layers,
  Lock,
  Megaphone,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  normalizeStaffRole,
  ROLE_DEFINITIONS as ROLE_CONFIGS,
} from "../../auth/roleConfig";
import { useBusinessProfile } from "../../lib/businessProfileContext";
import {
  DocumentHeader,
  DocumentFooter,
} from "../../components/admin/DocumentBranding";
import { METRIC_DEFINITIONS_LIST } from "../../lib/reporting/metricRegistry";
import {
  REPORT_CATEGORIES,
  REPORT_CATALOGUE,
  getReportById,
} from "../../lib/reporting/reportCatalogue";
import {
  canAccessReport,
  canExportReportFormat,
  canPerformReportAction,
  getRoleReportAccessProfile,
  resolveEffectiveReportScope,
} from "../../lib/reporting/reportPermissions";
import {
  createDefaultReportFilterState,
  createEmptyReportingDataset,
  fetchAuthorizedReportingDataset,
  formatMetricValue,
  generateReportPayload,
  type ReportingCallerContext,
  type ReportingRawDataset,
} from "../../lib/reporting/reportEngine";
import {
  exportReportToCsv,
  exportReportToExcel,
  exportReportToPdf,
  recordReportExportAudit,
} from "../../lib/reporting/reportExport";
import {
  createScheduledReport,
  deleteSavedReportConfig,
  deleteScheduledReport,
  loadReportHistory,
  loadSavedReportConfigs,
  loadScheduledReports,
  recordReportHistoryEntry,
  saveReportConfig,
  toggleFavouriteReportConfig,
  toggleScheduledReport,
} from "../../lib/reporting/reportStorage";
import type {
  DrillDownRecordItem,
  GeneratedReportPayload,
  ReportCategoryId,
  ReportComparisonMode,
  ReportFilterState,
  ReportHistoryEntry,
  ReportPeriodPreset,
  SavedReportConfiguration,
  ScheduledReportConfig,
} from "../../lib/reporting/types";

type WorkspaceViewMode =
  | "overview"
  | "catalogue"
  | "generator"
  | "saved_schedules"
  | "metric_registry";

type LegacyQuickTab =
  | "executive"
  | "finance"
  | "operations"
  | "campaigns"
  | "clients"
  | "staff";

export function AdminReports() {
  const { user, profile: staffProfile, hasPermission } = useAuth();
  const { profile: businessProfile } = useBusinessProfile();
  const [rawDataset, setRawDataset] = useState<ReportingRawDataset>(
    createEmptyReportingDataset
  );
  const [loading, setLoading] = useState(true);
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceViewMode>("overview");
  const [legacyQuickTab, setLegacyQuickTab] =
    useState<LegacyQuickTab>("executive");

  // Catalogue & Generator State
  const [selectedCategory, setSelectedCategory] = useState<
    ReportCategoryId | "all"
  >("all");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string>(
    "executive_business_performance"
  );
  const [filters, setFilters] = useState<ReportFilterState>(
    createDefaultReportFilterState
  );

  // Saved Configs, History & Schedules
  const [savedConfigs, setSavedConfigs] = useState<SavedReportConfiguration[]>(
    []
  );
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>([]);
  const [schedules, setSchedules] = useState<ScheduledReportConfig[]>([]);
  const [saveConfigName, setSaveConfigName] = useState("");
  const [showSaveConfigModal, setShowSaveConfigModal] = useState(false);

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<
    "daily" | "weekly" | "monthly" | "quarterly"
  >("monthly");
  const [scheduleFormat, setScheduleFormat] = useState<"pdf" | "xlsx" | "csv">(
    "pdf"
  );
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    []
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Drill-Down Modal State
  const [activeDrillDown, setActiveDrillDown] = useState<{
    title: string;
    route: string;
    items: DrillDownRecordItem[];
  } | null>(null);

  // Metric Registry Search
  const [metricSearch, setMetricSearch] = useState("");

  // Caller Context & Role Access Profile
  const canonicalRole = useMemo(
    () =>
      normalizeStaffRole(staffProfile?.role || user?.role || "viewer") ||
      "viewer",
    [staffProfile?.role, user?.role]
  );

  const callerContext: ReportingCallerContext = useMemo(
    () => ({
      staffId: staffProfile?.id || user?.id || "",
      fullName: staffProfile?.full_name || user?.name || "Authorized Staff",
      email: staffProfile?.email || user?.email || "",
      role: canonicalRole,
      department:
        staffProfile?.department ||
        user?.department ||
        ROLE_CONFIGS[canonicalRole]?.department ||
        "Operations",
      hasPermission: (mod, act) => hasPermission(mod, act as any),
    }),
    [staffProfile, user, canonicalRole, hasPermission]
  );

  const roleAccessProfile = useMemo(
    () =>
      getRoleReportAccessProfile(canonicalRole, callerContext.hasPermission),
    [canonicalRole, callerContext.hasPermission]
  );

  // Ensure selectedReportId is always an authorized report for this user
  useEffect(() => {
    if (
      roleAccessProfile.allowedReportIds.length > 0 &&
      !roleAccessProfile.allowedReportIds.includes(selectedReportId)
    ) {
      setSelectedReportId(roleAccessProfile.allowedReportIds[0]);
    }
  }, [roleAccessProfile.allowedReportIds, selectedReportId]);

  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const [dataset, configs, history, scheds] = await Promise.all([
          fetchAuthorizedReportingDataset(supabase, callerContext),
          loadSavedReportConfigs(supabase, callerContext.staffId, canonicalRole),
          loadReportHistory(supabase, callerContext.staffId, canonicalRole),
          loadScheduledReports(supabase, callerContext.staffId, canonicalRole),
        ]);
        setRawDataset(dataset);
        setSavedConfigs(configs);
        setReportHistory(history);
        setSchedules(scheds);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [canonicalRole, callerContext.staffId]);

  const showToast = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Authorized Reports Catalogue
  const authorizedCatalogue = useMemo(
    () =>
      REPORT_CATALOGUE.filter((r) =>
        canAccessReport(canonicalRole, r, callerContext.hasPermission)
      ),
    [canonicalRole, callerContext.hasPermission]
  );

  const filteredCatalogue = useMemo(() => {
    return authorizedCatalogue.filter((r) => {
      if (selectedCategory !== "all" && r.category !== selectedCategory) {
        return false;
      }
      if (catalogueSearch.trim()) {
        const q = catalogueSearch.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.categoryLabel.toLowerCase().includes(q) ||
          r.purpose.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [authorizedCatalogue, selectedCategory, catalogueSearch]);

  // Selected Report Entry
  const selectedReportEntry = useMemo(
    () =>
      getReportById(selectedReportId) ||
      authorizedCatalogue[0] ||
      REPORT_CATALOGUE[0],
    [selectedReportId, authorizedCatalogue]
  );

  // Active Generated Report Payload
  const activePayload: GeneratedReportPayload | null = useMemo(() => {
    if (!selectedReportEntry) return null;
    if (
      !canAccessReport(
        canonicalRole,
        selectedReportEntry,
        callerContext.hasPermission
      )
    ) {
      return null;
    }
    try {
      return generateReportPayload(
        selectedReportEntry.id,
        filters,
        callerContext,
        rawDataset
      );
    } catch {
      return null;
    }
  }, [selectedReportEntry, filters, callerContext, rawDataset, canonicalRole]);

  // Also generate an Executive / Primary Overview payload for the Quick Overview tab
  const quickOverviewReportId = useMemo(() => {
    const map: Record<LegacyQuickTab, string> = {
      executive: "executive_business_performance",
      finance: "revenue_report",
      operations: "cac_registration_performance_report",
      campaigns: "office_opening_campaign_report",
      clients: "client_acquisition_report",
      staff: "staff_performance_report",
    };
    const candidate = map[legacyQuickTab];
    if (roleAccessProfile.allowedReportIds.includes(candidate)) {
      return candidate;
    }
    return roleAccessProfile.allowedReportIds[0] || "service_delivery_report";
  }, [legacyQuickTab, roleAccessProfile.allowedReportIds]);

  const quickOverviewPayload: GeneratedReportPayload | null = useMemo(() => {
    try {
      return generateReportPayload(
        quickOverviewReportId,
        filters,
        callerContext,
        rawDataset
      );
    } catch {
      return null;
    }
  }, [quickOverviewReportId, filters, callerContext, rawDataset]);

  // Distinct departments and service categories from live dataset
  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    for (const s of rawDataset.staffProfiles || []) {
      if (s?.department) depts.add(String(s.department));
    }
    return Array.from(depts).sort();
  }, [rawDataset.staffProfiles]);

  const availableServiceCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of rawDataset.services || []) {
      if (s?.category) cats.add(String(s.category));
    }
    return Array.from(cats).sort();
  }, [rawDataset.services]);

  // Handlers for opening a report in the Generator
  const handleOpenReportInGenerator = async (reportId: string) => {
    setSelectedReportId(reportId);
    setWorkspaceMode("generator");
    const target = getReportById(reportId);
    if (target) {
      try {
        const payload = generateReportPayload(
          target.id,
          filters,
          callerContext,
          rawDataset
        );
        const entry = await recordReportHistoryEntry(
          supabase,
          payload,
          "preview"
        );
        setReportHistory((prev) => [entry, ...prev.slice(0, 49)]);
      } catch {
        // Ignore history log error
      }
    }
  };

  const handleExport = async (
    format: "pdf" | "xlsx" | "csv" | "print",
    payloadToExport: GeneratedReportPayload | null = activePayload
  ) => {
    if (!payloadToExport) return;
    if (
      !canExportReportFormat(
        canonicalRole,
        payloadToExport.reportId,
        format,
        callerContext.hasPermission
      )
    ) {
      showToast("Your role is not authorized to export this report.");
      return;
    }

    if (format === "pdf") {
      exportReportToPdf(payloadToExport, businessProfile);
      showToast(`Exported "${payloadToExport.title}" as Executive PDF.`);
    } else if (format === "xlsx") {
      exportReportToExcel(payloadToExport, businessProfile);
      showToast(`Exported "${payloadToExport.title}" as Multi-Sheet Excel (.xlsx).`);
    } else if (format === "csv") {
      exportReportToCsv(payloadToExport, businessProfile);
      showToast(`Exported "${payloadToExport.title}" as UTF-8 CSV.`);
    } else if (format === "print") {
      window.print();
    }

    await recordReportExportAudit(supabase, payloadToExport, format);
    const hist = await recordReportHistoryEntry(
      supabase,
      payloadToExport,
      format
    );
    setReportHistory((prev) => [hist, ...prev.slice(0, 49)]);
  };

  const handleSaveCurrentConfig = async (asFavourite = false) => {
    if (!selectedReportEntry) return;
    try {
      const saved = await saveReportConfig(supabase, {
        name:
          saveConfigName.trim() ||
          `${selectedReportEntry.shortTitle} (${filters.period.replace(/_/g, " ")})`,
        reportId: selectedReportEntry.id,
        filters,
        isFavourite: asFavourite,
        staffId: callerContext.staffId,
        staffName: callerContext.fullName,
        role: canonicalRole,
      });
      setSavedConfigs((prev) => [saved, ...prev]);
      setSaveConfigName("");
      setShowSaveConfigModal(false);
      showToast(`Saved report configuration "${saved.name}".`);
    } catch (err: any) {
      showToast(err?.message || "Could not save configuration.");
    }
  };

  const handleCreateSchedule = async () => {
    setScheduleError(null);
    if (!selectedReportEntry) return;

    const recipientProfiles = (rawDataset.staffProfiles || [])
      .filter((s) => selectedRecipientIds.includes(String(s.id)))
      .map((s) => ({
        id: String(s.id),
        full_name: String(s.full_name || s.email || "Staff"),
        role: s.role || "viewer",
      }));

    if (recipientProfiles.length === 0) {
      // Default to current user if none selected
      recipientProfiles.push({
        id: callerContext.staffId || "self",
        full_name: callerContext.fullName,
        role: canonicalRole,
      });
    }

    try {
      const created = await createScheduledReport(supabase, {
        reportId: selectedReportEntry.id,
        frequency: scheduleFrequency,
        outputFormat: scheduleFormat,
        recipients: recipientProfiles,
        filters,
        creatorStaffId: callerContext.staffId,
        creatorName: callerContext.fullName,
        creatorRole: canonicalRole,
      });
      setSchedules((prev) => [created, ...prev]);
      setShowScheduleModal(false);
      setSelectedRecipientIds([]);
      showToast(
        `Scheduled "${created.reportTitle}" (${created.frequency.toUpperCase()}).`
      );
    } catch (err: any) {
      setScheduleError(
        err?.message || "Failed to create scheduled report configuration."
      );
    }
  };

  const activePayloadToRender =
    workspaceMode === "overview"
      ? quickOverviewPayload || activePayload
      : activePayload;

  return (
    <div className="space-y-6">
      {/* Official Print Header (Only visible when printing) */}
      <div className="hidden print:block">
        <DocumentHeader
          title={
            activePayloadToRender?.title ||
            "Executive Business Intelligence Report"
          }
          documentNumber={
            activePayloadToRender?.documentNumber ||
            `ABL-RPT-${new Date().getFullYear()}`
          }
          date={new Date().toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          status={activePayloadToRender?.scopeDescription || "OFFICIAL REPORT"}
          hidePaymentPending
        />
      </div>

      {/* Toast Feedback Banner */}
      {statusFeedback && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-[#0a192f] text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500/40 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusFeedback}</span>
          <button
            onClick={() => setStatusFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Executive Workspace Header */}
      <div className="no-print bg-gradient-to-r from-[#0a192f] via-[#112240] to-[#0f2942] rounded-2xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3 h-3" />
                Enterprise BI & Executive Reporting
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-slate-200">
                <Shield className="w-3 h-3 text-amber-400" />
                Role: {roleAccessProfile.roleTitle}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                <Layers className="w-3 h-3" />
                Default Scope:{" "}
                {roleAccessProfile.defaultDataScope.toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-slate-300">
                {authorizedCatalogue.length} Authorized Reports
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Business Intelligence & Executive Reporting Workspace
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Authoritative, role-scoped financial, operational, CAC, CRM, HR,
              campaign, referral, and governance analytics grounded directly in
              verified ABLEBIZ Suite records.
            </p>
          </div>

          {/* Primary Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadWorkspaceData}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors border border-white/15"
              title="Refresh live Supabase data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Data
            </button>

            {roleAccessProfile.canExportPdf && activePayloadToRender && (
              <button
                onClick={() => handleExport("pdf", activePayloadToRender)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Export PDF
              </button>
            )}

            {roleAccessProfile.canExportExcel && activePayloadToRender && (
              <button
                onClick={() => handleExport("xlsx", activePayloadToRender)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export Excel (.xlsx)
              </button>
            )}

            {roleAccessProfile.canExportCsv && activePayloadToRender && (
              <button
                onClick={() => handleExport("csv", activePayloadToRender)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors border border-white/15"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            )}

            {roleAccessProfile.canPrintReports && activePayloadToRender && (
              <button
                onClick={() => handleExport("print", activePayloadToRender)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors border border-white/15"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            )}
          </div>
        </div>

        {/* Workspace Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-white/10">
          {[
            {
              id: "overview",
              label: "BI Overview & Quick Tabs",
              icon: BarChart3,
            },
            {
              id: "catalogue",
              label: `Report Catalogue (${authorizedCatalogue.length})`,
              icon: FolderKanban,
            },
            {
              id: "generator",
              label: "Report Generator & Executive Preview",
              icon: FileText,
            },
            {
              id: "saved_schedules",
              label: `Saved, History & Schedules (${savedConfigs.length + schedules.length})`,
              icon: History,
            },
            {
              id: "metric_registry",
              label: `Metric Registry (${METRIC_DEFINITIONS_LIST.length})`,
              icon: BookOpen,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = workspaceMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setWorkspaceMode(tab.id as WorkspaceViewMode)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Period & Comparison Bar (Always accessible in Overview & Generator) */}
      {(workspaceMode === "overview" || workspaceMode === "generator") && (
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>Reporting Period & Dynamic Filters</span>
              {selectedReportEntry && workspaceMode === "generator" && (
                <span className="text-slate-400 font-normal normal-case">
                  • Tailored for{" "}
                  <strong className="text-slate-700">
                    {selectedReportEntry.title}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowSaveConfigModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
              >
                <Save className="w-3.5 h-3.5 text-emerald-600" />
                Save Filter Preset
              </button>
              <button
                onClick={() => handleSaveCurrentConfig(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800"
              >
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                Favourite
              </button>
              {roleAccessProfile.canManageSchedules && (
                <button
                  onClick={() => {
                    setScheduleError(null);
                    setShowScheduleModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-800"
                >
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Schedule Report
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mt-3">
            {/* Period Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Reporting Period
              </label>
              <select
                value={filters.period}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    period: e.target.value as ReportPeriodPreset,
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Year</option>
                <option value="campaign_window">
                  Office Opening Campaign (13 Apr – 13 May 2026)
                </option>
                <option value="custom">Custom Date Range</option>
                <option value="all">All Time Historical</option>
              </select>
            </div>

            {/* Custom Date Inputs */}
            {filters.period === "custom" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, startDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
              </>
            )}

            {/* Comparison Mode (shown if relevant to report) */}
            {(workspaceMode === "overview" ||
              selectedReportEntry.availableFilters.includes("comparison")) && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Comparison Baseline
                </label>
                <select
                  value={filters.comparisonMode}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      comparisonMode: e.target.value as ReportComparisonMode,
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="previous_period">Immediate Prior Period</option>
                  <option value="previous_year">Same Period Prior Year</option>
                  <option value="none">No Comparison</option>
                </select>
              </div>
            )}

            {/* Department Filter (only shown when relevant to report & authorized) */}
            {roleAccessProfile.canAccessOrgWideData &&
              (workspaceMode === "overview" ||
                selectedReportEntry.availableFilters.includes("department")) && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Department / Unit
                  </label>
                  <select
                    value={filters.department}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, department: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="all">All Departments</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* Staff Officer Filter (only shown when relevant to report & authorized) */}
            {roleAccessProfile.canAccessDepartmentData &&
              selectedReportEntry.availableFilters.includes("staff") && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Assigned Staff / Officer
                  </label>
                  <select
                    value={filters.staffId}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, staffId: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="all">All Authorised Staff</option>
                    {(rawDataset.staffProfiles || []).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name || st.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* Service Category Filter (only when relevant) */}
            {selectedReportEntry.availableFilters.includes(
              "service_category"
            ) && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Service Category
                </label>
                <select
                  value={filters.serviceCategory}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      serviceCategory: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="all">All Service Categories</option>
                  {availableServiceCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Client Filter (only when relevant) */}
            {selectedReportEntry.availableFilters.includes("client") && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Client Account
                </label>
                <select
                  value={filters.clientId}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, clientId: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="all">All Clients</option>
                  {(rawDataset.clients || []).slice(0, 100).map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.full_name || cl.company_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 1: BI OVERVIEW & PRESERVED QUICK TABS
         ===================================================================== */}
      {workspaceMode === "overview" && (
        <div className="space-y-6">
          {/* Preserved Quick Category Tabs */}
          <div className="no-print flex items-center gap-2 overflow-x-auto pb-1">
            {(
              [
                {
                  id: "executive",
                  label: "Executive Overview",
                  icon: BarChart3,
                  visible: true,
                },
                {
                  id: "finance",
                  label: "Revenue & Finance",
                  icon: DollarSign,
                  visible: roleAccessProfile.canViewSensitiveFinancials,
                },
                {
                  id: "operations",
                  label: "Operations & CAC",
                  icon: Briefcase,
                  visible: true,
                },
                {
                  id: "campaigns",
                  label: "Campaigns & Referrals",
                  icon: Megaphone,
                  visible:
                    roleAccessProfile.allowedCategories.includes("marketing"),
                },
                {
                  id: "clients",
                  label: "Clients & Leads",
                  icon: Users,
                  visible: roleAccessProfile.allowedCategories.includes("crm"),
                },
                {
                  id: "staff",
                  label: "Staff & HR",
                  icon: UserCheck,
                  visible: roleAccessProfile.allowedCategories.includes("hr"),
                },
              ] as const
            )
              .filter((t) => t.visible)
              .map((tab) => {
                const Icon = tab.icon;
                const active = legacyQuickTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setLegacyQuickTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      active
                        ? "bg-[#0a192f] text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
          </div>

          {/* Render the Live Executive Report Preview for the active Quick Tab */}
          {quickOverviewPayload && (
            <ExecutiveReportPreviewView
              payload={quickOverviewPayload}
              canViewDetailedRecords={roleAccessProfile.canViewDetailedRecords}
              onOpenDrillDown={(key) => {
                const group = quickOverviewPayload.drillDownGroups[key];
                if (group) setActiveDrillDown(group);
              }}
              onSwitchToFullGenerator={() => {
                setSelectedReportId(quickOverviewPayload.reportId);
                setWorkspaceMode("generator");
              }}
              isQuickOverview
            />
          )}

          {/* Quick Category Directory Cards */}
          <div className="no-print bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Explore All {authorizedCatalogue.length} Role-Authorized
                  Reports Across {roleAccessProfile.allowedCategories.length}{" "}
                  Categories
                </h2>
                <p className="text-xs text-slate-500">
                  Select any category below or open the full Report Catalogue to
                  generate board-ready management reports.
                </p>
              </div>
              <button
                onClick={() => setWorkspaceMode("catalogue")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Open Full Catalogue
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {REPORT_CATEGORIES.filter((cat) =>
                roleAccessProfile.allowedCategories.includes(cat.id)
              ).map((cat) => {
                const catReports = authorizedCatalogue.filter(
                  (r) => r.category === cat.id
                );
                return (
                  <div
                    key={cat.id}
                    className="rounded-xl border border-slate-200 p-4 hover:border-emerald-500/50 hover:shadow-md transition-all bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          {catReports.length} Reports
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {cat.label}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {cat.description}
                      </p>
                      <ul className="mt-3 space-y-1">
                        {catReports.slice(0, 3).map((r) => (
                          <li key={r.id}>
                            <button
                              onClick={() => handleOpenReportInGenerator(r.id)}
                              className="text-left text-xs font-medium text-blue-700 hover:underline flex items-center gap-1"
                            >
                              <ChevronRight className="w-3 h-3 shrink-0" />
                              <span className="truncate">{r.shortTitle}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setWorkspaceMode("catalogue");
                      }}
                      className="mt-4 w-full py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      View All {catReports.length} Reports
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: FULL REPORT CATALOGUE (7 CATEGORIES, 78 REPORTS)
         ===================================================================== */}
      {workspaceMode === "catalogue" && (
        <div className="no-print space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Enterprise Report Catalogue ({filteredCatalogue.length} of{" "}
                  {authorizedCatalogue.length} Reports)
                </h2>
                <p className="text-xs text-slate-500">
                  Filtered automatically according to your canonical role (
                  {roleAccessProfile.roleTitle}) and module permissions.
                </p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  placeholder="Search reports by title, purpose, or metric..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  selectedCategory === "all"
                    ? "bg-[#0a192f] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Categories ({authorizedCatalogue.length})
              </button>
              {REPORT_CATEGORIES.filter((c) =>
                roleAccessProfile.allowedCategories.includes(c.id)
              ).map((cat) => {
                const count = authorizedCatalogue.filter(
                  (r) => r.category === cat.id
                ).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      selectedCategory === cat.id
                        ? "bg-[#0a192f] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalogue.map((rep) => {
              const scope = resolveEffectiveReportScope(canonicalRole, rep);
              return (
                <div
                  key={rep.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {rep.categoryLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {rep.frequency}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                          {scope}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">
                      {rep.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {rep.description}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <strong className="text-slate-700">Purpose:</strong>{" "}
                      {rep.purpose}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-1">
                      {rep.authoritativeSources.map((src) => (
                        <span
                          key={src}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                      {rep.supportedFormats.map((fmt) => (
                        <span
                          key={fmt}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleOpenReportInGenerator(rep.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a192f] hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Generate Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 3: REPORT GENERATOR & EXECUTIVE PREVIEW
         ===================================================================== */}
      {workspaceMode === "generator" && (
        <div className="space-y-6">
          {/* Report Selector Bar */}
          <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  1. Select Report Category
                </label>
                <select
                  value={selectedReportEntry.category}
                  onChange={(e) => {
                    const cat = e.target.value as ReportCategoryId;
                    const firstInCat = authorizedCatalogue.find(
                      (r) => r.category === cat
                    );
                    if (firstInCat) setSelectedReportId(firstInCat.id);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                >
                  {REPORT_CATEGORIES.filter((c) =>
                    roleAccessProfile.allowedCategories.includes(c.id)
                  ).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  2. Select Specific Report Template
                </label>
                <select
                  value={selectedReportEntry.id}
                  onChange={(e) => setSelectedReportId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                >
                  {authorizedCatalogue
                    .filter((r) => r.category === selectedReportEntry.category)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.frequency})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Drill-Down Module Links */}
            {selectedReportEntry.drillDownRoutes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedReportEntry.drillDownRoutes.map((dr) => (
                  <Link
                    key={dr.route}
                    to={dr.route}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    <span>{dr.label}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {activePayload ? (
            <ExecutiveReportPreviewView
              payload={activePayload}
              canViewDetailedRecords={roleAccessProfile.canViewDetailedRecords}
              onOpenDrillDown={(key) => {
                const group = activePayload.drillDownGroups[key];
                if (group) setActiveDrillDown(group);
              }}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center">
              <Lock className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900">
                Report Access Restricted
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Your current role ({roleAccessProfile.roleTitle}) is not
                authorized to generate this report.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 4: SAVED CONFIGURATIONS, EXECUTION HISTORY & SCHEDULED REPORTS
         ===================================================================== */}
      {workspaceMode === "saved_schedules" && (
        <div className="no-print space-y-6">
          {/* Saved & Favourite Report Configurations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Saved Report Configurations & Favourites ({savedConfigs.length}
                  )
                </h2>
                <p className="text-xs text-slate-500">
                  One-click access to your frequently used report filter presets.
                </p>
              </div>
              <button
                onClick={() => setShowSaveConfigModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
              >
                <Plus className="w-3.5 h-3.5" />
                Save Current Config
              </button>
            </div>

            {savedConfigs.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                No saved report configurations yet. Use the{" "}
                <strong>Save Filter Preset</strong> or{" "}
                <strong>Favourite</strong> button in the Report Generator to
                bookmark configurations.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedConfigs.map((cfg) => (
                  <div
                    key={cfg.id}
                    className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {cfg.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={async () => {
                              const updated =
                                await toggleFavouriteReportConfig(
                                  supabase,
                                  cfg.id
                                );
                              setSavedConfigs(updated);
                            }}
                            className="p-1 text-amber-500 hover:bg-amber-50 rounded"
                            title="Toggle Favourite"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                cfg.isFavourite ? "fill-amber-400" : ""
                              }`}
                            />
                          </button>
                          <button
                            onClick={async () => {
                              const updated = await deleteSavedReportConfig(
                                supabase,
                                cfg.id
                              );
                              setSavedConfigs(updated);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete Saved Config"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Period: <strong>{cfg.filters.period}</strong> •
                        Comparison: <strong>{cfg.filters.comparisonMode}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFilters(cfg.filters);
                        handleOpenReportInGenerator(cfg.reportId);
                      }}
                      className="mt-3 w-full py-1.5 rounded-lg bg-[#0a192f] text-white text-xs font-bold hover:bg-slate-800"
                    >
                      Load & Generate Report
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled Reports */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Scheduled Management Reports ({schedules.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Automated daily, weekly, monthly, and quarterly report
                  schedules with strict recipient role validation.
                </p>
              </div>
              {roleAccessProfile.canManageSchedules && (
                <button
                  onClick={() => {
                    setScheduleError(null);
                    setShowScheduleModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Schedule
                </button>
              )}
            </div>

            {schedules.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                No scheduled reports configured yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-left">
                      <th className="p-3 rounded-tl-xl">Report Title</th>
                      <th className="p-3">Frequency</th>
                      <th className="p-3">Format</th>
                      <th className="p-3">Authorised Recipients</th>
                      <th className="p-3">Next Run</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 rounded-tr-xl text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedules.map((sch) => (
                      <tr key={sch.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">
                          {sch.reportTitle}
                        </td>
                        <td className="p-3 uppercase font-semibold text-slate-700">
                          {sch.frequency}
                        </td>
                        <td className="p-3 uppercase font-mono text-slate-700">
                          {sch.outputFormat}
                        </td>
                        <td className="p-3 text-slate-600">
                          {sch.recipientNames.join(", ")}
                        </td>
                        <td className="p-3 text-slate-600">
                          {new Date(sch.nextRunAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              sch.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {sch.isActive ? "Active" : "Paused"}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={async () => {
                              const updated = await toggleScheduledReport(
                                supabase,
                                sch.id
                              );
                              setSchedules(updated);
                            }}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            {sch.isActive ? "Pause" : "Resume"}
                          </button>
                          <button
                            onClick={async () => {
                              const updated = await deleteScheduledReport(
                                supabase,
                                sch.id
                              );
                              setSchedules(updated);
                            }}
                            className="text-rose-600 hover:underline font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Report Execution History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Recent Report Generation & Export History ({reportHistory.length})
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Audit log of generated and exported reports with one-click
              re-execution.
            </p>

            {reportHistory.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                No report executions logged in this session yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-left">
                      <th className="p-3 rounded-tl-xl">Document #</th>
                      <th className="p-3">Report Title</th>
                      <th className="p-3">Period</th>
                      <th className="p-3">Scope</th>
                      <th className="p-3">Action / Format</th>
                      <th className="p-3">Generated By</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3 rounded-tr-xl text-right">Re-run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportHistory.slice(0, 25).map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-700">
                          {h.documentNumber}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {h.reportTitle}
                        </td>
                        <td className="p-3 text-slate-600">
                          {h.reportingPeriodLabel}
                        </td>
                        <td className="p-3 uppercase text-slate-600">
                          {h.scopeApplied}
                        </td>
                        <td className="p-3 uppercase font-mono font-bold text-emerald-700">
                          {h.outputFormat}
                        </td>
                        <td className="p-3 text-slate-600">
                          {h.generatedByName}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(h.generatedAt).toLocaleString("en-NG")}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              if (h.filtersApplied?.period) {
                                setFilters(h.filtersApplied);
                              }
                              handleOpenReportInGenerator(h.reportId);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800"
                          >
                            Open
                          </button>
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

      {/* =====================================================================
          MODE 5: CENTRAL METRIC DEFINITION REGISTRY
         ===================================================================== */}
      {workspaceMode === "metric_registry" && (
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Central Reporting Metric Definition Registry (
                {METRIC_DEFINITIONS_LIST.length} Authoritative Metrics)
              </h2>
              <p className="text-xs text-slate-500">
                Single source of truth for formulas, database tables, date
                fields, default filters, and known limitations across ABLEBIZ
                Suite.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={metricSearch}
                onChange={(e) => setMetricSearch(e.target.value)}
                placeholder="Search metric name, formula, or table..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {METRIC_DEFINITIONS_LIST.filter((m) => {
              if (!metricSearch.trim()) return true;
              const q = metricSearch.toLowerCase();
              return (
                m.name.toLowerCase().includes(q) ||
                m.description.toLowerCase().includes(q) ||
                m.calculationFormula.toLowerCase().includes(q) ||
                m.authoritativeSource.toLowerCase().includes(q)
              );
            }).map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {m.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-200 text-slate-800">
                    Unit: {m.unit}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{m.description}</p>
                <div className="text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-slate-800">
                  <strong>Formula:</strong> {m.calculationFormula}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>
                    <strong>Source Table:</strong>{" "}
                    <code className="text-blue-700">{m.authoritativeSource}</code>
                  </div>
                  <div>
                    <strong>Date Field:</strong>{" "}
                    <code className="text-emerald-700">
                      {m.applicableDateField}
                    </code>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200/70">
                  <strong>Governance Note:</strong> {m.knownLimitations}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Official Print Footer */}
      <DocumentFooter
        documentId={activePayloadToRender?.documentNumber}
        notes={`Confidential ABLEBIZ Suite Management Report • Generated by ${callerContext.fullName} (${roleAccessProfile.roleTitle}) • Scope: ${activePayloadToRender?.scopeDescription || roleAccessProfile.defaultDataScope}`}
      />

      {/* =====================================================================
          DRILL-DOWN TRACEABILITY MODAL (PART 8)
         ===================================================================== */}
      {activeDrillDown && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  Authorised Source Record Traceability
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {activeDrillDown.title} ({activeDrillDown.items.length}{" "}
                  Records)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={activeDrillDown.route}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0a192f] text-white text-xs font-bold hover:bg-slate-800"
                >
                  Open Module Workspace
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => setActiveDrillDown(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {activeDrillDown.items.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No underlying source records found for this metric in the
                  selected reporting window.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-left">
                      <th className="p-2.5 rounded-tl-lg">Reference</th>
                      <th className="p-2.5">Record / Subject</th>
                      <th className="p-2.5">Details</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5 text-right">Value / Metric</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 rounded-tr-lg text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeDrillDown.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-800">
                          {item.reference}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900">
                          {item.title}
                        </td>
                        <td className="p-2.5 text-slate-500">{item.subtitle}</td>
                        <td className="p-2.5 text-slate-600">
                          {item.dateLabel}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {item.amountOrMetric || "—"}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <Link
                            to={item.route}
                            className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-1"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SAVE CONFIGURATION MODAL
         ===================================================================== */}
      {showSaveConfigModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Save Report Filter Configuration
              </h3>
              <button
                onClick={() => setShowSaveConfigModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Configuration Name
              </label>
              <input
                type="text"
                value={saveConfigName}
                onChange={(e) => setSaveConfigName(e.target.value)}
                placeholder={`e.g. Monthly ${selectedReportEntry.shortTitle}`}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSaveConfigModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveCurrentConfig(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCHEDULE REPORT MODAL (WITH RECIPIENT RBAC VALIDATION)
         ===================================================================== */}
      {showScheduleModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Schedule Automated Report Delivery
                </h3>
                <p className="text-xs text-slate-500">
                  Report: <strong>{selectedReportEntry.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scheduleError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {scheduleError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Frequency
                </label>
                <select
                  value={scheduleFrequency}
                  onChange={(e) =>
                    setScheduleFrequency(e.target.value as any)
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (Mondays)</option>
                  <option value="monthly">Monthly (1st of Month)</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Output Format
                </label>
                <select
                  value={scheduleFormat}
                  onChange={(e) => setScheduleFormat(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="pdf">Executive PDF</option>
                  <option value="xlsx">Excel Workbook (.xlsx)</option>
                  <option value="csv">UTF-8 CSV</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recipients (Validated against Report Role Permissions)
              </label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                {(rawDataset.staffProfiles || []).map((st) => {
                  const stRole = normalizeStaffRole(st.role) || "viewer";
                  const authorized = canAccessReport(
                    stRole,
                    selectedReportEntry
                  );
                  const checked = selectedRecipientIds.includes(String(st.id));
                  return (
                    <label
                      key={st.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-white text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const id = String(st.id);
                            setSelectedRecipientIds((prev) =>
                              e.target.checked
                                ? [...prev, id]
                                : prev.filter((x) => x !== id)
                            );
                          }}
                        />
                        <span className="font-semibold text-slate-800">
                          {st.full_name || st.email}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          authorized
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {stRole} {authorized ? "✓" : "(Unauthorized)"}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Selecting an unauthorized recipient will be blocked by the RBAC
                validator to prevent data leakage.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchedule}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable Executive Report Preview Component (used in both Quick BI Overview and Full Report Generator)
 */
function ExecutiveReportPreviewView({
  payload,
  canViewDetailedRecords,
  onOpenDrillDown,
  onSwitchToFullGenerator,
  isQuickOverview = false,
}: {
  payload: GeneratedReportPayload;
  canViewDetailedRecords: boolean;
  onOpenDrillDown: (key: string) => void;
  onSwitchToFullGenerator?: () => void;
  isQuickOverview?: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Report Metadata Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-900 text-white">
                {payload.categoryLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                REF: {payload.documentNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                Scope: {payload.scopeDescription}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {payload.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{payload.subtitle}</p>
          </div>

          <div className="flex flex-col sm:items-end text-xs text-slate-500 space-y-0.5">
            <div>
              <strong className="text-slate-700">Reporting Window:</strong>{" "}
              {payload.periodWindow.label}
            </div>
            <div>
              <strong className="text-slate-700">Comparison Baseline:</strong>{" "}
              {payload.periodWindow.comparisonLabel}
            </div>
            <div>
              <strong className="text-slate-700">Prepared By:</strong>{" "}
              {payload.generatedBy.name} ({payload.generatedBy.roleTitle}) •{" "}
              {payload.generatedAtFormatted}
            </div>
            {isQuickOverview && onSwitchToFullGenerator && (
              <button
                onClick={onSwitchToFullGenerator}
                className="no-print mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                Open in Full Report Generator
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Executive Summary Narrative */}
        <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            Executive Summary Narrative
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {payload.insights.executiveNarrative}
          </p>
        </div>

        {/* Data Limitations / Governance Banner (if any) */}
        {payload.dataLimitations.length > 0 && (
          <div className="mt-3 bg-amber-50/80 border border-amber-200 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 mb-1">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Data Scope & Methodological Transparency Notes</span>
            </div>
            <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
              {payload.dataLimitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Key Performance Indicators Grid */}
      {payload.kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {payload.kpis.map((kpi) => {
            const isUp = kpi.comparison.direction === "up";
            const isDown = kpi.comparison.direction === "down";
            const goodWhenUp = kpi.isPositiveWhenUp !== false;
            const badgePositive =
              (isUp && goodWhenUp) || (isDown && !goodWhenUp);
            const badgeNegative =
              (isDown && goodWhenUp) || (isUp && !goodWhenUp);

            const hasDrillDown = Boolean(
              canViewDetailedRecords &&
                kpi.drillDownKey &&
                payload.drillDownGroups[kpi.drillDownKey]
            );

            return (
              <div
                key={kpi.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {kpi.label}
                    </span>
                    {kpi.comparison.direction !== "na" && (
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          badgePositive
                            ? "bg-emerald-50 text-emerald-700"
                            : badgeNegative
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isUp && <ArrowUpRight className="w-3 h-3" />}
                        {isDown && <ArrowDownRight className="w-3 h-3" />}
                        {kpi.comparison.formattedPercentage}
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
                    {kpi.comparison.formattedCurrent}
                  </div>

                  {kpi.comparison.previousValue !== null && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      Prior Baseline:{" "}
                      <strong className="text-slate-700">
                        {kpi.comparison.formattedPrevious}
                      </strong>{" "}
                      ({kpi.comparison.formattedDifference})
                    </div>
                  )}

                  <p className="text-xs text-slate-600 mt-2.5 pt-2.5 border-t border-slate-100 leading-relaxed">
                    {kpi.interpretation}
                  </p>
                </div>

                {hasDrillDown && kpi.drillDownKey && (
                  <button
                    onClick={() => onOpenDrillDown(kpi.drillDownKey!)}
                    className="no-print mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900"
                  >
                    <Eye className="w-3 h-3" />
                    Inspect Source Records
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-Dimensional Organisational Health Assessment (Part 6B) */}
      {payload.healthAssessment && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <HeartPulse className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Organisational Health Assessment
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    {payload.healthAssessment.overallBand}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {payload.healthAssessment.methodologySummary}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-900 text-white px-5 py-3 rounded-2xl">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Composite Score
                </div>
                <div className="text-2xl font-extrabold text-emerald-400">
                  {payload.healthAssessment.overallScore !== null
                    ? `${payload.healthAssessment.overallScore} / 100`
                    : "Insufficient Data"}
                </div>
              </div>
              <div className="h-8 w-px bg-white/15" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Verified Pillars
                </div>
                <div className="text-sm font-bold">
                  {payload.healthAssessment.evaluatedDimensionsCount} of{" "}
                  {payload.healthAssessment.totalDimensionsCount} (
                  {payload.healthAssessment.dataCompletenessPercent}%)
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {payload.healthAssessment.dimensions.map((dim) => (
              <div
                key={dim.id}
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {dim.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      Weight: {dim.weightPercent}%
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-lg font-extrabold text-slate-900">
                      {dim.score !== null ? `${dim.score}/100` : "N/A"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        dim.status === "strong"
                          ? "bg-emerald-100 text-emerald-800"
                          : dim.status === "satisfactory"
                          ? "bg-blue-100 text-blue-800"
                          : dim.status === "attention"
                          ? "bg-amber-100 text-amber-800"
                          : dim.status === "critical"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {dim.statusLabel}
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
                    {dim.score !== null && (
                      <div
                        className={`h-full rounded-full ${
                          dim.score >= 80
                            ? "bg-emerald-600"
                            : dim.score >= 65
                            ? "bg-blue-600"
                            : dim.score >= 50
                            ? "bg-amber-500"
                            : "bg-rose-600"
                        }`}
                        style={{ width: `${Math.min(100, dim.score)}%` }}
                      />
                    )}
                  </div>

                  <div className="text-[11px] font-semibold text-slate-700 mt-2">
                    {dim.measuredValueLabel}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {dim.limitationOrNote || dim.calculationExplanation}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] font-mono text-slate-400">
                  Source: {dim.authoritativeSources.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Charts Section */}
      {payload.charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {payload.charts.map((chart) => {
            const maxVal = Math.max(...chart.points.map((p) => p.value), 1);
            return (
              <div
                key={chart.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  {chart.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  {chart.subtitle}
                </p>

                {chart.points.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    {chart.emptyMessage ||
                      "No data points recorded in the selected window."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chart.points.map((pt, idx) => {
                      const pct = Math.max(
                        2,
                        Math.min(100, (Math.max(0, pt.value) / maxVal) * 100)
                      );
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">
                              {pt.label}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {pt.formattedValue || String(pt.value)}
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: pt.color || "#0a192f",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Structured Data Tables */}
      {payload.tables.map((table) => (
        <div
          key={table.id}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {table.title}
              </h3>
              <p className="text-xs text-slate-500">{table.subtitle}</p>
            </div>
            {table.drillDownRoute && (
              <Link
                to={table.drillDownRoute}
                className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Open Source Module
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {table.rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              {table.emptyMessage}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0a192f] text-white">
                    {table.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`p-3 font-bold ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {table.rows.slice(0, 50).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {table.columns.map((col) => {
                        const rawVal = row[col.key];
                        let content: any = rawVal ?? "—";
                        if (
                          col.format === "currency_ngn" &&
                          typeof rawVal === "number"
                        ) {
                          content = formatMetricValue(rawVal, "NGN");
                        } else if (
                          col.format === "percentage" &&
                          typeof rawVal === "number"
                        ) {
                          content = `${rawVal.toFixed(1)}%`;
                        } else if (
                          col.format === "date" &&
                          typeof rawVal === "string" &&
                          rawVal !== "—"
                        ) {
                          const d = new Date(rawVal);
                          if (!Number.isNaN(d.getTime())) {
                            content = d.toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            });
                          }
                        }
                        return (
                          <td
                            key={col.key}
                            className={`p-3 ${
                              col.align === "right"
                                ? "text-right font-mono"
                                : col.align === "center"
                                ? "text-center"
                                : "text-left"
                            } ${
                              col.format === "mono"
                                ? "font-mono font-semibold text-slate-800"
                                : "text-slate-700"
                            }`}
                          >
                            {col.format === "badge" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                                {String(content)}
                              </span>
                            ) : (
                              content
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {table.totalsRow && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      {table.columns.map((col) => {
                        const rawVal = table.totalsRow?.[col.key];
                        const content =
                          col.format === "currency_ngn" &&
                          typeof rawVal === "number"
                            ? formatMetricValue(rawVal, "NGN")
                            : rawVal ?? "";
                        return (
                          <td
                            key={col.key}
                            className={`p-3 ${
                              col.align === "right"
                                ? "text-right font-mono"
                                : col.align === "center"
                                ? "text-center"
                                : "text-left"
                            }`}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Business Intelligence Insights, Risks & Recommended Management Actions (Part 6C) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">
            <CheckCircle2 className="w-4 h-4" />
            Key Achievements & Growth Opportunities
          </div>
          <ul className="space-y-2 text-xs text-slate-700">
            {[
              ...payload.insights.keyAchievements,
              ...payload.insights.significantChanges,
              ...payload.insights.growthOpportunities,
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Risks, Bottlenecks & Management Watchlist
          </div>
          <ul className="space-y-2 text-xs text-slate-700">
            {[
              ...payload.insights.financialRisks,
              ...payload.insights.operationalBottlenecks,
              ...payload.insights.areasRequiringAttention,
              ...payload.insights.decliningPerformance,
            ].length === 0 ? (
              <li className="text-slate-500">
                No critical financial or operational bottlenecks triggered in
                this reporting window.
              </li>
            ) : (
              [
                ...payload.insights.financialRisks,
                ...payload.insights.operationalBottlenecks,
                ...payload.insights.areasRequiringAttention,
                ...payload.insights.decliningPerformance,
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">
            <Target className="w-4 h-4" />
            Recommended Management Actions
          </div>
          <ul className="space-y-2 text-xs text-slate-700">
            {payload.insights.recommendedActions.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Authoritative Metric Definitions Footer */}
      {payload.metricDefinitionsUsed.length > 0 && (
        <div className="no-print bg-slate-50 rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Authoritative Metric Definitions Used in This Report
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {payload.metricDefinitionsUsed.map((m) => (
              <div
                key={m.id}
                className="bg-white p-3 rounded-xl border border-slate-200 text-[11px]"
              >
                <div className="font-bold text-slate-900">{m.name}</div>
                <div className="font-mono text-slate-600 mt-1">
                  {m.calculationFormula}
                </div>
                <div className="text-slate-400 mt-1">
                  Source: <code>{m.authoritativeSource}</code> (
                  <code>{m.applicableDateField}</code>)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminReports;
