import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Users,
  BarChart3,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../auth/ThemeContext";
import { AdminBadge, AdminSurface } from "./admin/AdminPrimitives";
import { useStorageData } from "../utils/useStorageData";
import { getEnrichedRedemptions, getLeads, getUnifiedClients } from "../referrals/core";

function getAdminNotifications() {
  const leads = getLeads();
  const redemptions = getEnrichedRedemptions();
  const clients = getUnifiedClients().slice(0, 3);

  const items = [
    ...leads
      .filter((lead) => lead.status === "pending")
      .slice(0, 3)
      .map((lead) => ({
        id: `lead-${lead.id}`,
        title: "Pending consultation lead",
        description: `${lead.name} requested ${lead.serviceNeeded}`,
      })),
    ...redemptions
      .filter((item) => item.status === "pending")
      .slice(0, 3)
      .map((item) => ({
        id: `reward-${item.id}`,
        title: "Reward awaiting fulfillment",
        description: `${item.client?.name || item.clientCode} requested ${item.rewardTitle}`,
      })),
    ...clients.map((client) => ({
      id: `client-${client.id}`,
      title: "Recent client activity",
      description: `${client.name} entered through ${client.sourceLabel}`,
    })),
  ];

  return items.slice(0, 6);
}

export function AdminPortalLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications] = useStorageData(getAdminNotifications);
  const location = useLocation();
  const navigate = useNavigate();
  const displayName = user?.name || user?.email?.split("@")[0] || "Admin";

  const navItems = useMemo(
    () =>
      [
        user?.permissions.dashboard
          ? { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard }
          : null,
        user?.permissions.referrals
          ? { name: "Referrals", path: "/admin/referrals", icon: History }
          : null,
        user?.permissions.clients ? { name: "Clients", path: "/admin/clients", icon: Users } : null,
        user?.permissions.reports ? { name: "Reports", path: "/admin/reports", icon: BarChart3 } : null,
        user?.permissions.settings ? { name: "Settings", path: "/admin/settings", icon: ShieldCheck } : null,
      ].filter(Boolean) as Array<{ name: string; path: string; icon: typeof LayoutDashboard }>,
    [user]
  );

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <>
      <div className={collapsed ? "flex h-16 items-center justify-center border-b border-[var(--admin-border)] px-4" : "flex h-16 items-center border-b border-[var(--admin-border)] px-5"}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-600)] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-white">ABLEBIZ</p>
              <p className="text-xs text-[var(--color-neutral-400)]">Admin portal</p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-[var(--color-primary-600)] text-white"
                  : "text-[var(--color-neutral-400)] hover:bg-white/5 hover:text-white"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.name}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--admin-border)] p-3">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--color-neutral-400)] transition-colors hover:bg-[var(--color-danger-700)]/10 hover:text-red-300 ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed ? <span>Sign out</span> : null}
        </button>
      </div>
    </>
  );

  return (
    <div className={`admin-theme ${theme} flex h-screen overflow-hidden bg-[var(--ablebiz-bg)] text-[var(--text-primary)]`}>
      {isMobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close sidebar overlay"
        />
      ) : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--sidebar-bg)] transition-transform lg:hidden ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-white/5 text-white/70"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent collapsed={false} />
      </aside>

      <aside className={`relative z-20 hidden flex-col border-r border-[var(--admin-border)] bg-[var(--sidebar-bg)] transition-all lg:flex ${isSidebarOpen ? "w-64" : "w-20"}`}>
        <button
          type="button"
          onClick={() => setIsSidebarOpen((value) => !value)}
          className="absolute -right-3 top-6 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--sidebar-bg)] bg-[var(--color-primary-500)] text-[var(--color-neutral-900)] shadow-sm"
        >
          {isSidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <SidebarContent collapsed={!isSidebarOpen} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--admin-border)] bg-[var(--admin-panel)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <label className="hidden min-w-[280px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 md:flex">
              <Search className="h-4 w-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--text-secondary)]"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationOpen((value) => !value)}
                className="relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--text-secondary)]"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 ? (
                  <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary-500)] px-1 text-[10px] text-white">
                    {notifications.length}
                  </span>
                ) : null}
              </button>

              {isNotificationOpen ? (
                <div className="absolute right-0 top-12 z-40 w-[320px]">
                  <AdminSurface className="max-h-[420px] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
                      <div>
                        <p className="admin-title-sm">Notifications</p>
                        <p className="admin-meta">Operational updates from the portal</p>
                      </div>
                      <button
                        type="button"
                        className="admin-button-secondary px-3 py-1.5 text-xs"
                        onClick={() => setIsNotificationOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-[340px] overflow-y-auto p-2">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-sm text-[var(--text-secondary)]">No notifications right now.</div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full flex-col items-start gap-1 rounded-[var(--radius-md)] px-3 py-3 text-left hover:bg-[var(--admin-panel-muted)]"
                          >
                            <span className="admin-title-sm">{item.title}</span>
                            <span className="admin-meta">{item.description}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </AdminSurface>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3 border-l border-[var(--admin-border)] pl-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-[var(--text-primary)]">{displayName}</p>
                <p className="text-xs text-[var(--text-secondary)]">{user?.role || "admin"}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                {user?.role === "superadmin" ? <ShieldCheck className="h-5 w-5" /> : <CircleUser className="h-5 w-5" />}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-8 md:px-6">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex justify-end pt-4">
              <AdminBadge tone="success">System online</AdminBadge>
            </div>
            <Outlet />
          </div>
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .admin-theme ::-webkit-scrollbar { width: 8px; height: 8px; }
            .admin-theme ::-webkit-scrollbar-thumb { background: rgba(34, 197, 94, 0.24); border-radius: 999px; }
            .admin-theme ::-webkit-scrollbar-track { background: transparent; }
          `,
        }}
      />
    </div>
  );
}
