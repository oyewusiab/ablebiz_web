import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

export function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin/dashboard";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const ok = login(email, password);

    if (ok) {
      navigate(from, { replace: true });
      return;
    }

    setError("Invalid credentials. Please try again.");
    setIsSubmitting(false);
  };

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center bg-[#061738] px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(10,37,88,0.6),transparent_45%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 p-2 border border-white/20 shadow-2xl backdrop-blur-md">
            <img src="/images/ablebiz-logo.png" alt="ABLEBIZ" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Admin Portal</h1>
          <p className="mt-2 text-sm text-slate-300">
            Secure operations access for ABLEBIZ Business Services.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email
              </span>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  placeholder="admin@ablebiz.com"
                  required
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </span>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  placeholder="Enter password"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-sm font-bold text-slate-950 transition hover:from-amber-600 hover:to-amber-700 disabled:opacity-70 shadow-lg"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
              ) : (
                <>
                  Access Portal
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-slate-400">
            <p>
              Standard: <span className="font-semibold text-amber-300">admin@ablebiz.com</span> / admin123
            </p>
            <p className="mt-1">
              Super: <span className="font-semibold text-amber-300">super@ablebiz.com</span> / super123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
