import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User as SupabaseAuthUser } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "../lib/supabaseClient";

export type StaffRole =
  | "super_admin"
  | "admin"
  | "operations_manager"
  | "registration_officer"
  | "accounts_officer"
  | "client_service_officer"
  | "marketing_officer"
  | "viewer"
  // Aliases for compatibility
  | "managing_director"
  | "compliance_officer"
  | "accountant"
  | "legal_officer"
  | "receptionist_support"
  | "customer";

export interface StaffProfile {
  id: string;
  auth_uid: string;
  email: string;
  full_name: string;
  role: StaffRole;
  department: string;
  phone?: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RolePermissionRule {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
}

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export interface SuiteUser {
  id: string;
  authUid: string;
  name: string;
  email: string;
  role: StaffRole;
  department: string;
  phone?: string | null;
  isActive: boolean;
  avatarUrl?: string | null;
  // Legacy compatibility helpers
  permissions: {
    dashboard: boolean;
    referrals: boolean;
    clients: boolean;
    reports: boolean;
    settings: boolean;
    users: boolean;
  };
}

interface AuthContextType {
  user: SuiteUser | null;
  profile: StaffProfile | null;
  session: Session | null;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, pass: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  hasPermission: (module: string, action?: PermissionAction) => boolean;
  refreshProfile: () => Promise<void>;
}

// Fallback baseline permission matrix aligned with DB roles_permissions
const DEFAULT_ROLE_MODULES: Record<string, Record<string, string[]>> = {
  super_admin: {
    workbench: ["view", "create", "edit", "delete", "approve", "export"],
    crm: ["view", "create", "edit", "delete", "approve", "export"],
    operations: ["view", "create", "edit", "delete", "approve", "export"],
    finance: ["view", "create", "edit", "delete", "approve", "export"],
    team: ["view", "create", "edit", "delete", "approve", "export"],
    settings: ["view", "create", "edit", "delete", "approve", "export"],
    reports: ["view", "export"],
  },
  managing_director: {
    workbench: ["view", "create", "edit", "delete", "approve", "export"],
    crm: ["view", "create", "edit", "delete", "approve", "export"],
    operations: ["view", "create", "edit", "delete", "approve", "export"],
    finance: ["view", "create", "edit", "delete", "approve", "export"],
    team: ["view", "create", "edit", "delete", "approve", "export"],
    settings: ["view", "create", "edit", "delete", "approve", "export"],
    reports: ["view", "export"],
  },
  admin: {
    workbench: ["view", "create", "edit", "approve", "export"],
    crm: ["view", "create", "edit", "approve", "export"],
    operations: ["view", "create", "edit", "approve", "export"],
    finance: ["view", "create", "edit", "approve", "export"],
    team: ["view", "export"],
    settings: ["view", "edit"],
    reports: ["view", "export"],
  },
  operations_manager: {
    workbench: ["view", "create", "edit", "approve", "export"],
    crm: ["view", "create", "edit"],
    operations: ["view", "create", "edit", "approve", "export"],
    finance: ["view"],
    reports: ["view"],
  },
  registration_officer: {
    workbench: ["view", "edit"],
    operations: ["view", "create", "edit"],
  },
  compliance_officer: {
    workbench: ["view", "edit"],
    operations: ["view", "create", "edit"],
    crm: ["view"],
  },
  legal_officer: {
    workbench: ["view", "edit"],
    operations: ["view", "create", "edit"],
    crm: ["view"],
  },
  accounts_officer: {
    workbench: ["view", "edit", "export"],
    finance: ["view", "create", "edit", "approve", "export"],
    operations: ["view"],
    reports: ["view", "export"],
  },
  accountant: {
    workbench: ["view", "edit", "export"],
    finance: ["view", "create", "edit", "approve", "export"],
    operations: ["view"],
    reports: ["view", "export"],
  },
  client_service_officer: {
    workbench: ["view", "edit"],
    crm: ["view", "create", "edit"],
    operations: ["view", "create"],
  },
  receptionist_support: {
    workbench: ["view", "edit"],
    crm: ["view", "create", "edit"],
    operations: ["view", "create"],
  },
  marketing_officer: {
    workbench: ["view"],
    crm: ["view", "create", "edit", "export"],
  },
  viewer: {
    workbench: ["view"],
    crm: ["view"],
    operations: ["view"],
    finance: ["view"],
  },
  customer: {},
};

function normalizeRole(role: string): StaffRole {
  const r = role.toLowerCase().trim();
  if (r === "managing_director" || r === "superadmin" || r === "super_admin") return "super_admin";
  if (r === "compliance_officer") return "registration_officer";
  if (r === "legal_officer") return "registration_officer";
  if (r === "accountant") return "accounts_officer";
  if (r === "receptionist_support") return "client_service_officer";
  return (r as StaffRole) || "viewer";
}

function computeLegacyPermissions(role: StaffRole): SuiteUser["permissions"] {
  const norm = normalizeRole(role);
  if (norm === "super_admin" || norm === "managing_director") {
    return { dashboard: true, referrals: true, clients: true, reports: true, settings: true, users: true };
  }
  if (norm === "admin") {
    return { dashboard: true, referrals: true, clients: true, reports: true, settings: true, users: false };
  }
  if (norm === "operations_manager") {
    return { dashboard: true, referrals: true, clients: true, reports: true, settings: false, users: false };
  }
  if (norm === "accounts_officer") {
    return { dashboard: true, referrals: false, clients: true, reports: true, settings: false, users: false };
  }
  if (norm === "client_service_officer" || norm === "marketing_officer") {
    return { dashboard: true, referrals: true, clients: true, reports: false, settings: false, users: false };
  }
  return { dashboard: true, referrals: false, clients: false, reports: false, settings: false, users: false };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [permissionsList, setPermissionsList] = useState<RolePermissionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch staff profile and role permissions from Supabase
  const loadStaffProfile = async (authUser: SupabaseAuthUser): Promise<StaffProfile | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("auth_uid", authUser.id)
        .maybeSingle();

      if (error) {
        console.error("[Auth] Error fetching staff profile:", error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      const prof = data as StaffProfile;

      // Also attempt to load database permissions for this role
      try {
        const { data: permData } = await supabase
          .from("roles_permissions")
          .select("*")
          .eq("role", prof.role);

        if (permData && Array.isArray(permData)) {
          setPermissionsList(permData as RolePermissionRule[]);
        }
      } catch (permErr) {
        console.warn("[Auth] Could not load roles_permissions:", permErr);
      }

      return prof;
    } catch (err) {
      console.error("[Auth] Unexpected profile resolution error:", err);
      return null;
    }
  };

  useEffect(() => {
    // Clear any legacy mock credentials from browser storage
    try {
      localStorage.removeItem("ablebiz_auth_users");
      sessionStorage.removeItem("ablebiz_auth_user");
    } catch {
      // Ignore storage errors
    }

    if (!supabaseEnabled || !supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    // 1. Initial Session Check
    supabase.auth.getSession().then(async ({ data: { session: initSession }, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("[Auth] Initial session error:", error.message);
        setSession(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      if (initSession?.user) {
        setSession(initSession);
        const resolvedProfile = await loadStaffProfile(initSession.user);
        if (mounted) {
          setProfile(resolvedProfile);
        }
      } else {
        setSession(null);
        setProfile(null);
      }
      if (mounted) setIsLoading(false);
    });

    // 2. Auth State Change Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !currentSession) {
        setSession(null);
        setProfile(null);
        setPermissionsList([]);
        setAuthError(null);
        setIsLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(currentSession);
        if (currentSession.user) {
          const resolvedProfile = await loadStaffProfile(currentSession.user);
          if (mounted) {
            setProfile(resolvedProfile);
          }
        }
        if (mounted) setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!supabase || !session?.user) return;
    const prof = await loadStaffProfile(session.user);
    setProfile(prof);
  };

  const login = async (email: string, pass: string): Promise<{ ok: boolean; message?: string }> => {
    if (!supabaseEnabled || !supabase) {
      return { ok: false, message: "Authentication service is currently unavailable." };
    }

    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass,
    });

    if (error) {
      const msg = error.message.includes("Invalid login credentials")
        ? "Invalid email or password. Please verify your credentials."
        : error.message;
      setAuthError(msg);
      return { ok: false, message: msg };
    }

    if (!data.session?.user) {
      return { ok: false, message: "Authentication failed. No active session returned." };
    }

    // Verify staff profile
    const prof = await loadStaffProfile(data.session.user);
    if (!prof) {
      await supabase.auth.signOut();
      const msg = "Access Denied: Your account is not configured as an authorized ABLEBIZ SUITE staff profile.";
      setAuthError(msg);
      return { ok: false, message: msg };
    }

    if (!prof.is_active) {
      await supabase.auth.signOut();
      const msg = "Access Denied: Your staff profile has been deactivated. Please contact management.";
      setAuthError(msg);
      return { ok: false, message: msg };
    }

    if ((prof.role as string) === "customer") {
      await supabase.auth.signOut();
      const msg = "Access Denied: Customer accounts do not have access to the internal ABLEBIZ SUITE portal.";
      setAuthError(msg);
      return { ok: false, message: msg };
    }

    setSession(data.session);
    setProfile(prof);
    return { ok: true };
  };

  const logout = async () => {
    setProfile(null);
    setSession(null);
    setPermissionsList([]);
    setAuthError(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const hasPermission = (module: string, action: PermissionAction = "view"): boolean => {
    if (!profile || !profile.is_active) return false;

    const norm = normalizeRole(profile.role);
    if (norm === "super_admin" || norm === "managing_director") return true;

    // Check database permission rules first
    if (permissionsList.length > 0) {
      const rule = permissionsList.find((p) => p.module === module);
      if (rule) {
        if (action === "view") return rule.can_view;
        if (action === "create") return rule.can_create;
        if (action === "edit") return rule.can_edit;
        if (action === "delete") return rule.can_delete;
        if (action === "approve") return rule.can_approve;
        if (action === "export") return rule.can_export;
      }
    }

    // Fallback to role-module defaults
    const roleRules = DEFAULT_ROLE_MODULES[norm] || DEFAULT_ROLE_MODULES[profile.role];
    if (!roleRules) return false;
    const actions = roleRules[module];
    return actions ? actions.includes(action) : false;
  };

  const suiteUser: SuiteUser | null = useMemo(() => {
    if (!profile || !profile.is_active) return null;
    return {
      id: profile.id,
      authUid: profile.auth_uid,
      name: profile.full_name,
      email: profile.email,
      role: profile.role,
      department: profile.department,
      phone: profile.phone,
      isActive: profile.is_active,
      avatarUrl: profile.avatar_url,
      permissions: computeLegacyPermissions(profile.role),
    };
  }, [profile]);

  const value = useMemo(
    () => ({
      user: suiteUser,
      profile,
      session,
      isLoading,
      authError,
      login,
      logout,
      hasPermission,
      refreshProfile,
    }),
    [suiteUser, profile, session, isLoading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
