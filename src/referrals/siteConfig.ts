import { useState, useEffect } from "react";
import { site as siteDefault } from "../content/site";
import { services as servicesDefault } from "../content/services";
import { pricingTiers as pricingDefault } from "../content/pricing";
import { load, save } from "../utils/storageHelpers";

const KEYS = {
  SITE: "ablebiz_config_site",
  SERVICES: "ablebiz_config_services",
  PRICING: "ablebiz_config_pricing",
  REFERRAL_TIERS: "ablebiz_config_referral_tiers",
  SPIN_REWARDS: "ablebiz_config_spin_rewards",
  AUTOMATIONS: "ablebiz_config_automations",
  FLASH_CAMPAIGN: "ablebiz_config_flash_campaign",
} as const;

import { spinRewards as spinRewardsDefault } from "../content/gamification";

export const referralTiersDefault = [
  { referralsRequired: 5, title: "Free Consultation", note: "Unlock a free guided session." },
  { referralsRequired: 10, title: "Special Discount", note: "Unlock a larger discount or free feature." },
];

export type AutomationRule = {
  id: string;
  name: string;
  trigger: "new_lead" | "new_referral" | "spin_won";
  conditionField?: string;
  conditionValue?: string;
  action: "assign_group" | "add_points";
  actionValue: string;
  active: boolean;
};

export const automationsDefault: AutomationRule[] = [];

export type FlashCampaign = {
  active: boolean;
  multiplier: number;
  expiresAt: string | null;
  name: string;
};

export const flashCampaignDefault: FlashCampaign = {
  active: false,
  multiplier: 2,
  expiresAt: null,
  name: "Weekend 2x Points",
};

export function useSiteConfig() {
  const [site, setSite] = useState(siteDefault);
  const [services, setServices] = useState(servicesDefault);
  const [pricing, setPricing] = useState(pricingDefault);
  const [referralTiers, setReferralTiers] = useState(referralTiersDefault);
  const [spinRewards, setSpinRewards] = useState(spinRewardsDefault);
  const [automations, setAutomations] = useState<AutomationRule[]>(automationsDefault);
  const [flashCampaign, setFlashCampaign] = useState<FlashCampaign>(flashCampaignDefault);

  useEffect(() => {
    // Load overrides from localStorage
    const savedSite = load(KEYS.SITE, null);
    const savedServices = load(KEYS.SERVICES, null);
    const savedPricing = load(KEYS.PRICING, null);
    const savedReferralTiers = load(KEYS.REFERRAL_TIERS, null);
    const savedSpinRewards = load(KEYS.SPIN_REWARDS, null);
    const savedAutomations = load(KEYS.AUTOMATIONS, null);
    const savedFlash = load(KEYS.FLASH_CAMPAIGN, null);

    if (savedSite) setSite(savedSite);
    if (savedServices) setServices(savedServices);
    if (savedPricing) setPricing(savedPricing);
    if (savedReferralTiers) setReferralTiers(savedReferralTiers);
    if (savedSpinRewards) setSpinRewards(savedSpinRewards);
    if (savedAutomations) setAutomations(savedAutomations);
    if (savedFlash) setFlashCampaign(savedFlash);
  }, []);

  const updateSite = (newSite: typeof siteDefault) => {
    setSite(newSite);
    save(KEYS.SITE, newSite);
  };

  const updateServices = (newServices: typeof servicesDefault) => {
    setServices(newServices);
    save(KEYS.SERVICES, newServices);
  };

  const updatePricing = (newPricing: typeof pricingDefault) => {
    setPricing(newPricing);
    save(KEYS.PRICING, newPricing);
  };

  const updateReferralTiers = (newTiers: typeof referralTiersDefault) => {
    setReferralTiers(newTiers);
    save(KEYS.REFERRAL_TIERS, newTiers);
  };

  const updateSpinRewards = (newRewards: typeof spinRewardsDefault) => {
    setSpinRewards(newRewards);
    save(KEYS.SPIN_REWARDS, newRewards);
  };

  const updateAutomations = (newAutomations: typeof automationsDefault) => {
    setAutomations(newAutomations);
    save(KEYS.AUTOMATIONS, newAutomations);
  };

  const updateFlashCampaign = (newFlash: typeof flashCampaignDefault) => {
    setFlashCampaign(newFlash);
    save(KEYS.FLASH_CAMPAIGN, newFlash);
  };

  const resetAll = () => {
    setSite(siteDefault);
    setServices(servicesDefault);
    setPricing(pricingDefault);
    setReferralTiers(referralTiersDefault);
    setSpinRewards(spinRewardsDefault);
    setAutomations(automationsDefault);
    setFlashCampaign(flashCampaignDefault);
    localStorage.removeItem(KEYS.SITE);
    localStorage.removeItem(KEYS.SERVICES);
    localStorage.removeItem(KEYS.PRICING);
    localStorage.removeItem(KEYS.REFERRAL_TIERS);
    localStorage.removeItem(KEYS.SPIN_REWARDS);
    localStorage.removeItem(KEYS.AUTOMATIONS);
    localStorage.removeItem(KEYS.FLASH_CAMPAIGN);
  };

  return {
    site,
    services,
    pricing,
    referralTiers,
    spinRewards,
    automations,
    flashCampaign,
    updateSite,
    updateServices,
    updatePricing,
    updateReferralTiers,
    updateSpinRewards,
    updateAutomations,
    updateFlashCampaign,
    resetAll,
  };
}

// Global accessor for non-hook usage (e.g. initial server-side or outside React if needed)
export function getSiteConfig() {
  return {
    site: load(KEYS.SITE, siteDefault),
    services: load(KEYS.SERVICES, servicesDefault),
    pricing: load(KEYS.PRICING, pricingDefault),
    referralTiers: load(KEYS.REFERRAL_TIERS, referralTiersDefault),
    spinRewards: load(KEYS.SPIN_REWARDS, spinRewardsDefault),
    automations: load(KEYS.AUTOMATIONS, automationsDefault),
    flashCampaign: load(KEYS.FLASH_CAMPAIGN, flashCampaignDefault),
  };
}
