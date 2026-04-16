import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { useSiteConfig } from "../referrals/siteConfig";
import { buildWhatsAppLink } from "../content/site";
import { Container } from "./ui/Container";
import { ButtonLink } from "./ui/Button";

export function Footer() {
  const { site } = useSiteConfig();
  const whatsapp = buildWhatsAppLink(
    "Hello ABLEBIZ, I’m ready to register. Please share the next steps."
  );

  return (
    <footer className="border-t border-emerald-100 bg-white/50">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="space-y-3">
            <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)]">
              {site.name}
            </div>
            <p className="text-sm text-slate-700">{site.tagline}</p>
            <p className="text-sm font-semibold text-[color:var(--ablebiz-accent)]">
              {site.awardBadge}
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-bold text-[color:var(--ablebiz-primary)]">
              Quick Links
            </div>
            <div className="grid gap-2 text-sm">
              <Link className="text-slate-700 no-underline hover:underline" to="/services">
                Services
              </Link>
              <Link className="text-slate-700 no-underline hover:underline" to="/pricing">
                Pricing
              </Link>
              <Link className="text-slate-700 no-underline hover:underline" to="/blog">
                Blog / Resources
              </Link>
              <Link className="text-slate-700 no-underline hover:underline" to="/contact">
                Contact
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-bold text-[color:var(--ablebiz-primary)]">
              Contact
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <a className="flex items-center gap-2 no-underline hover:underline" href={`tel:${site.phone}`}>
                <Phone className="h-4 w-4" />
                {site.phoneDisplay}
              </a>
              <a className="flex items-center gap-2 no-underline hover:underline" href={`mailto:${site.email}`}>
                <Mail className="h-4 w-4" />
                {site.email}
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4" />
                <span>{site.location}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <ButtonLink to={whatsapp} external>
                Chat on WhatsApp
              </ButtonLink>
              <ButtonLink to="/contact" variant="secondary">
                Contact Form
              </ButtonLink>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-emerald-100 pt-6 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} {site.name}. All rights reserved.</div>
          <div className="text-slate-600">
            Keywords: Business registration in Abeokuta • CAC agent in Nigeria • Register business in Nigeria
          </div>
        </div>
      </Container>
    </footer>
  );
}
