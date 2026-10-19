import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Briefcase,
  Clock,
  DollarSign,
  Gift,
  HelpCircle,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  AssistantResponsePayload,
  ConversationContext,
} from "../../lib/aiSecretary/types";
import {
  buildCallerContext,
  CAPABILITY_CATALOGUE_VERSION,
} from "../../lib/aiSecretary/capabilityCatalogue";
import { getRoleAwareSuggestionGroups } from "../../lib/aiSecretary/suggestions";
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

export function AiSecretaryPage() {
  const { user, role, userName } = useAuth();

  const caller = useMemo(
    () =>
      buildCallerContext({
        role,
        userId: user?.id || null,
        userName: userName || user?.email?.split("@")[0] || "Staff",
        email: user?.email || null,
      }),
    [role, user?.id, user?.email, userName]
  );

  const suggestionGroups = useMemo(
    () => getRoleAwareSuggestionGroups(caller),
    [caller]
  );

  const [activeGroupId, setActiveGroupId] = useState<string>(
    suggestionGroups[0]?.id || "management"
  );
  const [conversationContext, setConversationContext] =
    useState<ConversationContext>({
      turnCount: 0,
    });

  const buildWelcomeMessage = (): ChatMessage => ({
    id: "welcome-1",
    sender: "ai",
    text: [
      `### Welcome, ${caller.userName}!`,
      `I am your **ABLEBIZ AI Secretary** — your role-aware operational intelligence and Suite Guide assistant.`,
      `- **Operational Reports:** Ask for verified database figures, overdue tasks, CAC filing bottlenecks, upcoming staff leave schedules (e.g., *"next three weeks"*), CRM leads, referrals, or financial reconciliations.`,
      `- **Suite Guide & Troubleshooting:** Ask step-by-step *"How do I..."* questions, check why a button is restricted for your role (**${caller.roleLabel}**), or troubleshoot a failed operation.`,
      `Select a suggested prompt below by category or type any question directly.`,
    ].join("\n\n"),
    timestamp: new Date(),
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildWelcomeMessage(),
  ]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      suggestionGroups.length > 0 &&
      !suggestionGroups.some((g) => g.id === activeGroupId)
    ) {
      setActiveGroupId(suggestionGroups[0].id);
    }
  }, [suggestionGroups, activeGroupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsProcessing(true);

    try {
      const { payload, updatedContext } = await executeAssistantQuery(
        trimmed,
        caller,
        conversationContext
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
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: `### Query Execution Error\n\nAn unexpected error occurred while processing your request: \`${err?.message || "Unknown error"}\`. Please try again.`,
        timestamp: new Date(),
        queryPrompt: trimmed,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetConversation = () => {
    setConversationContext({ turnCount: 0 });
    setMessages([buildWelcomeMessage()]);
    setInputText("");
  };

  const activeGroup =
    suggestionGroups.find((g) => g.id === activeGroupId) || suggestionGroups[0];

  const renderGroupIcon = (iconName: string) => {
    switch (iconName) {
      case "ShieldCheck":
        return <ShieldCheck className="w-3.5 h-3.5" />;
      case "Briefcase":
        return <Briefcase className="w-3.5 h-3.5" />;
      case "DollarSign":
        return <DollarSign className="w-3.5 h-3.5" />;
      case "Gift":
        return <Gift className="w-3.5 h-3.5" />;
      case "Users":
        return <Users className="w-3.5 h-3.5" />;
      case "BookOpen":
        return <BookOpen className="w-3.5 h-3.5" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                Read-Only Grounded
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Suite Guide v{CAPABILITY_CATALOGUE_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Operational database intelligence, workflow guidance, and RBAC troubleshooting across all verified ABLEBIZ SUITE modules
            </p>
          </div>
        </div>

        {/* Role & Timezone Indicator + Reset */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Role Scope:{" "}
              <strong className="text-[#0A2558] dark:text-amber-400">
                {caller.roleLabel}
              </strong>
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-[#D97706]" />
            <span>{ABILITY_TIMEZONE}</span>
          </div>

          <button
            type="button"
            onClick={handleResetConversation}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
            title="Clear conversation history and context"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Main Assistant Container */}
      <div className="flex flex-col min-h-[680px] max-h-[82vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Role-Aware Contextual Suggestion Categories Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {suggestionGroups.map((group) => {
                const isActive = group.id === activeGroup?.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveGroupId(group.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      isActive
                        ? "bg-[#0A2558] text-white shadow-2xs"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    {renderGroupIcon(group.iconName)}
                    <span>{group.label}</span>
                  </button>
                );
              })}
            </div>

            {conversationContext.lastModuleId && (
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                Active Context:{" "}
                <strong className="text-slate-600 dark:text-slate-300">
                  {conversationContext.lastModuleId.replace(/_/g, " ")}
                </strong>
              </span>
            )}
          </div>

          {/* Active Category Prompt Chips */}
          {activeGroup && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeGroup.questions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleSendMessage(q.prompt)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#D97706] hover:text-[#0A2558] dark:hover:text-amber-400 shadow-2xs transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-[#D97706] shrink-0" />
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
                    <p className="text-sm font-medium leading-relaxed">
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
                    onSelectFollowUp={(prompt) => handleSendMessage(prompt)}
                    onRetry={
                      msg.queryPrompt
                        ? () => handleSendMessage(msg.queryPrompt!)
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
                  Verifying live records and workflow rules under{" "}
                  <strong>{caller.roleLabel}</strong> scope...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-3.5 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2.5"
          >
            <input
              type="text"
              aria-label="Ask ABLEBIZ AI Secretary"
              placeholder="Ask about CAC filings, staff leave in the next 3 weeks, overdue invoices, or 'How do I create a quotation?'..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0A2558] dark:focus:border-amber-400 focus:ring-2 focus:ring-[#0A2558]/15 disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2558] hover:bg-[#061738] text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
            >
              <span>Ask</span>
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Read-only operational & Suite Guide assistant. Grounded in live Supabase tables (`{ABILITY_TIMEZONE}`). Never executes unauthorized database writes.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AiSecretaryPage;
