import { Phone } from "lucide-react";
import { buildWhatsAppLink, site } from "../content/site";
import { ButtonLink } from "./ui/Button";
import { Container } from "./ui/Container";
import { Card, CardBody } from "./ui/Card";

export function CtaSection({
  title = "Ready to Register Your Business Today?",
  subtitle = "Chat with a trusted CAC agent and get a clear, guided process from start to finish.",
  whatsappMessage = "Hello ABLEBIZ, I’m ready to register. Please share the next steps.",
}: {
  title?: string;
  subtitle?: string;
  whatsappMessage?: string;
}) {
  const whatsapp = buildWhatsAppLink(whatsappMessage);

  return (
    <section>
      <Container className="py-14">
        <Card className="bg-gradient-to-br from-white via-white to-emerald-50">
          <CardBody className="p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-2xl font-extrabold tracking-tight text-[color:var(--ablebiz-primary)]">
                  {title}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
                  {subtitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink to={whatsapp} external>
                  Chat on WhatsApp
                </ButtonLink>
                <ButtonLink to={`tel:${site.phone}`} external variant="secondary">
                  <Phone className="h-4 w-4" />
                  Call Now
                </ButtonLink>
              </div>
            </div>
          </CardBody>
        </Card>
      </Container>
    </section>
  );
}
