import type { ReactNode } from "react";
import { Container } from "./ui/Container";
import { Badge } from "./ui/Badge";
import { cn } from "../utils/cn";

export function PageHero({
  title,
  subtitle,
  badge,
  actions,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden py-8 sm:py-12 lg:py-16", className)}>
      <Container>
        <div className="grid items-center gap-10 lg:gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            {badge ? <Badge>{badge}</Badge> : null}
            <h1 className="text-balance text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-black tracking-tight leading-[1.15] text-[color:var(--ablebiz-primary)] dark:text-blue-100">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-pretty text-base sm:text-lg md:text-xl leading-relaxed text-slate-700 dark:text-slate-300 max-w-2xl">
                {subtitle}
              </p>
            ) : null}
            {actions ? <div className="flex flex-wrap items-center gap-3.5 pt-2">{actions}</div> : null}
          </div>

          {right ? (
            <div className="relative w-full">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-blue-200/50 via-amber-100/40 to-blue-300/30 blur-2xl dark:from-blue-900/30 dark:to-amber-900/20" />
              <div className="relative w-full">{right}</div>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
