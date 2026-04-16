import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, Mail, ShieldAlert } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";

export function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/admin-porter/dashboard";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const success = login(email, password);
    if (success) {
      navigate(from, { replace: true });
    } else {
      setError("Invalid email or password. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/20 mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            ABLEBIZ <span className="text-emerald-400">PORTER</span>
          </h1>
          <p className="mt-2 text-slate-400 text-sm font-medium">
            Enter your credentials to access the business management suite.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-white/10">
          <form onSubmit={handleSubmit} className="grid gap-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 ring-1 ring-red-100">
                <ShieldAlert className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="admin@ablebiz.com"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="h-12 mt-2 shadow-lg shadow-emerald-500/20">
              Sign In to Porter
            </Button>
          </form>

          <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-[10px] text-slate-400 text-center leading-relaxed">
            PRO TIP: Use <span className="font-bold text-slate-600">admin@ablebiz.com</span> (pass: admin123) for Admin role or <span className="font-bold text-slate-600">super@ablebiz.com</span> (pass: super123) for Superadmin.
          </div>
        </div>
      </div>
    </div>
  );
}
