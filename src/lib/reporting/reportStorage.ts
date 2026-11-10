import { normalizeStaffRole } from "../../auth/roleConfig";
import { getReportById } from "./reportCatalogue";
import {
  canAccessReport,
  resolveEffectiveReportScope,
  validateScheduledReportRecipients,
} from "./reportPermissions";
import type {
  GeneratedReportPayload,
  ReportFilterState,
  ReportHistoryEntry,
  ReportOutputFormat,
  SavedReportConfiguration,
  ScheduledReportConfig,
} from "./types";

const SAVED_CONFIGS_KEY = "ablebiz_bi_saved_configs_v1";
const REPORT_HISTORY_KEY = "ablebiz_bi_history_v1";
const SCHEDULED_REPORTS_KEY = "ablebiz_bi_schedules_v1";

function safeReadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteLocal<T>(key: string, data: T): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota issues
  }
}

export function computeNextScheduleRunIso(
  frequency: "daily" | "weekly" | "monthly" | "quarterly",
  fromDate: Date = new Date()
): string {
  const next = new Date(fromDate.getTime());
  next.setHours(8, 0, 0, 0);
  if (next.getTime() <= fromDate.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  switch (frequency) {
    case "daily":
      break;
    case "weekly": {
      const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilMonday);
      break;
    }
    case "monthly": {
      next.setMonth(next.getMonth() + 1, 1);
      break;
    }
    case "quarterly": {
      const nextQuarterMonth = (Math.floor(next.getMonth() / 3) + 1) * 3;
      next.setMonth(nextQuarterMonth, 1);
      break;
    }
  }
  return next.toISOString();
}

export async function loadSavedReportConfigs(
  supabaseClient: any,
  staffId: string,
  roleInput: string | null | undefined
): Promise<SavedReportConfiguration[]> {
  const role = normalizeStaffRole(roleInput) || "viewer";
  let configs: SavedReportConfiguration[] = safeReadLocal<
    SavedReportConfiguration[]
  >(SAVED_CONFIGS_KEY, []);

  if (supabaseClient && staffId) {
    try {
      const { data, error } = await supabaseClient
        .from("report_saved_configs")
        .select("*")
        .eq("created_by_staff_id", staffId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data) && data.length > 0) {
        configs = data.map((row: any) => ({
          id: String(row.id),
          name: String(row.name || "Saved Report"),
          reportId: String(row.report_id),
          category: row.category || "executive",
          filters: row.filters || {},
          isFavourite: Boolean(row.is_favourite),
          createdByStaffId: String(row.created_by_staff_id || staffId),
          createdByName: String(row.created_by_name || "Staff"),
          createdAt: String(row.created_at || new Date().toISOString()),
        }));
        safeWriteLocal(SAVED_CONFIGS_KEY, configs);
      }
    } catch {
      // Fallback to localStorage
    }
  }

  // Filter out any report the caller is not authorized to view
  return configs.filter(
    (c) =>
      (!c.createdByStaffId || c.createdByStaffId === staffId) &&
      canAccessReport(role, c.reportId)
  );
}

export async function saveReportConfig(
  supabaseClient: any,
  params: {
    name: string;
    reportId: string;
    filters: ReportFilterState;
    isFavourite?: boolean;
    staffId: string;
    staffName: string;
    role: string | null | undefined;
  }
): Promise<SavedReportConfiguration> {
  const report = getReportById(params.reportId);
  if (!report) {
    throw new Error(`Invalid report ID "${params.reportId}".`);
  }
  if (!canAccessReport(params.role, report)) {
    throw new Error("You are not authorized to save this report configuration.");
  }

  const newConfig: SavedReportConfiguration = {
    id: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: params.name.trim() || `${report.shortTitle} (${params.filters.period})`,
    reportId: report.id,
    category: report.category,
    filters: params.filters,
    isFavourite: Boolean(params.isFavourite),
    createdByStaffId: params.staffId,
    createdByName: params.staffName,
    createdAt: new Date().toISOString(),
  };

  if (supabaseClient && params.staffId) {
    try {
      const { data, error } = await supabaseClient
        .from("report_saved_configs")
        .insert({
          name: newConfig.name,
          report_id: newConfig.reportId,
          category: newConfig.category,
          filters: newConfig.filters,
          is_favourite: newConfig.isFavourite,
          created_by_staff_id: newConfig.createdByStaffId,
          created_by_name: newConfig.createdByName,
        })
        .select("*")
        .single();

      if (!error && data?.id) {
        newConfig.id = String(data.id);
      }
    } catch {
      // Persist locally if table not yet migrated
    }
  }

  const existing = safeReadLocal<SavedReportConfiguration[]>(
    SAVED_CONFIGS_KEY,
    []
  );
  const updated = [newConfig, ...existing].slice(0, 50);
  safeWriteLocal(SAVED_CONFIGS_KEY, updated);
  return newConfig;
}

