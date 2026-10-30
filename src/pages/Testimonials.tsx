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
              <Card key={t.id} className="bg-white border border-slate-200">
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                      {t.name ?? "Client"}
                    </div>
                    <Quote className="h-5 w-5 text-amber-500" />
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

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
              <div className="aspect-[16/10] bg-slate-100">
                <img
                  src="/images/testimonials/whatsapp-review-2.jpeg"
                  alt="WhatsApp review from Mr. Ekpenyong of Eksendeal Impart"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Mr. Ekpenyong
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Eksendeal Impart
                </p>
              </CardBody>
            </Card>

            <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
              <div className="aspect-[16/10] bg-slate-100">
                <img
                  src="/images/testimonials/whatsapp-review-1.jpeg"
                  alt="WhatsApp review from Mrs. Idowu of Beehive Essence Limited"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Mrs. Idowu
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Beehive Essence Limited
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
