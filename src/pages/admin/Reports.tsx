import { useMemo } from "react";
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  Calendar,
  AlertCircle,
  Users,
  Gift,
  MessageSquare,
  Download,
  Star,
  Zap
} from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { 
  getBusinessHealthReport, 
  USER_GROUPS, 
  getReferralClients, 
  getReferralConversions, 
  getLeads,
  getEnrichedRedemptions
} from "../../referrals/core";
import { useStorageData } from "../../utils/useStorageData";

// ── helpers ────────────────────────────────────────────────────────────────

function getMonthlyTrend() {
  const clients = getReferralClients();
  const leads   = getLeads();

  // Build last-6-months labels
  const months: { label: string; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      label: d.toLocaleString("default", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  return months.map(({ label, key }) => {
    const c = clients.filter((x) => x.createdAt.startsWith(key)).length;
    const l = leads.filter((x) => x.createdAt.startsWith(key)).length;
    return { label, clients: c, leads: l, total: c + l };
  });
}

function getTopReferrers(limit = 5) {
  const clients     = getReferralClients();
  const conversions = getReferralConversions();
  const counts      = new Map<string, number>();
  for (const cv of conversions) {
    const k = cv.referrerCode.toLowerCase();
    counts.set(k, (counts.get(k) || 0) + cv.points);
  }
  return clients
    .map((c) => ({ ...c, points: counts.get(c.referralCode.toLowerCase()) || 0 }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function exportReport() {
  const data = {
    exportedAt: new Date().toISOString(),
    clients:     getReferralClients(),
    leads:       getLeads(),
    conversions: getReferralConversions(),
    redemptions: getEnrichedRedemptions(),
    stats:       getBusinessHealthReport(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `ablebiz-report-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── component ─────────────────────────────────────────────────────────────

export function AdminReports() {
  const [stats] = useStorageData(getBusinessHealthReport);
  const [trend] = useStorageData(getMonthlyTrend);
  const [topReferrers] = useStorageData(getTopReferrers);

  const peakMonth   = useMemo(() => trend.reduce((a, b) => b.total > a.total ? b : a, trend[0]), [trend]);
  const maxTrend    = useMemo(() => Math.max(...trend.map((t) => t.total), 1), [trend]);

  const funnel = [
    { label: "Discovery (Traffic / Spins)",    value: stats.funnel.discovery,   color: "bg-blue-500",    icon: Activity },
    { label: "Engagement (Leads + Game Plays)", value: stats.funnel.engagement,  color: "bg-purple-500",  icon: Target },
    { label: "Lead Generation",                 value: stats.totalLeads,          color: "bg-emerald-500", icon: CheckCircle2 },
    { label: "Advocacy (Referrers)",            value: stats.totalReferrers,      color: "bg-amber-500",   icon: Users },
  ];

  const milestones = [
    { title: "Expand physical office to Abuja",       status: "In Progress", date: "Q3 2026", icon: TrendingUp },
    { title: "Integrate Automated CAC Monitoring",    status: "Planned",     date: "Q4 2026", icon: Calendar },
    { title: "Launch International Business Support", status: "Research",    date: "2027",    icon: Activity },
  ];

  // Summary KPI bar data
  const kpis = [
    { label: "Total Referrers",    value: stats.totalReferrers,    icon: Users,          color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-100" },
    { label: "Consultations",      value: stats.totalLeads,         icon: MessageSquare,  color: "text-blue-600",    bg: "bg-blue-50",    ring: "ring-blue-100" },
    { label: "Conversions",        value: stats.totalConversions,   icon: Zap,            color: "text-purple-600",  bg: "bg-purple-50",  ring: "ring-purple-100" },
    { label: "Pending Rewards",    value: stats.pendingRedemptions, icon: Gift,           color: "text-amber-600",   bg: "bg-amber-50",   ring: "ring-amber-100" },
    { label: "Referral Rate",      value: `${((stats.totalConversions / (stats.totalReferrers || 1)) * 100).toFixed(0)}%`, icon: TrendingUp, color: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-100" },
  ];

  return (
    <div className="space-y-10 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Reports &amp; Insights</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Long-term business performance and strategic milestones.</p>
        </div>
        <button
          onClick={exportReport}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:brightness-110 transition-all active:scale-95"
        >
          <Download className="h-4 w-4" /> Export Full Report
        </button>
      </div>

      {/* ── KPI Summary Bar ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className={`border-none shadow-sm ring-1 ${k.ring}`}>
            <CardBody className="p-5 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${k.bg} ${k.color} flex-shrink-0`}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900">{k.value}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{k.label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* ── Monthly Activity Trend ── */}
      <Card className="border-none shadow-sm ring-1 ring-slate-200/50">
        <CardBody className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-bold text-slate-900">6-Month Activity Trend</h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"/> Referrers</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block"/> Leads</span>
              {peakMonth && <span className="text-purple-600">Peak: {peakMonth.label} ({peakMonth.total})</span>}
            </div>
          </div>
          <div className="flex items-end gap-3 h-44">
            {trend.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex flex-col gap-0.5 justify-end" style={{ height: "80%" }}>
                  {/* Leads bar */}
                  <div
                    className="w-full bg-blue-500 rounded-t-lg transition-all duration-700 hover:brightness-110"
                    style={{ height: `${(m.leads / maxTrend) * 100}%`, minHeight: m.leads > 0 ? 4 : 0 }}
                    title={`${m.leads} leads`}
                  />
                  {/* Referrers bar (stacked visually) */}
                  <div
                    className="w-full bg-emerald-500 rounded-b-lg transition-all duration-700 hover:brightness-110"
                    style={{ height: `${(m.clients / maxTrend) * 100}%`, minHeight: m.clients > 0 ? 4 : 0 }}
                    title={`${m.clients} referrers`}
                  />
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase">{m.label}</div>
                <div className="text-[9px] font-bold text-slate-500">{m.total || "—"}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ── Conversion Pipeline + Vertical Demand + Roadmap ── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
          <CardBody className="p-8">
            <div className="flex items-center gap-2 mb-8">
              <Target className="h-5 w-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-slate-900">Conversion Pipeline</h3>
            </div>

            <div className="space-y-8">
              {funnel.map((step, i) => (
                <div key={step.label} className="relative">
                  <div className="flex justify-between items-end mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <step.icon className={`h-3.5 w-3.5 ${step.color.replace('bg-', 'text-')}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{step.label}</span>
                    </div>
                    <span className="text-lg font-black text-slate-900">{step.value}</span>
                  </div>
                  <div className="h-4 rounded-full bg-slate-50 overflow-hidden ring-1 ring-slate-100">
                    <div 
                      className={`h-full ${step.color} rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,0,0,0.1)]`}
                      style={{ width: `${Math.min(100, (step.value / (funnel[0].value || 1)) * 100)}%` }}
                    />
                  </div>
                  {i < funnel.length - 1 && (
                     <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 h-4 w-0.5 bg-slate-100" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-2xl bg-slate-900 p-6 flex items-start gap-4 text-white shadow-xl">
              <div className="p-2 bg-white/10 rounded-lg shadow-sm">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white italic">Strategic Insight</div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed font-medium">
                  The current <span className="text-emerald-400 font-black">{((stats.totalLeads / (stats.funnel.discovery || 1)) * 100).toFixed(1)}% discovery-to-lead</span> conversion suggests strong initial attraction. Focus on the engagement layer to pull more visitors into the lead funnel.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-8">
          {/* Vertical Demand */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200/50">
            <CardBody className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-bold text-slate-900">Vertical Demand</h3>
              </div>
              <div className="grid gap-3">
                {Object.entries(stats.leadsByService).length === 0 ? (
                   <div className="text-slate-400 text-xs font-medium italic py-4">Waiting for more demand data...</div>
                ) : (
                   Object.entries(stats.leadsByService).map(([name, count]: any) => (
                     <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 transition-all hover:scale-[1.02] hover:shadow-sm">
                       <span className="text-xs font-bold text-slate-700">{name}</span>
                       <span className="text-xs font-black text-blue-600 bg-white px-2 py-0.5 rounded-lg shadow-sm">{count}</span>
                     </div>
                   ))
                )}
              </div>
            </CardBody>
          </Card>

          {/* Business Roadmap */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <TrendingUp className="h-32 w-32" />
            </div>
            <CardBody className="p-8 relative">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="h-5 w-5 text-emerald-400" />
                <h3 className="text-lg font-bold">Business Roadmap</h3>
              </div>
              <div className="space-y-6">
                {milestones.map((m) => (
                  <div key={m.title} className="flex gap-4 group">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 group-hover:bg-emerald-500/20 transition-all">
                      <m.icon className="h-5 w-5 text-slate-400 group-hover:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold group-hover:text-emerald-400 transition-all">{m.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{m.date}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-700" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">{m.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── Top Referrers Leaderboard ── */}
      <Card className="border-none shadow-sm ring-1 ring-slate-200/50">
        <CardBody className="p-8">
          <div className="flex items-center gap-2 mb-6">
            <Star className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900">Top Referrers Leaderboard</h3>
          </div>
          {topReferrers.length === 0 ? (
            <p className="text-slate-400 text-xs font-medium italic py-4">No referral data yet.</p>
          ) : (
            <div className="grid gap-3">
              {topReferrers.map((r, i) => (
                <div key={r.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-100 hover:ring-amber-200 hover:bg-amber-50/30 transition-all">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                    i === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" :
                    i === 1 ? "bg-slate-400 text-white" :
                    i === 2 ? "bg-orange-400 text-white" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{r.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{r.referralCode}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black text-slate-900">{r.points}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">conversion{r.points !== 1 ? "s" : ""}</div>
                  </div>
                  {/* mini progress relative to #1 */}
                  <div className="w-20 flex-shrink-0">
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${((r.points / (topReferrers[0]?.points || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Group Breakdown ── */}
      <Card className="border-none shadow-sm ring-1 ring-slate-200/50">
        <CardBody className="p-8">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-bold text-slate-900">Unified Group Breakdown</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {USER_GROUPS.map((g) => {
              const count = (stats.groupBreakdown as any)[g.id] || 0;
              const total = stats.funnel.discovery || 1;
              return (
                <div key={g.id} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-widest">{g.label}</span>
                    <span className="text-slate-900">{count}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden ring-1 ring-slate-100">
                    <div 
                      className={`h-full rounded-full ${g.color.split(' ')[0]}`}
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold">{((count / total) * 100).toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* ── Financial notice ── */}
      <div className="rounded-3xl bg-amber-50 p-8 flex items-start gap-4 ring-1 ring-amber-100">
        <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-500 flex-shrink-0">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Financial Integration Required</h4>
          <p className="mt-1 text-sm text-amber-800 font-medium leading-relaxed opacity-80">
            Financial data is currently disconnected. To enable full ROI analysis, link your external system to pull "Revenue per Converted Lead" and "Customer Acquisition Cost" (CAC) metrics.
          </p>
        </div>
      </div>
    </div>
  );
}
