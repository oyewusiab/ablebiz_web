import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Info,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { useAuth } from "../../../auth/AuthContext";
import { useBusinessProfile } from "../../../lib/businessProfileContext";
import {
  canSendCommunication,
  canUpdateClientContactInfo,
  canUseTemplate,
  checkTemplateVerificationGuard,
} from "../../../lib/communications/communicationPermissions";
import {
  assessClientContactQuality,
  buildMailtoLink,
  buildTelLink,
  buildWhatsAppLink,
} from "../../../lib/communications/contactUtils";
import {
  buildOfficialEmailHtml,
  buildOfficialEmailPlainText,
  OFFICIAL_BUSINESS_EMAIL_CONFIG,
} from "../../../lib/communications/emailConfig";
import { sendOfficialClientEmail } from "../../../lib/communications/emailService";
import {
  loadMessageTemplates,
  recordCommunicationActivity,
  updateClientContactDetails,
  updateCommunicationStatusAndOutcome,
} from "../../../lib/communications/communicationStorage";
import {
  findDefaultTemplateForIntent,
  TEMPLATE_CATEGORIES,
} from "../../../lib/communications/templateCatalogue";
import type {
  ClientContactContext,
  CommunicationActionIntent,
  CommunicationChannel,
  CommunicationLogRecord,
  MessageTemplate,
  TemplateCategoryId,
  WorkflowContextType,
} from "../../../lib/communications/types";
import {
  buildVariableContextFromRecords,
  resolveTemplateVariables,
} from "../../../lib/communications/variableEngine";

export interface CommunicationComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactContext: ClientContactContext;
  workflowContext?: WorkflowContextType;
  initialIntent?: CommunicationActionIntent | null;
  initialChannel?: CommunicationChannel;
  initialTemplateId?: string | null;
  onCommunicationLogged?: (record: CommunicationLogRecord) => void;
  onContactUpdated?: (updated: {
    phone: string;
    altPhone?: string | null;
    email?: string | null;
  }) => void;
}

export const CommunicationComposerModal: React.FC<
  CommunicationComposerModalProps
