import { useMemo, useState } from "react";
import type { Checklist } from "../../content/checklists";
import { services } from "../../content/services";
import { buildWhatsAppLink } from "../../content/site";
import { downloadChecklistPdf } from "../../utils/checklistPdf";
import { Button } from "../ui/Button";
import { Card, CardBody } from "../ui/Card";

type Props = {
  checklist: Checklist;
  onClose: () => void;
};

export function LeadMagnetModal({ checklist, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState<string>(
    services.find((s) => checklist.relatedServiceIds.includes(s.id))?.title ?? "Custom / Not sure"
  );
  const [sendToWhatsApp, setSendToWhatsApp] = useState(true);

  const whatsapp = useMemo(() => {
    const text =
      `Hello ABLEBIZ, I downloaded your checklist: ${checklist.title}.\n\n` +
      `Name: ${name || "-"}\n` +
      `Phone: ${phone || "-"}\n` +
      `Email: ${email || "-"}\n` +
      `Service Interest: ${interest || "-"}\n\n` +
      `Please guide me on the next steps.`;
    return buildWhatsAppLink(text);
  }, [checklist.title, name, phone, email, interest]);

  const saveLead = () => {
    try {
      const key = "ablebiz_leads";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as any[];
      existing.unshift({
        type: "checklist_download",
        checklistId: checklist.id,
        checklistTitle: checklist.title,
        name,
        email,
        phone,
        interest,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch {
      // ignore
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saveLead();
    downloadChecklistPdf(checklist);
    if (sendToWhatsApp) window.open(whatsapp, "_blank", "noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl">
        <Card className="shadow-xl">
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
                  Download checklist
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {checklist.title}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-emerald-100 hover:bg-emerald-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={submit} className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Name
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Your full name"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Phone
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="e.g., 0816..."
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="hello@..."
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Service Interest
                  <select
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.title}>
                        {s.title}
                      </option>
                    ))}
                    <option value="Custom / Not sure">Custom / Not sure</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={sendToWhatsApp}
                  onChange={(e) => setSendToWhatsApp(e.target.checked)}
                  className="h-4 w-4 rounded border-emerald-300"
                />
                Also send my details to WhatsApp (fast response)
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit">Download PDF</Button>
                {sendToWhatsApp ? (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
                  >
                    Preview WhatsApp message
                  </a>
                ) : null}
              </div>

              <div className="rounded-2xl bg-emerald-50 p-4 text-xs text-slate-700 ring-1 ring-emerald-100">
                We use this info only to respond faster to your request. No spam.
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
