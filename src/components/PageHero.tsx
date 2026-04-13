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
    <section className={cn("relative overflow-hidden", className)}>
      <Container className="py-14">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            {badge ? <Badge>{badge}</Badge> : null}
            <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[color:var(--ablebiz-primary)] sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-pretty text-base leading-relaxed text-slate-700 sm:text-lg">
                {subtitle}
              </p>
            ) : null}
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>

          {right ? (
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-100/60 via-white/30 to-emerald-200/40 blur-2xl" />
              <div className="relative">{right}</div>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
