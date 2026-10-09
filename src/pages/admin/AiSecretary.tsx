import { useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  DollarSign,
  UserCheck,
  Building2,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { getRoleTitle } from "../../auth/roleConfig";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  dataCitations?: string[];
}

export function AiSecretaryPage() {
  const { profile, hasPermission } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "ai",
      text: `Good day, ${profile?.full_name || "Manager"}! I am your **ABLEBIZ AI Secretary**.\n\nI am grounded directly in live ABLEBIZ operational and client records, maintaining strict read-only security and respecting your role as **${getRoleTitle(profile?.role)}**.\n\nHow may I assist your management oversight today?`,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const isSuper = profile?.role === "super_admin" || profile?.role === "admin";
  const canViewFinance =
    isSuper ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "view");

  const canViewOps =
    isSuper ||
    profile?.role === "operations_manager" ||
    profile?.role === "registration_officer" ||
    hasPermission("operations", "view");

  // Prompt suggestions
  const quickChips = [
    { label: "What requires attention today?", prompt: "What requires management attention today?" },
    { label: "Overdue CAC applications", prompt: "Which CAC applications are currently overdue or pending review?" },
    ...(canViewFinance
      ? [{ label: "Financial summary", prompt: "Summarize our financial collections, invoices, and outstanding receivables." }]
      : []),
    { label: "Overdue tasks", prompt: "Which operational tasks are overdue or pending completion?" },
    { label: "Client acquisition stats", prompt: "How many active clients and businesses are currently registered?" },
  ];

  // Grounded Answer Engine (Role-aware query execution without autonomous mutations)
  const processQuery = async (query: string): Promise<{ reply: string; citations: string[] }> => {
    const q = query.toLowerCase();
    const citations: string[] = [];

    try {
      // 1. Attention & Exceptions
      if (q.includes("attention") || q.includes("today") || q.includes("urgent")) {
        const [tasksRes, cacRes, invRes] = await Promise.all([
          supabase.from("tasks").select("id, title, due_date, status, priority").neq("status", "completed"),
          supabase.from("cac_applications").select("id, current_stage, proposed_name_1, updated_at").not("current_stage", "in", '("completed","cancelled")'),
          canViewFinance ? supabase.from("invoices").select("id, invoice_number, balance_due, due_date, status").gt("balance_due", 0) : Promise.resolve({ data: [] }),
        ]);

        const now = new Date();
        const overdueTasks = (tasksRes.data || []).filter((t: any) => t.due_date && new Date(t.due_date) < now);
        const overdueInvoices = (invRes.data || []).filter((i: any) => i.due_date && new Date(i.due_date) < now);

        citations.push(`tasks: ${tasksRes.data?.length || 0} active`, `cac_applications: ${cacRes.data?.length || 0} active`);
        if (canViewFinance) citations.push(`invoices: ${invRes.data?.length || 0} unpaid`);

        let response = `### 📋 Management Attention Summary for Today\n\n`;
        response += `Based on live records:\n\n`;
        response += `- **Overdue Tasks:** **${overdueTasks.length}** operational tasks require officer intervention.\n`;
        response += `- **Active CAC Applications:** **${cacRes.data?.length || 0}** filings currently progressing through the 11-stage workflow.\n`;

        if (canViewFinance) {
          response += `- **Overdue Invoices:** **${overdueInvoices.length}** client invoices have passed their contractual payment due date.\n`;
        }

        response += `\n**Recommended Next Action:** Check the **[Overdue Tasks](/admin/tasks)** and **[CAC Operations Workbench](/admin/cac-operations)**.`;
        return { reply: response, citations };
      }

      // 2. CAC Operations
      if (q.includes("cac") || q.includes("application") || q.includes("filing")) {
        if (!canViewOps) {
          return {
            reply: "Your assigned role does not permit access to operational CAC filing details.",
            citations: ["Role authorization gate"],
          };
        }

        const { data: cacApps } = await supabase
          .from("cac_applications")
          .select("id, current_stage, proposed_name_1, approved_name, created_at")
          .order("created_at", { ascending: false });

        citations.push(`cac_applications: ${cacApps?.length || 0} records`);

        const total = cacApps?.length || 0;
        const active = cacApps?.filter((c) => !["completed", "rejected", "cancelled"].includes(c.current_stage)).length || 0;
        const completed = cacApps?.filter((c) => c.current_stage === "completed").length || 0;

        return {
          reply: `### 🏛️ CAC Operations Status\n\n- **Total Applications on Record:** **${total}**\n- **Currently In Progress:** **${active}**\n- **Completed & Certificates Received:** **${completed}**\n\nYou can review individual stage progress directly in the **[CAC Operations Workspace](/admin/cac-operations)**.`,
          citations,
        };
      }

      // 3. Financial Summary
      if (q.includes("finance") || q.includes("invoice") || q.includes("revenue") || q.includes("payment") || q.includes("receivable") || q.includes("money") || q.includes("profit")) {
        if (!canViewFinance) {
          return {
            reply: `I apologize, but financial metrics (invoices, collections, and disbursements) are restricted to authorized **Accounts Officers** and **Executive Management**. Your role (${getRoleTitle(profile?.role)}) cannot view revenue data.`,
            citations: ["Financial RBAC guard"],
          };
        }

        const [invRes, payRes, expRes] = await Promise.all([
          supabase.from("invoices").select("total_amount, amount_paid, balance_due, due_date, status"),
          supabase.from("payments").select("amount"),
          supabase.from("expenses").select("amount"),
        ]);

        const totalInvoiced = (invRes.data || []).reduce((acc: number, i: any) => acc + (Number(i.total_amount) || 0), 0);
        const totalCollected = (payRes.data || []).reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
        const outstanding = (invRes.data || []).reduce((acc: number, i: any) => acc + (Number(i.balance_due) || 0), 0);
        const totalExpenses = (expRes.data || []).reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);
        const netOperatingMargin = totalCollected - totalExpenses;

        citations.push(
          `invoices: ${invRes.data?.length || 0} records`,
          `payments: ${payRes.data?.length || 0} verified receipts`,
          `expenses: ${expRes.data?.length || 0} disbursements`
        );

        return {
          reply: `### 💰 Financial Health & Balance Ledger\n\n- **Total Invoiced:** ₦**${totalInvoiced.toLocaleString()}**\n- **Reconciled Collections (Revenue):** ₦**${totalCollected.toLocaleString()}**\n- **Outstanding Receivables:** ₦**${outstanding.toLocaleString()}**\n- **Recorded Operating Expenses:** ₦**${totalExpenses.toLocaleString()}**\n- **Net Operating Margin (Cash Collected − Expenses):** ₦**${netOperatingMargin.toLocaleString()}**\n\n*Note: Outstanding receivables are contractually billed but not yet received in our official settlement account.*`,
          citations,
        };
      }

      // 4. Clients & Businesses
      if (q.includes("client") || q.includes("business") || q.includes("customer")) {
        const [cRes, bRes] = await Promise.all([
          supabase.from("clients").select("id, is_active", { count: "exact" }),
          supabase.from("businesses").select("id, entity_type", { count: "exact" }),
        ]);

        citations.push(`clients: ${cRes.count || 0}`, `businesses: ${bRes.count || 0}`);

        return {
          reply: `### 👥 Client & Enterprise Directory\n\n- **Total Registered Clients:** **${cRes.count || 0}**\n- **Registered Client Businesses:** **${bRes.count || 0}**\n\nEvery client is tracked under the **[Client 360° Directory](/admin/clients)**.`,
          citations,
        };
      }

      // 5. Tasks
      if (q.includes("task") || q.includes("overdue")) {
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .order("due_date", { ascending: true });

        const now = new Date();
        const pending = tasksData?.filter((t) => t.status !== "completed") || [];
        const overdue = pending.filter((t) => t.due_date && new Date(t.due_date) < now);

        citations.push(`tasks: ${tasksData?.length || 0} records`);

        return {
          reply: `### ⏱️ Operational Task SLA\n\n- **Total Active Pending Tasks:** **${pending.length}**\n- **Overdue SLA Deadlines:** **${overdue.length}**\n\nYou can delegate and inspect comments in the **[Task Management Center](/admin/tasks)**.`,
          citations,
        };
      }

      // Generic Grounded Response
      return {
        reply: `I understand your inquiry. As an authoritative management assistant, I can provide grounded insights on:\n\n1. **Management Attention Today** (Overdue deadlines, pending reviews)\n2. **CAC Operations & Stage Health**\n3. **Financial Balances & Collections** (for authorized roles)\n4. **Client & Business Directory Counts**\n5. **Task SLA Management**\n\nPlease select one of the quick prompt suggestions or ask a specific question.`,
        citations: ["System core grounding"],
      };
    } catch (err: any) {
      console.error("[AI Secretary] Query error:", err);
      return {
        reply: "I encountered a query resolution error while communicating with the database. Please verify your connection.",
        citations: [],
      };
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsProcessing(true);

    const { reply, citations } = await processQuery(textToSend);

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: "ai",
      text: reply,
      timestamp: new Date(),
      dataCitations: citations,
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">ABLEBIZ AI Secretary</h1>
                <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Read-Only Grounded
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Management decision assistant grounded strictly in live database records
              </p>
            </div>
          </div>
        </div>

        {/* Security / Role indicator */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Role Scope: <strong>{getRoleTitle(profile?.role)}</strong></span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex flex-col h-[650px] rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs leading-relaxed ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender === "ai" && (
                <div className="h-7 w-7 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-2xs whitespace-pre-wrap ${
                  msg.sender === "user"
                    ? "bg-[#0A2558] text-white rounded-tr-xs"
                    : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs"
                }`}
              >
                <div>{msg.text}</div>

                {msg.dataCitations && msg.dataCitations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Sparkles className="h-3 w-3 text-purple-500" />
                    <span>Grounded Sources: {msg.dataCitations.join(" • ")}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 text-xs justify-start">
              <div className="h-7 w-7 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                <Bot className="h-4 w-4 animate-pulse" />
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-500 text-[11px] flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-600" />
                Querying authoritative ABLEBIZ operational database...
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="border-t border-slate-100 bg-slate-50/70 p-3 flex gap-2 overflow-x-auto text-[11px]">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(chip.prompt)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-200 bg-white p-3.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask your AI Secretary about deadlines, clients, CAC filings, or financial balances..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="rounded-xl bg-[#0A2558] p-2 text-white hover:bg-[#061738] disabled:opacity-50 shadow-xs transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Read-only analytical model. All numbers reflect actual PostgreSQL transaction balances. Zero autonomous changes.
          </p>
        </div>
      </div>
    </div>
  );
}
