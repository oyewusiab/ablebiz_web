import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { useSiteConfig } from "../referrals/siteConfig";
import { ServiceIcon } from "../components/ServiceIcon";
import { CtaSection } from "../components/CtaSection";
import { ConsultationForm } from "../components/ConsultationForm";
import { checklists } from "../content/checklists";
import { ChecklistCard } from "../components/checklists/ChecklistCard";
import { FaqAccordion } from "../components/FaqAccordion";
import { TrustVerificationSection } from "../components/TrustVerificationSection";

export function ServicesPage() {
  const { services } = useSiteConfig();
  const { hash, search } = useLocation();
  const defaultServiceId = useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get("service") ?? undefined;
  }, [search]);

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <>
      <Seo
        title="Services"
        description="CAC business registration, NGO & association registration, compliance services (BPP, SCUML, NSITF, trademark) and business support services in Nigeria."
        path="/services"
      />

      <PageHero
        title="Services"
        subtitle="Structured, clear, and professional support for CAC registration, compliance, and documentation — with real-time updates and transparent pricing."
        badge="Trusted CAC Agent • Abeokuta"
      />

      <TrustVerificationSection compact />

      <section>
        <Container className="py-14">
          <div className="grid gap-4">
            {services.map((s) => {
              const hasChecklist = checklists.some((c) => c.relatedServiceIds.includes(s.id));
              return (
                <div key={s.id} id={s.id} className="scroll-mt-28">
                  <Card>
                    <CardBody>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
                          <ServiceIcon
                            icon={s.icon}
                            className="h-6 w-6 text-[color:var(--ablebiz-primary)]"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
                            {s.title}
                          </div>
                          <p className="mt-1 text-sm text-slate-700 sm:text-base">
                            {s.description}
                          </p>

                          {s.bullets?.length ? (
                            <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                              {s.bullets.map((b) => (
                                <li
                                  key={b}
                                  className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-emerald-100"
                                >
                                  {b}
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {s.timeline ? (
                            <div className="mt-4 text-sm font-semibold text-[color:var(--ablebiz-accent)]">
                              {s.timeline}
                            </div>
                          ) : null}

                          <div className="mt-5 flex flex-wrap items-center gap-3">
                            <Link
                              to={`/services?service=${encodeURIComponent(s.id)}#consultation`}
                              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[color:var(--ablebiz-cta)] px-4 text-sm font-extrabold text-slate-900 shadow-sm ring-1 ring-emerald-200 hover:brightness-95"
                            >
                              Request Consultation
                            </Link>

                            {hasChecklist ? (
                              <Link
                                to="/services#checklists"
                                className="text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
                              >
                                Download checklist
                              </Link>
                            ) : null}
                          </div>

                          {s.faqs?.length ? (
                            <div className="mt-8">
                              <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                                FAQs for {s.title}
                              </div>
                              <p className="mt-1 text-sm text-slate-700">
                                Quick answers to the most common questions we get before payment.
                              </p>
                              <div className="mt-4">
                                <FaqAccordion items={s.faqs} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section id="checklists">
        <Container className="py-14">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
                Free Downloadable Checklists
              </h2>
              <p className="mt-2 text-sm text-slate-700 sm:text-base">
                Get the exact requirements before you start — these checklists help you prepare and avoid delays.
              </p>
            </div>
            <div className="hidden text-xs font-semibold text-slate-600 md:block">
              Lead magnets • Professional PDFs
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {checklists.map((c) => (
              <ChecklistCard key={c.id} checklist={c} />
            ))}
          </div>
        </Container>
      </section>

      <section id="consultation">
        <Container className="py-14">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <ConsultationForm
              defaultServiceId={defaultServiceId}
              source="Services page"
              title="Request a Consultation"
              subtitle="Select your service, urgency, and budget range — we’ll respond with clear steps and transparent pricing."
            />

            <Card>
              <CardBody>
                <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  What happens next
                </div>
                <ul className="mt-4 grid gap-3 text-sm text-slate-700">
                  <li className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-emerald-100">
                    1) We confirm your requirements and eligibility.
                  </li>
                  <li className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-emerald-100">
                    2) We send a clear quote (no hidden charges).
                  </li>
                  <li className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-emerald-100">
                    3) You submit details/documents.
                  </li>
                  <li className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-emerald-100">
                    4) We process and deliver your documents.
                  </li>
                </ul>
                <div className="mt-4 text-xs font-semibold text-[color:var(--ablebiz-accent)]">
                  Trusted CAC Agent • Physical Office in Abeokuta
                </div>
              </CardBody>
            </Card>
          </div>
        </Container>
      </section>

      <CtaSection
        title="Need a custom compliance package?"
        subtitle="Tell us your business type and goals — we’ll recommend the right registration + compliance steps and share a clear quote."
      />
    </>
  );
}
