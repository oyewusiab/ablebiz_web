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
        "overflow-hidden rounded-2xl bg-white shadow-[0_18px_45px_rgba(0,0,0,0.08)] ring-1 ring-emerald-100",
        className
      )}
    >
      <div className="aspect-video w-full bg-emerald-100">
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
