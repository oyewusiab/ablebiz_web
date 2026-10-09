import type { ReactNode } from "react";
import { BrandLogo } from "../BrandLogo";
import { useBusinessProfile } from "../../lib/businessProfileContext";
import { formatBusinessAddress, formatPhoneDisplay } from "../../types/businessProfile";
import { cn } from "../../utils/cn";

export interface RecipientInfo {
  name?: string;
  phone?: string;
  email?: string;
  businessName?: string;
  address?: string;
}

export interface BankPaymentDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  notes?: string;
}

export interface DocumentHeaderProps {
  /**
   * Title of the document: e.g. "TAX INVOICE", "QUOTATION", "OFFICIAL RECEIPT", "EXECUTIVE REPORT"
   */
  title: string;
  /**
   * Document tracking number: e.g. INV-2026-001, QUO-2026-004, RCP-002
   */
  documentNumber?: string;
  /**
   * Issue date of the document
   */
  date?: string | Date;
  /**
   * Optional payment due date or validity expiration
   */
  dueDate?: string | Date;
  dueLabel?: string;
  /**
   * Optional status badge text
   */
  status?: string;
  /**
   * Billed to / Prepared for client details
   */
  recipient?: RecipientInfo;
  recipientLabel?: string;
  /**
   * Optional bank instructions (rendered ONLY when officially configured)
   */
  paymentDetails?: BankPaymentDetails;
  /**
   * Extra content to render inside the header grid
   */
  extraMeta?: ReactNode;
  className?: string;
}

export function DocumentHeader({
  title,
  documentNumber,
  date,
  dueDate,
  dueLabel = "Due Date",
  status,
  recipient,
  recipientLabel = "BILLED TO",
  paymentDetails,
  extraMeta,
  className,
}: DocumentHeaderProps) {
  const { profile } = useBusinessProfile();

  const formattedDate = date
    ? typeof date === "string"
      ? date.includes("T")
        ? new Date(date).toLocaleDateString()
        : date
      : date.toLocaleDateString()
    : undefined;

  const formattedDueDate = dueDate
    ? typeof dueDate === "string"
      ? dueDate.includes("T")
        ? new Date(dueDate).toLocaleDateString()
        : dueDate
      : dueDate.toLocaleDateString()
    : undefined;

  const businessAddress = formatBusinessAddress(profile);
  const phoneDisplay = formatPhoneDisplay(profile.primary_phone || "");

  return (
    <div className={cn("space-y-6 text-slate-900", className)}>
      {/* Top Banner: Logo & Primary Company Identity + Document Meta */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-2 max-w-md">
          <div className="flex items-center gap-3">
            <BrandLogo variant="landscape" size="md" print priority />
          </div>

          <div className="text-xs text-slate-600 space-y-0.5">
            <p className="font-bold text-slate-900 text-sm tracking-tight">
              {profile.legal_name || profile.trading_name || "ABLEBIZ Business Services"}
            </p>
            {businessAddress ? <p className="text-[11px]">{businessAddress}</p> : null}
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
              {phoneDisplay ? <span>{phoneDisplay}</span> : null}
              {phoneDisplay && profile.primary_email ? <span>•</span> : null}
              {profile.primary_email ? <span>{profile.primary_email}</span> : null}
              {profile.cac_registration_number ? (
                <>
                  <span>•</span>
                  <span className="font-mono text-slate-700 font-semibold">{profile.cac_registration_number}</span>
                </>
              ) : null}
            </div>
            {profile.cac_accredited_agent_number ? (
              <p className="text-[10px] text-emerald-800 font-medium">
                CAC Accredited Agent: <span className="font-mono">{profile.cac_accredited_agent_number}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="text-left sm:text-right space-y-1">
          <div className="inline-block">
            <h1 className="text-xl sm:text-2xl font-black text-[#0A2558] tracking-tight uppercase">
              {title}
            </h1>
            {status ? (
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {status}
              </span>
            ) : null}
          </div>

          {documentNumber ? (
            <p className="font-mono text-xs font-bold text-slate-900 mt-1">
              Ref: {documentNumber}
            </p>
          ) : null}

          {formattedDate ? (
            <p className="text-xs text-slate-600">
              Date: <span className="font-medium text-slate-900">{formattedDate}</span>
            </p>
          ) : null}

          {formattedDueDate ? (
            <p className="text-xs text-slate-600">
              {dueLabel}:{" "}
              <span className="font-semibold text-slate-900">{formattedDueDate}</span>
            </p>
          ) : null}

          {extraMeta}
        </div>
      </div>

      {/* Recipient & Optional Payment Grid */}
      {(recipient || paymentDetails) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          {recipient && (
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {recipientLabel}
              </span>
              {recipient.name ? (
                <p className="font-bold text-slate-900 text-sm">{recipient.name}</p>
              ) : null}
              {recipient.businessName ? (
                <p className="font-medium text-[#0A2558]">Re: {recipient.businessName}</p>
              ) : null}
              {recipient.phone ? <p className="text-slate-600">{recipient.phone}</p> : null}
              {recipient.email ? <p className="text-slate-600">{recipient.email}</p> : null}
              {recipient.address ? <p className="text-slate-600">{recipient.address}</p> : null}
            </div>
          )}

          {/* Bank Instructions: Rendered ONLY if officially provided */}
          {paymentDetails && (paymentDetails.bankName || paymentDetails.accountNumber) ? (
            <div className="rounded-lg border border-amber-200/60 bg-amber-50/30 p-3.5 space-y-1 sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                PAYMENT REMITTANCE
              </span>
              {paymentDetails.bankName ? (
                <p className="font-bold text-slate-900">{paymentDetails.bankName}</p>
              ) : null}
              {paymentDetails.accountName ? (
                <p className="text-slate-700">Account: {paymentDetails.accountName}</p>
              ) : null}
              {paymentDetails.accountNumber ? (
                <p className="font-mono font-bold text-slate-900">
                  A/C: {paymentDetails.accountNumber}
                </p>
              ) : null}
              {paymentDetails.notes ? (
                <p className="text-[11px] text-slate-500">{paymentDetails.notes}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200/60 bg-amber-50/30 p-3.5 space-y-1 sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                PAYMENT REMITTANCE
              </span>
              <p className="text-xs text-amber-700 italic">
                Official bank settlement account details pending configuration in Settings → Business Profile.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface DocumentFooterProps {
  /**
   * Optional custom note, terms, or message
   */
  notes?: string;
  /**
   * Optional document reference code (simple tracking/reference ID, no fake certificates)
   */
  documentId?: string;
  className?: string;
}

export function DocumentFooter({ notes, documentId, className }: DocumentFooterProps) {
  const { profile } = useBusinessProfile();
  const businessAddress = formatBusinessAddress(profile);

  return (
    <div
      className={cn(
        "mt-8 pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-2",
        className
      )}
    >
      {notes ? <p className="text-slate-600 text-xs leading-relaxed">{notes}</p> : null}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
        <div>
          <p className="font-semibold text-slate-700">{profile.legal_name || profile.trading_name || "ABLEBIZ Business Services"}</p>
          <p>
            {businessAddress ? `${businessAddress} • ` : ""}
            {profile.primary_email || ""}
          </p>
        </div>

        {documentId ? (
          <div className="sm:text-right font-mono text-[10px]">
            <span>Doc Ref: {documentId}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
