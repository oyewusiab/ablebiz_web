import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Lock,
  Mail,
  ShieldAlert,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase, supabaseEnabled } from "../../lib/supabaseClient";

export function AdminLoginPage() {
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin/dashboard";
  const incomingMessage = location.state?.message;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(location.state?.error || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password flow
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.ok) {
        navigate(from, { replace: true });
        return;
      }

      setError(result.message || "Invalid credentials. Please verify and try again.");
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during authentication.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess(false);

    if (!forgotEmail) {
      setForgotError("Please enter your staff email address.");
      return;
    }

    if (!supabaseEnabled || !supabase) {
      setForgotError("Authentication service is currently unavailable.");
      return;
    }

    setForgotLoading(true);

    try {
      const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const redirectOrigin = isLocal ? window.location.origin : "https://www.ablebiz.com.ng";
      const redirectTo = `${redirectOrigin}/admin/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim().toLowerCase(),
        {
          redirectTo,
        }
      );

      if (error) {
        setForgotError(error.message || "Failed to send reset instructions.");
      } else {
        setForgotSuccess(true);
      }
    } catch (err: any) {
      setForgotError(err?.message || "An unexpected error occurred.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center bg-[#061738] px-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(10,37,88,0.6),transparent_45%)]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 p-2 border border-white/20 shadow-2xl backdrop-blur-md">
            <img src="/images/ablebiz-logo.png" alt="ABLEBIZ" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            ABLEBIZ SUITE
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Internal Operations & Staff Management Portal
          </p>
        </div>

        {/* Authentication Card */}
        <div className="rounded-2xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          {incomingMessage ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{incomingMessage}</span>
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Staff Email Address
              </span>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  placeholder="staff@ablebiz.com.ng"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="block space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 transition underline underline-offset-2"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-11 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
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
                  Sign In to Suite
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-slate-400">
            <p>
              Protected by Supabase Auth and Database RLS.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Internal access only. Unauthorized attempts are logged.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-[#0a1e46] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reset Staff Password</h3>
                <p className="text-xs text-slate-300">
                  Receive a recovery link to restore your Suite account
                </p>
              </div>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Recovery email sent!</p>
                    <p className="mt-1 text-xs text-emerald-300">
                      If an account exists for <strong className="text-white">{forgotEmail}</strong>, a secure password reset link has been dispatched.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  Follow the link inside the email to complete password recovery.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSuccess(false);
                  }}
                  className="h-11 w-full rounded-xl bg-amber-500 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-4">
                {forgotError && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
                    <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your registered staff email address. A recovery email with a secure one-time link will be sent to reset your password.
                </p>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Staff Email Address
                  </span>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="h-12 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                      placeholder="staff@ablebiz.com.ng"
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotError("");
                    }}
                    disabled={forgotLoading}
                    className="h-11 flex-1 rounded-xl border border-white/20 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="h-11 flex-1 rounded-xl bg-amber-500 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
