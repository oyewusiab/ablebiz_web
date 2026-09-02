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
          <div className="mb-8 rounded-3xl bg-gradient-to-r from-amber-500/10 via-blue-50/50 to-amber-500/10 p-6 ring-1 ring-amber-500/30 dark:from-amber-950/20 dark:via-blue-950/30 dark:to-amber-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                  🎁 Spin & Win — Get an instant reward
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Play our Spin & Win game to get a discount or free bonus on any package.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => openSpin("pricing_cta")}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md"
              >
                <Gift className="h-4 w-4 text-slate-950" /> Spin & Get Discount
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pricingTiers.map((t) => (
              <Card
                key={t.id}
                className={
                  t.highlight
                    ? "border-2 border-amber-500 shadow-xl relative overflow-hidden bg-white dark:bg-slate-800"
                    : "border border-slate-200 shadow-sm dark:border-slate-800"
                }
              >
                {t.highlight ? (
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-center py-1 text-xs font-black uppercase tracking-wider">
                    Most Popular
                  </div>
                ) : null}
                <CardBody className="p-6 sm:p-7">
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                    {t.name}
                  </div>
                  <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                    {t.price}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {t.description}
                  </div>

                  <ul className="mt-5 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    <ButtonLink
                      to="/contact"
                      variant={t.highlight ? "primary" : "secondary"}
                      className={
                        t.highlight
                          ? "w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0"
                          : "w-full"
                      }
                    >
                      Get Started
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-blue-50/60 p-6 ring-1 ring-blue-200/70 dark:bg-blue-950/40 dark:ring-blue-900">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-700">
                <Gift className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                  Refer & Earn Program
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Know someone who needs to register their business? Refer them to ABLEBIZ and earn!
                </p>
              </div>
            </div>
            
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 shadow-xs">
                <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">5 Referrals</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Unlock a free consultation</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reach 5 referrals in a month to unlock a free session with our experts.</p>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 shadow-xs">
                <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">10 Referrals</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Discount or free service</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reach 10 referrals to unlock a bigger discount or a free service add-on.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/90 dark:ring-slate-700">
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
