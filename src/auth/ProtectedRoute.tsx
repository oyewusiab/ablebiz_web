import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, Role } from "./AuthContext";

interface Props {
  children: ReactNode;
  requiredRole?: Role;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
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
    return <Navigate to="/admin-porter/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== "superadmin") {
    return <Navigate to="/admin-porter/dashboard" replace />;
  }

  return <>{children}</>;
}
