import { supabase } from "../supabaseClient";
import {
  AssistantCallerContext,
  AssistantResponsePayload,
  AssistantTopicFilterId,
  ClassifiedIntent,
  ConversationContext,
  ParsedDateRange,
  QueryResultStatus,
  SuiteModuleId,
} from "./types";
import {
  ABILITY_TIMEZONE,
  formatCount,
  formatDateTimeLagos,
  formatNgn,
  formatShortDate,
  isDateInRange,
  overlapsDateWindow,
  parseQueryDateRange,
} from "./dateUtils";
import {
  CAPABILITY_CATALOGUE,
  CAPABILITY_CATALOGUE_VERSION,
  canCallerAccessModule,
  formatFriendlySourceNames,
  getModuleSpec,
  resolveAuthorizedLinks,
} from "./capabilityCatalogue";
import {
  buildRolePermissionResponse,
  buildTroubleshootingResponse,
  formatGuideTopicResponse,
  getGuideTopicById,
  matchGuideTopic,
  SUITE_GUIDE_TOPICS,
} from "./suiteGuideRegistry";
import { classifyAssistantIntent } from "./intentRouter";
import { getContextualFollowUpQuestions } from "./suggestions";
import { calculateServiceProfitability } from "../profitability/profitabilityService";
import {
  generateCashFlowForecast,
  calculateCurrentCashPosition,
  calculateBudgetVsActual,
  DEFAULT_SCENARIOS,
} from "../cashFlow/cashFlowService";
import {
  calculateComplianceDeadlineStatus,
  computeComplianceSummary,
} from "../compliance/complianceService";
import { computeAppointmentSummary } from "../scheduling/schedulingService";
import { computeQualitySummaryMetrics } from "../quality/qualityService";
import { computeTeamPerformanceSummary, computeStaffIndividualPerformance } from "../performance/performanceService";
import { ILLUSTRATIVE_SOP_GUIDES, canRoleAccessArticle } from "../knowledgeBase/knowledgeService";
import { DEFAULT_APPROVAL_RULES } from "../approvals/approvalService";
import { fetchBackupRecords, fetchRestoreDrills, fetchBusinessContinuitySettings } from "../backup/backupService";
import { fetchMarketingAttributionData } from "../marketing/attributionAnalytics";
import { fetchReceiptProfitabilityReport } from "../profitability/expenseAllocationService";

export interface TableQueryResult<T = Record<string, any>> {
  data: T[] | null;
  error: { code?: string; message: string } | null;
}

export interface AssistantDataAdapter {
  queryTable: <T = Record<string, any>>(
    tableName: string,
    options?: {
      select?: string;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    }
  ) => Promise<TableQueryResult<T>>;
}

function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

function isPermissionDeniedError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "42501" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("insufficient_privilege")
  );
}

function isTimeoutError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "57014" ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("statement timeout")
  );
}

function formatReadableLabel(value: unknown, fallback = "—"): string {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const defaultSupabaseAdapter: AssistantDataAdapter = {
  async queryTable<T = Record<string, any>>(
    tableName: string,
    options?: {
      select?: string;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    }
  ): Promise<TableQueryResult<T>> {
    try {
      let query = supabase.from(tableName).select(options?.select || "*");
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        });
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      const { data, error } = await query;
      if (error) {
        return {
          data: null,
          error: { code: (error as any).code, message: error.message || "The request could not be completed" },
        };
      }
      return { data: (data as T[]) || [], error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || "The request could not be completed" },
      };
    }
  },
};

function buildSpoofAndMutationPrefix(intent: ClassifiedIntent, caller: AssistantCallerContext): string {
  const notices: string[] = [];
  if (intent.isRoleSpoofingAttempt) {
    notices.push(
      `> **Role Verification Notice:** Your signed-in role is **${caller.roleLabel}**. Requests in chat text to change or bypass your role are ignored, and all answers strictly follow your verified account permissions.`
    );
  }
  if (intent.isWriteMutationAttempt) {
    notices.push(
      `> **Read-Only Assistant Notice:** ABLEBIZ AI Secretary does not create, approve, reject, or delete records directly on your behalf. Below is the current status and step-by-step guidance so you can complete the action safely in the appropriate workspace.`
    );
  }
  return notices.length > 0 ? notices.join("\n\n") + "\n\n" : "";
}

function buildPermissionDeniedPayload(
  caller: AssistantCallerContext,
  moduleId: SuiteModuleId,
  intent: ClassifiedIntent,
  now: Date
): AssistantResponsePayload {
  const spec = getModuleSpec(moduleId);
  const prefix = buildSpoofAndMutationPrefix(intent, caller);
  const authorizedFallbackLinks = resolveAuthorizedLinks(caller, [
    "dashboard",
    "cac_operations",
    "service_requests",
    "tasks",
    "hr",
  ]).slice(0, 3);

  const lines: string[] = [
    prefix + `### Access Restricted — ${spec.displayName}`,
    `Your account does not have permission to view **${spec.displayName}**. Your signed-in role is **${caller.roleLabel}**.`,
    `#### Who Can Access This Area`,
    `- **Authorized Roles:** ${spec.allowedRolesSummary}`,
    `#### Recommended Next Step`,
    `If you need information from **${spec.displayName}**, please request assistance from an authorized team member or contact your **Managing Director** or **Operations Admin** if your role assignment in [Staff & RBAC](/admin/team) needs to be updated.`,
  ];

  const technicalDetails = `Module: ${spec.id} (${spec.route}) | Caller role: ${caller.role} | Required permissions: ${
    spec.requiredPermissions.join(", ") || "role-scoped"
  }`;

  if (intent.wantsTechnicalDiagnostics) {
    lines.push(
      `#### Technical Diagnostics`,
      `- **Canonical Role:** \`${caller.role}\``,
      `- **Required Permission(s):** ${
        spec.requiredPermissions.length > 0
          ? spec.requiredPermissions.map((p) => `\`${p}\``).join(", ")
          : "Role-scoped access"
      }`,
      `- **Target Tables:** ${spec.tables.map((t) => `\`${t}\``).join(", ")}`
    );
  }

  return {
    status: "permission_denied",
    intentType: intent.intentType,
    moduleId,
    title: `Access Restricted: ${spec.displayName}`,
    summary: `Your role (${caller.roleLabel}) does not have permission to view ${spec.displayName}.`,
    markdown: lines.join("\n\n"),
    metrics: [
      { label: "Your Role", value: caller.roleLabel, tone: "amber" },
      { label: "Workspace", value: spec.displayName, tone: "slate" },
      { label: "Access Status", value: "Restricted", tone: "rose" },
    ],
    links: authorizedFallbackLinks,
    followUpSuggestions: getContextualFollowUpQuestions(caller, "dashboard"),
    sourceMeta: {
      tablesQueried: [],
      sourcesLabel: spec.displayName,
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Access restricted for ${caller.roleLabel}`,
      technicalDetails: intent.wantsTechnicalDiagnostics ? technicalDetails : undefined,
    },
  };
}

function buildErrorOrSchemaPayload(
  caller: AssistantCallerContext,
  moduleId: SuiteModuleId,
  intent: ClassifiedIntent,
  tableName: string,
  error: { code?: string; message: string },
  now: Date
): AssistantResponsePayload {
  const spec = getModuleSpec(moduleId);
  const isSchema = isMissingSchemaError(error);
  const isRls = isPermissionDeniedError(error);
  const isTimeout = isTimeoutError(error);

  const status: QueryResultStatus = isRls
    ? "permission_denied"
    : isSchema
    ? "schema_pending"
    : "query_error";

  const friendlySource = formatFriendlySourceNames([tableName]);

  const title = isRls
    ? `Access Restricted — ${spec.displayName}`
    : isSchema
    ? `${spec.displayName} Setup Pending`
    : isTimeout
    ? `Request Timed Out — ${spec.displayName}`
    : `Unable to Retrieve ${spec.displayName} Records`;

  const lines: string[] = [`### ${title}`];

  if (isRls) {
    lines.push(
      `Your account does not have permission to perform this action or view these records in **${spec.displayName}**.`,
      `#### What Requires Attention`,
      `- Your current role (**${caller.roleLabel}**) is restricted from reading this set of records.`,
      `#### Recommended Next Step`,
      `- Contact your **Managing Director**, **Operations Admin**, or **HR Manager** if you require access to **${spec.displayName}**.`
    );
  } else if (isSchema) {
    lines.push(
      `The **${spec.displayName}** records are not yet active in this environment. To keep reporting accurate, this is shown as a setup notice rather than zero records.`,
      `#### What Requires Attention`,
      `- The data storage for **${friendlySource}** has not finished initial setup by the system administrator.`,
      `#### Recommended Next Step`,
      `- Ask your system administrator to complete the **${spec.displayName}** workspace setup, then click **Retry**.`
    );
  } else if (isTimeout) {
    lines.push(
      `The system took too long to retrieve the information from **${spec.displayName}**. To keep reporting accurate, timed-out requests are never shown as zero records.`,
      `#### Recommended Next Step`,
      `- Click **Retry** below, or narrow your question to a shorter date range (for example, *this week* or *this month*).`
    );
  } else {
    lines.push(
      `The request could not be completed while retrieving records from **${spec.displayName}**. To keep reporting accurate, failed requests are never shown as zero records.`,
      `#### Recommended Next Step`,
      `- Check your connection and click **Retry**, or open [${spec.displayName}](${spec.route}) directly.`
    );
  }

  const technicalDetails = `Source: ${tableName} | Code: ${error.code || "N/A"} | Message: ${error.message}`;

  if (intent.wantsTechnicalDiagnostics) {
    lines.push(
      `#### Technical Diagnostics`,
      `- **Table:** \`${tableName}\``,
      `- **Code:** \`${error.code || "N/A"}\``,
      `- **Diagnostic Message:** \`${error.message}\``
    );
  }

  return {
    status,
    intentType: intent.intentType,
    moduleId,
    title,
    summary: isRls
      ? "Your account does not have permission to perform this action."
      : isTimeout
      ? "The system took too long to retrieve the information."
      : isSchema
      ? `${spec.displayName} setup is pending in this environment.`
      : "The request could not be completed.",
    markdown: lines.join("\n\n"),
    metrics: [
      { label: "Workspace", value: spec.displayName, tone: "slate" },
      {
        label: "Status",
        value: isRls ? "Access Restricted" : isSchema ? "Setup Pending" : isTimeout ? "Timed Out" : "Unavailable",
        tone: "rose",
      },
    ],
    links: resolveAuthorizedLinks(caller, [moduleId, "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, moduleId),
    sourceMeta: {
      tablesQueried: [tableName],
      sourcesLabel: friendlySource,
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `${spec.displayName} verification status`,
      technicalDetails: intent.wantsTechnicalDiagnostics ? technicalDetails : undefined,
    },
  };
}

/**
 * Main entry point for executing any user query against the ABLEBIZ AI Secretary.
 */
export async function executeAssistantQuery(
  rawQuery: string,
  caller: AssistantCallerContext,
  context?: ConversationContext,
  options?: {
    adapter?: AssistantDataAdapter;
    now?: Date;
    topicHint?: AssistantTopicFilterId;
  }
): Promise<{
  payload: AssistantResponsePayload;
  updatedContext: ConversationContext;
}> {
  const now = options?.now ? new Date(options.now.getTime()) : new Date();
  const adapter = options?.adapter || defaultSupabaseAdapter;
  const intent = classifyAssistantIntent(
    rawQuery,
    caller,
    context,
    now,
    options?.topicHint
  );
  const prefix = buildSpoofAndMutationPrefix(intent, caller);

  const updatedContext: ConversationContext = {
    lastModuleId: intent.primaryModule,
    lastIntentType: intent.intentType,
    lastDateRange: intent.dateRange,
    lastQueryText: rawQuery.trim(),
    lastGuideTopicId: intent.guideTopicId,
    turnCount: (context?.turnCount || 0) + 1,
  };

  // 1. Handle Unsupported Features explicitly
  if (intent.intentType === "unsupported_feature") {
    const spec = getModuleSpec(intent.primaryModule);
    const links = resolveAuthorizedLinks(caller, [intent.primaryModule, "dashboard"]);
    const markdown = [
      prefix + `### Feature Not Available in ABLEBIZ SUITE`,
      intent.unsupportedReason ||
        `The requested capability is not currently available in **${spec.displayName}**.`,
      `#### What You Can Do in ${spec.displayName}`,
      ...spec.supportedOperations.map((op) => `- ${op}`),
      `#### Recommended Next Step`,
      `- Open [${spec.displayName}](${spec.route}) to use the supported tools available for your role.`,
    ].join("\n\n");

    return {
      updatedContext,
      payload: {
        status: "unsupported",
        intentType: "unsupported_feature",
        moduleId: intent.primaryModule,
        title: "Feature Not Available",
        summary: intent.unsupportedReason || "Feature not available in ABLEBIZ SUITE.",
        markdown,
        metrics: [
          { label: "Workspace", value: spec.displayName, tone: "amber" },
          { label: "Availability", value: "Not Available", tone: "rose" },
        ],
        links,
        followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, updatedContext),
        sourceMeta: {
          tablesQueried: [],
          sourcesLabel: spec.displayName,
          reportingPeriodLabel: intent.dateRange.label,
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `${spec.displayName} capability guide`,
        },
      },
    };
  }

  // 2. Handle Capability Overview ("What can you do?")
  if (intent.intentType === "capability_overview") {
    const accessibleModules = Object.values(CAPABILITY_CATALOGUE).filter((m) =>
      canCallerAccessModule(caller, m.id as SuiteModuleId)
    );
    const restrictedModules = Object.values(CAPABILITY_CATALOGUE).filter(
      (m) => !canCallerAccessModule(caller, m.id as SuiteModuleId)
    );

    const markdown = [
      prefix + `### How ABLEBIZ AI Secretary Can Help You`,
      `Signed in as **${caller.userName}** (**${caller.roleLabel}**). You have access to **${accessibleModules.length} of ${Object.keys(CAPABILITY_CATALOGUE).length} Suite workspaces**.`,
      `#### 1. Live Operational Reports`,
      `Ask questions in plain English about current workloads, deadlines, approvals, or financial summaries across your authorized workspaces:\n` +
        accessibleModules
          .map((m) => `- **[${m.displayName}](${m.route}):** ${m.purpose}`)
          .join("\n"),
      `#### 2. Step-by-Step Suite Guide & Workflow Help`,
      `Ask *"How do I..."* or *"Why is this button disabled?"* for guided walkthroughs on daily tasks:\n` +
        SUITE_GUIDE_TOPICS.slice(0, 8)
          .map((t) => `- **${t.title}** ([Open Workspace](${t.route}))`)
          .join("\n"),
      restrictedModules.length > 0
        ? `#### 3. Workspaces Restricted for ${caller.roleLabel}\n` +
          restrictedModules
            .map(
              (m) =>
                `- **${m.displayName}** — available to ${m.allowedRolesSummary}`
            )
            .join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      updatedContext,
      payload: {
        status: "ok",
        intentType: "capability_overview",
        moduleId: "dashboard",
        title: "ABLEBIZ AI Secretary Guide & Capabilities",
        summary: `${accessibleModules.length} authorized workspaces available for ${caller.roleLabel}.`,
        markdown,
        metrics: [
          { label: "Your Role", value: caller.roleLabel, tone: "emerald" },
          { label: "Authorized Workspaces", value: String(accessibleModules.length), tone: "blue" },
          { label: "Guided Workflows", value: String(SUITE_GUIDE_TOPICS.length), tone: "slate" },
        ],
        links: resolveAuthorizedLinks(caller, ["dashboard", "cac_operations", "service_requests", "hr", "tasks"]).slice(0, 4),
        followUpSuggestions: getContextualFollowUpQuestions(caller, "dashboard", updatedContext),
        sourceMeta: {
          tablesQueried: [],
          sourcesLabel: "ABLEBIZ Suite Directory",
          reportingPeriodLabel: "Current Configuration",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `Authorized workspaces for ${caller.roleLabel}`,
        },
      },
    };
  }

  // 3. Handle Permission Explanation ("Why is a button unavailable to my role?")
  if (intent.intentType === "permission_explanation") {
    const built = buildRolePermissionResponse(caller, rawQuery, intent.wantsTechnicalDiagnostics);
    const markdown = prefix + (typeof built === "string" ? built : built.markdown);
    return {
      updatedContext,
      payload: {
        status: "ok",
        intentType: "permission_explanation",
        moduleId: intent.primaryModule,
        title: `Role & Approval Guide (${caller.roleLabel})`,
        summary: `Explanation of role access and approval rules for ${caller.roleLabel}.`,
        markdown,
        metrics: [
          { label: "Your Role", value: caller.roleLabel, tone: "blue" },
          { label: "Approval Tier", value: caller.isManagement ? "Management Approver" : "Standard Staff", tone: "emerald" },
        ],
        links: resolveAuthorizedLinks(caller, [intent.primaryModule, "dashboard", "hr", "team"]).slice(0, 3),
        followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, updatedContext),
        sourceMeta: {
          tablesQueried: [],
          sourcesLabel: "Role & Approval Rules",
          reportingPeriodLabel: "Active Session",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `Access rules for ${caller.roleLabel}`,
        },
      },
    };
  }

  // 4. Handle Troubleshooting ("How do I correct a failed operation?")
  if (intent.intentType === "troubleshooting") {
    const built = buildTroubleshootingResponse(caller, rawQuery, intent.wantsTechnicalDiagnostics);
    const markdown = prefix + (typeof built === "string" ? built : built.markdown);
    return {
      updatedContext,
      payload: {
        status: "ok",
        intentType: "troubleshooting",
        moduleId: intent.primaryModule,
        title: "Workflow Troubleshooting & Next Steps",
        summary: "Clear steps to resolve rejected, queried, or unavailable actions.",
        markdown,
        metrics: [
          { label: "Your Role", value: caller.roleLabel, tone: "blue" },
          { label: "Support Mode", value: "Troubleshooting Guide", tone: "amber" },
        ],
        links: resolveAuthorizedLinks(caller, [intent.primaryModule, "dashboard", "cac_operations", "hr"]).slice(0, 4),
        followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, updatedContext),
        sourceMeta: {
          tablesQueried: [],
          sourcesLabel: "ABLEBIZ Workflow Guide",
          reportingPeriodLabel: "Current Workflow Rules",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: "Operational troubleshooting guide",
        },
      },
    };
  }

  // 5. Handle Suite Guide ("How do I...")
  if (intent.intentType === "suite_guide" || intent.isWriteMutationAttempt) {
    const topic =
      (intent.guideTopicId ? getGuideTopicById(intent.guideTopicId) : null) ||
      matchGuideTopic(rawQuery, intent.primaryModule);

    if (topic) {
      const canAccessTopicModule = canCallerAccessModule(caller, topic.moduleId);
      const built = formatGuideTopicResponse(topic, caller, intent.wantsTechnicalDiagnostics);
      const markdown = prefix + (typeof built === "string" ? built : built.markdown);
      const links = resolveAuthorizedLinks(caller, [
        topic.moduleId,
        "dashboard",
        "tasks",
      ]);

      return {
        updatedContext: {
          ...updatedContext,
          lastModuleId: topic.moduleId,
          lastGuideTopicId: topic.id,
        },
        payload: {
          status: canAccessTopicModule ? "ok" : "permission_denied",
          intentType: "suite_guide",
          moduleId: topic.moduleId,
          title: topic.title,
          summary: topic.summary,
          markdown,
          metrics: [
            { label: "Workspace", value: getModuleSpec(topic.moduleId).displayName, tone: "blue" },
            {
              label: "Your Access",
              value: canAccessTopicModule ? "Authorized" : "Restricted",
              tone: canAccessTopicModule ? "emerald" : "amber",
            },
          ],
          links,
          followUpSuggestions: getContextualFollowUpQuestions(caller, topic.moduleId, updatedContext),
          sourceMeta: {
            tablesQueried: getModuleSpec(topic.moduleId).tables,
            sourcesLabel: `${getModuleSpec(topic.moduleId).displayName} Guide`,
            reportingPeriodLabel: "Suite Workflow Guide",
            timezone: ABILITY_TIMEZONE,
            fetchedAtIso: now.toISOString(),
            fetchedAtFormatted: formatDateTimeLagos(now),
            roleApplied: caller.role,
            scopeDescription: `Step-by-step guide for ${getModuleSpec(topic.moduleId).displayName}`,
          },
        },
      };
    }

    // Fallback module-level guide in 6-part structure
    const spec = getModuleSpec(intent.primaryModule);
    const canAccess = canCallerAccessModule(caller, intent.primaryModule);
    const markdown = [
      prefix + `### How to Use ${spec.displayName}`,
      spec.purpose,
      `#### 1. Where to Go`,
      `- Open **[${spec.displayName}](${spec.route})** from the left navigation sidebar.`,
      `#### 2. What to Select`,
      ...spec.supportedOperations.map((op, i) => `${i + 1}. ${op}`),
      `#### 3. What Information Is Needed`,
      `- Complete all required fields on the form before clicking **Save** or **Submit**.`,
      `#### 4. What Happens After Submission`,
      `- Your updates are saved immediately to **${spec.displayName}** and logged in the activity history.`,
      `#### 5. Who Can Approve or Complete the Action`,
      `- **Authorized Roles:** ${spec.allowedRolesSummary}`,
      `- **Your Access (${caller.roleLabel}):** ${canAccess ? "Authorized" : "Restricted for your role"}`,
      `#### 6. What to Do if the Expected Action Is Unavailable`,
      `- ${spec.knownLimitations.join(" ")}`,
    ].join("\n\n");

    return {
      updatedContext,
      payload: {
        status: canAccess ? "ok" : "permission_denied",
        intentType: "suite_guide",
        moduleId: intent.primaryModule,
        title: `Guide: ${spec.displayName}`,
        summary: spec.purpose,
        markdown,
        links: resolveAuthorizedLinks(caller, [intent.primaryModule, "dashboard"]),
        followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, updatedContext),
        sourceMeta: {
          tablesQueried: spec.tables,
          sourcesLabel: `${spec.displayName} Guide`,
          reportingPeriodLabel: "Suite Workflow Guide",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `Workspace guide for ${spec.displayName}`,
        },
      },
    };
  }

  // 6. Operational Reports — Enforce RBAC before querying
  if (!canCallerAccessModule(caller, intent.primaryModule)) {
    return {
      updatedContext,
      payload: buildPermissionDeniedPayload(caller, intent.primaryModule, intent, now),
    };
  }

  // Dispatch to verified module report handler
  const payload = await runOperationalReportForModule(
    intent,
    caller,
    adapter,
    now,
    prefix,
    updatedContext
  );

  return {
    updatedContext,
    payload,
  };
}

