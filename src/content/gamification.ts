export type SpinRewardType =
  | "discount_1000"
  | "free_consultation"
  | "free_name_search"
  | "free_ebook";

export type SpinRewardOption = {
  type: SpinRewardType;
  title: string;
  short: string;
  weight: number;
};

export const spinRewards: SpinRewardOption[] = [
  {
    type: "discount_1000",
    title: "₦1,000 Discount",
    short: "Save ₦1,000 on any ABLEBIZ package.",
    weight: 25,
  },
  {
    type: "free_consultation",
    title: "Free Consultation",
    short: "Get a quick guided call/WhatsApp consultation.",
    weight: 25,
  },
  {
    type: "free_name_search",
    title: "Free Business Name Search",
    short: "We’ll check availability and advise on better options.",
    weight: 25,
  },
  {
    type: "free_ebook",
    title: "Free Ebook",
    short: "Download our starter guide for CAC registration.",
    weight: 25,
  },
];

export const referralRules = {
  pointsPerReferral: 50,
  rewards: [
    {
      referrals: 5,
      title: "Free consultation",
      note: "Reach 5 referrals in a month to unlock a free consultation.",
    },
    {
      referrals: 10,
      title: "Discount or free service",
      note: "Reach 10 referrals to unlock a bigger discount or a free service add-on.",
    },
  ],
} as const;
