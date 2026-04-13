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
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ablebiz-cta)] focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-60 disabled:pointer-events-none";

  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  const variants: Record<Variant, string> = {
    primary:
      "bg-[var(--ablebiz-cta)] text-[color:var(--ablebiz-primary)] hover:brightness-95 shadow-[0_10px_25px_rgba(15,77,15,0.18)]",
    secondary:
      "bg-white text-[color:var(--ablebiz-primary)] ring-1 ring-emerald-200 hover:bg-emerald-50",
    ghost: "bg-transparent text-[color:var(--ablebiz-primary)] hover:bg-emerald-50",
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