async function runOperationalReportForModule(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  if (intent.subIntent === "service_profitability") {
    return handleServiceProfitabilityAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "cash_flow_forecast") {
    return handleCashFlowForecastAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "compliance_management") {
    return handleComplianceManagementAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "appointments_scheduling" || intent.primaryModule === "appointments") {
    return handleAppointmentsAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "service_quality" || intent.primaryModule === "service_quality") {
    return handleServiceQualityAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "staff_performance" || intent.primaryModule === "staff_performance") {
    return handleStaffPerformanceAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.primaryModule === "knowledge_base" || intent.subIntent === "search") {
    return handleKnowledgeBaseAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.primaryModule === "approvals") {
    return handleApprovalsAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.primaryModule === "executive_dashboard") {
    return handleExecutiveDashboardAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "backup_continuity") {
    return handleBackupContinuityAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "marketing_attribution") {
    return handleMarketingAttributionAssistantReport(intent, caller, adapter, now, prefix, context);
  }
  if (intent.subIntent === "receipt_profitability") {
    return handleReceiptProfitabilityAssistantReport(intent, caller, adapter, now, prefix, context);
  }

  switch (intent.primaryModule) {
    case "hr":
      return handleHrOperationalReport(intent, caller, adapter, now, prefix, context);
    case "cac_operations":
      return handleCacOperationalReport(intent, caller, adapter, now, prefix, context);
    case "service_requests":
      return handleServiceRequestsReport(intent, caller, adapter, now, prefix, context);
    case "services_catalog":
      return handleServicesCatalogReport(intent, caller, adapter, now, prefix, context);
    case "invoices":
    case "payments":
    case "quotations":
    case "expenses":
    case "vendors":
      return handleFinanceOperationalReport(intent, caller, adapter, now, prefix, context);
    case "referrals":
      return handleReferralsOperationalReport(intent, caller, adapter, now, prefix, context);
    case "leads":
    case "follow_ups":
    case "communications":
      return handleCrmLeadsAndFollowUpsReport(intent, caller, adapter, now, prefix, context);
    case "clients":
    case "businesses":
      return handleClientsAndBusinessesReport(intent, caller, adapter, now, prefix, context);
    case "tasks":
      return handleTasksOperationalReport(intent, caller, adapter, now, prefix, context);
    case "documents":
      return handleDocumentsReport(intent, caller, adapter, now, prefix, context);
    case "team":
      return handleStaffAndRbacReport(intent, caller, adapter, now, prefix, context);
    case "audit_logs":
      return handleAuditLogsReport(intent, caller, adapter, now, prefix, context);
    case "settings":
      return handleSettingsAndBankReport(intent, caller, adapter, now, prefix, context);
    case "notifications":
      return handleNotificationsReport(intent, caller, adapter, now, prefix, context);
    case "reports":
    case "dashboard":
    default:
      return handleManagementAttentionReport(intent, caller, adapter, now, prefix, context);
  }
}

/**
 * HR & Staff Portal Operational Report (Leave, Attendance, Directory, Announcements)
 */