> = ({
  isOpen,
  onClose,
  contactContext,
  workflowContext = "client_360",
  initialIntent = null,
  initialChannel,
  initialTemplateId = null,
  onCommunicationLogged,
  onContactUpdated,
}) => {
  const { user, profile } = useAuth();
  const { profile: businessProfile, bankAccounts } = useBusinessProfile();

  const staffId = user?.id || "";
  const staffName = profile?.full_name || user?.name || "ABLEBIZ Officer";
  const staffRole = profile?.role || user?.role || "viewer";

  const canSend = canSendCommunication(staffRole);
  const canEditContact = canUpdateClientContactInfo(staffRole);

  // Live contact state (allows inline update without closing modal)
  const [liveContact, setLiveContact] =
    useState<ClientContactContext>(contactContext);

  useEffect(() => {
    setLiveContact(contactContext);
  }, [contactContext]);

  const contactQuality = useMemo(
    () =>
      assessClientContactQuality({
        clientName: liveContact.clientName,
        phone: liveContact.phone,
        altPhone: liveContact.whatsappPhone || liveContact.altPhone,
        email: liveContact.email,
        businessName: liveContact.businessName,
        contactPerson: liveContact.contactPerson,
      }),
    [liveContact]
  );

  // Inline contact editor state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editAltPhone, setEditAltPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [confirmOverwriteVerified, setConfirmOverwriteVerified] =
    useState(false);
  const [contactSaveMsg, setContactSaveMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategoryId | "all"
  >("all");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<MessageTemplate | null>(null);

  // Channel & Message Editor state
  const [channel, setChannel] = useState<CommunicationChannel>("whatsapp");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [hasManuallyEditedBody, setHasManuallyEditedBody] = useState(false);
  const [hasManuallyEditedSubject, setHasManuallyEditedSubject] =
    useState(false);
  const [manualVariableOverrides, setManualVariableOverrides] = useState<
    Record<string, string>
  >({});
  const [ccInput, setCcInput] = useState("");
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");

  // Execution & Post-open feedback state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<{
    type: "success" | "warning" | "error" | "info";
    text: string;
  } | null>(null);
  const [lastLoggedRecord, setLastLoggedRecord] =
    useState<CommunicationLogRecord | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [clientResponseText, setClientResponseText] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Load templates when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    loadMessageTemplates().then((loaded) => {
      if (!mounted) return;
      setTemplates(loaded);

      // Select initial template based on initialTemplateId or initialIntent
      let chosen: MessageTemplate | undefined;
      if (initialTemplateId) {
        chosen = loaded.find(
          (t) => t.id === initialTemplateId || t.slug === initialTemplateId
        );
      }
      if (!chosen && initialIntent) {
        chosen = findDefaultTemplateForIntent(loaded, initialIntent);
      }

      if (chosen && canUseTemplate(staffRole, chosen)) {
        const guardCheck = checkTemplateVerificationGuard(chosen, contactContext);
        if (guardCheck.allowed) {
          setSelectedTemplate(chosen);
          if (!initialChannel) {
            setChannel(chosen.defaultChannel);
          }
        } else {
          setSelectedTemplate(null);
          setBannerAlert({
            type: "warning",
            text:
              guardCheck.reason ||
              "Selected template requires milestone verification before use.",
          });
        }
      } else {
        setSelectedTemplate(null);
      }
    });

    // Determine initial channel
    if (initialChannel) {
      setChannel(initialChannel);
    } else if (initialIntent === "call_client") {
      setChannel("phone_call");
    } else if (initialIntent === "email_client") {
      setChannel("email");
    } else {
      setChannel("whatsapp");
    }

    // Reset state
    setHasManuallyEditedBody(false);
    setHasManuallyEditedSubject(false);
    setManualVariableOverrides({});
    setBannerAlert(null);
    setLastLoggedRecord(null);
    setOutcomeNotes("");
    setClientResponseText("");
    setPreviewMode("edit");
    setIsEditingContact(false);
    setContactSaveMsg(null);

    return () => {
      mounted = false;
    };
  }, [
    isOpen,
    initialTemplateId,
    initialIntent,
    initialChannel,
    staffRole,
    contactContext,
  ]);

  // Build variable context from live records
  const variableContext = useMemo(
    () =>
      buildVariableContextFromRecords(
        liveContact,
        {
          fullName: staffName,
          roleLabel: user?.role?.replace(/_/g, " ") || "Client Services",
        },
        businessProfile,
        bankAccounts
      ),
    [liveContact, staffName, user?.role, businessProfile, bankAccounts]
  );

  // Resolve template variables
  const resolution = useMemo(() => {
    const rawBody = hasManuallyEditedBody
      ? customBody
      : selectedTemplate?.body || customBody;
    const rawSubject = hasManuallyEditedSubject
      ? customSubject
      : selectedTemplate?.subject || customSubject;

    return resolveTemplateVariables(rawBody, variableContext, {
      subject: rawSubject,
      manualOverrides: manualVariableOverrides,
    });
  }, [
    selectedTemplate,
    customBody,
    customSubject,
    hasManuallyEditedBody,
    hasManuallyEditedSubject,
    variableContext,
    manualVariableOverrides,
  ]);

  // Sync resolved template into editor when template or variable overrides change
  useEffect(() => {
    if (!hasManuallyEditedBody && selectedTemplate) {
      setCustomBody(resolution.resolvedText);
    }
    if (!hasManuallyEditedSubject && selectedTemplate) {
      setCustomSubject(
        resolution.resolvedSubject ||
          `Update from ${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName}`
      );
    }
  }, [
    selectedTemplate,
    resolution.resolvedText,
    resolution.resolvedSubject,
    hasManuallyEditedBody,
    hasManuallyEditedSubject,
  ]);

  // Check verification guard on currently selected template
  const activeVerificationGuard = useMemo(
    () => checkTemplateVerificationGuard(selectedTemplate, liveContact),
    [selectedTemplate, liveContact]
  );

  // Filter templates for picker
  const availableTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (!tpl.isActive) return false;
      if (!canUseTemplate(staffRole, tpl)) return false;
      if (selectedCategory !== "all" && tpl.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const hay =
          `${tpl.name} ${tpl.description} ${tpl.subject || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [templates, staffRole, selectedCategory, templateSearch]);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: MessageTemplate | null) => {
    setBannerAlert(null);
    if (!tpl) {
      setSelectedTemplate(null);
      setHasManuallyEditedBody(true);
      setHasManuallyEditedSubject(true);
      setCustomBody("");
      setCustomSubject("");
      return;
    }

    const guard = checkTemplateVerificationGuard(tpl, liveContact);
    setSelectedTemplate(tpl);
    setHasManuallyEditedBody(false);
    setHasManuallyEditedSubject(false);

    if (!guard.allowed) {
      setBannerAlert({
        type: "warning",
        text:
          guard.reason ||
          "This template requires verified operational status before sending.",
      });
    }
  };

  const handleOpenContactEditor = () => {
    setEditPhone(liveContact.phone || "");
    setEditAltPhone(liveContact.whatsappPhone || liveContact.altPhone || "");
    setEditEmail(liveContact.email || "");
    setConfirmOverwriteVerified(false);
    setContactSaveMsg(null);
    setIsEditingContact(true);
  };

  const handleSaveContactDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingContact(true);
    setContactSaveMsg(null);

    const res = await updateClientContactDetails({
      clientId: liveContact.clientId,
      leadId: liveContact.leadId,
      phone: editPhone,
      altPhone: editAltPhone || null,
      email: editEmail || null,
      wasPreviouslyVerified: Boolean(liveContact.contactVerified),
      confirmVerifiedOverwrite: confirmOverwriteVerified,
      actor: {
        staffId,
        role: staffRole,
      },
    });

    setIsSavingContact(false);

    if (!res.success) {
      setContactSaveMsg({
        type: "error",
        text: res.error || "Could not update contact information.",
      });
      return;
    }

    const nextPhone = res.updatedPhone || editPhone;
    const nextAlt = res.updatedAltPhone ?? null;
    const nextEmail = res.updatedEmail ?? null;

    setLiveContact((prev) => ({
      ...prev,
      phone: nextPhone,
      whatsappPhone: nextAlt || nextPhone,
      altPhone: nextAlt,
      email: nextEmail,
    }));
    onContactUpdated?.({
      phone: nextPhone,
      altPhone: nextAlt,
      email: nextEmail,
    });
    setContactSaveMsg({
      type: "success",
      text: "Client contact information validated, saved, and recorded in the audit log.",
    });
    setTimeout(() => {
      setIsEditingContact(false);
    }, 900);
  };

  const effectiveMessageBody = hasManuallyEditedBody
    ? customBody
    : resolution.resolvedText;
  const effectiveSubject = hasManuallyEditedSubject
    ? customSubject
    : resolution.resolvedSubject ||
      `Update Regarding ${liveContact.businessName || liveContact.clientName} — ABLEBIZ BUSINESS SERVICES`;

  // Detect any remaining {{...}} placeholders in the final edited text
  const remainingPlaceholdersInBody = Array.from(
    effectiveMessageBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)
  ).map((m) => m[1].toLowerCase());
  const remainingPlaceholdersInSubject =
    channel === "email"
      ? Array.from(
          effectiveSubject.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)
        ).map((m) => m[1].toLowerCase())
      : [];
  const allUnresolvedKeys = Array.from(
    new Set([...remainingPlaceholdersInBody, ...remainingPlaceholdersInSubject])
  );

  // Execute WhatsApp Action
  const handleOpenWhatsApp = async () => {
    setBannerAlert(null);

    if (!canSend) {
      setBannerAlert({
        type: "error",
        text: "Your role is read-only and cannot initiate client communications.",
      });
      return;
    }

    if (!activeVerificationGuard.allowed) {
      setBannerAlert({
        type: "error",
        text:
          activeVerificationGuard.reason ||
          "Cannot send this message until the required stage/payment verification is complete.",
      });
      return;
    }

    if (allUnresolvedKeys.length > 0) {
      setBannerAlert({
        type: "warning",
        text: `Please fill in or remove unresolved placeholder(s) before opening WhatsApp: ${allUnresolvedKeys
          .map((k) => `{{${k}}}`)
          .join(", ")}`,
      });
      return;
    }

    const targetNumber =
      liveContact.whatsappPhone || liveContact.altPhone || liveContact.phone;
    const waLink = buildWhatsAppLink(targetNumber, effectiveMessageBody);
    if (!waLink.valid || !waLink.url) {
      setBannerAlert({
        type: "error",
        text:
          waLink.error ||
          "Client does not have a valid WhatsApp/telephone number. Please update contact details first.",
      });
      return;
    }

    setIsSubmitting(true);
    window.open(waLink.url, "_blank", "noopener,noreferrer");

    const summary = selectedTemplate
      ? `${selectedTemplate.name} — WhatsApp opened for ${liveContact.clientName}`
      : `WhatsApp message opened for ${liveContact.clientName}`;

    const logged = await recordCommunicationActivity({
      clientId: liveContact.clientId,
      leadId: liveContact.leadId,
      businessId: liveContact.businessId,
      serviceRequestId: liveContact.serviceRequestId,
      cacApplicationId: liveContact.cacApplicationId,
      invoiceId: liveContact.invoiceId,
      paymentId: liveContact.paymentId,
      staffId,
      staffName,
      staffRole,
      channel: "whatsapp",
      direction: "outbound",
      status: "opened_in_whatsapp",
      templateId: selectedTemplate?.id || null,
      templateName: selectedTemplate?.name || null,
      summary,
      messageBody: effectiveMessageBody,
      recipientName: liveContact.clientName,
      recipientPhone: waLink.formattedPhone.e164,
    });

    setIsSubmitting(false);
    if (logged.record) {
      setLastLoggedRecord(logged.record);
      onCommunicationLogged?.(logged.record);
    }

    setBannerAlert({
      type: "info",
      text: `WhatsApp opened for ${waLink.formattedPhone.displayInternational} with your message prefilled. Once you press Send in WhatsApp, click "Confirm Sent in WhatsApp" below to update the history status.`,
    });
  };

  // Execute Official Server-Side Email Dispatch (From: hello@ablebiz.com.ng)
  const handleSendOfficialEmail = async () => {
    setBannerAlert(null);

    if (!canSend) {
      setBannerAlert({
        type: "error",
        text: "Your role is read-only and cannot send official client emails.",
      });
      return;
    }

    if (!activeVerificationGuard.allowed) {
      setBannerAlert({
        type: "error",
        text:
          activeVerificationGuard.reason ||
          "Cannot send this email until the required verification is complete.",
      });
      return;
    }

    if (allUnresolvedKeys.length > 0) {
      setBannerAlert({
        type: "warning",
        text: `Please resolve or remove placeholder(s) before sending: ${allUnresolvedKeys
          .map((k) => `{{${k}}}`)
          .join(", ")}`,
      });
      return;
    }

    if (!contactQuality.email.valid) {
      setBannerAlert({
        type: "error",
        text:
          contactQuality.email.error ||
          "Client email address is missing or invalid. Please update client contact details first.",
      });
      return;
    }

    const ccList = ccInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const htmlBody = buildOfficialEmailHtml({
      subject: effectiveSubject,
      body: effectiveMessageBody,
      recipientName: liveContact.clientName,
      staffName,
    });
    const plainTextBody = buildOfficialEmailPlainText(
      effectiveMessageBody,
      staffName
    );

    setIsSubmitting(true);

    const dispatchResult = await sendOfficialClientEmail({
      recipientEmail: contactQuality.email.normalized,
      recipientName: liveContact.clientName,
      ccEmails: ccList,
      subject: effectiveSubject,
      plainTextBody,
      htmlBody,
      clientId: liveContact.clientId,
      leadId: liveContact.leadId,
      businessId: liveContact.businessId,
      serviceRequestId: liveContact.serviceRequestId,
      cacApplicationId: liveContact.cacApplicationId,
      invoiceId: liveContact.invoiceId,
      paymentId: liveContact.paymentId,
      templateId: selectedTemplate?.id || null,
      templateName: selectedTemplate?.name || null,
      staffName,
    });

    const summary = `${effectiveSubject} (To: ${contactQuality.email.normalized})`;

    const logged = await recordCommunicationActivity({
      clientId: liveContact.clientId,
      leadId: liveContact.leadId,
      businessId: liveContact.businessId,
      serviceRequestId: liveContact.serviceRequestId,
      cacApplicationId: liveContact.cacApplicationId,
      invoiceId: liveContact.invoiceId,
      paymentId: liveContact.paymentId,
      staffId,
      staffName,
      staffRole,
      channel: "email",
      direction: "outbound",
      status: dispatchResult.status,
      templateId: selectedTemplate?.id || null,
      templateName: selectedTemplate?.name || null,
      subject: effectiveSubject,
      summary,
      messageBody: effectiveMessageBody,
      htmlBody,
      recipientName: liveContact.clientName,
      recipientEmail: contactQuality.email.normalized,
      ccEmails: ccList,
      providerName: dispatchResult.providerName || null,
      providerMessageId: dispatchResult.providerMessageId || null,
      errorMessage: dispatchResult.errorMessage || null,
    });

    setIsSubmitting(false);

    if (logged.record) {
      setLastLoggedRecord(logged.record);
      onCommunicationLogged?.(logged.record);
    }

    if (dispatchResult.success && dispatchResult.status === "sent") {
      setBannerAlert({
        type: "success",
        text: `Official email dispatched from ${OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedDisplayFrom} to ${contactQuality.email.normalized} (Provider Ref: ${dispatchResult.providerMessageId}).`,
      });
    } else if (dispatchResult.configurationRequired) {
      setBannerAlert({
        type: "warning",
        text:
          dispatchResult.errorMessage ||
          "Server-side email provider credentials for hello@ablebiz.com.ng are not configured yet. Your prepared message has been logged as 'prepared'. Click 'Open in Default Email App' below to send immediately via your mail client.",
      });
    } else {
      setBannerAlert({
        type: "error",
        text:
          dispatchResult.errorMessage ||
          "Email dispatch failed. Use 'Open in Default Email App' or retry.",
      });
    }
  };

  // Execute Open in Default Email App (`mailto:`)
  const handleOpenMailtoApp = async () => {
    setBannerAlert(null);

    if (!canSend) {
      setBannerAlert({
        type: "error",
        text: "Your role is read-only and cannot initiate client communications.",
      });
      return;
    }

    if (!activeVerificationGuard.allowed) {
      setBannerAlert({
        type: "error",
        text:
          activeVerificationGuard.reason ||
          "Cannot send this message until the required verification is complete.",
      });
      return;
    }

    if (allUnresolvedKeys.length > 0) {
      setBannerAlert({
        type: "warning",
        text: `Please fill in or remove unresolved placeholder(s) first: ${allUnresolvedKeys
          .map((k) => `{{${k}}}`)
          .join(", ")}`,
      });
      return;
    }

    const ccList = ccInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const plainTextWithFooter = buildOfficialEmailPlainText(
      effectiveMessageBody,
      staffName
    );

    const mailto = buildMailtoLink({
      to: liveContact.email,
      cc: ccList,
      subject: effectiveSubject,
      body: plainTextWithFooter,
    });

    if (!mailto.valid || !mailto.url) {
      setBannerAlert({
        type: "error",
        text:
          mailto.error ||
          "Client does not have a valid email address. Please update contact details first.",
      });
      return;
    }

    setIsSubmitting(true);
    window.location.href = mailto.url;

    const logged = await recordCommunicationActivity({
      clientId: liveContact.clientId,
      leadId: liveContact.leadId,
      businessId: liveContact.businessId,
      serviceRequestId: liveContact.serviceRequestId,
      cacApplicationId: liveContact.cacApplicationId,
      invoiceId: liveContact.invoiceId,
      paymentId: liveContact.paymentId,
      staffId,
      staffName,
      staffRole,
      channel: "email",
      direction: "outbound",
      status: "opened_in_email",
      templateId: selectedTemplate?.id || null,
      templateName: selectedTemplate?.name || null,
      subject: effectiveSubject,
      summary: `${effectiveSubject} — Opened in Email App (${mailto.emailValidation.normalized})`,
      messageBody: effectiveMessageBody,
      recipientName: liveContact.clientName,
      recipientEmail: mailto.emailValidation.normalized,
      ccEmails: ccList,
    });

    setIsSubmitting(false);
    if (logged.record) {
      setLastLoggedRecord(logged.record);
      onCommunicationLogged?.(logged.record);
    }

    setBannerAlert({
      type: "info",
      text: `Email client opened for ${mailto.emailValidation.normalized} with subject and body prefilled. After sending in your email app, click "Confirm Sent" below.`,
    });
  };

  // Execute Phone Call (`tel:`)
  const handleCallClient = async () => {
    setBannerAlert(null);

    const tel = buildTelLink(liveContact.phone || liveContact.whatsappPhone);
    if (!tel.valid || !tel.url) {
      setBannerAlert({
        type: "error",
        text:
          tel.error ||
          "Client does not have a valid telephone number on record.",
      });
      return;
    }

    window.location.href = tel.url;

    if (canSend) {
      const logged = await recordCommunicationActivity({
        clientId: liveContact.clientId,
        leadId: liveContact.leadId,
        businessId: liveContact.businessId,
        serviceRequestId: liveContact.serviceRequestId,
        cacApplicationId: liveContact.cacApplicationId,
        invoiceId: liveContact.invoiceId,
        paymentId: liveContact.paymentId,
        staffId,
        staffName,
        staffRole,
        channel: "phone_call",
        direction: "outbound",
        status: "opened_in_phone",
        summary: `Telephone call initiated to ${liveContact.clientName} (${tel.formattedPhone.displayInternational})`,
        messageBody:
          effectiveMessageBody ||
          `Phone call to ${liveContact.clientName} (${tel.formattedPhone.displayInternational})`,
        recipientName: liveContact.clientName,
        recipientPhone: tel.formattedPhone.e164,
      });

      if (logged.record) {
        setLastLoggedRecord(logged.record);
        onCommunicationLogged?.(logged.record);
      }
    }

    setBannerAlert({
      type: "info",
      text: `Dialing ${tel.formattedPhone.displayInternational}. You can record call notes and the client's response below once the call concludes.`,
    });
  };

  // Confirm Sent / Record Outcome after opening WhatsApp, Email, or Phone
  const handleConfirmOutcome = async (
    targetStatus: "sent" | "confirmed_by_client"
  ) => {
    if (!lastLoggedRecord) return;
    setIsSubmitting(true);
    const res = await updateCommunicationStatusAndOutcome(
      lastLoggedRecord.id,
      {
        status: targetStatus,
        outcomeNotes: outcomeNotes.trim() || undefined,
        clientResponse: clientResponseText.trim() || undefined,
      },
      { staffId, role: staffRole }
    );
    setIsSubmitting(false);

    if (res.success) {
      const updatedRecord: CommunicationLogRecord = {
        ...lastLoggedRecord,
        status: targetStatus,
        outcome_notes: outcomeNotes.trim() || lastLoggedRecord.outcome_notes,
        client_response:
          clientResponseText.trim() || lastLoggedRecord.client_response,
      };
      setLastLoggedRecord(updatedRecord);
      onCommunicationLogged?.(updatedRecord);
      setBannerAlert({
        type: "success",
        text:
          targetStatus === "confirmed_by_client"
            ? "Communication marked as Confirmed by Client and response saved."
            : "Communication status updated to Sent in client history.",
      });
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(effectiveMessageBody);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Client Communication & Engagement Studio
                </h2>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {workflowContext.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {liveContact.clientName}
                {liveContact.businessName
                  ? ` • ${liveContact.businessName}`
                  : ""}
                {liveContact.serviceRequestCode
                  ? ` • Ref: ${liveContact.serviceRequestCode}`
                  : ""}
                {liveContact.invoiceNumber
                  ? ` • Invoice: ${liveContact.invoiceNumber}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close communication composer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contact Information & Quality Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                <span className="font-medium text-slate-600">Phone:</span>
                {contactQuality.phone.valid ? (
                  <span className="font-semibold text-slate-900">
                    {contactQuality.phone.displayInternational}
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                    Missing / Invalid
                  </span>
                )}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium text-slate-600">WhatsApp:</span>
                {contactQuality.whatsapp.valid ? (
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {contactQuality.whatsapp.e164}
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                    Not Available
                  </span>
                )}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-medium text-slate-600">Email:</span>
                {contactQuality.email.valid ? (
                  <span className="font-semibold text-slate-900">
                    {contactQuality.email.normalized}
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                    Missing / Invalid
                  </span>
                )}
              </div>

              {liveContact.businessName && (
                <>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-800">
                      {liveContact.businessName}
                    </span>
                  </div>
                </>
              )}
            </div>

            {canEditContact && (liveContact.clientId || liveContact.leadId) && (
              <button
                type="button"
                onClick={() =>
                  isEditingContact
                    ? setIsEditingContact(false)
                    : handleOpenContactEditor()
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isEditingContact ? "Cancel Edit" : "Update Contact Info"}
              </button>
            )}
          </div>

          {/* Contact Quality Warnings */}
          {contactQuality.issues.length > 0 && !isEditingContact && (
            <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Contact Quality Notice:</strong>{" "}
                  {contactQuality.issues.join(" • ")}
                </span>
              </div>
              {canEditContact && (liveContact.clientId || liveContact.leadId) && (
                <button
                  type="button"
                  onClick={handleOpenContactEditor}
                  className="font-bold underline ml-3 shrink-0"
                >
                  Fix Now
                </button>
              )}
            </div>
          )}

          {/* Inline Contact Details Updater */}
          {isEditingContact && (
            <form
              onSubmit={handleSaveContactDetails}
              className="mt-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Update & Validate Client Contact Information
                </h4>
                <span className="text-[11px] text-slate-500">
                  Changes are validated and recorded in the audit log
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Primary Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g. 0803 123 4567 or +234..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WhatsApp / Alt Phone (if different)
                  </label>
                  <input
                    type="tel"
                    value={editAltPhone}
                    onChange={(e) => setEditAltPhone(e.target.value)}
                    placeholder="Optional WhatsApp number"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Client Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="client@domain.com"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {liveContact.contactVerified && (
                <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                  <input
                    type="checkbox"
                    checked={confirmOverwriteVerified}
                    onChange={(e) =>
                      setConfirmOverwriteVerified(e.target.checked)
                    }
                    className="rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    I confirm updating previously verified contact details for{" "}
                    <strong>{liveContact.clientName}</strong>.
                  </span>
                </label>
              )}

              {contactSaveMsg && (
                <div
                  className={`text-xs px-3 py-2 rounded-lg ${
                    contactSaveMsg.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {contactSaveMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingContact(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  {isSavingContact ? "Validating & Saving..." : "Save Contact"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Main Two-Column Studio Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* LEFT PANE (5 cols): Prepared Message Library */}
          <div className="lg:col-span-5 flex flex-col bg-slate-50/60 p-4 space-y-3 overflow-y-auto max-h-[42vh] lg:max-h-none">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                1. Select Prepared Message
              </h3>
              <button
                type="button"
                onClick={() => handleSelectTemplate(null)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                  selectedTemplate === null
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                Custom Blank Message
              </button>
            </div>

            {/* Search & Category Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates (e.g. Requirements, Approval, Delivery)..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(
                    e.target.value as TemplateCategoryId | "all"
                  )
                }
                aria-label="Filter templates by category"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
              >
                <option value="all">All 12 Message Categories</option>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Template List */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {availableTemplates.length === 0 ? (
                <div className="text-center py-8 px-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                  No prepared templates match your current filter or role
                  permissions.
                </div>
              ) : (
                availableTemplates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  const guardCheck = checkTemplateVerificationGuard(
                    tpl,
                    liveContact
                  );
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-emerald-50/90 border-emerald-500 ring-1 ring-emerald-500 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {tpl.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {!guardCheck.allowed && (
                            <span
                              title={guardCheck.reason}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded"
                            >
                              <Lock className="h-2.5 w-2.5" />
                              Guarded
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700 uppercase">
                            {tpl.defaultChannel === "whatsapp"
                              ? "WhatsApp"
                              : "Email"}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                        {tpl.description}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE (7 cols): Channel Selector, Variable Resolver, Editor & Send Actions */}
          <div className="lg:col-span-7 flex flex-col p-5 space-y-4 overflow-y-auto">
            {/* Step 2: Select Channel */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setChannel("whatsapp")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    channel === "whatsapp"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    channel === "email"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Official Email
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("phone_call")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    channel === "phone_call"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Phone Call
                </button>
              </div>

              {/* Edit vs Preview Toggle */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedToClipboard ? "Copied!" : "Copy Text"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewMode(previewMode === "edit" ? "preview" : "edit")
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {previewMode === "edit" ? "Preview Output" : "Back to Editor"}
                </button>
              </div>
            </div>

            {/* Verification Guard Warning Banner */}
            {!activeVerificationGuard.allowed && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-800">
                <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Workflow Verification Guard Active
                  </p>
                  <p className="mt-0.5">{activeVerificationGuard.reason}</p>
                </div>
              </div>
            )}

            {/* Official Sender Identity Header (Mandatory for Email Channel) */}
            {channel === "email" && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-blue-700" />
                    <span className="font-semibold text-slate-700">From:</span>
                    <span className="font-bold text-blue-950 bg-white px-2.5 py-0.5 rounded border border-blue-200">
                      {OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedDisplayFrom}
                    </span>
                  </div>
                  <span className="text-[11px] text-blue-700 font-medium">
                    Reply-To: {OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      To (Client Email):
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        contactQuality.email.valid
                          ? `${liveContact.clientName} <${contactQuality.email.normalized}>`
                          : "No valid client email on record"
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Optional CC (comma-separated):
                    </label>
                    <input
                      type="text"
                      value={ccInput}
                      onChange={(e) => setCcInput(e.target.value)}
                      placeholder="e.g. operations@ablebiz.com.ng"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Email Subject:
                  </label>
                  <input
                    type="text"
                    value={effectiveSubject}
                    onChange={(e) => {
                      setHasManuallyEditedSubject(true);
                      setCustomSubject(e.target.value);
                    }}
                    placeholder="Enter email subject..."
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Missing Dynamic Variables Prompt Bar */}
            {(resolution.missingVariables.length > 0 ||
              allUnresolvedKeys.length > 0) && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      Complete Missing Personalization Details:
                    </span>{" "}
                    The following variables were not found on the current record.
                    Fill them below to auto-populate the message, or edit the
                    message text directly:
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {resolution.missingVariables.map((mv) => (
                    <div key={mv.key}>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-0.5">
                        {mv.label} (<code>{mv.token}</code>)
                      </label>
                      <input
                        type="text"
                        value={manualVariableOverrides[mv.key] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualVariableOverrides((prev) => ({
                            ...prev,
                            [mv.key]: val,
                          }));
                          setHasManuallyEditedBody(false);
                        }}
                        placeholder={mv.example || `Enter ${mv.label}...`}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editor or Preview Area */}
            {previewMode === "edit" ? (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    {channel === "phone_call"
                      ? "Call Talking Points / Call Summary Notes"
                      : "Message Body (Review & Customize Before Sending)"}
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {effectiveMessageBody.length} characters
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={effectiveMessageBody}
                  onChange={(e) => {
                    setHasManuallyEditedBody(true);
                    setCustomBody(e.target.value);
                  }}
                  placeholder="Select a prepared message on the left or write a custom message..."
                  className="w-full flex-1 p-3.5 text-xs sm:text-sm font-sans leading-relaxed text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 resize-y"
                />
              </div>
            ) : (
              <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-4">
                {channel === "email" ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-h-[340px] overflow-y-auto">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: buildOfficialEmailHtml({
                          subject: effectiveSubject,
                          body: effectiveMessageBody,
                          recipientName: liveContact.clientName,
                          staffName,
                        }),
                      }}
                    />
                  </div>
                ) : (
                  <div className="max-w-md mx-auto bg-[#e5ddd5] p-4 rounded-xl shadow-inner">
                    <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center justify-between">
                      <span>WhatsApp Preview</span>
                      <span>
                        To:{" "}
                        {contactQuality.whatsapp.valid
                          ? contactQuality.whatsapp.displayInternational
                          : "Unverified Phone"}
                      </span>
                    </div>
                    <div className="bg-[#dcf8c6] text-slate-900 p-3.5 rounded-xl rounded-tr-none shadow text-xs whitespace-pre-wrap leading-relaxed">
                      {effectiveMessageBody || "(Empty message)"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status / Action Alert Banner */}
            {bannerAlert && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  bannerAlert.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : bannerAlert.type === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : bannerAlert.type === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}
              >
                {bannerAlert.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : bannerAlert.type === "error" ? (
                  <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">{bannerAlert.text}</div>
              </div>
            )}

            {/* Post-Open Confirmation & Client Response Logger */}
            {lastLoggedRecord &&
              (lastLoggedRecord.status === "opened_in_whatsapp" ||
                lastLoggedRecord.status === "opened_in_email" ||
                lastLoggedRecord.status === "opened_in_phone" ||
                lastLoggedRecord.status === "prepared") && (
                <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-emerald-400">
                      Step 3: Confirm Delivery & Log Client Outcome
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Current Status:{" "}
                      {lastLoggedRecord.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      placeholder="Optional delivery or call outcome note..."
                      className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
                    />
                    <input
                      type="text"
                      value={clientResponseText}
                      onChange={(e) => setClientResponseText(e.target.value)}
                      placeholder="Optional client response summary..."
                      className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleConfirmOutcome("sent")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm Message Was Sent
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() =>
                        handleConfirmOutcome("confirmed_by_client")
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Mark Confirmed by Client
                    </button>
                  </div>
                </div>
              )}

            {/* Primary Channel Execution Footer */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                Logged by <strong>{staffName}</strong> • All communications are
                recorded in Client History
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Close
                </button>

                {channel === "whatsapp" && (
                  <button
                    type="button"
                    disabled={
                      isSubmitting ||
                      !canSend ||
                      !activeVerificationGuard.allowed
                    }
                    onClick={handleOpenWhatsApp}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm disabled:opacity-50 transition-all"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open WhatsApp with Prefilled Message
                  </button>
                )}

                {channel === "email" && (
                  <>
                    <button
                      type="button"
                      disabled={
                        isSubmitting ||
                        !canSend ||
                        !activeVerificationGuard.allowed
                      }
                      onClick={handleOpenMailtoApp}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl disabled:opacity-50 transition-all"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in Email App (mailto:)
                    </button>
                    <button
                      type="button"
                      disabled={
                        isSubmitting ||
                        !canSend ||
                        !activeVerificationGuard.allowed
                      }
                      onClick={handleSendOfficialEmail}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50 transition-all"
                    >
                      <Send className="h-4 w-4" />
                      {isSubmitting
                        ? "Sending..."
                        : `Send Official Email (${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail})`}
                    </button>
                  </>
                )}

                {channel === "phone_call" && (
                  <button
                    type="button"
                    onClick={handleCallClient}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all"
                  >
                    <Phone className="h-4 w-4" />
                    Dial Client Now (
                    {contactQuality.phone.valid
                      ? contactQuality.phone.displayLocal
                      : "No Phone"}
                    )
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
