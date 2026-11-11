import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Star,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export function ClientFeedbackPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const initialClientName = searchParams.get("name") || "";
  const initialService = searchParams.get("service") || "";

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [professionalismRating, setProfessionalismRating] = useState<number>(5);
  const [timelinessRating, setTimelinessRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [recommendationScore, setRecommendationScore] = useState<number>(10);
  const [comments, setComments] = useState("");
  const [clientName, setClientName] = useState(initialClientName);
  const [clientPhone, setClientPhone] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (rating < 1 || rating > 5) {
      setErrorMessage("Please select a satisfaction rating between 1 and 5 stars.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        rating,
        professionalism_rating: professionalismRating,
        timeliness_rating: timelinessRating,
        communication_rating: communicationRating,
        recommendation_score: recommendationScore,
        comments: comments.trim() || null,
        client_name: clientName.trim() || null,
        client_phone: clientPhone.trim() || null,
        source: "in_suite_survey" as const,
        submission_token: token || `token-${Date.now()}`,
        status: "published" as const,
        is_verified: true,
      };

      if (supabase) {
        await supabase.from("client_feedback").insert([payload]);
      }

      setSubmitted(true);
    } catch (err: any) {
      console.warn("Feedback submission notice:", err);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2 border border-amber-500/20">
            <Sparkles className="h-3 w-3" />
            ABLEBIZ CLIENT EXPERIENCE
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            We Value Your Feedback
          </h1>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Your feedback helps us continuously improve our business registration and compliance advisory services.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xl">
          {submitted ? (
            <div className="text-center space-y-4 py-8">
              <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Thank You for Your Feedback!
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Your comments have been registered with ABLEBIZ BUSINESS SERVICES management. We appreciate your partnership!
              </p>
              <div className="pt-4">
                <a
                  href="/"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs inline-block hover:bg-slate-800 transition"
                >
                  Return to Homepage
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 text-xs">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Overall Satisfaction */}
              <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Overall, how satisfied are you with our service? *
                </label>
                <div className="flex items-center justify-center gap-2 my-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(star)}
                      className="p-1 text-slate-300 hover:scale-110 transition-transform focus:outline-none"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          (hoverRating !== null ? star <= hoverRating : star <= rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 dark:text-slate-700"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {rating === 5
                    ? "Excellent (5/5)"
                    : rating === 4
                    ? "Very Good (4/5)"
                    : rating === 3
                    ? "Good (3/5)"
                    : rating === 2
                    ? "Fair (2/5)"
                    : "Poor (1/5)"}
                </span>
              </div>

              {/* 2. Specific Dimension Ratings */}
              <div className="space-y-3 pt-2">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Detailed Service Experience
                </label>

                {/* Professionalism */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Staff Professionalism</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setProfessionalismRating(s)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          professionalismRating === s
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeliness */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Turnaround Timeliness</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTimelinessRating(s)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          timelinessRating === s
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Communication */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Clear Communication</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setCommunicationRating(s)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          communicationRating === s
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Recommendation Score (1-10) */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  How likely are you to recommend ABLEBIZ to other business owners? (1-10)
                </label>
                <div className="flex items-center justify-between gap-1 mt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setRecommendationScore(score)}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition ${
                        recommendationScore === score
                          ? score >= 9
                            ? "bg-emerald-600 text-white"
                            : score >= 7
                            ? "bg-amber-500 text-white"
                            : "bg-rose-500 text-white"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>1 = Not at all likely</span>
                  <span>10 = Extremely likely</span>
                </div>
              </div>

              {/* 4. Comments */}
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  What went well, or what could we improve?
                </label>
                <textarea
                  rows={3}
                  placeholder="Share any comments or suggestions for our team..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Optional Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-500 mb-1">Your Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Chief Adeleke"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Phone / WhatsApp (Optional)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0803 123 4567"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Submitting Your Feedback..." : "Submit Feedback"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
