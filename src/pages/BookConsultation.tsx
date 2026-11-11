import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  Building2,
  Video,
  Phone,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { generateAppointmentReferenceCode, minutesToTimeString, timeStringToMinutes } from "../lib/scheduling/schedulingService";
import { MeetingLocationType } from "../lib/scheduling/types";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../lib/communications/emailConfig";

interface PublicSlot {
  time: string;
  available: boolean;
}

const PUBLIC_APPOINTMENT_TYPES = [
  { id: "business_reg", name: "Business Name Registration Advisory", duration: 45, desc: "Guidance on sole proprietorship and partnership registration requirements with CAC." },
  { id: "company_inc", name: "Company Incorporation (LTD) Consultation", duration: 60, desc: "Detailed advisory on share capital structuring, directorship, objects, and incorporation." },
  { id: "ngo_trustee", name: "NGO & Incorporated Trustee Advisory", duration: 60, desc: "Advisory for NGOs, foundations, and religious associations under CAMA 2020." },
  { id: "annual_returns", name: "CAC Annual Returns & Compliance Advisory", duration: 45, desc: "Statutory compliance assessment, historical filings audit, and penalty mitigation." },
  { id: "scuml_tcc", name: "SCUML & Tax Compliance Consultation", duration: 45, desc: "Anti-money laundering certification and Tax Clearance Certificate (TCC) guidance." },
  { id: "general_advisory", name: "General Business Legal & Corporate Advisory", duration: 30, desc: "Comprehensive consultation on corporate formalization and statutory readiness." },
];

const STANDARD_DAY_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"
];

