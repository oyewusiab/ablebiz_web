import {
  Activity,
  BarChart3,
  CheckCircle2,
  Gift,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getBusinessHealthReport,
  getUnifiedClients,
  USER_GROUPS,
} from "../../referrals/core";
import { useStorageData } from "../../utils/useStorageData";
import { useSiteConfig } from "../../referrals/siteConfig";
import {
  AdminBadge,
  AdminEmptyState,
  AdminPage,
  AdminSection,
  AdminStatCard,
  AdminSurface,
} from "../../components/admin/AdminPrimitives";
import { Button } from "../../components/ui/Button";

export function AdminDashboard() {
  const [stats, refresh] = useStorageData(getBusinessHealthReport);
  const [allClients, refreshClients] = useStorageData(getUnifiedClients);
  const { flashCampaign } = useSiteConfig();
  const recentClients = allClients.slice(0, 6);

  const handleRefresh = () => {
    refresh();
    refreshClients();
  };

  const metricCards = [
    {
      label: "Total interactors",
      value: stats.totalLeads + stats.totalSpins + stats.totalReferrers,
      icon: Users,
      tone: "success" as const,
      meta: "Combined referrals, consultations, and game activity",
    },
    {
      label: "Active clients",
      value:
        (stats.groupBreakdown as any).client +
        (stats.groupBreakdown as any).returning_client +
        (stats.groupBreakdown as any).vip,
      icon: Target,
      tone: "info" as const,
      meta: "Client, returning client, and VIP segments",
    },
    {
      label: "Revenue prospects",
      value: (stats.groupBreakdown as any).prospect,
      icon: TrendingUp,
      tone: "warning" as const,
      meta: "Leads currently sitting in the prospect stage",
    },
    {
      label: "Pending rewards",
      value: stats.pendingRedemptions,
      icon: Gift,
      tone: "default" as const,
      meta: "Rewards awaiting fulfillment",
    },
  ];

  const topServices = Object.entries(stats.leadsByService).slice(0, 5);

  return (
    <AdminPage
      eyebrow="Overview"
      title="Dashboard"
      description="Monitor performance, recent activity, and operational follow-up from one place."
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <AdminBadge tone="success">Live system</AdminBadge>
        </>
      }
    >
      {flashCampaign?.active ? (
        <AdminSurface className="border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="admin-icon-chip admin-icon-chip-success h-12 w-12 rounded-[var(--radius-lg)]">
                <Zap className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="admin-section-title">{flashCampaign.name} is active</h2>
                <p className="admin-section-description">
                  Referral points are currently multiplied by {flashCampaign.multiplier}x.
                </p>
              </div>
            </div>
            <AdminBadge tone="success">Campaign live</AdminBadge>
          </div>
        </AdminSurface>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <AdminStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            meta={card.meta}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <AdminSection
          title="Recent activity"
          description="Latest users entering the referral and consultation system."
          actions={<AdminBadge>{allClients.length} total</AdminBadge>}
        >
          {recentClients.length === 0 ? (
            <AdminEmptyState
              icon={Users}
              title="No activity yet"
              description="New clients and leads will appear here as soon as people begin interacting with the portal."
            />
          ) : (
            <div className="admin-list">
              {recentClients.map((client) => {
                const groupLabel =
                  USER_GROUPS.find((group) => group.id === (client as any).group)?.label || "Visitor";

                return (
                  <div key={client.id} className="admin-list-row">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                        {client.name?.charAt(0) || "U"}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="admin-title-sm truncate">{client.name}</p>
                          <AdminBadge>{groupLabel}</AdminBadge>
                        </div>
                        <p className="admin-meta truncate">
                          {client.source === "referral" && "Signed up via referral"}
                          {client.source === "consultation" &&
                            `Requested ${client.serviceNeeded || client.service || "consultation"}`}
                          {client.source === "spin" && "Joined from Spin & Win"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <AdminBadge tone={client.status === "completed" ? "success" : "default"}>
                        {client.status || "pending"}
                      </AdminBadge>
                      <p className="admin-meta">
                        {new Date(client.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {recentClients.length > 0 ? (
            <div className="mt-5">
              <Link className="admin-button-secondary" to="/admin/clients">
                View all clients
              </Link>
            </div>
          ) : null}
        </AdminSection>

        <div className="space-y-6">
          <AdminSection title="Predictive outlook" description="A quick read on current acquisition momentum.">
            <div className="space-y-4">
              <div className="admin-icon-chip admin-icon-chip-success">
                <Activity className="h-4 w-4" />
              </div>
              <p className="admin-page-description max-w-none">
                {stats.totalLeads > 0
                  ? `Based on current activity, the system projects roughly ${Math.ceil(
                      stats.totalLeads * 1.15
                    )} additional leads next month.`
                  : "Acquisition is still at baseline. More engagement campaigns will help the pipeline start moving."}
              </p>
              <Link className="admin-button-primary w-full sm:w-auto" to="/admin/reports">
                Open reports
              </Link>
            </div>
          </AdminSection>

          <AdminSection title="Top services" description="Most requested services from current lead data.">
            {topServices.length === 0 ? (
              <AdminEmptyState title="No service data yet" description="Service demand will appear here once leads begin selecting services." />
            ) : (
              <div className="space-y-4">
                {topServices.map(([name, count]) => {
                  const serviceCount = Number(count);
                  return (
                    <div key={name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="admin-kicker text-[var(--text-primary)]">{name}</p>
                        <p className="admin-meta">{serviceCount}</p>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--admin-panel-muted)]">
                        <div
                          className="h-2 rounded-full bg-[var(--color-primary-500)]"
                          style={{
                            width: `${Math.min(100, (serviceCount / (stats.totalLeads || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminSection>

          <AdminSection title="Game activity" description="Spin & Win participation in the current cycle.">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="admin-icon-chip admin-icon-chip-success">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="admin-stat-value">{stats.totalSpins}</div>
              </div>
              <p className="admin-page-description max-w-none">
                The game channel continues to support engagement and first-party data capture.
              </p>
              <AdminBadge tone="info">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Engagement tracked
              </AdminBadge>
            </div>
          </AdminSection>
        </div>
      </div>
    </AdminPage>
  );
}
