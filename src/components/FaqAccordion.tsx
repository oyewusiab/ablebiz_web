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
          className="group rounded-2xl bg-white/70 ring-1 ring-emerald-100 open:bg-white"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
              {it.q}
            </span>
            <ChevronDown className="h-5 w-5 flex-none text-[color:var(--ablebiz-accent)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 text-sm leading-relaxed text-slate-700">
            {it.a}
          </div>
        </details>
      ))}
    </div>
  );
}
