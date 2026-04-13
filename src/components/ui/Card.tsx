import type { PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/90 shadow-[0_18px_45px_rgba(0,0,0,0.08)] ring-1 ring-emerald-100",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
