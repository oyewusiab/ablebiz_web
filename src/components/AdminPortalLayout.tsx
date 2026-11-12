import { useState, useMemo, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Bell,
  Users,
  Briefcase,
  FileCheck2,
  FileSpreadsheet,
  CheckSquare,
  FolderOpen,
  Receipt,
  CreditCard,
  Building2,
  DollarSign,
  TrendingUp,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Sparkles,
  UserCheck,
  Clock,
  Workflow,
  CalendarDays,
  BookOpen,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../auth/ThemeContext";
import { getRoleTitle, getRoleConfig } from "../auth/roleConfig";
import { BrandLogo } from "./BrandLogo";
import {
  fetchUnreadNotificationCount,
  fetchStaffNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../lib/notifications/notificationService";
import type { SuiteNotification } from "../types/suitePhases15To19";

interface NavItem {
  name: string;
  path: string;
  icon: any;
  badge?: string | number;
  module?: string;
  action?: "view" | "create" | "edit";
  superOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function AdminPortalLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { user, profile, logout, hasPermission } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<SuiteNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const roleTitle = getRoleTitle(profile?.role);
  const roleConfig = getRoleConfig(profile?.role);
  const isSuper = profile?.role === "super_admin" || profile?.role === "admin";

  useEffect(() => {
    if (profile?.id) {
      loadNotifs();
    }
  }, [profile?.id, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifs = async () => {
    if (!profile?.id) return;
    try {
      const [cnt, notifs] = await Promise.all([
        fetchUnreadNotificationCount(profile.id),
        fetchStaffNotifications(profile.id, "all", true),
      ]);
      setUnreadCount(cnt);
      setRecentNotifications(notifs.slice(0, 5));
    } catch (err) {
      console.warn("[AdminPortalLayout] Notification count error:", err);
    }
  };

  const handleQuickMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markNotificationAsRead(id);
    setRecentNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleQuickMarkAllRead = async () => {
    if (!profile?.id) return;
    await markAllNotificationsAsRead(profile.id);
    setRecentNotifications([]);
    setUnreadCount(0);
  };

  const handleLogout = async () => {
    await logout("logout");
  };

  // Conceptual 10-section Navigation Hierarchy
  const navigationSections: NavSection[] = [
    {
      title: "OVERVIEW",
      items: [
        { name: "Manager Workbench", path: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Notifications", path: "/admin/notifications", icon: Bell },
      ],
    },
    {
      title: "CRM",
      items: [
        { name: "Leads Pipeline", path: "/admin/leads", icon: Users, module: "crm" },
        { name: "Clients 360°", path: "/admin/clients", icon: Users, module: "crm" },
        { name: "Businesses", path: "/admin/businesses", icon: Building2, module: "crm" },
        { name: "Follow-ups", path: "/admin/follow-ups", icon: CheckSquare, module: "crm" },
        { name: "Appointments", path: "/admin/appointments", icon: CalendarDays, module: "crm" },
        { name: "Client Feedback", path: "/admin/service-quality", icon: Sparkles, module: "crm" },
        { name: "Compliance Profiles", path: "/admin/compliance-calendar", icon: ShieldCheck, module: "crm" },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        { name: "Services Catalogue", path: "/admin/services-catalog", icon: Briefcase, module: "operations" },
        { name: "Service Requests", path: "/admin/service-requests", icon: FileCheck2, module: "operations" },
        { name: "CAC Operations", path: "/admin/cac-operations", icon: FileSpreadsheet, module: "operations" },
        { name: "Tasks", path: "/admin/tasks", icon: CheckSquare, module: "operations" },
        { name: "SLA & Deadlines", path: "/admin/sla-settings", icon: Clock, module: "operations" },
        { name: "Workflows", path: "/admin/workflows", icon: Workflow, module: "operations" },
        { name: "Compliance Calendar", path: "/admin/compliance-calendar", icon: Clock, module: "operations" },
        { name: "Appointment Calendar", path: "/admin/appointments", icon: CalendarDays, module: "operations" },
        { name: "Complaints & Resolution", path: "/admin/service-quality", icon: ShieldCheck, module: "operations" },
        { name: "Knowledge Base & SOPs", path: "/admin/knowledge-base", icon: BookOpen },
        { name: "Documents", path: "/admin/documents", icon: FolderOpen, module: "operations" },
      ],
    },
    {
      title: "FINANCE",
      items: [
        { name: "Quotations", path: "/admin/quotations", icon: FileSpreadsheet, module: "finance" },
        { name: "Invoices", path: "/admin/invoices", icon: Receipt, module: "finance" },
        { name: "Payments", path: "/admin/payments", icon: CreditCard, module: "finance" },
        { name: "Expenses", path: "/admin/expenses", icon: DollarSign, module: "finance" },
        { name: "Receipt Profitability", path: "/admin/finance/receipt-profitability", icon: Receipt, module: "finance" },
        { name: "Expense Allocations", path: "/admin/finance/expense-allocations", icon: FileSpreadsheet, module: "finance" },
        { name: "Vendors", path: "/admin/vendors", icon: Building2, module: "finance" },
        { name: "Cash Flow Forecast", path: "/admin/finance/cash-flow-forecast", icon: TrendingUp, module: "finance" },
      ],
    },
    {
      title: "COMMUNICATION",
      items: [
        { name: "Client Communications", path: "/admin/communications", icon: MessageSquare },
        { name: "Message Templates", path: "/admin/communication-templates", icon: Sparkles },
      ],
    },
    {
      title: "GROWTH",
      items: [
        { name: "Campaigns & Promos", path: "/admin/campaigns", icon: Sparkles, module: "campaigns" },
        { name: "Marketing Attribution", path: "/admin/reports/marketing-attribution", icon: TrendingUp },
        { name: "Referrals & Partners", path: "/admin/referrals", icon: TrendingUp },
      ],
    },
    {
      title: "REPORTING",
      items: [
        { name: "Executive Dashboard", path: "/admin/executive-dashboard", icon: BarChart3 },
        { name: "Executive Reports", path: "/admin/reports", icon: BarChart3, module: "reports" },
        { name: "Marketing Attribution", path: "/admin/reports/marketing-attribution", icon: TrendingUp },
        { name: "Service Profitability", path: "/admin/reports/service-profitability", icon: DollarSign, module: "reports" },
        { name: "Service Quality Reports", path: "/admin/service-quality", icon: Sparkles, module: "reports" },
        { name: "Staff Performance", path: "/admin/reports/staff-performance", icon: Users, module: "reports" },
      ],
    },
    {
      title: "TEAM",
      items: [
        { name: "HR & Staff Portal", path: "/admin/hr", icon: UserCheck, module: "hr" },
        { name: "Staff Workload & Performance", path: "/admin/team/staff-performance", icon: Users },
        { name: "Approvals", path: "/admin/approvals", icon: ShieldCheck },
        { name: "Staff & RBAC", path: "/admin/team", icon: ShieldCheck, superOnly: true },
        { name: "Audit Trail", path: "/admin/audit-logs", icon: FileCheck2, superOnly: true },
      ],
    },
    {
      title: "AI ASSISTANT",
      items: [
        { name: "AI Secretary", path: "/admin/ai-secretary", icon: Bot },
      ],
    },
    {
      title: "SETTINGS",
      items: [
        { name: "Backup & Continuity", path: "/admin/backup-recovery", icon: ShieldCheck, superOnly: true },
        { name: "System Settings", path: "/admin/settings", icon: Settings, superOnly: true },
      ],
    },
  ];

  // Filter sections and items based on staff permissions
  const filteredSections = useMemo(() => {
    return navigationSections
      .map((section) => {
        const allowedItems = section.items.filter((item) => {
          if (item.superOnly && !isSuper) return false;
          if (item.module && !isSuper) {
            return hasPermission(item.module, item.action || "view");
          }
          return true;
        });
        return { ...section, items: allowedItems };
      })
      .filter((section) => section.items.length > 0);
  }, [navigationSections, isSuper, hasPermission]);

  // Find active navigation domain based on current URL path
  const activeSectionTitle = useMemo(() => {
    for (const section of filteredSections) {
      for (const item of section.items) {
        if (
          location.pathname === item.path ||
          (item.path !== "/admin/dashboard" && location.pathname.startsWith(item.path))
        ) {
          return section.title;
        }
      }
    }
    return null;
  }, [filteredSections, location.pathname]);

  // COLLAPSED BY DEFAULT: All sections start collapsed.
  // Intelligently auto-expand ONLY the active domain matching the current route.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeSectionTitle) {
      setExpandedSections({ [activeSectionTitle]: true });
    } else {
      setExpandedSections({});
    }
  }, [activeSectionTitle]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex h-full flex-col bg-[#061738] text-white select-none">
      {/* Brand Header */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-slate-800/80 px-4 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div className="flex items-center gap-3">
          <BrandLogo variant="square" size="sm" darkBackground />
          {!collapsed ? (
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-tight text-white text-base">ABLEBIZ</span>
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 uppercase tracking-widest border border-amber-400/30">
                  SUITE
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 truncate">
                Enterprise Operations
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {filteredSections.map((section) => {
          const isExpanded = !!expandedSections[section.title];

          return (
            <div key={section.title} className="space-y-1">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-amber-300 transition rounded-md hover:bg-white/5"
                  aria-expanded={isExpanded}
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform text-slate-400 ${
                      isExpanded ? "rotate-0 text-amber-400" : "-rotate-90"
                    }`}
                  />
                </button>
              ) : (
                <div className="my-2 border-t border-slate-800/80" />
              )}

              {/* In expanded sidebar, show children only if section is open. In collapsed mini-sidebar, show icons. */}
              {(!collapsed ? isExpanded : true) && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== "/admin/dashboard" &&
                        location.pathname.startsWith(item.path));

                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={() => setIsMobileOpen(false)}
                        className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                          isActive
                            ? "bg-white/12 text-white font-semibold shadow-xs ring-1 ring-amber-400/40 border-l-2 border-amber-400"
                            : "text-slate-300 hover:bg-white/8 hover:text-white"
                        } ${collapsed ? "justify-center" : ""}`}
                        title={collapsed ? item.name : undefined}
                      >
                        <item.icon
                          className={`h-4 w-4 shrink-0 transition ${
                            isActive
                              ? "text-amber-400"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        {!collapsed ? <span className="truncate">{item.name}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Operator Card & Sign Out */}
      <div className="shrink-0 border-t border-slate-800/80 p-3 bg-[#040E24]">
        {!collapsed ? (
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.full_name || user?.name || "Staff Member"}
              </p>
              <p className="text-[11px] font-medium text-amber-400 truncate">{roleTitle}</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700 text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-400 hover:bg-red-500/20 hover:text-red-200 transition ${
            collapsed ? "justify-center" : ""
          }`}
          title="Sign out of ABLEBIZ SUITE"
        >
          <LogOut className="h-4 w-4 shrink-0 text-red-400" />
          {!collapsed ? <span>Sign out</span> : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`admin-theme ${theme === "dark" ? "dark" : ""} flex h-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A] font-sans antialiased`}>
      {/* Mobile Backdrop */}
      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      ) : null}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-transform duration-300 lg:hidden shadow-2xl ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="absolute right-3 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition z-50"
          aria-label="Close mobile navigation"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent collapsed={false} />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`relative z-20 hidden flex-col shadow-lg transition-all duration-300 lg:flex ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsSidebarOpen((v) => !v)}
          className="absolute -right-3.5 top-6 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-[#061738] text-slate-300 shadow-md hover:bg-[#0A2558] hover:text-amber-400 transition"
          aria-label={isSidebarOpen ? "Collapse sidebar navigation" : "Expand sidebar navigation"}
        >
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <SidebarContent collapsed={!isSidebarOpen} />
      </aside>

      {/* Main App Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden transition"
              aria-label="Open mobile navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Global Search Bar */}
            <div className="relative hidden sm:block w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients, requests, CAC filings..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0A2558] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2558]/15 transition"
              />
            </div>
          </div>

          {/* Right Header Badges & User Status */}
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              to="/admin/ai-secretary"
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-500/20 transition shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>AI Secretary</span>
            </Link>

            {/* Notifications Popover Menu */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((v) => !v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#0A2558] transition"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.2 text-[10px] font-bold text-blue-700">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleQuickMarkAllRead}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {recentNotifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No unread alerts. You're all caught up!
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {recentNotifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.link) {
                              setIsNotifOpen(false);
                              navigate(n.link);
                            }
                          }}
                          className="p-2.5 hover:bg-slate-50/70 rounded-xl transition cursor-pointer text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 truncate">{n.title}</span>
                            <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.2 shrink-0 ${
                              n.priority === 'urgent' ? 'bg-red-100 text-red-800' : n.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {n.priority}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{n.message}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleQuickMarkRead(n.id, e)}
                              className="text-[10px] font-semibold text-slate-400 hover:text-slate-700"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between px-1 text-xs">
                    <Link
                      to="/admin/notifications"
                      onClick={() => setIsNotifOpen(false)}
                      className="font-semibold text-[#0A2558] hover:underline"
                    >
                      View all in Notification Center →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Current Staff Identity Tag */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {profile?.full_name || user?.name || "Staff Member"}
                </p>
                <p className="text-[11px] font-medium text-amber-700 leading-tight">
                  {roleTitle}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A2558] text-amber-300 font-bold text-xs shadow-xs border border-amber-400/30">
                {(profile?.full_name?.[0] || user?.name?.[0] || "S").toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Route Workspace */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 lg:p-6">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