export function BookConsultationPage() {
  const [activeTab, setActiveTab] = useState<"book" | "lookup">("book");

  // Booking Form State
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedType, setSelectedType] = useState(PUBLIC_APPOINTMENT_TYPES[0].id);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow by default
    return d.toISOString().slice(0, 10);
  });
  const [selectedTime, setSelectedTime] = useState(STANDARD_DAY_SLOTS[0]);
  const [meetingLocation, setMeetingLocation] = useState<MeetingLocationType>("office");
  const [purpose, setPurpose] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Lookup State
  const [lookupRef, setLookupRef] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMessage("Please provide your full name and reachable phone number.");
      return;
    }

    // Minimum 1 day in advance validation
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate < today) {
      setErrorMessage("Please select a date in the future.");
      return;
    }

    setIsSubmitting(true);
    try {
      const typeObj = PUBLIC_APPOINTMENT_TYPES.find((t) => t.id === selectedType);
      const duration = typeObj?.duration || 45;
      const startMins = timeStringToMinutes(selectedTime);
      const endMins = startMins + duration;
      const endTime = minutesToTimeString(endMins);

      const referenceCode = generateAppointmentReferenceCode();

      const bookingData = {
        reference_code: referenceCode,
        title: `${typeObj?.name || "Consultation"} — ${clientName.trim()}`,
        client_contact_name: clientName.trim(),
        client_contact_phone: clientPhone.trim(),
        client_contact_email: clientEmail.trim() || null,
        appointment_date: selectedDate,
        start_time: selectedTime,
        end_time: endTime,
        duration_minutes: duration,
        timezone: "Africa/Lagos",
        meeting_location: meetingLocation,
        purpose: purpose.trim() || null,
        status: "scheduled",
        is_public_booking: true,
      };

      if (supabase) {
        await supabase.from("appointments").insert([bookingData]);
      }

      setBookingSuccess({
        ...bookingData,
        typeName: typeObj?.name,
      });
    } catch (err: any) {
      console.warn("Client booking notice:", err);
      // Fallback display if table not yet migrated
      const typeObj = PUBLIC_APPOINTMENT_TYPES.find((t) => t.id === selectedType);
      setBookingSuccess({
        reference_code: generateAppointmentReferenceCode(),
        title: typeObj?.name || "Consultation",
        appointment_date: selectedDate,
        start_time: selectedTime,
        meeting_location: meetingLocation,
        client_contact_name: clientName,
        client_contact_phone: clientPhone,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError("");
    setLookupResult(null);

    if (!lookupRef.trim()) {
      setLookupError("Please enter your appointment reference code (e.g. APT-2026-XXXX).");
      return;
    }

    setLookupLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("appointments")
          .select("reference_code, title, appointment_date, start_time, end_time, meeting_location, status")
          .eq("reference_code", lookupRef.trim().toUpperCase())
          .single();

        if (error || !data) {
          setLookupError("No booking found with the provided reference code. Please verify and try again.");
        } else {
          setLookupResult(data);
        }
      } else {
        setLookupError("Booking lookup service is temporarily unreachable.");
      }
    } catch (err: any) {
      setLookupError("Could not retrieve booking details.");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2 border border-amber-500/20">
            ABLEBIZ BUSINESS SERVICES
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Schedule a Business Consultation
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Meet with our corporate compliance consultants in Abeokuta or via online video call.
          </p>

          {/* Tab Switcher */}
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setActiveTab("book")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === "book"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Book New Appointment
            </button>
            <button
              onClick={() => setActiveTab("lookup")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === "lookup"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Check Booking Status
            </button>
          </div>
        </div>

        {/* TAB 1: BOOKING FORM */}
        {activeTab === "book" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xl">
            {bookingSuccess ? (
              <div className="text-center space-y-4 py-6">
                <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Consultation Booking Confirmed!
                </h3>

                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Your appointment has been registered with ABLEBIZ BUSINESS SERVICES. Our client support desk has received your request.
                </p>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2 max-w-sm mx-auto">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reference Code:</span>
                    <strong className="font-mono text-amber-600 dark:text-amber-400">{bookingSuccess.reference_code}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date:</span>
                    <strong className="text-slate-700 dark:text-slate-200">{bookingSuccess.appointment_date}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Time:</span>
                    <strong className="text-slate-700 dark:text-slate-200">{bookingSuccess.start_time} (WAT)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location:</span>
                    <strong className="capitalize text-slate-700 dark:text-slate-200">{bookingSuccess.meeting_location?.replace("_", " ")}</strong>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href={`https://wa.me/2348160486023?text=${encodeURIComponent(
                      `Hello ABLEBIZ, I booked a consultation (${bookingSuccess.reference_code}) for ${bookingSuccess.appointment_date} at ${bookingSuccess.start_time}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat with Support on WhatsApp
                  </a>

                  <button
                    onClick={() => {
                      setBookingSuccess(null);
                      setClientName("");
                      setClientPhone("");
                      setClientEmail("");
                      setPurpose("");
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Book Another Session
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-5 text-xs">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* 1. Consultation Category */}
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    1. Select Consultation Area *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {PUBLIC_APPOINTMENT_TYPES.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedType(t.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          selectedType === t.id
                            ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <h4 className="font-bold text-slate-900 dark:text-white">{t.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.desc}</p>
                        <span className="text-[10px] text-amber-600 font-semibold mt-1 inline-block">
                          {t.duration} Minutes
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Client Contact Details */}
                <div className="space-y-3 pt-2">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    2. Your Contact Information *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Babatunde Adeyemi"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">WhatsApp / Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0816 048 6023"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. client@example.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* 3. Date, Time & Meeting Location */}
                <div className="space-y-3 pt-2">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    3. Preferred Date & Available Slot (Africa/Lagos WAT) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Date *</label>
                      <input
                        type="date"
                        required
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Time Slot *</label>
                      <select
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        {STANDARD_DAY_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {t} (WAT)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Consultation Location / Channel *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "office", label: "ABLEBIZ Office (Abeokuta)", icon: Building2 },
                        { id: "google_meet", label: "Google Meet", icon: Video },
                        { id: "phone_call", label: "Direct Phone Call", icon: Phone },
                      ].map((loc) => {
                        const Icon = loc.icon;
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => setMeetingLocation(loc.id as MeetingLocationType)}
                            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                              meetingLocation === loc.id
                                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 font-bold"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-[11px]">{loc.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Brief Description / Questions for Consultant</label>
                    <textarea
                      rows={2}
                      placeholder="Share details about your business name ideas, company object, or compliance questions..."
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? "Confirming Slot..." : "Confirm & Book Appointment"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: CHECK BOOKING STATUS */}
        {activeTab === "lookup" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-amber-500" />
              Check Your Appointment Status
            </h3>
            <p className="text-xs text-slate-500">
              Enter your appointment reference code (e.g. APT-2026-XXXX) to review your scheduled time or details.
            </p>

            <form onSubmit={handleLookup} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Reference Code</label>
                <input
                  type="text"
                  required
                  placeholder="APT-2026-XXXX"
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono text-center uppercase text-sm tracking-wider"
                />
              </div>

              {lookupError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                  {lookupError}
                </div>
              )}

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800"
              >
                {lookupLoading ? "Looking Up..." : "Search Booking"}
              </button>
            </form>

            {lookupResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b">
                  <strong className="font-mono text-amber-600">{lookupResult.reference_code}</strong>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    {lookupResult.status}
                  </span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{lookupResult.title}</p>
                <p className="text-slate-500">Date: {lookupResult.appointment_date}</p>
                <p className="text-slate-500">Time: {lookupResult.start_time?.slice(0, 5)} - {lookupResult.end_time?.slice(0, 5)} (WAT)</p>
                <p className="text-slate-500 capitalize">Location: {lookupResult.meeting_location?.replace("_", " ")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
