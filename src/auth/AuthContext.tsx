import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Role = "admin" | "superadmin";
export type AdminPermission = "dashboard" | "referrals" | "clients" | "reports" | "settings" | "users";

type PermissionMap = Record<AdminPermission, boolean>;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: PermissionMap;
}

type StoredUser = User & {
  password: string;
  active: boolean;
  createdAt: string;
};

interface AuthContextType {
  user: User | null;
  users: StoredUser[];
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  isLoading: boolean;
  addUser: (input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    permissions?: Partial<PermissionMap>;
  }) => { ok: boolean; message: string };
  updateUser: (
    id: string,
    updates: Partial<Pick<StoredUser, "name" | "email" | "role" | "active">> & {
      permissions?: Partial<PermissionMap>;
    }
  ) => { ok: boolean; message: string };
  removeUser: (id: string) => { ok: boolean; message: string };
  updateUserPassword: (id: string, password: string) => { ok: boolean; message: string };
}

const STORAGE_KEY = "ablebiz_auth_users";
const SESSION_KEY = "ablebiz_auth_user";

const defaultPermissionsByRole: Record<Role, PermissionMap> = {
  admin: {
    dashboard: true,
    referrals: true,
    clients: true,
    reports: true,
    settings: false,
    users: false,
  },
  superadmin: {
    dashboard: true,
    referrals: true,
    clients: true,
    reports: true,
    settings: true,
    users: true,
  },
};

function sanitizeUser(user: StoredUser): User {
  const { password: _password, active: _active, createdAt: _createdAt, ...safeUser } = user;
  return safeUser;
}

function mergePermissions(role: Role, permissions?: Partial<PermissionMap>): PermissionMap {
  return { ...defaultPermissionsByRole[role], ...(permissions || {}) };
}

function getDefaultUsers(): StoredUser[] {
  return [
    {
      id: "admin-default",
      name: "Admin User",
      email: "admin@ablebiz.com",
      password: "admin123",
      role: "admin",
      permissions: mergePermissions("admin"),
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "super-default",
      name: "Super Admin",
      email: "super@ablebiz.com",
      password: "super123",
      role: "superadmin",
      permissions: mergePermissions("superadmin"),
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

function loadUsers(): StoredUser[] {
  const fallback = getDefaultUsers();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(saved) as StoredUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }

    return parsed.map((user) => ({
      ...user,
      permissions: mergePermissions(user.role, user.permissions),
    }));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadedUsers = loadUsers();
    setUsers(loadedUsers);

    const savedSession = sessionStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as User;
        const matched = loadedUsers.find((item) => item.id === parsed.id);
        if (matched && matched.active) {
          const nextUser = sanitizeUser(matched);
          setUser(nextUser);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  const persistUsers = (nextUsers: StoredUser[]) => {
    setUsers(nextUsers);
    saveUsers(nextUsers);

    if (user) {
      const matched = nextUsers.find((item) => item.id === user.id);
      if (!matched || !matched.active) {
        setUser(null);
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        const nextUser = sanitizeUser(matched);
        setUser(nextUser);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
      }
    }
  };

  const login = (email: string, pass: string): boolean => {
    const matched = users.find(
      (item) =>
        item.email.trim().toLowerCase() === email.trim().toLowerCase() &&
        item.password === pass &&
        item.active
    );

    if (!matched) return false;

    const nextUser = sanitizeUser(matched);
    setUser(nextUser);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    return true;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const addUser: AuthContextType["addUser"] = ({ name, email, password, role, permissions }) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim() || !normalizedEmail || !password.trim()) {
      return { ok: false, message: "Name, email, and password are required." };
    }

    if (users.some((item) => item.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, message: "A user with that email already exists." };
    }

    const nextUser: StoredUser = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      password: password.trim(),
      role,
      permissions: mergePermissions(role, permissions),
      active: true,
      createdAt: new Date().toISOString(),
    };

    persistUsers([nextUser, ...users]);
    return { ok: true, message: "User added successfully." };
  };

  const updateUser: AuthContextType["updateUser"] = (id, updates) => {
    const existing = users.find((item) => item.id === id);
    if (!existing) return { ok: false, message: "User not found." };

    const nextRole = updates.role || existing.role;
    const nextUser: StoredUser = {
      ...existing,
      ...updates,
      email: updates.email ? updates.email.trim().toLowerCase() : existing.email,
      name: updates.name ? updates.name.trim() : existing.name,
      role: nextRole,
      permissions: mergePermissions(nextRole, {
        ...(nextRole === existing.role ? existing.permissions : undefined),
        ...(updates.permissions || {}),
      }),
    };

    const duplicate = users.find(
      (item) => item.id !== id && item.email.toLowerCase() === nextUser.email.toLowerCase()
    );
    if (duplicate) return { ok: false, message: "Another user already uses that email." };

    persistUsers(users.map((item) => (item.id === id ? nextUser : item)));
    return { ok: true, message: "User updated successfully." };
  };

  const removeUser: AuthContextType["removeUser"] = (id) => {
    if (user?.id === id) return { ok: false, message: "You cannot remove your current session." };
    const target = users.find((item) => item.id === id);
    if (!target) return { ok: false, message: "User not found." };
    if (target.role === "superadmin" && users.filter((item) => item.role === "superadmin").length === 1) {
      return { ok: false, message: "At least one superadmin must remain." };
    }

    persistUsers(users.filter((item) => item.id !== id));
    return { ok: true, message: "User removed successfully." };
  };

  const updateUserPassword: AuthContextType["updateUserPassword"] = (id, password) => {
    if (!password.trim() || password.trim().length < 6) {
      return { ok: false, message: "Password must be at least 6 characters." };
    }
    const target = users.find((item) => item.id === id);
    if (!target) return { ok: false, message: "User not found." };

    persistUsers(
      users.map((item) =>
        item.id === id
          ? {
              ...item,
              password: password.trim(),
            }
          : item
      )
    );
    return { ok: true, message: "Password updated successfully." };
  };

  const value = useMemo(
    () => ({
      user,
      users,
      login,
      logout,
      isLoading,
      addUser,
      updateUser,
      removeUser,
      updateUserPassword,
    }),
    [user, users, isLoading]
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
