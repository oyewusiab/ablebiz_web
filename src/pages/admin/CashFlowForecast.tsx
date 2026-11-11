import { useEffect, useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building2,
  Receipt,
  FileCheck2,
  CreditCard,
  Sliders,
  Download,
  Info,
  X,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  generateCashFlowForecast,
  calculateCurrentCashPosition,
  calculateBudgetVsActual,
  fetchCashFlowDataset,
  DEFAULT_SCENARIOS,
  CashFlowForecastResult,
  CashFlowScenarioConfig,
  ProjectedExpenseRecord,
  FinancialBudgetRecord,
} from "../../lib/cashFlow/cashFlowService";

export function CashFlowForecastPage() {
  const { profile, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<{
    payments: any[];
    expenses: any[];
    invoices: any[];
    serviceRequests: any[];
    servicesCatalog: any[];
    projectedExpenses: ProjectedExpenseRecord[];
    budgets: FinancialBudgetRecord[];
  } | null>(null);

  // Active Horizon Tab & Main Section Tab
  const [activeTab, setActiveTab] = useState<"forecast" | "collections" | "expenses" | "budget">("forecast");
  const [selectedHorizon, setSelectedHorizon] = useState<"30d" | "60d" | "90d" | "180d">("30d");

  // Scenarios
  const [scenarioMode, setScenarioMode] = useState<"expected" | "conservative" | "optimistic" | "custom">("expected");
  const [customScenario, setCustomScenario] = useState<CashFlowScenarioConfig>({
    name: "custom",
    label: "Custom Scenario",
    collectionRatePercent: 80,
    collectionDelayDays: 7,
    expenseMultiplierPercent: 105,
    pipelineConversionRatePercent: 40,
  });

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseFormData, setExpenseFormData] = useState({
    category: "rent",
    description: "",
    amount: 0,
    expected_payment_date: new Date().toISOString().split("T")[0],
    recurrence: "none" as const,
    responsible_officer_id: "",
    notes: "",
  });

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetFormData, setBudgetFormData] = useState({
    period_key: new Date().toISOString().substring(0, 7), // 'YYYY-MM'
    category_type: "expense" as "income" | "expense",
    category_name: "Staff Salaries",
    budgeted_amount: 0,
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManageFinance =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "create") ||
    hasPermission("finance", "edit");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchCashFlowDataset();
      setDataset(data);
    } catch (err) {
      console.error("[CashFlowForecast] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Determine active scenario config
  const activeScenarioConfig = useMemo(() => {
    if (scenarioMode === "custom") return customScenario;
    return DEFAULT_SCENARIOS[scenarioMode] || DEFAULT_SCENARIOS.expected;
  }, [scenarioMode, customScenario]);

  // Compute Current Recorded Cash Position
  const currentCashPosition = useMemo(() => {
    if (!dataset) return 0;
    return calculateCurrentCashPosition(dataset.payments, dataset.expenses, 0);
  }, [dataset]);

  // Generate Forecast
  const forecast: CashFlowForecastResult | null = useMemo(() => {
    if (!dataset) return null;
    return generateCashFlowForecast({
      currentCashPosition,
      invoices: dataset.invoices,
      serviceRequests: dataset.serviceRequests,
      servicesCatalog: dataset.servicesCatalog,
      projectedExpenses: dataset.projectedExpenses,
      scenarioConfig: activeScenarioConfig,
      safeReserveThreshold: 500_000,
      referenceNow: new Date(),
    });
  }, [dataset, currentCashPosition, activeScenarioConfig]);

  // Compute Budget vs Actual for current month
  const currentMonthKey = new Date().toISOString().substring(0, 7);
  const budgetVsActual = useMemo(() => {
    if (!dataset) return null;
    return calculateBudgetVsActual({
      periodKey: currentMonthKey,
      budgets: dataset.budgets,
      payments: dataset.payments,
      expenses: dataset.expenses,
    });
  }, [dataset, currentMonthKey]);

  // Save Projected Expense
  const handleSaveProjectedExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseFormData.amount <= 0 || !expenseFormData.description.trim()) {
      setFeedbackMsg({ type: "error", text: "Please enter a valid description and amount greater than zero." });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from("projected_expenses").insert({
        category: expenseFormData.category,
        description: expenseFormData.description.trim(),
        amount: Number(expenseFormData.amount),
        expected_payment_date: expenseFormData.expected_payment_date,
        recurrence: expenseFormData.recurrence,
        responsible_officer_id: expenseFormData.responsible_officer_id || null,
        notes: expenseFormData.notes || null,
        created_by: profile?.id || null,
      });

      if (error) throw error;

      setFeedbackMsg({ type: "success", text: "Projected expense recorded successfully." });
      setIsExpenseModalOpen(false);
      setExpenseFormData({
        category: "rent",
        description: "",
        amount: 0,
        expected_payment_date: new Date().toISOString().split("T")[0],
        recurrence: "none",
        responsible_officer_id: "",
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      console.error("[CashFlowForecast] Create projected expense error:", err);
      setFeedbackMsg({ type: "error", text: err?.message || "Could not save projected expense." });
    } finally {
      setSubmitting(false);
    }
  };

  // Save Budget
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (budgetFormData.budgeted_amount <= 0 || !budgetFormData.category_name.trim()) {
      setFeedbackMsg({ type: "error", text: "Please enter a valid category name and budget amount." });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from("financial_budgets").upsert(
        {
          period_key: budgetFormData.period_key,
          category_type: budgetFormData.category_type,
          category_name: budgetFormData.category_name.trim(),
          budgeted_amount: Number(budgetFormData.budgeted_amount),
          notes: budgetFormData.notes || null,
          created_by: profile?.id || null,
        },
        { onConflict: "period_key,category_type,category_name" }
      );

      if (error) throw error;

      setFeedbackMsg({ type: "success", text: "Financial budget saved successfully." });
      setIsBudgetModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("[CashFlowForecast] Create budget error:", err);
      setFeedbackMsg({ type: "error", text: err?.message || "Could not save budget." });
    } finally {
      setSubmitting(false);
    }
  };

  const formatNgn = (val: number) => `₦${Math.round(val || 0).toLocaleString()}`;

  // Get active horizon summary
  const activeHorizonSummary = useMemo(() => {
    if (!forecast) return null;
    if (selectedHorizon === "30d") return forecast.horizon30Days;
    if (selectedHorizon === "60d") return forecast.horizon60Days;
    if (selectedHorizon === "90d") return forecast.horizon90Days;
    return forecast.horizon180Days;
  }, [forecast, selectedHorizon]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md w-fit mb-2 border border-blue-200">
            <DollarSign className="w-3.5 h-3.5" />
            Treasury & Financial Planning
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Cash Flow Forecasting & Financial Planning
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Anticipate future cash positions, forecast invoice collections, schedule recurring operational disbursements, and stress-test financial scenarios.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canManageFinance && (
            <>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Projected Expense
              </button>
              <button
                onClick={() => setIsBudgetModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-sm"
              >
                <Sliders className="w-4 h-4" />
                Set Budget
              </button>
            </>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Shortage Risk Warning Banner */}
      {forecast && forecast.shortageWarnings.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-rose-900 text-sm">
                Treasury Alert: Projected Cash Deficit or Reserve Depletion
              </h3>
              {forecast.shortageWarnings.map((w, idx) => (
                <div key={idx} className="text-xs text-rose-800">
                  • <span className="font-bold">{w.periodLabel}:</span> Closing cash projected at{" "}
                  <span className="font-black">{formatNgn(w.projectedClosingBalance)}</span> (₦{w.deficitAmount.toLocaleString()} below safety reserve). {w.suggestedAction}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Cards */}
      {forecast && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Current Cash Position</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNgn(forecast.currentCashPosition)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Verified receipts less recorded expenses
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Expected Collections (30d)</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNgn(forecast.horizon30Days.expectedCollections)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              From outstanding invoices ({forecast.scenario.collectionRatePercent}% assumed)
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Projected Expenses (30d)</span>
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNgn(forecast.horizon30Days.projectedExpenses)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Rent, payroll, utilities & subscriptions
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Projected Closing (30d)</span>
              <CreditCard className="w-4 h-4 text-purple-600" />
            </div>
            <div
              className={`text-2xl font-black ${
                forecast.horizon30Days.projectedClosingBalance >= forecast.safeReserveThreshold
                  ? "text-emerald-700"
                  : forecast.horizon30Days.projectedClosingBalance >= 0
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {formatNgn(forecast.horizon30Days.projectedClosingBalance)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Net movement:{" "}
              <span className="font-semibold text-slate-700">
                {forecast.horizon30Days.netCashFlow >= 0 ? "+" : ""}
                {formatNgn(forecast.horizon30Days.netCashFlow)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Planning Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Scenario Analysis Planning Mode:
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setScenarioMode("expected")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                scenarioMode === "expected"
                  ? "bg-[#061738] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Expected (Baseline)
            </button>
            <button
              onClick={() => setScenarioMode("conservative")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                scenarioMode === "conservative"
                  ? "bg-rose-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Conservative (Stress Test)
            </button>
            <button
              onClick={() => setScenarioMode("optimistic")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                scenarioMode === "optimistic"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Optimistic (Growth)
            </button>
            <button
              onClick={() => setScenarioMode("custom")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                scenarioMode === "custom"
                  ? "bg-purple-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Custom Assumptions
            </button>
          </div>
        </div>

        {scenarioMode === "custom" && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">
                Collection Rate: {customScenario.collectionRatePercent}%
              </label>
              <input
                type="range"
                min="40"
                max="100"
                step="5"
                value={customScenario.collectionRatePercent}
                onChange={(e) =>
                  setCustomScenario({ ...customScenario, collectionRatePercent: Number(e.target.value) })
                }
                className="w-full accent-purple-600"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">
                Collection Delay: {customScenario.collectionDelayDays} days
              </label>
              <input
                type="range"
                min="0"
                max="30"
                step="7"
                value={customScenario.collectionDelayDays}
                onChange={(e) =>
                  setCustomScenario({ ...customScenario, collectionDelayDays: Number(e.target.value) })
                }
                className="w-full accent-purple-600"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">
                Expense Multiplier: {customScenario.expenseMultiplierPercent}%
              </label>
              <input
                type="range"
                min="80"
                max="130"
                step="5"
                value={customScenario.expenseMultiplierPercent}
                onChange={(e) =>
                  setCustomScenario({ ...customScenario, expenseMultiplierPercent: Number(e.target.value) })
                }
                className="w-full accent-purple-600"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">
                Pipeline Conversion: {customScenario.pipelineConversionRatePercent}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={customScenario.pipelineConversionRatePercent}
                onChange={(e) =>
                  setCustomScenario({ ...customScenario, pipelineConversionRatePercent: Number(e.target.value) })
                }
                className="w-full accent-purple-600"
              />
            </div>
          </div>
        )}

        {/* Scenario Comparison Summary */}
        {forecast && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 flex-wrap gap-2">
            <span className="text-slate-500">
              Scenario 30d Closing Comparison:
            </span>
            <div className="flex items-center gap-4">
              <span>
                Expected:{" "}
                <span className="font-bold text-slate-800">
                  {formatNgn(forecast.scenarioComparisons.expectedClosingBalance30d)}
                </span>
              </span>
              <span>
                Conservative:{" "}
                <span className="font-bold text-rose-700">
                  {formatNgn(forecast.scenarioComparisons.conservativeClosingBalance30d)}
                </span>
              </span>
              <span>
                Optimistic:{" "}
                <span className="font-bold text-emerald-700">
                  {formatNgn(forecast.scenarioComparisons.optimisticClosingBalance30d)}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("forecast")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "forecast" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Forecast Horizon
        </button>
        <button
          onClick={() => setActiveTab("collections")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "collections" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Expected Collections ({forecast?.expectedCollections.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "expenses" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Projected Expenses ({dataset?.projectedExpenses.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("budget")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "budget" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Budget vs Actual ({currentMonthKey})
        </button>
      </div>

      {/* TAB 1: FORECAST HORIZON */}
      {activeTab === "forecast" && forecast && activeHorizonSummary && (
        <div className="space-y-6">
          {/* Horizon Selector */}
          <div className="flex items-center gap-2">
            {(["30d", "60d", "90d", "180d"] as const).map((h) => (
              <button
                key={h}
                onClick={() => setSelectedHorizon(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  selectedHorizon === h
                    ? "bg-[#061738] text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {h === "30d" ? "Next 30 Days" : h === "60d" ? "Next 60 Days" : h === "90d" ? "Next 90 Days" : "Next 180 Days"}
              </button>
            ))}
          </div>

          {/* Active Horizon Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{activeHorizonSummary.periodLabel} Overview</h3>
                <div className="text-xs text-slate-500">
                  Window: {activeHorizonSummary.startDate} to {activeHorizonSummary.endDate}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Projected Closing Balance</span>
                <span className="text-xl font-black text-emerald-700">
                  {formatNgn(activeHorizonSummary.projectedClosingBalance)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Opening Cash:</span>
                <span className="font-bold text-slate-900 text-sm">{formatNgn(activeHorizonSummary.openingBalance)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Expected Collections:</span>
                <span className="font-bold text-emerald-700 text-sm">+{formatNgn(activeHorizonSummary.expectedCollections)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Projected Expenses:</span>
                <span className="font-bold text-rose-700 text-sm">-{formatNgn(activeHorizonSummary.projectedExpenses)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Net Cash Movement:</span>
                <span className={`font-bold text-sm ${activeHorizonSummary.netCashFlow >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {activeHorizonSummary.netCashFlow >= 0 ? "+" : ""}{formatNgn(activeHorizonSummary.netCashFlow)}
                </span>
              </div>
            </div>
          </div>

          {/* Weekly Breakdown */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base mb-4">Weekly Rolling Cash Progression (Next 8 Weeks)</h3>
            <div className="space-y-3">
              {forecast.weeklyBreakdown.map((w) => (
                <div
                  key={w.periodKey}
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                    w.hasShortageRisk ? "bg-rose-50/50 border-rose-200" : "bg-slate-50/80 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 text-sm w-16">{w.periodLabel}</span>
                    <span className="text-[11px] text-slate-500">
                      {w.startDate} - {w.endDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Inflows</span>
                      <span className="font-semibold text-emerald-700">+{formatNgn(w.totalProjectedInflow)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Disbursements</span>
                      <span className="font-semibold text-rose-700">-{formatNgn(w.projectedExpenses)}</span>
                    </div>
                    <div className="text-right w-28">
                      <span className="text-slate-400 block text-[10px]">Closing Cash</span>
                      <span className={`font-black ${w.hasShortageRisk ? "text-rose-600" : "text-slate-900"}`}>
                        {formatNgn(w.projectedClosingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPECTED COLLECTIONS */}
      {activeTab === "collections" && forecast && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Outstanding Invoices Scheduled for Collection</h3>
              <p className="text-xs text-slate-500">
                Only unpaid and partially-paid invoices with an outstanding balance are included.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200">
              Total Outstanding: {formatNgn(forecast.expectedCollections.reduce((sum, c) => sum + c.balanceDue, 0))}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4 text-right">Invoice Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Expected Date</th>
                  <th className="py-3 px-4 text-center">Confidence</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {forecast.expectedCollections.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No outstanding receivables currently awaiting collection.
                    </td>
                  </tr>
                ) : (
                  forecast.expectedCollections.map((item) => (
                    <tr key={item.invoiceId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {item.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {item.clientName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                        {formatNgn(item.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-medium">
                        {formatNgn(item.amountPaid)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">
                        {formatNgn(item.balanceDue)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.dueDate}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-blue-700">
                        {item.expectedPaymentDate}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.collectionConfidence === "high"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.collectionConfidence === "standard"
                              ? "bg-blue-100 text-blue-800"
                              : item.collectionConfidence === "at_risk"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.collectionConfidence.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.isOverdue
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.isOverdue ? "Overdue" : "On Track"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROJECTED EXPENSES */}
      {activeTab === "expenses" && dataset && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Scheduled & Projected Operational Disbursements</h3>
              <p className="text-xs text-slate-500">
                Track future rent, salaries, software subscriptions, statutory charges, and utilities.
              </p>
            </div>
            {canManageFinance && (
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Future Expense
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Expected Date</th>
                  <th className="py-3 px-4">Recurrence</th>
                  <th className="py-3 px-4">Responsible Officer</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {dataset.projectedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No future projected expenses recorded yet. Click "Add Future Expense" to budget ahead.
                    </td>
                  </tr>
                ) : (
                  dataset.projectedExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold capitalize text-slate-900">
                        {exp.category.replace(/_/g, " ")}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {exp.description}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-rose-700">
                        {formatNgn(exp.amount)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {exp.expected_payment_date}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-slate-600">
                        {exp.recurrence}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {exp.responsible_officer?.full_name || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                          {exp.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BUDGET VS ACTUAL */}
      {activeTab === "budget" && budgetVsActual && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Monthly Performance: {currentMonthKey}</h3>
                <div className="text-xs text-slate-500">
                  Comparison of budgeted income and expenditure against actual bank receipts and disbursed expenses.
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Net Surplus Variance</span>
                <span className={`text-xl font-black ${budgetVsActual.surplusVariance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {budgetVsActual.surplusVariance >= 0 ? "+" : ""}{formatNgn(budgetVsActual.surplusVariance)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Budgeted Revenue:</span>
                <span className="font-bold text-slate-900 text-sm">{formatNgn(budgetVsActual.totalBudgetedIncome)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Actual Cash Revenue:</span>
                <span className="font-bold text-emerald-700 text-sm">{formatNgn(budgetVsActual.totalActualIncome)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Budgeted Expenses:</span>
                <span className="font-bold text-slate-900 text-sm">{formatNgn(budgetVsActual.totalBudgetedExpense)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Actual Expenses:</span>
                <span className="font-bold text-rose-700 text-sm">{formatNgn(budgetVsActual.totalActualExpense)}</span>
              </div>
            </div>

            {budgetVsActual.insights.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
                <div className="font-bold">Budget Insights & Variances:</div>
                {budgetVsActual.insights.map((ins, idx) => (
                  <div key={idx}>• {ins}</div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Line Item / Category</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Budgeted Target</th>
                  <th className="py-3 px-4 text-right">Actual Incurred</th>
                  <th className="py-3 px-4 text-right">Variance Amount</th>
                  <th className="py-3 px-4 text-right">Variance %</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {budgetVsActual.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.categoryName}</td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{item.categoryType}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600">{formatNgn(item.budgetedAmount)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{formatNgn(item.actualAmount)}</td>
                    <td className="py-3 px-4 text-right font-black">
                      <span className={item.varianceAmount >= 0 ? "text-emerald-700" : "text-rose-600"}>
                        {item.varianceAmount >= 0 ? "+" : ""}{formatNgn(item.varianceAmount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold">{item.variancePercent}%</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "on_track"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE PROJECTED EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Record Projected Future Expense</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProjectedExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={expenseFormData.category}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="rent">Office Rent</option>
                  <option value="salaries">Staff Salaries & Allowances</option>
                  <option value="utilities">Utilities & Power</option>
                  <option value="internet">Internet & Communication</option>
                  <option value="software_subscription">Software & Tool Subscriptions</option>
                  <option value="taxes_statutory">Taxes & Statutory Fees</option>
                  <option value="marketing">Marketing & Promotions</option>
                  <option value="office_supplies">Office Supplies</option>
                  <option value="other">Other Operational Expense</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Main Office Rent Renewal"
                  value={expenseFormData.description}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (NGN) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={expenseFormData.amount || ""}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseFormData.expected_payment_date}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, expected_payment_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recurrence Schedule</label>
                  <select
                    value={expenseFormData.recurrence}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, recurrence: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="none">One-time (No recurrence)</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsible Officer</label>
                  <select
                    value={expenseFormData.responsible_officer_id}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, responsible_officer_id: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {dataset?.projectedExpenses &&
                      dataset.projectedExpenses.map((exp) =>
                        exp.responsible_officer ? (
                          <option key={exp.id} value={exp.responsible_officer_id || ""}>
                            {exp.responsible_officer.full_name}
                          </option>
                        ) : null
                      )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Budget Justification</label>
                <textarea
                  rows={2}
                  placeholder="Optional background details or contract notes"
                  value={expenseFormData.notes}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#061738] hover:bg-[#0a2355] text-white font-semibold rounded-lg shadow-sm"
                >
                  {submitting ? "Saving..." : "Save Projected Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BUDGET MODAL */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Configure Financial Budget</h3>
              <button onClick={() => setIsBudgetModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Period (YYYY-MM) *</label>
                  <input
                    type="month"
                    required
                    value={budgetFormData.period_key}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, period_key: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Type *</label>
                  <select
                    value={budgetFormData.category_type}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, category_type: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="income">Income Target</option>
                    <option value="expense">Expense Limit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category / Line Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staff Salaries or Business Registration Revenue"
                  value={budgetFormData.category_name}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, category_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Budgeted Amount (NGN) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={budgetFormData.budgeted_amount || ""}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, budgeted_amount: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional planning notes"
                  value={budgetFormData.notes}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm"
                >
                  {submitting ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
