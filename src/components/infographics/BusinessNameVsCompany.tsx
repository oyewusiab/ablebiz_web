import { Building2, User } from "lucide-react";
import { Card, CardBody } from "../ui/Card";

export function BusinessNameVsCompanyInfographic() {
  return (
    <Card>
      <CardBody>
        <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
          Infographic: Business Name vs Company
        </div>
        <div className="mt-1 text-sm text-slate-600">
          A quick comparison to help you decide
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-blue-50/70 p-5 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-700">
                <User className="h-5 w-5 text-[color:var(--ablebiz-cta)]" />
              </div>
              <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                Business Name
              </div>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>Great for solo founders and small teams</li>
              <li>Typically simpler and faster to set up</li>
              <li>Good for early-stage operations</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-amber-50/70 p-5 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:ring-amber-900">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-amber-200 dark:bg-slate-800 dark:ring-slate-700">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                Company (Ltd)
              </div>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>Better for scaling, partnerships, investors</li>
              <li>Stronger structure and perception</li>
              <li>More compliance & documentation</li>
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
