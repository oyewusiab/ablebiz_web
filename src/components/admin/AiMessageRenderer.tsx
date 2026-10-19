import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Database,
  HelpCircle,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  AssistantCallerContext,
  AssistantMetricItem,
  AssistantResponsePayload,
  QueryResultStatus,
} from "../../lib/aiSecretary/types";
import {
  canCallerAccessRoute,
  formatFriendlySourceNames,
} from "../../lib/aiSecretary/capabilityCatalogue";

/**
 * Validates and classifies a Markdown href so unsafe protocols (javascript:, data:, vbscript:)
 * and unauthorized internal routes are never rendered as clickable dangerous links.
 */
export function sanitizeAssistantLink(
  href: string | undefined,
  caller: AssistantCallerContext
): {
  type: "internal_authorized" | "internal_restricted" | "blocked";
  cleanHref: string;
} {
  if (!href || typeof href !== "string") {
    return { type: "blocked", cleanHref: "#" };
  }
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();

  // Block dangerous schemes immediately
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return { type: "blocked", cleanHref: "#" };
  }

  // Only allow internal Suite routes starting with /admin
  if (trimmed.startsWith("/admin")) {
    const allowed = canCallerAccessRoute(caller, trimmed);
    return {
      type: allowed ? "internal_authorized" : "internal_restricted",
      cleanHref: trimmed,
    };
  }

  return { type: "blocked", cleanHref: "#" };
}

function getStatusBadgeMeta(status: QueryResultStatus): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "ok":
      return {
        label: "Verified",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    case "empty":
      return {
        label: "No Matching Records",
        className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        icon: <Database className="w-3.5 h-3.5" />,
      };
    case "permission_denied":
      return {
        label: "Access Restricted",
        className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
        icon: <Lock className="w-3.5 h-3.5" />,
      };
    case "schema_pending":
      return {
        label: "Workspace Setup Pending",
        className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    case "query_error":
      return {
        label: "Request Incomplete",
        className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
      };
    case "unsupported":
      return {
        label: "Feature Unavailable",
        className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        icon: <HelpCircle className="w-3.5 h-3.5" />,
      };
  }
}

function getMetricToneClasses(tone: AssistantMetricItem["tone"]): string {
  switch (tone) {
    case "emerald":
      return "border-emerald-200/80 bg-emerald-50/50 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-200";
    case "amber":
      return "border-amber-200/80 bg-amber-50/50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200";
    case "rose":
      return "border-rose-200/80 bg-rose-50/50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-200";
    case "blue":
      return "border-blue-200/80 bg-blue-50/50 text-[#0A2558] dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-200";
    default:
      return "border-slate-200/80 bg-slate-50/70 text-slate-900 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-100";
  }
}

function renderCellContent(cell: string): React.ReactNode {
  const upper = cell.trim().toUpperCase();
  if (
    [
      "APPROVED",
      "VERIFIED",
      "COMPLETED",
      "ACTIVE",
      "PRESENT",
      "FULFILLED",
      "WON",
      "PAID",
      "PRIMARY",
      "YES",
    ].includes(upper)
  ) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
        {cell}
      </span>
    );
  }
  if (
    [
      "PENDING",
      "IN PROGRESS",
      "INTERNAL REVIEW",
      "SUBMITTED TO CAC",
      "UNDER PROCESSING",
      "PARTIALLY_PAID",
      "LATE",
      "CONTACTED",
      "QUALIFIED",
      "MEDIUM",
      "HIGH",
    ].includes(upper)
  ) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        {cell}
      </span>
    );
  }
  if (
    [
      "OVERDUE",
      "QUERIED",
      "REJECTED",
      "CANCELLED",
      "UNPAID",
      "BLOCKED",
      "URGENT",
      "ABSENT",
    ].includes(upper)
  ) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
        {cell}
      </span>
    );
  }
  return cell;
}

interface AiMessageRendererProps {
  text: string;
  payload?: AssistantResponsePayload;
  caller: AssistantCallerContext;
  onSelectFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
}

