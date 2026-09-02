import { useEffect, useMemo, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { buildWhatsAppLink } from "../content/site";
import { cn } from "../utils/cn";

const STORAGE_KEY = "ablebiz_wa_help_dismissed_until";

function now() {
  return Date.now();
}

function dismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now();
  } catch {
    return false;
  }
}

function dismissFor(days = 7) {
  try {
    localStorage.setItem(STORAGE_KEY, String(now() + days * 24 * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}

const TOPICS = [
  {
    id: "business_name",
    label: "Business Name Registration",
    starter: "I want to register a Business Name. Please guide me.",
  },
  {
    id: "company",
    label: "Company (Limited) Registration",
    starter: "I want to register a Company (Limited). Please guide me.",
  },
  {
    id: "ngo",
    label: "NGO / Association Registration",
    starter: "I want to register an NGO/Association. Please guide me.",
  },
  {
    id: "compliance",
    label: "Compliance (Tax / Annual Returns / BPP)",
    starter: "I need help with compliance (Tax/Annual Returns/BPP/NSITF). Please guide me.",
  },
] as const;

type TopicId = (typeof TOPICS)[number]["id"];

export function WhatsAppHelpWidget({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<TopicId>("business_name");
  const [extra, setExtra] = useState("");

  useEffect(() => {
    if (dismissed()) return;

    // Light prompt: show after a few seconds
    const t = window.setTimeout(() => setVisible(true), 9000);
    return () => window.clearTimeout(t);
  }, []);

  const topicObj = useMemo(() => TOPICS.find((t) => t.id === topic)!, [topic]);

  const message = useMemo(() => {
    const tail = extra.trim() ? `\n\nExtra details: ${extra.trim()}` : "";
    return `Hello ABLEBIZ,\n\n${topicObj.starter}${tail}\n\n(WhatsApp quick chat from website)`;
  }, [extra, topicObj.starter]);

  const link = useMemo(() => buildWhatsAppLink(message), [message]);

  if (!visible) return null;

  return (
    <div className={cn("fixed bottom-24 right-5 z-40", className)}>
      {!open ? (
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-200"
            aria-label="Open WhatsApp quick chat"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30">
              <MessageCircle className="h-4 w-4" />
            </span>
            Need help now?
          </button>

          <button
            type="button"
            onClick={() => {
              dismissFor(7);
              setVisible(false);
            }}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="w-[min(92vw,360px)] rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                WhatsApp Quick Chat
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                WhatsApp-first support • typically responds fast
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
              }}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Minimize"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 p-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">What do you need help with?</div>
            <div className="grid gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className={cn(
                    "rounded-2xl px-3 py-2 text-left text-sm font-semibold ring-1 transition",
                    t.id === topic
                      ? "bg-amber-500/10 text-amber-800 font-bold ring-amber-500/40 dark:text-amber-300"
                      : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Extra details (optional)</span>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                className="min-h-20 rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                placeholder="Example: I’m outside Ogun State, I need it urgently, my preferred business name is..."
              />
            </label>

            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-sm font-bold text-slate-950 ring-1 ring-amber-400/40 hover:from-amber-600 hover:to-amber-700 shadow-sm"
            >
              Open WhatsApp
            </a>

            <button
              type="button"
              onClick={() => {
                dismissFor(7);
                setVisible(false);
              }}
              className="text-xs font-semibold text-slate-500 underline hover:text-slate-800 dark:text-slate-400"
            >
              Don’t show again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