async function handleHrOperationalReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const q = intent.normalizedQuery.toLowerCase();
  const isAttendanceQuery =
    intent.subIntent === "attendance" || /\b(attendance|check[- ]?in|late|present|absent)\b/.test(q);

  if (isAttendanceQuery) {
    const [attRes, staffRes] = await Promise.all([
      adapter.queryTable("hr_attendance_logs", {
        orderBy: { column: "attendance_date", ascending: false },
        limit: 250,
      }),
      adapter.queryTable("staff_profiles", { limit: 200 }),
    ]);

    if (attRes.error) {
      return buildErrorOrSchemaPayload(caller, "hr", intent, "hr_attendance_logs", attRes.error, now);
    }

    const staffMap = new Map<string, any>();
    (staffRes.data || []).forEach((s: any) => staffMap.set(s.id, s));

    let rows = attRes.data || [];
    if (!caller.hrAccess.canViewAllAttendance && caller.userId) {
      const ownProfile = (staffRes.data || []).find((s: any) => s.user_id === caller.userId);
      rows = ownProfile ? rows.filter((r: any) => r.staff_profile_id === ownProfile.id) : [];
    }

    if (intent.dateRange.startDate && intent.dateRange.endDate) {
      rows = rows.filter((r: any) =>
        overlapsDateWindow(
          r.attendance_date,
          r.attendance_date,
          intent.dateRange.startDate!,
          intent.dateRange.endDate!
        )
      );
    }

    const presentCount = rows.filter((r: any) => r.status === "present" || r.status === "remote").length;
    const lateCount = rows.filter((r: any) => r.status === "late").length;
    const absentOrLeaveCount = rows.filter((r: any) => r.status === "absent" || r.status === "on_leave").length;

    const status: QueryResultStatus = rows.length === 0 ? "empty" : "ok";
    const scopeNote = caller.hrAccess.canViewAllAttendance
      ? "Organization-wide attendance records"
      : "Your personal attendance records";

    const markdown = [
      prefix + `### Staff Attendance Summary (${intent.dateRange.label})`,
      rows.length === 0
        ? `No matching attendance records were found for **${intent.dateRange.label}** (${scopeNote}).`
        : `Found **${formatCount(rows.length)}** attendance record(s) for **${intent.dateRange.label}** (${scopeNote}).`,
      `#### Key Figures`,
      `- **Present / Remote:** ${formatCount(presentCount)}`,
      `- **Late Check-Ins:** ${formatCount(lateCount)}`,
      `- **Absent / On Leave:** ${formatCount(absentOrLeaveCount)}`,
      `#### Recommended Next Action`,
      `- Open [HR & Staff Portal](/admin/hr) and select the **Attendance** tab to record daily check-in/check-out or review staff attendance logs.`,
    ].join("\n\n");

    return {
      status,
      intentType: "operational_report",
      moduleId: "hr",
      title: `Attendance Report (${intent.dateRange.label})`,
      summary: `${rows.length} attendance records found.`,
      markdown,
      metrics: [
        { label: "Total Logs", value: formatCount(rows.length), tone: "blue" },
        { label: "Present / Remote", value: formatCount(presentCount), tone: "emerald" },
        { label: "Late", value: formatCount(lateCount), tone: lateCount > 0 ? "amber" : "slate" },
        { label: "Absent / On Leave", value: formatCount(absentOrLeaveCount), tone: "slate" },
      ],
      table:
        rows.length > 0
          ? {
              caption: "Recent Attendance Logs",
              headers: ["Date", "Staff Member", "Status", "Work Mode", "Check-In"],
              rows: rows.slice(0, 10).map((r: any) => {
                const st = staffMap.get(r.staff_profile_id);
                return [
                  formatShortDate(r.attendance_date),
                  st?.full_name || "Staff Member",
                  formatReadableLabel(r.status, "Present"),
                  formatReadableLabel(r.work_mode, "Office"),
                  r.check_in_at ? formatDateTimeLagos(r.check_in_at) : "—",
                ];
              }),
            }
          : undefined,
      links: resolveAuthorizedLinks(caller, ["hr", "dashboard"]),
      followUpSuggestions: getContextualFollowUpQuestions(caller, "hr", context),
      sourceMeta: {
        tablesQueried: ["hr_attendance_logs", "staff_profiles"],
        sourcesLabel: formatFriendlySourceNames(["hr_attendance_logs", "staff_profiles"]),
        reportingPeriodLabel: intent.dateRange.label,
        timezone: ABILITY_TIMEZONE,
        fetchedAtIso: now.toISOString(),
        fetchedAtFormatted: formatDateTimeLagos(now),
        roleApplied: caller.role,
        scopeDescription: scopeNote,
      },
    };
  }

  // Default HR Report: Leave Schedule & Staff Leave Status
  const [leaveRes, staffRes] = await Promise.all([
    adapter.queryTable("hr_leave_requests", {
      orderBy: { column: "start_date", ascending: true },
      limit: 300,
    }),
    adapter.queryTable("staff_profiles", { limit: 200 }),
  ]);

  if (leaveRes.error) {
    return buildErrorOrSchemaPayload(caller, "hr", intent, "hr_leave_requests", leaveRes.error, now);
  }
  if (staffRes.error) {
    return buildErrorOrSchemaPayload(caller, "hr", intent, "staff_profiles", staffRes.error, now);
  }

  const allStaff = staffRes.data || [];
  const staffMap = new Map<string, any>();
  allStaff.forEach((s: any) => staffMap.set(s.id, s));

  const effectiveRange: ParsedDateRange =
    intent.dateRange.preset === "all_time" && /\b(who is|which staff|upcoming|on leave)\b/.test(q)
      ? parseQueryDateRange("next 3 weeks", now)
      : intent.dateRange;

  let leaveRows = leaveRes.data || [];
  const canViewAllLeave = caller.hrAccess.canViewAllLeave;

  if (!canViewAllLeave && caller.userId) {
    const ownProfile = allStaff.find(
      (s: any) => s.user_id === caller.userId || (caller.email && s.email === caller.email)
    );
    leaveRows = ownProfile
      ? leaveRows.filter((r: any) => r.staff_profile_id === ownProfile.id)
      : [];
  }

  if (effectiveRange.startDate && effectiveRange.endDate) {
    leaveRows = leaveRows.filter((r: any) =>
      overlapsDateWindow(r.start_date, r.end_date, effectiveRange.startDate!, effectiveRange.endDate!)
    );
  }

  const approvedLeaves = leaveRows.filter((r: any) => r.status === "approved");
  const pendingLeaves = leaveRows.filter(
    (r: any) => r.status === "pending" || r.status === "correction_requested"
  );
  const rejectedOrCancelledLeaves = leaveRows.filter(
    (r: any) => r.status === "rejected" || r.status === "cancelled"
  );

  const currentlyOnLeaveProfiles = canViewAllLeave
    ? allStaff.filter((s: any) => s.employment_status === "on_leave")
    : [];

  const scopeDescription = canViewAllLeave
    ? "Organization-wide staff leave schedule"
    : "Your personal leave records (organization-wide leave schedules are restricted to HR Manager, Operations Admin, Managing Director, and Super Admin)";

  const status: QueryResultStatus =
    leaveRows.length === 0 && currentlyOnLeaveProfiles.length === 0 ? "empty" : "ok";

  const markdownLines: string[] = [
    prefix + `### Staff Leave Report — ${effectiveRange.label}`,
  ];

  if (status === "empty") {
    markdownLines.push(
      `No matching approved or pending leave records were found between **${effectiveRange.startDate || "the start date"}** and **${effectiveRange.endDate || "the end date"}**.`
    );
    if (!canViewAllLeave) {
      markdownLines.push(
        `> **Access Scope Note:** Your role (**${caller.roleLabel}**) only allows viewing your personal leave requests. Organization-wide staff leave schedules are available to **Managing Director, Super Admin, Operations Admin, and HR Manager**.`
      );
    }
  } else {
    markdownLines.push(
      `Found **${formatCount(approvedLeaves.length)} approved** leave record(s) and **${formatCount(pendingLeaves.length)} pending** request(s) overlapping **${effectiveRange.startDate || "all dates"} to ${effectiveRange.endDate || "all dates"}**.`
    );
  }

  markdownLines.push(
    `#### Key Figures & Findings`,
    `- **Approved Leave in Period:** ${formatCount(approvedLeaves.length)}`,
    `- **Pending Review / Correction Requested:** ${formatCount(pendingLeaves.length)}`,
    `- **Declined / Cancelled in Period:** ${formatCount(rejectedOrCancelledLeaves.length)}`,
    `- **Staff Currently Marked On Leave:** ${formatCount(currentlyOnLeaveProfiles.length)}`,
    `- **Access Scope:** ${scopeDescription}`,
    `#### Recommended Next Action`,
    canViewAllLeave
      ? `- Open [HR & Staff Portal](/admin/hr) and select **Leave Management** to review pending requests or verify relief officer coverage.`
      : `- Open [HR & Staff Portal](/admin/hr) and select **Leave Management** to submit or track your personal leave requests.`
  );

  const combinedForTable = [...approvedLeaves, ...pendingLeaves];

  return {
    status,
    intentType: "operational_report",
    moduleId: "hr",
    title: `Staff Leave Schedule (${effectiveRange.label})`,
    summary: `${approvedLeaves.length} approved, ${pendingLeaves.length} pending leave requests in period.`,
    markdown: markdownLines.join("\n\n"),
    metrics: [
      { label: "Approved Leave", value: formatCount(approvedLeaves.length), tone: "emerald" },
      {
        label: "Pending Approval",
        value: formatCount(pendingLeaves.length),
        tone: pendingLeaves.length > 0 ? "amber" : "slate",
      },
      {
        label: "Currently On Leave",
        value: formatCount(currentlyOnLeaveProfiles.length),
        tone: "blue",
      },
      {
        label: "Period",
        value:
          effectiveRange.startDate && effectiveRange.endDate
            ? `${effectiveRange.startDate} → ${effectiveRange.endDate}`
            : effectiveRange.label,
        tone: "slate",
      },
    ],
    table:
      combinedForTable.length > 0
        ? {
            caption: `Staff Leave Requests (${effectiveRange.label})`,
            headers: ["Staff Member", "Leave Type", "Start Date", "End Date", "Days", "Status"],
            rows: combinedForTable.slice(0, 15).map((r: any) => {
              const st = staffMap.get(r.staff_profile_id);
              return [
                st?.full_name || "Staff Member",
                formatReadableLabel(r.leave_type, "Annual"),
                formatShortDate(r.start_date),
                formatShortDate(r.end_date),
                String(r.days_count ?? 1),
                formatReadableLabel(r.status, "Pending"),
              ];
            }),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["hr", "team", "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "hr", context),
    sourceMeta: {
      tablesQueried: ["hr_leave_requests", "staff_profiles"],
      sourcesLabel: formatFriendlySourceNames(["hr_leave_requests", "staff_profiles"]),
      reportingPeriodLabel: effectiveRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription,
    },
  };
}

/**
 * CAC Operations & Incorporation Pipeline Report
 */
async function handleCacOperationalReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const cacRes = await adapter.queryTable("cac_applications", {
    orderBy: { column: "created_at", ascending: false },
    limit: 500,
  });

  if (cacRes.error) {
    return buildErrorOrSchemaPayload(caller, "cac_operations", intent, "cac_applications", cacRes.error, now);
  }

  const allCac = cacRes.data || [];
  const filteredCac =
    intent.dateRange.preset === "all_time"
      ? allCac
      : allCac.filter((c: any) => isDateInRange(c.created_at || c.submission_date, intent.dateRange));

  const todayYmd = now.toISOString().slice(0, 10);
  const completedStages = new Set(["approved", "post_incorporation", "completed", "closed"]);

  const activeFilings = filteredCac.filter(
    (c: any) =>
      !completedStages.has(String(c.stage || "").toLowerCase()) &&
      !["completed", "rejected", "cancelled"].includes(String(c.status || "").toLowerCase())
  );

  const queriedFilings = filteredCac.filter(
    (c: any) =>
      String(c.stage || "").toLowerCase() === "queried" ||
      String(c.status || "").toLowerCase() === "queried"
  );

  const waitingReviewFilings = filteredCac.filter((c: any) =>
    ["intake", "docs_collected", "availability_check", "name_reservation", "internal_review"].includes(
      String(c.stage || "").toLowerCase()
    )
  );

  const submittedToCacFilings = filteredCac.filter((c: any) =>
    ["submitted_to_cac", "under_processing", "certificate_issued"].includes(
      String(c.stage || "").toLowerCase()
    )
  );

  const overdueFilings = activeFilings.filter((c: any) => {
    if (c.sla_due_date && String(c.sla_due_date).slice(0, 10) < todayYmd) {
      return true;
    }
    return false;
  });

  const completedFilings = filteredCac.filter(
    (c: any) =>
      completedStages.has(String(c.stage || "").toLowerCase()) ||
      String(c.status || "").toLowerCase() === "completed"
  );

  const status: QueryResultStatus = filteredCac.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### CAC Filing & Incorporation Report (${intent.dateRange.label})`,
    filteredCac.length === 0
      ? `No matching CAC filing records were found for **${intent.dateRange.label}**. (Total filings across all dates: **${formatCount(allCac.length)}**).`
      : `Found **${formatCount(filteredCac.length)}** CAC filing application(s) for **${intent.dateRange.label}**.`,
    `#### Key Figures & Findings`,
    `- **Active / In-Progress Filings:** ${formatCount(activeFilings.length)}`,
    `- **Waiting for Internal Review & Preparation:** ${formatCount(waitingReviewFilings.length)} (Intake, Document Collection, Name Availability, Name Reservation, or Internal Review)`,
    `- **Submitted to CAC / Under Processing:** ${formatCount(submittedToCacFilings.length)}`,
    `- **Queried by CAC (Requires Immediate Attention):** ${formatCount(queriedFilings.length)}`,
    `- **Overdue Past Target Due Date:** ${formatCount(overdueFilings.length)}`,
    `- **Approved & Completed:** ${formatCount(completedFilings.length)}`,
    `#### Recommended Next Action`,
    queriedFilings.length > 0 || overdueFilings.length > 0
      ? `- Prioritize the **${formatCount(queriedFilings.length)} queried** and **${formatCount(overdueFilings.length)} overdue** application(s) in [CAC Operations](/admin/cac-operations) by uploading supporting documents and updating their filing stage.`
      : `- Review the **${formatCount(waitingReviewFilings.length)}** application(s) in internal preparation in [CAC Operations](/admin/cac-operations).`,
  ].join("\n\n");

  const focusList =
    intent.subIntent === "overdue_or_queried" && (queriedFilings.length > 0 || overdueFilings.length > 0)
      ? [...queriedFilings, ...overdueFilings.filter((o: any) => !queriedFilings.includes(o))]
      : intent.subIntent === "waiting_review" && waitingReviewFilings.length > 0
      ? waitingReviewFilings
      : filteredCac;

  return {
    status,
    intentType: "operational_report",
    moduleId: "cac_operations",
    title: "CAC Operations Pipeline",
    summary: `${activeFilings.length} active, ${queriedFilings.length} queried, ${overdueFilings.length} overdue, ${completedFilings.length} completed.`,
    markdown,
    metrics: [
      { label: "Total Applications", value: formatCount(filteredCac.length), tone: "blue" },
      { label: "Active Pipeline", value: formatCount(activeFilings.length), tone: "slate" },
      {
        label: "Queried by CAC",
        value: formatCount(queriedFilings.length),
        tone: queriedFilings.length > 0 ? "rose" : "emerald",
      },
      {
        label: "Overdue Target",
        value: formatCount(overdueFilings.length),
        tone: overdueFilings.length > 0 ? "amber" : "emerald",
      },
    ],
    table:
      focusList.length > 0
        ? {
            caption: "CAC Filing Applications Snapshot",
            headers: ["Business / Proposed Name", "Service Type", "Current Stage", "Status", "Target Due Date"],
            rows: focusList.slice(0, 12).map((c: any) => [
              c.business_name || c.proposed_name_1 || "Unnamed Application",
              c.service_type || "CAC Registration",
              formatReadableLabel(c.stage, "Intake"),
              formatReadableLabel(c.status, "In Progress"),
              formatShortDate(c.sla_due_date),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["cac_operations", "service_requests", "documents"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "cac_operations", context),
    sourceMeta: {
      tablesQueried: ["cac_applications"],
      sourcesLabel: formatFriendlySourceNames(["cac_applications"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "CAC filing pipeline across all stages",
    },
  };
}

/**
 * Service Requests Report
 */
async function handleServiceRequestsReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const srRes = await adapter.queryTable("service_requests", {
    orderBy: { column: "created_at", ascending: false },
    limit: 400,
  });

  if (srRes.error) {
    return buildErrorOrSchemaPayload(caller, "service_requests", intent, "service_requests", srRes.error, now);
  }

  const allSr = srRes.data || [];
  const filtered =
    intent.dateRange.preset === "all_time"
      ? allSr
      : allSr.filter((r: any) => isDateInRange(r.created_at, intent.dateRange));

  const todayYmd = now.toISOString().slice(0, 10);
  const pendingOrReview = filtered.filter((r: any) =>
    ["pending", "submitted", "in_review", "awaiting_Action", "awaiting_action", "queried"].includes(
      String(r.status || "")
    )
  );
  const inProgress = filtered.filter((r: any) => String(r.status || "") === "in_progress");
  const completed = filtered.filter((r: any) => String(r.status || "") === "completed");
  const overdue = filtered.filter(
    (r: any) =>
      r.due_date &&
      String(r.due_date).slice(0, 10) < todayYmd &&
      !["completed", "cancelled", "rejected"].includes(String(r.status || ""))
  );

  const status: QueryResultStatus = filtered.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Service Requests Pipeline (${intent.dateRange.label})`,
    filtered.length === 0
      ? `No matching service requests were found for **${intent.dateRange.label}**.`
      : `Found **${formatCount(filtered.length)}** client service request(s) for **${intent.dateRange.label}**.`,
    `#### Key Figures & Findings`,
    `- **Awaiting Action / In Review / Queried:** ${formatCount(pendingOrReview.length)}`,
    `- **In Progress:** ${formatCount(inProgress.length)}`,
    `- **Overdue Past Due Date:** ${formatCount(overdue.length)}`,
    `- **Completed:** ${formatCount(completed.length)}`,
    `#### Recommended Next Action`,
    `- Open [Service Requests](/admin/service-requests) to assign unassigned requests, resolve queried items, or convert approved CAC requests into active filings.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "service_requests",
    title: "Service Requests Summary",
    summary: `${filtered.length} service requests (${pendingOrReview.length} awaiting review/action, ${overdue.length} overdue).`,
    markdown,
    metrics: [
      { label: "Total Requests", value: formatCount(filtered.length), tone: "blue" },
      {
        label: "Needs Attention",
        value: formatCount(pendingOrReview.length),
        tone: pendingOrReview.length > 0 ? "amber" : "slate",
      },
      { label: "In Progress", value: formatCount(inProgress.length), tone: "slate" },
      { label: "Overdue", value: formatCount(overdue.length), tone: overdue.length > 0 ? "rose" : "emerald" },
    ],
    table:
      filtered.length > 0
        ? {
            caption: "Service Requests Snapshot",
            headers: ["Service Name", "Stage", "Status", "Priority", "Due Date"],
            rows: filtered.slice(0, 10).map((r: any) => [
              r.custom_service_name || "Catalogue Service Request",
              formatReadableLabel(r.progress_stage, "Intake"),
              formatReadableLabel(r.status, "Pending"),
              formatReadableLabel(r.priority, "Medium"),
              formatShortDate(r.due_date),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["service_requests", "cac_operations", "services_catalog"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "service_requests", context),
    sourceMeta: {
      tablesQueried: ["service_requests"],
      sourcesLabel: formatFriendlySourceNames(["service_requests"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Client service request pipeline",
    },
  };
}

/**
 * Services Catalogue Report
 */
async function handleServicesCatalogReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const res = await adapter.queryTable("services_catalog", {
    orderBy: { column: "name", ascending: true },
    limit: 200,
  });

  if (res.error) {
    return buildErrorOrSchemaPayload(caller, "services_catalog", intent, "services_catalog", res.error, now);
  }

  const rows = res.data || [];
  const activeRows = rows.filter((r: any) => r.is_active !== false);
  const status: QueryResultStatus = rows.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Service Catalogue Summary`,
    rows.length === 0
      ? `No matching services were found in the Service Catalogue.`
      : `Found **${formatCount(rows.length)}** service offering(s) in the Service Catalogue (**${formatCount(activeRows.length)} active**).`,
    `#### Recommended Next Action`,
    `- Open [Services Catalogue](/admin/services-catalog) to review base pricing, required document checklists, and turnaround times.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "services_catalog",
    title: "Service Catalogue Overview",
    summary: `${activeRows.length} active services configured.`,
    markdown,
    metrics: [
      { label: "Total Services", value: formatCount(rows.length), tone: "blue" },
      { label: "Active Offerings", value: formatCount(activeRows.length), tone: "emerald" },
    ],
    table:
      rows.length > 0
        ? {
            caption: "Configured Services in Catalogue",
            headers: ["Service Name", "Category", "Base Price", "Turnaround", "Status"],
            rows: rows.slice(0, 12).map((s: any) => [
              s.name || "Service",
              s.category || "General",
              formatNgn(Number(s.base_price || 0)),
              s.estimated_turnaround || "Standard",
              s.is_active !== false ? "Active" : "Inactive",
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["services_catalog", "service_requests"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "services_catalog", context),
    sourceMeta: {
      tablesQueried: ["services_catalog"],
      sourcesLabel: formatFriendlySourceNames(["services_catalog"]),
      reportingPeriodLabel: "Current Catalogue",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Service Catalogue offerings",
    },
  };
}

/**
 * Service Profitability & Cost Analysis (Phase 6 AI Secretary Query)
 */
async function handleServiceProfitabilityAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  if (!caller.permissions.includes("finance.view") && !caller.permissions.includes("reports.view")) {
    return buildPermissionDeniedPayload(caller, "reports", intent, now);
  }

  const [catRes, srRes, invRes, itemRes, expRes] = await Promise.all([
    adapter.queryTable("services_catalog", { orderBy: { column: "name", ascending: true }, limit: 200 }),
    adapter.queryTable("service_requests", { orderBy: { column: "created_at", ascending: false }, limit: 500 }),
    adapter.queryTable("invoices", { orderBy: { column: "issue_date", ascending: false }, limit: 500 }),
    adapter.queryTable("invoice_items", { limit: 1000 }),
    adapter.queryTable("expenses", { orderBy: { column: "expense_date", ascending: false }, limit: 500 }),
  ]);

  if (invRes.error) return buildErrorOrSchemaPayload(caller, "invoices", intent, "invoices", invRes.error, now);
  if (expRes.error) return buildErrorOrSchemaPayload(caller, "expenses", intent, "expenses", expRes.error, now);

  const analysis = calculateServiceProfitability(
    catRes.data || [],
    srRes.data || [],
    invRes.data || [],
    itemRes.data || [],
    expRes.data || [],
    {}
  );

  const q = intent.normalizedQuery.toLowerCase();
  const isTopProfitableQuery = /\b(highest|top|most)\s+(gross\s+)?profit\b/i.test(q) || /\b(top\s+five|top\s+5)\b/i.test(q);
  const isUnderperformingQuery = /\b(underperforming|losing money|lowest margin|low margin)\b/i.test(q);
  const isRevenueQuery = /\b(highest|top)\s+revenue\b/i.test(q);

  let targetedServices = analysis.services;
  let sectionTitle = "Service Profitability Overview";

  if (isTopProfitableQuery) {
    targetedServices = analysis.topProfitableServices;
    sectionTitle = "Top 5 Most Profitable Corporate Services";
  } else if (isUnderperformingQuery) {
    targetedServices = analysis.lossMakingServices.length > 0 ? analysis.lossMakingServices : analysis.lowMarginServices;
    sectionTitle = "Underperforming & Low-Margin Services";
  } else if (isRevenueQuery) {
    targetedServices = analysis.topRevenueServices;
    sectionTitle = "Top Revenue Generating Services";
  }

  // Check if query asks for a specific service name
  const matchedService = analysis.services.find(
    (s) => q.includes(s.serviceName.toLowerCase()) || (s.slug && q.includes(s.slug.toLowerCase()))
  );
  if (matchedService) {
    targetedServices = [matchedService];
    sectionTitle = `Profitability Analysis for ${matchedService.serviceName}`;
  }

  const markdown = [
    prefix + `### ${sectionTitle}`,
    matchedService
      ? `For **${matchedService.serviceName}**, total recognized revenue is **${formatNgn(matchedService.recognizedServiceRevenue)}** across **${formatCount(matchedService.completedCount)}** completed service(s). Direct operational costs total **${formatNgn(matchedService.totalDirectCosts)}** (${matchedService.costClassification} cost basis), yielding a **Gross Profit of ${formatNgn(matchedService.grossProfit)}** and a **Gross Profit Margin of ${matchedService.grossProfitMarginPercent}%**.`
      : isTopProfitableQuery
      ? `Here are the top-performing services ranked by cumulative gross profit. Combined recognized revenue across all evaluated offerings is **${formatNgn(analysis.totals.totalServiceRevenue)}** with total direct operational disbursements of **${formatNgn(analysis.totals.totalDirectCosts)}**, achieving an overall gross margin of **${analysis.totals.overallGrossMarginPercent}%**.`
      : isUnderperformingQuery
      ? `Identified **${formatCount(targetedServices.length)}** service offering(s) requiring pricing or cost restructuring. Services with margins below 20% or negative net gross profit are highlighted for management review.`
      : `Management summary of ABLEBIZ corporate services: **${formatCount(analysis.totals.totalServicesCompleted)}** completed services generated **${formatNgn(analysis.totals.totalServiceRevenue)}** in recognized net revenue, resulting in **${formatNgn(analysis.totals.totalGrossProfit)}** in gross profit (${analysis.totals.overallGrossMarginPercent}% gross margin).`,
    analysis.totals.dataCompletenessNotice ? `> [!NOTE]\n> ${analysis.totals.dataCompletenessNotice}` : "",
    `#### Recommended Management Action`,
    `- Open the [Service Profitability Workspace](/admin/reports/service-profitability) to inspect underlying invoice snapshots, cost allocations, and period trends.`,
  ].filter(Boolean).join("\n\n");

  return {
    status: analysis.services.length === 0 ? "empty" : "ok",
    intentType: "operational_report",
    moduleId: "reports",
    title: sectionTitle,
    summary: `Total Gross Profit: ${formatNgn(analysis.totals.totalGrossProfit)} (${analysis.totals.overallGrossMarginPercent}% margin).`,
    markdown,
    metrics: [
      { label: "Recognized Revenue", value: formatNgn(analysis.totals.totalServiceRevenue), tone: "blue" },
      { label: "Direct Service Costs", value: formatNgn(analysis.totals.totalDirectCosts), tone: "rose" },
      { label: "Gross Profit", value: formatNgn(analysis.totals.totalGrossProfit), tone: analysis.totals.totalGrossProfit >= 0 ? "emerald" : "rose" },
      { label: "Gross Margin", value: `${analysis.totals.overallGrossMarginPercent}%`, tone: analysis.totals.overallGrossMarginPercent >= 25 ? "emerald" : "amber" },
    ],
    table: {
      caption: sectionTitle,
      headers: ["Service Name", "Completed Jobs", "Recognized Revenue", "Direct Costs", "Gross Profit", "Margin %"],
      rows: targetedServices.slice(0, 10).map((s) => [
        s.serviceName,
        formatCount(s.completedCount),
        formatNgn(s.recognizedServiceRevenue),
        formatNgn(s.totalDirectCosts),
        formatNgn(s.grossProfit),
        `${s.grossProfitMarginPercent}%`,
      ]),
    },
    links: resolveAuthorizedLinks(caller, ["reports", "invoices", "services_catalog"]),
    followUpSuggestions: [
      "Which services have the lowest profit margins?",
      "What is our projected cash balance at the end of this month?",
      "Which clients have annual returns due in the next 30 days?",
    ],
    sourceMeta: {
      tablesQueried: ["services_catalog", "service_requests", "invoices", "invoice_items", "expenses"],
      sourcesLabel: formatFriendlySourceNames(["services_catalog", "invoices", "expenses"]),
      reportingPeriodLabel: "All Evaluated Records",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Service profitability and cost attribution",
    },
  };
}

/**
 * Cash Flow Forecasting & Financial Planning (Phase 7 AI Secretary Query)
 */
async function handleCashFlowForecastAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  if (!caller.permissions.includes("finance.view") && !caller.permissions.includes("reports.view")) {
    return buildPermissionDeniedPayload(caller, "invoices", intent, now);
  }

  const [payRes, expRes, invRes, srRes, catRes, projRes, budRes] = await Promise.all([
    adapter.queryTable("payments", { orderBy: { column: "payment_date", ascending: false }, limit: 500 }),
    adapter.queryTable("expenses", { orderBy: { column: "expense_date", ascending: false }, limit: 500 }),
    adapter.queryTable("invoices", { orderBy: { column: "due_date", ascending: true }, limit: 500 }),
    adapter.queryTable("service_requests", { limit: 500 }),
    adapter.queryTable("services_catalog", { limit: 200 }),
    adapter.queryTable("projected_expenses", { limit: 200 }),
    adapter.queryTable("financial_budgets", { limit: 100 }),
  ]);

  if (invRes.error) return buildErrorOrSchemaPayload(caller, "invoices", intent, "invoices", invRes.error, now);
  if (payRes.error) return buildErrorOrSchemaPayload(caller, "payments", intent, "payments", payRes.error, now);

  const currentCash = calculateCurrentCashPosition(payRes.data || [], expRes.data || [], 0);
  const forecast = generateCashFlowForecast({
    currentCashPosition: currentCash,
    invoices: invRes.data || [],
    serviceRequests: srRes.data || [],
    servicesCatalog: catRes.data || [],
    projectedExpenses: (projRes.data || []) as any,
    scenarioConfig: DEFAULT_SCENARIOS.expected,
    referenceNow: now,
  });

  const q = intent.normalizedQuery.toLowerCase();
  const isBudgetQuery = /\b(budget|budget vs actual|against our monthly budget)\b/i.test(q);
  const isOverdueInvoiceQuery = /\b(overdue invoice|which invoices are overdue)\b/i.test(q);
  const isWeeklyCollectionQuery = /\b(this week|weekly collection|collections are expected this week)\b/i.test(q);
  const isShortageQuery = /\b(cash shortage|shortage in the next 30 days|shortage)\b/i.test(q);
  const isLargestExpensesQuery = /\b(largest projected expense|largest expense)\b/i.test(q);
  const isScenarioQuery = /\b(conservative|optimistic|scenario compare)\b/i.test(q);

  let sectionTitle = "Treasury & Cash Flow Forecast";
  let content = "";

  if (isBudgetQuery) {
    const currentMonthKey = now.toISOString().slice(0, 7);
    const budgetSummary = calculateBudgetVsActual({
      periodKey: currentMonthKey,
      budgets: (budRes.data || []) as any,
      payments: payRes.data || [],
      expenses: expRes.data || [],
    });
    sectionTitle = `Monthly Budget Performance (${currentMonthKey})`;
    content = `For **${currentMonthKey}**, actual verified cash revenue stands at **${formatNgn(budgetSummary.totalActualIncome)}** (against budgeted income of **${formatNgn(budgetSummary.totalBudgetedIncome)}**). Actual operating expenses incurred total **${formatNgn(budgetSummary.totalActualExpense)}** (budgeted limit: **${formatNgn(budgetSummary.totalBudgetedExpense)}**), delivering a **Net Operating Surplus of ${formatNgn(budgetSummary.actualNetSurplus)}** (variance: **${budgetSummary.surplusVariance >= 0 ? "+" : ""}${formatNgn(budgetSummary.surplusVariance)}**).`;
  } else if (isOverdueInvoiceQuery) {
    const overdueList = forecast.expectedCollections.filter((c) => c.isOverdue);
    sectionTitle = "Overdue Invoices Requiring Collection";
    content = overdueList.length === 0
      ? "There are currently no overdue invoices in the ledger. All active receivables are within their agreed credit terms."
      : `Found **${formatCount(overdueList.length)} overdue invoice(s)** with a combined outstanding balance of **${formatNgn(overdueList.reduce((sum, c) => sum + c.balanceDue, 0))}**. Immediate follow-up is recommended to protect operating liquidity.`;
  } else if (isWeeklyCollectionQuery) {
    const week1 = forecast.weeklyBreakdown[0];
    sectionTitle = "Expected Collections for This Week";
    content = `For the current week (${week1?.startDate} to ${week1?.endDate}), expected cash inflows total **${formatNgn(week1?.expectedCollections || 0)}** from active invoice milestones. Scheduled disbursements for the week are **${formatNgn(week1?.projectedExpenses || 0)}**, yielding a projected end-of-week cash balance of **${formatNgn(week1?.projectedClosingBalance || currentCash)}**.`;
  } else if (isShortageQuery) {
    sectionTitle = "Cash Liquidity & Shortage Assessment";
    content = forecast.horizon30Days.hasShortageRisk
      ? `**Attention:** A potential cash reserve deficit is projected in the next 30 days. The closing balance is forecast at **${formatNgn(forecast.horizon30Days.projectedClosingBalance)}** (₦${forecast.horizon30Days.shortageDeficit.toLocaleString()} below safety reserve threshold). Management should expedite high-value collections.`
      : `**Liquidity Healthy:** No cash shortages are anticipated in the next 30 days under baseline assumptions. Current cash position is **${formatNgn(currentCash)}**, and closing cash is projected at **${formatNgn(forecast.horizon30Days.projectedClosingBalance)}** after expected inflows of **${formatNgn(forecast.horizon30Days.expectedCollections)}** and planned expenses of **${formatNgn(forecast.horizon30Days.projectedExpenses)}**.`;
  } else if (isLargestExpensesQuery) {
    sectionTitle = "Largest Projected Operational Expenses";
    const topExp = [...forecast.projectedExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
    content = `Top scheduled operational commitments over the forecast period include: ${topExp.map((e: any) => `**${e.description}** (${formatNgn(e.amount)} due ${e.effectiveDate || e.expected_payment_date})`).join(", ")}.`;
  } else if (isScenarioQuery) {
    sectionTitle = "Cash Flow Scenario Comparison";
    content = `Under the **Expected Baseline**, the projected 30-day closing cash balance is **${formatNgn(forecast.scenarioComparisons.expectedClosingBalance30d)}**. Under the **Conservative Stress-Test Scenario** (assuming lower collection confidence and 14-day payment delays), the 30-day closing cash balance is projected at **${formatNgn(forecast.scenarioComparisons.conservativeClosingBalance30d)}** (90-day: **${formatNgn(forecast.scenarioComparisons.conservativeClosingBalance90d)}**). Under the **Optimistic Scenario**, 30-day closing cash reaches **${formatNgn(forecast.scenarioComparisons.optimisticClosingBalance30d)}**.`;
  } else {
    content = `Current recorded cash position is **${formatNgn(currentCash)}**. At the end of this month (next 30 days), the projected closing cash balance is **${formatNgn(forecast.horizon30Days.projectedClosingBalance)}**, based on expected collections of **${formatNgn(forecast.horizon30Days.expectedCollections)}** from outstanding invoices and scheduled disbursements of **${formatNgn(forecast.horizon30Days.projectedExpenses)}**.`;
  }

  const markdown = [
    prefix + `### ${sectionTitle}`,
    content,
    `#### Recommended Treasury Action`,
    `- View the full breakdown, adjust collection parameters, or record upcoming recurring overhead in [Cash Flow Forecast](/admin/finance/cash-flow-forecast).`,
  ].join("\n\n");

  return {
    status: "ok",
    intentType: "operational_report",
    moduleId: "invoices",
    title: sectionTitle,
    summary: `Current Cash: ${formatNgn(currentCash)} · Projected 30d Closing: ${formatNgn(forecast.horizon30Days.projectedClosingBalance)}`,
    markdown,
    metrics: [
      { label: "Current Cash Position", value: formatNgn(currentCash), tone: "blue" },
      { label: "Expected Collections (30d)", value: formatNgn(forecast.horizon30Days.expectedCollections), tone: "emerald" },
      { label: "Projected Expenses (30d)", value: formatNgn(forecast.horizon30Days.projectedExpenses), tone: "rose" },
      { label: "Projected Closing (30d)", value: formatNgn(forecast.horizon30Days.projectedClosingBalance), tone: forecast.horizon30Days.projectedClosingBalance >= 0 ? "purple" : "rose" },
    ],
    table: {
      caption: "Outstanding Invoice Collections Snapshot",
      headers: ["Invoice #", "Client Name", "Balance Due", "Due Date", "Expected Date", "Status"],
      rows: forecast.expectedCollections.slice(0, 8).map((c) => [
        c.invoiceNumber,
        c.clientName,
        formatNgn(c.balanceDue),
        c.dueDate,
        c.expectedPaymentDate,
        c.isOverdue ? "Overdue" : "On Track",
      ]),
    },
    links: resolveAuthorizedLinks(caller, ["invoices", "payments", "expenses", "reports"]),
    followUpSuggestions: [
      "Are we likely to experience a cash shortage in the next 30 days?",
      "Which five services generated the highest gross profit in the last three months?",
      "Which clients have annual returns due in the next 30 days?",
    ],
    sourceMeta: {
      tablesQueried: ["payments", "expenses", "invoices", "service_requests", "projected_expenses"],
      sourcesLabel: formatFriendlySourceNames(["payments", "invoices", "expenses", "projected_expenses"]),
      reportingPeriodLabel: "Forecast Horizon (30–180 Days)",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Treasury cash flow forecast & scenario planning",
    },
  };
}

/**
 * Annual Compliance & Recurring Service Management (Phase 8 AI Secretary Query)
 */
async function handleComplianceManagementAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [obRes, bizRes, svcRes] = await Promise.all([
    adapter.queryTable("compliance_obligations", { orderBy: { column: "due_date", ascending: true }, limit: 300 }),
    adapter.queryTable("businesses", { limit: 300 }),
    adapter.queryTable("services_catalog", { limit: 100 }),
  ]);

  const obligations = (obRes.data || []) as any[];
  const summary = computeComplianceSummary(obligations, now);

  const q = intent.normalizedQuery.toLowerCase();
  const isDueIn30DaysQuery = /\b(next 30 days|due in 30 days|due soon)\b/i.test(q);
  const isRecurringFollowUpQuery = /\b(recurring|follow[- ]?up|opportunities)\b/i.test(q);
  const isManagementAttentionQuery = /\b(management attention|attention today|most important)\b/i.test(q);

  let sectionTitle = "Corporate Compliance & Annual Returns";
  let content = "";
  let focusObligations = obligations;

  if (isDueIn30DaysQuery) {
    sectionTitle = "Clients with Annual Returns & Compliance Due in 30 Days";
    focusObligations = obligations.filter((o) => {
      if (o.status === "completed" || o.status === "exempt") return false;
      const { daysDiff, isOverdue } = calculateComplianceDeadlineStatus(o.due_date, o.status, now);
      return !isOverdue && daysDiff <= 30;
    });
    content = focusObligations.length === 0
      ? "There are currently no statutory compliance deadlines falling due within the next 30 days."
      : `Found **${formatCount(focusObligations.length)} client compliance obligation(s)** due within the next 30 days. Proactive client communication is recommended to secure filing particulars before statutory penalty windows open.`;
  } else if (isRecurringFollowUpQuery) {
    sectionTitle = "Recurring Compliance Services Requiring Follow-Up";
    focusObligations = obligations.filter((o) => ["identified", "contacted", "interested"].includes(o.opportunity_status));
    content = focusObligations.length === 0
      ? "All identified recurring compliance opportunities have been contacted or converted."
      : `Found **${formatCount(focusObligations.length)} recurring service opportunity(ies)** awaiting client outreach or quotation. Staff should engage these clients to renew annual returns and statutory compliance filings.`;
  } else if (isManagementAttentionQuery) {
    sectionTitle = "Key Matters Requiring Management Attention Today";
    content = [
      `Management oversight summary for **${formatDateTimeLagos(now)}**:`,
      `- **Overdue Statutory Filings:** ${formatCount(summary.overdueCount)} client obligation(s) are past their statutory due date.`,
      `- **Upcoming Deadlines (Next 30 Days):** ${formatCount(summary.dueNext30Days)} filing deadline(s) approaching.`,
      `- **Recurring Service Opportunities:** ${formatCount(summary.recurringOpportunitiesIdentified)} client(s) ready for annual compliance engagement.`,
      summary.requiresVerificationCount > 0
        ? `- **Statutory Rule Verification:** ${formatCount(summary.requiresVerificationCount)} compliance rule(s) marked as needing legal verification.`
        : "- **Statutory Verification:** All active compliance rules verified against current CAMA 2020 guidelines.",
    ].join("\n");
  } else {
    content = `ABLEBIZ is actively monitoring **${formatCount(summary.totalActiveObligations)}** client compliance obligation(s). **${formatCount(summary.dueNext30Days)}** are due within the next 30 days, **${formatCount(summary.overdueCount)}** are overdue, and **${formatCount(summary.recurringOpportunitiesIdentified)}** recurring service opportunities have been identified for client engagement.`;
  }

  const markdown = [
    prefix + `### ${sectionTitle}`,
    content,
    `#### Recommended Action`,
    `- Open [Compliance Calendar](/admin/compliance-calendar) to dispatch client WhatsApp/email reminders or assign operational tasks.`,
  ].join("\n\n");

  return {
    status: obligations.length === 0 ? "empty" : "ok",
    intentType: "operational_report",
    moduleId: "businesses",
    title: sectionTitle,
    summary: `${summary.dueNext30Days} due in 30d · ${summary.overdueCount} overdue · ${summary.recurringOpportunitiesIdentified} opportunities.`,
    markdown,
    metrics: [
      { label: "Due in 30 Days", value: formatCount(summary.dueNext30Days), tone: summary.dueNext30Days > 0 ? "amber" : "emerald" },
      { label: "Due in 60 Days", value: formatCount(summary.dueNext60Days), tone: "blue" },
      { label: "Overdue Filings", value: formatCount(summary.overdueCount), tone: summary.overdueCount > 0 ? "rose" : "emerald" },
      { label: "Recurring Opportunities", value: formatCount(summary.recurringOpportunitiesIdentified), tone: "purple" },
    ],
    table: {
      caption: "Client Compliance Obligations",
      headers: ["Obligation Name", "Due Date", "Deadline Status", "Opportunity Status"],
      rows: focusObligations.slice(0, 10).map((o) => {
        const { statusLabel } = calculateComplianceDeadlineStatus(o.due_date, o.status, now);
        return [
          o.obligation_name,
          o.due_date,
          statusLabel,
          formatReadableLabel(o.opportunity_status, "Identified"),
        ];
      }),
    },
    links: resolveAuthorizedLinks(caller, ["businesses", "service_requests", "tasks"]),
    followUpSuggestions: [
      "Which recurring compliance services require follow-up?",
      "What are the most important financial and compliance matters requiring management attention today?",
      "What is our projected cash balance at the end of this month?",
    ],
    sourceMeta: {
      tablesQueried: ["compliance_obligations", "businesses"],
      sourcesLabel: formatFriendlySourceNames(["compliance_obligations", "businesses"]),
      reportingPeriodLabel: "Dynamic Africa/Lagos Horizon",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Annual compliance, statutory return deadlines, and recurring opportunities",
    },
  };
}

/**
 * Appointment & Consultation Scheduling (Phase 9 AI Secretary Query)
 */
async function handleAppointmentsAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [apptRes, staffRes] = await Promise.all([
    adapter.queryTable("appointments", { orderBy: { column: "appointment_date", ascending: true }, limit: 300 }),
    adapter.queryTable("staff_profiles", { limit: 100 }),
  ]);

  if (apptRes.error) {
    return buildErrorOrSchemaPayload(caller, "appointments", intent, "appointments", apptRes.error, now);
  }

  const allAppointments: any[] = apptRes.data || [];
  const staffList: any[] = staffRes.data || [];
  const todayStr = now.toISOString().slice(0, 10);

  // Scope: if caller is registration_officer or client_service_officer, filter to assigned unless management
  const isMgmt = ["super_admin", "admin", "operations_manager"].includes(caller.role);
  const relevantAppointments = isMgmt
    ? allAppointments
    : allAppointments.filter((a) => a.assigned_staff_id === caller.userId || a.client_contact_email === caller.email);

  const summary = computeAppointmentSummary(relevantAppointments, todayStr);
  const todayAppts = relevantAppointments.filter((a) => a.appointment_date === todayStr && !["cancelled", "completed"].includes(a.status));
  const unconfirmedAppts = relevantAppointments.filter((a) => ["scheduled", "requested"].includes(a.status));

  let summaryMarkdown = `${prefix}Here is the operational summary for **Appointment & Consultation Scheduling** (Africa/Lagos timezone):\n\n`;
  summaryMarkdown += `- **Today's Appointments:** ${summary.todayCount} consultation(s)\n`;
  summaryMarkdown += `- **Upcoming Future Sessions:** ${summary.upcomingCount}\n`;
  summaryMarkdown += `- **Unconfirmed / Awaiting Confirmation:** ${summary.unconfirmedCount}\n`;
  summaryMarkdown += `- **Completed Consultations:** ${summary.completedCount} (${summary.completionRate}% completion rate)\n`;
  summaryMarkdown += `- **Missed / Client Did Not Attend:** ${summary.missedCount}\n\n`;

  if (todayAppts.length > 0) {
    summaryMarkdown += `### Consultations Scheduled for Today (${todayStr}):\n`;
    for (const a of todayAppts.slice(0, 5)) {
      const staffName = staffList.find((s) => s.id === a.assigned_staff_id)?.full_name || "Assigned Officer";
      summaryMarkdown += `• **${a.title}** (${a.start_time?.slice(0, 5)} - ${a.end_time?.slice(0, 5)}) with ${staffName} [Ref: \`${a.reference_code}\`]\n`;
    }
  } else {
    summaryMarkdown += `No further active consultations are scheduled for today.\n`;
  }

  return {
    status: "ok",
    intentType: "operational_report",
    moduleId: "appointments",
    title: "Appointment & Consultation Scheduling",
    summary: `${relevantAppointments.length} consultation(s) tracked in horizon`,
    markdown: summaryMarkdown,
    table: {
      headers: ["Reference", "Title", "Date", "Time", "Status", "Location"],
      rows: relevantAppointments.slice(0, 12).map((a) => [
        a.reference_code || a.id?.slice(0, 8),
        a.title || "Consultation",
        a.appointment_date,
        `${a.start_time?.slice(0, 5)} - ${a.end_time?.slice(0, 5)}`,
        a.status?.replace(/_/g, " "),
        a.meeting_location?.replace(/_/g, " ") || "Office",
      ]),
    },
    links: resolveAuthorizedLinks(caller, ["leads", "clients", "tasks"]),
    followUpSuggestions: [
      "What appointments do I have today?",
      "Which consultations are scheduled this week?",
      "Which appointments have not been confirmed?",
      "Which appointments were missed?",
    ],
    sourceMeta: {
      tablesQueried: ["appointments", "staff_profiles"],
      sourcesLabel: formatFriendlySourceNames(["appointments"]),
      reportingPeriodLabel: "Africa/Lagos Live Horizon",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: isMgmt ? "All corporate consultations" : "Assigned consultations",
    },
  };
}