export async function toggleFavouriteReportConfig(
  supabaseClient: any,
  configId: string
): Promise<SavedReportConfiguration[]> {
  const existing = safeReadLocal<SavedReportConfiguration[]>(
    SAVED_CONFIGS_KEY,
    []
  );
  let targetFav = false;
  const updated = existing.map((c) => {
    if (c.id === configId) {
      targetFav = !c.isFavourite;
      return { ...c, isFavourite: targetFav };
    }
    return c;
  });
  safeWriteLocal(SAVED_CONFIGS_KEY, updated);

  if (supabaseClient && !configId.startsWith("cfg_")) {
    try {
      await supabaseClient
        .from("report_saved_configs")
        .update({ is_favourite: targetFav })
        .eq("id", configId);
    } catch {
      // Non-blocking
    }
  }

  return updated;
}

export async function deleteSavedReportConfig(
  supabaseClient: any,
  configId: string
): Promise<SavedReportConfiguration[]> {
  const existing = safeReadLocal<SavedReportConfiguration[]>(
    SAVED_CONFIGS_KEY,
    []
  );
  const updated = existing.filter((c) => c.id !== configId);
  safeWriteLocal(SAVED_CONFIGS_KEY, updated);

  if (supabaseClient && !configId.startsWith("cfg_")) {
    try {
      await supabaseClient
        .from("report_saved_configs")
        .delete()
        .eq("id", configId);
    } catch {
      // Non-blocking
    }
  }

  return updated;
}

export async function loadReportHistory(
  supabaseClient: any,
  staffId: string,
  roleInput: string | null | undefined
): Promise<ReportHistoryEntry[]> {
  const role = normalizeStaffRole(roleInput) || "viewer";
  let history = safeReadLocal<ReportHistoryEntry[]>(REPORT_HISTORY_KEY, []);

  if (supabaseClient && staffId) {
    try {
      let query = supabaseClient
        .from("report_execution_history")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(50);

      if (role !== "super_admin" && role !== "admin") {
        query = query.eq("generated_by_staff_id", staffId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        history = data.map((row: any) => ({
          id: String(row.id),
          reportId: String(row.report_id),
          reportTitle: String(row.report_title || row.report_id),
          category: row.category || "executive",
          generatedByStaffId: String(row.generated_by_staff_id || ""),
          generatedByName: String(row.generated_by_name || "Staff"),
          generatedByRole: normalizeStaffRole(row.generated_by_role) || "viewer",
          generatedAt: String(row.generated_at || new Date().toISOString()),
          reportingPeriodLabel: String(row.reporting_period_label || ""),
          filtersApplied: row.filters_applied || {},
          scopeApplied: row.scope_applied || "personal",
          outputFormat: row.output_format || "preview",
          recordCount: Number(row.record_count || 0),
          documentNumber: String(row.document_number || ""),
        }));
        safeWriteLocal(REPORT_HISTORY_KEY, history);
      }
    } catch {
      // Fallback to localStorage
    }
  }

  return history.filter((h) => canAccessReport(role, h.reportId));
}

export async function recordReportHistoryEntry(
  supabaseClient: any,
  payload: GeneratedReportPayload,
  outputFormat: ReportOutputFormat | "preview"
): Promise<ReportHistoryEntry> {
  const entry: ReportHistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reportId: payload.reportId,
    reportTitle: payload.title,
    category: payload.category,
    generatedByStaffId: payload.generatedBy.staffId,
    generatedByName: payload.generatedBy.name,
    generatedByRole: payload.generatedBy.role,
    generatedAt: payload.generatedAtIso,
    reportingPeriodLabel: payload.periodWindow.label,
    filtersApplied: payload.filtersApplied,
    scopeApplied: payload.scopeApplied,
    outputFormat,
    recordCount: payload.totalSourceRecords,
    documentNumber: payload.documentNumber,
  };

  const existing = safeReadLocal<ReportHistoryEntry[]>(REPORT_HISTORY_KEY, []);
  const updated = [entry, ...existing].slice(0, 60);
  safeWriteLocal(REPORT_HISTORY_KEY, updated);

  if (supabaseClient && payload.generatedBy.staffId) {
    try {
      await supabaseClient.from("report_execution_history").insert({
        report_id: entry.reportId,
        report_title: entry.reportTitle,
        category: entry.category,
        generated_by_staff_id: entry.generatedByStaffId,
        generated_by_name: entry.generatedByName,
        generated_by_role: entry.generatedByRole,
        generated_at: entry.generatedAt,
        reporting_period_label: entry.reportingPeriodLabel,
        filters_applied: entry.filtersApplied,
        scope_applied: entry.scopeApplied,
        output_format: entry.outputFormat,
        record_count: entry.recordCount,
        document_number: entry.documentNumber,
      });
    } catch {
      // Non-blocking if migration is pending
    }
  }

  return entry;
}

