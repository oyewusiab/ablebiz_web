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
        "fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ablebiz-cta)] text-[color:var(--ablebiz-primary)] shadow-[0_18px_45px_rgba(15,77,15,0.22)] ring-1 ring-emerald-200 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        className
      )}
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
