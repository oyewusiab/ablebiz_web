import { useState } from "react";
import type { Checklist } from "../../content/checklists";
import { Button } from "../ui/Button";
import { Card, CardBody } from "../ui/Card";
import { LeadMagnetModal } from "./LeadMagnetModal";

type Props = {
  checklist: Checklist;
};

export function ChecklistCard({ checklist }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardBody>
          <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)]">
            {checklist.title}
          </div>
          <p className="mt-1 text-sm text-slate-700">{checklist.description}</p>

          <ul className="mt-4 grid gap-2 text-sm text-slate-700">
            {checklist.bullets.slice(0, 5).map((b) => (
              <li key={b} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700 dark:text-slate-300">
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400">
              PDF • Free Download
            </div>
            <Button
              type="button"
              onClick={() => setOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-xs"
            >
              Download PDF
            </Button>
          </div>
        </CardBody>
      </Card>

      {open ? <LeadMagnetModal checklist={checklist} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
