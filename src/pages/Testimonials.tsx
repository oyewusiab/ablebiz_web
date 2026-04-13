import { Quote } from "lucide-react";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { testimonials } from "../content/testimonials";
import { CtaSection } from "../components/CtaSection";

export function TestimonialsPage() {
  return (
    <>
      <Seo
        title="Testimonials"
        description="Client testimonials for ABLEBIZ Business Services — professional, trustworthy CAC registration and compliance support in Nigeria."
        path="/testimonials"
      />

      <PageHero
        title="Testimonials"
        subtitle="People choose ABLEBIZ because they want a smooth, transparent process — and real updates until completion."
        badge="Trusted by Entrepreneurs & SMEs"
      />

      <section>
        <Container className="py-14">
          <div className="grid gap-4 md:grid-cols-2">
            {testimonials.map((t) => (
              <Card key={t.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                      {t.name ?? "Client"}
                    </div>
                    <Quote className="h-5 w-5 text-emerald-300" />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">“{t.quote}”</p>
                  {t.roleOrBusiness ? (
                    <div className="mt-4 text-xs font-semibold text-slate-600">
                      {t.roleOrBusiness}
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="aspect-[16/10] bg-emerald-100">
                <img
                  src="/images/testimonials/whatsapp-review-1.png"
                  alt="WhatsApp review screenshot"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  WhatsApp Reviews
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  We also receive feedback directly on WhatsApp after successful registrations.
                </p>
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <div className="aspect-[16/10] bg-emerald-100">
                <img
                  src="/images/testimonials/whatsapp-review-2.png"
                  alt="WhatsApp review screenshot"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Before/After Confidence
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Many clients start with fear and uncertainty — and finish with confidence and documents.
                </p>
              </CardBody>
            </Card>
          </div>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}
