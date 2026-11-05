import { ArrowRight, Calendar, CheckCircle2, FileText, MessageCircle, Sparkles, Tag, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { ButtonLink } from "../components/ui/Button";
import { useSiteConfig } from "../referrals/siteConfig";
import { useGamification } from "../gamification/GamificationProvider";
import { Card, CardBody } from "../components/ui/Card";
import { ServiceIcon } from "../components/ServiceIcon";
import { AnimateIn } from "../components/AnimateIn";
import { buildWhatsAppLink } from "../content/site";
import { testimonials } from "../content/testimonials";
import { CtaSection } from "../components/CtaSection";
import { TrustBadges } from "../components/TrustBadges";
import { BusinessRegistrationStepsInfographic } from "../components/infographics/BusinessRegistrationSteps";
import { VideoEmbed } from "../components/VideoEmbed";
import { TrustVerificationSection } from "../components/TrustVerificationSection";

export function HomePage() {
  const { site, services } = useSiteConfig();
  const { campaignBundle } = useGamification();
  const campaign = campaignBundle.campaign;
  const showCampaignPromo =
    campaign.is_publicly_visible &&
    (campaign.effective_status === "scheduled" || campaign.effective_status === "active");

  const heroWhatsApp = buildWhatsAppLink(
    "Hello ABLEBIZ, I would like to speak with someone about your services."
  );

  const promoWhatsApp = buildWhatsAppLink(
    "Hello ABLEBIZ! I want to get started with the Office Opening Special Promo (Up to 30% Off / Refer & Earn up to ₦35,000)."
  );

  return (
    <>
      <Seo
        title="Business Registration & Compliance Services | ABLEBIZ"
        description="From business registration and compliance to practical business support, ABLEBIZ helps you handle the paperwork, understand the next steps and keep your business moving."
        path="/"
        keywords={[
          "CAC business registration Abeokuta",
          "register business in Nigeria",
          "company registration Nigeria",
          "CAC business services agent",
          "business name registration Ogun State",
          "CAC annual returns filing",
          "SCUML certificate application",
          "TIN regularization Abeokuta",
          "NGO registration Nigeria",
          "business support services Nigeria",
        ]}
      />

      <PageHero
        badge="Reliable Business Registration & Compliance Support"
        title="Build Your Business With Confidence."
        subtitle="From registration and compliance to practical business support, ABLEBIZ helps you handle the paperwork, understand the next steps and keep your business moving."
        actions={
          <>
            <ButtonLink
              to={heroWhatsApp}
              external
              className="h-13 px-7 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-base border-0 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2"
            >
              <MessageCircle className="h-5 w-5 text-slate-950" />
              WhatsApp ABLEBIZ
            </ButtonLink>
            <ButtonLink
              to="/services"
              variant="secondary"
              className="h-13 px-7 rounded-2xl text-base font-bold bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 transition-all shadow-xs inline-flex items-center gap-2"
            >
              Explore Our Services
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </>
        }
        right={
          <div className="space-y-4">
            <Card className="overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 group border border-slate-200 bg-white">
              <div className="aspect-[16/11] w-full bg-slate-100 overflow-hidden">
                <img
                  src="/images/hero-illustration.png"
                  alt="ABLEBIZ helps Nigerians register and grow their businesses"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  loading="eager"
                />
              </div>
              <CardBody className="p-6">
                <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)]">
                  Registered Business Services Agent • Abeokuta, Ogun State
                </div>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Clear guidance, real-time updates, and an organized process across Nigeria.
                </p>
                <div className="mt-4">
                  <TrustBadges />
                </div>
              </CardBody>
            </Card>
          </div>
        }
      />

      {/* OFFICE OPENING SPECIAL PROMO SECTION (Part 2A) */}
      {showCampaignPromo ? (
        <section aria-label="ABLEBIZ Office Opening Special Promo">
          <Container className="pt-10 pb-2">
            <AnimateIn>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#061738] via-[#0A2558] to-[#040e24] p-7 sm:p-10 text-white shadow-xl ring-2 ring-amber-400/40">
                <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950">
                        <Sparkles className="h-3.5 w-3.5" /> ABLEBIZ OFFICE OPENING SPECIAL
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-200 ring-1 ring-white/20">
                        <Calendar className="h-3.5 w-3.5 text-amber-400" /> Campaign Period: November 5 – November 20, 2026
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                        {campaign.promo_headline} •{" "}
                        <span className="text-amber-300">REFER & {campaign.referral_headline}</span>
                      </h2>
                      <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-2xl">
                        Selected Business Registration, Compliance & Business Support Services — celebrating our physical office opening in {campaign.location}.{" "}
                        <span className="text-amber-200 font-semibold">Terms and conditions apply.</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <ButtonLink
                        to="/office-opening-promo#eligible-services"
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black border-0 shadow-md"
                      >
                        <Tag className="h-4 w-4" /> Explore Promotional Services
                      </ButtonLink>
                      <ButtonLink
                        to={promoWhatsApp}
                        external
                        className="bg-[#25D366] hover:bg-[#1ebd59] text-white font-extrabold border-0 shadow-md"
                      >
                        <MessageCircle className="h-4 w-4" /> Get Started on WhatsApp
                      </ButtonLink>
                      <ButtonLink
                        to="/refer-and-earn"
                        variant="secondary"
                        className="bg-white/10 text-white border-white/25 hover:bg-white/20 font-bold"
                      >
                        <Users className="h-4 w-4 text-amber-300" /> Join the Referral Rewards Programme
                      </ButtonLink>
                      <Link
                        to="/office-opening-promo#campaign-terms"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white no-underline transition"
                      >
                        <FileText className="h-3.5 w-3.5" /> View Campaign Terms
                      </Link>
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-xs space-y-3">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                        Featured Promotional Fees
                      </div>
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="text-slate-300">Business Name Reg. (25% Off)</span>
                          <span className="font-black text-white">₦30,000</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="text-slate-300">Company Reg. (30% Off)</span>
                          <span className="font-black text-white">₦45,500</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="text-slate-300">NGO Reg. (10% Off)</span>
                          <span className="font-black text-white">₦144,000</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">SCUML Assistance (20% Off)</span>
                          <span className="font-black text-white">₦32,000</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-300/90 pt-1">
                        * Applies to ABLEBIZ professional service fees only.{" "}
                        <Link to="/office-opening-promo" className="text-amber-300 font-bold underline">
                          See all 6 services →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateIn>
          </Container>
        </section>
      ) : null}

      <section>
        <Container className="py-8">
          <AnimateIn>
            <div className="grid gap-6 rounded-3xl bg-white p-7 sm:p-8 shadow-sm ring-1 ring-slate-200 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-xl font-extrabold text-[color:var(--ablebiz-primary)]">
                  Quick Help (WhatsApp or Call)
                </div>
                <p className="mt-1 text-sm sm:text-base text-slate-600">
                  Have questions about registering your business or staying compliant? Connect directly with our team.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ButtonLink
                  to={heroWhatsApp}
                  external
                  className="h-12 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md inline-flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4 text-slate-950" />
                  Chat on WhatsApp
                </ButtonLink>
                <ButtonLink to="/services#checklists" variant="secondary" className="h-12 px-5 rounded-xl">
                  Download checklists
                </ButtonLink>
                <ButtonLink to={`tel:${site.phone}`} external variant="secondary" className="h-12 px-5 rounded-xl">
                  Call {site.phoneDisplay}
                </ButtonLink>
              </div>
            </div>
          </AnimateIn>
        </Container>
      </section>

      <section id="services">
        <Container className="py-14 sm:py-16">
          <AnimateIn>
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[color:var(--ablebiz-primary)]">
                  What We Do
                </h2>
                <p className="mt-2 text-sm text-slate-600 sm:text-base">
                  Everything you need to formalize your business, handle the paperwork, and stay on track.
                </p>
              </div>
              <Link
                to="/services"
                className="hidden text-sm font-bold text-[color:var(--ablebiz-primary)] hover:underline md:inline"
              >
                View all services →
              </Link>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-2">
              {services.map((s, idx) => (
                <AnimateIn key={s.id} delayMs={idx * 80}>
                  <div className="flex flex-col justify-between rounded-2xl bg-white p-6 shadow-xs ring-1 ring-slate-200 transition-all hover:shadow-lg hover:ring-slate-300 h-full">
                    <div>
                      <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 ring-1 ring-blue-100 shrink-0">
                          <ServiceIcon
                            icon={s.icon}
                            className="h-6 w-6 text-[color:var(--ablebiz-cta)]"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)]">
                            {s.title}
                          </div>
                          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                            {s.short}
                          </p>
                        </div>
                      </div>

                      {s.bullets?.length ? (
                        <ul className="mt-4 grid gap-1.5 text-xs text-slate-600">
                          {s.bullets.slice(0, 3).map((b) => (
                            <li key={b} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/services#${s.id}`}
                          className="text-xs font-bold text-[color:var(--ablebiz-primary)] hover:underline"
                        >
                          Learn More →
                        </Link>
                        <Link
                          to={`/services?service=${encodeURIComponent(s.id)}#consultation`}
                          className="text-xs font-bold text-slate-700 hover:text-slate-950"
                        >
                          Consultation
                        </Link>
                      </div>

                      <a
                        href={buildWhatsAppLink(
                          s.whatsappMessage ||
                            `Hello ABLEBIZ, I would like to inquire about: ${s.title}.\n\nPlease let me know the requirements and next steps.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </AnimateIn>
        </Container>
      </section>

      {/* The ABLEBIZ Process: Clear 6-Step Journey */}
      <section id="process">
        <Container className="py-14 sm:py-16">
          <AnimateIn>
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[color:var(--ablebiz-primary)]">
                How It Works: The ABLEBIZ Process
              </h2>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                A simple, predictable, and transparent process designed to give you peace of mind at every stage.
              </p>
            </div>
            <BusinessRegistrationStepsInfographic />
          </AnimateIn>
        </Container>
      </section>

      <section>
        <Container className="py-14">
          <AnimateIn>
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                  Why Clients Trust ABLEBIZ
                </h2>
                <p className="mt-2 text-sm text-slate-700 sm:text-base">
                  We are built for clarity, speed, and professionalism — so you can focus on building your enterprise.
                </p>

                <ul className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  {[
                    "Registered Business Services Agent",
                    "Transparent Pricing (No Hidden Charges)",
                    "Fast & Monitored Turnaround",
                    "Real-Time Application Updates",
                    "Physical Office in Abeokuta",
                    "Digital Delivery Across Nigeria",
                  ].map((t) => (
                    <li key={t} className="inline-flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-[color:var(--ablebiz-secondary)]" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl bg-blue-50/60 p-6 ring-1 ring-blue-100">
                <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)]">
                  Our Commitment to You
                </div>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  We do not believe in surprise charges or prolonged waiting periods without communication. From the moment you send your enquiry, we confirm document readiness upfront, quote clearly, and keep you informed until your official certificates and compliance documents are in your hands.
                </p>
                <div className="mt-4">
                  <TrustBadges />
                </div>
              </div>
            </div>
          </AnimateIn>
        </Container>
      </section>

      <TrustVerificationSection />

      <section>
        <Container className="py-14">
          <AnimateIn>
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                  Watch: How ABLEBIZ Works
                </h2>
                <p className="mt-2 text-sm text-slate-700 sm:text-base">
                  A short walkthrough of our process — from your first message to document delivery.
                </p>
                <p className="mt-4 text-sm font-semibold text-[color:var(--ablebiz-accent)]">
                  Tip: Prefer WhatsApp? We reply quickly.
                </p>
              </div>
              <VideoEmbed
                url="https://www.youtube.com/embed/BZ_CRYPc-9I"
                title="ABLEBIZ Intro Video"
              />
            </div>
          </AnimateIn>
        </Container>
      </section>

      <section id="testimonials">
        <Container className="py-14">
          <AnimateIn>
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                  Testimonials
                </h2>
                <p className="mt-2 text-sm text-slate-700 sm:text-base">
                  Real words from clients who wanted a smooth, trustworthy process.
                </p>
              </div>
              <Link
                to="/testimonials"
                className="hidden text-sm font-semibold text-[color:var(--ablebiz-accent)] underline md:inline"
              >
                View all
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.slice(0, 3).map((t, idx) => (
                <AnimateIn key={t.id} delayMs={idx * 80}>
                  <Card>
                    <CardBody>
                      <p className="text-sm leading-relaxed text-slate-700">“{t.quote}”</p>
                      <div className="mt-4 text-xs font-semibold text-slate-600">
                        {t.name} • {t.roleOrBusiness}
                      </div>
                    </CardBody>
                  </Card>
                </AnimateIn>
              ))}
            </div>
          </AnimateIn>
        </Container>
      </section>

      <CtaSection />

      <section>
        <Container className="pb-16">
          <div className="text-center text-xs font-semibold text-slate-600">

          </div>
        </Container>
      </section>
    </>
  );
}
