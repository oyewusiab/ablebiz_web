import { Award, BadgeCheck, Building2, ShieldCheck } from "lucide-react";
import { site } from "../content/site";
import { Container } from "./ui/Container";
import { Card, CardBody } from "./ui/Card";

function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes("cac")) return BadgeCheck;
  if (t.includes("office") || t.includes("abeokuta")) return Building2;
  if (t.includes("award")) return Award;
  return ShieldCheck;
}

export function TrustVerificationSection({
  compact,
}: {
  compact?: boolean;
}) {
  const { verification, stats } = site.trust;

  return (
    <section>
      <Container className={compact ? "py-10" : "py-14"}>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
              Trust & Verification
            </h2>
            <p className="mt-2 text-sm text-slate-700 sm:text-base">
              We know service payments require confidence. Here’s why clients feel safe working with
              ABLEBIZ.
            </p>

            <div className="mt-6 grid gap-3">
              {verification.map((v) => {
                const Icon = iconFor(v.title);
                return (
                  <div
                    key={v.title}
                    className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-xs dark:bg-slate-800 dark:ring-slate-700"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 ring-1 ring-blue-100 text-[color:var(--ablebiz-primary)] dark:bg-blue-950 dark:ring-blue-900">
                      <Icon className="h-5 w-5 text-[color:var(--ablebiz-cta)]" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white">{v.title}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{v.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Tip: Ask us anything — timeline, requirements, or costs — we’ll respond clearly.
            </div>
          </div>

          <Card className="border border-slate-200 shadow-md dark:border-slate-800">
            <CardBody>
              <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                Quick facts
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80 dark:bg-slate-800/80 dark:ring-slate-700"
                  >
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.label}</div>
                    <div className="mt-1 text-xl font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-blue-50/60 p-4 text-sm text-slate-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-slate-300 dark:ring-blue-900">
                <div className="font-extrabold text-slate-900 dark:text-white">Verification note</div>
                <p className="mt-1">
                  Prefer extra assurance? You can request a quick call, visit our office in Abeokuta,
                  or ask for supporting references relevant to your service.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </Container>
    </section>
  );
}
