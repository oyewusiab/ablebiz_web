import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Briefcase,
  Clock,
  Filter,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  AssistantResponsePayload,
  AssistantTopicFilterId,
  ConversationContext,
} from "../../lib/aiSecretary/types";
import { buildCallerContext } from "../../lib/aiSecretary/capabilityCatalogue";
import {
  getStarterPromptsForTopic,
  getTopicSelectorOptions,
} from "../../lib/aiSecretary/suggestions";
import { executeAssistantQuery } from "../../lib/aiSecretary/queryEngine";
import {
  ABILITY_TIMEZONE,
  formatDateTimeLagos,
} from "../../lib/aiSecretary/dateUtils";
import { AiMessageRenderer } from "../../components/admin/AiMessageRenderer";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  queryPrompt?: string;
  payload?: AssistantResponsePayload;
}

const MAX_TEXTAREA_HEIGHT_PX = 144; // 9rem (~5-6 lines)

export function AiSecretaryPage() {
  const {
    user,
    profile,
    isLoading: authLoading,
    authError,
    hasPermission,
    refreshProfile,
  } = useAuth();

  const caller = useMemo(
    () => buildCallerContext(profile, hasPermission, user),
    [profile, hasPermission, user]
  );

  const topicOptions = useMemo(
    () => getTopicSelectorOptions(caller),
    [caller]
  );

  const [selectedTopic, setSelectedTopic] =
    useState<AssistantTopicFilterId>("all");

  const starterPrompts = useMemo(
    () => getStarterPromptsForTopic(caller, selectedTopic),
    [caller, selectedTopic]
  );

  const [conversationContext, setConversationContext] =
    useState<ConversationContext>({
      turnCount: 0,
    });

  const buildWelcomeMessage = useCallback((): ChatMessage => {
    const titleSuffix =
      caller.jobTitle &&
      caller.jobTitle.toLowerCase() !== caller.roleLabel.toLowerCase()
        ? ` (${caller.jobTitle} • Role Scope: **${caller.roleLabel}**)`
        : ` (**${caller.roleLabel}**)`;

    return {
      id: "welcome-1",
      sender: "ai",
      text: [
        `### Welcome, ${caller.userName}!`,
        `You are signed in as **${caller.userName}**${titleSuffix}. I am your **ABLEBIZ AI Secretary** — ready to help with operational reports, step-by-step workflow guidance, and troubleshooting across ABLEBIZ SUITE.`,
        `- **Operational Reports:** Ask in plain language about CAC filings, client service requests, overdue tasks, staff leave schedules (such as *"next three weeks"*), CRM leads, referrals, or financial summaries.`,
        `- **Suite Guide & Support:** Ask *"How do I..."* for step-by-step instructions, check who can approve an action, or troubleshoot why a button or workflow is unavailable.`,
        `Type any question below — or pick one of the optional starter prompts to begin.`,
      ].join("\n\n"),
      timestamp: new Date(),
    };
  }, [caller.userName, caller.roleLabel, caller.jobTitle]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildWelcomeMessage(),
  ]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingIdentity, setIsRefreshingIdentity] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep the initial welcome card synchronized when authenticated profile finishes loading or updates
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome-1") {
        return [buildWelcomeMessage()];
      }
      return prev.map((m) =>
        m.id === "welcome-1" ? { ...buildWelcomeMessage(), timestamp: m.timestamp } : m
      );
    });
  }, [buildWelcomeMessage]);

  // Ensure selectedTopic remains valid if caller role changes
  useEffect(() => {
    if (!topicOptions.some((opt) => opt.id === selectedTopic)) {
      setSelectedTopic("all");
    }
  }, [topicOptions, selectedTopic]);

  // Auto-scroll conversation when messages change
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing]);

  // Progressive JS fallback for auto-sizing textarea height alongside CSS field-sizing: content
  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!el.value) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    syncTextareaHeight();
  }, [inputText, syncTextareaHeight]);

  const handleVerifyIdentity = async () => {
    setIsRefreshingIdentity(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshingIdentity(false);
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    const rawSource = textOverride !== undefined ? textOverride : inputText;
    // Trim outer whitespace while preserving internal line breaks
    const trimmed = rawSource.replace(/^\s+|\s+$/g, "");
    if (!trimmed || isProcessing) return;

    const draftBackup = textOverride === undefined ? inputText : "";
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (textOverride === undefined) {
      setInputText("");
    }
    setIsProcessing(true);

    try {
      const { payload, updatedContext } = await executeAssistantQuery(
        trimmed,
        caller,
        conversationContext,
        { topicHint: selectedTopic }
      );

      setConversationContext(updatedContext);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: payload.markdown,
        timestamp: new Date(),
        queryPrompt: trimmed,
        payload,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      // Restore draft if the user typed it and submission failed unexpectedly
      if (draftBackup) {
        setInputText(draftBackup);
      }
      const fallbackMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: `### Request Could Not Be Completed\n\nThe system encountered an unexpected issue while processing your request. Your draft has been preserved so you can try again.`,
        timestamp: new Date(),
        queryPrompt: trimmed,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isProcessing) {
        void handleSendMessage();
      }
    }
  };

  const handleResetConversation = () => {
    setConversationContext({ turnCount: 0 });
    setMessages([buildWelcomeMessage()]);
    setInputText("");
  };

  const showDistinctJobTitle =
    Boolean(caller.jobTitle) &&
    caller.jobTitle!.trim().toLowerCase() !==
      caller.roleLabel.trim().toLowerCase();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0A2558] text-amber-400 shadow-sm border border-[#0A2558]/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                ABLEBIZ AI Secretary
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Verified Suite Data
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Reports & Suite Guide
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Operational reports, step-by-step workflow guidance, and support tailored to your signed-in role
            </p>
          </div>
        </div>

        {/* Verified Identity, Job Title, Role Scope & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 shadow-2xs"
            title="Signed-in staff identity and active authorization role"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong className="text-slate-900 dark:text-white">
                {caller.userName}
              </strong>
              {" • "}
              Role Scope:{" "}
              <strong className="text-[#0A2558] dark:text-amber-400">
                {caller.roleLabel}
              </strong>
            </span>
          </div>

          {showDistinctJobTitle && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 shadow-2xs">
              <Briefcase className="h-3.5 w-3.5 text-[#D97706] shrink-0" />
              <span>
                Title:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {caller.jobTitle}
                </strong>
              </span>
            </div>
          )}

          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-[#D97706]" />
            <span>{ABILITY_TIMEZONE}</span>
          </div>

          <button
            type="button"
            onClick={handleResetConversation}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Clear conversation history"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Identity Verification Alert Banner if profile is unverified or conflicting */}
      {!authLoading && (!caller.identityVerified || authError) && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/90 dark:border-amber-800/70 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Staff Identity Verification Notice: </span>
              <span>
                {authError ||
                  caller.identityWarning ||
                  "Your staff profile could not be fully verified. Restricted read-only access is currently applied."}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleVerifyIdentity}
            disabled={isRefreshingIdentity}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshingIdentity ? "animate-spin" : ""}`}
            />
            <span>Verify Identity</span>
          </button>
        </div>
      )}

      {/* Main Assistant Conversation Container */}
      <div className="flex flex-col min-h-[660px] max-h-[82vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Messages Stream */}
        <div
          className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5"
          role="log"
          aria-live="polite"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender === "ai" && (
                <div className="h-8 w-8 rounded-xl bg-[#0A2558] text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`${
                  msg.sender === "user"
                    ? "max-w-[82%] sm:max-w-[70%] bg-[#0A2558] text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-2xs"
                    : "w-full max-w-[94%] sm:max-w-[88%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-xs"
                }`}
              >
                {msg.sender === "user" ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                    <div className="text-[10px] text-blue-200/80 text-right">
                      {formatDateTimeLagos(msg.timestamp)}
                    </div>
                  </div>
                ) : (
                  <AiMessageRenderer
                    text={msg.text}
                    payload={msg.payload}
                    caller={caller}
                    onSelectFollowUp={(prompt) => void handleSendMessage(prompt)}
                    onRetry={
                      msg.queryPrompt
                        ? () => void handleSendMessage(msg.queryPrompt!)
                        : undefined
                    }
                  />
                )}
              </div>

              {msg.sender === "user" && (
                <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-xl bg-[#0A2558] text-amber-400 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 animate-pulse" />
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 px-4 py-3 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-2.5">
                <RefreshCw className="h-4 w-4 animate-spin text-[#D97706]" />
                <span>
                  Checking records and workflow guidance for{" "}
                  <strong>{caller.roleLabel}</strong>...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer Area: Optional Starter Prompts + Auto-Expanding Textarea */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 px-3.5 py-3 sm:px-5 sm:py-3.5 space-y-2.5">
          {/* Subtle Starter Prompt Chips + Optional Topic Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0 mr-0.5">
                Try asking:
              </span>
              {starterPrompts.slice(0, 5).map((q) => (
                <button
                  key={q.id}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void handleSendMessage(q.prompt)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#D97706] hover:text-[#0A2558] dark:hover:text-amber-400 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#D97706] shrink-0" />
                  <span>{q.label}</span>
                </button>
              ))}
            </div>

            {/* Compact Optional Category Filter (All topics default) */}
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <Filter className="w-3 h-3 text-slate-400" />
              <label
                htmlFor="ai-topic-filter"
                className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                Topic:
              </label>
              <select
                id="ai-topic-filter"
                aria-label="Optional topic filter"
                value={selectedTopic}
                onChange={(e) =>
                  setSelectedTopic(e.target.value as AssistantTopicFilterId)
                }
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-[#0A2558] dark:focus:border-amber-400"
              >
                {topicOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multiline Auto-Expanding Composer Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="flex items-end gap-2.5"
          >
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                rows={1}
                aria-label="Ask ABLEBIZ AI Secretary"
                placeholder="Ask anything about ABLEBIZ SUITE, reports, workflows, or how to complete a task..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                disabled={isProcessing}
                className="ai-prompt-textarea rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0A2558] dark:focus:border-amber-400 focus:ring-2 focus:ring-[#0A2558]/15 disabled:opacity-50 transition-colors"
              />
            </div>

            <button
              type="submit"
              aria-label="Send message"
              disabled={!inputText.trim() || isProcessing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2558] hover:bg-[#061738] text-white px-4 py-2.5 min-h-[2.75rem] text-sm font-bold disabled:opacity-50 shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <span>Send</span>
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span>
              Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for a new line. You can ask about any topic at any time.
            </span>
            <span>
              Read-only assistant • Role Scope: <strong>{caller.roleLabel}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiSecretaryPage;
