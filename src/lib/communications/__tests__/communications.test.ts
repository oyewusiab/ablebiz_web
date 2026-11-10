import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManageTemplates,
  canSendCommunication,
  canUpdateClientContactInfo,
  canUseTemplate,
  checkTemplateVerificationGuard,
  getCommunicationRolePolicy,
} from "../communicationPermissions";
import {
  assessClientContactQuality,
  buildMailtoLink,
  buildTelLink,
  buildWhatsAppLink,
  formatPhoneForCommunication,
  validateEmailAddress,
} from "../contactUtils";
import {
  buildOfficialEmailHtml,
  buildOfficialEmailPlainText,
  enforceOfficialSenderIdentity,
  OFFICIAL_BUSINESS_EMAIL_CONFIG,
} from "../emailConfig";
import {
  deleteOrDeactivateTemplate,
  saveMessageTemplate,
} from "../communicationStorage";
import {
  filterTemplates,
  findDefaultTemplateForIntent,
  INITIAL_MESSAGE_TEMPLATES,
  TEMPLATE_CATEGORIES,
} from "../templateCatalogue";
import {
  buildVariableContextFromRecords,
  extractTemplateVariables,
  formatApprovedPaymentInstructions,
  resolveTemplateVariables,
  validateTemplateContentSafety,
} from "../variableEngine";

describe("Part 1 — Phone, WhatsApp, Email & Contact Quality Utilities", () => {
  it("normalizes Nigerian local 11-digit numbers (080/081/070/090/091) to +234 and wa.me digits", () => {
    const res = formatPhoneForCommunication("0803 123 4567");
    assert.equal(res.valid, true);
    assert.equal(res.isNigerian, true);
    assert.equal(res.e164, "+2348031234567");
    assert.equal(res.waDigits, "2348031234567");
    assert.equal(res.displayLocal, "0803 123 4567");
  });

  it("normalizes Nigerian +234080... and 23480... numbers cleanly without double zero", () => {
    const withZero = formatPhoneForCommunication("+23408122399110");
    assert.equal(withZero.valid, true);
    assert.equal(withZero.e164, "+2348122399110");
    assert.equal(withZero.waDigits, "2348122399110");

    const bare234 = formatPhoneForCommunication("2348122399110");
    assert.equal(bare234.valid, true);
    assert.equal(bare234.e164, "+2348122399110");
  });

  it("does NOT blindly prepend +234 to international numbers (+44, +1, +233, 0044)", () => {
    const uk = formatPhoneForCommunication("+44 7911 123456");
    assert.equal(uk.valid, true);
    assert.equal(uk.isNigerian, false);
    assert.equal(uk.e164, "+447911123456");
    assert.equal(uk.waDigits, "447911123456");

    const us = formatPhoneForCommunication("+1 (415) 555-2671");
    assert.equal(us.valid, true);
    assert.equal(us.isNigerian, false);
    assert.equal(us.e164, "+14155552671");

    const ghana = formatPhoneForCommunication("00233241234567");
    assert.equal(ghana.valid, true);
    assert.equal(ghana.isNigerian, false);
    assert.equal(ghana.e164, "+233241234567");
  });

  it("rejects missing or invalid short phone numbers with a helpful warning", () => {
    const empty = formatPhoneForCommunication("");
    assert.equal(empty.valid, false);
    assert.ok(empty.warning?.includes("missing"));

    const short = formatPhoneForCommunication("080312");
    assert.equal(short.valid, false);
    assert.ok(short.warning);
  });

  it("builds valid tel: and https://wa.me/ deep links with encoded message text", () => {
    const tel = buildTelLink("08031234567");
    assert.equal(tel.valid, true);
    assert.equal(tel.url, "tel:+2348031234567");

    const wa = buildWhatsAppLink("08031234567", "Hello *CEO* of Primegate!");
    assert.equal(wa.valid, true);
    assert.equal(
      wa.url,
      "https://wa.me/2348031234567?text=Hello%20*CEO*%20of%20Primegate!"
    );
  });

  it("validates email addresses and builds mailto: links with subject, body, and CC", () => {
    const valid = validateEmailAddress("Client@Example.com.ng ");
    assert.equal(valid.valid, true);
    assert.equal(valid.normalized, "client@example.com.ng");

    const invalid = validateEmailAddress("not-an-email");
    assert.equal(invalid.valid, false);

    const mailto = buildMailtoLink({
      to: "client@example.com",
      cc: ["ops@ablebiz.com.ng"],
      subject: "Your Documents Are Ready",
      body: "Dear Client,\nYour documents are ready.",
    });
    assert.equal(mailto.valid, true);
    assert.ok(mailto.url?.startsWith("mailto:client@example.com?"));
    assert.ok(mailto.url?.includes("cc=ops%40ablebiz.com.ng"));
    assert.ok(mailto.url?.includes("subject=Your%20Documents%20Are%20Ready"));
  });

  it("assesses client contact quality accurately", () => {
    const complete = assessClientContactQuality({
      clientName: "Adebayo Ogunlesi",
      phone: "08031234567",
      email: "client@domain.com",
      businessName: "Primegate Ltd",
    });
    assert.equal(complete.overallStatus, "complete");
    assert.equal(complete.issues.length, 0);

    const incomplete = assessClientContactQuality({
      clientName: "Adebayo Ogunlesi",
      phone: "08031234567",
      email: "",
    });
    assert.equal(incomplete.overallStatus, "incomplete");
    assert.ok(incomplete.issues.length > 0);
  });
});

