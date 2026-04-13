import { Mail, MapPin, Phone } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { ButtonLink } from "../components/ui/Button";
import { buildWhatsAppLink, site } from "../content/site";
import { ConsultationForm } from "../components/ConsultationForm";

export function ContactPage() {
  const { search } = useLocation();
  const defaultServiceId = useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get("service") ?? undefined;
  }, [search]);

  const whatsapp = buildWhatsAppLink(
    "Hello ABLEBIZ, I’d like to make an enquiry about CAC registration/compliance."
  );

  return (
    <>
      <Seo
        title="Contact"
        description="Contact ABLEBIZ Business Services in Abeokuta, Ogun State. Call, WhatsApp, or send a message for CAC registration and compliance services." 
        path="/contact"
      />

      <PageHero
        title="Contact ABLEBIZ"
        subtitle="We respond fast on WhatsApp. You can also call or send an email."
        badge="Abeokuta, Ogun State"
        actions={
          <>
            <ButtonLink to={whatsapp} external>
              Chat on WhatsApp
            </ButtonLink>
            <ButtonLink to={`tel:${site.phone}`} external variant="secondary">
              Call Now
            </ButtonLink>
          </>
        }
      />

      <section>
        <Container className="py-14">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <Card>
                <CardBody>
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    Contact Info
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <a
                      className="flex items-center gap-2 no-underline hover:underline"
                      href={`tel:${site.phone}`}
                    >
                      <Phone className="h-4 w-4" />
                      {site.phoneDisplay}
                    </a>
                    <a
                      className="flex items-center gap-2 no-underline hover:underline"
                      href={`mailto:${site.email}`}
                    >
                      <Mail className="h-4 w-4" />
                      {site.email}
                    </a>
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4" />
                      <span>{site.location}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <ButtonLink to={whatsapp} external>
                      WhatsApp
                    </ButtonLink>
                    <ButtonLink to={`tel:${site.phone}`} external variant="secondary">
                      Call
                    </ButtonLink>
                    <ButtonLink to="/services#checklists" variant="secondary">
                      Download checklists
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>

              <Card className="overflow-hidden">
                <div className="aspect-[16/10] bg-emerald-100">
                  <iframe
                    title="Google Map"
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src="https://www.google.com/maps?q=Abeokuta%2C%20Ogun%20State&output=embed"
                  />
                </div>
                <CardBody>
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    Visit us
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Physical office available in Abeokuta. Message us for directions.
                  </p>
                </CardBody>
              </Card>
            </div>

            <ConsultationForm
              defaultServiceId={defaultServiceId}
              source="Contact page"
              title="Request a Consultation"
              subtitle="Select your service, urgency, and budget range — we’ll respond with clear steps and transparent pricing."
            />
          </div>
        </Container>
      </section>
    </>
  );
}
