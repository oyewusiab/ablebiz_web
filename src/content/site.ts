export const site = {
  name: "ABLEBIZ Business Services",
  tagline:
    "ABLEBIZ helps you formalize your business, handle the paperwork and stay on track.",
  awardBadge: "🏆 2nd Place – BYUMS Africa Business Plan Competition",
  phone: "08160486023",
  phoneDisplay: "0816 048 6023",
  email: "hello@ablebiz.com.ng",
  location: "Along M.K.O. Abiola Way, Leme, Abeokuta, Ogun State, Nigeria",
  whatsappNumberIntl: "2348160486023",

  trust: {
    verification: [
      { title: "Registered Business Services Agent", note: "Assisting with CAC registration, compliance filings, and formal documentation." },
      { title: "Physical Office in Abeokuta", note: "In-person consultation and nationwide digital service delivery." },
      { title: "Award-Winning Business", note: "BYUMS Africa Business Plan Competition — 2nd Place." },
      { title: "Transparent Process", note: "Clear requirements, real-time updates, and upfront quotes with no hidden charges." },
    ],
    stats: [
      { label: "Years of experience", value: "5+" },
      { label: "Businesses supported", value: "100+" },
      { label: "Response", value: "Fast (WhatsApp-first)" },
      { label: "Coverage", value: "Nigeria-wide" },
    ],
  },
};

export function buildWhatsAppLink(message: string) {
  const text = encodeURIComponent(message);
  return `https://wa.me/${site.whatsappNumberIntl}?text=${text}`;
}

// Opens the WhatsApp "share" flow (user chooses who to send the message to)
export function buildWhatsAppShareLink(message: string) {
  const text = encodeURIComponent(message);
  return `https://wa.me/?text=${text}`;
}
