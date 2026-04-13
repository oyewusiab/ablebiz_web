import { useEffect, useMemo, useRef, useState } from "react";
import { Gift, Phone, Share2, Sparkles, X } from "lucide-react";
import { spinRewards, type SpinRewardType } from "../content/gamification";
import { buildWhatsAppLink, buildWhatsAppShareLink, site } from "../content/site";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import {
  awardRewardToUser,
  buildReferralLink,
  findUserByPhoneOrEmail,
  getOrCreateSpinUser,
  getRewardForUser,
  recordReferralIfEligible,
  type SpinReward,
  type SpinUser,
} from "./storage";
import { ReferralLeaderboard } from "./ReferralLeaderboard";
import { downloadAblebizEbookPdf } from "../utils/ebookPdf";
import { supabaseEnabled } from "../lib/supabaseClient";
import { rpcCreateSpinAndReward } from "../lib/supabaseApi";

type Props = {
  open: boolean;
  onClose: () => void;
  referralCode?: string;
  source?: string;
};

const SEGMENT_COLORS = [
  "#5CE65C",
  "#CCFFCC",
  "#7CF07C",
  "#B8FFB8",
];

function rewardIndex(type: SpinRewardType) {
  return Math.max(
    0,
    spinRewards.findIndex((r) => r.type === type)
  );
}

function copy(text: string) {
  return navigator.clipboard?.writeText(text);
}

