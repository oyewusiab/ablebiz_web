import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  getBusinessHealthReport,
  getEnrichedRedemptions,
  getLeads,
  getReferralClients,
  getReferralConversions,
  USER_GROUPS,
} from "../../referrals/core";
import { useStorageData } from "../../utils/useStorageData";
import {
  AdminBadge,
  AdminEmptyState,
  AdminInput,
  AdminPage,
  AdminSection,
  AdminStatCard,
  AdminSurface,
} from "../../components/admin/AdminPrimitives";
import { Button } from "../../components/ui/Button";

function getMonthlyTrend() {
  const clients = getReferralClients();
  const leads = getLeads();
  const months: { label: string; key: string }[] = [];

  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    months.push({
      label: date.toLocaleString("default", { month: "short" }),
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  return months.map(({ label, key }) => {
    const clientCount = clients.filter((item) => item.createdAt.startsWith(key)).length;
    const leadCount = leads.filter((item) => item.createdAt.startsWith(key)).length;
    return { label, clients: clientCount, leads: leadCount, total: clientCount + leadCount };
  });
}

function getTopReferrers(limit = 5) {
  const clients = getReferralClients();
  const conversions = getReferralConversions();
  const counts = new Map<string, number>();

  for (const conversion of conversions) {
    if (!conversion.referrerCode) continue;
    const code = conversion.referrerCode.toLowerCase();
    counts.set(code, (counts.get(code) || 0) + conversion.points);
  }

  return clients
    .map((client) => ({
      ...client,
      points: counts.get(client.referralCode?.toLowerCase() || "") || 0,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function exportReport() {
  const data = {
    exportedAt: new Date().toISOString(),
    clients: getReferralClients(),
    leads: getLeads(),
    conversions: getReferralConversions(),
    redemptions: getEnrichedRedemptions(),
    stats: getBusinessHealthReport(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ablebiz-report-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportReportPdf(stats: ReturnType<typeof getBusinessHealthReport>, trend: ReturnType<typeof getMonthlyTrend>, topReferrers: ReturnType<typeof getTopReferrers>) {
  const printableWindow = window.open("", "_blank", "width=1024,height=768");
  if (!printableWindow) return;

  const trendRows = trend
    .map(
      (item) => `
        <tr>
          <td>${item.label}</td>
          <td>${item.clients}</td>
          <td>${item.leads}</td>
          <td>${item.total}</td>
        </tr>
      `
    )
    .join("");

  const referrerRows = topReferrers
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.name}</td>
          <td>${item.referralCode}</td>
          <td>${item.points}</td>
        </tr>
      `
    )
    .join("");

  const categoryRows = USER_GROUPS.map((group) => {
    const count = (stats.groupBreakdown as any)[group.id] || 0;
    return `<tr><td>${group.label}</td><td>${count}</td></tr>`;
  }).join("");

  printableWindow.document.write(`
    <html>
      <head>
        <title>ABLEBIZ Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
          h1, h2 { margin: 0 0 12px; }
          h1 { font-size: 28px; }
          h2 { font-size: 18px; margin-top: 28px; }
          p { margin: 0 0 8px; line-height: 1.5; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 20px 0; }
          .card { border: 1px solid #dbe4dd; border-radius: 12px; padding: 16px; }
          .label { font-size: 12px; color: #475569; margin-bottom: 6px; }
          .value { font-size: 24px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #dbe4dd; padding: 10px; text-align: left; font-size: 13px; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>ABLEBIZ Performance Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>

        <div class="grid">
          <div class="card"><div class="label">Total referrers</div><div class="value">${stats.totalReferrers}</div></div>
          <div class="card"><div class="label">Consultations</div><div class="value">${stats.totalLeads}</div></div>
          <div class="card"><div class="label">Conversions</div><div class="value">${stats.totalConversions}</div></div>
          <div class="card"><div class="label">Pending rewards</div><div class="value">${stats.pendingRedemptions}</div></div>
        </div>

        <h2>Pipeline summary</h2>
        <p>Discovery: ${stats.funnel.discovery}</p>
        <p>Engagement: ${stats.funnel.engagement}</p>
        <p>Lead generation: ${stats.totalLeads}</p>
        <p>Referrers: ${stats.totalReferrers}</p>

        <h2>Monthly growth</h2>
        <table>
          <thead>
            <tr><th>Month</th><th>Referrers</th><th>Leads</th><th>Total</th></tr>
          </thead>
          <tbody>${trendRows}</tbody>
        </table>

        <h2>Top referrers</h2>
        <table>
          <thead>
            <tr><th>#</th><th>Name</th><th>Referral code</th><th>Points</th></tr>
          </thead>
          <tbody>${referrerRows || '<tr><td colspan="4">No referrer data available.</td></tr>'}</tbody>
        </table>

        <h2>Client categories</h2>
        <table>
          <thead>
            <tr><th>Category</th><th>Count</th></tr>
          </thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </body>
    </html>
  `);
  printableWindow.document.close();
  printableWindow.focus();
  printableWindow.print();
}

export function AdminReports() {
  const [stats] = useStorageData(getBusinessHealthReport);
  const [trend] = useStorageData(getMonthlyTrend);
  const [topReferrers] = useStorageData(getTopReferrers);
  const [query, setQuery] = useState("");
  const referrersRef = useRef<HTMLDivElement>(null);
  const funnelRef = useRef<HTMLDivElement>(null);

  const peakMonth = useMemo(() => {
    if (trend.length === 0) return null;
    return trend.reduce((best, current) => (current.total > best.total ? current : best), trend[0]);
  }, [trend]);
  const maxTrend = useMemo(() => Math.max(...trend.map((item) => item.total), 1), [trend]);

  const kpis = [
    { label: "Total referrers", value: stats.totalReferrers, icon: Users, tone: "success" as const },
    { label: "Consultations", value: stats.totalLeads, icon: MessageSquare, tone: "info" as const },
    { label: "Conversions", value: stats.totalConversions, icon: Zap, tone: "warning" as const },
    { label: "Pending rewards", value: stats.pendingRedemptions, icon: CheckCircle2, tone: "default" as const },
  ];

  const funnel = [
    { label: "Discovery", value: stats.funnel.discovery, icon: TrendingUp },
    { label: "Engagement", value: stats.funnel.engagement, icon: Target },
    { label: "Lead generation", value: stats.totalLeads, icon: MessageSquare },
    { label: "Referrers", value: stats.totalReferrers, icon: Users },
  ];

  const milestones = [
    { title: "Expand physical office to Abuja", status: "In progress", date: "Q3 2026" },
    { title: "Integrate automated CAC monitoring", status: "Planned", date: "Q4 2026" },
    { title: "Launch international support", status: "Research", date: "2027" },
  ];

  const handleSearch = (value: string) => {
    setQuery(value);
    const normalized = value.toLowerCase();

    if (normalized.includes("referrer") || normalized.includes("top")) {
      referrersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (normalized.includes("pipeline") || normalized.includes("lead") || normalized.includes("funnel")) {
      funnelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const executiveSummary = [
    `Referral success rate: ${stats.referralSuccessRate}`,
    `Peak monthly activity: ${peakMonth?.label || "N/A"}`,
    `Current pending rewards: ${stats.pendingRedemptions}`,
  ];

  return (
    <AdminPage
      eyebrow="Analytics"
      title="Reports"
      description="Review growth, conversion health, and the strongest referral contributors."
      actions={
        <>
          <Button size="sm" onClick={exportReport}>
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportReportPdf(stats, trend, topReferrers)}>
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </Button>
        </>
      }
    >
      <AdminSurface className="p-4">
        <label className="flex items-center gap-3">
          <Search className="h-4 w-4 text-[var(--text-secondary)]" />
          <AdminInput
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            className="border-0 px-0 shadow-none focus:shadow-none"
            placeholder="Search this page: top referrers, pipeline, conversions..."
          />
        </label>
      </AdminSurface>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <AdminStatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <AdminSection title="Executive summary" description="A quick readout for leadership and operational review.">
          <div className="space-y-3">
            {executiveSummary.map((item) => (
              <AdminSurface key={item} className="bg-[var(--admin-panel-muted)] p-4">
                <p className="admin-page-description max-w-none">{item}</p>
              </AdminSurface>
            ))}
          </div>
        </AdminSection>

        <AdminSection title="Category balance" description="Current distribution of users by lifecycle stage.">
          <div className="space-y-3">
            {USER_GROUPS.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="admin-kicker">{group.label}</p>
                  <p className="admin-meta">{(stats.groupBreakdown as any)[group.id] || 0}</p>
                </div>
                <div className="h-2 rounded-full bg-[var(--admin-panel-muted)]">
                  <div
                    className="h-2 rounded-full bg-[var(--color-primary-500)]"
                    style={{
                      width: `${Math.min(
                        100,
                        (((stats.groupBreakdown as any)[group.id] || 0) /
                          (stats.totalLeads + stats.totalReferrers + stats.totalSpins || 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Monthly growth"
        description="Six-month view of leads and referrer growth."
        actions={peakMonth ? <AdminBadge tone="success">Peak month: {peakMonth.label}</AdminBadge> : null}
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <AdminBadge>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-primary-700)]" />
              Referrers
            </AdminBadge>
            <AdminBadge tone="info">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-info-600)]" />
              Leads
            </AdminBadge>
          </div>
          <div className="flex h-64 items-end gap-3">
            {trend.map((month) => (
              <div key={month.label} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex h-full w-full items-end justify-center gap-2">
                  <div
                    className="w-full max-w-[20px] rounded-t-[var(--radius-sm)] bg-[var(--color-info-600)]/75"
                    style={{ height: `${(month.leads / maxTrend) * 100}%`, minHeight: month.leads ? 10 : 0 }}
                  />
                  <div
                    className="w-full max-w-[20px] rounded-t-[var(--radius-sm)] bg-[var(--color-primary-600)]"
                    style={{ height: `${(month.clients / maxTrend) * 100}%`, minHeight: month.clients ? 10 : 0 }}
                  />
                </div>
                <div className="space-y-1 text-center">
                  <p className="admin-kicker">{month.label}</p>
                  <p className="admin-title-sm">{month.total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection
          title="Lead pipeline"
          description="How users move from discovery to referral participation."
          className="scroll-mt-6"
        >
          <div ref={funnelRef} className="space-y-5">
            {funnel.map((step) => (
              <div key={step.label} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="admin-icon-chip">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className="admin-title-sm">{step.label}</span>
                  </div>
                  <span className="admin-title-sm">{step.value}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--admin-panel-muted)]">
                  <div
                    className="h-2 rounded-full bg-[var(--color-primary-500)]"
                    style={{
                      width: `${Math.min(100, (step.value / (funnel[0].value || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <AdminSurface className="bg-[var(--color-primary-50)] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--color-primary-700)]" />
                <p className="admin-page-description max-w-none">
                  Visitor-to-lead conversion is{" "}
                  {((stats.totalLeads / (stats.funnel.discovery || 1)) * 100).toFixed(1)}%.
                  Growing the referrer network remains the strongest lever.
                </p>
              </div>
            </AdminSurface>
          </div>
        </AdminSection>

        <AdminSection title="Business roadmap" description="Operational priorities currently tracked in the portal.">
          <div className="admin-list">
            {milestones.map((item) => (
              <div key={item.title} className="admin-list-row">
                <div className="space-y-1">
                  <p className="admin-title-sm">{item.title}</p>
                  <p className="admin-meta">{item.date}</p>
                </div>
                <AdminBadge tone="success">{item.status}</AdminBadge>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Top referrers"
        description="Partners producing the strongest point totals right now."
        className="scroll-mt-6"
      >
        <div ref={referrersRef}>
          {topReferrers.length === 0 ? (
            <AdminEmptyState
              icon={Users}
              title="No referrers found"
              description="Once referral participation begins, the highest-performing partners will be ranked here."
            />
          ) : (
            <div className="admin-list">
                {topReferrers.map((referrer, index) => (
                  <div key={referrer.id} className="admin-list-row">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-[var(--text-primary)]">
                      {index === 0 ? <Star className="h-4 w-4 text-[var(--admin-warning-fg)]" /> : index + 1}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="admin-title-sm truncate">{referrer.name}</p>
                      <p className="admin-meta truncate">{referrer.referralCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden w-32 rounded-full bg-[var(--admin-panel-muted)] lg:block">
                      <div
                        className="h-2 rounded-full bg-[var(--color-primary-500)]"
                        style={{
                          width: `${Math.min(100, (referrer.points / (topReferrers[0]?.points || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <AdminBadge tone="success">{referrer.points} points</AdminBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection title="Client categories" description="Distribution of current users by lifecycle group.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {USER_GROUPS.map((group) => {
            const count = (stats.groupBreakdown as any)[group.id] || 0;
            const total = stats.totalLeads + stats.totalReferrers || 1;
            const percentage = ((count / total) * 100).toFixed(1);

            return (
              <AdminSurface key={group.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="admin-kicker">{group.label}</p>
                      <p className="admin-stat-value text-[26px]">{count}</p>
                    </div>
                    <AdminBadge>{percentage}%</AdminBadge>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--admin-panel-muted)]">
                    <div
                      className="h-2 rounded-full bg-[var(--color-primary-500)]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </AdminSurface>
            );
          })}
        </div>
      </AdminSection>

      <AdminSurface className="border-[var(--color-warning-100)] bg-[var(--color-warning-100)]/50 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--color-warning-700)]" />
            <div className="space-y-1">
              <h2 className="admin-section-title">Financial integration needed</h2>
              <p className="admin-section-description">
                Revenue and profit tracking are not connected yet. Connect an accounting source to unlock financial reporting.
              </p>
            </div>
          </div>
          <button type="button" className="admin-button-primary">
            Connect accounting
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </AdminSurface>
    </AdminPage>
  );
}
