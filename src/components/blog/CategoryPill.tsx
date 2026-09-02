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
          ? "bg-amber-500 text-slate-950 font-bold ring-amber-400 shadow-xs"
          : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
      )}
    >
      {label}
    </button>
  );
}
