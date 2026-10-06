import { useState } from "react";
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
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getRoleTitle, getRoleConfig } from "../auth/roleConfig";

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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const { user, profile, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const roleTitle = getRoleTitle(profile?.role);
  const roleConfig = getRoleConfig(profile?.role);
  const isSuper = profile?.role === "super_admin" || profile?.role === "admin";

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
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
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        { name: "Services Catalogue", path: "/admin/services-catalog", icon: Briefcase, module: "operations" },
        { name: "Service Requests", path: "/admin/service-requests", icon: FileCheck2, module: "operations" },
        { name: "CAC Operations", path: "/admin/cac-operations", icon: FileSpreadsheet, module: "operations" },
        { name: "Tasks", path: "/admin/tasks", icon: CheckSquare, module: "operations" },
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
        { name: "Vendors", path: "/admin/vendors", icon: Building2, module: "finance" },
      ],
    },
    {
      title: "COMMUNICATION",
      items: [
        { name: "Client Communications", path: "/admin/communications", icon: MessageSquare, module: "crm" },
      ],
    },
    {
      title: "GROWTH",
      items: [
        { name: "Referrals & Partners", path: "/admin/referrals", icon: TrendingUp },
      ],
    },
    {
      title: "REPORTING",
      items: [
        { name: "Executive Reports", path: "/admin/reports", icon: BarChart3, module: "reports" },
      ],
    },
    {
      title: "TEAM",
      items: [
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
        { name: "System Settings", path: "/admin/settings", icon: Settings, superOnly: true },
      ],
    },
  ];

  // Filter sections and items based on staff permissions
  const filteredSections = navigationSections
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

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex h-full flex-col bg-[#043F2E] text-white select-none">
      {/* Brand Header */}
      <div className={`flex h-16 shrink-0 items-center border-b border-emerald-900/60 px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 p-1.5 border border-white/20 shadow-inner">
            <img src="/images/ablebiz-logo.png" alt="ABLEBIZ" className="h-full w-full object-contain" />
          </div>
          {!collapsed ? (
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">ABLEBIZ</span>
                <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] font-semibold text-emerald-300 uppercase tracking-widest border border-emerald-500/30">
                  SUITE
                </span>
              </div>
              <p className="text-[11px] font-medium text-emerald-300/80 truncate">Operations Platform</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5 scrollbar-thin scrollbar-thumb-emerald-800 scrollbar-track-transparent">
        {filteredSections.map((section) => {
          const isCollapsed = collapsedSections[section.title];
          return (
            <div key={section.title} className="space-y-1">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300/60 hover:text-emerald-200 transition"
                >
                  <span>{section.title}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
              ) : (
                <div className="my-2 border-t border-emerald-900/40" />
              )}

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== "/admin/dashboard" && location.pathname.startsWith(item.path));
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={() => setIsMobileOpen(false)}
                        className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                          isActive
                            ? "bg-emerald-800/90 text-white font-semibold shadow-xs ring-1 ring-emerald-500/40"
                            : "text-emerald-100/70 hover:bg-emerald-900/50 hover:text-white"
                        } ${collapsed ? "justify-center" : ""}`}
                        title={collapsed ? item.name : undefined}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 transition ${isActive ? "text-emerald-300" : "text-emerald-400/80 group-hover:text-emerald-200"}`} />
                        {!collapsed ? (
                          <span className="truncate">{item.name}</span>
                        ) : null}
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
      <div className="shrink-0 border-t border-emerald-900/60 p-3 bg-emerald-950/40">
        {!collapsed ? (
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{profile?.full_name || user?.name || "Staff Member"}</p>
              <p className="text-[11px] font-medium text-emerald-400 truncate">{roleTitle}</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-800/60 border border-emerald-700/40 text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-emerald-300/80 hover:bg-red-500/20 hover:text-red-200 transition ${
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
    <div className="admin-theme flex h-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A] font-sans antialiased">
      {/* Mobile Backdrop */}
      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      ) : null}

      {/* Mobile Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-transform duration-300 lg:hidden ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="absolute right-3 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition z-50"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent collapsed={false} />
      </aside>

      {/* Desktop Sidebar */}
      <aside className={`relative z-20 hidden flex-col shadow-lg transition-all duration-300 lg:flex ${isSidebarOpen ? "w-64" : "w-20"}`}>
        <button
          type="button"
          onClick={() => setIsSidebarOpen((v) => !v)}
          className="absolute -right-3.5 top-6 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-800 bg-[#043F2E] text-emerald-200 shadow-md hover:bg-emerald-800 transition"
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
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
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Global Search Bar Placeholder */}
            <div className="relative hidden sm:block w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients, requests, CAC filings..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/10 transition"
              />
            </div>
          </div>

          {/* Right Header Badges & User Status */}
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              to="/admin/ai-secretary"
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span>AI Secretary</span>
            </Link>

            <Link
              to="/admin/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Link>

            {/* Current Staff Identity Tag */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {profile?.full_name || user?.name || "Staff Member"}
                </p>
                <p className="text-[11px] font-medium text-emerald-700 leading-tight">
                  {roleTitle}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-800 text-white font-bold text-xs shadow-xs">
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
