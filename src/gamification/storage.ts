import { type SpinRewardType } from "../content/gamification";
import { getSiteConfig } from "../referrals/siteConfig";
import { uid, load, save, normalizePhone, secureUint32, secureRandomFloat } from "../utils/storageHelpers";

export type SpinUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
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

const KEYS = {
  users: "ablebiz_spin_users",
  rewards: "ablebiz_spin_rewards",
} as const;



export function getSpinUsers(): SpinUser[] {
  return load<SpinUser[]>(KEYS.users, []);
}

export function getSpinRewards(): SpinReward[] {
  return load<SpinReward[]>(KEYS.rewards, []);
}



export function findUserByPhoneOrEmail(phone: string, email: string) {
  const p = normalizePhone(phone);
  const e = email.trim().toLowerCase();
  const users = getSpinUsers();
  return users.find((u) => u.phone === p || (e && u.email.toLowerCase() === e));
}



export function getOrCreateSpinUser(input: {
  name: string;
  email: string;
  phone: string;
}): SpinUser {
  const users = getSpinUsers();
  const existing = findUserByPhoneOrEmail(input.phone, input.email);
  if (existing) return existing;

  const user: SpinUser = {
    id: uid(),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: normalizePhone(input.phone),
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
  const { spinRewards } = getSiteConfig();
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
  const { spinRewards } = getSiteConfig();
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


