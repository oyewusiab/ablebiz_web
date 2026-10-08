import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase, supabaseEnabled } from "../../lib/supabaseClient";
import { BrandLogo } from "../../components/BrandLogo";

export function AdminResetPasswordPage() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isRecoverySessionActive, setIsRecoverySessionActive] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function evaluateSession() {
      if (!supabaseEnabled || !supabase) {
        if (isMounted) {
          setSessionError("Authentication service is currently unavailable.");
          setIsLoadingSession(false);
        }
        return;
      }

      try {
        // 1. Check current session in Supabase Auth client
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          if (isMounted) {
            setSessionError(error.message);
            setIsRecoverySessionActive(false);
            setIsLoadingSession(false);
          }
          return;
        }

        if (session) {
          if (isMounted) {
            setIsRecoverySessionActive(true);
            setIsLoadingSession(false);
          }
        } else {
          // If no session yet, listen to auth state changes for PASSWORD_RECOVERY or SIGNED_IN event
          // which fires automatically when Supabase parses hash/query tokens from recovery URL.
          const { data: authListener } = supabase.auth.onAuthStateChange((event, eventSession) => {
            if (!isMounted) return;
            if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && eventSession)) {
              setIsRecoverySessionActive(true);
              setIsLoadingSession(false);
            }
          });

          // Timeout fallback in case URL lacks valid tokens or link expired
          setTimeout(() => {
            if (isMounted && isLoadingSession) {
              supabase.auth.getSession().then(({ data: { session: checkAgain } }) => {
                if (isMounted) {
                  if (checkAgain) {
                    setIsRecoverySessionActive(true);
                  } else {
                    setIsRecoverySessionActive(false);
                    setSessionError(
                      "Invalid or expired recovery link. Please request a new password reset email."
                    );
                  }
                  setIsLoadingSession(false);
                }
              });
            }
          }, 1500);

          return () => {
            authListener.subscription.unsubscribe();
          };
        }
      } catch (err: any) {
        if (isMounted) {
          setSessionError(err?.message || "Failed to establish recovery session.");
          setIsLoadingSession(false);
        }
      }
    }

    evaluateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setStatusError(null);

    // Validation
    if (!newPassword || newPassword.length < 8) {
      setValidationError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match. Please re-enter.");
      return;
    }

    if (!supabase) {
      setStatusError("Authentication service is unavailable.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call Supabase Auth updatePassword without manual DB password modifications
      // and without displaying/logging any tokens
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setStatusError(error.message || "Failed to update password. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setIsSubmitting(false);

      // Sign out recovery session to require fresh explicit login with new credentials
      try {
        await supabase.auth.signOut();
      } catch {
        // Signout cleanup
      }

      // Safe redirect to /admin/login after brief confirmation
      setTimeout(() => {
        navigate("/admin/login", {
          replace: true,
          state: {
            message: "Password reset successfully. Please sign in with your new password.",
          },
        });
      }, 3000);
    } catch (err: any) {
      setStatusError(err?.message || "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12 relative">
      <div className="absolute inset-0 bg-[radial-gradient(#0A2558_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <BrandLogo variant="landscape" size="lg" priority />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#0A2558]">ABLEBIZ SUITE</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Internal Operations Portal — Password Recovery
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
          {isLoadingSession ? (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
              <p className="text-sm text-slate-300">Verifying secure recovery token...</p>
            </div>
          ) : success ? (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Password Reset Complete!</h2>
              <p className="text-sm text-slate-300">
                Your password has been successfully updated. Redirecting to login in a moment...
              </p>
              <div className="pt-2">
                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300"
                >
                  Go to Login immediately <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : !isRecoverySessionActive ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{sessionError || "Recovery link has expired or is invalid."}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                For security reasons, password recovery tokens expire after use or after a configured time window. Please request a new recovery link from the login page.
              </p>
              <Link
                to="/admin/login"
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 pb-1 text-[#0A2558] text-xs font-bold uppercase tracking-wider">
                <KeyRound className="h-4 w-4 text-[#D97706]" />
                <span>Set New Password</span>
              </div>

              {validationError || statusError ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{validationError || statusError}</span>
                </div>
              ) : null}

              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  New Password
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    required
                    minLength={8}
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

              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Confirm Password
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>
              </label>

              <p className="text-[11px] text-slate-500 pt-0.5">Password must be at least 8 characters.</p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A2558] text-sm font-bold text-white transition hover:bg-[#061738] active:translate-y-px disabled:opacity-70 shadow-md shadow-[#0A2558]/10"
              >
                {isSubmitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Update Password & Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/admin/login"
                  className="text-xs text-slate-500 hover:text-[#0A2558] transition"
                >
                  Cancel and return to login
                </Link>
              </div>
            </form>
          )}

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Encrypted end-to-end via Supabase Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
}
