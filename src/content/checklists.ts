export type Checklist = {
  id: string;
  title: string;
  description: string;
  relatedServiceIds: string[];
  bullets: string[];
  notes?: string[];
};

export const checklists: Checklist[] = [
  {
    id: "cac-registration-requirements",
    title: "CAC Registration Requirements (2026 Checklist)",
    description:
      "A quick, practical checklist to prepare your details before CAC business/company registration.",
    relatedServiceIds: ["cac-registration"],
    bullets: [
      "Proposed business name options (2–3 alternatives)",
      "Nature of business / business objectives (clear and specific)",
      "Business address (including LGA and State)",
      "Owner/Director details: full name, phone number, email",
      "Means of identification (NIN/Driver’s Licence/International Passport/Voter’s Card)",
      "Date of birth and residential address",
      "Passport photograph (where applicable)",
      "For company registration: share structure and director information",
      "For professional guidance: your preferred timeline and budget range",
    ],
    notes: [
      "Timelines can vary depending on CAC processing and completeness of information.",
      "Need help? ABLEBIZ is a trusted CAC agent in Abeokuta and supports clients nationwide.",
    ],
  },
  {
    id: "business-name-documents",
    title: "Documents Needed for Business Name Registration",
    description:
      "Know exactly what to prepare for a smooth Business Name registration in Nigeria.",
    relatedServiceIds: ["cac-registration"],
    bullets: [
      "2–3 proposed business names",
      "Owner/proprietor details (name, phone, email)",
      "Valid ID of the proprietor",
      "Business address",
      "Nature of business",
      "Next-of-kin details (often requested)",
    ],
    notes: [
      "If you’re unsure whether you should register a Business Name or Company, ABLEBIZ can advise based on your goals.",
    ],
  },
  {
    id: "ngo-registration-checklist",
    title: "NGO / Association Registration Checklist",
    description:
      "A structured checklist to help you set up and register NGOs, associations, and incorporated trustees properly.",
    relatedServiceIds: ["ngo-registration"],
    bullets: [
      "Proposed name options (2–3 alternatives)",
      "Aims and objectives (clear and impact-focused)",
      "Registered address",
      "Trustees’ details (names, phone numbers, emails, addresses)",
      "Trustees’ valid IDs and passport photographs",
      "Minutes of meeting / resolution to appoint trustees",
      "Constitution / governing document (draft or existing)",
      "Membership structure and key officers",
    ],
    notes: [
      "NGO/Trustees registration has additional publication and documentation steps — ABLEBIZ guides you end-to-end.",
    ],
  },
  {
    id: "tax-compliance-requirements",
    title: "Tax & Compliance Checklist (TIN, TCC, BPP, NSITF)",
    description:
      "Essential checklist for post-incorporation tax clearance, corporate compliance, and contractor registration.",
    relatedServiceIds: ["compliance"],
    bullets: [
      "CAC registration documents (Certificate & Status Report)",
      "Company Tax Identification Number (TIN / JTB)",
      "Valid government-issued IDs of all Directors/Proprietors",
      "Recent business utility bill / address verification",
      "Employee details & payroll structure (for NSITF/ITF compliance)",
      "Financial statements or turnover summary (for Tax Clearance Certificate)",
      "Relevant sector licenses or professional certifications (if applicable)",
    ],
    notes: [
      "Tax and regulatory requirements vary by company age and structure. ABLEBIZ will confirm your exact obligations and handle filings smoothly.",
    ],
  },
];

export function getChecklistById(id: string) {
  return checklists.find((c) => c.id === id);
}

export function getChecklistsForService(serviceId: string) {
  return checklists.filter((c) => c.relatedServiceIds.includes(serviceId));
}
