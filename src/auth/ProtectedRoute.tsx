import { useState, useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert, LogOut } from "lucide-react";
import { useAuth, type StaffRole, type PermissionAction } from "./AuthContext";

interface Props {
  children: ReactNode;
  requiredRole?: StaffRole | StaffRole[];
  requiredModule?: string;
  requiredAction?: PermissionAction;
  // Legacy compatibility
  requiredPermission?: "dashboard" | "referrals" | "clients" | "reports" | "settings" | "users";
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredModule,
  requiredAction = "view",
  requiredPermission,
}: Props) {
  const { user, profile, isLoading, logout, hasPermission, refreshProfile, authError } = useAuth();
  const location = useLocation();
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSlowWarning(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowSlowWarning(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#061738] p-4 text-white">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Verifying ABLEBIZ session...</p>
          {showSlowWarning && (
            <div className="mt-2 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300 backdrop-blur-md">
              <p>Session verification is taking longer than expected.</p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshProfile()}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-amber-400 transition"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20 transition"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 1. Unauthenticated: Redirect to login
  if (!user || !profile) {
    return <Navigate to="/admin/login" state={{ from: location, error: authError || undefined }} replace />;
  }

  // 2. Inactive account or customer
  if (!profile.is_active || (profile.role as string) === "customer") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#061738] p-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-300">
            {!profile.is_active
              ? "Your staff account has been deactivated. Please contact an administrator."
              : "Customer accounts are not authorized to access internal ABLEBIZ SUITE operations."}
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. First-login Password Change Requirement
  if (profile.must_change_password && location.pathname !== "/admin/change-password") {
    return <Navigate to="/admin/change-password" replace />;
  }

  // 4. Role Check (if specified)
  if (requiredRole) {
    const rolesArray = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const isSuper = profile.role === "super_admin" || (profile.role as string) === "managing_director";
    if (!isSuper && !rolesArray.includes(profile.role)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#061738] p-4 text-white">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold">Restricted Module</h2>
            <p className="mt-2 text-sm text-slate-300">
              Your assigned role ({profile.role}) does not have permission to access this area.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Navigate to="/admin/dashboard" replace />
            </div>
          </div>
        </div>
      );
    }
  }

  // 4. Module Permission Check (Modern)
  if (requiredModule) {
    const isSuper = profile.role === "super_admin" || (profile.role as string) === "managing_director";
    if (!isSuper && !hasPermission(requiredModule, requiredAction)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  // 5. Legacy Permission Check (Backward compatibility)
  if (requiredPermission) {
    const isSuper = profile.role === "super_admin" || (profile.role as string) === "managing_director";
    if (!isSuper && !user.permissions[requiredPermission]) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