/**
 * Client Satisfaction & Service Quality Management (Phase 10 AI Secretary Query)
 */
async function handleServiceQualityAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [fbRes, cmpRes] = await Promise.all([
    adapter.queryTable("client_feedback", { orderBy: { column: "created_at", ascending: false }, limit: 300 }),
    adapter.queryTable("client_complaints", { orderBy: { column: "created_at", ascending: false }, limit: 300 }),
  ]);

  if (fbRes.error) {
    return buildErrorOrSchemaPayload(caller, "service_quality", intent, "client_feedback", fbRes.error, now);
  }

  const feedbackList: any[] = fbRes.data || [];
  const complaintsList: any[] = cmpRes.data || [];
  const metrics = computeQualitySummaryMetrics({ feedbackList, complaintsList, satisfactionThreshold: 4, referenceDate: now });

  const isMgmt = ["super_admin", "admin", "operations_manager"].includes(caller.role);

  let summaryMarkdown = `${prefix}Here is the operational overview for **Client Satisfaction & Service Quality**:\n\n`;
  summaryMarkdown += `- **Average Client Satisfaction:** ${metrics.averageSatisfaction} / 5.0 (based on ${metrics.totalFeedbackCount} client ratings)\n`;
  summaryMarkdown += `- **Satisfied Client Percentage:** ${metrics.satisfiedPercentage}% (ratings >= 4 stars)\n`;
  summaryMarkdown += `- **Net Promoter Score (NPS):** ${metrics.npsScore !== null ? `+${metrics.npsScore}` : "N/A"}\n`;
  summaryMarkdown += `- **Active Complaints in Queue:** ${metrics.activeComplaints} ticket(s)\n`;
  summaryMarkdown += `- **Overdue Complaints:** ${metrics.overdueComplaints} ticket(s) exceeding SLA\n`;
  summaryMarkdown += `- **Average Resolution Time:** ${metrics.averageResolutionHours} hours\n\n`;

  if (metrics.overdueComplaints > 0) {
    summaryMarkdown += `⚠️ **Management Notice:** There are ${metrics.overdueComplaints} unresolved complaint tickets that have passed their resolution deadline and require intervention.\n`;
  }

  return {
    status: "ok",
    intentType: "operational_report",
    moduleId: "service_quality",
    title: "Client Satisfaction & Service Quality",
    summary: `CSAT: ${metrics.averageSatisfaction}/5.0 · Active Complaints: ${metrics.activeComplaints}`,
    markdown: summaryMarkdown,
    table: {
      headers: ["Ticket Ref", "Title", "Category", "Priority", "Status", "Target SLA"],
      rows: complaintsList.slice(0, 10).map((c) => [
        c.complaint_number || c.id?.slice(0, 8),
        c.title || "Complaint Ticket",
        c.category?.replace(/_/g, " "),
        c.priority?.toUpperCase(),
        c.status?.replace(/_/g, " "),
        `${c.resolution_target_hours || 72}h`,
      ]),
    },
    links: resolveAuthorizedLinks(caller, ["clients", "tasks", "reports"]),
    followUpSuggestions: [
      "What is our average client satisfaction rating this month?",
      "Which services have the lowest satisfaction scores?",
      "How many complaints remain unresolved?",
      "Which complaints are overdue?",
      "What are the most common client concerns?",
    ],
    sourceMeta: {
      tablesQueried: ["client_feedback", "client_complaints"],
      sourcesLabel: formatFriendlySourceNames(["client_feedback", "client_complaints"]),
      reportingPeriodLabel: "Live Operational Snapshot",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Client satisfaction ratings, complaints queue, and resolution SLAs",
    },
  };
}

/**
 * Staff Performance & Workload Analytics (Phase 11 AI Secretary Query)
 */
