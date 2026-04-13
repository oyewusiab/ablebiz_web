export type PricingTier = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlight?: boolean;
};

export const pricingTiers: PricingTier[] = [
  {
    id: "starter",
    name: "Starter Package",
    price: "₦25,000 – ₦40,000",
    description: "Business Name Registration",
    features: [
      "Guided name search",
      "CAC filing support",
      "Basic documentation check",
      "Updates until completion",
    ],
  },
  {
    id: "standard",
    name: "Standard Package",
    price: "₦50,000 – ₦80,000",
    description: "Registration + Documentation",
    features: [
      "Registration processing",
      "Document preparation support",
      "Real-time updates",
      "Post-registration guidance",
    ],
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium Package",
    price: "₦100,000+",
    description: "Full Setup + Advisory",
    features: [
      "End-to-end setup",
      "Compliance advisory",
      "Priority support",
      "Business support services",
    ],
  },
];