export function SpinAndWinModal({ open, onClose, referralCode, source }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendToWhatsApp, setSendToWhatsApp] = useState(true);

  const [user, setUser] = useState<SpinUser | null>(null);
  const [reward, setReward] = useState<SpinReward | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rotation, setRotation] = useState(0);
  const pendingRewardType = useRef<SpinRewardType | null>(null);

  const [justCopied, setJustCopied] = useState<string | null>(null);

  // Reset UI when modal opens
  useEffect(() => {
    if (!open) return;
    setSpinning(false);
    setRotation(0);
    pendingRewardType.current = null;
    setJustCopied(null);
    setErrorMsg(null);

    // Don't wipe the form: users often close/reopen.
  }, [open]);

  // If user types phone/email that already exists, show existing reward (local mode only)
  useEffect(() => {
    if (!open) return;
    if (supabaseEnabled) return;
    if (!phone.trim() && !email.trim()) return;

    const existing = findUserByPhoneOrEmail(phone, email);
    if (!existing) return;

    const existingReward = getRewardForUser(existing.id);
    if (!existingReward) return;

    setUser(existing);
    setReward(existingReward);
  }, [open, phone, email]);

  const wheelStyle = useMemo(() => {
    const stops: string[] = [];
    const n = spinRewards.length;
    for (let i = 0; i < n; i++) {
      const start = (i / n) * 100;
      const end = ((i + 1) / n) * 100;
      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      stops.push(`${color} ${start}% ${end}%`);
    }
    return {
      backgroundImage: `conic-gradient(${stops.join(",")})`,
      transform: `rotate(${rotation}deg)`,
    } as React.CSSProperties;
  }, [rotation]);

  const canSpin =
    !spinning &&
    name.trim().length >= 2 &&
    email.trim().length >= 3 &&
    phone.trim().length >= 6 &&
    !reward;

  const referralNote = referralCode
    ? `Referral detected: ${referralCode} (you’ll help someone earn points).`
    : "";

  const referralLink = user ? buildReferralLink(user.referralCode) : undefined;

  const shareReferralText = useMemo(() => {
    if (!referralLink) return "";
    return (
      `🎁 ABLEBIZ Spin & Win (Free Reward)\n\n` +
      `Use my link to spin and win an instant reward: ${referralLink}\n\n` +
      `They help Nigerians with affordable CAC registration Nigeria, compliance & documentation.\n` +
      `After you win, message them on WhatsApp to redeem your reward.\n\n` +
      `Thank you!`
    );
  }, [referralLink]);

  const whatsappShareLink = useMemo(() => {
    if (!referralLink) return undefined;
    return buildWhatsAppShareLink(shareReferralText);
  }, [referralLink, shareReferralText]);

  const whatsapp = useMemo(() => {

    if (!reward) {
      return buildWhatsAppLink(
        "Hello ABLEBIZ, I want to register my business. Please guide me on the next steps."
      );
    }

    const text =
      `Hello ABLEBIZ, I just spun the Spin & Win wheel and got: ${reward.title}.\n` +
      `Reward code: ${reward.code}\n\n` +
      `Name: ${name || user?.name || "-"}\n` +
      `Phone: ${phone || user?.phone || "-"}\n` +
      `Email: ${email || user?.email || "-"}\n` +
      (user?.referralCode ? `My referral code: ${user.referralCode}\n` : "") +
      (user?.referredBy ? `Referred by: ${user.referredBy}\n` : "") +
      (source ? `Source: ${source}\n` : "") +
      "\nPlease guide me on how to redeem this reward and start my registration.";

    return buildWhatsAppLink(text);
  }, [reward, name, phone, email, user, source]);

  const mailto = useMemo(() => {
    const subject = encodeURIComponent("ABLEBIZ Spin & Win Reward Claim");
    const body = encodeURIComponent(
      reward
        ? `Spin & Win reward claim\n\nReward: ${reward.title}\nCode: ${reward.code}\n\nName: ${name || user?.name || "-"}\nPhone: ${phone || user?.phone || "-"}\nEmail: ${email || user?.email || "-"}\nReferral code: ${user?.referralCode ?? "-"}\nReferred by: ${user?.referredBy ?? "-"}\nSource: ${source ?? "-"}`
        : `Hello ABLEBIZ, I want to register my business.\n\nName: ${name || "-"}\nPhone: ${phone || "-"}\nEmail: ${email || "-"}`
    );
    return `mailto:${site.email}?subject=${subject}&body=${body}`;
  }, [reward, name, phone, email, user, source]);

  const onSpin = () => {
    if (!canSpin) return;

    const referredBy = referralCode;
    const created = getOrCreateSpinUser({ name, email, phone, referredBy });
    setUser(created);

    // award reward first (for persistence)
    const r = awardRewardToUser(created.id);
    setReward(r);

    // referral credit
    recordReferralIfEligible(created);

    // wheel animation
    const idx = rewardIndex(r.type);
    pendingRewardType.current = r.type;

    const n = spinRewards.length;
    const segment = 360 / n;

    // Align the chosen segment to the pointer at the top.
    const chosenCenter = idx * segment + segment / 2;
    const stopAt = 360 - chosenCenter;

    const baseSpins = 5;
    const u = (() => {
      try {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return (arr[0] ?? 0) / 2 ** 32;
      } catch {
        return Math.random();
      }
    })();
    const jitter = u * (segment * 0.25) - segment * 0.125;
    const next = rotation + baseSpins * 360 + stopAt + jitter;

    setSpinning(true);
    window.setTimeout(() => setRotation(next), 20);
  };

  const onWheelTransitionEnd = () => {
    if (!spinning) return;
    setSpinning(false);

    // auto deliver ebook reward
    if (reward?.type === "free_ebook") {
      try {
        downloadAblebizEbookPdf();
      } catch {
        // ignore
      }
    }

    if (sendToWhatsApp) {
      window.open(whatsapp, "_blank", "noreferrer");
    }
  };

  const copyWithToast = async (label: string, value: string) => {
    try {
      await copy(value);
      setJustCopied(label);
      window.setTimeout(() => setJustCopied(null), 1400);
    } catch {
      setJustCopied("Copy failed");
      window.setTimeout(() => setJustCopied(null), 1400);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl">
        <Card className="shadow-xl">
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
                  <Sparkles className="h-5 w-5" /> Spin & Win
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  Get an instant reward and start your registration with confidence.
                </p>
                <p className="mt-1 text-xs font-semibold text-[color:var(--ablebiz-accent)]">
                  {referralNote || "Tip: Use WhatsApp for the fastest response."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-emerald-100 hover:bg-emerald-50"
              >
                <X className="h-4 w-4" /> Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-4 text-xs text-slate-700 ring-1 ring-emerald-100">
                  We collect your details so we can follow up on WhatsApp/phone. No spam.
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="Your full name"
                      required
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold text-slate-700">
                      Email
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="hello@..."
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-slate-700">
                      Phone (WhatsApp)
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="e.g., 0816..."
                        required
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={sendToWhatsApp}
                      onChange={(e) => setSendToWhatsApp(e.target.checked)}
                      className="h-4 w-4 rounded border-emerald-300"
                    />
                    After I win, send my reward to WhatsApp automatically
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={onSpin} disabled={!canSpin}>
                      <Gift className="h-4 w-4" /> {reward ? "Reward claimed" : spinning ? "Spinning..." : "Spin Now"}
                    </Button>
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
                    >
                      Prefer WhatsApp first?
                    </a>
                  </div>

                  {reward ? (
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-100">
                      <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                        Your reward: {reward.title}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        Reward code: <span className="font-semibold">{reward.code}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--ablebiz-cta)] px-4 text-sm font-extrabold text-slate-900 shadow-sm ring-1 ring-emerald-200 hover:brightness-95"
                        >
                          Chat on WhatsApp (Redeem)
                        </a>
                        <a
                          href={mailto}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-[color:var(--ablebiz-primary)] ring-1 ring-emerald-200 hover:bg-emerald-50"
                        >
                          Email us
                        </a>
                        <a
                          href={`tel:${site.phone}`}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-[color:var(--ablebiz-primary)] ring-1 ring-emerald-200 hover:bg-emerald-50"
                        >
                          <Phone className="h-4 w-4" /> Call
                        </a>
                        {whatsappShareLink ? (
                          <a
                            href={whatsappShareLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-extrabold text-[color:var(--ablebiz-primary)] ring-1 ring-emerald-200 hover:bg-emerald-50"
                          >
                            <Share2 className="h-4 w-4" /> Share to WhatsApp
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-2">
                        <button
                          type="button"
                          onClick={() => copyWithToast("Reward code", reward.code)}
                          className="text-left text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
                        >
                          Copy reward code
                        </button>
                        {referralLink ? (
                          <button
                            type="button"
                            onClick={() => copyWithToast("Referral link", referralLink)}
                            className="text-left text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
                          >
                            Copy my referral link
                          </button>
                        ) : null}
                        {justCopied ? (
                          <div className="text-xs font-semibold text-slate-600">
                            {justCopied} copied.
                          </div>
                        ) : null}
                      </div>

                      {reward.type === "free_ebook" ? (
                        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs text-slate-700 ring-1 ring-emerald-100">
                          Your ebook should download automatically. If it doesn’t, you can spin message us
                          on WhatsApp and we’ll send it.
                        </div>
                      ) : null}

                      <div className="mt-5">
                        <div className="text-xs font-extrabold text-[color:var(--ablebiz-primary)]">
                          Earn more rewards
                        </div>
                        <p className="mt-1 text-xs text-slate-700">
                          Share your referral link — when someone signs up, you earn points.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-4 text-xs text-slate-700 ring-1 ring-emerald-100">
                  <span className="font-extrabold text-[color:var(--ablebiz-primary)]">Fair spin:</span> each reward has an equal chance.
                  One spin per phone/email (your reward is saved so you can redeem anytime).
                </div>

                <div className="grid place-items-center rounded-3xl bg-white/70 p-6 ring-1 ring-emerald-100">
                  <div className="relative">
                    <div className="absolute -top-3 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[12px] border-r-[12px] border-b-[18px] border-l-transparent border-r-transparent border-b-[color:var(--ablebiz-primary)]" />
                    <div
                      className="h-72 w-72 rounded-full ring-1 ring-emerald-200 shadow-sm"
                      style={{
                        ...wheelStyle,
                        transition: spinning ? "transform 3.6s cubic-bezier(0.15, 0.75, 0.15, 1)" : "none",
                      }}
                      onTransitionEnd={onWheelTransitionEnd}
                      aria-label="Spin wheel"
                    />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-sm ring-1 ring-emerald-200">
                        <span className="text-xs font-extrabold text-[color:var(--ablebiz-primary)]">
                          ABLEBIZ
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 w-full">
                    <div className="text-xs font-extrabold text-[color:var(--ablebiz-primary)]">
                      Rewards on the wheel
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-slate-700">
                      {spinRewards.map((r) => (
                        <div
                          key={r.type}
                          className="flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-emerald-100"
                        >
                          <span className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          <div>
                            <div className="font-semibold text-slate-900">{r.title}</div>
                            <div className="text-xs text-slate-600">{r.short}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <ReferralLeaderboard />

                <div className="rounded-2xl bg-emerald-50 p-4 text-xs text-slate-700 ring-1 ring-emerald-100">
                  Professional note: This MVP stores rewards locally in your browser and also sends your
                  reward details to WhatsApp (optional) for ABLEBIZ to redeem quickly.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
