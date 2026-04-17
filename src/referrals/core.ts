import { uid, load, save, normalizePhone, secureRandomInt } from "../utils/storageHelpers";
import { getSiteConfig } from "./siteConfig";

export type UserGroup = "visitor" | "prospect" | "client" | "returning_client" | "vip";

export type ReferralTier = {
  referralsRequired: number;
  title: string;
  note: string;
};

export const USER_GROUPS: { id: UserGroup; label: string; color: string }[] = [
  { id: "visitor", label: "Visitor", color: "bg-slate-100 text-slate-500" },
  { id: "prospect", label: "Prospect", color: "bg-blue-100 text-blue-600" },
  { id: "client", label: "Client", color: "bg-emerald-100 text-emerald-600" },
  { id: "returning_client", label: "Returning Client", color: "bg-amber-100 text-amber-600" },
  { id: "vip", label: "VIP", color: "bg-purple-100 text-purple-600" },
];

export type ReferralClient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  group: UserGroup;
  createdAt: string;
};

export type LeadStatus = "pending" | "in-progress" | "completed" | "reversed";

export type ConsultationLead = {
  id: string;
  type: "consultation_request";
  name: string;
  phone: string;
  email: string;
  serviceNeeded: string;
  message?: string;
  status: LeadStatus;
  group: UserGroup;
  createdAt: string;
};

export type ReferralConversion = {
  id: string;
  referrerCode: string; // The code that brought them in
  convertedUserId: string; // the newly generated Client who was referred
  points: number;
  createdAt: string;
};

export type ReferralRedemption = {
  id: string;
  clientCode: string;
  tierRequired: number;
  rewardTitle: string;
  status: "pending" | "fulfilled";
  createdAt: string;
};

const KEYS = {
  clients: "ablebiz_ref_clients",
  conversions: "ablebiz_ref_conversions",
  redemptions: "ablebiz_ref_redemptions",
} as const;

export function getReferralClients(): ReferralClient[] {
  return load<ReferralClient[]>(KEYS.clients, []);
}

export function getReferralConversions(): ReferralConversion[] {
  return load<ReferralConversion[]>(KEYS.conversions, []);
}

export function getReferralRedemptions(): ReferralRedemption[] {
  return load<ReferralRedemption[]>(KEYS.redemptions, []);
}

export function findClientByCode(code: string): ReferralClient | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim().toLowerCase().replace(/^ref-/, "");
  const clients = getReferralClients();
  return clients.find((c) => {
    const target = c.referralCode.toLowerCase().replace(/^ref-/, "");
    return target === cleanCode;
  });
}

export function findClientByPhoneOrEmail(phone: string, email: string) {
  const p = normalizePhone(phone);
  const e = email?.trim().toLowerCase();
  if (!p && !e) return undefined;
  
  const clients = getReferralClients();
  return clients.find((c) => c.phone === p || (e && c.email.toLowerCase() === e));
}

function generateCode(existing: ReferralClient[]): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let i = 0; i < 20; i++) {
    const rand =
      letters[secureRandomInt(letters.length)] +
      letters[secureRandomInt(letters.length)] +
      String(1000 + secureRandomInt(9000));
    const code = `REF-${rand}`;
    if (!existing.some((u) => u.referralCode === code)) return code;
  }
  return `REF-${Date.now().toString().slice(-6)}`;
}

export function getOrCreateReferralClient(input: {
  name: string;
  email: string;
  phone: string;
  referralCode?: string;
  group?: UserGroup;
}): ReferralClient {
  const clients = getReferralClients();
  const existing = findClientByPhoneOrEmail(input.phone, input.email);
  if (existing) return existing;

  // Determine referral code: honour a clean provided code if it's unique,
  // otherwise fall back to the collision-safe generator.
  let finalCode: string;
  if (input.referralCode) {
    const candidate = input.referralCode.trim().toUpperCase();
    const isDuplicate = clients.some((c) => c.referralCode.toUpperCase() === candidate);
    finalCode = isDuplicate ? generateCode(clients) : candidate;
  } else {
    finalCode = generateCode(clients);
  }

  const client: ReferralClient = {
    id: uid(),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: normalizePhone(input.phone),
    referralCode: finalCode,
    group: "client",
    createdAt: new Date().toISOString(),
  };

  save(KEYS.clients, [client, ...clients]);
  return client;
}

