import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, KeyRound, LogOut } from "lucide-react";
import { supabase, supabaseEnabled } from "../../lib/supabaseClient";
import { invokeStaffProvision } from "../../lib/staffProvisioning";
import { useAuth } from "../../auth/AuthContext";

export function AdminChangePasswordPage() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [isRetryingClearFlag, setIsRetryingClearFlag] = useState(false);
  const [passwordAlreadyUpdated, setPasswordAlreadyUpdated] = useState(false);

  const handleRetryClearFlag = async () => {
    if (!supabaseEnabled || !supabase) {
      setStatusError("Authentication service is unavailable.");
      return;
    }

    setIsRetryingClearFlag(true);
    setStatusError(null);

    try {
      const { data, error: rpcErr } = await supabase.rpc("clear_own_password_change_flag");

      if (rpcErr || (data && data.success === false)) {
        setStatusError(
          "Password has been changed, but finalizing your account setup failed: " +
            (rpcErr?.message || "RPC error") +
            ". Click 'Retry Account Initialization' to complete setup."
        );
        setIsRetryingClearFlag(false);
        return;
      }

      await refreshProfile();
      setSuccess(true);
      setIsRetryingClearFlag(false);

      setTimeout(() => {
        navigate("/admin/dashboard", { replace: true });
      }, 1500);
    } catch (err: any) {
      setStatusError(
        "Unexpected error clearing account setup flag: " + (err?.message || "Unknown error") + ". Click 'Retry Account Initialization' to try again."
      );
      setIsRetryingClearFlag(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setStatusError(null);

    // Validate inputs
    if (!currentPassword) {
      setValidationError("Please enter your current temporary password.");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setValidationError("New password must be at least 8 characters long.");
      return;
    }

    // Disallow trivial or default passwords
    if (newPassword.toLowerCase().includes("welcome1") || newPassword.toLowerCase() === "password123") {
      setValidationError("Password is too common. Please select a secure, unique password.");
      return;
    }

    if (newPassword === currentPassword) {
      setValidationError("New password must be different from your current temporary password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match. Please re-enter.");
      return;
    }

    if (!supabaseEnabled || !supabase) {
      setStatusError("Authentication service is unavailable.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Verify current temporary password first by re-authenticating
      if (user?.email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInErr) {
          setStatusError("Current temporary password is incorrect. Please check and try again.");
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Update to new password via Supabase Auth
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        setStatusError(updateErr.message || "Failed to update password. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Password change in Auth succeeded!
      setPasswordAlreadyUpdated(true);

      // 3. Clear must_change_password flag via authoritative, narrowly scoped RPC
      const { data, error: rpcErr } = await supabase.rpc("clear_own_password_change_flag");

      if (rpcErr || (data && data.success === false)) {
        setStatusError(
          "Your password was updated successfully in the authentication system, but finalizing your internal profile flag encountered an error: " +
            (rpcErr?.message || "RPC error") +
            ". Please click 'Retry Account Initialization' below."
        );
        setIsSubmitting(false);
        return;
      }

      // 4. Refresh profile state in AuthContext so ProtectedRoute immediately allows Suite access
      await refreshProfile();

      setSuccess(true);
      setIsSubmitting(false);

      setTimeout(() => {
        navigate("/admin/dashboard", { replace: true });
      }, 1500);
    } catch (err: any) {
      setStatusError(err?.message || "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center bg-[#061738] px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(10,37,88,0.6),transparent_45%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 p-2 border border-white/20 shadow-2xl backdrop-blur-md">
            <img src="/images/ablebiz-logo.png" alt="ABLEBIZ" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Security Initialization</h1>
          <p className="mt-1 text-xs text-slate-300">
            Mandatory Password Setup for New Staff Accounts
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
          {success ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Password Updated Successfully</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your permanent password has been established. Loading your internal ABLEBIZ Suite workspace...
              </p>
              <div className="pt-2">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-full animate-pulse bg-amber-400" />
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="flex items-center gap-2 pb-1 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <KeyRound className="h-4 w-4" />
                <span>Establish Permanent Password</span>
              </div>

              <div className="rounded-xl border border-amber-200/20 bg-amber-500/10 p-3 text-amber-200 text-[11px] leading-relaxed">
                <p className="font-semibold text-white">Initial Login Detected</p>
                <p className="mt-0.5">
                  Welcome to ABLEBIZ Suite, <strong>{profile?.full_name || user?.name || "Staff Member"}</strong>.
                  For platform security and compliance, you must replace your temporary credential with a private password before accessing operational tools.
                </p>
              </div>

              {validationError || statusError ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/20 p-3 text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{validationError || statusError}</span>
                </div>
              ) : null}

              <label className="block space-y-1.5">
                <span className="font-semibold uppercase tracking-wider text-slate-300 text-[11px]">
                  Current / Temporary Password *
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-4 text-white placeholder:text-slate-500 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    placeholder="Enter assigned temporary password"
                    required
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold uppercase tracking-wider text-slate-300 text-[11px]">
                  New Permanent Password *
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-4 text-white placeholder:text-slate-500 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold uppercase tracking-wider text-slate-300 text-[11px]">
                  Confirm New Password *
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-4 text-white placeholder:text-slate-500 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    placeholder="Repeat new password"
                    required
                    minLength={8}
                  />
                </div>
              </label>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-[11px]">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-white/20 bg-black/20 text-amber-500"
                  />
                  <span>Show passwords</span>
                </label>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Password Security Standards:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Minimum 8 characters in length</li>
                  <li>Must not match generic terms (e.g. "Welcome1", "password123")</li>
                  <li>Must be distinct from the initial temporary credential</li>
                </ul>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                {passwordAlreadyUpdated && statusError ? (
                  <button
                    type="button"
                    onClick={handleRetryClearFlag}
                    disabled={isRetryingClearFlag}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {isRetryingClearFlag ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        <span>Finalizing Setup...</span>
                      </div>
                    ) : (
                      <span>Retry Account Initialization</span>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        <span>Updating Password...</span>
                      </div>
                    ) : (
                      <span>Save Password & Enter Suite</span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
