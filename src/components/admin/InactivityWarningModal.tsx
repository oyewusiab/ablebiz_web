import React, { useEffect, useState } from "react";
import { AlertTriangle, Clock, LogOut, RefreshCw } from "lucide-react";
import { cn } from "../../utils/cn";

export interface InactivityWarningModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onContinue: () => void;
  onLogout: () => void;
}

export function InactivityWarningModal({
  isOpen,
  remainingSeconds,
  onContinue,
  onLogout,
}: InactivityWarningModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-6 text-white shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 id="inactivity-warning-title" className="text-base font-bold text-white">
              Session Inactivity Warning
            </h3>
            <p className="text-xs text-slate-400">
              Your ABLEBIZ Suite session is about to expire
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center space-y-2">
          <p className="text-xs text-slate-300">
            For security and the protection of confidential client records, your session will automatically end in:
          </p>
          <div className="flex items-center justify-center gap-2 text-3xl font-mono font-bold text-amber-400">
            <Clock className="h-6 w-6 animate-pulse" />
            <span>{formattedTime}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Click <strong className="text-white">Continue Working</strong> to extend your active session.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.98] transition shadow-md"
          >
            <RefreshCw className="h-4 w-4" />
            Continue Working
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 transition"
          >
            <LogOut className="h-4 w-4" />
            Sign Out Now
          </button>
        </div>
      </div>
    </div>
  );
}
