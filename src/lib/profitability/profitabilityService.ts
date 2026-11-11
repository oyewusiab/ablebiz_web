import { supabase } from "../supabaseClient";

export type CostClassification = "actual" | "allocated" | "estimated" | "unallocated";

export interface ServiceProfitabilityRecord {
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  slug: string;
  defaultFeeNgn: number;
  catalogCostEstimate: number;
  
  // Operational Metrics
  completedCount: number;
  activeCount: number;
  totalRequestsCount: number;
  
  // Financial Metrics
  grossBilledRevenue: number;
  discountsGranted: number;
  recognizedServiceRevenue: number;
  verifiedCashCollected: number;
  
  // Cost Metrics
  actualDirectCosts: number;
  allocatedCosts: number;
  estimatedCosts: number;
  totalDirectCosts: number;
  costClassification: CostClassification;
  hasIncompleteCostRecords: boolean;
  costCoveragePercent: number; // % of completed requests that have recorded expenses
  
  // Profitability Metrics
  grossProfit: number;
  grossProfitMarginPercent: number;
  averageRevenuePerCompletedService: number;
  isLossMaking: boolean;
  isLowMargin: boolean; // < 20%
  
  // Traceability
  contributingInvoiceIds: string[];
  contributingExpenseIds: string[];
  contributingServiceRequestIds: string[];
}

export interface ProfitabilityTotals {
  totalServiceRevenue: number;
  totalDirectCosts: number;
  totalGrossProfit: number;
  overallGrossMarginPercent: number;
  totalDiscountsGranted: number;
  totalServicesCompleted: number;
  averageRevenuePerCompletedService: number;
  unallocatedExpensesTotal: number;
  netOperatingSurplusAfterOverhead: number;
  dataCompletenessNotice?: string | null;
}

export interface ProfitabilityTrendPoint {
  periodKey: string; // 'YYYY-MM'
  periodLabel: string;
  revenue: number;
  directCosts: number;
  grossProfit: number;
  marginPercent: number;
  completedCount: number;
}

export interface ServiceProfitabilityAnalysis {
  totals: ProfitabilityTotals;
  services: ServiceProfitabilityRecord[];
  topProfitableServices: ServiceProfitabilityRecord[];
  topRevenueServices: ServiceProfitabilityRecord[];
  lowMarginServices: ServiceProfitabilityRecord[];
  highestDiscountServices: ServiceProfitabilityRecord[];
  lossMakingServices: ServiceProfitabilityRecord[];
  trends: ProfitabilityTrendPoint[];
  unallocatedExpensesCount: number;
  dataLimitations: string[];
}

export interface ServiceProfitabilityFilters {
  startDate?: string | null;
  endDate?: string | null;
  serviceCategory?: string;
  serviceId?: string;
  serviceStatus?: "all" | "completed" | "active";
  responsibleOfficerId?: string;
  periodCadence?: "monthly" | "quarterly" | "yearly";
}

/**
 * Computes Service Profitability and Cost Analysis across the business.
 * Strictly adheres to ABLEBIZ Finance accounting rules:
 * - Revenue is based on recognized invoice snapshots, minus approved discounts.
 * - Direct costs are strictly attributed expenses (actual, allocated, or catalog estimated).
 * - Unallocated expenses are kept distinctly visible rather than artificially spread.
 * - When costs are missing, clearly states that figures are estimated.
 */
