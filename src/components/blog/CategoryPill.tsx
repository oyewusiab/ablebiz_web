import { cn } from "../../utils/cn";

export function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
        active
          ? "bg-[var(--ablebiz-cta)] text-[color:var(--ablebiz-primary)] ring-emerald-200"
          : "bg-white/70 text-slate-700 ring-emerald-100 hover:bg-white"
      )}
    >
      {label}
    </button>
  );
}
