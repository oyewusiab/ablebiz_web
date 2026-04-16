import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const REFERRAL_SESSION_KEY = "ablebiz_referral_code";

export function useReferralUrl() {
  const location = useLocation();

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const ref = sp.get("ref")?.trim();
    if (ref) {
      try {
        sessionStorage.setItem(REFERRAL_SESSION_KEY, ref);
      } catch {
        // ignore
      }
    }
  }, [location.search]);
}

export function getSessionReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return sessionStorage.getItem(REFERRAL_SESSION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
