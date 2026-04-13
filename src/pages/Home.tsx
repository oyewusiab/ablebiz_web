import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Button, ButtonLink } from "../components/ui/Button";
import { useGamification } from "../gamification/GamificationProvider";
import { Card, CardBody } from "../components/ui/Card";
import { services } from "../content/services";
import { ServiceIcon } from "../components/ServiceIcon";
import { AnimateIn } from "../components/AnimateIn";
import { buildWhatsAppLink, site } from "../content/site";
import { testimonials } from "../content/testimonials";
import { CtaSection } from "../components/CtaSection";
import { TrustBadges } from "../components/TrustBadges";
import { BusinessRegistrationStepsInfographic } from "../components/infographics/BusinessRegistrationSteps";
import { VideoEmbed } from "../components/VideoEmbed";
import { TrustVerificationSection } from "../components/TrustVerificationSection";

export function HomePage() {
  const { openSpin } = useGamification();

  const whatsapp = buildWhatsAppLink(
    "Hello ABLEBIZ, I’m ready to register my business. Please guide me."
  );

  return (
    <>
      <Seo
        title="Register and Grow Your Business with Confidence"
        description="ABLEBIZ is an award-winning CAC compliance service helping Nigerians register and grow their businesses safely and professionally. Affordable CAC registration Nigeria with transparent pricing, fast turnaround, and a trusted CAC agent in Abeokuta."
        path="/"
      />

      <PageHero
        badge="🏆 Award-Winning Business (BYUMS Africa Finalist – 2nd Place)"
        title="Register and Grow Your Business with Confidence"
        subtitle="We help entrepreneurs and organizations handle CAC registration, compliance, and documentation — fast, reliable, and stress-free."
        actions={
          <>
            <Button type="button" onClick={() => openSpin("get_started")}>
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <ButtonLink to={whatsapp} external variant="secondary">
              Chat on WhatsApp
            </ButtonLink>
          </>
        }
        right={
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-[16/10] w-full bg-emerald-100">
                <img
                  src="/images/hero-illustration.png"
                  alt="ABLEBIZ helps Nigerians register and grow their businesses"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Trusted CAC Agent • Abeokuta, Ogun State
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Clear guidance, real-time updates, and a professional process.
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
        <Container className="py-10">
          <AnimateIn>
            <div className="grid gap-6 rounded-3xl bg-white/60 p-6 ring-1 ring-emerald-100 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
                  Quick help (WhatsApp or Call)
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  Want a simple checklist for your exact registration type? Message us now.
                </p>
              </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink to={whatsapp} external>
                    Chat on WhatsApp
                  </ButtonLink>
                  <ButtonLink to="/services#checklists" variant="secondary">
                    Download checklists
                  </ButtonLink>
                  <ButtonLink to={`tel:${site.phone}`} external variant="secondary">
                    Call {site.phoneDisplay}
                  </ButtonLink>
                </div>
            </div>
          </AnimateIn>
        </Container>
      </section>

      <section id="services">
        <Container className="py-14">
          <AnimateIn>
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                  What We Do
                </h2>
                <p className="mt-2 text-sm text-slate-700 sm:text-base">
                  Everything you need to register properly, stay compliant, and grow with confidence.
                </p>
              </div>
              <Link
                to="/services"
                className="hidden text-sm font-semibold text-[color:var(--ablebiz-accent)] underline md:inline"
              >
                View all services
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {services.map((s, idx) => (
                <AnimateIn key={s.id} delayMs={idx * 80}>
                  <div className="rounded-2xl bg-white/80 p-6 shadow-sm ring-1 ring-emerald-100">
                    <div className="flex items-start gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
                        <ServiceIcon
                          icon={s.icon}
                          className="h-6 w-6 text-[color:var(--ablebiz-primary)]"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)]">
                          {s.title}
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{s.short}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <Link
                            to={`/services#${s.id}`}
                            className="text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
                          >
                            Learn More
                          </Link>
                          <Link
                            to={`/contact?service=${encodeURIComponent(s.id)}`}
                            className="text-sm font-semibold text-slate-900 underline"
                          >
                            Request Consultation
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </AnimateIn>
        </Container>
      </section>

      <section>
        <Container className="py-14">
          <AnimateIn>
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                  Why Clients Trust Us
                </h2>
                <p className="mt-2 text-sm text-slate-700 sm:text-base">
                  We’re built for clarity, speed, and professionalism — so you can focus on business.
                </p>

                <ul className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  {[
                    "Registered CAC Agent",
                    "Transparent Pricing (No Hidden Charges)",
                    "Fast Turnaround Time",
                    "Real-Time Updates",
                    "Physical Office in Abeokuta",
                    "Trusted by Entrepreneurs & SMEs",
                  ].map((t) => (
                    <li key={t} className="inline-flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-[color:var(--ablebiz-secondary)]" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <BusinessRegistrationStepsInfographic />
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
                url="https://www.youtube.com/embed/ysz5S6PUM-U"
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
            Keywords: Business registration in Abeokuta • CAC agent in Nigeria • Register business in Nigeria
          </div>
        </Container>
      </section>
    </>
  );
}
