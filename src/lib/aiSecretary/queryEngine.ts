import { supabase } from "../supabaseClient";
import {
  AssistantCallerContext,
  AssistantResponsePayload,
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
} from "./dateUtils";
import {
  CAPABILITY_CATALOGUE,
  CAPABILITY_CATALOGUE_VERSION,
  canCallerAccessModule,
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
          error: { code: (error as any).code, message: error.message || "Database query failed" },
        };
      }
      return { data: (data as T[]) || [], error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || "Unexpected network or database error" },
      };
    }
  },
};

function buildSpoofAndMutationPrefix(intent: ClassifiedIntent, caller: AssistantCallerContext): string {
  const notices: string[] = [];
  if (intent.isRoleSpoofingAttempt) {
    notices.push(
      `> **Security & Role Verification Notice:** Your authenticated session role is **${caller.roleLabel}** (\`${caller.role}\`). Role overrides or permission bypass instructions in chat text are ignored. All responses and queries strictly follow your verified session permissions.`
    );
  }
  if (intent.isWriteMutationAttempt) {
    notices.push(
      `> **Read-Only Assistant Boundary:** ABLEBIZ AI Secretary does not execute direct database mutations (create, approve, reject, or delete records) on your behalf. Below is the verified status and step-by-step guidance so you can perform the action safely in the authorized workspace.`
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

  const markdown = [
    prefix + `### Access Restricted — ${spec.displayName}`,
    `Your current role (**${caller.roleLabel}**, \`${caller.role}\`) does not include permission to access **${spec.displayName}** (\`${spec.route}\`).`,
    `#### Required Authorization`,
    `- **Required Permission(s):** ${spec.requiredPermissions.length > 0 ? spec.requiredPermissions.map((p) => `\`${p}\``).join(", ") : "Role-scoped access"}`,
    `- **Authorized Roles:** ${spec.allowedRolesSummary}`,
    `- **Your Current Permissions:** ${caller.permissions.map((p) => `\`${p}\``).join(", ")}`,
    `#### Recommended Next Step`,
    `If you need information from **${spec.displayName}**, request assistance from an authorized officer or contact **Super Admin / Managing Director / Operations Admin** if your role assignment in [Staff & RBAC](/admin/team) needs adjustment.`,
  ].join("\n\n");

  return {
    status: "permission_denied",
    intentType: intent.intentType,
    moduleId,
    title: `Access Restricted: ${spec.displayName}`,
    summary: `Role ${caller.roleLabel} is not authorized to view ${spec.displayName}.`,
    markdown,
    metrics: [
      { label: "Your Role", value: caller.roleLabel, tone: "amber" },
      { label: "Target Module", value: spec.displayName, tone: "slate" },
      { label: "Access Status", value: "Restricted", tone: "rose" },
    ],
    links: authorizedFallbackLinks,
    followUpSuggestions: getContextualFollowUpQuestions(caller, "dashboard"),
    sourceMeta: {
      tablesQueried: [],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Blocked by RBAC check prior to querying ${spec.tables.join(", ")}`,
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
  const status: QueryResultStatus = isRls
    ? "permission_denied"
    : isSchema
    ? "schema_pending"
    : "query_error";

  const title = isRls
    ? `Database Access Restricted (${tableName})`
    : isSchema
    ? `Database Schema Pending Migration (${tableName})`
    : `Query Failed (${tableName})`;

  const markdown = isSchema
    ? [
        `### ${title}`,
        `The assistant attempted to query \`${tableName}\` for **${spec.displayName}**, but the table is not yet present in the active Supabase schema cache.`,
        `#### Why This Happened`,
        `- **Diagnostic Details:** \`${error.message}\``,
        `- This is **not** reported as zero records because the underlying table has not been provisioned yet.`,
        `#### Recommended Next Step`,
        `- Apply the corresponding migration script in \`implementation/\` (for example \`implementation/MIGRATION_HR_WORKSPACE.sql\` for HR tables or \`implementation/FULL_SYSTEM_INSTALL.sql\` for core tables) in the Supabase SQL Editor, then click **Retry**.`,
      ].join("\n\n")
    : [
        `### ${title}`,
        `The assistant could not verify records from \`${tableName}\` due to a database query error. To preserve data accuracy, failed queries are never reported as \`0\` records.`,
        `#### Diagnostic Details`,
        `- **Table:** \`${tableName}\``,
        `- **Reason:** \`${error.message}\``,
        `#### Recommended Next Step`,
        `- Verify your network connection and session status, or open [${spec.displayName}](${spec.route}) directly and click **Retry**.`,
      ].join("\n\n");

  return {
    status,
    intentType: intent.intentType,
    moduleId,
    title,
    summary: error.message,
    markdown,
    metrics: [
      { label: "Module", value: spec.displayName, tone: "slate" },
      { label: "Verification Status", value: isSchema ? "Migration Pending" : "Query Error", tone: "rose" },
    ],
    links: resolveAuthorizedLinks(caller, [moduleId, "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, moduleId),
    sourceMeta: {
      tablesQueried: [tableName],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Query error on ${tableName}: ${error.message}`,
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
  }
): Promise<{
  payload: AssistantResponsePayload;
  updatedContext: ConversationContext;
}> {
  const now = options?.now ? new Date(options.now.getTime()) : new Date();
  const adapter = options?.adapter || defaultSupabaseAdapter;
  const intent = classifyAssistantIntent(rawQuery, caller, context, now);
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
      prefix + `### Feature Not Implemented in ABLEBIZ SUITE`,
      intent.unsupportedReason ||
        `The requested capability is not currently implemented in **${spec.displayName}**.`,
      `#### What Is Supported in ${spec.displayName}`,
      `- **Route:** \`${spec.route}\``,
      `- **Supported Operations:** ${spec.supportedOperations.join("; ")}`,
      `- **Known Limitations:** ${spec.knownLimitations.join(" ")}`,
    ].join("\n\n");

    return {
      updatedContext,
      payload: {
        status: "unsupported",
        intentType: "unsupported_feature",
        moduleId: intent.primaryModule,
        title: "Unsupported Capability",
        summary: intent.unsupportedReason || "Feature not implemented.",
        markdown,
        metrics: [
          { label: "Module", value: spec.displayName, tone: "amber" },
          { label: "Feature Status", value: "Not Implemented", tone: "rose" },
        ],
        links,
        followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, updatedContext),
        sourceMeta: {
          tablesQueried: [],
          reportingPeriodLabel: intent.dateRange.label,
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `Capability check against Catalogue v${CAPABILITY_CATALOGUE_VERSION}`,
        },
      },
    };
  }

  // 2. Handle Capability Overview ("What can you do?")
  if (intent.intentType === "capability_overview") {
    const accessibleModules = Object.values(CAPABILITY_CATALOGUE).filter((m) =>
      canCallerAccessModule(caller, m.id)
    );
    const restrictedModules = Object.values(CAPABILITY_CATALOGUE).filter(
      (m) => !canCallerAccessModule(caller, m.id)
    );

    const markdown = [
      prefix + `### ABLEBIZ AI Secretary — Full-Suite Capability Inventory (v${CAPABILITY_CATALOGUE_VERSION})`,
      `I am your role-aware operational intelligence and Suite Guide assistant. For your current role (**${caller.roleLabel}**, \`${caller.role}\`), you have authorized access to **${accessibleModules.length} of ${Object.keys(CAPABILITY_CATALOGUE).length} modules**.`,
      `#### 1. Verified Operational Reports`,
      `Ask about live records, SLA deadlines, overdue items, or date-scoped summaries (in \`${ABILITY_TIMEZONE}\`) across your authorized modules:\n` +
        accessibleModules
          .map((m) => `- **${m.displayName}** (\`${m.route}\`): ${m.purpose}`)
          .join("\n"),
      `#### 2. Interactive Suite Guide & Workflow Help`,
      `Ask step-by-step *"How do I..."* questions grounded in actual Suite screens, required fields, and maker-checker rules:\n` +
        SUITE_GUIDE_TOPICS.slice(0, 8)
          .map((t) => `- *${t.title}* (\`${t.route}\`)`)
          .join("\n"),
      restrictedModules.length > 0
        ? `#### 3. Modules Restricted for ${caller.roleLabel}\n` +
          restrictedModules
            .map(
              (m) =>
                `- **${m.displayName}** (\`${m.route}\`) — requires ${m.requiredPermissions.map((p) => `\`${p}\``).join(", ") || m.allowedRolesSummary}`
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
        title: "Suite Capability Inventory",
        summary: `${accessibleModules.length} authorized modules available for ${caller.roleLabel}.`,
        markdown,
        metrics: [
          { label: "Your Role", value: caller.roleLabel, tone: "emerald" },
          { label: "Authorized Modules", value: String(accessibleModules.length), tone: "blue" },
          { label: "Guide Workflows", value: String(SUITE_GUIDE_TOPICS.length), tone: "slate" },
        ],
        links: resolveAuthorizedLinks(caller, ["dashboard", "cac_operations", "service_requests", "hr", "tasks"]).slice(0, 4),
        followUpSuggestions: getContextualFollowUpQuestions(caller, "dashboard", updatedContext),
        sourceMeta: {
          tablesQueried: [],
          reportingPeriodLabel: "Current Configuration",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `Capability Catalogue v${CAPABILITY_CATALOGUE_VERSION}`,
        },
      },
    };
  }

  // 3. Handle Permission Explanation ("Why is a button unavailable to my role?")
  if (intent.intentType === "permission_explanation") {
    const built = buildRolePermissionResponse(caller, rawQuery);
    const markdown = prefix + (typeof built === "string" ? built : built.markdown);
    return {
      updatedContext,
      payload: {
        status: "ok",
        intentType: "permission_explanation",
        moduleId: intent.primaryModule,
        title: `Role & Permission Guide (${caller.roleLabel})`,
        summary: `Explanation of role permissions and maker-checker controls for ${caller.roleLabel}.`,
        markdown,
        metrics: [
          { label: "Active Role", value: caller.roleLabel, tone: "blue" },
          { label: "Granted Permissions", value: String(caller.permissions.length), tone: "emerald" },
          { label: "Management Tier", value: caller.isManagement ? "Yes" : "Standard / Scoped", tone: "slate" },
        ],
        links: resolveAuthorizedLinks(caller, [intent.primaryModule, "dashboard", "hr", "team"]).slice(0, 3),
        followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, updatedContext),
        sourceMeta: {
          tablesQueried: [],
          reportingPeriodLabel: "Live Session RBAC",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: "Canonical role permissions from src/auth/roleConfig.ts and src/lib/hrPermissions.ts",
        },
      },
    };
  }

  // 4. Handle Troubleshooting ("How do I correct a failed operation?")
  if (intent.intentType === "troubleshooting") {
    const built = buildTroubleshootingResponse(caller, rawQuery);
    const markdown = prefix + (typeof built === "string" ? built : built.markdown);
    return {
      updatedContext,
      payload: {
        status: "ok",
        intentType: "troubleshooting",
        moduleId: intent.primaryModule,
        title: "Workflow Troubleshooting & Recovery Guide",
        summary: "Actionable steps to diagnose and recover from failed or rejected operations.",
        markdown,
        metrics: [
          { label: "Your Role", value: caller.roleLabel, tone: "blue" },
          { label: "Mode", value: "Troubleshooting", tone: "amber" },
        ],
        links: resolveAuthorizedLinks(caller, [intent.primaryModule, "dashboard", "cac_operations", "hr"]).slice(0, 4),
        followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, updatedContext),
        sourceMeta: {
          tablesQueried: [],
          reportingPeriodLabel: "Current Workflow Rules",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `Suite Guide & Troubleshooting Registry (v${CAPABILITY_CATALOGUE_VERSION})`,
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
      const built = formatGuideTopicResponse(topic, caller);
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
            { label: "Target Workspace", value: getModuleSpec(topic.moduleId).displayName, tone: "blue" },
            {
              label: "Your Role Access",
              value: canAccessTopicModule ? "Authorized" : "Read / Restricted",
              tone: canAccessTopicModule ? "emerald" : "amber",
            },
          ],
          links,
          followUpSuggestions: getContextualFollowUpQuestions(caller, topic.moduleId, updatedContext),
          sourceMeta: {
            tablesQueried: getModuleSpec(topic.moduleId).tables,
            reportingPeriodLabel: "Suite Workflow Guide",
            timezone: ABILITY_TIMEZONE,
            fetchedAtIso: now.toISOString(),
            fetchedAtFormatted: formatDateTimeLagos(now),
            roleApplied: caller.role,
            scopeDescription: `Verified UI workflow specification (${topic.route})`,
          },
        },
      };
    }

    // Fallback module-level guide from capability catalogue if no specific topic matched
    const spec = getModuleSpec(intent.primaryModule);
    const canAccess = canCallerAccessModule(caller, intent.primaryModule);
    const markdown = [
      prefix + `### How to Use ${spec.displayName}`,
      spec.purpose,
      `#### 1. Workspace Route & Access`,
      `- **Route:** \`${spec.route}\``,
      `- **Authorized Roles:** ${spec.allowedRolesSummary}`,
      `- **Your Access (${caller.roleLabel}):** ${canAccess ? "Authorized" : "Restricted for your role"}`,
      `#### 2. Supported Operations in ${spec.displayName}`,
      ...spec.supportedOperations.map((op, i) => `${i + 1}. ${op}`),
      `#### 3. Underlying Tables & Governance`,
      `- **Tables:** ${spec.tables.map((t) => `\`${t}\``).join(", ")}`,
      `- **Known Limitations:** ${spec.knownLimitations.join(" ")}`,
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
          reportingPeriodLabel: "Suite Workflow Guide",
          timezone: ABILITY_TIMEZONE,
          fetchedAtIso: now.toISOString(),
          fetchedAtFormatted: formatDateTimeLagos(now),
          roleApplied: caller.role,
          scopeDescription: `Capability Catalogue v${CAPABILITY_CATALOGUE_VERSION}`,
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
    // Apply HR scope: non-management staff only see their own attendance logs
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
      ? "Organization-wide HR attendance scope"
      : "Personal attendance scope (your staff profile)";

    const markdown = [
      prefix + `### HR Attendance Summary (${intent.dateRange.label})`,
      rows.length === 0
        ? `The query against \`hr_attendance_logs\` succeeded and returned **0 attendance records** matching **${intent.dateRange.label}** under your current scope (${scopeNote}).`
        : `Verified **${formatCount(rows.length)}** attendance log(s) for **${intent.dateRange.label}** (${scopeNote}).`,
      `#### Verified Figures`,
      `- **Present / Remote:** ${formatCount(presentCount)}`,
      `- **Late Check-ins:** ${formatCount(lateCount)}`,
      `- **Absent / On Leave:** ${formatCount(absentOrLeaveCount)}`,
      `#### Recommended Next Step`,
      `- Open [HR & Staff Portal](/admin/hr) and select the **Attendance** tab to record daily check-in/check-out or review shift logs.`,
    ].join("\n\n");

    return {
      status,
      intentType: "operational_report",
      moduleId: "hr",
      title: `Attendance Report (${intent.dateRange.label})`,
      summary: `${rows.length} attendance records verified.`,
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
                  String(r.status || "present").toUpperCase(),
                  String(r.work_mode || "office"),
                  r.check_in_at ? formatDateTimeLagos(r.check_in_at) : "—",
                ];
              }),
            }
          : undefined,
      links: resolveAuthorizedLinks(caller, ["hr", "dashboard"]),
      followUpSuggestions: getContextualFollowUpQuestions(caller, "hr", context),
      sourceMeta: {
        tablesQueried: ["hr_attendance_logs", "staff_profiles"],
        reportingPeriodLabel: intent.dateRange.label,
        timezone: ABILITY_TIMEZONE,
        fetchedAtIso: now.toISOString(),
        fetchedAtFormatted: formatDateTimeLagos(now),
        roleApplied: caller.role,
        scopeDescription: scopeNote,
      },
    };
  }

  // Default HR Report: Leave Schedule & Staff Leave Status (e.g. "staff on leave in the next three weeks")
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

  // Determine date window: if user didn't specify a window on a leave query, default to next 21 days from today in Africa/Lagos
  const effectiveRange: ParsedDateRange =
    intent.dateRange.preset === "all_time" && /\b(who is|which staff|upcoming|on leave)\b/.test(q)
      ? {
          preset: "upcoming_window",
          label: `Current & Upcoming Leave Window (${formatShortDate(now.toISOString())} onwards)`,
          startDate: now.toISOString().slice(0, 10),
          endDate: new Date(now.getTime() + 21 * 86400000).toISOString().slice(0, 10),
          startIso: now.toISOString(),
          endIso: new Date(now.getTime() + 21 * 86400000).toISOString(),
          isFuture: true,
          timezone: ABILITY_TIMEZONE,
        }
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

  // Also check staff_profiles currently flagged with employment_status = 'on_leave'
  const currentlyOnLeaveProfiles = canViewAllLeave
    ? allStaff.filter((s: any) => s.employment_status === "on_leave")
    : [];

  const scopeDescription = canViewAllLeave
    ? "Organization-wide HR leave visibility (Management / HR Manager)"
    : "Personal HR leave scope (your role only permits viewing your own leave requests; organization-wide leave schedules require HR Manager, Operations Admin, MD, or Super Admin)";

  const totalMatching = approvedLeaves.length + pendingLeaves.length;
  const status: QueryResultStatus =
    leaveRows.length === 0 && currentlyOnLeaveProfiles.length === 0 ? "empty" : "ok";

  const markdownLines: string[] = [
    prefix + `### Staff Leave Report — ${effectiveRange.label}`,
  ];

  if (status === "empty") {
    markdownLines.push(
      `The query against \`hr_leave_requests\` and \`staff_profiles\` succeeded and found **0 approved or pending leave records** overlapping **${effectiveRange.startDate || "start"} to ${effectiveRange.endDate || "end"}** (${ABILITY_TIMEZONE}).`
    );
    if (!canViewAllLeave) {
      markdownLines.push(
        `> **Scope Note:** Because your role is **${caller.roleLabel}** (\`${caller.role}\`), this check covers your personal leave records only. Organization-wide staff leave schedules are restricted to **Super Admin, Managing Director, Operations Admin, and HR Manager**.`
      );
    }
  } else {
    markdownLines.push(
      `Found **${formatCount(approvedLeaves.length)} approved** leave record(s) and **${formatCount(pendingLeaves.length)} pending / awaiting-review** request(s) overlapping **${effectiveRange.startDate || "all dates"} to ${effectiveRange.endDate || "all dates"}** (\`${ABILITY_TIMEZONE}\`).`
    );
  }

  markdownLines.push(
    `#### Verified Breakdown`,
    `- **Approved Leave in Window:** ${formatCount(approvedLeaves.length)}`,
    `- **Pending / Correction Requested:** ${formatCount(pendingLeaves.length)}`,
    `- **Rejected / Cancelled in Window:** ${formatCount(rejectedOrCancelledLeaves.length)}`,
    `- **Staff Profiles Marked \`on_leave\`:** ${formatCount(currentlyOnLeaveProfiles.length)}`,
    `- **Visibility Scope Applied:** ${scopeDescription}`,
    `#### Recommended Next Step`,
    canViewAllLeave
      ? `- Open [HR & Staff Portal](/admin/hr) → **Leave Management** to review pending requests or verify relief officer coverage.`
      : `- Open [HR & Staff Portal](/admin/hr) → **Leave Management** to submit or track your personal leave requests.`
  );

  const combinedForTable = [...approvedLeaves, ...pendingLeaves];

  return {
    status,
    intentType: "operational_report",
    moduleId: "hr",
    title: `Staff Leave Schedule (${effectiveRange.label})`,
    summary: `${approvedLeaves.length} approved, ${pendingLeaves.length} pending leave requests in window.`,
    markdown: markdownLines.join("\n\n"),
    metrics: [
      { label: "Approved Leave", value: formatCount(approvedLeaves.length), tone: "emerald" },
      {
        label: "Pending Approval",
        value: formatCount(pendingLeaves.length),
        tone: pendingLeaves.length > 0 ? "amber" : "slate",
      },
      {
        label: "Profiles On Leave",
        value: formatCount(currentlyOnLeaveProfiles.length),
        tone: "blue",
      },
      {
        label: "Window",
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
            caption: `Verified Leave Requests (${effectiveRange.label})`,
            headers: ["Staff Member", "Leave Type", "Start Date", "End Date", "Days", "Status"],
            rows: combinedForTable.slice(0, 15).map((r: any) => {
              const st = staffMap.get(r.staff_profile_id);
              return [
                st?.full_name || "Staff Member",
                String(r.leave_type || "annual").replace(/_/g, " "),
                formatShortDate(r.start_date),
                formatShortDate(r.end_date),
                String(r.days_count ?? 1),
                String(r.status || "pending").toUpperCase(),
              ];
            }),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["hr", "team", "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "hr", context),
    sourceMeta: {
      tablesQueried: ["hr_leave_requests", "staff_profiles"],
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
      ? `The query against \`cac_applications\` succeeded and returned **0 matching CAC records** for **${intent.dateRange.label}**. (Total records in table across all dates: **${formatCount(allCac.length)}**).`
      : `Verified **${formatCount(filteredCac.length)}** CAC application(s) in \`cac_applications\` for **${intent.dateRange.label}**.`,
    `#### Pipeline Breakdown`,
    `- **Active / In-Progress Filings:** ${formatCount(activeFilings.length)}`,
    `- **Waiting for Internal Review / Prep:** ${formatCount(waitingReviewFilings.length)} (\`intake\`, \`docs_collected\`, \`availability_check\`, \`name_reservation\`, \`internal_review\`)`,
    `- **Submitted to CAC / Processing:** ${formatCount(submittedToCacFilings.length)} (\`submitted_to_cac\`, \`under_processing\`, \`certificate_issued\`)`,
    `- **Queried by CAC (Requires Intervention):** ${formatCount(queriedFilings.length)}`,
    `- **Overdue Past SLA Due Date:** ${formatCount(overdueFilings.length)}`,
    `- **Approved / Completed:** ${formatCount(completedFilings.length)}`,
    `#### Recommended Next Step`,
    queriedFilings.length > 0 || overdueFilings.length > 0
      ? `- Prioritize the **${formatCount(queriedFilings.length)} queried** and **${formatCount(overdueFilings.length)} overdue** application(s) in [CAC Operations](/admin/cac-operations) by uploading query response documents and advancing their stage.`
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
        label: "Overdue SLA",
        value: formatCount(overdueFilings.length),
        tone: overdueFilings.length > 0 ? "amber" : "emerald",
      },
    ],
    table:
      focusList.length > 0
        ? {
            caption: "CAC Applications Snapshot",
            headers: ["Business / Proposed Name", "Service Type", "Current Stage", "Status", "SLA Due Date"],
            rows: focusList.slice(0, 12).map((c: any) => [
              c.business_name || c.proposed_name_1 || "Unnamed Application",
              c.service_type || "CAC Registration",
              String(c.stage || "intake").replace(/_/g, " ").toUpperCase(),
              String(c.status || "in_progress").replace(/_/g, " "),
              formatShortDate(c.sla_due_date),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["cac_operations", "service_requests", "documents"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "cac_operations", context),
    sourceMeta: {
      tablesQueried: ["cac_applications"],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Verified CAC pipeline query across all 11 stages and terminal statuses",
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
      ? `The query against \`service_requests\` succeeded and returned **0 service requests** for **${intent.dateRange.label}**.`
      : `Verified **${formatCount(filtered.length)}** service request(s) for **${intent.dateRange.label}**.`,
    `#### Status Summary`,
    `- **Awaiting Action / In Review / Queried:** ${formatCount(pendingOrReview.length)}`,
    `- **In Progress:** ${formatCount(inProgress.length)}`,
    `- **Overdue Past Due Date:** ${formatCount(overdue.length)}`,
    `- **Completed:** ${formatCount(completed.length)}`,
    `#### Recommended Next Step`,
    `- Open [Service Requests](/admin/service-requests) to assign unassigned requests, resolve queried items, or convert approved CAC requests into CAC applications.`,
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
        label: "Needs Intervention",
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
              r.custom_service_name || "Catalog Service Request",
              String(r.progress_stage || "Intake"),
              String(r.status || "pending").replace(/_/g, " "),
              String(r.priority || "medium").toUpperCase(),
              formatShortDate(r.due_date),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["service_requests", "cac_operations", "services_catalog"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "service_requests", context),
    sourceMeta: {
      tablesQueried: ["service_requests"],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Service requests intake and execution tracker",
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
      ? `The query against \`services_catalog\` succeeded and returned **0 configured services**.`
      : `Verified **${formatCount(rows.length)}** service offering(s) in \`services_catalog\` (**${formatCount(activeRows.length)} active**).`,
    `#### Recommended Next Step`,
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
              s.is_active !== false ? "ACTIVE" : "INACTIVE",
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["services_catalog", "service_requests"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "services_catalog", context),
    sourceMeta: {
      tablesQueried: ["services_catalog"],
      reportingPeriodLabel: "Current Catalogue",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Master service definitions",
    },
  };
}

/**
 * Finance Operational Report (Invoices, Payments, Quotations, Expenses, Vendors)
 * Strictly gated by finance.view and aggregates each table independently to prevent join fan-out double-counting.
 */
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

  // Aggregate independently per table (zero join fan-out)
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
    prefix + `### Financial & Billing Intelligence (${intent.dateRange.label})`,
    totalRecordsCount === 0
      ? `The query across \`invoices\`, \`payments\`, \`quotations\`, and \`expenses\` succeeded and found **0 financial records** for **${intent.dateRange.label}**.`
      : `Verified financial ledger summary for **${intent.dateRange.label}** (each ledger table aggregated independently to prevent join double-counting).`,
    `#### Verified Figures`,
    `- **Total Invoiced (${formatCount(validInvoices.length)} active invoices):** ${formatNgn(totalInvoicedNgn)}`,
    `- **Verified Payments Collected (${formatCount(verifiedPayments.length)} receipts):** ${formatNgn(totalCollectedNgn)}`,
    `- **Outstanding Receivables (${formatCount(outstandingInvoices.length)} unpaid/partial/overdue invoices):** ${formatNgn(totalOutstandingNgn)}`,
    `- **Payments Pending Reconciliation (${formatCount(pendingReconciliationPayments.length)} receipts):** ${formatNgn(pendingReconciliationNgn)}`,
    `- **Approved / Paid Expenses (${formatCount(approvedExpenses.length)} vouchers):** ${formatNgn(totalExpensesNgn)}`,
    `- **Net Verified Cash Position (Collections minus Expenses):** ${formatNgn(netCashflowNgn)}`,
    `- **Quotations (${formatCount(quotations.length)}) & Active Vendors (${formatCount(vendors.filter((v: any) => v.is_active !== false).length)}):** Tracked in [Quotations](/admin/quotations) and [Vendors](/admin/vendors).`,
    `#### Recommended Next Step`,
    pendingReconciliationPayments.length > 0
      ? `- Reconcile the **${formatCount(pendingReconciliationPayments.length)} pending payment(s)** (${formatNgn(pendingReconciliationNgn)}) in [Payments](/admin/payments) and follow up on **${formatCount(outstandingInvoices.length)} outstanding invoice(s)** in [Invoices](/admin/invoices).`
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
        label: "Pending Reconciliation",
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
              String(p.payment_method || "bank_transfer").replace(/_/g, " "),
              formatNgn(Number(p.amount || 0)),
              String(p.status || "pending").toUpperCase(),
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
              String(e.status || "pending").toUpperCase(),
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
              String(inv.status || "unpaid").toUpperCase(),
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
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Authorized finance ledger query (independent table aggregation)",
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
      ? `The query against \`referrals\` and \`spin_rewards\` succeeded and returned **0 referral or reward records** for **${intent.dateRange.label}**.`
      : `Verified **${formatCount(referrals.length)}** referral(s) and **${formatCount(rewards.length)}** Spin & Earn reward record(s).`,
    `#### Verified Breakdown`,
    `- **Referrals Needing Follow-Up (\`pending\`, \`contacted\`, \`qualified\`):** ${formatCount(needsFollowUp.length)}`,
    `- **Converted Referrals:** ${formatCount(convertedReferrals.length)}`,
    `- **Rewards Awaiting Approval / Fulfillment:** ${formatCount(awaitingFulfillment.length)}`,
    `- **Fulfilled Rewards:** ${formatCount(fulfilledRewards.length)}`,
    `#### Recommended Next Step`,
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
              String(r.status || "pending").toUpperCase(),
              String(r.reward_status || "pending").toUpperCase(),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["referrals", "leads", "clients"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "referrals", context),
    sourceMeta: {
      tablesQueried: ["referrals", "spin_rewards"],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Referral conversion and Spin & Earn fulfillment tracker",
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
    (f: any) => f.scheduled_for && String(f.scheduled_for) < todayIso
  );

  const status: QueryResultStatus =
    leads.length === 0 && followUps.length === 0 && comms.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### CRM Leads, Follow-Ups & Communications (${intent.dateRange.label})`,
    status === "empty"
      ? `The query across \`leads\`, \`follow_ups\`, and \`client_communications\` succeeded and found **0 matching CRM records**.`
      : `Verified **${formatCount(leads.length)}** lead(s), **${formatCount(pendingFollowUps.length)}** pending follow-up(s), and **${formatCount(comms.length)}** communication log(s).`,
    `#### CRM Pipeline Metrics`,
    `- **Active Leads (\`new\`, \`contacted\`, \`qualified\`, \`proposal_sent\`):** ${formatCount(activeLeads.length)}`,
    `- **Converted / Won Leads:** ${formatCount(wonLeads.length)}`,
    `- **Pending Follow-Ups:** ${formatCount(pendingFollowUps.length)} (**${formatCount(overdueFollowUps.length)} overdue**)`,
    `- **Logged Client Communications:** ${formatCount(comms.length)}`,
    `#### Recommended Next Step`,
    `- Open [Leads](/admin/leads) or [Follow-ups](/admin/follow-ups) to action overdue callbacks and convert qualified leads.`,
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
      { label: "Comm Logs", value: formatCount(comms.length), tone: "slate" },
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
              String(l.status || "new").toUpperCase(),
              formatShortDate(l.created_at),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["leads", "follow_ups", "communications", "clients"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, context),
    sourceMeta: {
      tablesQueried: ["leads", "follow_ups", "client_communications"],
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
      ? `The query against \`clients\` and \`businesses\` succeeded and found **0 records** for **${intent.dateRange.label}**.`
      : `Verified **${formatCount(clients.length)}** client profile(s) and **${formatCount(businesses.length)}** corporate business entity record(s).`,
    `#### Key Metrics`,
    `- **Active Clients:** ${formatCount(activeClients.length)} (**${formatCount(verifiedKyc.length)} KYC Verified**)`,
    `- **Registered Business Entities:** ${formatCount(businesses.length)}`,
    `- **Businesses with Annual Returns Due/Overdue:** ${formatCount(dueAnnualReturns.length)}`,
    `#### Recommended Next Step`,
    `- Manage client profiles in [Clients 360°](/admin/clients) and track RC/BN compliance in [Businesses](/admin/businesses).`,
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
              String(c.client_type || "individual").toUpperCase(),
              String(c.status || "active").toUpperCase(),
              String(c.kyc_status || "pending").toUpperCase(),
              formatShortDate(c.created_at),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["clients", "businesses", "service_requests"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, intent.primaryModule, context),
    sourceMeta: {
      tablesQueried: ["clients", "businesses"],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Client 360 and corporate entity directory",
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

  const openTasks = allTasks.filter(
    (t: any) => !["completed", "cancelled"].includes(String(t.status || ""))
  );
  const overdueTasks = openTasks.filter(
    (t: any) => t.due_date && String(t.due_date).slice(0, 10) < todayYmd
  );
  const urgentTasks = openTasks.filter(
    (t: any) => t.priority === "urgent" || t.priority === "high"
  );
  const blockedTasks = openTasks.filter((t: any) => t.status === "blocked");
  const completedTasks = allTasks.filter((t: any) => t.status === "completed");

  const status: QueryResultStatus = allTasks.length === 0 ? "empty" : "ok";

  const markdown = [
    prefix + `### Tasks & SLA Execution Report`,
    allTasks.length === 0
      ? `The query against \`tasks\` succeeded and returned **0 task records**.`
      : `Verified **${formatCount(allTasks.length)}** total task(s) (**${formatCount(openTasks.length)} open**, **${formatCount(overdueTasks.length)} overdue**).`,
    `#### SLA & Workload Breakdown`,
    `- **Open Tasks (\`todo\`, \`in_progress\`, \`review\`, \`blocked\`):** ${formatCount(openTasks.length)}`,
    `- **Overdue Tasks (Due prior to ${todayYmd}):** ${formatCount(overdueTasks.length)}`,
    `- **High / Urgent Priority Open Tasks:** ${formatCount(urgentTasks.length)}`,
    `- **Blocked Tasks:** ${formatCount(blockedTasks.length)}`,
    `- **Completed Tasks:** ${formatCount(completedTasks.length)}`,
    `#### Recommended Next Step`,
    `- Open [Tasks](/admin/tasks) to update status on overdue items or clear blocked dependencies.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "tasks",
    title: "Tasks & SLA Tracker",
    summary: `${openTasks.length} open tasks (${overdueTasks.length} overdue, ${urgentTasks.length} high/urgent).`,
    markdown,
    metrics: [
      { label: "Open Tasks", value: formatCount(openTasks.length), tone: "blue" },
      {
        label: "Overdue SLA",
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
              String(t.priority || "medium").toUpperCase(),
              String(t.status || "todo").replace(/_/g, " ").toUpperCase(),
              formatShortDate(t.due_date),
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["tasks", "dashboard", "cac_operations"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "tasks", context),
    sourceMeta: {
      tablesQueried: ["tasks"],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Operational tasks and SLA deadlines",
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
      ? `The query against \`documents\` succeeded and found **0 uploaded document records**.`
      : `Verified **${formatCount(docs.length)}** document metadata record(s) in the Document Vault.`,
    `#### Recommended Next Step`,
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
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Document Vault metadata index",
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
    prefix + `### Staff Directory & RBAC Maker-Checker Queue`,
    `Verified **${formatCount(staff.length)}** staff profile(s) (**${formatCount(activeStaff.length)} active**) and **${formatCount(pendingApprovals.length)}** pending maker-checker approval request(s).`,
    `#### Governance Summary`,
    `- **Active Staff Accounts:** ${formatCount(activeStaff.length)}`,
    `- **Pending Staff Change Requests (\`staff_change_requests\`):** ${formatCount(pendingApprovals.length)}`,
    `- **Maker-Checker Rule:** Operations Admin and HR Manager submit role/status change requests; **Super Admin** and **Managing Director** approve or reject them.`,
    `#### Recommended Next Step`,
    `- Open [Staff & RBAC](/admin/team) to review staff assignments or process pending approval requests.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "team",
    title: "Staff & RBAC Governance",
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
            caption: "Staff Profiles & Canonical Roles",
            headers: ["Full Name", "Role", "Department", "Employment Status", "Active"],
            rows: staff.slice(0, 12).map((s: any) => [
              s.full_name || s.email || "Staff",
              String(s.role || "viewer").replace(/_/g, " "),
              s.department || "Operations",
              String(s.employment_status || "active").replace(/_/g, " ").toUpperCase(),
              s.is_active !== false ? "YES" : "NO",
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["team", "hr", "audit_logs"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "team", context),
    sourceMeta: {
      tablesQueried: ["staff_profiles", "staff_change_requests"],
      reportingPeriodLabel: "Current RBAC State",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Staff RBAC and maker-checker approval queue",
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
    prefix + `### Audit Logs & Activity Timeline`,
    `Retrieved **${formatCount(audits.length)}** recent security audit event(s) and **${formatCount(activities.length)}** operational timeline event(s).`,
    `#### Recommended Next Step`,
    `- Open [Audit Logs](/admin/audit-logs) to filter immutable logs by actor email, role, or entity type.`,
  ].join("\n\n");

  return {
    status,
    intentType: "operational_report",
    moduleId: "audit_logs",
    title: "Security Audit & Activity Logs",
    summary: `${audits.length} audit events and ${activities.length} timeline events retrieved.`,
    markdown,
    metrics: [
      { label: "Audit Events", value: formatCount(audits.length), tone: "blue" },
      { label: "Timeline Events", value: formatCount(activities.length), tone: "slate" },
    ],
    table:
      audits.length > 0
        ? {
            caption: "Recent Security Audit Logs",
            headers: ["Timestamp", "Actor", "Role", "Action", "Entity"],
            rows: audits.slice(0, 10).map((a: any) => [
              formatDateTimeLagos(a.created_at),
              a.actor_email || "System",
              a.actor_role || "—",
              a.action || "event",
              a.entity_type || "—",
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["audit_logs", "team", "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "audit_logs", context),
    sourceMeta: {
      tablesQueried: ["audit_logs", "activity_timeline"],
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Immutable audit trail",
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
      ? `Verified corporate profile for **${profile.company_name || "ABLEBIZ"}** (RC: \`${profile.rc_number || "N/A"}\`, Invoice Prefix: \`${profile.invoice_prefix || "INV"}\`) and **${formatCount(activeBanks.length)} active bank account(s)**.`
      : `Verified **${formatCount(activeBanks.length)}** active settlement bank account(s).`,
    `#### Recommended Next Step`,
    `- Open [Settings](/admin/settings) to update corporate branding, invoice prefixes, or settlement bank details.`,
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
            caption: "Configured Settlement Bank Accounts",
            headers: ["Bank Name", "Account Name", "Account Number", "Primary", "Active"],
            rows: banks.map((b: any) => [
              b.bank_name || "Bank",
              b.account_name || "ABLEBIZ",
              b.account_number || "—",
              b.is_primary ? "PRIMARY" : "Secondary",
              b.is_active !== false ? "ACTIVE" : "INACTIVE",
            ]),
          }
        : undefined,
    links: resolveAuthorizedLinks(caller, ["settings", "invoices"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "settings", context),
    sourceMeta: {
      tablesQueried: ["business_profile", "business_bank_accounts"],
      reportingPeriodLabel: "Current Settings",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "Organization configuration",
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
      `You have **${formatCount(unread.length)} unread notification(s)** out of **${formatCount(rows.length)}** recent alerts.`,
      `#### Recommended Next Step`,
      `- Open [Notifications](/admin/notifications) to view and mark alerts as read.`,
    ].join("\n\n"),
    metrics: [
      { label: "Unread Alerts", value: formatCount(unread.length), tone: unread.length > 0 ? "amber" : "emerald" },
      { label: "Total Recent", value: formatCount(rows.length), tone: "blue" },
    ],
    links: resolveAuthorizedLinks(caller, ["notifications", "dashboard"]),
    followUpSuggestions: getContextualFollowUpQuestions(caller, "dashboard", context),
    sourceMeta: {
      tablesQueried: ["notifications"],
      reportingPeriodLabel: "Current Session",
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: "User notification inbox",
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

  // If primary operational tables errored, report the error truthfully instead of returning 0s
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
    (f: any) => f.status === "pending" && f.scheduled_for && String(f.scheduled_for) < todayIso
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
      `- **Tasks & SLA:** **${formatCount(overdueTasks.length)} overdue task(s)** and **${formatCount(urgentTasks.length)} high/urgent task(s)** requiring execution.`
    );
    bulletPoints.push(
      `- **CAC Operations:** **${formatCount(queriedCac.length)} queried filing(s)** and **${formatCount(activeCac.length)} active incorporation(s)** in progress.`
    );
    bulletPoints.push(
      `- **Service Requests:** **${formatCount(pendingSr.length)} request(s)** awaiting review, assignment, or intervention.`
    );
  }
  if (hasCrm) {
    bulletPoints.push(
      `- **CRM & Follow-Ups:** **${formatCount(overdueFollowUps.length)} overdue follow-up(s)** and **${formatCount(newLeads.length)} uncontacted new lead(s)**.`
    );
  }
  if (hasFinance) {
    bulletPoints.push(
      `- **Finance & Billing:** **${formatCount(overdueInvoices.length)} overdue invoice(s)** awaiting collection.`
    );
  }
  if (caller.isManagement || caller.hrAccess.canViewAllLeave) {
    bulletPoints.push(
      `- **Governance & HR Approvals:** **${formatCount(pendingLeaveApprovals.length)} pending leave request(s)** and **${formatCount(pendingStaffChanges.length)} pending staff RBAC change request(s)**.`
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
    prefix + `### Executive Operational Attention Summary`,
    totalActionItems === 0
      ? `All verified queues authorized for **${caller.roleLabel}** were checked as of **${formatDateTimeLagos(now)}** (\`${ABILITY_TIMEZONE}\`). There are currently **0 overdue or critical bottleneck items**.`
      : `Verified operational bottlenecks requiring attention for **${caller.roleLabel}** as of **${formatDateTimeLagos(now)}** (\`${ABILITY_TIMEZONE}\`):`,
    `#### Key Action Queues`,
    ...bulletPoints,
    `#### Recommended Next Step`,
    queriedCac.length > 0
      ? `- Resolve the **${formatCount(queriedCac.length)} queried CAC application(s)** in [CAC Operations](/admin/cac-operations) and clear the **${formatCount(overdueTasks.length)} overdue task(s)** in [Tasks](/admin/tasks).`
      : `- Review your active work queues in [Manager Workbench](/admin/dashboard) or [Tasks](/admin/tasks).`,
  ].join("\n\n");

  return {
    status: "ok",
    intentType: "operational_report",
    moduleId: intent.primaryModule,
    title: "Operational Attention Summary",
    summary: `${totalActionItems} priority items across your authorized Suite modules.`,
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
      reportingPeriodLabel: intent.dateRange.label,
      timezone: ABILITY_TIMEZONE,
      fetchedAtIso: now.toISOString(),
      fetchedAtFormatted: formatDateTimeLagos(now),
      roleApplied: caller.role,
      scopeDescription: `Role-scoped operational overview for ${caller.roleLabel}`,
    },
  };
}
