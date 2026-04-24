import type { PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

export function Badge({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ablebiz-primary)] border border-[var(--color-primary-100)] uppercase tracking-wider",
        className
      )}
    >
      {children}
    </span>
  );
}
