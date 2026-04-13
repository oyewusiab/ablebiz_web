import type { PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

export function Badge({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[color:var(--ablebiz-accent)] ring-1 ring-emerald-200",
        className
      )}
    >
      {children}
    </span>
  );
}
