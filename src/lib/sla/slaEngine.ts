import { supabase } from "../supabaseClient";

export interface SlaConfiguration {
  id: string;
  service_id?: string | null;
  service_category: string;
  service_name?: string;
  expected_duration_days: number;
  time_unit: "days" | "hours";
  warning_threshold_pct: number;
  escalation_threshold_pct: number;
  responsible_department: string;
  default_priority: "low" | "normal" | "high" | "urgent";
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SlaStatus =
  | "on_track"
  | "due_soon"
  | "overdue"
  | "paused"
  | "completed"
  | "not_applicable";

export interface SlaCalculationResult {
  status: SlaStatus;
  statusLabel: string;
  startDateIso: string;
  expectedCompletionDateIso: string;
  elapsedHours: number;
  elapsedDays: number;
  totalExpectedHours: number;
  totalExpectedDays: number;
  remainingHours: number;
  remainingDays: number;
  remainingText: string;
  percentConsumed: number;
  isWarning: boolean;
  isOverdue: boolean;
  badgeTone: "emerald" | "amber" | "rose" | "slate" | "blue";
}

export interface CacStageDuration {
  stage: string;
  stageLabel: string;
  daysAtStage: number;
  hoursAtStage: number;
  formattedDuration: string;
  isProlonged: boolean;
}

// Built-in standard operational SLA baselines (business defaults)
export const DEFAULT_SLA_CONFIGS: Omit<SlaConfiguration, "id">[] = [
  {
    service_category: "Business Name Registration",
    expected_duration_days: 4,
    time_unit: "days",
    warning_threshold_pct: 75,
    escalation_threshold_pct: 100,
    responsible_department: "Legal & Compliance",
    default_priority: "normal",
    is_active: true,
    notes: "Expected turnaround from document submission to CAC business name certificate issuance.",
  },
  {
    service_category: "Company Registration",
    expected_duration_days: 7,
    time_unit: "days",
    warning_threshold_pct: 75,
    escalation_threshold_pct: 100,
    responsible_department: "Legal & Compliance",
    default_priority: "high",
    is_active: true,
    notes: "Private limited liability company (LTD) full incorporation and status report.",
  },
  {
    service_category: "NGO Registration",
    expected_duration_days: 21,
    time_unit: "days",
    warning_threshold_pct: 75,
    escalation_threshold_pct: 100,
    responsible_department: "Legal & Compliance",
    default_priority: "high",
    is_active: true,
    notes: "Incorporated Trustees publication, constitution draft, and CAC trustee verification.",
  },
  {
    service_category: "TIN-related service",
    expected_duration_days: 2,
    time_unit: "days",
    warning_threshold_pct: 75,
    escalation_threshold_pct: 100,
    responsible_department: "Finance & Accounts",
    default_priority: "normal",
    is_active: true,
    notes: "Joint Tax Board / FIRS corporate Tax Identification Number generation.",
  },
  {
    service_category: "SCUML-related service",
    expected_duration_days: 10,
    time_unit: "days",
    warning_threshold_pct: 75,
    escalation_threshold_pct: 100,
    responsible_department: "Legal & Compliance",
    default_priority: "normal",
    is_active: true,
    notes: "Special Control Unit Against Money Laundering compliance certificate.",
  },
  {
    service_category: "Annual Returns & Filing",
    expected_duration_days: 5,
    time_unit: "days",
    warning_threshold_pct: 75,
    escalation_threshold_pct: 100,
    responsible_department: "Legal & Compliance",
    default_priority: "normal",
    is_active: true,
    notes: "Statutory annual returns compliance filing and penalty rectification.",
  },
  {
    service_category: "Other services",
    expected_duration_days: 5,
    time_unit: "days",
    warning_threshold_pct: 75,
    escalation_threshold_pct: 100,
    responsible_department: "Operations",
    default_priority: "normal",
    is_active: true,
    notes: "Standard baseline timeline for advisory, trademark, and bespoke operational requests.",
  },
];

const LOCAL_STORAGE_SLA_KEY = "ablebiz_sla_configurations_v1";

/**
 * Loads SLA configurations from Supabase or returns cached/default configs.
 */
export async function getSlaConfigurations(): Promise<SlaConfiguration[]> {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("sla_configurations")
        .select("*, service:services_catalog(name)")
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          ...d,
          service_name: d.service?.name || d.service_category,
        }));
      }
    }
  } catch (err) {
    console.warn("[SLA Engine] Supabase SLA read fallback:", err);
  }

  // Local storage fallback
  if (typeof window !== "undefined" && window.localStorage) {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_SLA_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }

  // Populate default baseline if empty
  const defaultList: SlaConfiguration[] = DEFAULT_SLA_CONFIGS.map((cfg, idx) => ({
    ...cfg,
    id: `sla-default-${idx + 1}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(LOCAL_STORAGE_SLA_KEY, JSON.stringify(defaultList));
  }

  return defaultList;
}

/**
 * Saves or updates an SLA configuration.
 */
export async function saveSlaConfiguration(
  config: Partial<SlaConfiguration> & { id?: string }
): Promise<SlaConfiguration> {
  const currentList = await getSlaConfigurations();
  const id = config.id || `sla-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const savedItem: SlaConfiguration = {
    id,
    service_id: config.service_id || null,
    service_category: config.service_category || "General Service",
    service_name: config.service_name || config.service_category || "General Service",
    expected_duration_days: Number(config.expected_duration_days) || 5,
    time_unit: config.time_unit || "days",
    warning_threshold_pct: Number(config.warning_threshold_pct) || 75,
    escalation_threshold_pct: Number(config.escalation_threshold_pct) || 100,
    responsible_department: config.responsible_department || "Operations",
    default_priority: config.default_priority || "normal",
    is_active: config.is_active !== false,
    notes: config.notes || null,
    created_at: config.created_at || nowIso,
    updated_at: nowIso,
  };

  // Persist to Supabase if available
  if (supabase) {
    try {
      const payload: any = {
        service_id: savedItem.service_id,
        service_category: savedItem.service_category,
        expected_duration_days: savedItem.expected_duration_days,
        time_unit: savedItem.time_unit,
        warning_threshold_pct: savedItem.warning_threshold_pct,
        escalation_threshold_pct: savedItem.escalation_threshold_pct,
        responsible_department: savedItem.responsible_department,
        default_priority: savedItem.default_priority,
        is_active: savedItem.is_active,
        notes: savedItem.notes,
        updated_at: nowIso,
      };

      if (config.id && !config.id.startsWith("sla-default-") && !config.id.startsWith("sla-")) {
        await supabase.from("sla_configurations").update(payload).eq("id", config.id);
      } else {
        const { data } = await supabase.from("sla_configurations").insert(payload).select().single();
        if (data?.id) savedItem.id = data.id;
      }
    } catch (e) {
      console.warn("[SLA Engine] Supabase write fallback:", e);
    }
  }

  // Update local storage
  const existingIndex = currentList.findIndex((c) => c.id === id);
  let updatedList: SlaConfiguration[];
  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = savedItem;
  } else {
    updatedList = [...currentList, savedItem];
  }

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(LOCAL_STORAGE_SLA_KEY, JSON.stringify(updatedList));
  }

  return savedItem;
}

