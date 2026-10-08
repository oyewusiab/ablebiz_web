import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, KeyRound, LogOut, Eye, EyeOff } from "lucide-react";
import { supabase, supabaseEnabled } from "../../lib/supabaseClient";
import { invokeStaffProvision } from "../../lib/staffProvisioning";
import { useAuth } from "../../auth/AuthContext";
import { BrandLogo } from "../../components/BrandLogo";

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
    <div className="admin-theme flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12 relative">
      <div className="absolute inset-0 bg-[radial-gradient(#0A2558_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <BrandLogo variant="landscape" size="lg" priority />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#0A2558]">Security Initialization</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Mandatory Password Setup for New Staff Accounts
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
          {success ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Password Updated Successfully</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your permanent password has been established. Loading your internal ABLEBIZ Suite workspace...
              </p>
              <div className="pt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-full animate-pulse bg-[#0A2558]" />
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="flex items-center gap-2 pb-1 text-[#0A2558] text-xs font-bold uppercase tracking-wider">
                <KeyRound className="h-4 w-4 text-[#D97706]" />
                <span>Establish Permanent Password</span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-900 text-[11px] leading-relaxed">
                <p className="font-bold text-amber-950">Initial Login Detected</p>
                <p className="mt-0.5">
                  Welcome to ABLEBIZ Suite, <strong>{profile?.full_name || user?.name || "Staff Member"}</strong>.
                  For platform security and compliance, you must replace your temporary credential with a private password before accessing operational tools.
                </p>
              </div>

              {validationError || statusError ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{validationError || statusError}</span>
                </div>
              ) : null}

              <label className="block space-y-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                  Current / Temporary Password *
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
                    placeholder="Enter assigned temporary password"
                    required
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                  New Permanent Password *
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                  Confirm New Password *
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0A2558] focus:bg-white focus:ring-2 focus:ring-[#0A2558]/15"
                    placeholder="Repeat new password"
                    required
                    minLength={8}
                  />
                </div>
              </label>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-[11px]">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-slate-300 text-[#0A2558] focus:ring-[#0A2558]/20"
                  />
                  <span>Show passwords</span>
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-[10px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Password Security Standards:</p>
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
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A2558] text-xs font-bold text-white transition hover:bg-[#061738] disabled:opacity-50 shadow-md shadow-[#0A2558]/20"
                  >
                    {isRetryingClearFlag ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A2558] text-xs font-bold text-white transition hover:bg-[#061738] disabled:opacity-50 shadow-md shadow-[#0A2558]/10"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
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
