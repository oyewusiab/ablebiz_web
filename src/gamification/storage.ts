import { referralRules, spinRewards, type SpinRewardType } from "../content/gamification";

export type SpinUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  referredBy?: string;
  createdAt: string;
};

export type SpinReward = {
  id: string;
  userId: string;
  type: SpinRewardType;
  title: string;
  code: string;
  redeemed: boolean;
  createdAt: string;
};

export type ReferralPoint = {
  id: string;
  referrerId: string;
  referredUserId: string;
  points: number;
  createdAt: string;
};

const KEYS = {
  users: "ablebiz_spin_users",
  rewards: "ablebiz_spin_rewards",
  referrals: "ablebiz_spin_referrals",
} as const;

function safeParse<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return safeParse<T>(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked in some in-app/private browsers; fail silently.
  }
}

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function secureUint32() {
  try {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] ?? Math.floor(Math.random() * 2 ** 32);
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

function secureRandomFloat() {
  // [0, 1)
  return secureUint32() / 2 ** 32;
}

function secureRandomInt(maxExclusive: number) {
  if (maxExclusive <= 0) return 0;
  return Math.floor(secureRandomFloat() * maxExclusive);
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim();
}

export function getSpinUsers(): SpinUser[] {
  return load<SpinUser[]>(KEYS.users, []);
}

export function getSpinRewards(): SpinReward[] {
  return load<SpinReward[]>(KEYS.rewards, []);
}

export function getSpinReferrals(): ReferralPoint[] {
  return load<ReferralPoint[]>(KEYS.referrals, []);
}

export function findUserByReferralCode(referralCode: string) {
  const users = getSpinUsers();
  return users.find((u) => u.referralCode.toLowerCase() === referralCode.toLowerCase());
}

export function findUserByPhoneOrEmail(phone: string, email: string) {
  const p = normalizePhone(phone);
  const e = email.trim().toLowerCase();
  const users = getSpinUsers();
  return users.find((u) => u.phone === p || (e && u.email.toLowerCase() === e));
}

function generateReferralCode(existing: SpinUser[]) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let i = 0; i < 20; i++) {
    const rand =
      letters[secureRandomInt(letters.length)] +
      letters[secureRandomInt(letters.length)] +
      String(1000 + secureRandomInt(9000));
    const code = `ABLE${rand}`;
    if (!existing.some((u) => u.referralCode === code)) return code;
  }
  return `ABLE${Date.now().toString().slice(-6)}`;
}

export function getOrCreateSpinUser(input: {
  name: string;
  email: string;
  phone: string;
  referredBy?: string;
}): SpinUser {
  const users = getSpinUsers();
  const existing = findUserByPhoneOrEmail(input.phone, input.email);
  if (existing) return existing;

  const user: SpinUser = {
    id: uid(),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: normalizePhone(input.phone),
    referralCode: generateReferralCode(users),
    referredBy: input.referredBy,
    createdAt: new Date().toISOString(),
  };

  save(KEYS.users, [user, ...users].slice(0, 500));
  return user;
}

export function getRewardForUser(userId: string) {
  const rewards = getSpinRewards();
  return rewards.find((r) => r.userId === userId);
}

export function weightedPickRewardType(): SpinRewardType {
  const total = spinRewards.reduce((sum, r) => sum + r.weight, 0);
  const r = secureRandomFloat() * total;
  let acc = 0;
  for (const opt of spinRewards) {
    acc += opt.weight;
    if (r <= acc) return opt.type;
  }
  return spinRewards[0]?.type ?? "discount_1000";
}

function rewardTitle(type: SpinRewardType) {
  return spinRewards.find((r) => r.type === type)?.title ?? "Reward";
}

function generateRewardCode(type: SpinRewardType) {
  const base = type.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  const rand = secureUint32().toString(16).slice(0, 4).toUpperCase().padEnd(4, "0");
  return `ABZ-${base}-${rand}`;
}

export function awardRewardToUser(userId: string, type?: SpinRewardType): SpinReward {
  const rewards = getSpinRewards();
  const existing = rewards.find((r) => r.userId === userId);
  if (existing) return existing;

  const chosen: SpinRewardType = type ?? weightedPickRewardType();
  const reward: SpinReward = {
    id: uid(),
    userId,
    type: chosen,
    title: rewardTitle(chosen),
    code: generateRewardCode(chosen),
    redeemed: false,
    createdAt: new Date().toISOString(),
  };

  save(KEYS.rewards, [reward, ...rewards].slice(0, 1000));
  return reward;
}

export function recordReferralIfEligible(referredUser: SpinUser) {
  if (!referredUser.referredBy) return;

  const referrer = findUserByReferralCode(referredUser.referredBy);
  if (!referrer) return;
  if (referrer.id === referredUser.id) return;

  const existing = getSpinReferrals();
  const already = existing.some(
    (r) => r.referrerId === referrer.id && r.referredUserId === referredUser.id
  );
  if (already) return;

  const referral: ReferralPoint = {
    id: uid(),
    referrerId: referrer.id,
    referredUserId: referredUser.id,
    points: referralRules.pointsPerReferral,
    createdAt: new Date().toISOString(),
  };

  save(KEYS.referrals, [referral, ...existing].slice(0, 5000));
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type LeaderboardRow = {
  user: SpinUser;
  points: number;
  referrals: number;
};

export function getMonthlyLeaderboard(key = monthKey()): LeaderboardRow[] {
  const users = getSpinUsers();
  const referrals = getSpinReferrals();

  const pointsByUser = new Map<string, number>();
  for (const r of referrals) {
    const k = monthKey(new Date(r.createdAt));
    if (k !== key) continue;
    pointsByUser.set(r.referrerId, (pointsByUser.get(r.referrerId) ?? 0) + r.points);
  }

  const rows: LeaderboardRow[] = [];
  for (const [userId, points] of pointsByUser.entries()) {
    const user = users.find((u) => u.id === userId);
    if (!user) continue;
    rows.push({
      user,
      points,
      referrals: Math.floor(points / referralRules.pointsPerReferral),
    });
  }

  rows.sort((a, b) => b.points - a.points);
  return rows.slice(0, 5);
}

export function buildReferralLink(referralCode: string) {
  if (typeof window === "undefined") return `/?ref=${encodeURIComponent(referralCode)}`;
  return `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}`;
}