export function calculateServiceProfitability(
  catalog: any[],
  serviceRequests: any[],
  invoices: any[],
  invoiceItems: any[],
  expenses: any[],
  filters: ServiceProfitabilityFilters = {}
): ServiceProfitabilityAnalysis {
  const {
    startDate,
    endDate,
    serviceCategory = "all",
    serviceId = "all",
    serviceStatus = "all",
    responsibleOfficerId = "all",
  } = filters;

  // 1. Filter Service Requests by date and parameters
  const filteredRequests = serviceRequests.filter((sr) => {
    if (serviceCategory !== "all" && sr.service_category && sr.service_category.toLowerCase() !== serviceCategory.toLowerCase()) {
      return false;
    }
    if (serviceId !== "all" && sr.service_id !== serviceId) {
      return false;
    }
    if (responsibleOfficerId !== "all" && sr.assigned_staff_id !== responsibleOfficerId) {
      return false;
    }
    if (serviceStatus === "completed" && sr.status !== "completed") {
      return false;
    }
    if (serviceStatus === "active" && sr.status === "completed") {
      return false;
    }
    if (startDate) {
      const created = sr.created_at || sr.target_completion_date;
      if (created && new Date(created) < new Date(startDate)) return false;
    }
    if (endDate) {
      const created = sr.created_at || sr.target_completion_date;
      if (created && new Date(created) > new Date(endDate)) return false;
    }
    return true;
  });

  const requestById = new Map<string, any>();
  for (const sr of filteredRequests) {
    requestById.set(sr.id, sr);
  }

  // 2. Filter Invoices & map to items
  // Exclude cancelled and draft invoices from recognized revenue
  const validInvoices = invoices.filter((inv) => {
    const s = String(inv.status || "").toLowerCase();
    if (s === "cancelled" || s === "draft") return false;
    if (startDate && inv.issue_date && new Date(inv.issue_date) < new Date(startDate)) return false;
    if (endDate && inv.issue_date && new Date(inv.issue_date) > new Date(endDate)) return false;
    return true;
  });

  const invoiceById = new Map<string, any>();
  for (const inv of validInvoices) {
    invoiceById.set(inv.id, inv);
  }

  // 3. Map items to invoices
  const validInvoiceItems = invoiceItems.filter((item) => {
    return item.invoice_id && invoiceById.has(item.invoice_id);
  });

  // 4. Filter Expenses
  const validExpenses = expenses.filter((exp) => {
    if (startDate && exp.expense_date && new Date(exp.expense_date) < new Date(startDate)) return false;
    if (endDate && exp.expense_date && new Date(exp.expense_date) > new Date(endDate)) return false;
    return true;
  });

  // 5. Build Service Line Profitability Records
  const serviceRecords: ServiceProfitabilityRecord[] = [];
  let unallocatedExpensesTotal = 0;
  let unallocatedExpensesCount = 0;

  // Track expenses claimed by services
  const attributedExpenseIds = new Set<string>();

  // Determine target catalog list
  const activeCatalog = catalog.filter((svc) => {
    if (serviceCategory !== "all" && svc.category && svc.category.toLowerCase() !== serviceCategory.toLowerCase()) {
      return false;
    }
    if (serviceId !== "all" && svc.id !== serviceId) {
      return false;
    }
    return true;
  });

  for (const svc of activeCatalog) {
    // A. Service Requests for this service
    const requestsForSvc = filteredRequests.filter((sr) => sr.service_id === svc.id);
    const completedCount = requestsForSvc.filter((sr) => sr.status === "completed").length;
    const activeCount = requestsForSvc.filter((sr) => sr.status !== "completed").length;
    const contributingServiceRequestIds = requestsForSvc.map((sr) => sr.id);
    const svcReqIdSet = new Set(contributingServiceRequestIds);

    // B. Invoice Items for this service
    const itemsForSvc = validInvoiceItems.filter((item) => {
      if (item.service_id === svc.id) return true;
      // Fallback: check linked service_request
      const parentInv = invoiceById.get(item.invoice_id);
      if (parentInv?.service_request_id && svcReqIdSet.has(parentInv.service_request_id)) {
        return true;
      }
      return false;
    });

    let grossBilledRevenue = 0;
    let discountsGranted = 0;
    let verifiedCashCollected = 0;
    const contributingInvoiceIds = new Set<string>();

    for (const item of itemsForSvc) {
      const inv = invoiceById.get(item.invoice_id);
      if (!inv) continue;
      contributingInvoiceIds.add(inv.id);

      const itemTotal = Number(item.total_price || item.unit_price * (item.quantity || 1) || 0);
      grossBilledRevenue += itemTotal;

      // Calculate proportional discount for this item
      const invSubtotal = Number(inv.subtotal || inv.total_amount || 0);
      const invDiscount = Number(inv.discount || 0);
      let itemDiscount = 0;
      if (invSubtotal > 0 && invDiscount > 0) {
        itemDiscount = (itemTotal / invSubtotal) * invDiscount;
      }
      discountsGranted += itemDiscount;

      // Proportional cash collected for this item
      const invTotal = Number(inv.total_amount || invSubtotal || 1);
      const invPaid = Number(inv.amount_paid || 0);
      if (invTotal > 0 && invPaid > 0) {
        const itemNetBilled = Math.max(0, itemTotal - itemDiscount);
        const itemPaid = (itemNetBilled / invTotal) * invPaid;
        verifiedCashCollected += itemPaid;
      }
    }

    const recognizedServiceRevenue = Math.max(0, grossBilledRevenue - discountsGranted);

    // C. Direct Costs / Expenses
    const directExpenses = validExpenses.filter((exp) => {
      if (exp.service_id === svc.id) return true;
      if (exp.service_request_id && svcReqIdSet.has(exp.service_request_id)) return true;
      return false;
    });

    let actualDirectCosts = 0;
    let allocatedCosts = 0;
    const contributingExpenseIds: string[] = [];
    const requestsWithRecordedExpense = new Set<string>();

    for (const exp of directExpenses) {
      attributedExpenseIds.add(exp.id);
      contributingExpenseIds.push(exp.id);
      const amount = Number(exp.amount || 0);
      const costType = (exp.cost_type || "direct").toLowerCase();

      if (costType === "allocated") {
        allocatedCosts += amount;
      } else {
        actualDirectCosts += amount;
      }

      if (exp.service_request_id) {
        requestsWithRecordedExpense.add(exp.service_request_id);
      }
    }

    // Cost coverage & estimation
    const catalogCostEstimate = Number(svc.internal_cost_estimate || 0);
    const estimatedCosts = catalogCostEstimate * completedCount;
    const hasActualRecordedCosts = actualDirectCosts > 0 || allocatedCosts > 0;
    
    // Total Direct Cost rule:
    // If actual recorded expenses exist, use actual + allocated.
    // If no actual expenses are recorded for completed requests, use estimated costs and flag as estimated.
    let totalDirectCosts = actualDirectCosts + allocatedCosts;
    let costClassification: CostClassification = "actual";

    if (totalDirectCosts === 0 && completedCount > 0 && catalogCostEstimate > 0) {
      totalDirectCosts = estimatedCosts;
      costClassification = "estimated";
    } else if (allocatedCosts > 0 && actualDirectCosts === 0) {
      costClassification = "allocated";
    }

    const costCoveragePercent = completedCount > 0 
      ? Math.round((requestsWithRecordedExpense.size / completedCount) * 100) 
      : (hasActualRecordedCosts ? 100 : 0);

    const hasIncompleteCostRecords = completedCount > 0 && costCoveragePercent < 100 && costClassification !== "estimated";

    // Gross Profit & Margins
    const grossProfit = recognizedServiceRevenue - totalDirectCosts;
    const grossProfitMarginPercent = recognizedServiceRevenue > 0
      ? Number(((grossProfit / recognizedServiceRevenue) * 100).toFixed(1))
      : 0;

    const averageRevenuePerCompletedService = completedCount > 0
      ? Number((recognizedServiceRevenue / completedCount).toFixed(2))
      : recognizedServiceRevenue;

    const isLossMaking = grossProfit < 0;
    const isLowMargin = recognizedServiceRevenue > 0 && grossProfitMarginPercent < 20;

    // Only include services that have either catalog entry, volume, or revenue
    serviceRecords.push({
      serviceId: svc.id,
      serviceName: svc.name,
      serviceCategory: svc.category || "General",
      slug: svc.slug || "",
      defaultFeeNgn: Number(svc.default_fee_ngn || 0),
      catalogCostEstimate,
      completedCount,
      activeCount,
      totalRequestsCount: requestsForSvc.length,
      grossBilledRevenue,
      discountsGranted,
      recognizedServiceRevenue,
      verifiedCashCollected,
      actualDirectCosts,
      allocatedCosts,
      estimatedCosts,
      totalDirectCosts,
      costClassification,
      hasIncompleteCostRecords,
      costCoveragePercent,
      grossProfit,
      grossProfitMarginPercent,
      averageRevenuePerCompletedService,
      isLossMaking,
      isLowMargin,
      contributingInvoiceIds: Array.from(contributingInvoiceIds),
      contributingExpenseIds,
      contributingServiceRequestIds,
    });
  }

  // 6. Tally Unallocated Overhead Expenses
  for (const exp of validExpenses) {
    if (!attributedExpenseIds.has(exp.id)) {
      unallocatedExpensesTotal += Number(exp.amount || 0);
      unallocatedExpensesCount += 1;
    }
  }

  // 7. Aggregate Totals
  const totalServiceRevenue = serviceRecords.reduce((acc, s) => acc + s.recognizedServiceRevenue, 0);
  const totalDirectCosts = serviceRecords.reduce((acc, s) => acc + s.totalDirectCosts, 0);
  const totalGrossProfit = totalServiceRevenue - totalDirectCosts;
  const overallGrossMarginPercent = totalServiceRevenue > 0
    ? Number(((totalGrossProfit / totalServiceRevenue) * 100).toFixed(1))
    : 0;
  const totalDiscountsGranted = serviceRecords.reduce((acc, s) => acc + s.discountsGranted, 0);
  const totalServicesCompleted = serviceRecords.reduce((acc, s) => acc + s.completedCount, 0);
  const averageRevenuePerCompletedService = totalServicesCompleted > 0
    ? Number((totalServiceRevenue / totalServicesCompleted).toFixed(2))
    : totalServiceRevenue;

  const netOperatingSurplusAfterOverhead = totalGrossProfit - unallocatedExpensesTotal;

  // Check if data is incomplete
  const hasAnyIncompleteCosts = serviceRecords.some((s) => s.hasIncompleteCostRecords || s.costClassification === "estimated");
  const dataCompletenessNotice = hasAnyIncompleteCosts
    ? "Profitability cannot be fully calculated because some service costs have not been recorded (incomplete cost records). Estimated costs have been highlighted where applicable."
    : null;

  // 8. Rankings
  // Top 5 Profitable services (by gross profit descending)
  const topProfitableServices = [...serviceRecords]
    .filter((s) => s.recognizedServiceRevenue > 0 || s.completedCount > 0)
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 5);

  // Top Revenue services (by recognized revenue descending)
  const topRevenueServices = [...serviceRecords]
    .filter((s) => s.recognizedServiceRevenue > 0)
    .sort((a, b) => b.recognizedServiceRevenue - a.recognizedServiceRevenue)
    .slice(0, 5);

  // Low margin services
  const lowMarginServices = [...serviceRecords]
    .filter((s) => s.recognizedServiceRevenue > 0 && s.grossProfitMarginPercent < 25)
    .sort((a, b) => a.grossProfitMarginPercent - b.grossProfitMarginPercent);

  // Highest discount services
  const highestDiscountServices = [...serviceRecords]
    .filter((s) => s.discountsGranted > 0)
    .sort((a, b) => b.discountsGranted - a.discountsGranted);

  // Loss-making services
  const lossMakingServices = [...serviceRecords]
    .filter((s) => s.isLossMaking)
    .sort((a, b) => a.grossProfit - b.grossProfit);

  // 9. Monthly Trends (based on invoice issue_date)
  const trendMap = new Map<string, { revenue: number; costs: number; completed: number }>();
  for (const inv of validInvoices) {
    if (!inv.issue_date) continue;
    const key = inv.issue_date.substring(0, 7); // 'YYYY-MM'
    const cur = trendMap.get(key) || { revenue: 0, costs: 0, completed: 0 };
    const invNet = Math.max(0, Number(inv.total_amount || 0));
    cur.revenue += invNet;
    trendMap.set(key, cur);
  }

  for (const exp of validExpenses) {
    if (!exp.expense_date) continue;
    const key = exp.expense_date.substring(0, 7);
    const cur = trendMap.get(key) || { revenue: 0, costs: 0, completed: 0 };
    cur.costs += Number(exp.amount || 0);
    trendMap.set(key, cur);
  }

  for (const sr of filteredRequests) {
    if (sr.status === "completed" && sr.completed_at) {
      const key = sr.completed_at.substring(0, 7);
      const cur = trendMap.get(key) || { revenue: 0, costs: 0, completed: 0 };
      cur.completed += 1;
      trendMap.set(key, cur);
    }
  }

  const sortedPeriodKeys = Array.from(trendMap.keys()).sort();
  const trends: ProfitabilityTrendPoint[] = sortedPeriodKeys.map((key) => {
    const val = trendMap.get(key)!;
    const profit = val.revenue - val.costs;
    const margin = val.revenue > 0 ? Number(((profit / val.revenue) * 100).toFixed(1)) : 0;
    const [year, month] = key.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const periodLabel = `${monthNames[parseInt(month, 10) - 1] || month} ${year}`;

    return {
      periodKey: key,
      periodLabel,
      revenue: val.revenue,
      directCosts: val.costs,
      grossProfit: profit,
      marginPercent: margin,
      completedCount: val.completed,
    };
  });

  const dataLimitations: string[] = [];
  if (unallocatedExpensesTotal > 0) {
    dataLimitations.push(`₦${unallocatedExpensesTotal.toLocaleString()} in operational overhead is unallocated across individual services.`);
  }
  if (hasAnyIncompleteCosts) {
    dataLimitations.push("Certain completed service requests lack directly recorded job disbursements; baseline estimated costs were applied.");
  }

  return {
    totals: {
      totalServiceRevenue,
      totalDirectCosts,
      totalGrossProfit,
      overallGrossMarginPercent,
      totalDiscountsGranted,
      totalServicesCompleted,
      averageRevenuePerCompletedService,
      unallocatedExpensesTotal,
      netOperatingSurplusAfterOverhead,
      dataCompletenessNotice,
    },
    services: serviceRecords.sort((a, b) => b.recognizedServiceRevenue - a.recognizedServiceRevenue),
    topProfitableServices,
    topRevenueServices,
    lowMarginServices,
    highestDiscountServices,
    lossMakingServices,
    trends,
    unallocatedExpensesCount,
    dataLimitations,
  };
}

/**
 * Fetch authoritative raw datasets for profitability calculations directly from Supabase
 */
export async function fetchProfitabilityDataset(): Promise<{
  catalog: any[];
  serviceRequests: any[];
  invoices: any[];
  invoiceItems: any[];
  expenses: any[];
  staffProfiles: any[];
}> {
  const [catRes, srRes, invRes, itemRes, expRes, staffRes] = await Promise.all([
    supabase.from("services_catalog").select("*").order("name"),
    supabase.from("service_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("invoices").select("*, client:clients(full_name)").order("issue_date", { ascending: false }),
    supabase.from("invoice_items").select("*"),
    supabase.from("expenses").select("*, vendor:vendors(name)").order("expense_date", { ascending: false }),
    supabase.from("staff_profiles").select("id, full_name, role, department"),
  ]);

  return {
    catalog: catRes.data || [],
    serviceRequests: srRes.data || [],
    invoices: invRes.data || [],
    invoiceItems: itemRes.data || [],
    expenses: expRes.data || [],
    staffProfiles: staffRes.data || [],
  };
}