describe("Official ABLEBIZ Business Email Requirement (hello@ablebiz.com.ng)", () => {
  it("defines the single authoritative official sender configuration", () => {
    assert.equal(
      OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName,
      "ABLEBIZ BUSINESS SERVICES"
    );
    assert.equal(
      OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail,
      "hello@ablebiz.com.ng"
    );
    assert.equal(
      OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail,
      "hello@ablebiz.com.ng"
    );
    assert.equal(
      OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedDisplayFrom,
      "ABLEBIZ BUSINESS SERVICES — hello@ablebiz.com.ng"
    );
  });

  it("enforces official sender identity even if arbitrary sender values are passed", () => {
    const enforced = enforceOfficialSenderIdentity({
      senderName: "Random Personal Account",
      senderEmail: "personal@gmail.com",
      replyToEmail: "other@yahoo.com",
    });
    assert.equal(enforced.senderName, "ABLEBIZ BUSINESS SERVICES");
    assert.equal(enforced.senderEmail, "hello@ablebiz.com.ng");
    assert.equal(enforced.replyToEmail, "hello@ablebiz.com.ng");
  });

  it("generates branded HTML and plain-text email bodies with official footer", () => {
    const html = buildOfficialEmailHtml({
      subject: "Your Documents Are Ready — ABLEBIZ BUSINESS SERVICES",
      body: "Congratulations! Your documents are ready.\nhttp://bit.ly/ablefeedback",
      recipientName: "Adebayo",
      staffName: "Oluwaseun",
    });
    assert.ok(html.includes("ABLEBIZ BUSINESS SERVICES"));
    assert.ok(html.includes("hello@ablebiz.com.ng"));
    assert.ok(html.includes("http://bit.ly/ablefeedback"));

    const text = buildOfficialEmailPlainText(
      "Congratulations! Your documents are ready.",
      "Oluwaseun"
    );
    assert.ok(text.includes("ABLEBIZ BUSINESS SERVICES"));
    assert.ok(text.includes("hello@ablebiz.com.ng"));
  });
});

