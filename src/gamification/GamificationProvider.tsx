import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useLocation } from "react-router-dom";
import { SpinAndWinModal } from "./SpinAndWinModal";
import {
  fetchAuthoritativeCampaignBundle,
  getApprovedCampaignBaseline,
  APPROVED_CAMPAIGN_SERVICES,
  APPROVED_REFERRAL_MILESTONES,
  type CampaignPublicBundle,
} from "../lib/campaignEngine";

type OpenSource =
  | "auto_timer"
  | "get_started"
  | "pricing_cta"
  | "contact_exit_intent"
  | "manual";

type GamificationContextValue = {
  openSpin: (source?: OpenSource) => void;
  closeSpin: () => void;
  isSpinOpen: boolean;
  isSpinPaused: boolean;
  campaignBundle: CampaignPublicBundle;
  refreshCampaignBundle: () => Promise<void>;
};

const GamificationContext = createContext<GamificationContextValue | null>(null);

const SESSION = {
  prompted: "ablebiz_spin_prompted",
} as const;

export function GamificationProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const [isSpinOpen, setIsSpinOpen] = useState(false);
  const [openSource, setOpenSource] = useState<OpenSource>("manual");
  const [campaignBundle, setCampaignBundle] = useState<CampaignPublicBundle>(() => ({
    campaign: getApprovedCampaignBaseline(new Date()),
    services: APPROVED_CAMPAIGN_SERVICES,
    milestones: APPROVED_REFERRAL_MILESTONES,
    serverTimeUtc: new Date().toISOString(),
    source: "policy_baseline",
  }));

  const refreshCampaignBundle = async () => {
    try {
      const bundle = await fetchAuthoritativeCampaignBundle(true);
      setCampaignBundle(bundle);
    } catch {
      // Retain authoritative baseline if network error occurs
    }
  };

  useEffect(() => {
    let active = true;
    fetchAuthoritativeCampaignBundle()
      .then((bundle) => {
        if (active) setCampaignBundle(bundle);
      })
      .catch(() => {
        // Retain baseline
      });
    return () => {
      active = false;
    };
  }, []);

  // Spin & Win is strictly paused during the Office Opening Campaign period or when configured
  const isSpinPaused =
    Boolean(campaignBundle.campaign.spin_and_win_paused) ||
    campaignBundle.campaign.configured_status === "active" ||
    campaignBundle.campaign.configured_status === "scheduled" ||
    campaignBundle.campaign.effective_status === "active" ||
    campaignBundle.campaign.effective_status === "scheduled" ||
    (new Date() >= new Date("2026-11-05T00:00:00+01:00") &&
      new Date() <= new Date("2026-11-20T23:59:59+01:00"));

  const openSpin = (source: OpenSource = "manual") => {
    if (isSpinPaused) {
      setIsSpinOpen(false);
      return;
    }
    setOpenSource(source);
    setIsSpinOpen(true);
    try {
      sessionStorage.setItem(SESSION.prompted, "1");
    } catch {
      // ignore
    }
  };

  const closeSpin = () => setIsSpinOpen(false);

  // Auto timer trigger (disabled whenever Spin & Win is paused during campaign)
  useEffect(() => {
    if (isSpinPaused) {
      setIsSpinOpen(false);
      return;
    }

    let already = false;
    try {
      already = sessionStorage.getItem(SESSION.prompted) === "1";
    } catch {
      already = false;
    }
    if (already) return;
    if (location.pathname.startsWith("/admin")) return;
    if (
      location.pathname === "/contact" ||
      location.pathname === "/office-opening-promo" ||
      location.hash.includes("consultation")
    ) {
      return;
    }

    const t = window.setTimeout(() => {
      if (isSpinPaused) return;
      const currentPath = window.location.pathname;
      const currentHash = window.location.hash;
      if (
        currentPath.startsWith("/admin") ||
        currentPath === "/contact" ||
        currentPath === "/office-opening-promo" ||
        currentHash.includes("consultation")
      ) {
        return;
      }
      openSpin("auto_timer");
    }, 20000);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash, isSpinPaused]);

  const value = useMemo<GamificationContextValue>(
    () => ({
      openSpin,
      closeSpin,
      isSpinOpen,
      isSpinPaused,
      campaignBundle,
      refreshCampaignBundle,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSpinOpen, isSpinPaused, campaignBundle]
  );

  return (
    <GamificationContext.Provider value={value}>
      {children}
      {!isSpinPaused && (
        <SpinAndWinModal
          open={isSpinOpen}
          onClose={closeSpin}
          source={openSource}
        />
      )}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error("useGamification must be used within GamificationProvider");
  return ctx;
}
