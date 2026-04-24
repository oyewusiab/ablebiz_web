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
    <div className="admin-theme flex min-h-screen items-center justify-center bg-[var(--color-neutral-950)] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_34%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-600)] text-white shadow-[var(--admin-shadow-lg)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Admin portal</h1>
          <p className="mt-2 text-sm text-[var(--color-neutral-400)]">
            Secure access for the ABLEBIZ operations team.
          </p>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-white/10 bg-white/5 p-6 shadow-[var(--admin-shadow-lg)] backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-neutral-400)]">
                Email
              </span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-neutral-500)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-md)] border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-[var(--color-primary-400)]"
                  placeholder="admin@ablebiz.com"
                  required
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-neutral-400)]">
                Password
              </span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-neutral-500)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-md)] border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-[var(--color-primary-400)]"
                  placeholder="Enter password"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-600)] text-sm font-medium text-white transition hover:bg-[var(--color-primary-500)] disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Access portal
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-[var(--color-neutral-400)]">
            <p>
              Standard: <span className="text-[var(--color-primary-300)]">admin@ablebiz.com</span> / admin123
            </p>
            <p className="mt-1">
              Super: <span className="text-[var(--color-primary-300)]">super@ablebiz.com</span> / super123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
