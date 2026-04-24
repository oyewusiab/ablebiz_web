import type { PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--card-bg)] border border-[var(--admin-border)] shadow-sm",
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