export const AiMessageRenderer: React.FC<AiMessageRendererProps> = ({
  text,
  payload,
  caller,
  onSelectFollowUp,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  const markdownToRender = payload?.markdown || text;
  const statusBadge = payload ? getStatusBadgeMeta(payload.status) : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownToRender);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {/* Top Status & Action Header */}
      {payload && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.className}`}
              >
                {statusBadge.icon}
                {statusBadge.label}
              </span>
            )}
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {payload.sourceMeta?.reportingPeriodLabel || payload.freshness?.dateRangeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {(payload.status === "query_error" || payload.status === "schema_pending") &&
              onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Query
                </button>
              )}
            <button
              type="button"
              onClick={handleCopy}
              title="Copy response"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Compact Metric Summary Cards */}
      {payload?.metrics && payload.metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {payload.metrics.map((metric, idx) => (
            <div
              key={`${metric.label}-${idx}`}
              className={`rounded-xl border px-3 py-2.5 transition-all ${getMetricToneClasses(
                metric.tone
              )}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-75 truncate">
                {metric.label}
              </div>
              <div className="text-base font-extrabold mt-0.5 tracking-tight truncate">
                {metric.value}
              </div>
              {metric.subtext && (
                <div className="text-[10px] font-medium opacity-75 mt-0.5 truncate">
                  {metric.subtext}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Safe Markdown Body */}
      <div className="ai-markdown-content space-y-2.5 text-slate-700 dark:text-slate-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h3 className="text-base font-extrabold text-[#0A2558] dark:text-white tracking-tight mt-2 mb-1">
                {children}
              </h3>
            ),
            h2: ({ children }) => (
              <h3 className="text-base font-extrabold text-[#0A2558] dark:text-white tracking-tight mt-2 mb-1">
                {children}
              </h3>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-extrabold text-[#0A2558] dark:text-white tracking-tight mt-1 mb-1">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-3 mb-1">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-bold text-slate-900 dark:text-white">
                {children}
              </strong>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2.5 rounded-r-xl text-xs font-medium text-amber-900 dark:text-amber-200 my-2">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0A2558] dark:text-amber-300 font-mono text-xs font-semibold">
                {children}
              </code>
            ),
            a: ({ href, children }) => {
              const check = sanitizeAssistantLink(href, caller);
              if (check.type === "internal_authorized") {
                return (
                  <Link
                    to={check.cleanHref}
                    className="inline-flex items-center gap-0.5 font-bold text-[#0A2558] dark:text-amber-400 underline decoration-[#D97706]/60 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    <span>{children}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 inline shrink-0" />
                  </Link>
                );
              }
              if (check.type === "internal_restricted") {
                return (
                  <span
                    title="Route restricted for your current role"
                    className="inline-flex items-center gap-1 font-semibold text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  >
                    <span>{children}</span>
                    <Lock className="w-3 h-3 inline shrink-0" />
                  </span>
                );
              }
              return <span className="font-semibold text-slate-600">{children}</span>;
            },
            table: ({ children }) => (
              <div className="ai-table-wrapper my-3">
                <table className="ai-responsive-table">{children}</table>
              </div>
            ),
          }}
        >
          {markdownToRender}
        </ReactMarkdown>
      </div>

      {/* Structured Data Table (Expandable for Longer Reports) */}
      {payload?.table && payload.table.rows.length > 0 && (
        <details
          open={payload.table.rows.length <= 6}
          className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden"
        >
          <summary className="flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer select-none text-xs font-bold text-[#0A2558] dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors list-none">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#D97706]" />
              <span>
                {payload.table.caption || "Verified Records Table"} (
                {payload.table.rows.length}{" "}
                {payload.table.rows.length === 1 ? "record" : "records"})
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <span className="group-open:hidden">Expand table</span>
              <span className="hidden group-open:inline">Collapse</span>
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            </span>
          </summary>

          <div className="p-3 pt-0">
            <div className="ai-table-wrapper">
              <table className="ai-responsive-table">
                <thead>
                  <tr>
                    {payload.table.headers.map((header, hIdx) => (
                      <th key={`${header}-${hIdx}`} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.table.rows.map((row, rIdx) => (
                    <tr key={`row-${rIdx}`}>
                      {row.map((cell, cIdx) => {
                        const headerLabel =
                          payload.table?.headers[cIdx] || `Column ${cIdx + 1}`;
                        if (cIdx === 0) {
                          return (
                            <th
                              key={`cell-${rIdx}-${cIdx}`}
                              scope="row"
                              style={{ "--label": `"${headerLabel}"` } as React.CSSProperties}
                            >
                              {renderCellContent(cell)}
                            </th>
                          );
                        }
                        return (
                          <td
                            key={`cell-${rIdx}-${cIdx}`}
                            style={{ "--label": `"${headerLabel}"` } as React.CSSProperties}
                          >
                            {renderCellContent(cell)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {/* Clickable Authorized Suite Workspace Links */}
      {payload?.links && payload.links.length > 0 && (
        <div className="pt-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
            Open in Suite:
          </span>
          {payload.links.map((link) => {
            const targetRoute = link.route || link.path;
            return (
              <Link
                key={targetRoute}
                to={targetRoute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0A2558]/5 hover:bg-[#0A2558] text-[#0A2558] hover:text-white dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-amber-500 dark:hover:text-slate-950 border border-[#0A2558]/15 dark:border-slate-700 transition-all"
              >
                <span>{link.label}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Contextual Follow-up Suggestions */}
      {payload?.followUpSuggestions &&
        payload.followUpSuggestions.length > 0 &&
        onSelectFollowUp && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#D97706]" />
              <span>Suggested follow-up questions:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {payload.followUpSuggestions.map((followUp) => {
                const promptText =
                  typeof followUp === "string" ? followUp : followUp.prompt;
                const labelText =
                  typeof followUp === "string" ? followUp : followUp.label;
                return (
                  <button
                    key={promptText}
                    type="button"
                    onClick={() => onSelectFollowUp(promptText)}
                    className="text-left text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-amber-50 text-slate-700 hover:text-[#0A2558] dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700 transition-colors"
                  >
                    {labelText}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* Source & Data Freshness Footer */}
      {payload?.sourceMeta && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-medium">
              <Database className="w-3 h-3" />
              {payload.sourceMeta.sourcesLabel
                ? `Source: ${payload.sourceMeta.sourcesLabel}`
                : payload.sourceMeta.tablesQueried.length > 0
                ? `Source: ${formatFriendlySourceNames(payload.sourceMeta.tablesQueried)}`
                : payload.sourceMeta.scopeDescription}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="w-3 h-3" />
            <span>
              Updated {payload.sourceMeta.fetchedAtFormatted}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
