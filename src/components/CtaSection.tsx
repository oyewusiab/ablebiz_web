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
        <Card className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border border-blue-900/60 shadow-xl overflow-hidden relative">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <CardBody className="p-8 md:p-10 relative z-10">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  {title}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                  {subtitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink
                  to={whatsapp}
                  external
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md"
                >
                  Chat on WhatsApp
                </ButtonLink>
                <ButtonLink
                  to={`tel:${site.phone}`}
                  external
                  variant="secondary"
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
                >
                  <Phone className="h-4 w-4 text-amber-400" />
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
