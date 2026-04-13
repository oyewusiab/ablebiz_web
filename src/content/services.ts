export type FaqItem = {
  q: string;
  a: string;
};

export type Service = {
  id: string;
  title: string;
  short: string;
  description: string;
  bullets?: string[];
  timeline?: string;
  icon: "file" | "users" | "shield" | "briefcase" | "badge" | "building";
  faqs?: FaqItem[];
};

export const services: Service[] = [
  {
    id: "cac-registration",
    title: "CAC Business Registration",
    short: "Register your business or company legally and professionally.",
    description:
      "We help you register a Business Name or Company with the Corporate Affairs Commission (CAC) — with proper guidance, accurate documentation, and fast turnaround.",
    bullets: [
      "Name availability search & reservation",
      "Registration filing & follow-up",
      "CAC certificate & documents delivery",
      "Guidance on next steps (TIN, bank account, etc.)",
    ],
    timeline: "Timeline: 3–10 working days (depending on CAC processing)",
    icon: "file",
    faqs: [
      {
        q: "How long does CAC registration take?",
        a: "Most Business Name and Company registrations take about 3–10 working days after we have your correct details. Timing can change based on CAC queue and name approval. We send real-time updates so you’re not left guessing.",
      },
      {
        q: "What documents/details do I need to start?",
        a: "Typically: 2–3 proposed names, nature of business, business address, phone/email, a valid ID, passport photograph, and personal details of proprietor/directors (depending on your registration type). We’ll confirm the exact list for your case.",
      },
      {
        q: "Business Name vs Company — what’s the difference?",
        a: "A Business Name is usually simpler and popular for small businesses. A Company (Ltd) offers stronger structure for growth, partnerships, and some corporate requirements. We’ll recommend the best option based on your goals and budget.",
      },
      {
        q: "Can I register from outside Ogun State?",
        a: "Yes. Many clients register remotely from anywhere in Nigeria (or abroad). You can submit details via WhatsApp/email and we’ll process and deliver your documents digitally.",
      },
      {
        q: "Do I need a physical office?",
        a: "You need a verifiable registration address (it can be your home or office). If you’re unsure what address to use, we’ll guide you.",
      },
    ],
  },
  {
    id: "ngo-registration",
    title: "NGO & Association Registration",
    short: "We help you structure and register your organization properly.",
    description:
      "From trustees to constitution and CAC filings, we guide you through a clear process so your NGO/Association is properly structured and compliant.",
    bullets: [
      "Trustees setup & documentation",
      "Constitution and required attachments",
      "CAC filing & publication guidance",
      "Post-registration advisory",
    ],
    timeline: "Timeline varies by requirements and CAC process",
    icon: "users",
    faqs: [
      {
        q: "What do I need to register an NGO/Association?",
        a: "You’ll typically need trustee details/IDs, your organization’s objectives, a constitution, meeting minutes, and other CAC-required attachments. We provide a clear checklist and guide you through each document.",
      },
      {
        q: "How long does NGO registration take?",
        a: "NGO/Association registrations can take longer than business name registrations due to extra requirements and CAC processes (including publication steps). We’ll give you an estimated timeline after reviewing your documents.",
      },
      {
        q: "Do trustees have to be in the same state?",
        a: "No. Trustees can be in different states. What matters is that we have correct details and valid IDs, and trustees can provide required signatures/confirmations.",
      },
      {
        q: "Can you help us draft a constitution and meeting minutes?",
        a: "Yes. We assist with structuring your constitution/minutes properly so they meet CAC requirements and reduce back-and-forth.",
      },
      {
        q: "Can we do everything remotely?",
        a: "Yes. You can submit details digitally, and we’ll coordinate the process with guidance on any required physical steps.",
      },
    ],
  },
  {
    id: "compliance",
    title: "Compliance Services",
    short: "BPP, SCUML, NSITF, and other requirements made easy.",
    description:
      "We support your business with compliance documentation and filings so you can focus on growth — not confusion.",
    bullets: ["BPP", "SCUML", "NSITF", "Trademark support"],
    icon: "shield",
    faqs: [
      {
        q: "What is SCUML and who needs it?",
        a: "SCUML registration is required for many designated non-financial businesses and professions (DNFBPs). If you’re unsure whether it applies to your business, we’ll assess your business type and advise correctly.",
      },
      {
        q: "How long do compliance filings take?",
        a: "It depends on the specific agency and your document readiness. After reviewing your details, we’ll give you a realistic timeline and keep you updated throughout.",
      },
      {
        q: "Do I need compliance before bidding for contracts?",
        a: "For many tenders and procurement processes, compliance documents may be requested. We help you prepare what’s needed for your target opportunities and avoid unnecessary filings.",
      },
      {
        q: "Can you handle multiple compliance requirements together?",
        a: "Yes. We can bundle your compliance steps into one plan (e.g., SCUML + BPP + NSITF where applicable) to reduce delays and repeated paperwork.",
      },
      {
        q: "What documents will you request from me?",
        a: "Common items include CAC documents, IDs, business address, and operational details. The exact list depends on the specific service — we’ll send a checklist after a short review.",
      },
    ],
  },
  {
    id: "business-support",
    title: "Business Support Services",
    short: "Documentation, advisory, and administrative support.",
    description:
      "We provide practical support for SMEs and founders: documentation, basic bookkeeping support, and advisory that keeps you organized and investor-ready.",
    bullets: ["Documentation", "Bookkeeping support", "Advisory", "Administrative support"],
    icon: "briefcase",
    faqs: [
      {
        q: "Do you offer bookkeeping services?",
        a: "We provide basic bookkeeping support and documentation organization for SMEs. If you need advanced accounting/audit services, we can guide you on the right next step.",
      },
      {
        q: "Can you help with proposals, invoices, and business documents?",
        a: "Yes. We help you create or tidy up key documents like proposals, company profiles, letterheads, and compliance-ready documentation.",
      },
      {
        q: "Is this a one-time service or a monthly retainer?",
        a: "Both options are available. We can support one-off tasks or run ongoing admin support based on your needs and budget.",
      },
      {
        q: "Do you support clients outside Abeokuta/Ogun State?",
        a: "Yes. We work with clients across Nigeria. Many support services can be handled fully online with clear communication and fast delivery.",
      },
    ],
  },
];
