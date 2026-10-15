import { useState, useMemo, useEffect } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Gift,
  HelpCircle,
  History,
  Info,
  Loader2,
  MessageSquare,
  Search,
  Share2,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  rpcCreateReferralPartner,
  rpcSubmitReferral,
  rpcRecoverReferralCode,
  rpcGetReferralStats,
  type ReferralStatsRpcResult,
  type SubmitReferralResult,
} from "../lib/supabaseApi";
import { getSessionReferralCode } from "../referrals/useReferralUrl";
import { buildWhatsAppLink, buildWhatsAppShareLink } from "../content/site";

type PartnerClient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  isExisting?: boolean;
};

export function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<"join" | "refer" | "dashboard">("join");

  // Join form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [client, setClient] = useState<PartnerClient | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Code Recovery State
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Refer Someone form state
  const [refPartnerCode, setRefPartnerCode] = useState("");
  const [refereeName, setRefereeName] = useState("");
  const [refereePhone, setRefereePhone] = useState("");
  const [refereeEmail, setRefereeEmail] = useState("");
  const [serviceInterest, setServiceInterest] = useState("Business Name Registration");
  const [refereeNotes, setRefereeNotes] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);
  const [referralError, setReferralError] = useState("");
  const [referralSuccess, setReferralSuccess] = useState<SubmitReferralResult | null>(null);

  // Dashboard state
  const [dashCode, setDashCode] = useState("");
  const [stats, setStats] = useState<ReferralStatsRpcResult | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState("");

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-sync code across tabs if partner is registered
  useEffect(() => {
    if (client?.referralCode) {
      setRefPartnerCode(client.referralCode);
      setDashCode(client.referralCode);
    }
  }, [client]);

  // Tab 1: Handle Partner Registration
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setIsJoining(true);
    setJoinError("");

    try {
      const res = await rpcCreateReferralPartner({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        referredBy: getSessionReferralCode() || undefined,
        pagePath: window.location.pathname,
      });

      const partnerData: PartnerClient = {
        id: res.lead_id,
        name: res.display_name,
        email: email.trim(),
        phone: phone.trim(),
        referralCode: res.referral_code,
        isExisting: res.is_existing,
      };

      setClient(partnerData);
      setRefPartnerCode(res.referral_code);
      setDashCode(res.referral_code);
    } catch (err: any) {
      console.error("[Referrals] Failed to join:", err);
      setJoinError(err?.message || "Could not register referral profile. Please verify your details.");
    } finally {
      setIsJoining(false);
    }
  };

  // Recover Code by Phone/Email
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryInput.trim()) return;
    setIsRecovering(true);
    setRecoveryMsg(null);

    try {
      const res = await rpcRecoverReferralCode(recoveryInput.trim());
      if (res.found && res.referral_code) {
        setRecoveryMsg({
          ok: true,
          text: `Found your code: ${res.referral_code} (${res.display_name || "Partner"}).`,
        });
        setRefPartnerCode(res.referral_code);
        setDashCode(res.referral_code);
        setClient({
          id: "",
          name: res.display_name || "Partner",
          email: "",
          phone: "",
          referralCode: res.referral_code,
        });
      } else {
        setRecoveryMsg({
          ok: false,
          text: "No referral profile found with this phone number or email address.",
        });
      }
    } catch (err: any) {
      setRecoveryMsg({ ok: false, text: err?.message || "Recovery check failed." });
    } finally {
      setIsRecovering(false);
    }
  };

  // Tab 2: Handle Direct Referral Submission
  const handleSubmitReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refPartnerCode.trim()) {
      setReferralError("Please provide your Referral Code to receive attribution.");
      return;
    }
    if (!refereeName.trim() || !refereePhone.trim()) {
      setReferralError("Referred person's full name and WhatsApp phone number are required.");
      return;
    }
    if (!consentGiven) {
      setReferralError("Please confirm consent before submitting referral details.");
      return;
    }

    setIsSubmittingReferral(true);
    setReferralError("");
    setReferralSuccess(null);

    try {
      const res = await rpcSubmitReferral({
        referrerCode: refPartnerCode.trim(),
        refereeName: refereeName.trim(),
        refereePhone: refereePhone.trim(),
        refereeEmail: refereeEmail.trim() || undefined,
        serviceInterest,
        notes: refereeNotes.trim() || undefined,
      });

      if (res.success) {
        setReferralSuccess(res);
      } else {
        setReferralError(res.message || "Failed to submit referral.");
      }
    } catch (err: any) {
      console.error("[Referrals] Submit error:", err);
      if (err?.message?.includes("invalid_referral_code")) {
        setReferralError("Invalid referral code. Please check your code or register on the first tab.");
      } else if (err?.message?.includes("self_referral_not_allowed")) {
        setReferralError("Self-referral is not permitted. Please refer another prospective business owner.");
      } else {
        setReferralError(err?.message || "Failed to submit referral. Please try again.");
      }
    } finally {
      setIsSubmittingReferral(false);
    }
  };

  // Tab 3: Handle Dashboard Load
  const handleDashboard = async (e?: React.FormEvent, codeToUse?: string) => {
    if (e) e.preventDefault();
    const code = (codeToUse || dashCode).trim().toUpperCase();
    if (!code) return;

    setDashError("");
    setDashLoading(true);
    setStats(null);

    try {
      const res = await rpcGetReferralStats(code);
      if (!res) {
        setDashError("Referral code not found. Please verify your code or register as a partner.");
      } else {
        setStats(res);
      }
    } catch (err: any) {
      setDashError(err?.message || "Failed to load referral statistics.");
    } finally {
      setDashLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const currentCode = client?.referralCode || refPartnerCode || dashCode;
  const referralLink = useMemo(() => {
    if (!currentCode) return "";
    return `${window.location.origin}/?ref=${encodeURIComponent(currentCode)}`;
  }, [currentCode]);

  const whatsappShareLink = useMemo(() => {
    if (!referralLink) return "";
    return buildWhatsAppShareLink(
      `Hello! I'm using ABLEBIZ to handle business registration, CAC filings, and corporate compliance in Nigeria.\n\nConnect with them using my referral link: ${referralLink}`
    );
  }, [referralLink]);

  // WhatsApp click-to-chat notification link for the referee submission
  const whatsappNotifyLink = useMemo(() => {
    if (!referralSuccess) return "";
    const msg = `Hello ABLEBIZ, I just submitted a referral on your website:\n\n• Name: ${refereeName}\n• Phone: ${refereePhone}\n• Service: ${serviceInterest}\n• My Referral Code: ${refPartnerCode.toUpperCase()}`;
    return buildWhatsAppLink(msg);
  }, [referralSuccess, refereeName, refereePhone, serviceInterest, refPartnerCode]);

  // Prepared message to share directly with the referee
  const whatsappRefereeIntroLink = useMemo(() => {
    if (!referralSuccess) return "";
    const msg = `Hello ${refereeName}! I've connected you with ABLEBIZ Business Services for your ${serviceInterest}. Their expert team will guide you through the process.\n\nYou can also check them out here: ${referralLink || "https://www.ablebiz.com.ng"}`;
    return buildWhatsAppShareLink(msg);
  }, [referralSuccess, refereeName, serviceInterest, referralLink]);

  const handleClaimReward = () => {
    if (!stats?.current_tier) return;
    const text = `Hello ABLEBIZ, I want to claim my referral reward for reaching ${stats.current_tier.title} (${stats.current_tier.note}). My referral code is ${stats.referral_code}.`;
    const waLink = buildWhatsAppLink(text);
    window.open(waLink, "_blank");
  };

  return (
    <>
      <Seo
        title="Refer & Earn Program | ABLEBIZ"
        description="Refer friends, clients, and colleagues to ABLEBIZ. Earn free business consultations, filing discounts, and cash rewards."
        path="/refer-and-earn"
      />

      <PageHero
        title="Refer & Earn"
        subtitle="Recommend ABLEBIZ to entrepreneurs who need CAC registration and business compliance. Unlock discounts and rewards."
        badge="🤝 ABLEBIZ Partner Program"
      />

      <section>
        <Container className="py-12 max-w-5xl">
          {/* Program Highlights Banner */}
          <div className="mb-10 rounded-3xl bg-blue-50/70 p-6 sm:p-7 ring-1 ring-blue-200/80 dark:bg-blue-950/40 dark:ring-blue-900">
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-700 shrink-0">
                <Gift className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#0A2558] dark:text-blue-300">
                  How ABLEBIZ Refer & Earn Works
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  Earn points and redeem exclusive statutory filing discounts every time a contact you recommend uses ABLEBIZ.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 shadow-xs">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Step 1</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">Get Your Unique Code</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Register once with your WhatsApp phone number to receive your code and link.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 shadow-xs">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Step 2</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">Share or Submit a Referral</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Share your link or submit their details directly using the Refer Someone tab.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 shadow-xs">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Step 3</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">Unlock Rewards</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Earn 50 points per referral. Unlock discounts and free consultations.</p>
              </div>
            </div>
          </div>

          {/* 3 Main Action Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <button
                className={`flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === "join"
                    ? "bg-white text-[#0A2558] shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
                onClick={() => setActiveTab("join")}
              >
                <UserPlus className="h-4 w-4" />
                <span>1. Join & Get Link</span>
              </button>

              <button
                className={`flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === "refer"
                    ? "bg-white text-[#0A2558] shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
                onClick={() => setActiveTab("refer")}
              >
                <Users className="h-4 w-4" />
                <span>2. Refer Someone</span>
              </button>

              <button
                className={`flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === "dashboard"
                    ? "bg-white text-[#0A2558] shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
                onClick={() => {
                  setActiveTab("dashboard");
                  if (currentCode) {
                    handleDashboard(undefined, currentCode);
                  }
                }}
              >
                <Trophy className="h-4 w-4" />
                <span>3. My Dashboard</span>
              </button>
            </div>
          </div>

          {/* TAB 1: JOIN & GET LINK */}
          {activeTab === "join" && (
            <Card className="mx-auto max-w-2xl bg-white shadow-md dark:bg-slate-800">
              <CardBody className="p-6 sm:p-8">
                {!client ? (
                  <div>
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-extrabold text-[#0A2558] dark:text-blue-300">
                        Become an ABLEBIZ Referral Partner
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        Enter your contact details to generate or retrieve your unique referral link.
                      </p>
                    </div>

                    <form onSubmit={handleJoin} className="grid gap-4">
                      <label className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                        Full Name *
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-11 rounded-xl bg-white px-3.5 text-xs font-medium ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                          placeholder="e.g. Bisi Adeleke"
                          required
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                          Email Address *
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-11 rounded-xl bg-white px-3.5 text-xs font-medium ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                            placeholder="bisi@example.com"
                            required
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                          WhatsApp Phone Number *
                          <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="h-11 rounded-xl bg-white px-3.5 text-xs font-medium ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                            placeholder="08012345678"
                            required
                          />
                        </label>
                      </div>

                      {joinError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                          {joinError}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={isJoining}
                        className="h-12 mt-2 w-full justify-center bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md disabled:opacity-50"
                      >
                        {isJoining ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Referral Link...
                          </>
                        ) : (
                          "Generate Referral Link"
                        )}
                      </Button>
                    </form>

                    {/* Secondary Recovery Toggle */}
                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                      <button
                        type="button"
                        onClick={() => setShowRecovery(!showRecovery)}
                        className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {showRecovery ? "Hide recovery" : "Already registered? Recover your code via phone or email →"}
                      </button>

                      {showRecovery && (
                        <form onSubmit={handleRecover} className="mt-3 flex gap-2 max-w-md mx-auto">
                          <input
                            value={recoveryInput}
                            onChange={(e) => setRecoveryInput(e.target.value)}
                            placeholder="Enter phone (080...) or email"
                            className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-amber-500"
                            required
                          />
                          <Button
                            type="submit"
                            disabled={isRecovering}
                            className="h-10 px-4 bg-slate-900 text-white text-xs font-bold"
                          >
                            {isRecovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Lookup"}
                          </Button>
                        </form>
                      )}

                      {recoveryMsg && (
                        <p className={`mt-2 text-xs font-semibold ${recoveryMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
                          {recoveryMsg.text}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Active Partner Card */
                  <div className="space-y-6">
                    {client.isExisting && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-semibold text-blue-800">
                        Welcome back! We retrieved your existing referral code and link.
                      </div>
                    )}

                    <div className="text-center">
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 ring-4 ring-amber-500/20 mb-3">
                        <Sparkles className="h-7 w-7 text-amber-600" />
                      </div>
                      <h3 className="text-2xl font-black text-[#0A2558] dark:text-blue-300">
                        You're Ready to Earn, {client.name.split(" ")[0]}!
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Share your unique code or link with entrepreneurs who need business registration.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200 text-center dark:bg-slate-900 dark:ring-slate-700">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Your Unique Referral Code
                      </span>
                      <div className="mt-1 text-3xl font-black tracking-wider text-[#0A2558] dark:text-amber-400">
                        {client.referralCode}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={() => copyCode(client.referralCode)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 shadow-xs dark:bg-slate-800 dark:text-slate-200"
                        >
                          {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedCode ? "Code Copied!" : "Copy Code"}
                        </button>

                        <button
                          onClick={() => copyLink(referralLink)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-xs transition"
                        >
                          {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedLink ? "Link Copied!" : "Copy Link"}
                        </button>

                        <a
                          href={whatsappShareLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xs hover:from-amber-600 hover:to-amber-700"
                        >
                          <Share2 className="h-3.5 w-3.5" /> Share WhatsApp
                        </a>
                      </div>
                    </div>

                    {/* Quick CTA to Tab 2 or 3 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActiveTab("refer")}
                        className="flex-1 rounded-xl bg-[#0A2558] py-3 text-center text-xs font-bold text-white hover:bg-[#061738] transition shadow-xs"
                      >
                        Refer a Contact Now →
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("dashboard");
                          handleDashboard(undefined, client.referralCode);
                        }}
                        className="flex-1 rounded-xl border border-slate-200 py-3 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        View My Dashboard
                      </button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* TAB 2: REFER SOMEONE */}
          {activeTab === "refer" && (
            <Card className="mx-auto max-w-2xl bg-white shadow-md dark:bg-slate-800">
              <CardBody className="p-6 sm:p-8">
                {!referralSuccess ? (
                  <div>
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-extrabold text-[#0A2558] dark:text-blue-300">
                        Refer a Client to ABLEBIZ
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        Submit details of someone who needs business registration. We will follow up professionally and attribute the referral to you.
                      </p>
                    </div>

                    <form onSubmit={handleSubmitReferral} className="grid gap-4">
                      {/* Referrer Code Verification */}
                      <label className="grid gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                        Your Referral Code *
                        <input
                          value={refPartnerCode}
                          onChange={(e) => setRefPartnerCode(e.target.value.toUpperCase())}
                          className="h-11 rounded-xl bg-slate-50 px-3.5 font-mono text-xs font-bold tracking-wider ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                          placeholder="e.g. ABZ-819203"
                          required
                        />
                        <span className="text-[10px] text-slate-400 font-normal">
                          Need a code? Register in Tab 1 or click "Already registered" to recover yours.
                        </span>
                      </label>

                      {/* Referee particulars */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                          Referred Person's Full Name *
                          <input
                            value={refereeName}
                            onChange={(e) => setRefereeName(e.target.value)}
                            className="h-11 rounded-xl bg-white px-3.5 text-xs font-medium ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                            placeholder="e.g. Tunde Johnson"
                            required
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                          Referred Person's WhatsApp Phone *
                          <input
                            value={refereePhone}
                            onChange={(e) => setRefereePhone(e.target.value)}
                            className="h-11 rounded-xl bg-white px-3.5 text-xs font-medium ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                            placeholder="08023456789"
                            required
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                          Email Address (Optional)
                          <input
                            type="email"
                            value={refereeEmail}
                            onChange={(e) => setRefereeEmail(e.target.value)}
                            className="h-11 rounded-xl bg-white px-3.5 text-xs font-medium ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                            placeholder="tunde@gmail.com"
                          />
                        </label>

                        <label className="grid gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                          Service of Interest
                          <select
                            value={serviceInterest}
                            onChange={(e) => setServiceInterest(e.target.value)}
                            className="h-11 rounded-xl bg-white px-3 text-xs font-medium ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                          >
                            <option value="Business Name Registration">Business Name Registration (Sole Prop / Partnership)</option>
                            <option value="Company Incorporation (LTD)">Private Limited Company (LTD Incorporation)</option>
                            <option value="NGO / Incorporated Trustees">NGO, Church, Association or Club (Trustees)</option>
                            <option value="Annual Returns & CAC Compliance">Annual Returns & Filing Regularization</option>
                            <option value="SCUML & Tax Clearance Certificate">SCUML & Tax Clearance Certificate (TCC)</option>
                            <option value="Trademark, Patent & Copyright">Trademark & Intellectual Property</option>
                            <option value="General Business Advisory">General Compliance Consultation</option>
                          </select>
                        </label>
                      </div>

                      <label className="grid gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                        Optional Message or Context for Staff
                        <textarea
                          rows={2}
                          value={refereeNotes}
                          onChange={(e) => setRefereeNotes(e.target.value)}
                          placeholder="e.g. He wants to register an agro-processing company before month-end."
                          className="rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-amber-500 dark:bg-slate-900 dark:border-slate-700"
                        />
                      </label>

                      {/* Consent & Privacy Notice */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:bg-slate-900/60 dark:border-slate-700 dark:text-slate-300">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={consentGiven}
                            onChange={(e) => setConsentGiven(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded text-[#0A2558] focus:ring-amber-500"
                          />
                          <span>
                            I confirm that I have informed <strong>{refereeName || "this contact"}</strong> and have their permission to share their contact details with ABLEBIZ Business Services for business registration consultation.
                          </span>
                        </label>
                      </div>

                      {referralError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                          {referralError}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={isSubmittingReferral}
                        className="h-12 mt-2 w-full justify-center bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md disabled:opacity-50"
                      >
                        {isSubmittingReferral ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Recording Referral...
                          </>
                        ) : (
                          "Submit Referral to ABLEBIZ"
                        )}
                      </Button>
                    </form>
                  </div>
                ) : (
                  /* Referral Submitted Confirmation & Honest WhatsApp Action */
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 ring-4 ring-emerald-100/50 mb-3">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                      <h3 className="text-2xl font-black text-[#0A2558] dark:text-blue-300">
                        Referral Recorded Successfully!
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {referralSuccess.message}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2 dark:bg-slate-900 dark:border-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Referred Contact:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{refereeName} ({refereePhone})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Service:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{serviceInterest}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Attributed to Partner:</span>
                        <span className="font-mono font-bold text-amber-600">{refPartnerCode.toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Prepared WhatsApp Options */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 space-y-3 dark:bg-amber-950/30 dark:border-amber-900">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                        <MessageSquare className="h-4 w-4 text-amber-600" />
                        <span>Optional WhatsApp Actions (Prepared Links)</span>
                      </div>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                        The referral is already persisted in our database. You can additionally open WhatsApp with a pre-formatted message to notify ABLEBIZ directly or introduce us to {refereeName.split(" ")[0]}.
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2 pt-1">
                        <a
                          href={whatsappNotifyLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0A2558] py-2.5 px-3 text-xs font-bold text-white shadow-xs hover:bg-[#061738]"
                        >
                          <Share2 className="h-3.5 w-3.5" /> Notify ABLEBIZ on WhatsApp
                        </a>

                        <a
                          href={whatsappRefereeIntroLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 px-3 text-xs font-bold text-slate-950 shadow-xs hover:from-amber-600 hover:to-amber-700"
                        >
                          <Share2 className="h-3.5 w-3.5" /> Introduce {refereeName.split(" ")[0]} via WhatsApp
                        </a>
                      </div>
                      <p className="text-[10px] text-slate-400 italic text-center">
                        Note: Clicking opens WhatsApp with a pre-filled draft. Please tap send in WhatsApp to deliver the message.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setReferralSuccess(null);
                          setRefereeName("");
                          setRefereePhone("");
                          setRefereeEmail("");
                          setRefereeNotes("");
                          setConsentGiven(false);
                        }}
                        className="flex-1 rounded-xl bg-slate-900 py-2.5 text-center text-xs font-bold text-white hover:bg-slate-800"
                      >
                        Submit Another Referral
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab("dashboard");
                          handleDashboard(undefined, refPartnerCode);
                        }}
                        className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        View My Dashboard
                      </button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* TAB 3: MY DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Lookup Card */}
              <Card className="mx-auto max-w-xl bg-white shadow-md dark:bg-slate-800">
                <CardBody className="p-6 sm:p-7">
                  <form onSubmit={handleDashboard} className="grid gap-3">
                    <div className="text-center mb-2">
                      <h3 className="text-xl font-extrabold text-[#0A2558] dark:text-blue-300">
                        My Referral Dashboard
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Enter your active referral code to see your referrals, points, and unlocked rewards.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={dashCode}
                        onChange={(e) => setDashCode(e.target.value.toUpperCase())}
                        className="h-11 flex-1 rounded-xl bg-white px-3.5 font-mono text-xs font-bold tracking-wider ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:font-normal placeholder:tracking-normal dark:bg-slate-900 dark:ring-slate-700 dark:text-white"
                        placeholder="e.g. ABZ-749201"
                        required
                      />
                      <Button
                        type="submit"
                        disabled={dashLoading}
                        className="h-11 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 disabled:opacity-50"
                      >
                        {dashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                      </Button>
                    </div>

                    {dashError && <div className="text-xs font-semibold text-red-600">{dashError}</div>}
                  </form>
                </CardBody>
              </Card>

              {/* Stats & History Display */}
              {stats && (
                <div className="space-y-6">
                  {/* KPI Summary Cards */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:bg-slate-800 dark:border-slate-700 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Partner Profile
                      </span>
                      <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{stats.display_name}</p>
                      <p className="font-mono text-xs font-bold text-amber-600">{stats.referral_code}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:bg-slate-800 dark:border-slate-700 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Total Referrals
                      </span>
                      <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{stats.total_referrals}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {stats.conversions_count || 0} Converted to Clients
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:bg-slate-800 dark:border-slate-700 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Total Points
                      </span>
                      <p className="mt-1 text-3xl font-black text-amber-600">{stats.total_points}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">50 points awarded per referral</p>
                    </div>
                  </div>

                  {/* Shareable Link Bar */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:bg-slate-800 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Shareable Link</span>
                      <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-md">
                        {referralLink}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyLink(referralLink)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy className="h-3.5 w-3.5" /> {copiedLink ? "Copied" : "Copy Link"}
                      </button>
                      <a
                        href={whatsappShareLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-xs"
                      >
                        <Share2 className="h-3.5 w-3.5" /> Share WhatsApp
                      </a>
                    </div>
                  </div>

                  {/* Rewards Status Section */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Unlocked Reward */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:bg-slate-800 dark:border-slate-700">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-3 text-sm">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span>Current Reward Status</span>
                      </div>

                      {stats.current_tier ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:bg-amber-950/40 dark:border-amber-900">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                              Unlocked
                            </span>
                            <button
                              onClick={handleClaimReward}
                              className="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-[11px] font-bold text-slate-950 hover:from-amber-600 hover:to-amber-700"
                            >
                              Claim on WhatsApp
                            </button>
                          </div>
                          <p className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">
                            {stats.current_tier.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {stats.current_tier.note}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                          No reward tier unlocked yet. Reach 3 referrals to unlock your first filing discount!
                        </div>
                      )}
                    </div>

                    {/* Next Reward Progress */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:bg-slate-800 dark:border-slate-700">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-3 text-sm">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        <span>Next Milestone</span>
                      </div>

                      {stats.next_tier ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:bg-slate-900/40 dark:border-slate-700">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-600 dark:text-slate-300">{stats.next_tier.title}</span>
                            <span className="text-slate-400">{stats.total_referrals} / {stats.next_tier.referrals_required} Referrals</span>
                          </div>

                          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-[#0A2558] transition-all duration-700 dark:bg-blue-400"
                              style={{
                                width: `${Math.min(100, (stats.total_referrals / stats.next_tier.referrals_required) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                            {stats.next_tier.note || `Refer ${stats.next_tier.referrals_required - stats.total_referrals} more contact(s) to unlock.`}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
                          You have achieved the highest partner tier! Thank you for being a valued ABLEBIZ ambassador.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Referral History Table (Privacy-Preserved) */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                        <History className="h-4 w-4 text-slate-400" />
                        <span>Referral History ({stats.recent_referrals?.length || 0})</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Names masked for client confidentiality
                      </span>
                    </div>

                    {!stats.recent_referrals || stats.recent_referrals.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        No referrals recorded yet under this code. Use Tab 2 to submit your first referral!
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Referred Contact</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {stats.recent_referrals.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                                <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{item.created_at}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.display_name}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                                    item.is_converted || item.status === "converted"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  }`}>
                                    {item.is_converted ? "Converted to Client" : item.status.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-amber-600">+{item.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
