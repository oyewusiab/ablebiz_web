import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { ButtonLink } from "../components/ui/Button";
import { useSiteConfig } from "../referrals/siteConfig";
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

  const heroWhatsApp = buildWhatsAppLink(
    "Hello ABLEBIZ, I would like to speak with someone about your services."
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
        badge="🏆 Award-Winning Business (BYUMS Africa Finalist – 2nd Place)"
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
              className="h-13 px-7 rounded-2xl text-base font-bold bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 transition-all shadow-xs dark:bg-slate-800 dark:text-white dark:ring-slate-700 inline-flex items-center gap-2"
            >
              Explore Our Services
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </>
        }
        right={
          <div className="space-y-4">
            <Card className="overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 group border border-slate-200 dark:border-slate-800">
              <div className="aspect-[16/11] w-full bg-slate-100 overflow-hidden dark:bg-slate-900">
                <img
                  src="/images/hero-illustration.png"
                  alt="ABLEBIZ helps Nigerians register and grow their businesses"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  loading="eager"
                />
              </div>
              <CardBody className="p-6">
                <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                  Registered Business Services Agent • Abeokuta, Ogun State
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
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

      <section>
        <Container className="py-8">
          <AnimateIn>
            <div className="grid gap-6 rounded-3xl bg-white p-7 sm:p-8 shadow-sm ring-1 ring-slate-200 md:grid-cols-[1fr_auto] md:items-center dark:bg-slate-800/90 dark:ring-slate-700">
              <div>
                <div className="text-xl font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                  Quick Help (WhatsApp or Call)
                </div>
                <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-300">
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
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                  What We Do
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                  Everything you need to formalize your business, handle the paperwork, and stay on track.
                </p>
              </div>
              <Link
                to="/services"
                className="hidden text-sm font-bold text-[color:var(--ablebiz-primary)] hover:underline md:inline dark:text-amber-400"
              >
                View all services →
              </Link>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-2">
              {services.map((s, idx) => (
                <AnimateIn key={s.id} delayMs={idx * 80}>
                  <div className="flex flex-col justify-between rounded-2xl bg-white p-6 shadow-xs ring-1 ring-slate-200 transition-all hover:shadow-lg hover:ring-slate-300 h-full dark:bg-slate-800 dark:ring-slate-700">
                    <div>
                      <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 ring-1 ring-blue-100 shrink-0 dark:bg-blue-950 dark:ring-blue-900">
                          <ServiceIcon
                            icon={s.icon}
                            className="h-6 w-6 text-[color:var(--ablebiz-cta)]"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                            {s.title}
                          </div>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {s.short}
                          </p>
                        </div>
                      </div>

                      {s.bullets?.length ? (
                        <ul className="mt-4 grid gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {s.bullets.slice(0, 3).map((b) => (
                            <li key={b} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/services#${s.id}`}
                          className="text-xs font-bold text-[color:var(--ablebiz-primary)] hover:underline dark:text-amber-400"
                        >
                          Learn More →
                        </Link>
                        <Link
                          to={`/services?service=${encodeURIComponent(s.id)}#consultation`}
                          className="text-xs font-bold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
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
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                How It Works: The ABLEBIZ Process
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
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

              <div className="rounded-3xl bg-blue-50/60 p-6 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:ring-blue-900/40">
                <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-200">
                  Our Commitment to You
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
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
                url="https://www.youtube.com/embed/Q3mgyZsFhWM"
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
