import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost";

type BaseProps = {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function styles(variant: Variant, size: "sm" | "md" | "lg") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  const variants: Record<Variant, string> = {
    primary:
      "bg-[var(--ablebiz-primary)] text-white hover:brightness-110 shadow-sm",
    secondary:
      "bg-white text-[var(--text-primary)] border border-[var(--admin-border)] hover:bg-[var(--color-neutral-50)] dark:bg-white/5",
    ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--color-neutral-100)] dark:hover:bg-white/5",
  };

  return cn(base, sizes[size], variants[variant]);
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: PropsWithChildren<BaseProps & ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className={cn(styles(variant, size), className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  to,
  variant = "primary",
  size = "md",
  className,
  external,
}: PropsWithChildren<
  BaseProps & { to: string; external?: boolean; className?: string }
>) {
  const cls = cn(styles(variant, size), className);

  if (external) {
    return (
      <a className={cls} href={to} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link className={cls} to={to}>
      {children}
    </Link>
  );
}
