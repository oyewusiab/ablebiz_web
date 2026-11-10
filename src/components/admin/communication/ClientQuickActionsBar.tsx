import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  FileQuestion,
  History,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { useAuth } from "../../../auth/AuthContext";
import { canSendCommunication } from "../../../lib/communications/communicationPermissions";
import {
  assessClientContactQuality,
  buildTelLink,
} from "../../../lib/communications/contactUtils";
import { recordCommunicationActivity } from "../../../lib/communications/communicationStorage";
import type {
  ClientContactContext,
  CommunicationActionIntent,
  CommunicationChannel,
  CommunicationLogRecord,
  WorkflowContextType,
} from "../../../lib/communications/types";
import { CommunicationComposerModal } from "./CommunicationComposerModal";

export interface ClientQuickActionsBarProps {
  contactContext: ClientContactContext;
  workflowContext?: WorkflowContextType;
  compact?: boolean;
  onViewHistory?: () => void;
  onCommunicationLogged?: (record: CommunicationLogRecord) => void;
  onContactUpdated?: (updated: {
    phone: string;
    altPhone?: string | null;
    email?: string | null;
  }) => void;
}

export const ClientQuickActionsBar: React.FC<ClientQuickActionsBarProps> = ({
  contactContext,
  workflowContext = "client_360",
  compact = false,
  onViewHistory,
  onCommunicationLogged,
  onContactUpdated,
}) => {
  const { user, profile } = useAuth();
  const staffRole = profile?.role || user?.role || "viewer";
  const staffFullName = profile?.full_name || user?.name || "ABLEBIZ Officer";
  const canSend = canSendCommunication(staffRole);

  const [composerOpen, setComposerOpen] = useState(false);
  const [activeIntent, setActiveIntent] =
    useState<CommunicationActionIntent | null>(null);
  const [activeChannel, setActiveChannel] = useState<
    CommunicationChannel | undefined
  >(undefined);
  const [phoneFeedback, setPhoneFeedback] = useState<string | null>(null);

  const contactQuality = assessClientContactQuality({
    clientName: contactContext.clientName,
    phone: contactContext.phone,
    altPhone: contactContext.whatsappPhone || contactContext.altPhone,
    email: contactContext.email,
    businessName: contactContext.businessName,
    contactPerson: contactContext.contactPerson,
  });

  const openComposerWithIntent = (
    intent: CommunicationActionIntent,
    channel?: CommunicationChannel
  ) => {
    setActiveIntent(intent);
    setActiveChannel(channel);
    setComposerOpen(true);
  };

  const handleDirectCall = async () => {
    const tel = buildTelLink(
      contactContext.phone || contactContext.whatsappPhone
    );
    if (!tel.valid || !tel.href) {
      setPhoneFeedback(
        tel.error ||
          "Phone number is missing or invalid. Click 'Send Prepared Message' -> 'Update Contact Info' to add a valid phone number."
      );
      setTimeout(() => setPhoneFeedback(null), 5000);
      return;
    }

    window.location.href = tel.href;

    if (canSend && user?.id) {
      const logged = await recordCommunicationActivity({
        clientId: contactContext.clientId,
        leadId: contactContext.leadId,
        businessId: contactContext.businessId,
        serviceRequestId: contactContext.serviceRequestId,
        cacApplicationId: contactContext.cacApplicationId,
        invoiceId: contactContext.invoiceId,
        paymentId: contactContext.paymentId,
        staffId: user.id,
        staffName: staffFullName,
        staffRole: staffRole,
        channel: "phone_call",
        direction: "outbound",
        status: "opened_in_phone",
        summary: `Phone call initiated to ${contactContext.clientName} (${tel.formattedPhone.displayInternational})`,
        messageBody: `Telephone call initiated via tel: link to ${tel.formattedPhone.displayInternational}`,
        recipientName: contactContext.clientName,
        recipientPhone: tel.formattedPhone.e164,
      });
      if (logged.record) {
        onCommunicationLogged?.(logged.record);
      }
    }
  };

  const isCacApproved =
    ["approved", "documents_received", "completed", "delivered_to_client"].includes(
      (contactContext.cacStage || "").toLowerCase()
    ) ||
    Boolean(contactContext.cacApprovalDate) ||
    Boolean(contactContext.cacCertificateNumber);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. Call Client */}
        <button
          type="button"
          onClick={handleDirectCall}
          title={
            contactQuality.phone.isValid
              ? `Call ${contactQuality.phone.displayInternational}`
              : "Phone number missing or invalid"
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Phone className="h-3.5 w-3.5 text-emerald-400" />
          <span>Call Client</span>
          {contactQuality.phone.isValid && !compact && (
            <span className="text-[11px] text-slate-300 font-normal">
              ({contactQuality.phone.displayLocal})
            </span>
          )}
        </button>

        {/* 2. WhatsApp Client */}
        {canSend && (
          <button
            type="button"
            onClick={() =>
              openComposerWithIntent("send_prepared_message", "whatsapp")
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>WhatsApp Client</span>
          </button>
        )}

        {/* 3. Email Client */}
        {canSend && (
          <button
            type="button"
            onClick={() =>
              openComposerWithIntent("send_prepared_message", "email")
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email Client</span>
          </button>
        )}

        {/* 4. Send Prepared Message */}
        {canSend && !compact && (
          <button
            type="button"
            onClick={() => openComposerWithIntent("send_prepared_message")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Prepared Messages</span>
          </button>
        )}

        {/* Contextual Workflow Shortcuts */}
        {canSend &&
          (workflowContext === "client_360" ||
            workflowContext === "service_request" ||
            workflowContext === "cac_operations") && (
            <>
              <button
                type="button"
                onClick={() => openComposerWithIntent("request_information")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <FileQuestion className="h-3.5 w-3.5 text-amber-600" />
                <span>Request Info / Docs</span>
              </button>

              <button
                type="button"
                onClick={() => openComposerWithIntent("send_service_update")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Send className="h-3.5 w-3.5 text-blue-600" />
                <span>Send Service Update</span>
              </button>

              <button
                type="button"
                onClick={() => openComposerWithIntent("send_document_delivery")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-colors"
              >
                <FileCheck className="h-3.5 w-3.5 text-purple-600" />
                <span>Document Delivery</span>
              </button>
            </>
          )}

        {canSend && workflowContext === "cac_operations" && (
          <>
            <button
              type="button"
              onClick={() =>
                openComposerWithIntent("send_registration_requirements")
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 transition-colors"
            >
              <ClipboardList className="h-3.5 w-3.5 text-slate-700" />
              <span>BN Requirements</span>
            </button>

            {isCacApproved && (
              <button
                type="button"
                onClick={() =>
                  openComposerWithIntent("send_congratulations", "whatsapp")
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Send Congratulations</span>
              </button>
            )}
          </>
        )}

        {canSend && workflowContext === "finance" && (
          <>
            <button
              type="button"
              onClick={() =>
                openComposerWithIntent("send_invoice_notification", "email")
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <Receipt className="h-3.5 w-3.5 text-blue-600" />
              <span>Send Invoice</span>
            </button>
            <button
              type="button"
              onClick={() =>
                openComposerWithIntent("send_payment_reminder", "whatsapp")
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Payment Reminder</span>
            </button>
            {contactContext.isPaymentVerified && (
              <button
                type="button"
                onClick={() =>
                  openComposerWithIntent("send_payment_confirmation", "whatsapp")
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Confirm Payment</span>
              </button>
            )}
          </>
        )}

        {canSend && !compact && (
          <button
            type="button"
            onClick={() => openComposerWithIntent("send_feedback_request")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Star className="h-3.5 w-3.5 text-amber-500" />
            <span>Feedback Request</span>
          </button>
        )}

        {onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>History</span>
          </button>
        )}
      </div>

      {phoneFeedback && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{phoneFeedback}</span>
        </div>
      )}

      <CommunicationComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        contactContext={contactContext}
        workflowContext={workflowContext}
        initialIntent={activeIntent}
        initialChannel={activeChannel}
        onCommunicationLogged={onCommunicationLogged}
        onContactUpdated={onContactUpdated}
      />
    </div>
  );
};
