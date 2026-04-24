import { useEffect, useMemo, useRef, useState } from "react";
import { Gift, Phone, Sparkles, X } from "lucide-react";
import { type SpinRewardType } from "../content/gamification";
import { buildWhatsAppLink } from "../content/site";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import {
  awardRewardToUser,
  findUserByPhoneOrEmail,
  getOrCreateSpinUser,
  getRewardForUser,
  type SpinReward,
  type SpinUser,
} from "./storage";

import { downloadAblebizEbookPdf } from "../utils/ebookPdf";
import { supabaseEnabled } from "../lib/supabaseClient";
import { useSiteConfig } from "../referrals/siteConfig";

type Props = {
  open: boolean;
  onClose: () => void;
  source?: string;
};

const SEGMENT_COLORS = [
  "#107A10", // Primary Green
  "#FFD700", // Gold
  "#C0C0C0", // Silver
  "#1E40AF", // Blue
  "#78c51c", // Ablebiz Green
  "#F59E0B", // Amber
];

function copy(text: string) {
  return navigator.clipboard?.writeText(text);
}

export function SpinAndWinModal({ open, onClose, source }: Props) {
  const { spinRewards, site } = useSiteConfig();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendToWhatsApp, setSendToWhatsApp] = useState(true);

  const [user, setUser] = useState<SpinUser | null>(null);
  const [reward, setReward] = useState<SpinReward | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const pendingRewardType = useRef<string | null>(null);

  const [justCopied, setJustCopied] = useState<string | null>(null);

  // Reset UI when modal opens
  useEffect(() => {
    if (!open) return;
    setSpinning(false);
    setRotation(0);
    pendingRewardType.current = null;
    setJustCopied(null);
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
    const n = spinRewards.length || 1;
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
  }, [rotation, spinRewards]);

  const canSpin =
    !spinning &&
    name.trim().length >= 2 &&
    email.trim().length >= 3 &&
    phone.trim().length >= 6 &&
    !reward;

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
      (source ? `Source: ${source}\n` : "") +
      "\nPlease guide me on how to redeem this reward and start my registration.";

    return buildWhatsAppLink(text);
  }, [reward, name, phone, email, user, source]);

  const mailto = useMemo(() => {
    const subject = encodeURIComponent("ABLEBIZ Spin & Win Reward Claim");
    const body = encodeURIComponent(
      reward
        ? `Spin & Win reward claim\n\nReward: ${reward.title}\nCode: ${reward.code}\n\nName: ${name || user?.name || "-"}\nPhone: ${phone || user?.phone || "-"}\nEmail: ${email || user?.email || "-"}\nSource: ${source ?? "-"}`
        : `Hello ABLEBIZ, I want to register my business.\n\nName: ${name || "-"}\nPhone: ${phone || "-"}\nEmail: ${email || "-"}`
    );
    return `mailto:${site.email}?subject=${subject}&body=${body}`;
  }, [reward, name, phone, email, user, source, site.email]);

  const onSpin = () => {
    if (!canSpin) return;

    const created = getOrCreateSpinUser({ name, email, phone });
    setUser(created);

    const r = awardRewardToUser(created.id);
    setReward(r);

    const idx = Math.max(0, spinRewards.findIndex((rew) => rew.type === r.type));
    pendingRewardType.current = r.type;

    const n = spinRewards.length || 1;
    const segment = 360 / n;

    const chosenCenter = idx * segment + segment / 2;
    const stopAt = 360 - chosenCenter;

    const baseSpins = 8; // More spins for longer duration
    const u = Math.random();
    const jitter = u * (segment * 0.25) - segment * 0.125;
    const next = rotation + baseSpins * 360 + stopAt + jitter;

    setSpinning(true);
    window.setTimeout(() => setRotation(next), 20);
  };

  const onWheelTransitionEnd = () => {
    if (!spinning) return;
    setSpinning(false);

    if (reward?.type === "free_ebook") {
      try { downloadAblebizEbookPdf(); } catch { }
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center p-4 py-8">
        <div className="w-full max-w-4xl">
        <Card className="shadow-xl">
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-lg font-extrabold text-[#111827]">
                  <Sparkles className="h-5 w-5 text-emerald-500" /> Spin & Win
                </div>
                <p className="mt-1 text-sm text-slate-700 font-medium italic">
                  Get an instant reward and start your registration with confidence.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-emerald-100 hover:bg-emerald-50 transition-all shadow-sm"
              >
                <X className="h-4 w-4" /> Close
              </button>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div className="space-y-6">
                <div className="rounded-2xl bg-emerald-50 p-4 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 uppercase tracking-widest italic">
                  Trusted by 5,000+ Nigerian Entrepreneurs
                </div>

                <div className="grid gap-5">
                  <label className="grid gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                    Name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 rounded-xl bg-slate-50 px-4 text-sm font-bold ring-1 ring-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                      placeholder="Your full name"
                      required
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                      Email
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 rounded-xl bg-slate-50 px-4 text-sm font-bold ring-1 ring-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                        placeholder="hello@..."
                        required
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                      Phone (WhatsApp)
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 rounded-xl bg-slate-50 px-4 text-sm font-bold ring-1 ring-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                        placeholder="e.g., 0816..."
                        required
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl ring-1 ring-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendToWhatsApp}
                      onChange={(e) => setSendToWhatsApp(e.target.checked)}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Chat on WhatsApp automatically after spin
                  </label>

                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <Button type="button" onClick={onSpin} disabled={!canSpin} className="h-14 px-8 shadow-xl shadow-emerald-500/20 text-sm font-black uppercase tracking-widest">
                      <Gift className="h-5 w-5 mr-2" /> {reward ? "Reward claimed" : spinning ? "Spinning..." : "Spin Now"}
                    </Button>
                  </div>

                  {reward && !spinning && (
                    <div className="rounded-3xl bg-slate-900 p-8 text-white space-y-5 animate-in zoom-in-95 duration-500 relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                         <Sparkles className="h-32 w-32" />
                      </div>
                      <div className="relative">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">CONGRATULATIONS!</div>
                        <h4 className="text-xl font-black italic tracking-tight">You won: {reward.title}</h4>
                        <div className="mt-4 flex items-center justify-between bg-white/5 rounded-2xl p-4 ring-1 ring-white/10 italic">
                          <div>
                            <div className="text-[10px] text-slate-400 font-black uppercase mb-0.5">Reward Code</div>
                            <div className="text-lg font-black tracking-widest">{reward.code}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyWithToast("Reward code", reward.code)}
                            className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all"
                          >
                            <Sparkles className="h-4 w-4 text-emerald-400" />
                          </button>
                        </div>

                        <div className="grid gap-3 mt-6">
                           <button
                             onClick={() => window.open(whatsapp, "_blank", "noreferrer")}
                             className="h-12 bg-emerald-500 text-slate-950 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
                           >
                             Redeem on WhatsApp
                           </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid place-items-center rounded-3xl bg-slate-50 p-8 ring-1 ring-slate-200/50 shadow-inner italic">
                  <div className="relative">
                    <div className="absolute -top-4 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[14px] border-r-[14px] border-b-[20px] border-l-transparent border-r-transparent border-b-slate-900 z-10" />
                    <div
                      className="relative h-56 w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 rounded-full ring-[12px] ring-white shadow-2xl overflow-hidden border-4 border-slate-900"
                      style={{
                        ...wheelStyle,
                        transition: spinning ? "transform 5.0s cubic-bezier(0.15, 0.75, 0.15, 1)" : "none",
                      }}
                      onTransitionEnd={onWheelTransitionEnd}
                      aria-label="Spin wheel"
                    >
                      {spinRewards.map((r, i) => {
                        const n = spinRewards.length || 1;
                        const segmentAngle = 360 / n;
                        const rot = i * segmentAngle + segmentAngle / 2;
                        return (
                          <div
                            key={r.type + i}
                            className="absolute inset-0"
                            style={{ transform: `rotate(${rot}deg)` }}
                          >
                            <div className="absolute left-1/2 top-4 -translate-x-1/2 text-center text-[10px] font-black text-slate-900 leading-tight w-[5rem] px-0.5 pointer-events-none drop-shadow-sm uppercase tracking-tight">
                              {r.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="h-16 w-16 rounded-full bg-white shadow-2xl ring-4 ring-slate-900 flex items-center justify-center font-black text-[9px] text-slate-900 uppercase tracking-widest scale-110">
                        SPIN
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 w-full space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Rewards available</div>
                    <div className="grid gap-2 text-sm text-slate-700">
                      {spinRewards.slice(0, 4).map((r) => (
                        <div
                          key={r.type}
                          className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 ring-1 ring-slate-200 transition-all hover:scale-[1.02] shadow-sm"
                        >
                          <span className="text-xs font-bold text-slate-900">{r.title}</span>
                          <Sparkles className="h-3 w-3 text-emerald-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-blue-50 p-5 text-[11px] font-medium text-blue-700 leading-relaxed ring-1 ring-blue-100 flex gap-4">
                  <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex shrink-0 items-center justify-center font-black">!</div>
                  <p>Rewards are linked to your phone/email. You can close this and come back later; your progress is automatically saved for secure redemption.</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        </div>
      </div>
    </div>
  );
}
