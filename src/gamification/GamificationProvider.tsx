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
};

const GamificationContext = createContext<GamificationContextValue | null>(null);

const SESSION = {
  prompted: "ablebiz_spin_prompted",
} as const;

export function GamificationProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const [isSpinOpen, setIsSpinOpen] = useState(false);
  const [openSource, setOpenSource] = useState<OpenSource>("manual");

  const openSpin = (source: OpenSource = "manual") => {
    setOpenSource(source);
    setIsSpinOpen(true);
    try {
      sessionStorage.setItem(SESSION.prompted, "1");
    } catch {
      // ignore
    }
  };

  const closeSpin = () => setIsSpinOpen(false);

  // Auto timer trigger (10–15s). Only once per session.
  useEffect(() => {
    let already = false;
    try {
      already = sessionStorage.getItem(SESSION.prompted) === "1";
    } catch {
      already = false;
    }
    if (already) return;

    const t = window.setTimeout(() => {
      openSpin("auto_timer");
    }, 12000);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contact page exit intent trigger (desktop only). Only if not already prompted.
  useEffect(() => {
    if (location.pathname !== "/contact") return;

    let already = false;
    try {
      already = sessionStorage.getItem(SESSION.prompted) === "1";
    } catch {
      already = false;
    }
    if (already) return;

    const onMouseLeave = (e: MouseEvent) => {
      // Exit intent: cursor leaves viewport at the top
      if (e.clientY <= 0) {
        openSpin("contact_exit_intent");
      }
    };

    document.addEventListener("mouseleave", onMouseLeave);
    return () => document.removeEventListener("mouseleave", onMouseLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const value = useMemo<GamificationContextValue>(
    () => ({ openSpin, closeSpin, isSpinOpen }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSpinOpen]
  );

  return (
    <GamificationContext.Provider value={value}>
      {children}
      <SpinAndWinModal
        open={isSpinOpen}
        onClose={closeSpin}
        source={openSource}
      />
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error("useGamification must be used within GamificationProvider");
  return ctx;
}
