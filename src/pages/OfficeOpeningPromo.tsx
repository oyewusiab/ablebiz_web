import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Tag,
  Trophy,
  Users,
} from "lucide-react";
import { Seo } from "../components/Seo";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { ButtonLink } from "../components/ui/Button";
import { ConsultationForm } from "../components/ConsultationForm";
import { useGamification } from "../gamification/GamificationProvider";
import { buildWhatsAppLink } from "../content/site";
import {
  calculateReferralMilestoneReward,
  formatLagosDateTime,
} from "../lib/campaignEngine";

function formatNaira(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
}

export function OfficeOpeningPromoPage() {
  const { campaignBundle } = useGamification();
  const { campaign, services, milestones } = campaignBundle;

  const eligibleServices = services.filter((s) => s.is_eligible);
  const effectiveStatus = campaign.effective_status;
  const isCompleted = effectiveStatus === "completed" || effectiveStatus === "archived";
  const isPaused = effectiveStatus === "paused";
  const isScheduled = effectiveStatus === "scheduled";
  const isActive = effectiveStatus === "active";

  const [selectedServiceForForm, setSelectedServiceForForm] = useState<string | undefined>(
    undefined
  );
  const [simulatedReferrals, setSimulatedReferrals] = useState<number>(3);
  const milestoneSim = calculateReferralMilestoneReward(simulatedReferrals);

  const generalWhatsAppLink = buildWhatsAppLink(
    "Hello ABLEBIZ! I want to take advantage of the Office Opening Special Promo (Up to 30% Off selected services / Referral Rewards up to ₦35,000). Please share the next steps."
  );

  return (
    <>
      <Seo
        title="ABLEBIZ Office Opening Special Promo & Referral Rewards | Up to 30% Off"
        description="Celebrate the opening of the ABLEBIZ physical office in Abeokuta, Ogun State! Enjoy up to 30% OFF selected professional service fees and earn up to ₦35,000 in cumulative referral rewards from November 5 – November 20, 2026."
        path="/office-opening-promo"
        keywords={[
          "ABLEBIZ Office Opening Promo",
          "CAC registration discount Nigeria",
          "business registration promo Abeokuta",
          "refer and earn Nigeria",
          "company registration discount CAC",
          "SCUML registration promo",
        ]}
      />

      {/* 1. CAMPAIGN HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0A2558] via-[#0e3170] to-[#081b42] text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-400/15 blur-3xl" />

        <Container className="relative py-16 sm:py-20 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" /> Official Campaign
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-blue-100 ring-1 ring-white/20">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" /> {campaign.location}
                </span>
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/40">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live Now
                  </span>
                )}
                {isScheduled && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-blue-400/40">
                    <Clock className="h-3.5 w-3.5 text-amber-300" /> Starts November 5, 2026 (WAT)
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-200 ring-1 ring-rose-400/40">
                    Campaign Ended (Nov 20, 2026)
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-amber-400">
                  ABLEBIZ OFFICE OPENING SPECIAL
                </p>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
                  {campaign.promo_headline}
                </h1>
                <p className="text-xl sm:text-2xl font-extrabold text-amber-300 pt-1">
                  REFER & {campaign.referral_headline}
                </p>
              </div>

              <p className="text-base sm:text-lg text-blue-100/95 max-w-2xl leading-relaxed">
                To celebrate the opening of our physical office in{" "}
                <strong className="text-white">Abeokuta, Ogun State</strong>, enjoy exclusive
                discounts on ABLEBIZ professional service fees for selected business registration,
                compliance, and annual filing services — plus cumulative milestone cash rewards when
                you refer new clients!
              </p>

              {/* 2. CAMPAIGN DATES BAR */}
              <div className="rounded-2xl bg-white/10 p-4 sm:p-5 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                        Campaign Period
                      </div>
                      <div className="text-sm font-extrabold text-white">
                        Nov 5 – Nov 20, 2026
                      </div>
                      <div className="text-xs text-blue-200">16 Calendar Days (Inclusive)</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                        Official Timezone
                      </div>
                      <div className="text-sm font-extrabold text-white">
                        Africa/Lagos (WAT)
                      </div>
                      <div className="text-xs text-blue-200">Server-Verified Cutoff</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                        Tagline
                      </div>
                      <div className="text-sm font-extrabold text-amber-300">
                        {campaign.tagline}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isCompleted || isPaused ? (
                <div className="rounded-2xl bg-amber-500/20 border border-amber-400/40 p-4 text-sm text-amber-100">
                  <strong className="font-bold text-white">Notice:</strong>{" "}
                  {isCompleted
                    ? "The Office Opening Special Promo concluded on November 20, 2026. Standard service fees now apply. Existing campaign referrals are currently undergoing post-campaign verification and payout."
                    : "This campaign is temporarily paused by management."}
                </div>
              ) : null}

              {/* 8, 9, 10. HERO CTAs */}
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href="#eligible-services"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 px-6 py-3.5 text-sm font-black text-slate-950 no-underline shadow-lg transition"
                >
                  <Tag className="h-4 w-4" /> Explore Promotional Services
                </a>
                <ButtonLink
                  to={generalWhatsAppLink}
                  external
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold border-0 px-6 py-3.5 shadow-lg"
                >
                  <MessageCircle className="h-4 w-4" /> Get Started on WhatsApp
                </ButtonLink>
                <ButtonLink
                  to="/refer-and-earn"
                  variant="secondary"
                  className="bg-white/10 text-white border-white/25 hover:bg-white/20 px-5 py-3.5 font-bold"
                >
                  <Users className="h-4 w-4 text-amber-400" /> Join Referral Programme
                </ButtonLink>
                <a
                  href="#campaign-terms"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-transparent px-4 py-3.5 text-xs font-bold text-blue-200 hover:text-white no-underline transition"
                >
                  <FileText className="h-4 w-4" /> View Campaign Terms
                </a>
              </div>
            </div>

            {/* Hero Highlight Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-white text-slate-900 p-6 sm:p-8 shadow-2xl ring-4 ring-amber-400/40">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                      Promo Snapshot
                    </span>
                    <h2 className="text-xl font-black text-[color:var(--ablebiz-primary)]">
                      Approved Promo Highlights
                    </h2>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
                    <Trophy className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {eligibleServices.slice(0, 4).map((srv) => (
                    <div
                      key={srv.service_code}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-200/70"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">{srv.service_name}</div>
                        <div className="text-xs text-slate-500">
                          Regular Professional Fee:{" "}
                          <span className="line-through">
                            {formatNaira(srv.regular_professional_fee)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                          {srv.discount_percentage}% OFF
                        </span>
                        <div className="text-base font-black text-[color:var(--ablebiz-primary)]">
                          {formatNaira(srv.promo_professional_fee)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-gradient-to-r from-[#0A2558] to-blue-900 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      Referral Rewards
                    </span>
                    <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-slate-950">
                      Cumulative Milestones
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {milestones.map((m) => (
                      <div
                        key={m.referrals_required}
                        className="rounded-xl bg-white/10 p-2 ring-1 ring-white/15"
                      >
                        <div className="text-[11px] font-bold text-blue-200">
                          {m.referrals_required} {m.referrals_required === 1 ? "Ref" : "Refs"}
                        </div>
                        <div className="text-xs sm:text-sm font-black text-amber-300">
                          {formatNaira(m.total_reward_ngn)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
                  * Discounts apply strictly to ABLEBIZ professional service fees only. CAC,
                  statutory, government, and third-party charges are excluded unless expressly
                  stated otherwise.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 3. ELIGIBLE SERVICES & APPROVED PROMOTIONAL PRICING TABLE */}
      <section id="eligible-services" className="scroll-mt-24 py-16 sm:py-20 bg-slate-50">
        <Container>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[color:var(--ablebiz-primary)]">
              <Tag className="h-3.5 w-3.5" /> Part 1 • Service Discount Offer
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-black text-[color:var(--ablebiz-primary)]">
              Eligible Services & Promotional Pricing
            </h2>
            <p className="mt-2 text-slate-600 text-base leading-relaxed">
              During the campaign window (<strong>November 5 – November 20, 2026</strong>),
              qualified clients enjoy the following approved promotional prices on ABLEBIZ
              professional service fees:
            </p>
          </div>

          {/* Mandatory Pricing Compliance Disclosure Banner */}
          <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-300/90 p-4 sm:p-5 text-slate-800 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm space-y-1.5">
                <div className="font-extrabold text-amber-950">
                  Important Professional Fee & Statutory Charge Disclosure:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>
                    <strong>Professional Service Fees Only:</strong> All discounts listed below
                    apply strictly to <strong>ABLEBIZ professional service fees only</strong>.
                  </li>
                  <li>
                    <strong>Statutory Charges Excluded:</strong> CAC filing fees, stamp duties,
                    government charges, regulatory levies, and third-party disbursements are{" "}
                    <strong>excluded</strong> unless expressly stated otherwise on your official
                    quotation/invoice.
                  </li>
                  <li>
                    <strong>Eligibility & Payment Window:</strong> Discounts are available only on
                    the six (6) listed eligible services below, and the{" "}
                    <strong>full promotional amount must be paid within November 5 – November 20, 2026</strong>.
                  </li>
                  <li>
                    <strong>No Stacking:</strong> Promotional discounts cannot be combined with Spin
                    & Win rewards, vouchers, or any other promotional offers.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Responsive Approved Pricing Table */}
          <div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0A2558] text-white text-xs uppercase tracking-wider">
                    <th className="py-4 px-5 font-extrabold">Eligible Service</th>
                    <th className="py-4 px-5 font-extrabold text-right">
                      Regular Professional Fee
                    </th>
                    <th className="py-4 px-5 font-extrabold text-right">Discount</th>
                    <th className="py-4 px-5 font-extrabold text-right">
                      Promotional Professional Fee
                    </th>
                    <th className="py-4 px-5 font-extrabold text-right">You Save</th>
                    <th className="py-4 px-5 font-extrabold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {eligibleServices.map((srv) => {
                    const savings =
                      srv.regular_professional_fee - srv.promo_professional_fee;
                    const serviceWa = buildWhatsAppLink(
                      `Hello ABLEBIZ! I would like to request *${srv.service_name}* under the Office Opening Special Promo:\n• Regular Professional Fee: ${formatNaira(
                        srv.regular_professional_fee
                      )}\n• Promo Discount: ${srv.discount_percentage}% OFF\n• Promotional Professional Fee: ${formatNaira(
                        srv.promo_professional_fee
                      )}\n\nPlease share the requirements and official quotation.`
                    );

                    return (
                      <tr
                        key={srv.service_code}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="py-4 px-5">
                          <div className="font-extrabold text-slate-900 text-base">
                            {srv.service_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {srv.category} • Professional Service Fee Only
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right font-semibold text-slate-500 line-through">
                          {formatNaira(srv.regular_professional_fee)}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 ring-1 ring-amber-300">
                            {srv.discount_percentage}% OFF
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="text-lg font-black text-[color:var(--ablebiz-primary)]">
                            {formatNaira(srv.promo_professional_fee)}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-bold text-emerald-700">
                          {formatNaira(savings)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {!isCompleted && !isPaused ? (
                              <>
                                <a
                                  href="#request-promo-service"
                                  onClick={() => setSelectedServiceForForm(srv.service_name)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-[color:var(--ablebiz-primary)] px-3.5 py-2 text-xs font-bold text-white no-underline hover:bg-blue-900 transition"
                                >
                                  Request <ArrowRight className="h-3.5 w-3.5" />
                                </a>
                                <a
                                  href={serviceWa}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200 no-underline hover:bg-emerald-100 transition"
                                >
                                  WhatsApp
                                </a>
                              </>
                            ) : (
                              <Link
                                to="/services"
                                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 no-underline"
                              >
                                View Standard Rate
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </section>

      {/* 4. REFERRAL REWARDS MILESTONE DISPLAY */}
      <section id="referral-milestones" className="scroll-mt-24 py-16 sm:py-20 bg-white">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-900">
                  <Award className="h-3.5 w-3.5" /> Part 2 • Referral Rewards Campaign
                </span>
                <h2 className="mt-3 text-2xl sm:text-4xl font-black text-[color:var(--ablebiz-primary)]">
                  Refer New Customers & Earn Up to ₦35,000
                </h2>
                <p className="mt-2 text-slate-600 text-base leading-relaxed">
                  Earn guaranteed cash rewards when you refer new clients who purchase and pay for
                  an eligible service during the campaign period (
                  <strong>November 5 – November 20, 2026</strong>).
                </p>
              </div>

              {/* Approved Milestone Table */}
              <div className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                      <th className="py-4 px-5 font-extrabold">Successful Referrals</th>
                      <th className="py-4 px-5 font-extrabold text-right">
                        Total Cumulative Reward
                      </th>
                      <th className="py-4 px-5 font-extrabold text-right">
                        Additional Earned at Milestone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {milestones.map((m) => (
                      <tr key={m.referrals_required} className="hover:bg-amber-50/40">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-900 ring-1 ring-amber-300">
                              {m.referrals_required}
                            </span>
                            <div>
                              <div className="font-extrabold text-slate-900">
                                {m.referrals_required} Successful{" "}
                                {m.referrals_required === 1 ? "Referral" : "Referrals"}
                              </div>
                              <div className="text-xs text-slate-500">{m.label}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="text-lg font-black text-[color:var(--ablebiz-primary)]">
                            {formatNaira(m.total_reward_ngn)}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-semibold text-emerald-700">
                          +{formatNaira(m.additional_reward_ngn)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Explicit Cumulative Milestone Explanation (Required by Part 2D) */}
              <div className="rounded-2xl bg-blue-50/90 border border-blue-200 p-5 text-sm text-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-[color:var(--ablebiz-primary)]">
                  <HelpCircle className="h-5 w-5 text-blue-700 shrink-0" />
                  How Cumulative Milestone Rewards Work (Important):
                </div>
                <p className="leading-relaxed text-slate-700">
                  The referral rewards shown above are{" "}
                  <strong>cumulative milestone totals</strong>, not separate bonuses paid on top of
                  each other. For example, reaching{" "}
                  <strong>3 verified successful referrals</strong> means your{" "}
                  <strong>total reward is ₦7,500</strong> (an additional ₦5,500 over the 1-referral
                  milestone of ₦2,000) — <strong>not</strong> ₦2,000 + ₦7,500. Reaching{" "}
                  <strong>10 verified successful referrals</strong> earns the maximum cumulative
                  reward of <strong>₦35,000</strong>.
                </p>
              </div>
            </div>

            {/* Interactive Cumulative Milestone Calculator */}
            <div className="lg:col-span-5">
              <Card className="border-2 border-amber-400/70 shadow-xl bg-white">
                <CardBody className="p-6 sm:p-8 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                        Interactive Calculator
                      </span>
                      <h3 className="text-xl font-black text-[color:var(--ablebiz-primary)]">
                        Estimate Your Referral Payout
                      </h3>
                    </div>
                    <Trophy className="h-7 w-7 text-amber-500" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm font-bold text-slate-700 mb-2">
                      <span>Verified Successful Referrals:</span>
                      <span className="rounded-xl bg-[#0A2558] px-3 py-1 text-base font-black text-amber-300">
                        {simulatedReferrals}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      value={simulatedReferrals}
                      onChange={(e) => setSimulatedReferrals(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                      aria-label="Simulate verified referrals"
                    />
                    <div className="flex justify-between text-[11px] font-bold text-slate-400 mt-1">
                      <span>0</span>
                      <span>1 (₦2k)</span>
                      <span>3 (₦7.5k)</span>
                      <span>5 (₦15k)</span>
                      <span>10+ (₦35k)</span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-900 p-5 text-white space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Highest Milestone Reached:</span>
                      <span className="font-bold text-amber-300">
                        {milestoneSim.milestoneReached === 0
                          ? "No Milestone Yet"
                          : `${milestoneSim.milestoneReached} Referral Milestone`}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-slate-800 pt-3">
                      <span className="text-sm font-bold text-slate-200">
                        Total Cumulative Reward:
                      </span>
                      <span className="text-3xl font-black text-amber-400">
                        {formatNaira(milestoneSim.totalRewardEarned)}
                      </span>
                    </div>
                    {milestoneSim.nextMilestone ? (
                      <div className="text-xs text-blue-200 pt-1">
                        Refer{" "}
                        <strong className="text-white">
                          {milestoneSim.remainingToNextMilestone} more
                        </strong>{" "}
                        qualified client
                        {milestoneSim.remainingToNextMilestone === 1 ? "" : "s"} to unlock the{" "}
                        <strong className="text-amber-300">
                          {milestoneSim.nextMilestone}-Referral Milestone (
                          {formatNaira(milestoneSim.nextMilestoneTotalReward || 0)} total)
                        </strong>
                        !
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-emerald-300 pt-1">
                        🎉 Maximum 10-Referral Champion Milestone unlocked (₦35,000 Total)!
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    <ButtonLink
                      to="/refer-and-earn"
                      className="w-full justify-center bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black border-0 py-3 shadow-md"
                    >
                      <Users className="h-4 w-4" /> Register / Get Your Referral Code
                    </ButtonLink>
                    <p className="text-[11px] text-center text-slate-500">
                      Already a partner? Visit the{" "}
                      <Link to="/refer-and-earn" className="font-bold text-blue-700">
                        Referral Portal
                      </Link>{" "}
                      to retrieve your code, submit referrals, or add payout bank details.
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </Container>
      </section>

      {/* 5 & 6. HOW THE DISCOUNT WORKS & HOW TO PARTICIPATE IN REFERRAL PROGRAMME */}
      <section className="py-16 sm:py-20 bg-slate-50 border-t border-slate-200/80">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2">
            {/* 5. How the Discount Works */}
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardBody className="p-6 sm:p-8 space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[color:var(--ablebiz-primary)] ring-1 ring-blue-200">
                  <CheckCircle2 className="h-4 w-4" /> How the Discount Works
                </div>
                <h3 className="text-2xl font-black text-[color:var(--ablebiz-primary)]">
                  4 Simple Steps to Claim Your Promotional Price
                </h3>
                <ol className="space-y-4 text-sm text-slate-700">
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0A2558] text-xs font-black text-amber-300">
                      1
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Select an Eligible Service
                      </strong>
                      Choose from Business Name Registration (25% off), Company Registration (30%
                      off), NGO Registration (10% off), SCUML Assistance (20% off), or Annual
                      Returns (8%–10% off).
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0A2558] text-xs font-black text-amber-300">
                      2
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Submit Your Request or Chat on WhatsApp
                      </strong>
                      Use the service request form below, visit our Abeokuta office, or message us
                      on WhatsApp. If someone referred you, share their{" "}
                      <strong>Referral Code or Name</strong> at initial engagement.
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0A2558] text-xs font-black text-amber-300">
                      3
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Receive Your Itemized Campaign Quotation/Invoice
                      </strong>
                      Our team issues an official ABLEBIZ Suite invoice clearly showing your
                      discounted professional service fee alongside any applicable statutory/CAC
                      charges.
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0A2558] text-xs font-black text-amber-300">
                      4
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Complete Full Payment Within Nov 5 – Nov 20, 2026
                      </strong>
                      Pay the full promotional amount before November 20, 2026 (23:59 WAT) to lock
                      in your discount and begin immediate processing.
                    </div>
                  </li>
                </ol>
              </CardBody>
            </Card>

            {/* 6. How to Participate in the Referral Programme */}
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardBody className="p-6 sm:p-8 space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-900 ring-1 ring-amber-300">
                  <Users className="h-4 w-4" /> How the Referral Programme Works
                </div>
                <h3 className="text-2xl font-black text-[color:var(--ablebiz-primary)]">
                  How to Refer & Earn Up to ₦35,000
                </h3>
                <ol className="space-y-4 text-sm text-slate-700">
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-black text-slate-950">
                      1
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Get Your Approved ABLEBIZ Referral Code
                      </strong>
                      Register for free on our{" "}
                      <Link to="/refer-and-earn" className="font-bold text-blue-700">
                        Refer & Earn page
                      </Link>{" "}
                      (or recover your existing code using your phone number).
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-black text-slate-950">
                      2
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Share Your Link or Submit Client Referrals
                      </strong>
                      Share your unique referral link (`?ref=ABL-REF-...`) or log your referred
                      client directly on the referral portal before or at their initial payment.
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-black text-slate-950">
                      3
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Client Completes an Eligible Paid Transaction
                      </strong>
                      When a <strong>new ABLEBIZ customer</strong> purchases an eligible campaign
                      service and completes full payment between{" "}
                      <strong>Nov 5 and Nov 20, 2026</strong>, it counts toward your milestone!
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-black text-slate-950">
                      4
                    </span>
                    <div>
                      <strong className="font-extrabold text-slate-900 block">
                        Post-Campaign Verification & Bank Transfer Payout
                      </strong>
                      After November 20, 2026, all qualified referrals are audited and verified.
                      Approved rewards are transferred to your designated bank account within{" "}
                      <strong>5 to 7 business days</strong> after final verification.
                    </div>
                  </li>
                </ol>
              </CardBody>
            </Card>
          </div>
        </Container>
      </section>

      {/* 8. SERVICE REQUEST FORM SECTION */}
      <section id="request-promo-service" className="scroll-mt-24 py-16 sm:py-20 bg-white">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                <Sparkles className="h-3.5 w-3.5" /> Start Your Request
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[color:var(--ablebiz-primary)]">
                Request an Office Opening Promo Service
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Complete this form to lock in your promotional professional fee or speak directly
                with our compliance officers in Abeokuta. Have a referral code? Include it or let
                our officer know on WhatsApp!
              </p>

              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 space-y-3 text-xs text-slate-600">
                <div className="font-extrabold text-slate-900 text-sm">
                  Direct Campaign Channels:
                </div>
                <div>
                  • <strong>Physical Office:</strong> {campaign.location}
                </div>
                <div>
                  • <strong>Campaign Window:</strong>{" "}
                  {formatLagosDateTime(campaign.start_date, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  –{" "}
                  {formatLagosDateTime(campaign.end_date, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  (WAT)
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  <ButtonLink
                    to={generalWhatsAppLink}
                    external
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 text-xs"
                  >
                    <MessageCircle className="h-4 w-4" /> Chat on WhatsApp Now
                  </ButtonLink>
                  <ButtonLink
                    to="/refer-and-earn"
                    variant="secondary"
                    className="text-xs font-bold"
                  >
                    Go to Referral Portal
                  </ButtonLink>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <ConsultationForm
                defaultServiceId={selectedServiceForForm}
                title="Request Promotional Pricing / Consultation"
                subtitle="Select your desired service below. Our team will verify campaign eligibility and send your official discounted quotation."
              />
            </div>
          </div>
        </Container>
      </section>

      {/* 7. OFFICIAL CAMPAIGN TERMS & CONDITIONS (PART 7) */}
      <section
        id="campaign-terms"
        className="scroll-mt-24 py-16 sm:py-20 bg-slate-900 text-slate-200"
      >
        <Container>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" /> Official Policy & Compliance
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white">
              Campaign Terms & Conditions
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Authoritative Terms & Conditions governing the ABLEBIZ Office Opening Special Promo &
              Referral Rewards Campaign (November 5 – November 20, 2026):
            </p>

            <div className="mt-6 rounded-3xl bg-slate-800/90 p-6 sm:p-8 ring-1 ring-slate-700 space-y-3">
              <ol className="list-decimal pl-5 space-y-3 text-sm text-slate-300 leading-relaxed">
                {campaign.terms_and_conditions.map((term, idx) => (
                  <li key={idx} className="pl-1">
                    {term}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