export async function loadScheduledReports(
  supabaseClient: any,
  staffId: string,
  roleInput: string | null | undefined
): Promise<ScheduledReportConfig[]> {
  const role = normalizeStaffRole(roleInput) || "viewer";
  let schedules = safeReadLocal<ScheduledReportConfig[]>(
    SCHEDULED_REPORTS_KEY,
    []
  );

  if (supabaseClient && staffId) {
    try {
      const { data, error } = await supabaseClient
        .from("report_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data) && data.length > 0) {
        schedules = data.map((row: any) => ({
          id: String(row.id),
          reportId: String(row.report_id),
          reportTitle: String(row.report_title || row.report_id),
          category: row.category || "executive",
          frequency: row.frequency || "monthly",
          outputFormat: row.output_format || "pdf",
          recipientStaffIds: Array.isArray(row.recipient_staff_ids)
            ? row.recipient_staff_ids
            : [],
          recipientNames: Array.isArray(row.recipient_names)
            ? row.recipient_names
            : [],
          scopeApplied: row.scope_applied || "organisation",
          filters: row.filters || {},
          isActive: row.is_active !== false,
          nextRunAt: String(row.next_run_at || computeNextScheduleRunIso("monthly")),
          lastRunAt: row.last_run_at || null,
          lastRunStatus: row.last_run_status || "pending",
          lastFailureReason: row.last_failure_reason || null,
          createdByStaffId: String(row.created_by_staff_id || ""),
          createdByName: String(row.created_by_name || "Staff"),
          createdAt: String(row.created_at || new Date().toISOString()),
        }));
        safeWriteLocal(SCHEDULED_REPORTS_KEY, schedules);
      }
    } catch {
      // Fallback to localStorage
    }
  }

  return schedules.filter((s) => canAccessReport(role, s.reportId));
}