/**
 * Calculates real-time SLA metrics, remaining time, warning, and overdue state
 * for any service request, CAC filing, or task.
 */
export function calculateSlaStatus(params: {
  startDate: string | Date | null | undefined;
  targetCompletionDate?: string | Date | null | undefined;
  completedAt?: string | Date | null | undefined;
  status?: string | null | undefined;
  expectedDurationDays?: number | null | undefined;
  warningThresholdPct?: number | null | undefined;
  referenceNow?: Date;
}): SlaCalculationResult {
  const now = params.referenceNow ? new Date(params.referenceNow) : new Date();

  // If no start date, return Not Applicable
  if (!params.startDate) {
    return {
      status: "not_applicable",
      statusLabel: "Not Applicable",
      startDateIso: now.toISOString(),
      expectedCompletionDateIso: now.toISOString(),
      elapsedHours: 0,
      elapsedDays: 0,
      totalExpectedHours: 0,
      totalExpectedDays: 0,
      remainingHours: 0,
      remainingDays: 0,
      remainingText: "Not set",
      percentConsumed: 0,
      isWarning: false,
      isOverdue: false,
      badgeTone: "slate",
    };
  }

  const start = new Date(params.startDate);
  const expectedDays = Math.max(0.5, Number(params.expectedDurationDays) || 5);
  const totalExpectedHours = expectedDays * 24;

  let expectedEnd: Date;
  if (params.targetCompletionDate) {
    expectedEnd = new Date(params.targetCompletionDate);
  } else {
    expectedEnd = new Date(start.getTime() + totalExpectedHours * 3600 * 1000);
  }

  const warningThreshold = Number(params.warningThresholdPct) || 75;

  // Check if paused (e.g. awaiting client documentation)
  const isPaused = params.status === "awaiting_client" || params.status === "documents_required";

  // Check if completed
  const isCompleted =
    params.status === "completed" ||
    params.status === "approved" ||
    Boolean(params.completedAt);

  const evaluationDate = isCompleted && params.completedAt ? new Date(params.completedAt) : now;
  const elapsedMs = Math.max(0, evaluationDate.getTime() - start.getTime());
  const elapsedHours = Math.round((elapsedMs / (3600 * 1000)) * 10) / 10;
  const elapsedDays = Math.round((elapsedHours / 24) * 10) / 10;

  const totalWindowMs = Math.max(3600 * 1000, expectedEnd.getTime() - start.getTime());
  const totalCalculatedHours = Math.round((totalWindowMs / (3600 * 1000)) * 10) / 10;
  const totalCalculatedDays = Math.round((totalCalculatedHours / 24) * 10) / 10;

  const remainingMs = expectedEnd.getTime() - evaluationDate.getTime();
  const remainingHours = Math.round((remainingMs / (3600 * 1000)) * 10) / 10;
  const remainingDays = Math.round((remainingHours / 24) * 10) / 10;

  const rawPercent = Math.round((elapsedMs / totalWindowMs) * 100);
  const percentConsumed = Math.min(999, Math.max(0, rawPercent));

  if (isCompleted) {
    const onTime = remainingMs >= 0;
    return {
      status: "completed",
      statusLabel: onTime ? "Completed on Time" : "Completed (Delayed)",
      startDateIso: start.toISOString(),
      expectedCompletionDateIso: expectedEnd.toISOString(),
      elapsedHours,
      elapsedDays,
      totalExpectedHours: totalCalculatedHours,
      totalExpectedDays: totalCalculatedDays,
      remainingHours: 0,
      remainingDays: 0,
      remainingText: onTime ? "Delivered on schedule" : `Concluded (${Math.abs(remainingDays)}d delayed)`,
      percentConsumed: 100,
      isWarning: false,
      isOverdue: !onTime,
      badgeTone: onTime ? "emerald" : "slate",
    };
  }

  if (isPaused) {
    return {
      status: "paused",
      statusLabel: "Paused (Awaiting Client)",
      startDateIso: start.toISOString(),
      expectedCompletionDateIso: expectedEnd.toISOString(),
      elapsedHours,
      elapsedDays,
      totalExpectedHours: totalCalculatedHours,
      totalExpectedDays: totalCalculatedDays,
      remainingHours,
      remainingDays,
      remainingText: "Paused awaiting client",
      percentConsumed,
      isWarning: false,
      isOverdue: false,
      badgeTone: "blue",
    };
  }

  if (remainingMs < 0) {
    const overdueDays = Math.abs(remainingDays);
    return {
      status: "overdue",
      statusLabel: "Deadline Missed",
      startDateIso: start.toISOString(),
      expectedCompletionDateIso: expectedEnd.toISOString(),
      elapsedHours,
      elapsedDays,
      totalExpectedHours: totalCalculatedHours,
      totalExpectedDays: totalCalculatedDays,
      remainingHours,
      remainingDays,
      remainingText: overdueDays >= 1 ? `${Math.floor(overdueDays)}d overdue` : `${Math.abs(Math.round(remainingHours))}h overdue`,
      percentConsumed,
      isWarning: false,
      isOverdue: true,
      badgeTone: "rose",
    };
  }

  if (percentConsumed >= warningThreshold) {
    return {
      status: "due_soon",
      statusLabel: "Due Soon",
      startDateIso: start.toISOString(),
      expectedCompletionDateIso: expectedEnd.toISOString(),
      elapsedHours,
      elapsedDays,
      totalExpectedHours: totalCalculatedHours,
      totalExpectedDays: totalCalculatedDays,
      remainingHours,
      remainingDays,
      remainingText: remainingDays >= 1 ? `${Math.ceil(remainingDays)}d remaining` : `${Math.max(1, Math.round(remainingHours))}h remaining`,
      percentConsumed,
      isWarning: true,
      isOverdue: false,
      badgeTone: "amber",
    };
  }

  return {
    status: "on_track",
    statusLabel: "On Track",
    startDateIso: start.toISOString(),
    expectedCompletionDateIso: expectedEnd.toISOString(),
    elapsedHours,
    elapsedDays,
    totalExpectedHours: totalCalculatedHours,
    totalExpectedDays: totalCalculatedDays,
    remainingHours,
    remainingDays,
    remainingText: remainingDays >= 1 ? `${Math.ceil(remainingDays)}d remaining` : `${Math.max(1, Math.round(remainingHours))}h remaining`,
    percentConsumed,
    isWarning: false,
    isOverdue: false,
    badgeTone: "emerald",
  };
}

