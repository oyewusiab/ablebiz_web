import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sparkles,
  X,
  ArrowRight,
  PartyPopper,
  MapPin,
  Tag,
  Trophy,
} from "lucide-react";
import { useGamification } from "../gamification/GamificationProvider";

const POPUP_STORAGE_KEY = "ablebiz_campaign_popup_dismissed";

export function CampaignPromoModal() {
  const location = useLocation();
  const { campaignBundle } = useGamification();
  const { campaign } = campaignBundle;

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 1. Never show on admin or campaign landing page itself
    if (
      location.pathname.startsWith("/admin") ||
      location.pathname === "/office-opening-promo"
    ) {
      setIsOpen(false);
      return;
    }

    // 2. Only show if campaign is publicly visible and active or scheduled
    const isQualifyingState =
      campaign.is_publicly_visible &&
      (campaign.effective_status === "active" ||
        campaign.effective_status === "scheduled");

    if (!isQualifyingState) {
      setIsOpen(false);
      return;
    }

    // 3. Check session storage for single appearance per visit
    try {
      const dismissed = sessionStorage.getItem(POPUP_STORAGE_KEY);
      if (dismissed === "1") {
        return;
      }
    } catch {
      // storage disabled / private browsing fallback
    }

    // 4. Subtle delay (1.2s) so page layout stabilizes smoothly before modal appears
    const timer = setTimeout(() => {
      try {
        const dismissedNow = sessionStorage.getItem(POPUP_STORAGE_KEY);
        if (dismissedNow === "1") return;
      } catch {
        // ignore
      }
      setIsOpen(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [location.pathname, campaign.is_publicly_visible, campaign.effective_status]);

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem(POPUP_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  // Keyboard navigation & accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleDismiss}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 transition-all transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Celebratory Header Bar with ABLEBIZ Deep Growth Green */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#005434] via-[#0A4328] to-[#042013] px-6 pt-7 pb-6 text-white sm:px-8">
          {/* Subtle Decorative Accents & Gold Glow */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-emerald-400/20 blur-2xl" />

          {/* Close Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close celebratory promotion modal"
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition focus:outline-hidden focus:ring-2 focus:ring-amber-400"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Celebration Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-sm">
            <PartyPopper className="h-3.5 w-3.5 text-slate-950" />
            <span>Grand Office Opening</span>
          </div>

          <h2
            id="campaign-popup-title"
            className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl"
          >
            WE&apos;RE CELEBRATING OUR NEW OFFICE!
          </h2>

          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-100">
            <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>{campaign.location || "Abeokuta, Ogun State, Nigeria"}</span>
          </div>

          <p className="mt-2.5 text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            ABLEBIZ BUSINESS SERVICES is now welcoming you from our physical office in Abeokuta.
            Celebrate with us and enjoy special discounts on selected business services.
          </p>
        </div>

        {/* Modal Body & Offers */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Discount Offer Card */}
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-4">
              <div className="flex items-center gap-2 text-amber-800">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-200/80 text-amber-900">
                  <Tag className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
                  Promotional Discount
                </span>
              </div>
              <p className="mt-2 text-base font-black text-slate-900 leading-snug">
                {campaign.promo_headline}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Selected CAC registrations, SCUML compliance & annual filings
              </p>
            </div>

            {/* Referral Reward Offer Card */}
            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 p-4">
              <div className="flex items-center gap-2 text-emerald-800">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-200/80 text-emerald-900">
                  <Trophy className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                  Referral Rewards
                </span>
              </div>
              <p className="mt-2 text-base font-black text-slate-900 leading-snug">
                {campaign.referral_headline}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Cumulative cash milestones for referring new verified clients
              </p>
            </div>
          </div>

          {/* Campaign Period Notice */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs text-slate-600 border border-slate-200/60">
            <span className="font-medium">Campaign Window:</span>
            <span className="font-bold text-slate-900">Nov 5 – Nov 20, 2026</span>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <Link
              to="/office-opening-promo"
              onClick={handleDismiss}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 px-5 py-3 text-sm font-extrabold text-slate-950 no-underline shadow-md hover:shadow-lg transition active:scale-[0.99]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Explore Promotional Services</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
