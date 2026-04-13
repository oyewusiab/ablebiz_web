import { useMemo, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { cn } from "../../utils/cn";

function IconButton({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-emerald-100 hover:bg-emerald-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ShareButtons({ title }: { title: string }) {
  const url = useMemo(() => window.location.href, []);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`);
    } catch {
      // ignore
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const whatsapp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`,
      "_blank"
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <IconButton onClick={share} label="Share">
        <Share2 className="h-4 w-4" />
        Share
      </IconButton>
      <IconButton onClick={whatsapp} label="Share on WhatsApp">
        WhatsApp
      </IconButton>
      <IconButton onClick={copy} label="Copy link" className={copied ? "bg-emerald-50" : undefined}>
        <Copy className="h-4 w-4" />
        {copied ? "Copied" : "Copy link"}
      </IconButton>
    </div>
  );
}
