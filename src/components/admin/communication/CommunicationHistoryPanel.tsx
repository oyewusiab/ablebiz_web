import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../../../auth/AuthContext";
import { canSendCommunication } from "../../../lib/communications/communicationPermissions";
import {
  loadCommunicationsHistory,
  updateCommunicationStatusAndOutcome,
} from "../../../lib/communications/communicationStorage";
import type {
  CommunicationChannel,
  CommunicationLogRecord,
  CommunicationStatus,
} from "../../../lib/communications/types";

export interface CommunicationHistoryPanelProps {
  clientId?: string | null;
  serviceRequestId?: string | null;
  cacApplicationId?: string | null;
  invoiceId?: string | null;
  leadId?: string | null;
  refreshTrigger?: number;
  maxItems?: number;
}

export function getStatusBadgeStyle(status: CommunicationStatus): {
  label: string;
  classes: string;
} {
  switch (status) {
    case "opened_in_whatsapp":
      return {
        label: "Opened in WhatsApp",
        classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    case "opened_in_email":
      return {
        label: "Opened in Email App",
        classes: "bg-blue-50 text-blue-800 border-blue-200",
      };
    case "opened_in_phone":
      return {
        label: "Dialed in Phone App",
        classes: "bg-slate-100 text-slate-800 border-slate-300",
      };
    case "sent":
      return {
        label: "Sent",
        classes: "bg-emerald-100 text-emerald-900 border-emerald-300",
      };
    case "delivered":
      return {
        label: "Delivered",
        classes: "bg-emerald-100 text-emerald-900 border-emerald-300",
      };
    case "confirmed_by_client":
      return {
        label: "Confirmed by Client",
        classes: "bg-purple-100 text-purple-900 border-purple-300",
      };
    case "failed":
      return {
        label: "Failed",
        classes: "bg-red-100 text-red-800 border-red-200",
      };
    case "prepared":
      return {
        label: "Prepared",
        classes: "bg-amber-50 text-amber-800 border-amber-200",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        classes: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export function getChannelIcon(channel: CommunicationChannel) {
  switch (channel) {
    case "whatsapp":
      return <MessageSquare className="h-4 w-4 text-emerald-600" />;
    case "email":
      return <Mail className="h-4 w-4 text-blue-600" />;
    case "phone_call":
      return <Phone className="h-4 w-4 text-indigo-600" />;
    default:
      return <Users className="h-4 w-4 text-slate-600" />;
  }
}

export const CommunicationHistoryPanel: React.FC<
  CommunicationHistoryPanelProps
> = ({
  clientId,
  serviceRequestId,
  cacApplicationId,
  invoiceId,
  leadId,
  refreshTrigger = 0,
  maxItems = 50,
}) => {
  const { user } = useAuth();
  const canUpdate = canSendCommunication(user?.role);

  const [records, setRecords] = useState<CommunicationLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [clientResponse, setClientResponse] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    const list = await loadCommunicationsHistory({
      clientId,
      serviceRequestId,
      cacApplicationId,
      invoiceId,
      leadId,
      limit: maxItems,
    });
    setRecords(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [
    clientId,
    serviceRequestId,
    cacApplicationId,
    invoiceId,
    leadId,
    refreshTrigger,
  ]);

  const handleUpdateStatus = async (
    rec: CommunicationLogRecord,
    nextStatus: CommunicationStatus
  ) => {
    if (!user?.id) return;
    setSavingId(rec.id);
    const res = await updateCommunicationStatusAndOutcome(
      rec.id,
      {
        status: nextStatus,
        outcomeNotes:
          editingOutcomeId === rec.id ? outcomeNotes : rec.outcome_notes || undefined,
        clientResponse:
          editingOutcomeId === rec.id
            ? clientResponse
            : rec.client_response || undefined,
      },
      { staffId: user.id, role: user.role }
    );
    setSavingId(null);
    if (res.success) {
      setEditingOutcomeId(null);
      await fetchHistory();
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
        Loading communication history...
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
        No communication history recorded for this profile yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((rec) => {
        const badge = getStatusBadgeStyle(rec.status);
        const isExpanded = expandedId === rec.id;
        const isEditingOutcome = editingOutcomeId === rec.id;

        return (
          <div
            key={rec.id}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {getChannelIcon(rec.channel)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {rec.template_name || rec.summary}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                    {rec.service_request?.tracking_code && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-700">
                        SR: {rec.service_request.tracking_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{rec.summary}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(rec.created_at).toLocaleString()}
                    </span>
                    <span>
                      Staff: <strong>{rec.staff?.full_name || "Staff"}</strong>
                    </span>
                    {rec.recipient_phone && (
                      <span>Phone: {rec.recipient_phone}</span>
                    )}
                    {rec.recipient_email && (
                      <span>To: {rec.recipient_email}</span>
                    )}
                    {rec.channel === "email" && rec.sender_email && (
                      <span>From: {rec.sender_email}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {canUpdate &&
                  (rec.status === "opened_in_whatsapp" ||
                    rec.status === "opened_in_email" ||
                    rec.status === "opened_in_phone" ||
                    rec.status === "prepared") && (
                    <button
                      type="button"
                      disabled={savingId === rec.id}
                      onClick={() => handleUpdateStatus(rec, "sent")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Mark Sent
                    </button>
                  )}

                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingOutcome) {
                        setEditingOutcomeId(null);
                      } else {
                        setEditingOutcomeId(rec.id);
                        setOutcomeNotes(rec.outcome_notes || "");
                        setClientResponse(rec.client_response || "");
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <UserCheck className="h-3 w-3" />
                    Log Response
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  {isExpanded ? "Hide" : "Message"}
                </button>
              </div>
            </div>

            {/* Client Response / Outcome Summary */}
            {(rec.outcome_notes || rec.client_response) && !isEditingOutcome && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {rec.outcome_notes && (
                  <div className="bg-slate-50 px-3 py-1.5 rounded-lg text-slate-700">
                    <span className="font-semibold text-slate-900">
                      Outcome:{" "}
                    </span>
                    {rec.outcome_notes}
                  </div>
                )}
                {rec.client_response && (
                  <div className="bg-purple-50 px-3 py-1.5 rounded-lg text-purple-900">
                    <span className="font-semibold">Client Response: </span>
                    {rec.client_response}
                  </div>
                )}
              </div>
            )}

            {/* Outcome Editor */}
            {isEditingOutcome && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 bg-slate-50 p-3 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Delivery / Call Outcome Note
                    </label>
                    <input
                      type="text"
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      placeholder="e.g. Sent on WhatsApp, client acknowledged"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Client Response Summary
                    </label>
                    <input
                      type="text"
                      value={clientResponse}
                      onChange={(e) => setClientResponse(e.target.value)}
                      placeholder="e.g. Promised to send clear ID card by 4pm"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingOutcomeId(null)}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingId === rec.id}
                    onClick={() => handleUpdateStatus(rec, "sent")}
                    className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Save & Mark Sent
                  </button>
                  <button
                    type="button"
                    disabled={savingId === rec.id}
                    onClick={() =>
                      handleUpdateStatus(rec, "confirmed_by_client")
                    }
                    className="px-3 py-1 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Save & Mark Confirmed by Client
                  </button>
                </div>
              </div>
            )}

            {/* Expanded Full Message Body */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                {rec.subject && (
                  <p className="text-xs font-semibold text-slate-800 mb-1.5">
                    Subject: {rec.subject}
                  </p>
                )}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {rec.message_body || rec.details || rec.summary}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
