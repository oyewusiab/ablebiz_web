/**
 * Authoritative Business Profile & Bank Accounts Types and API
 * Ablebiz Suite — Stage D Configuration Remediation
 */

export interface BusinessProfile {
  id: number;
  legal_name: string;
  trading_name: string;
  tagline: string;
  business_description: string;
  business_type: string;
  cac_registration_number: string;
  cac_accredited_agent_number: string;
  tax_identification_number: string;
  year_established: string;
  award_badge: string;

  // Contact Information
  primary_phone: string;
  secondary_phone: string;
  whatsapp_number: string;
  whatsapp_number_intl: string;
  primary_email: string;
  secondary_email: string;
  support_email: string;
  website_url: string;

  // Business Address
  address_line_1: string;
  address_line_2: string;
  city: string;
  lga: string;
  state: string;
  country: string;
  postal_code: string;

  // Document & Identity
  logo_url: string;
  default_payment_terms: string;
  document_disclaimer: string;
  document_footer_text: string;

  updated_at?: string;
  updated_by?: string | null;
}

export interface BusinessBankAccount {
  id?: string;
  business_profile_id?: number;
  account_slot: 1 | 2; // Slot 1 (Required/Primary), Slot 2 (Optional/Secondary)
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  is_active: boolean;
  is_default: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
}

export interface PublicBusinessProfile {
  legal_name: string;
  trading_name: string;
  tagline: string;
  business_description: string;
  year_established: string;
  award_badge: string;
  primary_phone: string;
  secondary_phone?: string;
  whatsapp_number: string;
  whatsapp_number_intl: string;
  primary_email: string;
  secondary_email?: string;
  support_email?: string;
  website_url: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  lga?: string;
  state: string;
  country: string;
  logo_url?: string;
  document_disclaimer?: string;
}

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  id: 1,
  legal_name: "ABLEBIZ Business Services",
  trading_name: "ABLEBIZ Business Services",
  tagline: "ABLEBIZ helps you formalize your business, handle the paperwork and stay on track.",
  business_description: "Professional corporate affairs, business formalization, CAC registration, and statutory compliance firm.",
  business_type: "Business Name / Enterprise",
  cac_registration_number: "",
  cac_accredited_agent_number: "",
  tax_identification_number: "",
  year_established: "2019",
  award_badge: "🏆 2nd Place – BYUMS Africa Business Plan Competition",
  primary_phone: "08160486023",
  secondary_phone: "",
  whatsapp_number: "08160486023",
  whatsapp_number_intl: "2348160486023",
  primary_email: "hello@ablebiz.com.ng",
  secondary_email: "",
  support_email: "support@ablebiz.com.ng",
  website_url: "https://www.ablebiz.com.ng",
  address_line_1: "Along M.K.O. Abiola Way",
  address_line_2: "Leme",
  city: "Abeokuta",
  lga: "Abeokuta South",
  state: "Ogun State",
  country: "Nigeria",
  postal_code: "",
  logo_url: "/brand/logo.png",
  default_payment_terms: "Payment due within 7 days of invoice issuance. Remit to designated official settlement account.",
  document_disclaimer: "Computer-generated official business document. CAC compliance and operational filings commence following payment reconciliation.",
  document_footer_text: "Physical office along M.K.O. Abiola Way, Leme, Abeokuta. Nationwide digital service delivery.",
};

export const DEFAULT_BANK_ACCOUNTS: BusinessBankAccount[] = [
  {
    account_slot: 1,
    bank_name: "",
    account_name: "",
    account_number: "",
    account_type: "Corporate Current",
    is_active: true,
    is_default: true,
    notes: "Primary settlement account",
  },
  {
    account_slot: 2,
    bank_name: "",
    account_name: "",
    account_number: "",
    account_type: "Corporate Current",
    is_active: false,
    is_default: false,
    notes: "Secondary / reserve account",
  },
];

/**
 * Formats a business address into a readable Nigerian single- or multi-line string.
 */
export function formatBusinessAddress(profile: Partial<BusinessProfile>): string {
  const parts: string[] = [];
  if (profile.address_line_1) parts.push(profile.address_line_1);
  if (profile.address_line_2) parts.push(profile.address_line_2);
  
  const cityLga = [profile.city, profile.lga].filter(Boolean).join(", ");
  if (cityLga) parts.push(cityLga);
  
  if (profile.state) parts.push(profile.state);
  if (profile.country) parts.push(profile.country);
  return parts.join(", ") || "Along M.K.O. Abiola Way, Leme, Abeokuta, Ogun State, Nigeria";
}

/**
 * Normalizes a Nigerian phone number into international format (234...)
 */
export function normalizeNigerianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return digits;
}

/**
 * Formats a phone number for UI display: "0816 048 6023"
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 13 && digits.startsWith("234")) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return phone;
}
