import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AdminPermission, type Role } from "./AuthContext";

interface Props {
  children: ReactNode;
  requiredRole?: Role;
  requiredPermission?: AdminPermission;
}

export function ProtectedRoute({ children, requiredRole, requiredPermission }: Props) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--ablebiz-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== "superadmin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (requiredPermission && user.role !== "superadmin" && !user.permissions[requiredPermission]) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