export async function createScheduledReport(
  supabaseClient: any,
  params: {
    reportId: string;
    frequency: "daily" | "weekly" | "monthly" | "quarterly";
    outputFormat: "pdf" | "xlsx" | "csv";
    recipients: Array<{ id: string; full_name: string; role: string | null }>;
    filters: ReportFilterState;
    creatorStaffId: string;
    creatorName: string;
    creatorRole: string | null | undefined;
  }
): Promise<ScheduledReportConfig> {
  const report = getReportById(params.reportId);
  if (!report) {
    throw new Error(`Unknown report "${params.reportId}".`);
  }
  if (!canAccessReport(params.creatorRole, report)) {
    throw new Error(
      `Your role is not authorized to schedule "${report.title}".`
    );
  }

  // Enforce recipient role authorization (Part 9 requirement)
  const validation = validateScheduledReportRecipients(
    report.id,
    params.recipients
  );
  if (!validation.valid) {
    const reasons = validation.unauthorizedRecipients
      .map((u) => `${u.full_name}: ${u.reason}`)
      .join("; ");
    throw new Error(
      `Cannot schedule report for unauthorized recipient(s): ${reasons}`
    );
  }

  const effectiveScope = resolveEffectiveReportScope(params.creatorRole, report);
  const nextRunAt = computeNextScheduleRunIso(params.frequency);

  const schedule: ScheduledReportConfig = {
    id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reportId: report.id,
    reportTitle: report.title,
    category: report.category,
    frequency: params.frequency,
    outputFormat: params.outputFormat,
    recipientStaffIds: validation.authorizedRecipients.map((r) => r.id),
    recipientNames: validation.authorizedRecipients.map((r) => r.full_name),
    scopeApplied: effectiveScope,
    filters: params.filters,
    isActive: true,
    nextRunAt,
    lastRunAt: null,
    lastRunStatus: "pending",
    lastFailureReason: null,
    createdByStaffId: params.creatorStaffId,
    createdByName: params.creatorName,
    createdAt: new Date().toISOString(),
  };

  if (supabaseClient && params.creatorStaffId) {
    try {
      const { data, error } = await supabaseClient
        .from("report_schedules")
        .insert({
          report_id: schedule.reportId,
          report_title: schedule.reportTitle,
          category: schedule.category,
          frequency: schedule.frequency,
          output_format: schedule.outputFormat,
          recipient_staff_ids: schedule.recipientStaffIds,
          recipient_names: schedule.recipientNames,
          scope_applied: schedule.scopeApplied,
          filters: schedule.filters,
          is_active: true,
          next_run_at: schedule.nextRunAt,
          last_run_status: "pending",
          created_by_staff_id: schedule.createdByStaffId,
          created_by_name: schedule.createdByName,
        })
        .select("*")
        .single();

      if (!error && data?.id) {
        schedule.id = String(data.id);
      }
    } catch {
      // Persist locally if table not yet migrated
    }
  }

  const existing = safeReadLocal<ScheduledReportConfig[]>(
    SCHEDULED_REPORTS_KEY,
    []
  );
  const updated = [schedule, ...existing].slice(0, 50);
  safeWriteLocal(SCHEDULED_REPORTS_KEY, updated);
  return schedule;
}

export async function toggleScheduledReport(
  supabaseClient: any,
  scheduleId: string
): Promise<ScheduledReportConfig[]> {
  const existing = safeReadLocal<ScheduledReportConfig[]>(
    SCHEDULED_REPORTS_KEY,
    []
  );
  let targetActive = false;
  const updated = existing.map((s) => {
    if (s.id === scheduleId) {
      targetActive = !s.isActive;
      return { ...s, isActive: targetActive };
    }
    return s;
  });
  safeWriteLocal(SCHEDULED_REPORTS_KEY, updated);

  if (supabaseClient && !scheduleId.startsWith("sch_")) {
    try {
      await supabaseClient
        .from("report_schedules")
        .update({ is_active: targetActive })
        .eq("id", scheduleId);
    } catch {
      // Non-blocking
    }
  }

  return updated;
}

export async function deleteScheduledReport(
  supabaseClient: any,
  scheduleId: string
): Promise<ScheduledReportConfig[]> {
  const existing = safeReadLocal<ScheduledReportConfig[]>(
    SCHEDULED_REPORTS_KEY,
    []
  );
  const updated = existing.filter((s) => s.id !== scheduleId);
  safeWriteLocal(SCHEDULED_REPORTS_KEY, updated);

  if (supabaseClient && !scheduleId.startsWith("sch_")) {
    try {
      await supabaseClient
        .from("report_schedules")
        .delete()
        .eq("id", scheduleId);
    } catch {
      // Non-blocking
    }
  }

  return updated;
}
