import { Award, BadgeCheck, Briefcase, HeartHandshake } from "lucide-react";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { CtaSection } from "../components/CtaSection";
import { site } from "../content/site";
import { VideoEmbed } from "../components/VideoEmbed";
import { TrustVerificationSection } from "../components/TrustVerificationSection";

export function AboutPage() {
  return (
    <>
      <Seo
        title="About ABLEBIZ Business Services"
        description="Learn about ABLEBIZ Business Services — an award-winning business compliance service helping Nigerians register and grow safely and professionally."
        path="/about"
      />

      <PageHero
        title="About ABLEBIZ Business Services"
        subtitle="At ABLEBIZ Business Services, we are passionate about helping entrepreneurs turn their ideas into legally recognized and structured businesses."
        badge={site.awardBadge}
      />

      <section>
        <Container className="py-14">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <Card>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Our Story
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base">
                  We understand that many business owners struggle with fear, confusion, and lack of
                  trust when it comes to registration and compliance. That is why we provide a
                  transparent, reliable, and guided process that removes stress and builds confidence.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base">
                  Whether you’re registering a business name, setting up a company, or structuring an
                  NGO, we make the journey clear and professional.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Founder
                </div>
                <div className="mt-3 text-base font-extrabold text-slate-900">
                  Oyewusi Adebayo Babatunde
                </div>
                <div className="text-sm font-semibold text-[color:var(--ablebiz-accent)]">
                  Founder, ABLEBIZ Business Services
                </div>

                <ul className="mt-4 grid gap-3 text-sm text-slate-700">
                  <li className="inline-flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-5 w-5 text-[color:var(--ablebiz-secondary)]" />
                    Certified CAC Agent
                  </li>
                  <li className="inline-flex items-start gap-2">
                    <Briefcase className="mt-0.5 h-5 w-5 text-[color:var(--ablebiz-secondary)]" />
                    Administrative & Financial Management Background
                  </li>
                  <li className="inline-flex items-start gap-2">
                    <Award className="mt-0.5 h-5 w-5 text-[color:var(--ablebiz-secondary)]" />
                    Award-winning entrepreneur ({site.awardBadge})
                  </li>
                </ul>
              </CardBody>
            </Card>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-center">
            <Card>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Core Values
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {["Integrity", "Excellence", "Reliability", "Customer-Centered Service"].map((v) => (
                    <div
                      key={v}
                      className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100"
                    >
                      <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                        <HeartHandshake className="h-5 w-5" />
                        {v}
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        We keep the process clear, honest, and professional — no stories.
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                Short Video
              </div>
              <VideoEmbed
                url="https://www.youtube.com/embed/ysz5S6PUM-U"
                title="Meet ABLEBIZ"
              />
              <p className="text-xs text-slate-600">
                Replace this with your own 30–60s intro video when ready.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <TrustVerificationSection />

      <CtaSection />
    </>
  );
}
