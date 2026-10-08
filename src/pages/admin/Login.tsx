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
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase, supabaseEnabled } from "../../lib/supabaseClient";
import { BrandLogo } from "../../components/BrandLogo";

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
    <div className="admin-theme flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12 relative">
      {/* Subtle background ambient styling */}
      <div className="absolute inset-0 bg-[radial-gradient(#0A2558_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <BrandLogo variant="landscape" size="lg" priority />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#0A2558]">
            ABLEBIZ SUITE
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Internal Operations & Enterprise Business Platform
          </p>
        </div>

        {/* Authentication Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
          {incomingMessage ? (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{incomingMessage}</span>
            </div>
          ) : null}

          {error ? (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Staff Email Address
              </span>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
                  placeholder="staff@ablebiz.com.ng"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-medium text-[#D97706] hover:text-[#B45309] transition hover:underline"
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
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-[#0A2558]/20"
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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A2558] text-sm font-bold text-white transition hover:bg-[#061738] active:translate-y-px disabled:opacity-70 shadow-md shadow-[#0A2558]/10"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Sign In to Suite
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400 space-y-1">
            <p className="flex items-center justify-center gap-1.5 text-slate-500 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0A2558]" />
              Protected by Supabase Auth & Row-Level Security
            </p>
            <p className="text-[11px] text-slate-400">
              Internal access only. Unauthorized attempts are logged.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Staff Password</h3>
                <p className="text-xs text-slate-500">
                  Receive a recovery link to restore your Suite account
                </p>
              </div>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <p className="font-semibold">Recovery email sent!</p>
                    <p className="mt-1 text-emerald-700">
                      If an account exists for <strong className="text-slate-900">{forgotEmail}</strong>, a secure password reset link has been dispatched.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Follow the link inside the email to complete password recovery.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSuccess(false);
                  }}
                  className="h-10 w-full rounded-xl bg-[#0A2558] text-xs font-bold text-white transition hover:bg-[#061738]"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-4">
                {forgotError && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered staff email address. A recovery link will be sent to establish a new password.
                </p>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Staff Email Address
                  </span>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
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
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="h-10 flex-1 rounded-xl bg-[#0A2558] text-xs font-bold text-white transition hover:bg-[#061738] disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
