import { Check, Gift } from "lucide-react";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import { useGamification } from "../gamification/GamificationProvider";
import { useSiteConfig } from "../referrals/siteConfig";
import { buildWhatsAppLink } from "../content/site";
import { CtaSection } from "../components/CtaSection";

export function PricingPage() {
  const { openSpin } = useGamification();
  const { pricing: pricingTiers } = useSiteConfig();

  const quoteLink = buildWhatsAppLink(
    "Hello ABLEBIZ, I need a custom quote. Please ask me the questions you need."
  );

  return (
    <>
      <Seo
        title="Pricing"
        description="Transparent pricing for CAC registration and documentation. Starter, Standard and Premium packages. Contact ABLEBIZ for a custom quote."
        path="/pricing"
      />

      <PageHero
        title="Pricing"
        subtitle="Clear packages, transparent process, and guidance from a trusted CAC agent. Contact us if you need a custom quote."
        badge="Transparent Pricing • No Hidden Charges"
      />

      <section>
        <Container className="py-14">
          <div className="mb-8 rounded-3xl bg-gradient-to-br from-white via-white to-emerald-50 p-6 ring-1 ring-emerald-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
                  🎁 Spin & Win — Get an instant reward
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  Play our Spin & Win game to get a discount or free bonus on any package.
                </p>
              </div>
              <Button type="button" onClick={() => openSpin("pricing_cta")}
                >
                <Gift className="h-4 w-4" /> Spin & Get Discount
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {pricingTiers.map((t) => (
              <Card
                key={t.id}
                className={
                  t.highlight
                    ? "bg-gradient-to-br from-white via-white to-emerald-50 ring-emerald-200"
                    : undefined
                }
              >
                <CardBody>
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    {t.name}
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900">
                    {t.price}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[color:var(--ablebiz-accent)]">
                    {t.description}
                  </div>

                  <ul className="mt-5 space-y-2 text-sm text-slate-700">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-[color:var(--ablebiz-secondary)]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    <ButtonLink to="/contact" variant={t.highlight ? "primary" : "secondary"}>
                      Get Started
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-emerald-50 p-6 ring-1 ring-emerald-100">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white ring-1 ring-emerald-200">
                <Gift className="h-6 w-6 text-[color:var(--ablebiz-primary)]" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
                  Refer & Earn Program
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  Know someone who needs to register their business? Refer them to ABLEBIZ and earn!
                </p>
              </div>
            </div>
            
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200">
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-secondary)]">5 Referrals</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Unlock a free consultation</div>
                <p className="mt-1 text-xs text-slate-600">Reach 5 referrals in a month to unlock a free session with our experts.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200">
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-secondary)]">10 Referrals</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Discount or free service</div>
                <p className="mt-1 text-xs text-slate-600">Reach 10 referrals to unlock a bigger discount or a free service add-on.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-3xl bg-white/70 p-6 ring-1 ring-emerald-100">
            <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
              Contact us for a custom quote
            </div>
            <p className="mt-2 text-sm text-slate-700">
              If your registration needs are unique (multiple owners, NGO trustees setup, compliance
              filings), we’ll give you a clear breakdown.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink to={quoteLink} external>
                Request custom quote (WhatsApp)
              </ButtonLink>
              <ButtonLink to="/contact" variant="secondary">
                Use Contact Form
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}