export function recordReferralConversion(referrerCode: string, newClientInfo: { name: string; email: string; phone: string }) {
  if (!referrerCode) return;
  const referrer = findClientByCode(referrerCode);
  if (!referrer) return;

  const newClient = getOrCreateReferralClient(newClientInfo);
  if (referrer.id === newClient.id) return; // cannot refer self

  const conversions = getReferralConversions();
  // Ensure we haven't already rewarded this conversion (one reward per referred user)
  const alreadyLinked = conversions.some((c) => c.convertedUserId === newClient.id);
  if (alreadyLinked) return;

  const conversion: ReferralConversion = {
    id: uid(),
    referrerCode: referrer.referralCode,
    convertedUserId: newClient.id,
    points: 1, // 1 successful referral = 1 point
    createdAt: new Date().toISOString(),
  };

  save(KEYS.conversions, [conversion, ...conversions]);
}

export type ReferrerStats = {
  client: ReferralClient;
  totalReferrals: number;
  currentTier: ReferralTier | null;
  nextTier: ReferralTier | null;
};

export function getReferrerStats(code: string): ReferrerStats | null {
  const client = findClientByCode(code);
  if (!client) return null;

  const conversions = getReferralConversions();
  const count = conversions.filter((c) => c.referrerCode.toLowerCase() === code.toLowerCase()).length;

  const { referralTiers } = getSiteConfig();
  let currentTier: any | null = null;
  let nextTier: any | null = null;

  // Find highest unlocked tier
  for (const t of [...referralTiers].reverse()) {
    if (count >= t.referralsRequired) {
      currentTier = t;
      break;
    }
  }

  // Find next tier
  for (const t of referralTiers) {
    if (count < t.referralsRequired) {
      nextTier = t;
      break;
    }
  }

  return {
    client,
    totalReferrals: count,
    currentTier,
    nextTier,
  };
}

export function recordRedemption(code: string, tier: any) {
  const redemptions = getReferralRedemptions();
  
  // check if already redeemed for this specific tier
  const exists = redemptions.some(r => r.clientCode === code && r.tierRequired === tier.referralsRequired);
  if (exists) return;

  const redemption: ReferralRedemption = {
    id: uid(),
    clientCode: code,
    tierRequired: tier.referralsRequired,
    rewardTitle: tier.title,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  save(KEYS.redemptions, [redemption, ...redemptions]);
}

export function updateRedemptionStatus(id: string, status: "pending" | "fulfilled") {
  const redemptions = getReferralRedemptions();
  const idx = redemptions.findIndex(r => r.id === id);
  if (idx === -1) return;

  redemptions[idx].status = status;
  save(KEYS.redemptions, redemptions);
}

export function isTierRedeemed(code: string, referralsRequired: number): boolean {
  const redemptions = getReferralRedemptions();
  return redemptions.some(r => r.clientCode === code && r.tierRequired === referralsRequired);
}

export function getEnrichedConversions() {
  const conversions = getReferralConversions();
  const clients = getReferralClients();
  
  return conversions.map(conv => ({
    ...conv,
    referrer: clients.find(c => c.referralCode.toLowerCase() === conv.referrerCode.toLowerCase()),
    converted: clients.find(c => c.id === conv.convertedUserId),
  }));
}

export function getEnrichedRedemptions() {
  const redemptions = getReferralRedemptions();
  const clients = getReferralClients();
  
  return redemptions.map(red => ({
    ...red,
    client: clients.find(c => c.referralCode.toLowerCase() === red.clientCode.toLowerCase()),
  }));
}

export function deleteReferralClient(id: string) {
  const clients = getReferralClients();
  const filtered = clients.filter(c => c.id !== id);
  save(KEYS.clients, filtered);
}

export function awardPoints(code: string, amount: number) {
  const conversions = getReferralConversions();
  const conversion: ReferralConversion = {
    id: uid(),
    referrerCode: code,
    convertedUserId: "manual-award-" + Date.now(),
    points: amount,
    createdAt: new Date().toISOString(),
  };
  save(KEYS.conversions, [conversion, ...conversions]);
}

export function manualRecordConversion(referrerCode: string, name: string, email: string, phone: string) {
  const referrer = findClientByCode(referrerCode);
  if (!referrer) throw new Error("Referrer not found");

  const newClient = getOrCreateReferralClient({ name, email, phone });
  if (referrer.id === newClient.id) return;

  const conversions = getReferralConversions();
  const alreadyLinked = conversions.some((c) => c.convertedUserId === newClient.id);
  if (alreadyLinked) return;

  const conversion: ReferralConversion = {
    id: uid(),
    referrerCode: referrer.referralCode,
    convertedUserId: newClient.id,
    points: 1,
    createdAt: new Date().toISOString(),
  };

  save(KEYS.conversions, [conversion, ...conversions]);
}

export function getBusinessHealthReport() {
  const clients = getReferralClients();
  const conversions = getReferralConversions();
  const redemptions = getReferralRedemptions();
  
  const leads = JSON.parse(localStorage.getItem("ablebiz_leads") ?? "[]");
  const spins = JSON.parse(localStorage.getItem("ablebiz_spin_users") ?? "[]");

  const totalInteractions = clients.length + leads.length + spins.length || 1;

  // Comprehensive group breakdown
  const unified = [...clients, ...leads, ...spins];

  return {
    totalReferrers: clients.length,
    totalConversions: conversions.length,
    totalLeads: leads.length,
    totalSpins: spins.length,
    pendingRedemptions: redemptions.filter(r => r.status === "pending").length,
    referralSuccessRate: clients.length > 0 ? (conversions.length / clients.length).toFixed(2) : 0,
    funnel: {
      discovery: totalInteractions,
      engagement: spins.length + leads.length,
      conversion: leads.length,
      advocacy: clients.length
    },
    leadsByService: leads.reduce((acc: any, lead: any) => {
      acc[lead.serviceNeeded] = (acc[lead.serviceNeeded] || 0) + 1;
      return acc;
    }, {}),
    groupBreakdown: {
      visitor: unified.filter((u: any) => u.group === "visitor").length,
      prospect: unified.filter((u: any) => u.group === "prospect").length,
      client: unified.filter((u: any) => u.group === "client").length,
      returning_client: unified.filter((u: any) => u.group === "returning_client").length,
      vip: unified.filter((u: any) => u.group === "vip").length,
    }
  };
}

export function getLeads(): ConsultationLead[] {
  return load<ConsultationLead[]>("ablebiz_leads", []);
}

export function saveLeads(leads: ConsultationLead[]) {
  save("ablebiz_leads", leads);
}

export function updateLeadStatus(id: string, status: LeadStatus) {
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === id);
  if (idx === -1) return;
  leads[idx].status = status;
  
  // Graduate to Client if completed
  if (status === "completed") {
    leads[idx].group = "client";
  }
  
  saveLeads(leads);
}

