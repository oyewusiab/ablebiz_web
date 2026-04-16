import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  History, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck,
  CircleUser
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function AdminPortalLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: "Dashboard", path: "/admin-porter/dashboard", icon: LayoutDashboard },
    { name: "Referrals", path: "/admin-porter/referrals", icon: History },
    { name: "Clients", path: "/admin-porter/clients", icon: Users },
    { name: "Reports", path: "/admin-porter/reports", icon: BarChart3 },
    { name: "Settings", path: "/admin-porter/settings", icon: Settings, superOnly: true },
  ];

  const handleLogout = () => {
    logout();
    navigate("/admin-porter/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } flex flex-col bg-slate-900 transition-all duration-300 ease-in-out border-r border-slate-800`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {isSidebarOpen ? (
            <span className="text-xl font-black tracking-tighter text-white">
              ABLEBIZ <span className="text-emerald-400">PORTER</span>
            </span>
          ) : (
            <span className="text-xl font-black text-emerald-400 mx-auto">A</span>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-6 flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            if (item.superOnly && user?.role !== "superadmin") return null;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  isActive(item.path)
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive(item.path) ? "text-white" : ""}`} />
                {isSidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
           <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div className="flex items-center gap-4 lg:hidden">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="text-lg font-bold text-slate-900">ABLEBIZ</span>
          </div>

          <div className="hidden lg:block text-sm font-medium text-slate-500">
            Welcome back, <span className="text-slate-900 font-bold">{user?.email.split('@')[0]}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
              {user?.role === "superadmin" ? (
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
              ) : (
                <CircleUser className="h-3 w-3 text-blue-600" />
              )}
              {user?.role === "superadmin" ? "SUPERADMIN" : "ADMIN"}
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
