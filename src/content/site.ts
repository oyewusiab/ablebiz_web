export const site = {
  name: "ABLEBIZ Business Services",
  tagline:
    "An award-winning business compliance service helping Nigerians register and grow their businesses safely and professionally.",
  awardBadge: "🏆 2nd Place – BYUMS Africa Business Plan Competition",
  phone: "08160486023",
  phoneDisplay: "0816 048 6023",
  email: "hello@ablebiz.com.ng",
  location: "Abeokuta, Ogun State, Nigeria",
  whatsappNumberIntl: "2348160486023",

  trust: {
    verification: [
      { title: "Certified CAC Agent", note: "Guided CAC registration with clear documentation." },
      { title: "Physical Office in Abeokuta", note: "In-person support available when needed." },
      { title: "Award-Winning Business", note: "BYUMS Africa Business Plan Competition — 2nd Place." },
      { title: "Transparent Process", note: "Clear steps, real-time updates, no hidden charges." },
    ],
    stats: [
      { label: "Years of experience", value: "5+" },
      { label: "Businesses supported", value: "100+" },
      { label: "Response", value: "Fast (WhatsApp-first)" },
      { label: "Coverage", value: "Nigeria-wide" },
    ],
  },
} as const;

export function buildWhatsAppLink(message: string) {
  const text = encodeURIComponent(message);
  return `https://wa.me/${site.whatsappNumberIntl}?text=${text}`;
}

// Opens the WhatsApp "share" flow (user chooses who to send the message to)
export function buildWhatsAppShareLink(message: string) {
  const text = encodeURIComponent(message);
  return `https://wa.me/?text=${text}`;
}
