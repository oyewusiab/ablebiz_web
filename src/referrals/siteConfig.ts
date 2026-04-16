import { useState, useEffect } from "react";
import { site as siteDefault } from "../content/site";
import { services as servicesDefault } from "../content/services";
import { pricingTiers as pricingDefault } from "../content/pricing";
import { load, save } from "../utils/storageHelpers";

const KEYS = {
  SITE: "ablebiz_config_site",
  SERVICES: "ablebiz_config_services",
  PRICING: "ablebiz_config_pricing",
} as const;

export function useSiteConfig() {
  const [site, setSite] = useState(siteDefault);
  const [services, setServices] = useState(servicesDefault);
  const [pricing, setPricing] = useState(pricingDefault);

  useEffect(() => {
    // Load overrides from localStorage
    const savedSite = load(KEYS.SITE, null);
    const savedServices = load(KEYS.SERVICES, null);
    const savedPricing = load(KEYS.PRICING, null);

    if (savedSite) setSite(savedSite);
    if (savedServices) setServices(savedServices);
    if (savedPricing) setPricing(savedPricing);
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

  const resetAll = () => {
    setSite(siteDefault);
    setServices(servicesDefault);
    setPricing(pricingDefault);
    localStorage.removeItem(KEYS.SITE);
    localStorage.removeItem(KEYS.SERVICES);
    localStorage.removeItem(KEYS.PRICING);
  };

  return {
    site,
    services,
    pricing,
    updateSite,
    updateServices,
    updatePricing,
    resetAll,
  };
}

// Global accessor for non-hook usage (e.g. initial server-side or outside React if needed)
export function getSiteConfig() {
  return {
    site: load(KEYS.SITE, siteDefault),
    services: load(KEYS.SERVICES, servicesDefault),
    pricing: load(KEYS.PRICING, pricingDefault),
  };
}