describe("Parts 2, 3 & 4 — Prepared Message Library & Required Templates", () => {
  it("provides all 12 required message categories", () => {
    assert.equal(TEMPLATE_CATEGORIES.length, 12);
    const categoryIds = TEMPLATE_CATEGORIES.map((c) => c.id);
    assert.ok(categoryIds.includes("welcome_onboarding"));
    assert.ok(categoryIds.includes("registration_updates"));
    assert.ok(categoryIds.includes("approval_congratulations"));
    assert.ok(categoryIds.includes("document_delivery"));
    assert.ok(categoryIds.includes("information_document_requests"));
    assert.ok(categoryIds.includes("service_progress_updates"));
    assert.ok(categoryIds.includes("payment_invoice_notifications"));
    assert.ok(categoryIds.includes("feedback_reviews"));
    assert.ok(categoryIds.includes("referral_requests"));
    assert.ok(categoryIds.includes("followup_reminders"));
    assert.ok(categoryIds.includes("service_completion"));
    assert.ok(categoryIds.includes("general_communication"));
  });

  it("includes Template 1 (Document Delivery & Feedback Request) with exact feedback URL and variables", () => {
    const tpl1 = INITIAL_MESSAGE_TEMPLATES.find(
      (t) => t.slug === "document-delivery-and-feedback-request"
    );
    assert.ok(tpl1);
    assert.equal(tpl1.category, "document_delivery");
    assert.equal(
      tpl1.subject,
      "Your Documents Are Ready — ABLEBIZ BUSINESS SERVICES"
    );
    assert.ok(tpl1.body.includes("http://bit.ly/ablefeedback"));
    assert.ok(tpl1.body.includes("Spam or Junk folder"));
    assert.ok(tpl1.supportedVariables.includes("client_name"));
    assert.ok(tpl1.supportedVariables.includes("business_name"));
    assert.ok(tpl1.supportedVariables.includes("service_name"));
    assert.ok(tpl1.supportedVariables.includes("delivery_email"));
    assert.ok(tpl1.supportedVariables.includes("delivery_date"));
  });

  it("includes Template 2 (Registration Approval & Congratulations) with approval guard", () => {
    const tpl2 = INITIAL_MESSAGE_TEMPLATES.find(
      (t) => t.slug === "registration-approval-congratulations"
    );
    assert.ok(tpl2);
    assert.equal(tpl2.category, "approval_congratulations");
    assert.equal(tpl2.verificationGuard, "cac_approved");
    assert.ok(
      tpl2.body.includes("✨ *A Very Good Day to You, {{client_name}}!* ✨")
    );
    assert.ok(
      tpl2.body.includes("You are now the official CEO of *{{business_name}}*.")
    );
  });

  it("includes Template 3 (Business Name Registration Requirements) preserving all 5 exact sections", () => {
    const tpl3 = INITIAL_MESSAGE_TEMPLATES.find(
      (t) => t.slug === "business-name-registration-requirements"
    );
    assert.ok(tpl3);
    assert.equal(tpl3.category, "information_document_requests");
    assert.equal(
      tpl3.subject,
      "Requirements for Business Name Registration — ABLEBIZ"
    );
    assert.ok(tpl3.body.includes("*PERSONAL INFORMATION*"));
    assert.ok(tpl3.body.includes("*RESIDENTIAL ADDRESS*"));
    assert.ok(tpl3.body.includes("*BUSINESS ADDRESS*"));
    assert.ok(tpl3.body.includes("*BUSINESS INFORMATION*"));
    assert.ok(tpl3.body.includes("*SUPPORTING DOCUMENTS*"));
    assert.ok(tpl3.body.includes("Valid Identification:"));
    assert.ok(tpl3.body.includes("Passport Photograph:"));
    assert.ok(tpl3.body.includes("Signature:"));
  });

  it("includes all Part 4 additional templates (A through O) and maps workflow intents", () => {
    assert.ok(INITIAL_MESSAGE_TEMPLATES.length >= 19);
    const onboarding = findDefaultTemplateForIntent(
      INITIAL_MESSAGE_TEMPLATES,
      "send_onboarding"
    );
    assert.equal(onboarding?.slug, "welcome-to-ablebiz");

    const paymentConfirm = findDefaultTemplateForIntent(
      INITIAL_MESSAGE_TEMPLATES,
      "send_payment_confirmation"
    );
    assert.equal(paymentConfirm?.verificationGuard, "payment_verified");
  });
});

