export const blogCategories = [
  "Business Registration",
  "CAC Updates & Policies",
  "Startup Tips",
  "Business Growth",
  "Finance & Compliance",
  "NGO & Nonprofit Guide",
] as const;

export type BlogCategory = (typeof blogCategories)[number];

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  dateISO: string;
  categories: BlogCategory[];
  featuredImage: string;
  featured?: boolean;
  popular?: boolean;
  author: {
    name: string;
    title: string;
  };
  introMd: string;
  bodyMd: string;
  conclusionMd: string;
  infographic?: "business-registration-steps" | "business-name-vs-company";
  videoUrl?: string;
};

const author = {
  name: "Oyewusi Adebayo Babatunde",
  title: "Founder, ABLEBIZ Business Services (Certified CAC Agent)",
};

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-register-your-business-in-nigeria-2026",
    title: "How to Register Your Business in Nigeria (Step-by-Step Guide 2026)",
    excerpt:
      "A clear, Nigerian-context step-by-step guide to CAC business registration in 2026 — requirements, timelines, and how to avoid common mistakes.",
    dateISO: "2026-01-18",
    categories: ["Business Registration", "Startup Tips"],
    featuredImage: "/images/blog/how-to-register-business.png",
    featured: true,
    popular: true,
    author,
    introMd:
      "Starting a business in Nigeria can feel overwhelming — **CAC forms, name availability, documents, payments, and plenty ‘stories’**.\n\nThis guide breaks it down into simple steps so you can register confidently and avoid delays.",
    bodyMd:
      "## Step 1: Decide what you’re registering\n\nMost founders start with **Business Name** registration. If you need investors, multiple directors, or a larger structure, **Company** registration may be a better fit.\n\n## Step 2: Prepare your details\n\nYou’ll typically need:\n\n- Proposed business name(s)\n- Nature of business / objectives\n- Owner(s) information (names, phone, email, address)\n- Valid ID (as required)\n\n## Step 3: Name availability (search & reservation)\n\nThe CAC will confirm if your chosen name is available. Always keep **backup names** to reduce delays.\n\n## Step 4: Submit registration and follow up\n\nRegistration is filed and tracked until approval. A good agent keeps you updated and ensures documents are correct.\n\n## Step 5: Receive your documents\n\nOnce approved, you receive your CAC certificate and supporting documents.\n\n> Need help registering your business? **Chat with ABLEBIZ on WhatsApp** and we’ll guide you end-to-end.",
    conclusionMd:
      "### Ready to register?\n\nIf you want a **fast and transparent** process with a **trusted CAC agent**, ABLEBIZ can help you register and grow safely.\n\n- **Timeline:** typically 3–10 working days (CAC dependent)\n- **Updates:** real-time progress updates\n\n**Start your registration today with ABLEBIZ.**",
    infographic: "business-registration-steps",
    videoUrl: "https://www.youtube.com/embed/2O1V5U6bFzE",
  },
  {
    slug: "cac-registration-requirements-in-nigeria-2026",
    title: "CAC Registration Requirements in Nigeria (2026 Guide)",
    excerpt:
      "Know what documents and details you need before starting CAC registration in Nigeria in 2026 — and how to prepare them properly.",
    dateISO: "2026-02-02",
    categories: ["CAC Updates & Policies", "Business Registration"],
    featuredImage: "/images/blog/cac-requirements-2026.png",
    popular: true,
    author,
    introMd:
      "One of the biggest reasons registrations delay is **missing or inconsistent information**. If you prepare well, your CAC process becomes smooth.",
    bodyMd:
      "## Basic requirements (Business Name)\n\n- Proposed name (plus alternatives)\n- Nature of business\n- Proprietor details (name, phone, email, address)\n- Valid means of identification (as required)\n\n## Requirements (Company registration)\n\n- Company name options\n- Director(s)/Shareholder(s) details\n- Share capital and shareholding structure\n- Registered office address\n- Nature of business (objectives)\n\n## Pro tips to avoid delays\n\n- Ensure names match your ID and details\n- Use a reachable phone number & email\n- Keep your address consistent\n- Have backup names ready\n\n> Need clarity on what applies to your case? Chat with ABLEBIZ for a guided checklist.",
    conclusionMd:
      "### Quick takeaway\n\nThe CAC process is easier when you start with the right checklist. ABLEBIZ helps you prepare, file, and follow up — **without hidden charges**.",
    infographic: "business-registration-steps",
  },
  {
    slug: "business-name-vs-company-whats-the-difference",
    title: "Business Name vs Company: What’s the Difference?",
    excerpt:
      "Confused about whether to register a Business Name or a Limited Liability Company in Nigeria? Here’s a simple breakdown.",
    dateISO: "2026-02-21",
    categories: ["Startup Tips", "Business Growth"],
    featuredImage: "/images/blog/business-name-vs-company.png",
    author,
    introMd:
      "Many Nigerian entrepreneurs ask: **Should I register as a Business Name or a Company?** Your choice affects perception, compliance, and growth options.",
    bodyMd:
      "## Business Name (BN)\n\nBest for:\n\n- Solo founders and small teams\n- Low-cost, faster setup\n- Simple operations\n\nThings to note:\n\n- Often seen as a smaller structure\n- Some tenders/contracts may prefer companies\n\n## Company (Ltd)\n\nBest for:\n\n- Businesses planning to scale\n- Multiple directors/shareholders\n- Investor-friendly structure\n\nThings to note:\n\n- More compliance obligations\n- More documentation and structure\n\n> Want help choosing the right structure? ABLEBIZ can advise based on your goals.",
    conclusionMd:
      "### Decision rule\n\nIf you’re starting lean, BN may work. If you want stronger structure for growth, partnerships, or funding, consider a company.\n\nChat with ABLEBIZ for a quick recommendation.",
    infographic: "business-name-vs-company",
  },
  {
    slug: "top-10-mistakes-entrepreneurs-make-in-nigeria",
    title: "Top 10 Mistakes Entrepreneurs Make in Nigeria (and How to Avoid Them)",
    excerpt:
      "From delaying registration to poor record-keeping—these are common mistakes Nigerian entrepreneurs make, plus practical fixes.",
    dateISO: "2026-03-05",
    categories: ["Startup Tips", "Finance & Compliance"],
    featuredImage: "/images/blog/top-10-mistakes.png",
    popular: true,
    author,
    introMd:
      "Running a business in Nigeria is not for the weak. But many issues are avoidable if you set up properly from day one.",
    bodyMd:
      "## The 10 common mistakes\n\n1. Not registering early\n2. Using inconsistent business details\n3. Mixing personal and business money\n4. No proper documentation\n5. Ignoring basic compliance\n6. No clear pricing or service scope\n7. Poor customer communication\n8. Not tracking income/expenses\n9. No simple contracts\n10. No growth plan\n\n## What to do instead\n\n- Register early and keep your details consistent\n- Keep receipts and basic records\n- Ask for guidance on compliance requirements\n\n> Need support with documentation and compliance? ABLEBIZ can help.",
    conclusionMd:
      "### Final thought\n\nSmall improvements compound. Set up your business legally, keep records, and stay compliant — your future self will thank you.",
  },
  {
    slug: "how-to-register-an-ngo-in-nigeria",
    title: "How to Register an NGO in Nigeria (Trustees, Documents & Timeline)",
    excerpt:
      "A practical guide to NGO/Association registration in Nigeria: trustees setup, constitution, required documents, and what to expect.",
    dateISO: "2026-03-22",
    categories: ["NGO & Nonprofit Guide", "Business Registration"],
    featuredImage: "/images/blog/register-ngo.png",
    author,
    introMd:
      "If you’re building a mission-driven organization, proper NGO registration helps you operate legally, open accounts, and earn donor trust.",
    bodyMd:
      "## What you’re registering\n\nMany NGOs register under **Incorporated Trustees**. The process involves trustees, constitution, and supporting documents.\n\n## Key documents and steps\n\n- Trustee details\n- Constitution\n- Minutes/resolutions (as applicable)\n- CAC filing and follow-up\n\n## Timeline\n\nTimelines can vary based on requirements and CAC processing. The goal is to submit correctly the first time to avoid back-and-forth.\n\n> Want ABLEBIZ to handle the process end-to-end? Chat with us on WhatsApp.",
    conclusionMd:
      "### Need a guided NGO setup?\n\nABLEBIZ helps you structure trustees and submit the right documents for a smooth registration experience.",
  },
];
