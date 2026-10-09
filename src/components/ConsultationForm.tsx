import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { buildWhatsAppLink, site } from "../content/site";
import { useSiteConfig } from "../referrals/siteConfig";
import { rpcCreateConsultationRequest } from "../lib/supabaseApi";
import { Card, CardBody } from "./ui/Card";
import { Button } from "./ui/Button";

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
  "Tax clearance & TIN compliance",
  "Trademark / business name protection",
  "General compliance & renewals",
] as const;

export function ConsultationForm({
  defaultServiceId,
  source,
  title = "Request a Consultation",
  subtitle = "Answer a few questions so we can respond faster with the right steps and a clear quote.",
}: Props) {
  const { services } = useSiteConfig();
  const location = useLocation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNeeded, setServiceNeeded] = useState<string>(
    services[0]?.title ?? "CAC Business Name Registration"
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
  const [referralCode, setReferralCode] = useState("");

  const [wantsReminders, setWantsReminders] = useState(false);
  const [selectedReminderTopics, setSelectedReminderTopics] = useState<string[]>([
    reminderTopics[0],
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [generatedRefCode, setGeneratedRefCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleReminderTopic = (topic: string) => {
    setSelectedReminderTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };
 
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const code = sessionStorage.getItem("ablebiz_referral_code");
        if (code) setReferralCode(code);
      } catch {
        // ignore
      }
    }

    if (!defaultServiceId) return;
    const found = services.find((s) => s.id === defaultServiceId);
    if (found) setServiceNeeded(found.title);
  }, [defaultServiceId, services]);

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
      (referralCode ? `Referral Code: ${referralCode}\n` : "") +
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
    referralCode,
    source,
  ]);

  const whatsapp = useMemo(() => buildWhatsAppLink(summaryText), [summaryText]);

  const mailto = useMemo(() => {
    const subject = encodeURIComponent(`Consultation Request – ${serviceNeeded}`);
    const body = encodeURIComponent(summaryText);
    return `mailto:${site.email}?subject=${subject}&body=${body}`;
  }, [serviceNeeded, summaryText]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const mapUrgencyToEnum = (u: string): 'today' | 'this_week' | 'this_month' | 'just_info' => {
    if (u === "ASAP (today)") return 'today';
    if (u === "Within 24–48 hours" || u === "This week") return 'this_week';
    return 'just_info';
  };

  const mapBudgetToEnum = (b: string): 'under_25k' | '25k_40k' | '50k_80k' | '100k_plus' | 'not_sure' => {
    if (b === "Under ₦25,000") return 'under_25k';
    if (b === "₦25,000 – ₦50,000") return '25k_40k';
    if (b === "₦50,000 – ₦100,000") return '50k_80k';
    if (b === "₦100,000+") return '100k_plus';
    return 'not_sure';
  };

  const mapReminderTopicsToEnum = (topics: string[]): Array<'annual_returns' | 'tax' | 'trademark' | 'bpp_nsitf' | 'ngo_returns' | 'general_compliance'> => {
    const list: Array<'annual_returns' | 'tax' | 'trademark' | 'bpp_nsitf' | 'ngo_returns' | 'general_compliance'> = [];
    for (const t of topics) {
      if (t.includes('annual returns')) list.push('annual_returns');
      else if (t.includes('Tax')) list.push('tax');
      else if (t.includes('Trademark')) list.push('trademark');
      else list.push('general_compliance');
    }
    return list;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim()) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    // Extract UTM parameters if present
    const searchParams = new URLSearchParams(location.search);
    const utmSource = searchParams.get('utm_source') || undefined;
    const utmMedium = searchParams.get('utm_medium') || undefined;
    const utmCampaign = searchParams.get('utm_campaign') || undefined;

    try {
      // 1. Authoritative submission into Supabase Suite database
      const result = await rpcCreateConsultationRequest({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        serviceNeeded: serviceNeeded.trim(),
        preferredContactMethod: preferredContact === "WhatsApp" ? "whatsapp" : preferredContact === "Email" ? "email" : "phone",
        urgency: mapUrgencyToEnum(urgency),
        budget: mapBudgetToEnum(budgetRange),
        message: message.trim() || undefined,
        remindersOptIn: wantsReminders,
        reminderTopics: wantsReminders ? mapReminderTopicsToEnum(selectedReminderTopics) : [],
        referredBy: referralCode.trim() || undefined,
        consentMarketing: true,
        pagePath: location.pathname,
        utmSource,
        utmMedium,
        utmCampaign,
      });

      if (result?.referral_code) {
        setGeneratedRefCode(result.referral_code);
      }

      setSubmissionSuccess(true);
    } catch (err: any) {
      console.error("[ConsultationForm] Submission failed:", err);
      setSubmissionError(
        err?.message || "Your request could not be submitted right now. Please try again or contact us directly on WhatsApp."
      );
    } finally {
      setIsSubmitting(false);
    }
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
            <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
                placeholder="Your full name"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Phone
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
                placeholder="e.g., 0816..."
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
                placeholder="hello@..."
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Service Needed
              <select
                value={serviceNeeded}
                onChange={(e) => setServiceNeeded(e.target.value)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
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
            <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Preferred Contact Method
              <select
                value={preferredContact}
                onChange={(e) => setPreferredContact(e.target.value as PreferredContact)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Email">Email</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Urgency
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
              >
                {urgencyOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Budget Range
            <select
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value as any)}
              className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
            >
              {budgetOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl bg-blue-50/60 p-4 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900">
            <label className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
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
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="font-extrabold text-[color:var(--ablebiz-primary)] dark:text-blue-300">
                  Compliance reminders (optional)
                </span>
                <span className="mt-0.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  After registration, we can remind you about annual returns, renewals and key compliance steps.
                </span>
              </span>
            </label>

            {wantsReminders ? (
              <div className="mt-3 grid gap-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">What should we remind you about?</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {reminderTopics.map((t) => (
                    <label
                      key={t}
                      className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedReminderTopics.includes(t)}
                        onChange={() => toggleReminderTopic(t)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  We’ll use your preferred contact method. You can opt out anytime.
                </div>
              </div>
            ) : null}
          </div>

          <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Message (optional)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-28 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
              placeholder="Tell us what you want to register, any deadlines, and any questions you have."
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Referral Code (optional)
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
              placeholder="If you were referred, enter the code here"
            />
          </label>

          {submissionError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Submission Notice</div>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">{submissionError}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Contact via WhatsApp Directly
                  </a>
                </div>
              </div>
            </div>
          )}

          {submissionSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                  Thank you! Your request has been received.
                </span>
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                A member of the ABLEBIZ team has received your submission and will contact you shortly via <strong>{preferredContact}</strong>.
              </p>
              {generatedRefCode && (
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-emerald-200 dark:border-emerald-800 text-xs">
                  Your Referral Code: <strong className="font-mono text-emerald-700 dark:text-emerald-400">{generatedRefCode}</strong>
                </div>
              )}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-sm hover:from-amber-600 hover:to-amber-700 transition"
                >
                  <MessageCircle className="h-4 w-4" /> Continue on WhatsApp
                </a>
                <button
                  type="button"
                  onClick={copySummary}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-[color:var(--ablebiz-primary)] hover:underline dark:text-amber-400"
                >
                  {copied ? "Copied" : "Copy request details"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                  </span>
                ) : preferredContact === "WhatsApp"
                  ? "Submit & Continue on WhatsApp"
                  : preferredContact === "Email"
                    ? "Submit Consultation Request"
                    : "Request a Call"}
              </Button>

              <button
                type="button"
                onClick={copySummary}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ablebiz-primary)] hover:underline dark:text-amber-400"
              >
                {copied ? "Copied" : "Copy request details"}
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
            Conversion boosters: Trusted CAC Agent • Fast & Transparent Process • Physical Office Available • Award-Winning Business.
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