export function deleteLead(id: string) {
  const leads = getLeads();
  const filtered = leads.filter(l => l.id !== id);
  saveLeads(filtered);
}

export function createOrUpdateClient(data: Partial<ReferralClient>) {
  const clients = getReferralClients();
  if (data.id) {
    const idx = clients.findIndex(c => c.id === data.id);
    if (idx !== -1) {
      clients[idx] = { ...clients[idx], ...data } as ReferralClient;
      save(KEYS.clients, clients);
      return clients[idx];
    }
  }
  
  const client: ReferralClient = {
    id: uid(),
    name: data.name || "",
    email: data.email || "",
    phone: normalizePhone(data.phone || ""),
    referralCode: data.referralCode || `REF-${uid().slice(0, 6).toUpperCase()}`,
    group: data.group || "client",
    createdAt: new Date().toISOString(),
  };
  save(KEYS.clients, [client, ...clients]);
  return client;
}

export function getUnifiedClients() {
  const list: any[] = [];
  
  // 1. Referral Clients
  const refs = getReferralClients();
  list.push(...refs.map(r => ({ 
    ...r, 
    source: "referral", 
    sourceLabel: "Referral Program", 
    status: "completed",
    group: r.group || (r.referralCode ? "client" : "prospect")
  })));

  // 2. Consultation Leads
  const leads = getLeads();
  list.push(...leads.map(l => ({ 
    ...l,
    source: "consultation", 
    sourceLabel: "Consultation Request",
    group: l.group || "prospect"
  })));

  // 3. Spin Users (from separate gamification storage)
  try {
     const spins = JSON.parse(localStorage.getItem("ablebiz_spin_users") ?? "[]");
     list.push(...spins.map((s: any) => ({ 
      ...s, 
      source: "spin", 
      sourceLabel: "Spin & Win Game",
      status: "completed",
      group: s.group || "visitor"
    })));
  } catch {}

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * generateUniqueCode — Collision-safe referral code generator for admin use.
 * Checks the persisted client list before returning a code so it's guaranteed
 * to be unique at the time of generation.
 */
export function generateUniqueCode(): string {
  const clients = getReferralClients();
  return generateCode(clients);
}