describe("Part 5 — Dynamic Message Personalization & Content Safety", () => {
  it("resolves known variables and leaves missing variables unresolved with a warning list", () => {
    const templateText =
      "Dear {{client_name}}, your registration for {{business_name}} (Cert: {{certificate_number}}) is ready.";
    const result = resolveTemplateVariables(templateText, {
      client_name: "Mrs. Funke Adeyemi",
      business_name: "Adeyemi Foods",
      // certificate_number intentionally omitted
    });

    assert.equal(result.hasUnresolvedVariables, true);
    assert.deepEqual(result.unresolvedTokens, ["{{certificate_number}}"]);
    assert.ok(result.resolvedText.includes("Mrs. Funke Adeyemi"));
    assert.ok(result.resolvedText.includes("Adeyemi Foods"));
    assert.ok(result.resolvedText.includes("{{certificate_number}}"));

    // Now supply manual override for certificate_number
    const resolvedAll = resolveTemplateVariables(
      templateText,
      {
        client_name: "Mrs. Funke Adeyemi",
        business_name: "Adeyemi Foods",
      },
      {
        manualOverrides: { certificate_number: "BN 9988776" },
      }
    );
    assert.equal(resolvedAll.hasUnresolvedVariables, false);
    assert.ok(resolvedAll.resolvedText.includes("BN 9988776"));
  });

  it("pulls payment instructions strictly from active BusinessBankAccount records and never invents accounts", () => {
    const emptyInstructions = formatApprovedPaymentInstructions([]);
    assert.equal(emptyInstructions, undefined);

    const validInstructions = formatApprovedPaymentInstructions([
      {
        account_slot: 1,
        bank_name: "Moniepoint MFB",
        account_name: "ABLEBIZ BUSINESS SERVICES",
        account_number: "8122399110",
        account_type: "Corporate Current",
        is_active: true,
        is_default: true,
      },
    ]);
    assert.ok(validInstructions?.includes("Moniepoint MFB"));
    assert.ok(validInstructions?.includes("ABLEBIZ BUSINESS SERVICES"));
    assert.ok(validInstructions?.includes("8122399110"));
  });

  it("blocks executable scripts, SQL statements, and invalid placeholder syntax in templates", () => {
    const safe = validateTemplateContentSafety(
      "Dear {{client_name}}, your {{service_name}} is in progress."
    );
    assert.equal(safe.isSafe, true);

    const xss = validateTemplateContentSafety(
      "Hello <script>alert(1)</script> {{client_name}}"
    );
    assert.equal(xss.isSafe, false);

    const sql = validateTemplateContentSafety(
      "Hello {{client_name}}; DROP TABLE clients;"
    );
    assert.equal(sql.isSafe, false);

    const badToken = validateTemplateContentSafety(
      "Hello {{client_name; alert(1)}}"
    );
    assert.equal(badToken.isSafe, false);
  });
});

describe("Parts 8, 9 & 10 — RBAC, Verification Guards & Template Protection", () => {
  it("enforces CAC approval, CAC submission, and payment verification guards", () => {
    const congratsTpl = INITIAL_MESSAGE_TEMPLATES.find(
      (t) => t.slug === "registration-approval-congratulations"
    )!;

    // Blocked when CAC stage is still in_progress / new_request
    const blockedCheck = checkTemplateVerificationGuard(congratsTpl, {
      clientName: "Test Client",
      cacStage: "application_submitted",
    });
    assert.equal(blockedCheck.allowed, false);
    assert.equal(blockedCheck.guardType, "cac_approved");

    // Allowed when CAC stage is approved
    const allowedCheck = checkTemplateVerificationGuard(congratsTpl, {
      clientName: "Test Client",
      cacStage: "approved",
    });
    assert.equal(allowedCheck.allowed, true);

    // Payment confirmation guard
    const paymentTpl = INITIAL_MESSAGE_TEMPLATES.find(
      (t) => t.slug === "payment-confirmation"
    )!;
    const unverifiedPayment = checkTemplateVerificationGuard(paymentTpl, {
      clientName: "Test Client",
      isPaymentVerified: false,
    });
    assert.equal(unverifiedPayment.allowed, false);

    const verifiedPayment = checkTemplateVerificationGuard(paymentTpl, {
      clientName: "Test Client",
      isPaymentVerified: true,
      receiptNumber: "RCP-2026-001",
    });
    assert.equal(verifiedPayment.allowed, true);
  });

  it("enforces least-privilege permissions across all 8 canonical roles", () => {
    assert.equal(canSendCommunication("super_admin"), true);
    assert.equal(canManageTemplates("super_admin"), true);
    assert.equal(canManageTemplates("admin"), true);
    assert.equal(
      canManageTemplates("operations_manager", "registration_updates"),
      true
    );
    assert.equal(
      canManageTemplates(
        "operations_manager",
        "payment_invoice_notifications"
      ),
      false
    );
    assert.equal(canManageTemplates("registration_officer"), false);
    assert.equal(canManageTemplates("accounts_officer"), false);
    assert.equal(canSendCommunication("viewer"), false);
    assert.equal(canUpdateClientContactInfo("viewer"), false);

    const financeTpl = INITIAL_MESSAGE_TEMPLATES.find(
      (t) => t.slug === "payment-confirmation"
    )!;
    assert.equal(canUseTemplate("accounts_officer", financeTpl), true);
    assert.equal(canUseTemplate("marketing_officer", financeTpl), false);
    assert.equal(canUseTemplate("viewer", financeTpl), false);
  });

  it("prevents hard-deletion of system seed or used templates, deactivating instead", async () => {
    const res = await deleteOrDeactivateTemplate(
      "tpl-doc-delivery-feedback",
      {
        staffId: "staff-1",
        staffName: "Admin User",
        role: "super_admin",
      }
    );
    assert.equal(res.success, true);
    assert.equal(res.actionTaken, "deactivated");
  });
});
