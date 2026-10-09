export type FaqItem = {
  q: string;
  a: string;
};

export type Service = {
  id: string;
  title: string;
  short: string;
  description: string;
  whoItIsFor?: string[];
  whatYouNeed?: string[];
  howWeHelp?: string[];
  whatHappensNext?: string[];
  bullets?: string[];
  timeline?: string;
  icon: "file" | "users" | "shield" | "briefcase" | "badge" | "building";
  faqs?: FaqItem[];
  whatsappMessage?: string;
};

export const services: Service[] = [
  {
    id: "cac-registration",
    title: "CAC Business Registration",
    short: "Register your business name or company properly with full documentation.",
    description:
      "We help entrepreneurs, startups, and expanding enterprises process their Business Name or Limited Liability Company (Ltd) registrations with the Corporate Affairs Commission (CAC) — handling name searches, filings, and document retrieval smoothly.",
    whoItIsFor: [
      "Sole proprietors, traders, and artisans registering a Business Name",
      "Founders and partners incorporating a Private Limited Company (LTD)",
      "Existing business owners formalizing operations for bank accounts and contracts",
    ],
    whatYouNeed: [
      "2–3 proposed business or company names in order of preference",
      "Nature of business / core activities",
      "Valid government-issued ID (NIN, Voter's Card, or Passport)",
      "Passport photograph & signature specimen",
      "Business address, phone number, and email",
      "Director & shareholder details (for Companies)",
    ],
    howWeHelp: [
      "Conduct official name availability search and reservation with CAC",
      "Accurately prepare and submit all filing documentation",
      "Monitor application status and resolve any query directly with CAC",
      "Deliver your official CAC Certificate of Registration/Incorporation and Status Report",
      "Guide you on immediate next steps: TIN, corporate bank account, and compliance",
    ],
    whatHappensNext: [
      "1. Send us your preferred names and business details",
      "2. We confirm availability and review your information",
      "3. We process the official CAC filing and follow up through approval",
      "4. You receive your digital certificate and official documents",
    ],
    bullets: [
      "Name availability search & reservation",
      "Filing and document preparation",
      "Official certificate & status report delivery",
      "Guidance on next steps (TIN, corporate bank account)",
    ],
    timeline: "Typically 3–7 working days (subject to CAC processing queue)",
    icon: "file",
    whatsappMessage:
      "Hello ABLEBIZ, I would like to register my business.\n\nService: CAC Business Registration\n\nPlease let me know the requirements, turnaround time, and next steps.",
    faqs: [
      {
        q: "How long does CAC registration take?",
        a: "Most Business Name and Company registrations take about 3–7 working days after we have your verified details. Timing depends on the CAC processing queue and name reservation approval. We provide status updates throughout.",
      },
      {
        q: "What documents/details do I need to start?",
        a: "Typically: 2–3 proposed names, nature of business, business address, phone/email, a valid ID, passport photograph, and personal details of proprietor/directors (depending on your registration type). We confirm the exact list for your case.",
      },
      {
        q: "Business Name vs Company — what’s the difference?",
        a: "A Business Name is usually simpler and popular for small sole proprietorships. A Company (Ltd) creates a separate legal entity offering limited liability, stronger structure for partnerships, and corporate contract eligibility. We will advise you on the best fit for your goals.",
      },
      {
        q: "Can I register from outside Ogun State?",
        a: "Yes. We process registrations for clients across Nigeria and the diaspora. You submit your details digitally, and we process and deliver your verified documents electronically.",
      },
      {
        q: "Do I need a physical office?",
        a: "You need a valid registration address in Nigeria (it can be your home address, shop, or office). We can guide you on address suitability.",
      },
    ],
  },
  {
    id: "ngo-registration",
    title: "NGO & Association Registration",
    short: "Structure and register your non-profit, foundation, or association.",
    description:
      "We assist founders, charitable initiatives, community groups, and faith-based bodies in registering as Incorporated Trustees with the Corporate Affairs Commission (CAC) — guiding you through trustee setups, constitution drafting, and mandatory newspaper notices.",
    whoItIsFor: [
      "Non-Governmental Organizations (NGOs) and charitable foundations",
      "Faith-based organizations, churches, and ministries",
      "Alumni associations, social clubs, and community development groups",
      "Trade unions, professional bodies, and cooperative associations",
    ],
    whatYouNeed: [
      "Proposed name of the NGO / Association / Foundation",
      "Formal aims and objectives of the organization",
      "Details and valid government IDs of at least 2 Trustees",
      "Passport photographs and specimen signatures of all Trustees",
      "Minutes of the meeting adopting trustees and the constitution",
      "Draft constitution or governing rules",
    ],
    howWeHelp: [
      "Reserve your organization name with CAC",
      "Guide your team on trustee eligibility and documentation requirements",
      "Help draft and structure the constitution and minutes to meet CAC guidelines",
      "Coordinate mandatory public notices in national daily newspapers",
      "Submit and follow up the formal filing until certificate issuance",
    ],
    whatHappensNext: [
      "1. We discuss your organization's vision, trustee setup, and aims",
      "2. We prepare draft constitution, minutes, and submit name reservation",
      "3. Required newspaper notices are published and the notice period runs",
      "4. Final application is lodged with CAC and your certificate is delivered",
    ],
    bullets: [
      "Trustees setup & documentation review",
      "Constitution & minutes structuring",
      "National newspaper publication coordination",
      "CAC filing & certificate delivery",
    ],
    timeline: "Typically 3–6 weeks (including statutory newspaper publication window)",
    icon: "users",
    whatsappMessage:
      "Hello ABLEBIZ, I would like to register an NGO or Association.\n\nService: NGO & Association Registration\n\nPlease let me know the requirements and procedure.",
    faqs: [
      {
        q: "What do I need to register an NGO/Association?",
        a: "You will need trustee details and valid IDs, your organization's aims and objectives, a constitution, minutes of meeting, and passport photographs. We provide a complete checklist and guide you step by step.",
      },
      {
        q: "Why is newspaper publication required for NGOs?",
        a: "Under Nigerian law (CAMA), Incorporated Trustees applications must be published in national daily newspapers to invite public notice before CAC approval. We coordinate these publications on your behalf.",
      },
      {
        q: "Do trustees have to reside in the same state?",
        a: "No. Trustees can reside in different states or abroad, as long as they provide valid government identification and signed documentation.",
      },
      {
        q: "Can you help us draft a constitution and meeting minutes?",
        a: "Yes. We assist with structuring your constitution and meeting minutes to ensure they meet CAC regulatory standards.",
      },
      {
        q: "Can we handle the entire process remotely?",
        a: "Yes. You can submit all details and documents digitally via WhatsApp or email. We manage the filings and deliver digital copies promptly upon issuance.",
      },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & Post-Incorporation Services",
    short: "Annual returns, tax clearance support, and official company changes.",
    description:
      "Keep your registered entity active, compliant, and contract-ready. We assist with filing CAC Annual Returns, obtaining Tax Clearance Certificates (TCC), updating corporate directors or addresses, and securing tender compliance documentation (SCUML, BPP, NSITF, Trademarks).",
    whoItIsFor: [
      "Registered businesses needing to keep CAC status active and avoid penalty fees",
      "Companies preparing to bid for public tenders or corporate contracts",
      "Businesses needing Tax Clearance Certificates (TCC) or company TIN regularization",
      "Entities making corporate changes (new directors, address change, share allotments)",
      "Designated non-financial businesses requiring SCUML anti-money-laundering certificates",
    ],
    whatYouNeed: [
      "CAC Registration Number (RC or BN number) and Certificate",
      "Current CAC Status Report or registered documents",
      "Turnover records or financial summary (for Annual Returns)",
      "Valid IDs and resolution details (for director or address changes)",
      "Current tax information (for tax regularization)",
    ],
    howWeHelp: [
      "Audit your current CAC and regulatory status to identify gaps",
      "Calculate applicable statutory fees and any outstanding penalties accurately",
      "Prepare and file official Annual Returns directly with CAC",
      "Process post-incorporation changes (directors, share capital, business address)",
      "Guide you through TIN regularization, TCC processing, SCUML, and BPP certifications",
    ],
    whatHappensNext: [
      "1. Share your business name/RC number so we can check your current status",
      "2. We provide an exact summary of required filings, fees, and timelines",
      "3. We submit filings to CAC and relevant regulatory agencies",
      "4. You receive official filing acknowledgments and updated status reports",
    ],
    bullets: [
      "CAC Annual Returns filing",
      "Tax Clearance Certificate (TCC) & TIN regularization",
      "Post-incorporation amendments (directors, address, share capital)",
      "SCUML, BPP & NSITF tender compliance certifications",
    ],
    timeline: "Typically 2–7 working days (depending on the specific filing)",
    icon: "shield",
    whatsappMessage:
      "Hello ABLEBIZ, I need assistance with Compliance / Post-Incorporation.\n\nService: Compliance & Post-Incorporation Services\n\nPlease let me know how to get started.",
    faqs: [
      {
        q: "Why is Annual Returns filing important for my registered business?",
        a: "Annual returns keep your business status active with the CAC and prevent your company from being classified as 'Inactive' or struck off the register. It is a mandatory statutory requirement.",
      },
      {
        q: "Can you help us get a Tax Clearance Certificate (TCC) and Company TIN?",
        a: "Yes. We guide you through corporate tax regularization, TIN generation, and obtaining your Tax Clearance Certificate for corporate banking and tender eligibility.",
      },
      {
        q: "What compliance documents do I need before bidding for government/corporate tenders?",
        a: "Common requirements include CAC status reports, up-to-date Annual Returns, Tax Clearance Certificate (TCC), BPP Federal Contractor certificate, and NSITF compliance. We evaluate your target tenders and assist with packaging required documents.",
      },
      {
        q: "Can you handle changes of directors, address, or share capital?",
        a: "Yes. We process all CAC post-incorporation amendments including appointment/removal of directors, change of registered address, increase/allotment of share capital, and change of company name.",
      },
      {
        q: "How long do compliance filings take?",
        a: "Timelines range from 2 to 7 working days depending on the specific regulatory agency and whether any historical penalties are being regularized. We provide clear upfront timelines and status updates.",
      },
    ],
  },
  {
    id: "business-support",
    title: "Business Support Services",
    short: "Practical administrative support, documentation, and operational organization.",
    description:
      "Beyond registration, we provide founders and growing SMEs with practical administrative and documentation assistance — including business profiles, proposal documentation, basic bookkeeping organization, and administrative guidance to keep your operations structured.",
    whoItIsFor: [
      "Early-stage entrepreneurs needing structured administrative paperwork",
      "Growing businesses preparing proposals, letterheads, or corporate profiles",
      "SMEs seeking organized record-keeping and basic bookkeeping templates",
      "Organizations needing dependable ongoing back-office administrative coordination",
    ],
    whatYouNeed: [
      "Overview of your business activities and documentation requirements",
      "Existing drafts, transaction notes, or organizational records",
      "Target timeline or delivery deadline for your project",
    ],
    howWeHelp: [
      "Structure professional company profiles and standard operational documents",
      "Organize transactional records and implement practical bookkeeping templates",
      "Review administrative workflows to identify compliance and operational gaps",
      "Provide dependable one-off or retainer-based business administration support",
    ],
    whatHappensNext: [
      "1. Tell us what documentation or administrative support you need",
      "2. We review the scope and provide a clear timeline and proposal",
      "3. We execute and organize the required paperwork or records",
      "4. You receive clean, structured, and ready-to-use business materials",
    ],
    bullets: [
      "Company profile & business documentation",
      "Basic bookkeeping templates & record organization",
      "Administrative workflow guidance",
      "Ongoing back-office coordination support",
    ],
    timeline: "Typically 1–5 working days (depending on scope)",
    icon: "briefcase",
    whatsappMessage:
      "Hello ABLEBIZ, I would like to inquire about Business Support Services.\n\nService: Business Support Services\n\nPlease let me know how you can assist my business.",
    faqs: [
      {
        q: "Do you offer bookkeeping support?",
        a: "We provide basic bookkeeping setup, templates, and record organization for SMEs. If you need statutory financial auditing, we guide you to accredited accounting professionals.",
      },
      {
        q: "Can you help with company profiles, proposals, and business documents?",
        a: "Yes. We assist in structuring professional company profiles, commercial proposals, invoice templates, and official letters.",
      },
      {
        q: "Is this a one-time service or an ongoing retainer?",
        a: "Both options are available. We can handle one-off documentation tasks or provide ongoing monthly administrative support tailored to your business needs.",
      },
      {
        q: "Do you support clients outside Abeokuta?",
        a: "Yes. We work with clients across Nigeria digitally. Documents and consultations are coordinated seamlessly through WhatsApp, phone, and email.",
      },
    ],
  },
];
