import { BadgeCheck, FileText, Send, Sparkles } from "lucide-react";
import { Card, CardBody } from "../ui/Card";

const steps = [
  {
    title: "Contact us",
    desc: "WhatsApp or Call",
    icon: Send,
  },
  {
    title: "Submit details",
    desc: "We confirm requirements",
    icon: FileText,
  },
  {
    title: "We process",
    desc: "CAC filing & follow-up",
    icon: Sparkles,
  },
  {
    title: "Receive documents",
    desc: "Certificate & documents",
    icon: BadgeCheck,
  },
];

export function BusinessRegistrationStepsInfographic() {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
              Infographic: Steps to Register a Business in Nigeria
            </div>
            <div className="text-sm text-slate-600">Simple 4-step flow</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-emerald-100">
                    <Icon className="h-5 w-5 text-[color:var(--ablebiz-primary)]" />
                  </div>
                  <div className="text-xs font-extrabold text-[color:var(--ablebiz-accent)]">
                    {idx + 1}
                  </div>
                </div>
                <div className="mt-3 text-sm font-bold text-[color:var(--ablebiz-primary)]">
                  {s.title}
                </div>
                <div className="text-sm text-slate-700">{s.desc}</div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
