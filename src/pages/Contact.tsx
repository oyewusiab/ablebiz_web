import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { ButtonLink } from "../components/ui/Button";
import { useSiteConfig } from "../referrals/siteConfig";
import { buildWhatsAppLink } from "../content/site";
import { ConsultationForm } from "../components/ConsultationForm";

export function ContactPage() {
  const { site } = useSiteConfig();
  const { search } = useLocation();
  const defaultServiceId = useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get("service") ?? undefined;
  }, [search]);

  const whatsapp = buildWhatsAppLink(
    "Hello ABLEBIZ, I would like to make an enquiry about business registration and compliance."
  );

  return (
    <>
      <Seo
        title="Contact ABLEBIZ Business Services | Abeokuta, Ogun State"
        description="Contact ABLEBIZ Business Services via WhatsApp, phone, or our consultation form. Physical office at Along M.K.O. Abiola Way, Leme, Abeokuta. Nationwide digital service delivery."
        path="/contact"
        keywords={[
          "contact ABLEBIZ Abeokuta",
          "business registration office Abeokuta",
          "CAC agent contact number Ogun State",
          "MKO Abiola Way business services",
          "ABLEBIZ phone number",
          "consultation for business registration Nigeria",
        ]}
      />

      <PageHero
        title="Contact ABLEBIZ"
        subtitle="Connect directly with our team on WhatsApp for quick guidance, submit a detailed enquiry for a written quote, or call us directly."
        badge="Abeokuta, Ogun State • Nationwide Digital Support"
        actions={
          <>
            <ButtonLink
              to={whatsapp}
              external
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950"
            >
              <MessageCircle className="h-4 w-4 text-slate-950" />
              Chat on WhatsApp
            </ButtonLink>
            <ButtonLink to={`tel:${site.phone}`} external variant="secondary">
              <Phone className="h-4 w-4" />
              Call {site.phoneDisplay}
            </ButtonLink>
          </>
        }
      />

      {/* 3 Clear Contact Pathways */}
      <section>
        <Container className="pt-8 sm:pt-10">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Option 1: WhatsApp */}
            <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  <MessageCircle className="h-4 w-4" /> Option 1 • Fastest
                </div>
                <div className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">
                  WhatsApp ABLEBIZ
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Best for immediate questions, requirement checklists, and quick status updates.
                </p>
              </div>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> Open WhatsApp Chat
              </a>
            </div>

            {/* Option 2: Detailed Enquiry Form */}
            <div className="flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-blue-50/40 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-400">
                  <Send className="h-4 w-4" /> Option 2 • Comprehensive
                </div>
                <div className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">
                  Consultation Form
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Best if you want to share full requirements, budget range, and urgency for a structured quote.
                </p>
              </div>
              <a
                href="#consultation-form"
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Fill Enquiry Form ↓
              </a>
            </div>

            {/* Option 3: Phone & Physical Office */}
            <div className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  <Phone className="h-4 w-4" /> Option 3 • Direct Line
                </div>
                <div className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">
                  Call or Visit Office
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Direct phone access to staff and in-person consultations at our Abeokuta office.
                </p>
              </div>
              <a
                href={`tel:${site.phone}`}
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 text-xs font-bold text-slate-950 shadow-xs hover:from-amber-600 hover:to-amber-700"
              >
                <Phone className="h-4 w-4" /> Call {site.phoneDisplay}
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* Main Content: Form & Office Location */}
      <section id="consultation-form">
        <Container className="py-12 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <ConsultationForm
              defaultServiceId={defaultServiceId}
              source="Contact page"
              title="Request a Consultation"
              subtitle="Select your service, urgency, and budget range — our team reviews and responds promptly with clear steps."
            />

            <div className="space-y-6">
              <Card className="border border-slate-200/90 shadow-sm dark:border-slate-800">
                <CardBody className="p-6">
                  <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                    Office & Communication Channels
                  </div>
                  <div className="mt-4 space-y-3.5 text-sm text-slate-700 dark:text-slate-300">
                    <a
                      className="flex items-center gap-3 no-underline hover:text-amber-600 transition-colors"
                      href={`tel:${site.phone}`}
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        <Phone className="h-4 w-4" />
                      </div>
                      <span className="font-semibold">{site.phoneDisplay}</span>
                    </a>
                    <a
                      className="flex items-center gap-3 no-underline hover:text-amber-600 transition-colors"
                      href={`mailto:${site.email}`}
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <span>{site.email}</span>
                    </a>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <span className="leading-relaxed">{site.location}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <ButtonLink to={whatsapp} external className="text-xs">
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp Direct
                    </ButtonLink>
                    <ButtonLink to={`tel:${site.phone}`} external variant="secondary" className="text-xs">
                      Call Staff
                    </ButtonLink>
                    <ButtonLink to="/services#checklists" variant="secondary" className="text-xs">
                      Free Checklists
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>

              <Card className="overflow-hidden border border-slate-200/90 shadow-sm dark:border-slate-800">
                <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800">
                  <iframe
                    title="ABLEBIZ Office Google Map"
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    style={{ border: 0 }}
                    allowFullScreen
                    src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d247.42880605392742!2d3.3631815885844443!3d7.142079595823527!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zN8KwMDgnMzEuNiJOIDPCsDIxJzQ4LjAiRQ!5e0!3m2!1sen!2sng!4v1776944050104!5m2!1sen!2sng"
                  />
                </div>
                <CardBody className="p-5">
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                    Visit Our Office
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Physical office available along M.K.O. Abiola Way, Leme, Abeokuta. In-person consultations welcomed Monday through Friday during business hours.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
