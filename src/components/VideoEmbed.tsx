import { cn } from "../utils/cn";

export function VideoEmbed({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700",
        className
      )}
    >
      <div className="aspect-video w-full bg-slate-100 dark:bg-slate-900">
        <iframe
          className="h-full w-full"
          src={url}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}
