import { useEffect, useMemo, useState } from "react";
import { buildWhatsAppLink, site } from "../content/site";
import { services } from "../content/services";
import { Button } from "./ui/Button";
import { Card, CardBody } from "./ui/Card";

type PreferredContact = "WhatsApp" | "Phone Call" | "Email";

type Props = {
  defaultServiceId?: string;
  source?: string;
  title?: string;
  subtitle?: string;
};

const urgencyOptions = [
  "ASAP (today)",
  "Within 24–48 hours",
  "This week",
  "Not urgent",
] as const;

const budgetOptions = [
  "Not sure yet",
  "Under ₦25,000",
  "₦25,000 – ₦50,000",
  "₦50,000 – ₦100,000",
  "₦100,000+",
] as const;

const reminderTopics = [
  "CAC annual returns / post-incorporation",
  "SCUML / compliance follow-up",
  "Trademark / business name protection",
  "General compliance & renewals",
] as const;

export function ConsultationForm({
  defaultServiceId,
  source,
  title = "Request a Consultation",
  subtitle = "Answer a few questions so we can respond faster with the right steps and a clear quote.",
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNeeded, setServiceNeeded] = useState<string>(
    services[0]?.title ?? ""
  );
  const [preferredContact, setPreferredContact] = useState<PreferredContact>(
    "WhatsApp"
  );
  const [urgency, setUrgency] = useState<(typeof urgencyOptions)[number]>(
    urgencyOptions[1]
  );
  const [budgetRange, setBudgetRange] = useState<(typeof budgetOptions)[number]>(
    budgetOptions[0]
  );
  const [message, setMessage] = useState("");

  const [wantsReminders, setWantsReminders] = useState(false);
  const [selectedReminderTopics, setSelectedReminderTopics] = useState<string[]>([
    reminderTopics[0],
  ]);

  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleReminderTopic = (topic: string) => {
    setSelectedReminderTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };
 
  useEffect(() => {
    if (!defaultServiceId) return;
    const found = services.find((s) => s.id === defaultServiceId);
    if (found) setServiceNeeded(found.title);
  }, [defaultServiceId]);

  const summaryText = useMemo(() => {
    return (
      `Hello ABLEBIZ, I want to request a consultation.\n\n` +
      `Name: ${name || "-"}\n` +
      `Phone: ${phone || "-"}\n` +
      `Email: ${email || "-"}\n` +
      `Service Needed: ${serviceNeeded || "-"}\n` +
      `Preferred Contact: ${preferredContact || "-"}\n` +
      `Urgency: ${urgency || "-"}\n` +
      `Budget Range: ${budgetRange || "-"}\n` +
      `Compliance reminders: ${wantsReminders ? "Yes" : "No"}\n` +
      (wantsReminders
        ? `Reminder topics: ${selectedReminderTopics.length ? selectedReminderTopics.join(", ") : "-"}\n`
        : "") +
      (source ? `Source: ${source}\n` : "") +
      `\nMessage: ${message || "-"}`
    );
  }, [
    name,
    phone,
    email,
    serviceNeeded,
    preferredContact,
    urgency,
    budgetRange,
    wantsReminders,
    selectedReminderTopics,
    message,
    source,
  ]);

  const whatsapp = useMemo(() => buildWhatsAppLink(summaryText), [summaryText]);

  const mailto = useMemo(() => {
    const subject = encodeURIComponent(`Consultation Request – ${serviceNeeded}`);
    const body = encodeURIComponent(summaryText);
    return `mailto:${site.email}?subject=${subject}&body=${body}`;
  }, [serviceNeeded, summaryText]);

  const saveLead = () => {
    try {
      const key = "ablebiz_leads";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as any[];
      existing.unshift({
        type: "consultation_request",
        name,
        phone,
        email,
        serviceNeeded,
        preferredContact,
        urgency,
        budgetRange,
        wantsReminders,
        reminderTopics: wantsReminders ? selectedReminderTopics : [],
        message,
        source,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
    } catch {
      // ignore
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saveLead();

    if (preferredContact === "WhatsApp") {
      window.open(whatsapp, "_blank", "noreferrer");
    } else if (preferredContact === "Email") {
      window.open(mailto, "_blank", "noreferrer");
    } else {
      window.open(`tel:${site.phone}`, "_blank", "noreferrer");
    }

    setSent(true);
  };

  return (
    <Card>
      <CardBody>
        <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
          {title}
        </div>
        <p className="mt-2 text-sm text-slate-700">{subtitle}</p>

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
              Service Needed
              <select
                value={serviceNeeded}
                onChange={(e) => setServiceNeeded(e.target.value)}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Preferred Contact Method
              <select
                value={preferredContact}
                onChange={(e) => setPreferredContact(e.target.value as PreferredContact)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Email">Email</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Urgency
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {urgencyOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Budget Range
            <select
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value as any)}
              className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {budgetOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={wantsReminders}
                onChange={(e) => {
                  const v = e.target.checked;
                  setWantsReminders(v);
                  if (v && selectedReminderTopics.length === 0) {
                    setSelectedReminderTopics([reminderTopics[0]]);
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300"
              />
              <span>
                <span className="font-extrabold text-[color:var(--ablebiz-primary)]">
                  Compliance reminders (optional)
                </span>
                <span className="mt-0.5 block text-xs font-medium text-slate-600">
                  After registration, we can remind you about annual returns, renewals and key compliance steps.
                </span>
              </span>
            </label>

            {wantsReminders ? (
              <div className="mt-3 grid gap-2">
                <div className="text-xs font-bold text-slate-700">What should we remind you about?</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {reminderTopics.map((t) => (
                    <label
                      key={t}
                      className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-emerald-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedReminderTopics.includes(t)}
                        onChange={() => toggleReminderTopic(t)}
                        className="mt-0.5 h-4 w-4 rounded border-emerald-300"
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
                <div className="text-[11px] text-slate-600">
                  We’ll use your preferred contact method. You can opt out anytime.
                </div>
              </div>
            ) : null}
          </div>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Message (optional)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-28 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Tell us what you want to register, any deadlines, and any questions you have."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">
              {preferredContact === "WhatsApp"
                ? "Request via WhatsApp"
                : preferredContact === "Email"
                  ? "Request via Email"
                  : "Request a Call"}
            </Button>

            <button
              type="button"
              onClick={copySummary}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
            >
              {copied ? "Copied" : "Copy request details"}
            </button>
          </div>

          {sent ? (
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700 ring-1 ring-emerald-100">
              Your request is ready. If the new tab didn’t open, you can copy the details and send them via WhatsApp or email.
            </div>
          ) : null}

          <div className="rounded-2xl bg-white/70 p-4 text-xs text-slate-700 ring-1 ring-emerald-100">
            Conversion boosters: Trusted CAC Agent • Fast & Transparent Process • Physical Office Available • Award-Winning Business.
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