/**
 * Tracks time spent by a CAC application at its current workflow stage.
 */
export function trackCacStageDuration(
  stage: string,
  updatedAt: string | Date | null | undefined,
  referenceNow?: Date
): CacStageDuration {
  const now = referenceNow ? new Date(referenceNow) : new Date();
  const stageStart = updatedAt ? new Date(updatedAt) : now;
  const elapsedMs = Math.max(0, now.getTime() - stageStart.getTime());
  const hoursAtStage = Math.round((elapsedMs / (3600 * 1000)) * 10) / 10;
  const daysAtStage = Math.round((hoursAtStage / 24) * 10) / 10;

  const stageLabels: Record<string, string> = {
    new_request: "New Filing Request",
    documents_required: "Awaiting Client Documents",
    documents_verified: "Documents Verified",
    name_search: "CAC Name Availability Search",
    name_reserved: "Name Reserved",
    application_prepared: "Filing Forms Prepared",
    application_submitted: "Submitted to CAC Portal",
    under_cac_review: "Under CAC Official Review",
    approved: "Approved by CAC",
    documents_received: "Official Certificates Received",
    completed: "Completed & Dispatched",
  };

  const stageLabel = stageLabels[stage] || stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Prolonger threshold: > 3 days at any single stage
  const isProlonged = daysAtStage > 3 && stage !== "completed";

  let formattedDuration = "";
  if (daysAtStage >= 1) {
    formattedDuration = `${Math.floor(daysAtStage)} day${Math.floor(daysAtStage) === 1 ? "" : "s"} at this stage`;
  } else if (hoursAtStage >= 1) {
    formattedDuration = `${Math.floor(hoursAtStage)} hr${Math.floor(hoursAtStage) === 1 ? "" : "s"} at this stage`;
  } else {
    formattedDuration = "Just entered this stage";
  }

  return {
    stage,
    stageLabel,
    daysAtStage,
    hoursAtStage,
    formattedDuration,
    isProlonged,
  };
}
