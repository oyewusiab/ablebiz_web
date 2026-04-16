import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Role = "admin" | "superadmin";

interface User {
  email: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("ablebiz_auth_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, pass: string): boolean => {
    // Mock credentials
    let role: Role | null = null;
    if (email === "admin@ablebiz.com" && pass === "admin123") {
      role = "admin";
    } else if (email === "super@ablebiz.com" && pass === "super123") {
      role = "superadmin";
    }

    if (role) {
      const u = { email, role };
      setUser(u);
      localStorage.setItem("ablebiz_auth_user", JSON.stringify(u));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("ablebiz_auth_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