async function handleStaffPerformanceAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [tasksRes, srRes, staffRes] = await Promise.all([
    adapter.queryTable("tasks", { limit: 500 }),
    adapter.queryTable("service_requests", { limit: 500 }),
    adapter.queryTable("staff_profiles", { limit: 100 }),
  ]);

  if (tasksRes.error) {
    return buildErrorOrSchemaPayload(caller, "staff_performance", intent, "tasks", tasksRes.error, now);
  }

  const tasksList: any[] = tasksRes.data || [];
  const srList: any[] = srRes.data || [];
  const staffList: any[] = (staffRes.data || []).filter((s: any) => s.is_active !== false);

  const isMgmt = ["super_admin", "admin", "operations_manager"].includes(caller.role);

  // Compute individual performance
  const staffMetrics = staffList.map((s) => {
    return computeStaffIndividualPerformance({
      staffId: s.id,
      staffName: s.full_name,
      role: s.role,
      department: "Operations",
      tasks: tasksList,
      turnarounds: [],
      referenceDate: now,
    });
  });

  const teamSummary = computeTeamPerformanceSummary(staffMetrics);

  let summaryMarkdown = `${prefix}Here is the fair, context-aware operational analysis for **Staff Performance & Workload**:\n\n`;
  summaryMarkdown += `- **Active Tasks Across Team:** ${teamSummary.totalActiveTasks} tasks\n`;
  summaryMarkdown += `- **Overdue Tasks:** ${teamSummary.totalOverdueTasks} tasks\n`;
  summaryMarkdown += `- **Average Internal Task Turnaround:** ${teamSummary.teamAverageTaskTurnaroundDays} days\n`;
  summaryMarkdown += `- **Workload Capacity Balance:** ${teamSummary.balancedStaffCount} officer(s) balanced, ${teamSummary.availableCapacityStaffCount} with available capacity, ${teamSummary.overloadedStaffCount} overloaded (>15 tasks)\n\n`;
  summaryMarkdown += `*Note on Fairness:* Internal processing turnaround reflects time under ABLEBIZ control, excluding paused waiting periods for client documents and external statutory authority (CAC/FIRS) approvals.\n`;

  const visibleRows = isMgmt
    ? staffMetrics.slice(0, 10).map((m) => [
        m.staffName,
        m.role.replace(/_/g, " "),
        `${m.activeTasksCount} tasks`,
        `${m.weightedWorkloadPoints} pts`,
        `${m.overdueTasksCount} overdue`,
        `${m.workloadUtilizationPct}%`,
      ])
    : staffMetrics
        .filter((m) => m.staffId === caller.userId)
        .map((m) => [
          m.staffName,
          m.role.replace(/_/g, " "),
          `${m.activeTasksCount} tasks`,
          `${m.weightedWorkloadPoints} pts`,
          `${m.overdueTasksCount} overdue`,
          `${m.workloadUtilizationPct}%`,
        ]);

  return {
    status: "ok",
    intentType: "operational_report",
    moduleId: "staff_performance",
    title: "Staff Performance & Workload Analytics",
    summary: `Active Tasks: ${teamSummary.totalActiveTasks} · Overdue: ${teamSummary.totalOverdueTasks}`,
    markdown: summaryMarkdown,
    table: {
      headers: ["Officer", "Role", "Active Workload", "Complexity Weight", "Overdue", "Capacity Load"],
      rows: visibleRows,
    },
    links: resolveAuthorizedLinks(caller, ["tasks", "reports", "service_requests"]),
    followUpSuggestions: [
      "What is the current workload distribution across the team?",
      "Which officers have the highest overdue task counts?",
      "Which service categories are causing bottlenecks?",
      "How many CAC applications were processed this month?",
      "What requires management attention today?",
    ],
    sourceMeta: {
      tablesQueried: ["tasks", "service_requests", "staff_profiles"],
      sourcesLabel: formatFriendlySourceNames(["tasks", "service_requests", "staff_profiles"]),
      reportingPeriodLabel: "Live Operational Workload",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: isMgmt ? "Entire team workload distribution" : "Personal workload context",
    },
  };
}
async function handleFinanceOperationalReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  if (!caller.permissions.includes("finance.view")) {
    return buildPermissionDeniedPayload(caller, intent.primaryModule, intent, now);
  }

  const [invRes, payRes, quoteRes, expRes, venRes] = await Promise.all([
    adapter.queryTable("invoices", { orderBy: { column: "created_at", ascending: false }, limit: 500 }),
    adapter.queryTable("payments", { orderBy: { column: "payment_date", ascending: false }, limit: 500 }),
    adapter.queryTable("quotations", { orderBy: { column: "created_at", ascending: false }, limit: 300 }),
    adapter.queryTable("expenses", { orderBy: { column: "expense_date", ascending: false }, limit: 300 }),
    adapter.queryTable("vendors", { limit: 200 }),
  ]);

  if (invRes.error) {
    return buildErrorOrSchemaPayload(caller, "invoices", intent, "invoices", invRes.error, now);
  }
  if (payRes.error) {
    return buildErrorOrSchemaPayload(caller, "payments", intent, "payments", payRes.error, now);
  }

  const filterByRange = (rows: any[], dateField: string) =>
    intent.dateRange.preset === "all_time"
      ? rows
      : rows.filter((r) => isDateInRange(r[dateField] || r.created_at, intent.dateRange));

  const invoices = filterByRange(invRes.data || [], "issued_date");
  const payments = filterByRange(payRes.data || [], "payment_date");
  const quotations = filterByRange(quoteRes.data || [], "created_at");
  const expenses = filterByRange(expRes.data || [], "expense_date");
  const vendors = venRes.data || [];

  const validInvoices = invoices.filter((i: any) => i.status !== "cancelled");
  const totalInvoicedNgn = validInvoices.reduce((sum: number, i: any) => sum + Number(i.total_amount || 0), 0);
  const outstandingInvoices = validInvoices.filter((i: any) =>
    ["unpaid", "partially_paid", "overdue", "sent"].includes(String(i.status || ""))
  );
  const totalOutstandingNgn = outstandingInvoices.reduce(
    (sum: number, i: any) =>
      sum + Math.max(0, Number(i.total_amount || 0) - Number(i.paid_amount || 0)),
    0
  );

  const verifiedPayments = payments.filter((p: any) => p.status === "verified" || p.status === "paid");
  const pendingReconciliationPayments = payments.filter((p: any) => p.status === "pending");
  const totalCollectedNgn = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const pendingReconciliationNgn = pendingReconciliationPayments.reduce(
    (sum: number, p: any) => sum + Number(p.amount || 0),
    0
  );

  const approvedExpenses = expenses.filter((e: any) => e.status === "approved" || e.status === "paid");
  const totalExpensesNgn = approvedExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const netCashflowNgn = totalCollectedNgn - totalExpensesNgn;

  const totalRecordsCount =
    invoices.length + payments.length + quotations.length + expenses.length;
  const status: QueryResultStatus = totalRecordsCount === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Financial & Billing Summary (${intent.dateRange.label})`,
    totalRecordsCount === 0
      ? `No matching invoices, payments, quotations, or expenses were found for **${intent.dateRange.label}**.`
      : `Financial summary for **${intent.dateRange.label}** across Invoices, Payments, Quotations, and Expenses.`,
    `#### Key Figures & Findings`,
    `- **Total Invoiced (${formatCount(validInvoices.length)} active invoices):** ${formatNgn(totalInvoicedNgn)}`,
    `- **Verified Payments Collected (${formatCount(verifiedPayments.length)} receipts):** ${formatNgn(totalCollectedNgn)}`,
    `- **Outstanding Balance Due (${formatCount(outstandingInvoices.length)} unpaid, partial, or overdue invoices):** ${formatNgn(totalOutstandingNgn)}`,
    `- **Payments Pending Verification (${formatCount(pendingReconciliationPayments.length)} receipts):** ${formatNgn(pendingReconciliationNgn)}`,
    `- **Approved & Paid Expenses (${formatCount(approvedExpenses.length)} vouchers):** ${formatNgn(totalExpensesNgn)}`,
    `- **Net Cash Position (Verified Collections minus Approved Expenses):** ${formatNgn(netCashflowNgn)}`,
    `- **Quotations (${formatCount(quotations.length)}) & Active Vendors (${formatCount(vendors.filter((v: any) => v.is_active !== false).length)}):** Available in [Quotations](/admin/quotations) and [Vendors](/admin/vendors).`,
    `#### Recommended Next Action`,
    pendingReconciliationPayments.length > 0
      ? `- Verify the **${formatCount(pendingReconciliationPayments.length)} pending payment receipt(s)** (${formatNgn(pendingReconciliationNgn)}) in [Payments](/admin/payments) and follow up on **${formatCount(outstandingInvoices.length)} outstanding invoice(s)** in [Invoices](/admin/invoices).`
      : `- Review the **${formatCount(outstandingInvoices.length)} outstanding invoice(s)** (${formatNgn(totalOutstandingNgn)}) in [Invoices](/admin/invoices).`,
  ].join("\n\n");

  const showPaymentsTable = intent.primaryModule === "payments";
  const showExpensesTable = intent.primaryModule === "expenses";

  return {
    status,
    intentType: "operational_report",
    moduleId: intent.primaryModule,
    title: `Financial Report (${intent.dateRange.label})`,
    summary: `Collected: ${formatNgn(totalCollectedNgn)} | Outstanding: ${formatNgn(totalOutstandingNgn)} | Expenses: ${formatNgn(totalExpensesNgn)}`,
    markdown,
    metrics: [
      { label: "Verified Collections", value: formatNgn(totalCollectedNgn), tone: "emerald" },
      {
        label: "Outstanding Invoices",
        value: formatNgn(totalOutstandingNgn),
        subtext: `${outstandingInvoices.length} invoice(s)`,
        tone: totalOutstandingNgn > 0 ? "amber" : "slate",
      },
      {
        label: "Pending Verification",
        value: formatCount(pendingReconciliationPayments.length),
        subtext: formatNgn(pendingReconciliationNgn),
        tone: pendingReconciliationPayments.length > 0 ? "rose" : "emerald",
      },
      { label: "Approved Expenses", value: formatNgn(totalExpensesNgn), tone: "blue" },
    ],
    table: showPaymentsTable
      ? payments.length > 0
        ? {
            caption: "Payments & Reconciliation Ledger",
            headers: ["Date", "Reference", "Method", "Amount", "Status"],
            rows: payments.slice(0, 10).map((p: any) => [
              formatShortDate(p.payment_date || p.created_at),
              p.reference_number || "—",
              formatReadableLabel(p.payment_method, "Bank Transfer"),
              formatNgn(Number(p.amount || 0)),
              formatReadableLabel(p.status, "Pending"),
            ]),
          }
        : undefined
      : showExpensesTable
      ? expenses.length > 0
        ? {
            caption: "Expenses Ledger",
            headers: ["Voucher #", "Category", "Description", "Amount", "Status"],
            rows: expenses.slice(0, 10).map((e: any) => [
              e.expense_number || "EXP",
              e.category || "Operations",
              e.description || "—",
              formatNgn(Number(e.amount || 0)),
              formatReadableLabel(e.status, "Pending"),
            ]),
          }
        : undefined
      : outstandingInvoices.length > 0
      ? {
          caption: "Outstanding & Overdue Invoices",
          headers: ["Invoice #", "Status", "Total Amount", "Paid Amount", "Balance Due", "Due Date"],
          rows: outstandingInvoices.slice(0, 10).map((inv: any) => {
            const total = Number(inv.total_amount || 0);
            const paid = Number(inv.paid_amount || 0);
            return [
              inv.invoice_number || "INV",
              formatReadableLabel(inv.status, "Unpaid"),
              formatNgn(total),
              formatNgn(paid),
              formatNgn(Math.max(0, total - paid)),
              formatShortDate(inv.due_date),
            ];
          }),
        }
      : undefined,
    links: resolveAuthorizedLinks(caller, ["invoices", "payments", "quotations", "expenses", "vendors"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, context),
    sourceMeta: {
      tablesQueried: ["invoices", "payments", "quotations", "expenses", "vendors"],
      sourcesLabel: formatFriendlySourceNames(["invoices", "payments", "quotations", "expenses", "vendors"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Finance & billing summary",
    },
  };
}

/**
 * Referrals & Spin & Earn Rewards Operational Report
 */
async function handleReferralsOperationalReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [refRes, rewRes] = await Promise.all([
    adapter.queryTable("referrals", { orderBy: { column: "created_at", ascending: false }, limit: 300 }),
    adapter.queryTable("spin_rewards", { orderBy: { column: "created_at", ascending: false }, limit: 300 }),
  ]);

  if (refRes.error) {
    return buildErrorOrSchemaPayload(caller, "referrals", intent, "referrals", refRes.error, now);
  }

  const referrals =
    intent.dateRange.preset === "all_time"
      ? refRes.data || []
      : (refRes.data || []).filter((r: any) => isDateInRange(r.created_at, intent.dateRange));

  const rewards = rewRes.error ? [] : rewRes.data || [];

  const needsFollowUp = referrals.filter((r: any) =>
    ["pending", "contacted", "qualified"].includes(String(r.status || "pending"))
  );
  const convertedReferrals = referrals.filter((r: any) => String(r.status || "") === "converted");
  const awaitingFulfillment = rewards.filter((rw: any) =>
    ["pending", "approved"].includes(String(rw.status || "pending"))
  );
  const fulfilledRewards = rewards.filter((rw: any) => String(rw.status || "") === "fulfilled");

  const status: QueryResultStatus =
    referrals.length === 0 && rewards.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Referrals & Spin & Earn Report (${intent.dateRange.label})`,
    status === "empty"
      ? `No matching referral or Spin & Earn reward records were found for **${intent.dateRange.label}**.`
      : `Found **${formatCount(referrals.length)}** referral(s) and **${formatCount(rewards.length)}** Spin & Earn reward record(s).`,
    `#### Key Figures & Findings`,
    `- **Referrals Needing Follow-Up (Pending, Contacted, or Qualified):** ${formatCount(needsFollowUp.length)}`,
    `- **Converted Referrals:** ${formatCount(convertedReferrals.length)}`,
    `- **Rewards Awaiting Approval or Fulfillment:** ${formatCount(awaitingFulfillment.length)}`,
    `- **Fulfilled Rewards:** ${formatCount(fulfilledRewards.length)}`,
    `#### Recommended Next Action`,
    `- Open [Referrals & Spin & Earn](/admin/referrals) to contact pending referrals or fulfil approved rewards.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "referrals",
    title: "Referrals & Rewards Pipeline",
    summary: `${needsFollowUp.length} referrals need follow-up; ${awaitingFulfillment.length} rewards awaiting fulfillment.`,
    markdown,
    metrics: [
      { label: "Total Referrals", value: formatCount(referrals.length), tone: "blue" },
      {
        label: "Needs Follow-up",
        value: formatCount(needsFollowUp.length),
        tone: needsFollowUp.length > 0 ? "amber" : "slate",
      },
      { label: "Converted", value: formatCount(convertedReferrals.length), tone: "emerald" },
      {
        label: "Rewards Pending Fulfillment",
        value: formatCount(awaitingFulfillment.length),
        tone: awaitingFulfillment.length > 0 ? "rose" : "emerald",
      },
    ],
    table:
      referrals.length > 0
        ? {
            caption: "Referrals Snapshot",
            headers: ["Referrer", "Referred Prospect", "Service Needed", "Referral Status", "Reward Status"],
            rows: referrals.slice(0, 10).map((r: any) => [
              r.referrer_name || r.referrer_code || "Partner",
              r.referred_name || "Prospect",
              r.service_needed || "General",
              formatReadableLabel(r.status, "Pending"),
              formatReadableLabel(r.reward_status, "Pending"),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["referrals", "leads", "clients"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "referrals", context),
    sourceMeta: {
      tablesQueried: ["referrals", "spin_rewards"],
      sourcesLabel: formatFriendlySourceNames(["referrals", "spin_rewards"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Referral conversion and Spin & Earn fulfillment",
    },
  };
}

/**
 * CRM Leads, Follow-ups, and Client Communications Report
 */
async function handleCrmLeadsAndFollowUpsReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [leadsRes, fuRes, commRes] = await Promise.all([
    adapter.queryTable("leads", { orderBy: { column: "created_at", ascending: false }, limit: 300 }),
    adapter.queryTable("follow_ups", { orderBy: { column: "scheduled_for", ascending: true }, limit: 300 }),
    adapter.queryTable("client_communications", { orderBy: { column: "created_at", ascending: false }, limit: 200 }),
  ]);

  if (leadsRes.error) {
    return buildErrorOrSchemaPayload(caller, intent.primaryModule, intent, "leads", leadsRes.error, now);
  }

  const leads =
    intent.dateRange.preset === "all_time"
      ? leadsRes.data || []
      : (leadsRes.data || []).filter((l: any) => isDateInRange(l.created_at, intent.dateRange));

  const followUps = fuRes.error ? [] : fuRes.data || [];
  const comms = commRes.error ? [] : commRes.data || [];
  const todayIso = now.toISOString();

  const activeLeads = leads.filter((l: any) => !["won", "lost"].includes(String(l.status || "")));
  const wonLeads = leads.filter((l: any) => String(l.status || "") === "won");
  const pendingFollowUps = followUps.filter((f: any) => String(f.status || "") === "pending");
  const overdueFollowUps = pendingFollowUps.filter(
    (f: any) => (f.scheduled_at || f.scheduled_for) && String(f.scheduled_at || f.scheduled_for) < todayIso
  );

  const status: QueryResultStatus =
    leads.length === 0 && followUps.length === 0 && comms.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### CRM Leads, Follow-Ups & Communications (${intent.dateRange.label})`,
    status === "empty"
      ? `No matching leads, follow-ups, or communication logs were found for **${intent.dateRange.label}**.`
      : `Found **${formatCount(leads.length)}** lead(s), **${formatCount(pendingFollowUps.length)}** pending follow-up(s), and **${formatCount(comms.length)}** client communication log(s).`,
    `#### Key Figures & Findings`,
    `- **Active Leads (New, Contacted, Qualified, or Proposal Sent):** ${formatCount(activeLeads.length)}`,
    `- **Converted / Won Leads:** ${formatCount(wonLeads.length)}`,
    `- **Pending Follow-Ups:** ${formatCount(pendingFollowUps.length)} (**${formatCount(overdueFollowUps.length)} overdue**)`,
    `- **Logged Client Communications:** ${formatCount(comms.length)}`,
    `#### Recommended Next Action`,
    `- Open [Leads](/admin/leads) or [Follow-ups](/admin/follow-ups) to complete overdue callbacks and convert qualified leads into clients.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: intent.primaryModule,
    title: "CRM Pipeline & Follow-Ups",
    summary: `${activeLeads.length} active leads, ${overdueFollowUps.length} overdue follow-ups.`,
    markdown,
    metrics: [
      { label: "Active Leads", value: formatCount(activeLeads.length), tone: "blue" },
      { label: "Won Leads", value: formatCount(wonLeads.length), tone: "emerald" },
      {
        label: "Overdue Follow-Ups",
        value: formatCount(overdueFollowUps.length),
        tone: overdueFollowUps.length > 0 ? "rose" : "emerald",
      },
      { label: "Communication Logs", value: formatCount(comms.length), tone: "slate" },
    ],
    table:
      leads.length > 0
        ? {
            caption: "Recent CRM Leads",
            headers: ["Name / Company", "Service Interest", "Source", "Status", "Created"],
            rows: leads.slice(0, 10).map((l: any) => [
              l.full_name || l.company_name || "Prospect",
              l.service_interest || "General Inquiry",
              l.source || "Direct",
              formatReadableLabel(l.status, "New"),
              formatShortDate(l.created_at),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["leads", "follow_ups", "communications", "clients"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, context),
    sourceMeta: {
      tablesQueried: ["leads", "follow_ups", "client_communications"],
      sourcesLabel: formatFriendlySourceNames(["leads", "follow_ups", "client_communications"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "CRM pipeline and follow-up schedule",
    },
  };
}

/**
 * Clients 360 & Businesses Report
 */
async function handleClientsAndBusinessesReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [clientsRes, bizRes] = await Promise.all([
    adapter.queryTable("clients", { orderBy: { column: "created_at", ascending: false }, limit: 400 }),
    adapter.queryTable("businesses", { orderBy: { column: "created_at", ascending: false }, limit: 400 }),
  ]);

  if (clientsRes.error) {
    return buildErrorOrSchemaPayload(caller, "clients", intent, "clients", clientsRes.error, now);
  }
  if (bizRes.error) {
    return buildErrorOrSchemaPayload(caller, "businesses", intent, "businesses", bizRes.error, now);
  }

  const clients =
    intent.dateRange.preset === "all_time"
      ? clientsRes.data || []
      : (clientsRes.data || []).filter((c: any) => isDateInRange(c.created_at, intent.dateRange));
  const businesses =
    intent.dateRange.preset === "all_time"
      ? bizRes.data || []
      : (bizRes.data || []).filter((b: any) => isDateInRange(b.created_at, intent.dateRange));

  const activeClients = clients.filter((c: any) => c.status !== "archived");
  const verifiedKyc = clients.filter((c: any) => c.kyc_status === "verified");
  const dueAnnualReturns = businesses.filter(
    (b: any) => b.annual_return_status === "due" || b.annual_return_status === "overdue"
  );

  const status: QueryResultStatus =
    clients.length === 0 && businesses.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Clients 360° & Registered Businesses (${intent.dateRange.label})`,
    status === "empty"
      ? `No matching client or business records were found for **${intent.dateRange.label}**.`
      : `Found **${formatCount(clients.length)}** client profile(s) and **${formatCount(businesses.length)}** registered business entity record(s).`,
    `#### Key Figures & Findings`,
    `- **Active Clients:** ${formatCount(activeClients.length)} (**${formatCount(verifiedKyc.length)} KYC Verified**)`,
    `- **Registered Business Entities:** ${formatCount(businesses.length)}`,
    `- **Businesses with Annual Returns Due or Overdue:** ${formatCount(dueAnnualReturns.length)}`,
    `#### Recommended Next Action`,
    `- Manage client records in [Clients 360°](/admin/clients) and track RC/BN compliance in [Businesses](/admin/businesses).`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: intent.primaryModule,
    title: "Clients & Businesses Directory",
    summary: `${activeClients.length} active clients, ${businesses.length} registered businesses.`,
    markdown,
    metrics: [
      { label: "Active Clients", value: formatCount(activeClients.length), tone: "blue" },
      { label: "KYC Verified", value: formatCount(verifiedKyc.length), tone: "emerald" },
      { label: "Business Entities", value: formatCount(businesses.length), tone: "slate" },
      {
        label: "Annual Returns Due",
        value: formatCount(dueAnnualReturns.length),
        tone: dueAnnualReturns.length > 0 ? "amber" : "emerald",
      },
    ],
    table:
      clients.length > 0
        ? {
            caption: "Client Directory Snapshot",
            headers: ["Full Name", "Type", "Status", "KYC Status", "Joined"],
            rows: clients.slice(0, 10).map((c: any) => [
              c.full_name || "Client",
              formatReadableLabel(c.client_type, "Individual"),
              formatReadableLabel(c.status, "Active"),
              formatReadableLabel(c.kyc_status, "Pending"),
              formatShortDate(c.created_at),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["clients", "businesses", "service_requests"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, context),
    sourceMeta: {
      tablesQueried: ["clients", "businesses"],
      sourcesLabel: formatFriendlySourceNames(["clients", "businesses"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Client and registered business directory",
    },
  };
}

/**
 * Tasks & SLA Deadlines Operational Report
 */
async function handleTasksOperationalReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const tasksRes = await adapter.queryTable("tasks", {
    orderBy: { column: "due_date", ascending: true },
    limit: 400,
  });

  if (tasksRes.error) {
    return buildErrorOrSchemaPayload(caller, "tasks", intent, "tasks", tasksRes.error, now);
  }

  const allTasks = tasksRes.data || [];
  const todayYmd = now.toISOString().slice(0, 10);

  const isPersonalScope =
    Boolean(caller.profile?.id || caller.userId) &&
    /\b(my|assigned to me|mine|for me)\b/i.test(intent.normalizedQuery);

  const scopeTasks = isPersonalScope
    ? allTasks.filter((t: any) => t.assigned_to === (caller.profile?.id || caller.userId))
    : allTasks;

  const openTasks = scopeTasks.filter(
    (t: any) => !["completed", "cancelled"].includes(String(t.status || ""))
  );
  const overdueTasks = openTasks.filter(
    (t: any) => t.due_date && String(t.due_date).slice(0, 10) < todayYmd
  );
  const urgentTasks = openTasks.filter(
    (t: any) => t.priority === "urgent" || t.priority === "high"
  );
  const blockedTasks = openTasks.filter((t: any) => t.status === "blocked");
  const completedTasks = scopeTasks.filter((t: any) => t.status === "completed");

  const status: QueryResultStatus = scopeTasks.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + (isPersonalScope ? `### My Operational Tasks & Deadlines` : `### Tasks & Deadlines Report`),
    scopeTasks.length === 0
      ? isPersonalScope
        ? `You have no tasks currently assigned to you.`
        : `No matching task records were found.`
      : isPersonalScope
      ? `You have **${formatCount(openTasks.length)} open task(s)** assigned to you (**${formatCount(overdueTasks.length)} overdue**).`
      : `Found **${formatCount(allTasks.length)}** total task(s) (**${formatCount(openTasks.length)} open**, **${formatCount(overdueTasks.length)} overdue**).`,
    `#### Key Figures & Findings`,
    `- **Open Tasks (To Do, In Progress, In Review, or Blocked):** ${formatCount(openTasks.length)}`,
    `- **Overdue Tasks (Due prior to ${todayYmd}):** ${formatCount(overdueTasks.length)}`,
    `- **High / Urgent Priority Open Tasks:** ${formatCount(urgentTasks.length)}`,
    `- **Blocked Tasks:** ${formatCount(blockedTasks.length)}`,
    `- **Completed Tasks:** ${formatCount(completedTasks.length)}`,
    `#### Recommended Next Action`,
    `- Open [Tasks](/admin/tasks) to update progress on overdue items or resolve blocked tasks.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "tasks",
    title: "Tasks & Deadlines Tracker",
    summary: `${openTasks.length} open tasks (${overdueTasks.length} overdue, ${urgentTasks.length} high/urgent).`,
    markdown,
    metrics: [
      { label: "Open Tasks", value: formatCount(openTasks.length), tone: "blue" },
      {
        label: "Overdue",
        value: formatCount(overdueTasks.length),
        tone: overdueTasks.length > 0 ? "rose" : "emerald",
      },
      {
        label: "High / Urgent",
        value: formatCount(urgentTasks.length),
        tone: urgentTasks.length > 0 ? "amber" : "slate",
      },
      { label: "Completed", value: formatCount(completedTasks.length), tone: "emerald" },
    ],
    table:
      openTasks.length > 0
        ? {
            caption: "Open & Overdue Operational Tasks",
            headers: ["Task Title", "Priority", "Status", "Due Date"],
            rows: openTasks.slice(0, 12).map((t: any) => [
              t.title || "Task",
              formatReadableLabel(t.priority, "Medium"),
              formatReadableLabel(t.status, "To Do"),
              formatShortDate(t.due_date),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["tasks", "dashboard", "cac_operations"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "tasks", context),
    sourceMeta: {
      tablesQueried: ["tasks"],
      sourcesLabel: formatFriendlySourceNames(["tasks"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Operational tasks and deadlines",
    },
  };
}

/**
 * Documents Vault Report
 */
async function handleDocumentsReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const docRes = await adapter.queryTable("documents", {
    orderBy: { column: "created_at", ascending: false },
    limit: 300,
  });

  if (docRes.error) {
    return buildErrorOrSchemaPayload(caller, "documents", intent, "documents", docRes.error, now);
  }

  const docs = docRes.data || [];
  const status: QueryResultStatus = docs.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Document Vault Summary`,
    docs.length === 0
      ? `No matching uploaded document records were found in the Document Vault.`
      : `Found **${formatCount(docs.length)}** document record(s) in the Document Vault.`,
    `#### Recommended Next Action`,
    `- Open [Documents](/admin/documents) to filter by document type (Certificate, Status Report, KYC ID, Receipt) or upload new client files.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "documents",
    title: "Document Vault Summary",
    summary: `${docs.length} documents indexed in vault.`,
    markdown,
    metrics: [{ label: "Indexed Documents", value: formatCount(docs.length), tone: "blue" }],
    table:
      docs.length > 0
        ? {
            caption: "Recent Documents",
            headers: ["Title", "Type / Category", "File Name", "Uploaded"],
            rows: docs.slice(0, 10).map((d: any) => [
              d.title || "Document",
              d.doc_type || d.category || "General",
              d.file_name || "—",
              formatShortDate(d.created_at),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["documents", "cac_operations", "clients"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "documents", context),
    sourceMeta: {
      tablesQueried: ["documents"],
      sourcesLabel: formatFriendlySourceNames(["documents"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Document Vault index",
    },
  };
}

/**
 * Staff & RBAC Maker-Checker Report
 */
async function handleStaffAndRbacReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [staffRes, reqRes] = await Promise.all([
    adapter.queryTable("staff_profiles", { orderBy: { column: "full_name", ascending: true }, limit: 200 }),
    adapter.queryTable("staff_change_requests", { orderBy: { column: "created_at", ascending: false }, limit: 200 }),
  ]);

  if (staffRes.error) {
    return buildErrorOrSchemaPayload(caller, "team", intent, "staff_profiles", staffRes.error, now);
  }

  const staff = staffRes.data || [];
  const activeStaff = staff.filter((s: any) => s.is_active !== false);
  const changeRequests = reqRes.error ? [] : reqRes.data || [];
  const pendingApprovals = changeRequests.filter((r: any) => r.status === "pending");

  const status: QueryResultStatus = staff.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Staff Directory & Role Approvals`,
    `Found **${formatCount(staff.length)}** staff profile(s) (**${formatCount(activeStaff.length)} active**) and **${formatCount(pendingApprovals.length)}** pending role or status approval request(s).`,
    `#### Key Figures & Findings`,
    `- **Active Staff Accounts:** ${formatCount(activeStaff.length)}`,
    `- **Pending Staff Role / Status Approvals:** ${formatCount(pendingApprovals.length)}`,
    `- **Approval Rule:** Operations Admin and HR Manager submit role or status change requests; **Super Admin** and **Managing Director** approve or decline them.`,
    `#### Recommended Next Action`,
    `- Open [Staff & RBAC](/admin/team) to review staff assignments or process pending approval requests.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "team",
    title: "Staff & Role Governance",
    summary: `${activeStaff.length} active staff; ${pendingApprovals.length} pending approval requests.`,
    markdown,
    metrics: [
      { label: "Total Staff", value: formatCount(staff.length), tone: "blue" },
      { label: "Active Staff", value: formatCount(activeStaff.length), tone: "emerald" },
      {
        label: "Pending Approvals",
        value: formatCount(pendingApprovals.length),
        tone: pendingApprovals.length > 0 ? "amber" : "slate",
      },
    ],
    table:
      staff.length > 0
        ? {
            caption: "Staff Directory & Assigned Roles",
            headers: ["Full Name", "Role", "Department", "Employment Status", "Active"],
            rows: staff.slice(0, 12).map((s: any) => [
              s.full_name || s.email || "Staff Member",
              formatReadableLabel(s.role, "Staff Observer"),
              s.department || "Operations",
              formatReadableLabel(s.employment_status, "Active"),
              s.is_active !== false ? "Yes" : "No",
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["team", "hr", "audit_logs"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "team", context),
    sourceMeta: {
      tablesQueried: ["staff_profiles", "staff_change_requests"],
      sourcesLabel: formatFriendlySourceNames(["staff_profiles", "staff_change_requests"]),
      reportingPeriodLabel: "Current Directory",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Staff directory and role approval queue",
    },
  };
}

/**
 * Audit Logs & Activity Timeline Report
 */
async function handleAuditLogsReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [auditRes, actRes] = await Promise.all([
    adapter.queryTable("audit_logs", { orderBy: { column: "created_at", ascending: false }, limit: 100 }),
    adapter.queryTable("activity_timeline", { orderBy: { column: "created_at", ascending: false }, limit: 100 }),
  ]);

  if (auditRes.error && actRes.error) {
    return buildErrorOrSchemaPayload(caller, "audit_logs", intent, "audit_logs", auditRes.error, now);
  }

  const audits = auditRes.data || [];
  const activities = actRes.data || [];
  const status: QueryResultStatus = audits.length === 0 && activities.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Security Audit & Activity History`,
    status === "empty"
      ? `No matching security audit or activity timeline events were found.`
      : `Retrieved **${formatCount(audits.length)}** recent security audit event(s) and **${formatCount(activities.length)}** operational activity event(s).`,
    `#### Recommended Next Action`,
    `- Open [Audit Logs](/admin/audit-logs) to filter activity history by staff member, role, or record type.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "audit_logs",
    title: "Security Audit & Activity History",
    summary: `${audits.length} audit events and ${activities.length} timeline events retrieved.`,
    markdown,
    metrics: [
      { label: "Audit Events", value: formatCount(audits.length), tone: "blue" },
      { label: "Activity Events", value: formatCount(activities.length), tone: "slate" },
    ],
    table:
      audits.length > 0
        ? {
            caption: "Recent Security Audit Events",
            headers: ["Timestamp", "Staff Member", "Role", "Action", "Record Type"],
            rows: audits.slice(0, 10).map((a: any) => [
              formatDateTimeLagos(a.created_at),
              a.actor_email || "System",
              formatReadableLabel(a.actor_role, "—"),
              formatReadableLabel(a.action, "Event"),
              formatReadableLabel(a.entity_type, "—"),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["audit_logs", "team", "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "audit_logs", context),
    sourceMeta: {
      tablesQueried: ["audit_logs", "activity_timeline"],
      sourcesLabel: formatFriendlySourceNames(["audit_logs", "activity_timeline"]),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Security audit and activity history",
    },
  };
}

/**
 * Business Profile & Bank Accounts Report
 */
async function handleSettingsAndBankReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const [profRes, bankRes] = await Promise.all([
    adapter.queryTable("business_profile", { limit: 5 }),
    adapter.queryTable("business_bank_accounts", { limit: 50 }),
  ]);

  if (profRes.error && bankRes.error) {
    return buildErrorOrSchemaPayload(caller, "settings", intent, "business_profile", profRes.error, now);
  }

  const profile = (profRes.data || [])[0];
  const banks = bankRes.data || [];
  const activeBanks = banks.filter((b: any) => b.is_active !== false);

  const markdown = [
    prefix + `### Business Profile & Settlement Bank Settings`,
    profile
      ? `Configured company profile for **${profile.company_name || "ABLEBIZ"}** (RC Number: **${profile.rc_number || "N/A"}**, Invoice Prefix: **${profile.invoice_prefix || "INV"}**) with **${formatCount(activeBanks.length)} active settlement bank account(s)**.`
      : `Found **${formatCount(activeBanks.length)}** active settlement bank account(s).`,
    `#### Recommended Next Action`,
    `- Open [Settings](/admin/settings) to update company branding, invoice numbering, or settlement bank account details.`,
  ].join("\n\n");

  return {
    status: !profile && banks.length === 0 ? "empty" : "ok",
    intentType: "operational_report",
    moduleId: "settings",
    title: "Business Profile & Bank Accounts",
    summary: `${activeBanks.length} active bank accounts configured.`,
    markdown,
    metrics: [
      { label: "Company Profile", value: profile?.company_name || "Configured", tone: "blue" },
      { label: "Active Bank Accounts", value: formatCount(activeBanks.length), tone: "emerald" },
    ],
    table:
      banks.length > 0
        ? {
            caption: "Settlement Bank Accounts",
            headers: ["Bank Name", "Account Name", "Account Number", "Primary", "Status"],
            rows: banks.map((b: any) => [
              b.bank_name || "Bank",
              b.account_name || "ABLEBIZ",
              b.account_number || "—",
              b.is_primary ? "Primary" : "Secondary",
              b.is_active !== false ? "Active" : "Inactive",
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["settings", "invoices"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "settings", context),
    sourceMeta: {
      tablesQueried: ["business_profile", "business_bank_accounts"],
      sourcesLabel: formatFriendlySourceNames(["business_profile", "business_bank_accounts"]),
      reportingPeriodLabel: "Current Settings",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Company profile and settlement bank settings",
    },
  };
}

/**
 * Notifications Report
 */
async function handleNotificationsReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const res = await adapter.queryTable("notifications", {
    orderBy: { column: "created_at", ascending: false },
    limit: 100,
  });

  if (res.error) {
    return buildErrorOrSchemaPayload(caller, "notifications", intent, "notifications", res.error, now);
  }

  let rows = res.data || [];
  if (caller.userId) {
    rows = rows.filter((n: any) => !n.user_id || n.user_id === caller.userId);
  }
  const unread = rows.filter((n: any) => !n.is_read);

  return {
    status: rows.length === 0 ? "empty" : "ok",
    intentType: "operational_report",
    moduleId: "notifications",
    title: "System Notifications",
    summary: `${unread.length} unread notifications out of ${rows.length}.`,
    markdown: [
      prefix + `### System Notifications`,
      rows.length === 0
        ? `No matching notifications were found in your inbox.`
        : `You have **${formatCount(unread.length)} unread notification(s)** out of **${formatCount(rows.length)}** recent alerts.`,
      `#### Recommended Next Action`,
      `- Open [Notifications](/admin/notifications) to review and mark alerts as read.`,
    ].join("\n\n"),
    metrics: [
      { label: "Unread Alerts", value: formatCount(unread.length), tone: unread.length > 0 ? "amber" : "emerald" },
      { label: "Total Recent", value: formatCount(rows.length), tone: "blue" },
    ],
    links: resolveAuthorizedLinks(caller, ["notifications", "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "dashboard", context),
    sourceMeta: {
      tablesQueried: ["notifications"],
      sourcesLabel: formatFriendlySourceNames(["notifications"]),
      reportingPeriodLabel: "Current Session",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Notification inbox",
    },
  };
}

/**
 * Management Attention & Cross-Suite Operational Summary
 */
async function handleManagementAttentionReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const hasFinance = caller.permissions.includes("finance.view");
  const hasCrm = caller.permissions.includes("crm.view");
  const hasOps = caller.permissions.includes("operations.view");

  const [tasksRes, cacRes, srRes, leadsRes, fuRes, invRes, staffReqRes, leaveRes] =
    await Promise.all([
      hasOps
        ? adapter.queryTable("tasks", { limit: 300 })
        : Promise.resolve({ data: [], error: null }),
      hasOps
        ? adapter.queryTable("cac_applications", { limit: 300 })
        : Promise.resolve({ data: [], error: null }),
      hasOps
        ? adapter.queryTable("service_requests", { limit: 300 })
        : Promise.resolve({ data: [], error: null }),
      hasCrm
        ? adapter.queryTable("leads", { limit: 300 })
        : Promise.resolve({ data: [], error: null }),
      hasCrm
        ? adapter.queryTable("follow_ups", { limit: 300 })
        : Promise.resolve({ data: [], error: null }),
      hasFinance
        ? adapter.queryTable("invoices", { limit: 300 })
        : Promise.resolve({ data: [], error: null }),
      caller.isManagement
        ? adapter.queryTable("staff_change_requests", { limit: 100 })
        : Promise.resolve({ data: [], error: null }),
      caller.hrAccess.canViewAllLeave
        ? adapter.queryTable("hr_leave_requests", { limit: 200 })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (hasOps && tasksRes.error && cacRes.error) {
    return buildErrorOrSchemaPayload(caller, "dashboard", intent, "tasks", tasksRes.error, now);
  }

  const todayYmd = now.toISOString().slice(0, 10);
  const todayIso = now.toISOString();

  const tasks = tasksRes.data || [];
  const overdueTasks = tasks.filter(
    (t: any) =>
      t.due_date &&
      String(t.due_date).slice(0, 10) < todayYmd &&
      !["completed", "cancelled"].includes(String(t.status || ""))
  );
  const urgentTasks = tasks.filter(
    (t: any) =>
      (t.priority === "urgent" || t.priority === "high") &&
      !["completed", "cancelled"].includes(String(t.status || ""))
  );

  const cac = cacRes.data || [];
  const queriedCac = cac.filter(
    (c: any) => c.stage === "queried" || c.status === "queried"
  );
  const activeCac = cac.filter(
    (c: any) =>
      !["approved", "post_incorporation", "completed", "closed"].includes(String(c.stage || "")) &&
      !["completed", "rejected", "cancelled"].includes(String(c.status || ""))
  );

  const serviceRequests = srRes.data || [];
  const pendingSr = serviceRequests.filter((r: any) =>
    ["pending", "submitted", "in_review", "awaiting_Action", "awaiting_action", "queried"].includes(
      String(r.status || "")
    )
  );

  const leads = leadsRes.data || [];
  const newLeads = leads.filter((l: any) => l.status === "new");

  const followUps = fuRes.data || [];
  const overdueFollowUps = followUps.filter(
    (f: any) => f.status === "pending" && (f.scheduled_at || f.scheduled_for) && String(f.scheduled_at || f.scheduled_for) < todayIso
  );

  const invoices = invRes.data || [];
  const overdueInvoices = invoices.filter(
    (i: any) =>
      i.status === "overdue" ||
      (["unpaid", "partially_paid", "sent"].includes(String(i.status || "")) &&
        i.due_date &&
        String(i.due_date).slice(0, 10) < todayYmd)
  );

  const pendingStaffChanges = (staffReqRes.data || []).filter((r: any) => r.status === "pending");
  const pendingLeaveApprovals = (leaveRes.data || []).filter((l: any) => l.status === "pending");

  const tablesQueried: string[] = [];
  if (hasOps) tablesQueried.push("tasks", "cac_applications", "service_requests");
  if (hasCrm) tablesQueried.push("leads", "follow_ups");
  if (hasFinance) tablesQueried.push("invoices");
  if (caller.isManagement && !staffReqRes.error) tablesQueried.push("staff_change_requests");
  if (caller.hrAccess.canViewAllLeave && !leaveRes.error) tablesQueried.push("hr_leave_requests");

  const bulletPoints: string[] = [];
  if (hasOps) {
    bulletPoints.push(
      `- **Tasks & Deadlines:** **${formatCount(overdueTasks.length)} overdue task(s)** and **${formatCount(urgentTasks.length)} high/urgent task(s)** requiring attention.`
    );
    bulletPoints.push(
      `- **CAC Operations:** **${formatCount(queriedCac.length)} queried filing(s)** and **${formatCount(activeCac.length)} active incorporation(s)** in progress.`
    );
    bulletPoints.push(
      `- **Service Requests:** **${formatCount(pendingSr.length)} request(s)** awaiting review, assignment, or follow-up.`
    );
  }
  if (hasCrm) {
    bulletPoints.push(
      `- **CRM & Follow-Ups:** **${formatCount(overdueFollowUps.length)} overdue follow-up(s)** and **${formatCount(newLeads.length)} new uncontacted lead(s)**.`
    );
  }
  if (hasFinance) {
    bulletPoints.push(
      `- **Finance & Billing:** **${formatCount(overdueInvoices.length)} overdue invoice(s)** awaiting collection.`
    );
  }
  if (caller.isManagement || caller.hrAccess.canViewAllLeave) {
    bulletPoints.push(
      `- **Staff & Leave Approvals:** **${formatCount(pendingLeaveApprovals.length)} pending leave request(s)** and **${formatCount(pendingStaffChanges.length)} pending staff role change request(s)**.`
    );
  }

  const totalActionItems =
    overdueTasks.length +
    queriedCac.length +
    pendingSr.length +
    overdueFollowUps.length +
    overdueInvoices.length +
    pendingLeaveApprovals.length +
    pendingStaffChanges.length;

  const markdown = [
    prefix + `### Executive Operational Summary`,
    totalActionItems === 0
      ? `All workspaces available to **${caller.roleLabel}** were checked as of **${formatDateTimeLagos(now)}**. There are currently **no overdue or critical items** requiring urgent intervention.`
      : `Priority items requiring attention for **${caller.roleLabel}** as of **${formatDateTimeLagos(now)}**:`,
    `#### What Requires Attention`,
    ...bulletPoints,
    `#### Recommended Next Action`,
    queriedCac.length > 0
      ? `- Resolve the **${formatCount(queriedCac.length)} queried CAC application(s)** in [CAC Operations](/admin/cac-operations) and clear the **${formatCount(overdueTasks.length)} overdue task(s)** in [Tasks](/admin/tasks).`
      : `- Review your active work queues in [Manager Workbench](/admin/dashboard) or [Tasks](/admin/tasks).`,
  ].join("\n\n");

  return {
    status: "ok",
    intentType: "operational_report",
    moduleId: intent.primaryModule,
    title: "Operational Attention Summary",
    summary: `${totalActionItems} priority items across your authorized Suite workspaces.`,
    markdown,
    metrics: [
      {
        label: "Overdue Tasks",
        value: formatCount(overdueTasks.length),
        tone: overdueTasks.length > 0 ? "rose" : "emerald",
      },
      {
        label: "Queried CAC Filings",
        value: formatCount(queriedCac.length),
        tone: queriedCac.length > 0 ? "amber" : "emerald",
      },
      {
        label: "Service Requests Waiting",
        value: formatCount(pendingSr.length),
        tone: pendingSr.length > 0 ? "blue" : "slate",
      },
      {
        label: caller.hrAccess.canViewAllLeave ? "Pending Approvals" : "Overdue Follow-Ups",
        value: caller.hrAccess.canViewAllLeave
          ? formatCount(pendingLeaveApprovals.length + pendingStaffChanges.length)
          : formatCount(overdueFollowUps.length),
        tone: "slate",
      },
    ],
    links: resolveAuthorizedLinks(caller, [
      "dashboard",
      "tasks",
      "cac_operations",
      "service_requests",
      "hr",
      "invoices",
    ]).slice(0, 5),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "dashboard", context),
    sourceMeta: {
      tablesQueried,
      sourcesLabel: formatFriendlySourceNames(tablesQueried),
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Operational overview for ${caller.roleLabel}`,
    },
  };
}

/**
 * Phase 12 — Knowledge Base & SOP Grounding Assistant Handler
 */
async function handleKnowledgeBaseAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const q = intent.normalizedQuery.toLowerCase();
  const tablesQueried = ["knowledge_articles"];

  let articles: any[] = [];
  try {
    const { data: dbArticles } = await adapter.queryTable("knowledge_articles");
    if (dbArticles && dbArticles.length > 0) {
      articles = dbArticles;
    } else {
      articles = ILLUSTRATIVE_SOP_GUIDES;
    }
  } catch {
    articles = ILLUSTRATIVE_SOP_GUIDES;
  }

  // Filter accessible articles by caller role
  const accessible = articles.filter((art) =>
    canRoleAccessArticle(art as any, caller.role, caller.userId)
  );

  // Search matching articles by query keywords
  const matching = accessible.filter((art) => {
    const textToMatch = `${art.title} ${art.summary || ""} ${art.tags?.join(" ") || ""} ${art.content || ""}`.toLowerCase();

    if (/\b(company registration|limited liability|part a|ltd)\b/.test(q) && /company registration|private limited/i.test(art.title)) return true;
    if (/\b(ngo|incorporated trustees|church|foundation|part f)\b/.test(q) && /incorporated trustees|ngo/i.test(art.title)) return true;
    if (/\b(complaint|complaints|grievance|escalat)\b/.test(q) && /complaint/i.test(art.title)) return true;
    if (/\b(quotation|quotations|invoicing|pro[- ]?forma)\b/.test(q) && /quotation/i.test(art.title)) return true;
    if (/\b(refund|refunds|adjustment|credit note)\b/.test(q) && /refund/i.test(art.title)) return true;

    const words = q.split(/\s+/).filter((w) => w.length > 3 && !["what", "which", "about", "have", "with", "from", "show", "tell", "process", "procedure", "process"].includes(w));
    return words.some((w) => textToMatch.includes(w));
  });

  if (matching.length === 0) {
    return {
      intentType: intent.intentType,
      moduleId: "knowledge_base",
      status: "ok",
      title: "Knowledge Base Search",
      summary: "No approved procedure found in current documentation.",
      markdown: `${prefix}The ABLEBIZ Knowledge Base does not currently contain an approved article or standard operating procedure answering this query.\n\nTo ensure organizational consistency and regulatory compliance, staff must follow approved documentation. If you would like to draft this procedure for review, you can create a draft article in the [Knowledge Base](/admin/knowledge-base).`,
      links: [
        { label: "Knowledge Base", path: "/admin/knowledge-base", route: "/admin/knowledge-base", moduleId: "knowledge_base", description: "Search and browse internal SOPs." },
      ],
      followUpSuggestions: [
        "What is our process for registering a company?",
        "What documents are required for NGO registration?",
        "What is our procedure for handling client complaints?",
      ],
      sourceMeta: {
        tablesQueried,
        sourcesLabel: "Knowledge Base & SOP Repository",
        reportingPeriodLabel: "All Approved Records",
        timezone: ABILITY_TIMEZONE,
        fetchedAtIso: now.toISOString(),
        fetchedAtFormatted: formatDateTimeLagos(now),
        roleApplied: caller.role,
        scopeDescription: `Knowledge Base access for ${caller.roleLabel}`,
      },
    };
  }

  const primary = matching[0];
  const summarySnippet = primary.summary || primary.content.slice(0, 280);

  const markdown = `${prefix}### ${primary.article_code}: ${primary.title}\n\n` +
    `**Status**: Approved & Published (Version ${primary.current_version || 1}.0)\n` +
    `**Category**: ${primary.category?.name || "Standard Operating Procedures"}\n\n` +
    `> **Approved Summary**:\n> ${summarySnippet}\n\n` +
    `#### Key Operational Steps & Guidance:\n` +
    `${primary.content.slice(0, 800)}...\n\n` +
    `For the complete authorized checklist and statutory requirements, open the full document: [View ${primary.article_code}](/admin/knowledge-base?article=${primary.slug || primary.id}).`;

  return {
    intentType: intent.intentType,
    moduleId: "knowledge_base",
    status: "ok",
    title: `${primary.article_code}: ${primary.title}`,
    summary: `Official procedure from ABLEBIZ Knowledge Base (v${primary.current_version || 1}.0).`,
    markdown,
    metrics: [
      { label: "Document Code", value: primary.article_code, tone: "emerald" },
      { label: "Revision", value: `v${primary.current_version || 1}.0`, tone: "slate" },
      { label: "Matching Guides", value: formatCount(matching.length), tone: "blue" },
    ],
    links: [
      {
        label: `Open ${primary.article_code}`,
        path: `/admin/knowledge-base?article=${primary.slug || primary.id}`,
        route: "/admin/knowledge-base",
        moduleId: "knowledge_base",
        description: primary.title,
      },
      {
        label: "Knowledge Base",
        path: "/admin/knowledge-base",
        route: "/admin/knowledge-base",
        moduleId: "knowledge_base",
        description: "Browse all operational SOPs",
      },
    ],
    followUpSuggestions: [
      "What is our process for registering a company?",
      "What documents are required for NGO registration?",
      "What is our procedure for handling client complaints?",
    ],
    sourceMeta: {
      tablesQueried,
      sourcesLabel: "Knowledge Base & SOP Repository",
      reportingPeriodLabel: "Approved Documents",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Authorized procedure review for ${caller.roleLabel}`,
    },
  };
}

/**
 * Phase 13 — Approval & Decision Management Assistant Handler
 */
async function handleApprovalsAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const tablesQueried = ["approval_requests"];

  let requests: any[] = [];
  try {
    const { data: dbReqs } = await adapter.queryTable("approval_requests");
    if (dbReqs) requests = dbReqs;
  } catch {
    requests = [];
  }

  const pendingApprovals = requests.filter(
    (r) => r.status === "pending_approval" || r.status === "submitted"
  );
  const mySubmissions = requests.filter((r) => r.requested_by === caller.userId);
  const awaitingMyAction = pendingApprovals.filter(
    (r) =>
      r.requested_by !== caller.userId &&
      (caller.role === "super_admin" ||
        caller.role === "admin" ||
        (r.assigned_approver_roles && r.assigned_approver_roles.includes(caller.role)))
  );

  const markdown = `${prefix}### Approval & Decision Overview\n\n` +
    `ABLEBIZ enforces strict **maker-checker governance** across financial, commercial, and operational commitments.\n\n` +
    `- **Pending Approvals System-Wide**: ${pendingApprovals.length} request(s)\n` +
    `- **Awaiting Your Authorization**: ${awaitingMyAction.length} request(s)\n` +
    `- **Submitted by You**: ${mySubmissions.length} request(s)\n\n` +
    (awaitingMyAction.length > 0
      ? `#### High-Priority Items Awaiting Action:\n` +
        awaitingMyAction
          .slice(0, 3)
          .map(
            (r) =>
              `- **${r.reference_number || "REQ"}**: ${r.title} (${r.category}) ${
                r.amount ? `— ₦${Math.round(Number(r.amount)).toLocaleString("en-NG")}` : ""
              }`
          )
          .join("\n") +
        `\n\n`
      : `No approval requests are currently waiting on your decision.\n\n`) +
    `Review decisions and submit new requests in [Approval Management](/admin/approvals).`;

  return {
    intentType: intent.intentType,
    moduleId: "approvals",
    status: "ok",
    title: "Approval & Decision Management",
    summary: `${pendingApprovals.length} pending approval requests across ABLEBIZ Suite.`,
    markdown,
    metrics: [
      {
        label: "Awaiting Your Decision",
        value: formatCount(awaitingMyAction.length),
        tone: awaitingMyAction.length > 0 ? "amber" : "emerald",
      },
      {
        label: "Total Pending",
        value: formatCount(pendingApprovals.length),
        tone: pendingApprovals.length > 0 ? "blue" : "slate",
      },
      {
        label: "Your Submissions",
        value: formatCount(mySubmissions.length),
        tone: "slate",
      },
    ],
    links: [
      {
        label: "Approval Center",
        path: "/admin/approvals",
        route: "/admin/approvals",
        moduleId: "approvals",
        description: "Review and decide pending approval requests.",
      },
    ],
    followUpSuggestions: [
      "What approvals are pending?",
      "Are there any expense requests awaiting my approval?",
      "What are our active approval rules?",
    ],
    sourceMeta: {
      tablesQueried,
      sourcesLabel: "Approval & Decision Engine",
      reportingPeriodLabel: "Active Requests",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Governance view for ${caller.roleLabel}`,
    },
  };
}

/**
 * Phase 14 — Business Intelligence & Executive Dashboard Assistant Handler
 */
async function handleExecutiveDashboardAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const isAuthorized =
    caller.role === "super_admin" ||
    caller.role === "admin" ||
    caller.role === "operations_manager";

  if (!isAuthorized) {
    return {
      intentType: intent.intentType,
      moduleId: "executive_dashboard",
      status: "permission_denied",
      title: "Executive Dashboard Access Restricted",
      summary: "Executive business intelligence is restricted to management roles.",
      markdown: `${prefix}The Executive Dashboard and organizational business intelligence metrics are strictly reserved for Managing Directors, System Administrators, and Operations Managers.\n\nPlease refer to your assigned department workbench or consult an administrator for high-level management reports.`,
      links: [
        { label: "Staff Workbench", path: "/admin/dashboard", route: "/admin/dashboard", moduleId: "dashboard", description: "Return to daily staff workbench." },
      ],
      followUpSuggestions: [
        "What tasks require attention today?",
        "What is the status of my assigned CAC filings?",
      ],
      sourceMeta: {
        tablesQueried: [],
        sourcesLabel: "Executive Management Portal",
        reportingPeriodLabel: intent.dateRange.label,
        timezone: ABILITY_TIMEZONE,
        fetchedAtIso: now.toISOString(),
        fetchedAtFormatted: formatDateTimeLagos(now),
        roleApplied: caller.role,
        scopeDescription: `Restricted access check for ${caller.roleLabel}`,
      },
    };
  }

  const tablesQueried = [
    "invoices",
    "payments",
    "expenses",
    "service_requests",
    "cac_applications",
  ];

  // Query actuals
  let invoices: any[] = [];
  let payments: any[] = [];
  let expenses: any[] = [];
  let serviceRequests: any[] = [];
  let cacFilings: any[] = [];

  try {
    const [invRes, payRes, expRes, srRes, cacRes] = await Promise.all([
      adapter.queryTable("invoices"),
      adapter.queryTable("payments"),
      adapter.queryTable("expenses"),
      adapter.queryTable("service_requests"),
      adapter.queryTable("cac_applications"),
    ]);
    if (invRes.data) invoices = invRes.data;
    if (payRes.data) payments = payRes.data;
    if (expRes.data) expenses = expRes.data;
    if (srRes.data) serviceRequests = srRes.data;
    if (cacRes.data) cacFilings = cacRes.data;
  } catch {
    // safe fallback
  }

  // Calculate actuals
  const canViewFinance = caller.role === "super_admin" || caller.role === "admin";
  const verifiedPayments = payments.filter((p) => p.status === "verified" || p.status === "paid");
  const totalCashCollected = verifiedPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const netCashProfit = totalCashCollected - totalExpenses;

  // Unpaid invoices (A/R)
  const unpaidInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const outstandingAr = unpaidInvoices.reduce((acc, i) => {
    const bal = i.balance_due !== undefined ? Number(i.balance_due) : Number(i.total_amount || 0) - Number(i.amount_paid || 0);
    return acc + Math.max(0, bal);
  }, 0);

  const activeCac = cacFilings.filter((c) => c.status === "submitted" || c.status === "in_progress" || c.status === "query");
  const overdueRequests = serviceRequests.filter((r) => {
    if (r.status === "completed" || r.status === "cancelled") return false;
    return r.target_completion_date && new Date(r.target_completion_date) < now;
  });

  const markdown = `${prefix}### ABLEBIZ Executive Performance Summary\n\n` +
    `Reporting Period: **${intent.dateRange.label}** (Africa/Lagos)\n\n` +
    (canViewFinance
      ? `#### Financial Health (Verified Actuals):\n` +
        `- **Verified Cash Collected**: ₦${Math.round(totalCashCollected).toLocaleString("en-NG")}\n` +
        `- **Approved Expenses**: ₦${Math.round(totalExpenses).toLocaleString("en-NG")}\n` +
        `- **Net Cash Profit**: ₦${Math.round(netCashProfit).toLocaleString("en-NG")} *(excl. forecasts)*\n` +
        `- **Outstanding Receivables (A/R)**: ₦${Math.round(outstandingAr).toLocaleString("en-NG")}\n\n`
      : `*Detailed financial cash figures are restricted to Executive Management and Finance Officers.*\n\n`) +
    `#### Operational Throughput & Registry Pipeline:\n` +
    `- **Active CAC Filings In-Flight**: ${activeCac.length} application(s)\n` +
    `- **Overdue Client Deliverables**: ${overdueRequests.length} file(s)\n` +
    `- **Active Service Engagements**: ${serviceRequests.filter((r) => r.status === "in_progress" || r.status === "pending").length} engagement(s)\n\n` +
    `For interactive drill-downs and period comparisons, visit the [Executive Dashboard](/admin/executive-dashboard).`;

  return {
    intentType: intent.intentType,
    moduleId: "executive_dashboard",
    status: "ok",
    title: "Executive Business Intelligence Overview",
    summary: `Verified business health metrics for ${intent.dateRange.label}.`,
    markdown,
    metrics: [
      ...(canViewFinance
        ? [
            {
              label: "Net Cash Profit",
              value: formatNgn(netCashProfit),
              tone: netCashProfit >= 0 ? ("emerald" as const) : ("rose" as const),
            },
            {
              label: "Outstanding A/R",
              value: formatNgn(outstandingAr),
              tone: outstandingAr > 100000 ? ("amber" as const) : ("slate" as const),
            },
          ]
        : []),
      {
        label: "Active CAC Filings",
        value: formatCount(activeCac.length),
        tone: "blue",
      },
      {
        label: "Overdue Work",
        value: formatCount(overdueRequests.length),
        tone: overdueRequests.length > 0 ? "rose" : "emerald",
      },
    ],
    links: [
      {
        label: "Executive Dashboard",
        path: "/admin/executive-dashboard",
        route: "/admin/executive-dashboard",
        moduleId: "reports",
        description: "Full interactive KPI cards and trend charts.",
      },
      {
        label: "Executive Reports Catalogue",
        path: "/admin/reports",
        route: "/admin/reports",
        moduleId: "reports",
        description: "Detailed category reports and exports.",
      },
    ],
    followUpSuggestions: [
      "What is our current outstanding receivables balance?",
      "Which services generated the most revenue this quarter?",
      "How many service requests are overdue?",
      "What are our major operational bottlenecks?",
    ],
    sourceMeta: {
      tablesQueried,
      sourcesLabel: "Executive Management & Operations Data",
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Consolidated business intelligence for ${caller.roleLabel}`,
    },
  };
}

/**
 * Phase 16: Backup, Recovery & Business Continuity Report
 */
async function handleBackupContinuityAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const isAuthorized =
    caller.role === "super_admin" ||
    caller.role === "admin" ||
    caller.role === "operations_manager";

  if (!isAuthorized) {
    return {
      status: "permission_denied",
      intentType: intent.intentType,
      moduleId: "settings",
      title: "Data Backup & Recovery Access Restricted",
      summary: "Access to disaster recovery logs is restricted to System Administrators.",
      markdown: `${prefix}Detailed disaster recovery configurations, cryptographic snapshot checksums, and physical restore drill records are restricted to Super Administrators, Administrators, and Operations Managers to preserve infrastructure security.`,
      metrics: [
        { label: "Your Role", value: caller.roleLabel, tone: "slate" },
        { label: "Access Status", value: "Restricted", tone: "amber" },
      ],
      links: resolveAuthorizedLinks(caller, ["dashboard"]),
      followUpSuggestions: ["What requires attention today?"],
      sourceMeta: {
        tablesQueried: [],
        sourcesLabel: "Business Continuity Infrastructure",
        reportingPeriodLabel: "Active Policy",
        timezone: ABILITY_TIMEZONE,
        fetchedAtIso: now.toISOString(),
        fetchedAtFormatted: formatDateTimeLagos(now),
        roleApplied: caller.role,
        scopeDescription: "Disaster recovery policy check",
      },
    };
  }

  const [records, drills, settings] = await Promise.all([
    fetchBackupRecords(),
    fetchRestoreDrills(),
    fetchBusinessContinuitySettings(),
  ]);

  const latestBackup = records.length > 0 ? records[0] : null;
  const latestDrill = drills.length > 0 ? drills[0] : null;

  const markdown = [
    prefix + `### Enterprise Backup & Business Continuity Status`,
    `ABLEBIZ operational and financial data is protected by automated multi-region snapshots and point-in-time recovery (PITR).`,
    `#### Backup Health & Verification:`,
    latestBackup
      ? `- **Latest Snapshot Reference**: \`${latestBackup.backup_reference}\` (${latestBackup.backup_type})\n` +
        `- **Status**: ${latestBackup.status === "verified" || latestBackup.status === "completed" ? "✅ Verified" : "⚠️ " + latestBackup.status}\n` +
        `- **Recorded At**: ${new Date(latestBackup.created_at).toLocaleString("en-GB")}\n` +
        `- **Storage Coverage**: ${settings.storage_coverage.join(", ")}`
      : `- **Automated Primary Schedule**: ${settings.primary_backup_schedule}\n- **Latest Snapshot**: Initializing automated schedule verification.`,
    `#### Restore Drills & Recovery Targets:`,
    `- **Target Recovery Point Objective (RPO)**: ${settings.target_rpo_hours} hours\n` +
    `- **Target Recovery Time Objective (RTO)**: ${settings.target_rto_hours} hours\n` +
    (latestDrill
      ? `- **Last Validated Drill**: \`${latestDrill.drill_code}\` conducted on ${latestDrill.drill_date} (${latestDrill.overall_outcome})\n` +
        `- **Achieved RTO**: ${latestDrill.rto_minutes_achieved} mins | **Achieved RPO**: ${latestDrill.rpo_hours_achieved} hrs\n` +
        `- **Target Environment**: ${latestDrill.isolated_environment_name} (never restored directly into production)`
      : `- **Restore Drills**: Scheduled quarterly into isolated test environments.`),
    `For disaster recovery playbooks and drill logs, visit the [Backup & Recovery Workspace](/admin/backup-recovery).`,
  ].join("\n\n");

  return {
    status: "ok",
    intentType: intent.intentType,
    moduleId: "settings",
    title: "Backup & Business Continuity Health",
    summary: latestBackup ? `Latest backup ${latestBackup.backup_reference} (${latestBackup.status})` : "Automated daily snapshot active.",
    markdown,
    metrics: [
      {
        label: "Last Snapshot",
        value: latestBackup ? latestBackup.status.toUpperCase() : "SCHEDULED",
        tone: latestBackup?.status === "failed" ? "rose" : "emerald",
      },
      {
        label: "Target RPO",
        value: `${settings.target_rpo_hours}h`,
        tone: "blue",
      },
      {
        label: "Target RTO",
        value: `${settings.target_rto_hours}h`,
        tone: "blue",
      },
      {
        label: "Restore Drills",
        value: formatCount(drills.length),
        tone: drills.length > 0 ? "emerald" : "amber",
      },
    ],
    links: [
      {
        label: "Backup & Continuity Center",
        path: "/admin/backup-recovery",
        route: "/admin/backup-recovery",
        moduleId: "settings",
        description: "View verified snapshot logs and record restore drills.",
      },
    ],
    followUpSuggestions: [
      "When was the last restore test performed?",
      "What is our approved RPO and RTO?",
      "What notifications require my attention?",
    ],
    sourceMeta: {
      tablesQueried: ["backup_records", "restore_drills", "business_continuity_settings"],
      sourcesLabel: "Business Continuity & DR Ledger",
      reportingPeriodLabel: "Active Infrastructure State",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Disaster recovery and backup health",
    },
  };
}

/**
 * Phase 18: Marketing Campaign & Lead Attribution Analytics Report
 */
async function handleMarketingAttributionAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const isAuthorized =
    caller.role === "super_admin" ||
    caller.role === "admin" ||
    caller.role === "marketing_officer" ||
    caller.role === "operations_manager";

  if (!isAuthorized) {
    return {
      status: "permission_denied",
      intentType: intent.intentType,
      moduleId: "reports",
      title: "Marketing Attribution Analytics Restricted",
      summary: "Campaign spend and lead attribution metrics are restricted to Marketing and Executive roles.",
      markdown: `${prefix}Marketing budget spend, ad spend attribution, and customer acquisition cost (CAC) metrics are restricted to authorized marketing and management personnel.`,
      metrics: [
        { label: "Your Role", value: caller.roleLabel, tone: "slate" },
        { label: "Access Status", value: "Restricted", tone: "amber" },
      ],
      links: resolveAuthorizedLinks(caller, ["dashboard", "leads"]),
      followUpSuggestions: ["What requires attention today?"],
      sourceMeta: {
        tablesQueried: [],
        sourcesLabel: "Marketing Attribution Engine",
        reportingPeriodLabel: "Active Session",
        timezone: ABILITY_TIMEZONE,
        fetchedAtIso: now.toISOString(),
        fetchedAtFormatted: formatDateTimeLagos(now),
        roleApplied: caller.role,
        scopeDescription: "Marketing permissions check",
      },
    };
  }

  const { summary, campaigns, channels } = await fetchMarketingAttributionData();

  const topChannel = channels.length > 0 ? channels[0] : null;
  const topCampaign = campaigns.length > 0 ? campaigns[0] : null;

  const markdown = [
    prefix + `### Marketing Attribution & Lead Conversion Analytics`,
    `Attribution overview for marketing campaigns, digital acquisition channels, and referral partner conversions:`,
    `#### Performance Summary:`,
    `- **Total Leads Tracked**: ${formatCount(summary.total_leads)} prospect(s)\n` +
    `- **Verified Converted Clients**: ${formatCount(summary.converted_clients)} client(s) (${summary.lead_conversion_rate}% conversion rate)\n` +
    `- **Verified Cash Collected**: ${formatNgn(summary.verified_cash_attributed)}\n` +
    `- **Total Marketing Investment**: ${formatNgn(summary.total_campaign_spend)}\n` +
    `- **Cost Per Lead (CPL)**: ${summary.cost_per_lead !== null ? formatNgn(summary.cost_per_lead) : "₦0 (Organic / Free)"}\n` +
    `- **Customer Acquisition Cost (CAC)**: ${summary.cost_per_acquired_client !== null ? formatNgn(summary.cost_per_acquired_client) : "₦0 (Organic / Free)"}\n` +
    `- **Cash ROI**: ${summary.campaign_roi_cash_percent !== null ? `${summary.campaign_roi_cash_percent}%` : "N/A (Zero Direct Spend)"}`,
    topChannel
      ? `#### Top Acquisition Channel:\n- **${topChannel.channel_name}**: ${formatCount(topChannel.leads_count)} leads, ${formatCount(topChannel.converted_clients_count)} clients (${topChannel.conversion_rate}% conversion)`
      : "",
    topCampaign
      ? `#### Top Performing Campaign:\n- **${topCampaign.campaign_name}** (${topCampaign.campaign_type}): ${formatCount(topCampaign.leads_count)} leads, ${formatNgn(topCampaign.verified_cash_collected)} collected cash`
      : "",
    `For interactive attribution charts and partner attribution, visit the [Marketing Attribution Workspace](/admin/reports/marketing-attribution).`,
  ].filter(Boolean).join("\n\n");

  return {
    status: "ok",
    intentType: intent.intentType,
    moduleId: "reports",
    title: "Marketing Campaign & Lead Attribution",
    summary: `${summary.total_leads} leads, ${summary.converted_clients} conversions, ${formatNgn(summary.verified_cash_attributed)} cash collected.`,
    markdown,
    metrics: [
      { label: "Total Leads", value: formatCount(summary.total_leads), tone: "blue" },
      { label: "Conversions", value: formatCount(summary.converted_clients), tone: "emerald" },
      { label: "Attributed Cash", value: formatNgn(summary.verified_cash_attributed), tone: "emerald" },
      {
        label: "Blended CAC",
        value: summary.cost_per_acquired_client !== null ? formatNgn(summary.cost_per_acquired_client) : "₦0 (Free)",
        tone: (summary.cost_per_acquired_client || 0) > 15000 ? "amber" : "slate",
      },
    ],
    links: [
      {
        label: "Marketing Attribution Analytics",
        path: "/admin/reports/marketing-attribution",
        route: "/admin/reports/marketing-attribution",
        moduleId: "reports",
        description: "Full attribution funnel, channel breakdown, and referral partner ROI.",
      },
      {
        label: "Campaigns & Promotions",
        path: "/admin/campaigns",
        route: "/admin/campaigns",
        moduleId: "leads",
        description: "Manage campaigns, UTM tracking, and spend budgets.",
      },
    ],
    followUpSuggestions: [
      "Which campaigns generated the most verified cash collections?",
      "What is our cost per lead?",
      "What are our top lead acquisition channels?",
    ],
    sourceMeta: {
      tablesQueried: ["campaigns", "leads", "clients", "invoices", "payments", "referrals"],
      sourcesLabel: "Marketing Attribution Engine",
      reportingPeriodLabel: "Trailing 90 Days",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Attribution and acquisition cost metrics",
    },
  };
}

/**
 * Phase 19: Receipt-Linked Expense Allocation & Profitability Report
 */
async function handleReceiptProfitabilityAssistantReport(
  intent: ClassifiedIntent,
  caller: AssistantCallerContext,
  adapter: AssistantDataAdapter,
  now: Date,
  prefix: string,
  context: ConversationContext
): Promise<AssistantResponsePayload> {
  const isAuthorized =
    caller.role === "super_admin" ||
    caller.role === "admin" ||
    caller.role === "accounts_officer";

  if (!isAuthorized) {
    return {
      status: "permission_denied",
      intentType: intent.intentType,
      moduleId: "expenses",
      title: "Receipt Profitability Access Restricted",
      summary: "Receipt-linked direct cost allocations and net margin figures are restricted to Accounts Officers and Administrators.",
      markdown: `${prefix}Direct service cost allocations, statutory disbursement offsets, and receipt-level net contribution figures are restricted to authorized finance personnel to protect sensitive margin data.`,
      metrics: [
        { label: "Your Role", value: caller.roleLabel, tone: "slate" },
        { label: "Access Status", value: "Restricted", tone: "amber" },
      ],
      links: resolveAuthorizedLinks(caller, ["dashboard"]),
      followUpSuggestions: ["What requires attention today?"],
      sourceMeta: {
        tablesQueried: [],
        sourcesLabel: "Financial Profitability Ledger",
        reportingPeriodLabel: "Active Session",
        timezone: ABILITY_TIMEZONE,
        fetchedAtIso: now.toISOString(),
        fetchedAtFormatted: formatDateTimeLagos(now),
        roleApplied: caller.role,
        scopeDescription: "Finance permissions check",
      },
    };
  }

  const records = await fetchReceiptProfitabilityReport();

  const totalReceipts = records.length;
  const totalRevenue = records.reduce((s, r) => s + r.verified_receipt_amount, 0);
  const totalAllocated = records.reduce((s, r) => s + r.total_allocated_expenses, 0);
  const totalContribution = totalRevenue - totalAllocated;
  const overallMargin = totalRevenue > 0 ? Math.round((totalContribution / totalRevenue) * 1000) / 10 : 0;

  const profitableCount = records.filter((r) => r.profitability_status === "profitable").length;
  const breakEvenCount = records.filter((r) => r.profitability_status === "break_even").length;
  const lossMakingCount = records.filter((r) => r.profitability_status === "loss_making").length;

  const markdown = [
    prefix + `### Receipt-Linked Expense Allocations & Net Contribution`,
    `Receipt-level profitability accounts for direct operational disbursements (e.g. CAC official fees, courier logistics, stamp duties) against verified client payments.`,
    `#### Financial Summary:`,
    `- **Verified Receipts Evaluated**: ${formatCount(totalReceipts)} payment receipt(s)\n` +
    `- **Total Cash Revenue**: ${formatNgn(totalRevenue)}\n` +
    `- **Allocated Direct Service Costs**: ${formatNgn(totalAllocated)}\n` +
    `- **Net Direct Contribution**: ${formatNgn(totalContribution)} (${overallMargin}% gross contribution margin)`,
    `#### Profitability Health Distribution:`,
    `- **Profitable & Healthy**: ${formatCount(profitableCount)} receipt(s)\n` +
    `- **Break-Even / Neutral**: ${formatCount(breakEvenCount)} receipt(s)\n` +
    `- **Loss-Making (Costs exceed payment)**: ${formatCount(lossMakingCount)} receipt(s)`,
    lossMakingCount > 0
      ? `> ⚠️ **Attention Required**: ${lossMakingCount} client receipt(s) currently show negative net contribution where allocated disbursements exceeded client payment. Review associated service fees to ensure proper commercial pricing.`
      : `All analyzed client receipts are operating at positive gross contribution margins.`,
    `For full receipt drill-downs and audit logs, visit the [Receipt Profitability Ledger](/admin/finance/receipt-profitability).`,
  ].join("\n\n");

  return {
    status: "ok",
    intentType: intent.intentType,
    moduleId: "expenses",
    title: "Receipt Profitability & Cost Allocations",
    summary: `${formatCount(totalReceipts)} receipts evaluated. Net contribution: ${formatNgn(totalContribution)} (${overallMargin}% margin).`,
    markdown,
    metrics: [
      { label: "Cash Collected", value: formatNgn(totalRevenue), tone: "emerald" },
      { label: "Direct Costs", value: formatNgn(totalAllocated), tone: "blue" },
      { label: "Net Contribution", value: formatNgn(totalContribution), tone: totalContribution >= 0 ? "emerald" : "rose" },
      { label: "Contribution Margin", value: `${overallMargin}%`, tone: overallMargin >= 50 ? "emerald" : "amber" },
    ],
    links: [
      {
        label: "Receipt Profitability",
        path: "/admin/finance/receipt-profitability",
        route: "/admin/finance/receipt-profitability",
        moduleId: "expenses",
        description: "View net contribution and direct costs per client receipt.",
      },
      {
        label: "Expense Allocations Ledger",
        path: "/admin/finance/expense-allocations",
        route: "/admin/finance/expense-allocations",
        moduleId: "expenses",
        description: "Complete ledger of disbursements linked to receipts.",
      },
    ],
    followUpSuggestions: [
      "What is the profitability of this receipt?",
      "How much of this expense has been allocated?",
      "Which expenses remain unallocated?",
    ],
    sourceMeta: {
      tablesQueried: ["payments", "expenses", "expense_receipt_allocations", "invoices"],
      sourcesLabel: "Receipt Profitability Ledger",
      reportingPeriodLabel: "All Verified Receipts",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Direct cost allocation and margin tracking",
    },
  };
}
