import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "../content/site";
import { cn } from "../utils/cn";

export function WhatsAppFloatingButton({ className }: { className?: string }) {
  const link = buildWhatsAppLink(
    "Hello ABLEBIZ, I’d like to register my business. Please guide me."
  );

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with ABLEBIZ on WhatsApp"
      className={cn(
        "fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_12px_30px_rgba(10,37,88,0.25)] ring-1 ring-amber-400/40 transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        className
      )}
    >
      <MessageCircle className="h-7 w-7 fill-slate-950/10" />
    </a>
  );
}
