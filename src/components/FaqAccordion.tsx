import { ChevronDown } from "lucide-react";
import type { FaqItem } from "../content/services";
import { cn } from "../utils/cn";

export function FaqAccordion({
  items,
  className,
}: {
  items: FaqItem[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {items.map((it, idx) => (
        <details
          key={`${idx}-${it.q}`}
          className="group rounded-2xl bg-white ring-1 ring-slate-200 transition-all open:shadow-md dark:bg-slate-800/90 dark:ring-slate-700"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <span className="text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
              {it.q}
            </span>
            <ChevronDown className="h-5 w-5 flex-none text-[color:var(--ablebiz-cta)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {it.a}
          </div>
        </details>
      ))}
    </div>
  );
}
