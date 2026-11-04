import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Gift, MessageCircle, Sparkles } from "lucide-react";
import { buildWhatsAppLink } from "../content/site";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import { useSiteConfig } from "../referrals/siteConfig";
import { useGamification } from "../gamification/GamificationProvider";
import { ServiceIcon } from "../components/ServiceIcon";
import { CtaSection } from "../components/CtaSection";
import { ConsultationForm } from "../components/ConsultationForm";
import { checklists } from "../content/checklists";
import { ChecklistCard } from "../components/checklists/ChecklistCard";
import { FaqAccordion } from "../components/FaqAccordion";
import { TrustVerificationSection } from "../components/TrustVerificationSection";

export function ServicesPage() {
  const { openSpin, isSpinPaused, campaignBundle } = useGamification();
  const { services } = useSiteConfig();
  const { hash, search } = useLocation();
  const campaign = campaignBundle.campaign;
  const showCampaignBanner =
    campaign.is_publicly_visible &&
    (campaign.effective_status === "scheduled" || campaign.effective_status === "active");

  const defaultServiceId = useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get("service") ?? undefined;
  }, [search]);

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <>
      <Seo
        title="CAC Business Registration, Company Incorporation & Compliance Services"
        description="Professional CAC registration services in Nigeria and Abeokuta: Business Name, Limited Liability Company (LTD/LLC), Incorporated Trustees/NGOs, Annual Returns, TIN, SCUML, and Post-Incorporation changes."
        path="/services"
        keywords={[
          "CAC registration services",
          "register company Nigeria",
          "business name registration",
          "CAC annual returns agent",
          "NGO registration Nigeria",
          "SCUML certificate application",
          "TIN registration Nigeria",
          "CAC accredited agent Abeokuta",
          "post incorporation filings CAC",
          "corporate affairs commission services",
        ]}
      />

      <PageHero
        title="Our Services"
        subtitle="Structured, clear, and professional support for business registration, compliance, and documentation — with real-time updates and dedicated guidance."
        badge="Registered Business Services Agent • Abeokuta, Ogun State"
      />

      <TrustVerificationSection compact />

      {/* Promotional Banner (Office Opening Promo when Spin & Win is paused) */}
      {isSpinPaused ? (
        showCampaignBanner ? (
          <section>
            <Container className="pt-8">
              <div className="rounded-3xl bg-gradient-to-r from-[#0A2558] via-blue-900 to-[#0A2558] p-6 sm:p-7 text-white ring-1 ring-amber-400/40 shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30 mb-2">
                      <Sparkles className="h-3.5 w-3.5" /> ABLEBIZ Office Opening Special (Nov 5 – Nov 20, 2026)
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-white">
                      {campaign.promo_headline} • {campaign.referral_headline}
                    </div>
                    <p className="mt-1 text-sm text-blue-100">
                      Save up to 30% on ABLEBIZ professional service fees for Business Name, Company, NGO, SCUML & Annual Returns. Terms & conditions apply.
                    </p>
                  </div>
                  <ButtonLink
                    to="/office-opening-promo"
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md shrink-0"
                  >
                    <Sparkles className="h-4 w-4 text-slate-950" /> View Promo Prices <ArrowRight className="h-4 w-4" />
                  </ButtonLink>
                </div>
              </div>
            </Container>
          </section>
        ) : null
      ) : (
        <section>
          <Container className="pt-8">
            <div className="rounded-3xl bg-gradient-to-r from-amber-500/10 via-blue-50/50 to-amber-500/10 p-6 ring-1 ring-amber-500/30">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
                    🎁 Spin & Win — Get an instant reward
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Play our Spin & Win game to get a discount or free bonus on any registration service.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => openSpin("pricing_cta")}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md shrink-0"
                >
                  <Gift className="h-4 w-4 text-slate-950" /> Spin & Get Discount
                </Button>
              </div>
            </div>
          </Container>
        </section>
      )}

      <section>
        <Container className="py-14">
          <div className="grid gap-8">
            {services.map((s) => {
              const hasChecklist = checklists.some((c) => c.relatedServiceIds.includes(s.id));
              const whatsappUrl = buildWhatsAppLink(
                s.whatsappMessage ||
                  `Hello ABLEBIZ, I would like to inquire about your service:\n\nService: ${s.title}\n\nPlease let me know the requirements, turnaround time, and next steps.`
              );

              return (
                <div key={s.id} id={s.id} className="scroll-mt-28">
                  <Card className="border border-slate-200/90 shadow-sm transition-shadow hover:shadow-md bg-white">
                    <CardBody className="p-6 sm:p-8">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 ring-1 ring-blue-100 shrink-0">
                          <ServiceIcon
                            icon={s.icon}
                            className="h-7 w-7 text-[color:var(--ablebiz-cta)]"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                              {s.title}
                            </h2>
                            {s.timeline ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                                {s.timeline}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 text-base text-slate-700 leading-relaxed">
                            {s.description}
                          </p>

                          {/* 4-Part Structured Breakdown */}
                          <div className="mt-6 grid gap-6 md:grid-cols-2">
                            {/* Who It Is For */}
                            {s.whoItIsFor?.length ? (
                              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                                <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--ablebiz-primary)]">
                                  👤 Who This Is For
                                </div>
                                <ul className="mt-3 space-y-2 text-xs sm:text-sm text-slate-700">
                                  {s.whoItIsFor.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {/* What You May Need */}
                            {s.whatYouNeed?.length ? (
                              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                                <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--ablebiz-primary)]">
                                  📋 What You May Need
                                </div>
                                <ul className="mt-3 space-y-2 text-xs sm:text-sm text-slate-700">
                                  {s.whatYouNeed.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {/* How ABLEBIZ Helps */}
                            {s.howWeHelp?.length ? (
                              <div className="rounded-2xl bg-blue-50/40 p-4 ring-1 ring-blue-100/70">
                                <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--ablebiz-primary)]">
                                  🛡️ How ABLEBIZ Helps
                                </div>
                                <ul className="mt-3 space-y-2 text-xs sm:text-sm text-slate-700">
                                  {s.howWeHelp.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {/* What Happens Next */}
                            {s.whatHappensNext?.length ? (
                              <div className="rounded-2xl bg-blue-50/40 p-4 ring-1 ring-blue-100/70">
                                <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--ablebiz-primary)]">
                                  ⚡ What Happens Next
                                </div>
                                <ul className="mt-3 space-y-2 text-xs sm:text-sm text-slate-700">
                                  {s.whatHappensNext.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>

                          {/* Action CTAs */}
                          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 text-sm font-bold text-slate-950 shadow-sm hover:from-amber-600 hover:to-amber-700"
                            >
                              <MessageCircle className="h-4 w-4 text-slate-950" />
                              WhatsApp About This Service
                            </a>

                            <Link
                              to={`/services?service=${encodeURIComponent(s.id)}#consultation`}
                              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                            >
                              Request Consultation Form
                            </Link>

                            {hasChecklist ? (
                              <Link
                                to="/services#checklists"
                                className="text-sm font-semibold text-[color:var(--ablebiz-primary)] hover:underline"
                              >
                                Download Checklist →
                              </Link>
                            ) : null}
                          </div>

                          {/* FAQs */}
                          {s.faqs?.length ? (
                            <div className="mt-8 border-t border-slate-100 pt-6">
                              <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                                FAQs for {s.title}
                              </div>
                              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                                Clear answers to common questions about requirements, timelines, and documentation.
                              </p>
                              <div className="mt-4">
                                <FaqAccordion items={s.faqs} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section id="checklists">
        <Container className="py-14">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                Free Downloadable Checklists
              </h2>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Get the exact requirements before you start — these checklists help you prepare and avoid delays.
              </p>
            </div>
            <div className="hidden text-xs font-semibold text-slate-500 md:block">
              Lead magnets • Professional PDFs
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {checklists.map((c) => (
              <ChecklistCard key={c.id} checklist={c} />
            ))}
          </div>
        </Container>
      </section>

      <section id="consultation">
        <Container className="py-14">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <ConsultationForm
              defaultServiceId={defaultServiceId}
              source="Services page"
              title="Request a Consultation"
              subtitle="Select your service, urgency, and budget range — we’ll respond with clear steps and transparent pricing."
            />

            <Card className="bg-white border border-slate-200">
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  What happens next
                </div>
                <ul className="mt-4 grid gap-3 text-sm text-slate-700">
                  <li className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    1) We confirm your requirements and eligibility.
                  </li>
                  <li className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    2) We send a clear quote (no hidden charges).
                  </li>
                  <li className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    3) You submit details/documents.
                  </li>
                  <li className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    4) We process and deliver your documents.
                  </li>
                </ul>
                <div className="mt-4 text-xs font-semibold text-[color:var(--ablebiz-accent)]">
                  Trusted CAC Agent • Physical Office in Abeokuta
                </div>
              </CardBody>
            </Card>
          </div>
        </Container>
      </section>

      <CtaSection
        title="Need a custom compliance package?"
        subtitle="Tell us your business type and goals — we’ll recommend the right registration + compliance steps and share a clear quote."
      />
    </>
  );
}
