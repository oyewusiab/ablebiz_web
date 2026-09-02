import { useState, useMemo } from "react";
import { Copy, Share2, Sparkles, Trophy, Users } from "lucide-react";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { 
  getOrCreateReferralClient, 
  getReferrerStats, 
  recordReferralConversion,
  recordRedemption,
  isTierRedeemed,
  type ReferralClient, 
  type ReferrerStats
} from "../referrals/core";
import { getSessionReferralCode } from "../referrals/useReferralUrl";
import { buildWhatsAppShareLink } from "../content/site";

export function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<"join" | "dashboard">("join");

  // Join form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [client, setClient] = useState<ReferralClient | null>(null);

  // Dashboard state
  const [dashCode, setDashCode] = useState("");
  const [stats, setStats] = useState<ReferrerStats | null>(null);
  const [dashError, setDashError] = useState("");

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    const newClient = getOrCreateReferralClient({ name, email, phone });
    setClient(newClient);

    // Record conversion if referred
    const refCode = getSessionReferralCode();
    if (refCode) {
      recordReferralConversion(refCode, { name, email, phone });
    }
  };

  const handleDashboard = (e: React.FormEvent) => {
    e.preventDefault();
    setDashError("");
    setStats(null);
    fetchStats();
  };

  const fetchStats = () => {
    if (!dashCode.trim()) return;

    const res = getReferrerStats(dashCode.trim());
    if (!res) {
      setDashError("Referral code not found. Please verify and try again.");
    } else {
      setStats(res);
    }
  };

  const copyLink = async () => {
    try {
      if (!referralLink) return;
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const referralLink = useMemo(() => {
    if (!client) return "";
    return `${window.location.origin}/?ref=${encodeURIComponent(client.referralCode)}`;
  }, [client]);

  const whatsappShareLink = useMemo(() => {
    if (!referralLink) return "";
    return buildWhatsAppShareLink(
      `Hey! I'm using ABLEBIZ to handle my CAC business registration.\n\nUse my link to get connected: ${referralLink}`
    );
  }, [referralLink]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Seo
        title="Refer & Earn Program | ABLEBIZ"
        description="Refer friends and colleagues to ABLEBIZ and earn free business consultations, discounts, and rewards."
        path="/refer-and-earn"
      />

      <PageHero
        title="Refer & Earn"
        subtitle="Invite friends who need business registration. Track your progress here and unlock free services."
        badge="🤝 ABLEBIZ Partner Program"
      />

      <section>
        <Container className="py-14 max-w-6xl">
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
              <button
                className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === "join"
                    ? "bg-white text-[color:var(--ablebiz-primary)] shadow-sm ring-1 ring-blue-200 dark:bg-slate-800 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
                onClick={() => setActiveTab("join")}
              >
                Join & Get Link
              </button>
              <button
                className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === "dashboard"
                    ? "bg-white text-[color:var(--ablebiz-primary)] shadow-sm ring-1 ring-blue-200 dark:bg-slate-800 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
                onClick={() => setActiveTab("dashboard")}
              >
                My Dashboard
              </button>
            </div>
          </div>

          {activeTab === "join" && (
            <Card className="mx-auto max-w-2xl bg-white shadow-md dark:bg-slate-800">
              <CardBody className="p-8">
                {!client ? (
                  <form onSubmit={handleJoin} className="grid gap-5">
                    <div className="text-center mb-4">
                      <div className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                        Generate Your Unique Link
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Enter your details so we can assign rewards to your profile.
                      </p>
                    </div>

                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Full Name
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 rounded-xl bg-white px-4 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                        placeholder="John Doe"
                        required
                      />
                    </label>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Email Address
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 rounded-xl bg-white px-4 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                          placeholder="hello@example.com"
                          required
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Phone (WhatsApp)
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="h-12 rounded-xl bg-white px-4 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                          placeholder="08123456789"
                          required
                        />
                      </label>
                    </div>
                    <Button
                      type="submit"
                      className="h-12 mt-2 w-full justify-center bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md"
                    >
                      Generate Referral Link
                    </Button>
                  </form>
                ) : (
                  <div className="grid gap-6">
                    <div className="text-center">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-500/20 mb-4">
                        <Sparkles className="h-8 w-8 text-amber-600" />
                      </div>
                      <div className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                        You're all set, {client.name.split(" ")[0]}!
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Share this link with friends. Make sure they use it when they chat with us!
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200 text-center dark:bg-slate-900 dark:ring-slate-700">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Your Referral Code
                      </div>
                      <div className="mt-2 text-3xl font-black text-[color:var(--ablebiz-primary)] tracking-wider dark:text-amber-400">
                        {client.referralCode}
                      </div>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            if (!client) return;
                            navigator.clipboard.writeText(client.referralCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                        >
                          <Copy className="h-4 w-4" /> {copied ? "Code Copied!" : "Copy Code"}
                        </button>
                        <button
                          onClick={copyLink}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all dark:bg-slate-700"
                        >
                          <Copy className="h-4 w-4" /> {copiedLink ? "Link Copied!" : "Copy Link"}
                        </button>
                        <a
                          href={whatsappShareLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm hover:from-amber-600 hover:to-amber-700"
                        >
                          <Share2 className="h-4 w-4" /> Share WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {activeTab === "dashboard" && (
            <div className="grid gap-8">
              <Card className="mx-auto max-w-xl bg-white shadow-md dark:bg-slate-800">
                <CardBody className="p-8">
                  <form onSubmit={handleDashboard} className="grid gap-5">
                    <div className="text-center mb-4">
                      <div className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                        My Referral Dashboard
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Enter your active referral code to see your progress and unlocked rewards.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={dashCode}
                        onChange={(e) => setDashCode(e.target.value.toUpperCase())}
                        className="h-12 flex-1 rounded-xl bg-white px-4 text-sm font-bold tracking-wider ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:font-normal placeholder:tracking-normal dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                        placeholder="e.g. REF-ABC1234"
                        required
                      />
                      <Button
                        type="submit"
                        className="h-12 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0"
                      >
                        Check
                      </Button>
                    </div>
                    {dashError && <div className="text-sm font-semibold text-red-600">{dashError}</div>}
                  </form>
                </CardBody>
              </Card>

              {stats && (
                <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,1.5fr)]">
                  <Card>
                    <CardBody className="p-6 h-full flex flex-col justify-center items-center text-center">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[color:var(--ablebiz-primary)] mb-4 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-300">
                        <Users className="h-8 w-8 text-[color:var(--ablebiz-cta)]" />
                      </div>
                      <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                        Total Successful Referrals
                      </div>
                      <div className="mt-2 text-6xl font-black text-slate-900 dark:text-white">
                        {stats.totalReferrals}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="p-6 h-full">
                      <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300 flex items-center gap-2 mb-6">
                        <Trophy className="h-5 w-5 text-amber-500" /> Reward Status
                      </div>

                      <div className="space-y-6">
                        {stats.currentTier ? (
                          <div className="rounded-2xl bg-amber-50/80 p-5 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Unlocked
                              </div>
                              {isTierRedeemed(stats.client.referralCode, stats.currentTier.referralsRequired) ? (
                                <div className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full ring-1 ring-amber-300">
                                  Claimed
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (stats.currentTier) {
                                      recordRedemption(stats.client.referralCode, stats.currentTier);
                                      setStats(getReferrerStats(stats.client.referralCode));
                                    }
                                  }}
                                  className="text-[10px] font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-3 py-1 rounded-full shadow-xs hover:from-amber-600 hover:to-amber-700 active:scale-95 transition-all"
                                >
                                  Claim Reward
                                </button>
                              )}
                            </div>
                            <div className="text-lg font-black text-slate-900 dark:text-white">
                              {stats.currentTier.title}
                            </div>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                              {stats.currentTier.note}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 text-slate-500 text-sm font-medium dark:bg-slate-900 dark:ring-slate-700">
                            No rewards unlocked yet. Keep referring!
                          </div>
                        )}

                        {stats.nextTier && (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-5">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                              Next Reward at {stats.nextTier.referralsRequired} Referrals
                            </div>
                            <div className="text-base font-bold text-slate-700">
                              {stats.nextTier.title}
                            </div>
                            <div className="mt-3 overflow-hidden rounded-full bg-slate-200 h-2">
                              <div
                                className="bg-[color:var(--ablebiz-primary)] h-full rounded-full transition-all duration-1000"
                                style={{
                                  width: `${Math.min(100, (stats.totalReferrals / stats.nextTier.referralsRequired) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="mt-2 text-right text-xs font-bold text-slate-500">
                              {stats.totalReferrals} / {stats.nextTier.referralsRequired}
                            </div>
                          </div>
                        )}
                        {!stats.nextTier && stats.currentTier && (
                          <div className="rounded-2xl bg-blue-50 p-5 ring-1 ring-blue-100 text-blue-800 text-sm font-semibold">
                            You've unlocked the highest tier!
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
