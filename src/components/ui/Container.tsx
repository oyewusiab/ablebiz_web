import type { PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

export function Container({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 2xl:max-w-[1440px]", className)}>
      {children}
    </div>
  );
}
