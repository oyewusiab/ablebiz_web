import {
  BadgeCheck,
  CheckCircle2,
  FileSearch,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardBody } from "../ui/Card";

export const ablebizSteps = [
  {
    step: "01",
    title: "Tell us what you need",
    desc: "Reach out via WhatsApp or submit a quick enquiry with your business details.",
    icon: MessageSquare,
  },
  {
    step: "02",
    title: "We review",
    desc: "We check name availability, verify your documentation, and confirm eligibility.",
    icon: FileSearch,
  },
  {
    step: "03",
    title: "We explain next steps",
    desc: "Receive clear requirements and an upfront quote with zero hidden charges.",
    icon: CheckCircle2,
  },
  {
    step: "04",
    title: "We process",
    desc: "We handle official preparation, portal filings, and active follow-up.",
    icon: Sparkles,
  },
  {
    step: "05",
    title: "Receive documents",
    desc: "Official CAC certificates, status reports, and filing documents delivered digitally.",
    icon: BadgeCheck,
  },
  {
    step: "06",
    title: "We help you stay on track",
    desc: "Ongoing compliance guidance, annual returns reminders, and post-incorporation support.",
    icon: ShieldCheck,
  },
];

export function BusinessRegistrationStepsInfographic() {
  return (
    <Card className="border border-slate-200 shadow-md dark:border-slate-800">
      <CardBody className="p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
              The ABLEBIZ Process
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Clear 6-step journey from first message to legal compliance
            </div>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900">
            Transparent & Guided
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ablebizSteps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="flex flex-col justify-between rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/80 transition-all hover:bg-white hover:shadow-sm dark:bg-slate-800/70 dark:ring-slate-700"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-950 dark:ring-blue-900">
                      <Icon className="h-5 w-5 text-[color:var(--ablebiz-cta)]" />
                    </div>
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                      {s.step}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-bold text-[color:var(--ablebiz-primary)] dark:text-blue-200">
                    {s.title}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed dark:text-slate-300">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
