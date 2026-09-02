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
    <footer className="border-t border-slate-200/80 bg-slate-900 text-slate-300">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <img
                src="/images/ablebiz-logo.png"
                alt="ABLEBIZ"
                className="h-11 w-auto brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">{site.tagline}</p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/20">
              {site.awardBadge}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-bold text-white tracking-wide uppercase">
              Quick Links
            </div>
            <div className="grid gap-2 text-sm">
              <Link className="text-slate-400 no-underline transition hover:text-amber-400" to="/services">
                Services
              </Link>
              <Link className="text-slate-400 no-underline transition hover:text-amber-400" to="/pricing">
                Pricing
              </Link>
              <Link className="text-slate-400 no-underline transition hover:text-amber-400" to="/blog">
                Blog / Resources
              </Link>
              <Link className="text-slate-400 no-underline transition hover:text-amber-400" to="/refer-and-earn">
                Refer & Earn
              </Link>
              <Link className="text-slate-400 no-underline transition hover:text-amber-400" to="/contact">
                Contact Us
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-bold text-white tracking-wide uppercase">
              Contact & Support
            </div>
            <div className="space-y-2.5 text-sm text-slate-400">
              <a className="flex items-center gap-2.5 no-underline transition hover:text-amber-400" href={`tel:${site.phone}`}>
                <Phone className="h-4 w-4 text-amber-400" />
                {site.phoneDisplay}
              </a>
              <a className="flex items-center gap-2.5 no-underline transition hover:text-amber-400" href={`mailto:${site.email}`}>
                <Mail className="h-4 w-4 text-amber-400" />
                {site.email}
              </a>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" />
                <span>{site.location}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <ButtonLink
                to={whatsapp}
                external
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-sm"
              >
                Chat on WhatsApp
              </ButtonLink>
              <ButtonLink
                to="/contact"
                variant="secondary"
                className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:text-white"
              >
                Contact Form
              </ButtonLink>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-800 pt-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} {site.name}. All rights reserved.</div>
          <div className="text-slate-400">
            Certified CAC Accreditation Support • Abeokuta, Nigeria
          </div>
        </div>
      </Container>
    </footer>
  );
}
