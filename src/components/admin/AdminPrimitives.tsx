import type { ComponentType, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type IconType = ComponentType<{ className?: string }>;

export function AdminPage({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="space-y-2">
          {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
          <div className="space-y-1">
            <h1 className="admin-page-title">{title}</h1>
            {description ? <p className="admin-page-description">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="admin-page-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminSurface({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("admin-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AdminSurface className={cn("admin-section", className)}>
      <div className="admin-section-header">
        <div className="space-y-1">
          <h2 className="admin-section-title">{title}</h2>
          {description ? <p className="admin-section-description">{description}</p> : null}
        </div>
        {actions ? <div className="admin-section-actions">{actions}</div> : null}
      </div>
      {children}
    </AdminSurface>
  );
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  meta,
}: {
  label: string;
  value: ReactNode;
  icon?: IconType;
  tone?: "default" | "success" | "info" | "warning";
  meta?: ReactNode;
}) {
  return (
    <AdminSurface className="admin-stat-card">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="admin-stat-label">{label}</p>
          <div className="admin-stat-value">{value}</div>
          {meta ? <div className="admin-stat-meta">{meta}</div> : null}
        </div>
        {Icon ? (
          <div className={cn("admin-icon-chip", tone !== "default" && `admin-icon-chip-${tone}`)}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </AdminSurface>
  );
}

export function AdminTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; icon?: IconType }>;
}) {
  return (
    <div className="admin-tabs" role="tablist">
      {items.map((item) => {
        const active = value === item.value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn("admin-tab", active && "admin-tab-active")}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AdminBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return <span className={cn("admin-badge", `admin-badge-${tone}`, className)}>{children}</span>;
}

export function AdminField({
  label,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: IconType;
  children: ReactNode;
}) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      {children}
      {hint ? <span className="admin-field-hint">{hint}</span> : null}
    </label>
  );
}

export function AdminInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("admin-input-field", className)} {...props} />;
}

export function AdminTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("admin-input-field admin-textarea", className)} {...props} />;
}

export function AdminSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("admin-input-field admin-select", className)} {...props} />;
}

export function AdminEmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon?: IconType;
}) {
  return (
    <div className="admin-empty-state">
      {Icon ? (
        <div className="admin-empty-icon">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="admin-empty-title">{title}</h3>
        {description ? <p className="admin-empty-description">{description}</p> : null}
      </div>
    </div>
  );
}
