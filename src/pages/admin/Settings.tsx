import { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  Briefcase,
  Building,
  CheckCircle2,
  Download,
  FileText,
  Globe,
  Landmark,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone as PhoneIcon,
  Plus,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  UserCog,
  Zap,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useSiteConfig, type AutomationRule } from "../../referrals/siteConfig";
import { useBusinessProfile } from "../../lib/businessProfileContext";
import {
  type BusinessProfile,
  type BusinessBankAccount,
  formatBusinessAddress,
  normalizeNigerianPhone,
} from "../../types/businessProfile";
import {
  getEnrichedRedemptions,
  getLeads,
  getReferralClients,
  getReferralConversions,
} from "../../referrals/core";
import {
  AdminBadge,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminPage,
  AdminSection,
  AdminSelect,
  AdminStatCard,
  AdminSurface,
  AdminTabs,
  AdminTextarea,
} from "../../components/admin/AdminPrimitives";
import { Button } from "../../components/ui/Button";

type TabId =
  | "business"
  | "services"
  | "pricing"
  | "referral"
  | "gamification"
  | "automations"
  | "integrations"
  | "notifications"
  | "accounts";

export function AdminSettings() {
  const { user, profile, hasPermission } = useAuth();
  const {
    services,
    updateServices,
    pricing,
    updatePricing,
    referralTiers,
    updateReferralTiers,
    spinRewards,
    updateSpinRewards,
    automations,
    updateAutomations,
    flashCampaign,
    updateFlashCampaign,
    resetAll,
  } = useSiteConfig();

  const {
    profile: bizProfile,
    bankAccounts: bizBankAccounts,
    updateProfile: saveBizProfile,
    updateBankAccounts: saveBizBankAccounts,
  } = useBusinessProfile();

  const [activeTab, setActiveTab] = useState<TabId>("business");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingBiz, setIsSavingBiz] = useState(false);

  // Business Profile Form Local State
  const [bizFormData, setBizFormData] = useState<BusinessProfile>(bizProfile);
  const [bankFormData, setBankFormData] = useState<BusinessBankAccount[]>(bizBankAccounts);
  const [hasUnsavedBiz, setHasUnsavedBiz] = useState(false);

  // Sync form state when remote authoritative profile loads/updates
  useEffect(() => {
    setBizFormData(bizProfile);
  }, [bizProfile]);

  useEffect(() => {
    // Ensure we have 2 bank slots represented in the state
    const slot1 = bizBankAccounts.find((a) => a.account_slot === 1) || {
      account_slot: 1,
      bank_name: "",
      account_name: "",
      account_number: "",
      account_type: "Corporate Current",
      is_active: true,
      is_default: true,
      notes: "Primary settlement account",
    };

    const slot2 = bizBankAccounts.find((a) => a.account_slot === 2) || {
      account_slot: 2,
      bank_name: "",
      account_name: "",
      account_number: "",
      account_type: "Corporate Current",
      is_active: false,
      is_default: false,
      notes: "Secondary reserve account",
    };

    setBankFormData([slot1, slot2]);
  }, [bizBankAccounts]);

  // Notifications state
  const [notifPhone, setNotifPhone] = useState(() => localStorage.getItem("ablebiz_notif_phone") || "");
  const [notifEnabled, setNotifEnabled] = useState(
    () => localStorage.getItem("ablebiz_notif_enabled") !== "false"
  );
  const [autoReply, setAutoReply] = useState(
    () =>
      localStorage.getItem("ablebiz_notif_autoreply") ||
      "Thank you for reaching out to ABLEBIZ. We'll get back to you within 2 hours."
  );

  const isSuper =
    user?.role === "super_admin" ||
    (user?.role as string) === "managing_director" ||
    (user?.role as string) === "superadmin";

  const canEditSettings =
    isSuper ||
    profile?.role === "admin" ||
    hasPermission("settings", "edit");

  const canViewSettings =
    isSuper ||
    profile?.role === "admin" ||
    hasPermission("settings", "view");

  const triggerSave = (message = "Settings saved.") => {
    setSaveStatus(message);
    setSaveError(null);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const saveNotifications = () => {
    localStorage.setItem("ablebiz_notif_phone", notifPhone);
    localStorage.setItem("ablebiz_notif_enabled", String(notifEnabled));
    localStorage.setItem("ablebiz_notif_autoreply", autoReply);
    triggerSave("Notification settings saved.");
  };

  // Authoritative Business Profile & Bank Accounts Save Handler
  const handleSaveBusinessProfile = async () => {
    if (!canEditSettings) {
      setSaveError("You do not have permission to modify the business profile.");
      return;
    }

    setSaveError(null);
    setIsSavingBiz(true);

    try {
      // 1. Validation
      if (!bizFormData.legal_name.trim()) {
        throw new Error("Legal business name is required.");
      }
      if (!bizFormData.primary_phone.trim()) {
        throw new Error("Primary phone number is required.");
      }
      if (!bizFormData.primary_email.trim() || !bizFormData.primary_email.includes("@")) {
        throw new Error("A valid primary email address is required.");
      }

      // Auto-compute normalized WhatsApp international number if entered
      const normalizedWhatsapp = normalizeNigerianPhone(bizFormData.whatsapp_number);
      const profileToSave: Partial<BusinessProfile> = {
        ...bizFormData,
        whatsapp_number_intl: normalizedWhatsapp || bizFormData.whatsapp_number_intl,
      };

      // 2. Validate Bank Accounts
      const activeBanks = bankFormData.filter((b) => b.is_active);
      if (activeBanks.length === 0) {
        throw new Error("At least one active bank account must be configured for billing and remittance.");
      }

      for (const bank of activeBanks) {
        if (!bank.bank_name.trim()) {
          throw new Error(`Bank Account ${bank.account_slot}: Bank name is required.`);
        }
        if (!bank.account_name.trim()) {
          throw new Error(`Bank Account ${bank.account_slot}: Account name is required.`);
        }
        const nuban = bank.account_number.trim();
        if (!/^\d{10}$/.test(nuban)) {
          throw new Error(`Bank Account ${bank.account_slot}: Account number must be a 10-digit NUBAN.`);
        }
      }

      const defaultCount = activeBanks.filter((b) => b.is_default).length;
      if (defaultCount !== 1) {
        throw new Error("Exactly ONE active bank account must be designated as the default settlement account.");
      }

      // 3. Save to Supabase (Authoritative)
      const profRes = await saveBizProfile(profileToSave);
      if (!profRes.success) {
        throw new Error(profRes.error || "Failed to save business profile to Supabase.");
      }

      const bankRes = await saveBizBankAccounts(bankFormData);
      if (!bankRes.success) {
        throw new Error(bankRes.error || "Failed to save bank accounts to Supabase.");
      }

      setHasUnsavedBiz(false);
      triggerSave("Authoritative Business Profile & Bank Accounts saved to Supabase successfully.");
    } catch (err: any) {
      console.error("[BusinessProfile Save] Error:", err);
      setSaveError(err.message || "Failed to save business profile.");
    } finally {
      setIsSavingBiz(false);
    }
  };

  const exportAllData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      clients: getReferralClients(),
      leads: getLeads(),
      conversions: getReferralConversions(),
      redemptions: getEnrichedRedemptions(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ablebiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    triggerSave("Backup exported.");
  };

  const clearDataCategory = (key: string, label: string) => {
    if (!confirm(`Are you sure you want to delete all ${label}? This cannot be undone.`)) return;
    localStorage.removeItem(key);
    triggerSave(`${label} cleared.`);
    setTimeout(() => window.location.reload(), 500);
  };

  if (!canViewSettings) {
    return (
      <AdminPage
        eyebrow="Restricted"
        title="Settings"
        description="These controls are available only to authorized administration staff."
      >
        <AdminEmptyState
          icon={ShieldCheck}
          title="Access Restricted"
          description="Your current staff role does not have authorization to view system-wide settings."
        />
      </AdminPage>
    );
  }

  const tabs = [
    { value: "business" as const, label: "Business Profile", icon: Building },
    { value: "services" as const, label: "Services", icon: Briefcase },
    { value: "pricing" as const, label: "Pricing", icon: Tag },
    { value: "referral" as const, label: "Referrals", icon: Zap },
    { value: "gamification" as const, label: "Game", icon: RefreshCcw },
    { value: "automations" as const, label: "Automations", icon: Activity },
    { value: "integrations" as const, label: "Integrations", icon: MessageSquare },
    { value: "notifications" as const, label: "Notifications", icon: Bell },
    { value: "accounts" as const, label: "Admin Access", icon: UserCog },
  ];

  return (
    <AdminPage
      eyebrow="System settings"
      title="Settings"
      description="Manage authoritative business profile, bank accounts, services, referrals, and access controls."
      actions={<AdminTabs value={activeTab} onChange={setActiveTab} items={tabs} />}
    >
      {saveStatus ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      ) : null}

      {saveError ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Current Operator" value={user?.name || "Staff"} icon={UserCog} tone="info" />
        <AdminStatCard
          label="Account Status"
          value={profile?.is_active ? "Active" : "Disabled"}
          icon={ShieldCheck}
          tone="success"
        />
        <AdminStatCard label="Services configured" value={services.length} icon={Briefcase} tone="default" />
        <AdminStatCard label="Automation rules" value={automations.length} icon={Activity} tone="warning" />
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: AUTHORITATIVE BUSINESS PROFILE & BANK ACCOUNTS                */}
      {/* ===================================================================== */}
      {activeTab === "business" ? (
        <div className="space-y-8">
          {/* Top Action Bar with Unsaved State and Save Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Authoritative Business Profile</h2>
                {hasUnsavedBiz ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                    Unsaved changes
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    Synchronized with Supabase
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved values persist immediately to Supabase and propagate to the public website, documents, invoices, quotations, and receipts.
              </p>
            </div>

            {canEditSettings && (
              <Button
                size="sm"
                onClick={handleSaveBusinessProfile}
                disabled={isSavingBiz}
                className="bg-[#0A2558] text-white hover:bg-[#061738] shrink-0"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {isSavingBiz ? "Saving to Supabase..." : "Save Business Profile"}
              </Button>
            )}
          </div>

          {/* Section A: Basic Business Information */}
          <AdminSection
            title="A. Basic Business Information"
            description="Statutory legal name, display identity, and corporate registration particulars."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Legal / Registered Business Name *">
                <AdminInput
                  value={bizFormData.legal_name}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, legal_name: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. ABLEBIZ Business Services"
                />
              </AdminField>

              <AdminField label="Trading / Display Name *">
                <AdminInput
                  value={bizFormData.trading_name}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, trading_name: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. ABLEBIZ Business Services"
                />
              </AdminField>

              <AdminField label="Business Type / Entity Structure">
                <AdminInput
                  value={bizFormData.business_type}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, business_type: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Business Name / Enterprise"
                />
              </AdminField>

              <AdminField label="Year Established">
                <AdminInput
                  value={bizFormData.year_established}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, year_established: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. 2019"
                />
              </AdminField>

              <AdminField label="CAC Registration Number (BN / RC)">
                <AdminInput
                  value={bizFormData.cac_registration_number}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, cac_registration_number: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="Leave empty until officially verified"
                />
              </AdminField>

              <AdminField label="CAC Accredited Agent Number">
                <AdminInput
                  value={bizFormData.cac_accredited_agent_number}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, cac_accredited_agent_number: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="Leave empty until officially verified"
                />
              </AdminField>

              <AdminField label="Tax Identification Number (TIN)">
                <AdminInput
                  value={bizFormData.tax_identification_number}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, tax_identification_number: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="Leave empty until officially verified"
                />
              </AdminField>

              <AdminField label="Award / Trust Badge Text">
                <AdminInput
                  value={bizFormData.award_badge}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, award_badge: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. 🏆 2nd Place – BYUMS Africa Business Plan Competition"
                />
              </AdminField>
            </div>

            <div className="mt-4">
              <AdminField label="Business Tagline">
                <AdminTextarea
                  value={bizFormData.tagline}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, tagline: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="Short compelling description of what the business does"
                />
              </AdminField>
            </div>

            <div className="mt-4">
              <AdminField label="Full Business Description (Corporate Overview)">
                <AdminTextarea
                  value={bizFormData.business_description}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, business_description: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="Comprehensive description of business operations and services"
                />
              </AdminField>
            </div>
          </AdminSection>

          {/* Section B: Contact Information */}
          <AdminSection
            title="B. Contact Information"
            description="Communication channels used for customer engagement and document generation."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <AdminField label="Primary Phone *" icon={PhoneIcon}>
                <AdminInput
                  value={bizFormData.primary_phone}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, primary_phone: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. 08160486023"
                />
              </AdminField>

              <AdminField label="Secondary Phone" icon={PhoneIcon}>
                <AdminInput
                  value={bizFormData.secondary_phone}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, secondary_phone: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="Optional secondary phone"
                />
              </AdminField>

              <AdminField label="WhatsApp Number *" icon={PhoneIcon}>
                <AdminInput
                  value={bizFormData.whatsapp_number}
                  onChange={(e) => {
                    const norm = normalizeNigerianPhone(e.target.value);
                    setBizFormData({
                      ...bizFormData,
                      whatsapp_number: e.target.value,
                      whatsapp_number_intl: norm || bizFormData.whatsapp_number_intl,
                    });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. 08160486023"
                />
              </AdminField>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <AdminField label="Primary Email *" icon={Mail}>
                <AdminInput
                  type="email"
                  value={bizFormData.primary_email}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, primary_email: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. hello@ablebiz.com.ng"
                />
              </AdminField>

              <AdminField label="Secondary / Operations Email" icon={Mail}>
                <AdminInput
                  type="email"
                  value={bizFormData.secondary_email}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, secondary_email: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. info@ablebiz.com.ng"
                />
              </AdminField>

              <AdminField label="Support / Inquiries Email" icon={Mail}>
                <AdminInput
                  type="email"
                  value={bizFormData.support_email}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, support_email: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. support@ablebiz.com.ng"
                />
              </AdminField>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <AdminField label="Official Website URL" icon={Globe}>
                <AdminInput
                  value={bizFormData.website_url}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, website_url: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="https://www.ablebiz.com.ng"
                />
              </AdminField>

              <AdminField label="Normalized WhatsApp International">
                <AdminInput
                  value={bizFormData.whatsapp_number_intl}
                  readOnly
                  className="bg-slate-50 font-mono text-slate-500"
                />
              </AdminField>
            </div>
          </AdminSection>

          {/* Section C: Business Address */}
          <AdminSection
            title="C. Business Address"
            description="Physical corporate office location rendered on invoices, quotes, and public pages."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Address Line 1 *" icon={MapPin}>
                <AdminInput
                  value={bizFormData.address_line_1}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, address_line_1: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Along M.K.O. Abiola Way"
                />
              </AdminField>

              <AdminField label="Address Line 2 (Area / Landmark)">
                <AdminInput
                  value={bizFormData.address_line_2}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, address_line_2: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Leme"
                />
              </AdminField>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <AdminField label="City *">
                <AdminInput
                  value={bizFormData.city}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, city: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Abeokuta"
                />
              </AdminField>

              <AdminField label="LGA">
                <AdminInput
                  value={bizFormData.lga}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, lga: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Abeokuta South"
                />
              </AdminField>

              <AdminField label="State *">
                <AdminInput
                  value={bizFormData.state}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, state: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Ogun State"
                />
              </AdminField>

              <AdminField label="Country *">
                <AdminInput
                  value={bizFormData.country}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, country: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Nigeria"
                />
              </AdminField>
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Formatted Address Preview: </span>
              <span>{formatBusinessAddress(bizFormData)}</span>
            </div>
          </AdminSection>

          {/* Section D: Bank Accounts (2 Slots) */}
          <AdminSection
            title="D. Business Bank Accounts"
            description="Manage official bank accounts for client invoice remittance and payment reconciliation. Protected by Row-Level Security."
          >
            <div className="space-y-6">
              {bankFormData.map((acc, index) => {
                const isSlot1 = acc.account_slot === 1;
                return (
                  <AdminSurface
                    key={acc.account_slot}
                    className={`p-5 rounded-2xl border ${
                      acc.is_default && acc.is_active
                        ? "border-emerald-300 bg-emerald-50/20"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-[#0A2558]" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Bank Account Slot {acc.account_slot} {isSlot1 ? "(Primary / Required)" : "(Secondary / Optional)"}
                        </h3>
                        {acc.is_default && acc.is_active && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            DEFAULT SETTLEMENT
                          </span>
                        )}
                        {!acc.is_active && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                            INACTIVE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acc.is_active}
                            disabled={!canEditSettings || (isSlot1 && acc.is_default)}
                            onChange={(e) => {
                              const next = [...bankFormData];
                              next[index] = { ...next[index], is_active: e.target.checked };
                              if (!e.target.checked && next[index].is_default) {
                                next[index].is_default = false;
                                // If deactivating default slot 2, fallback slot 1 to default
                                const other = next[index === 0 ? 1 : 0];
                                if (other) other.is_default = true;
                              }
                              setBankFormData(next);
                              setHasUnsavedBiz(true);
                            }}
                            className="rounded border-slate-300 text-[#0A2558] focus:ring-[#0A2558]"
                          />
                          <span>Active</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="default_settlement"
                            checked={acc.is_default && acc.is_active}
                            disabled={!canEditSettings || !acc.is_active}
                            onChange={() => {
                              const next = bankFormData.map((b, i) => ({
                                ...b,
                                is_default: i === index,
                              }));
                              setBankFormData(next);
                              setHasUnsavedBiz(true);
                            }}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Default Settlement</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <AdminField label="Bank Name *">
                        <AdminInput
                          value={acc.bank_name}
                          onChange={(e) => {
                            const next = [...bankFormData];
                            next[index] = { ...next[index], bank_name: e.target.value };
                            setBankFormData(next);
                            setHasUnsavedBiz(true);
                          }}
                          disabled={!canEditSettings || !acc.is_active}
                          placeholder="e.g. Access Bank / Moniepoint MFB"
                        />
                      </AdminField>

                      <AdminField label="Account Name *">
                        <AdminInput
                          value={acc.account_name}
                          onChange={(e) => {
                            const next = [...bankFormData];
                            next[index] = { ...next[index], account_name: e.target.value };
                            setBankFormData(next);
                            setHasUnsavedBiz(true);
                          }}
                          disabled={!canEditSettings || !acc.is_active}
                          placeholder="e.g. Ablebiz Business Services"
                        />
                      </AdminField>

                      <AdminField label="Account Number / NUBAN (10 digits) *">
                        <AdminInput
                          value={acc.account_number}
                          maxLength={10}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            const next = [...bankFormData];
                            next[index] = { ...next[index], account_number: digits };
                            setBankFormData(next);
                            setHasUnsavedBiz(true);
                          }}
                          disabled={!canEditSettings || !acc.is_active}
                          placeholder="10-digit NUBAN"
                          className="font-mono tracking-wider"
                        />
                      </AdminField>

                      <AdminField label="Account Type">
                        <AdminInput
                          value={acc.account_type}
                          onChange={(e) => {
                            const next = [...bankFormData];
                            next[index] = { ...next[index], account_type: e.target.value };
                            setBankFormData(next);
                            setHasUnsavedBiz(true);
                          }}
                          disabled={!canEditSettings || !acc.is_active}
                          placeholder="e.g. Corporate Current"
                        />
                      </AdminField>
                    </div>

                    <div className="mt-3">
                      <AdminField label="Remittance Notes / Instructions">
                        <AdminInput
                          value={acc.notes || ""}
                          onChange={(e) => {
                            const next = [...bankFormData];
                            next[index] = { ...next[index], notes: e.target.value };
                            setBankFormData(next);
                            setHasUnsavedBiz(true);
                          }}
                          disabled={!canEditSettings || !acc.is_active}
                          placeholder="e.g. Use invoice number as transfer narration"
                        />
                      </AdminField>
                    </div>
                  </AdminSurface>
                );
              })}
            </div>
          </AdminSection>

          {/* Section E: Document & Identity Configuration */}
          <AdminSection
            title="E. Document & Financial Identity"
            description="Control default payment terms, remittance notes, and disclaimers applied to generated financial documents."
          >
            <div className="space-y-4">
              <AdminField label="Default Invoice / Quotation Payment Terms *">
                <AdminTextarea
                  value={bizFormData.default_payment_terms}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, default_payment_terms: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Payment due within 7 days of invoice issuance. Remit to designated official settlement account."
                />
              </AdminField>

              <AdminField label="Document Legal Disclaimer">
                <AdminTextarea
                  value={bizFormData.document_disclaimer}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, document_disclaimer: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Computer-generated official business document. CAC compliance and operational filings commence following payment reconciliation."
                />
              </AdminField>

              <AdminField label="Document Footer Note">
                <AdminInput
                  value={bizFormData.document_footer_text}
                  onChange={(e) => {
                    setBizFormData({ ...bizFormData, document_footer_text: e.target.value });
                    setHasUnsavedBiz(true);
                  }}
                  disabled={!canEditSettings}
                  placeholder="e.g. Physical office along M.K.O. Abiola Way, Leme, Abeokuta. Nationwide digital service delivery."
                />
              </AdminField>
            </div>
          </AdminSection>

          {/* Bottom Save Action */}
          {canEditSettings && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                size="md"
                onClick={handleSaveBusinessProfile}
                disabled={isSavingBiz}
                className="bg-[#0A2558] text-white hover:bg-[#061738]"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {isSavingBiz ? "Saving Changes to Supabase..." : "Save Business Profile"}
              </Button>
            </div>
          )}

          {/* Data Backups & Reset */}
          <div className="grid gap-6 lg:grid-cols-2 pt-6 border-t border-slate-200">
            <AdminSection title="Data backups" description="Export or clear stored referral and lead records.">
              <div className="space-y-4">
                <button type="button" className="admin-button-secondary w-full justify-start" onClick={exportAllData}>
                  <Download className="h-4 w-4" />
                  Download full backup
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "ablebiz_ref_clients", label: "Clients list" },
                    { key: "ablebiz_leads", label: "Consultation leads" },
                    { key: "ablebiz_ref_conversions", label: "Referral records" },
                    { key: "ablebiz_ref_redemptions", label: "Reward history" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => clearDataCategory(item.key, item.label)}
                      className="admin-button-secondary justify-start text-[var(--admin-danger-fg)]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </AdminSection>

            <AdminSection title="Reset system defaults" description="Return application configuration to original coded defaults.">
              <div className="space-y-4">
                <p className="admin-page-description max-w-none">
                  This resets services, pricing, and campaign settings. Export a backup first if you may need to restore current state later.
                </p>
                <button
                  type="button"
                  className="admin-button-secondary text-[var(--admin-danger-fg)]"
                  onClick={() => {
                    if (confirm("Reset services and referral settings back to default values?")) {
                      resetAll();
                      setTimeout(() => window.location.reload(), 300);
                    }
                  }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset system settings
                </button>
              </div>
            </AdminSection>
          </div>
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 2: SERVICES                                                       */}
      {/* ===================================================================== */}
      {activeTab === "services" ? (
        <AdminSection
          title="Service offerings"
          description="Edit the services shown to users."
          actions={
            <Button size="sm" onClick={() => triggerSave("Service settings saved.")}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          }
        >
          <div className="space-y-4">
            {services.map((service, index) => (
              <AdminSurface key={service.id} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto]">
                  <AdminField label={`Service ${index + 1} title`}>
                    <AdminInput
                      value={service.title}
                      onChange={(event) => {
                        const next = [...services];
                        next[index].title = event.target.value;
                        updateServices(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Short summary">
                    <AdminInput
                      value={service.short || ""}
                      onChange={(event) => {
                        const next = [...services];
                        next[index].short = event.target.value;
                        updateServices(next);
                      }}
                    />
                  </AdminField>
                  <button
                    type="button"
                    className="admin-button-secondary self-end text-[var(--admin-danger-fg)]"
                    onClick={() => updateServices(services.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
                <div className="mt-4">
                  <AdminField label="Description">
                    <AdminTextarea
                      value={service.description || ""}
                      onChange={(event) => {
                        const next = [...services];
                        next[index].description = event.target.value;
                        updateServices(next);
                      }}
                    />
                  </AdminField>
                </div>
              </AdminSurface>
            ))}
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() =>
                updateServices([
                  ...services,
                  {
                    id: `service_${Date.now()}`,
                    title: "New service",
                    short: "Short description",
                    description: "Full service description",
                    icon: "briefcase",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add service
            </button>
          </div>
        </AdminSection>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 3: PRICING                                                        */}
      {/* ===================================================================== */}
      {activeTab === "pricing" ? (
        <AdminSection
          title="Pricing packages"
          description="Maintain public price points, inclusions, and highlights."
          actions={
            <Button size="sm" onClick={() => triggerSave("Pricing saved.")}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            {pricing.map((tier, index) => (
              <AdminSurface key={tier.name} className="flex flex-col justify-between p-4">
                <div className="space-y-4">
                  <AdminField label="Plan title">
                    <AdminInput
                      value={tier.name}
                      onChange={(event) => {
                        const next = [...pricing];
                        next[index].name = event.target.value;
                        updatePricing(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Price label">
                    <AdminInput
                      value={tier.price}
                      onChange={(event) => {
                        const next = [...pricing];
                        next[index].price = event.target.value;
                        updatePricing(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Summary">
                    <AdminTextarea
                      value={tier.description}
                      onChange={(event) => {
                        const next = [...pricing];
                        next[index].description = event.target.value;
                        updatePricing(next);
                      }}
                    />
                  </AdminField>
                </div>
              </AdminSurface>
            ))}
          </div>
        </AdminSection>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 4: REFERRAL TIERS                                                 */}
      {/* ===================================================================== */}
      {activeTab === "referral" ? (
        <div className="grid gap-6">
          <AdminSection
            title="Referral milestones"
            description="Milestones that unlock rewards for referrers."
            actions={
              <Button size="sm" onClick={() => triggerSave("Referral rules saved.")}>
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            }
          >
            <div className="space-y-4">
              {referralTiers.map((tier, index) => (
                <AdminSurface key={index} className="p-4">
                  <div className="grid gap-4 md:grid-cols-[140px_1fr_1fr_auto]">
                    <AdminField label="Threshold">
                      <AdminInput
                        type="number"
                        value={tier.referralsRequired}
                        onChange={(event) => {
                          const next = [...referralTiers];
                          next[index].referralsRequired = Number(event.target.value);
                          updateReferralTiers(next);
                        }}
                      />
                    </AdminField>
                    <AdminField label="Reward title">
                      <AdminInput
                        value={tier.title}
                        onChange={(event) => {
                          const next = [...referralTiers];
                          next[index].title = event.target.value;
                          updateReferralTiers(next);
                        }}
                      />
                    </AdminField>
                    <AdminField label="Summary note">
                      <AdminInput
                        value={tier.note}
                        onChange={(event) => {
                          const next = [...referralTiers];
                          next[index].note = event.target.value;
                          updateReferralTiers(next);
                        }}
                      />
                    </AdminField>
                    <button
                      type="button"
                      className="admin-button-secondary self-end text-[var(--admin-danger-fg)]"
                      onClick={() => updateReferralTiers(referralTiers.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </AdminSurface>
              ))}
              <button
                type="button"
                className="admin-button-secondary"
                onClick={() =>
                  updateReferralTiers([
                    ...referralTiers,
                    { referralsRequired: 15, title: "VIP Access", note: "VIP handling on next service." },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Add milestone
              </button>
            </div>
          </AdminSection>

          <AdminSection
            title="Flash referral campaign"
            description="Temporarily boost points earned from referrals."
            actions={
              <Button size="sm" onClick={() => triggerSave("Campaign saved.")}>
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <AdminField label="Campaign active">
                <AdminSelect
                  value={flashCampaign.active ? "yes" : "no"}
                  onChange={(event) =>
                    updateFlashCampaign({ ...flashCampaign, active: event.target.value === "yes" })
                  }
                >
                  <option value="no">Inactive</option>
                  <option value="yes">Active</option>
                </AdminSelect>
              </AdminField>
              <AdminField label="Points multiplier">
                <AdminInput
                  type="number"
                  min="1"
                  max="5"
                  value={flashCampaign.multiplier}
                  onChange={(event) =>
                    updateFlashCampaign({ ...flashCampaign, multiplier: Number(event.target.value) })
                  }
                />
              </AdminField>
              <AdminField label="Campaign label">
                <AdminInput
                  value={flashCampaign.name}
                  onChange={(event) => updateFlashCampaign({ ...flashCampaign, name: event.target.value })}
                />
              </AdminField>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 5: GAMIFICATION                                                   */}
      {/* ===================================================================== */}
      {activeTab === "gamification" ? (
        <AdminSection
          title="Spin the wheel rewards"
          description="Control available prizes and their relative probability weights."
          actions={
            <Button size="sm" onClick={() => triggerSave("Wheel prizes saved.")}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          }
        >
          <div className="space-y-4">
            {spinRewards.map((reward, index) => (
              <AdminSurface key={reward.type} className="p-4">
                <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_120px]">
                  <AdminField label="Prize label">
                    <AdminInput
                      value={reward.title}
                      onChange={(event) => {
                        const next = [...spinRewards];
                        next[index].title = event.target.value;
                        updateSpinRewards(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Summary">
                    <AdminInput
                      value={reward.short}
                      onChange={(event) => {
                        const next = [...spinRewards];
                        next[index].short = event.target.value;
                        updateSpinRewards(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Chance weight">
                    <AdminInput
                      type="number"
                      value={reward.weight}
                      onChange={(event) => {
                        const next = [...spinRewards];
                        next[index].weight = Number(event.target.value);
                        updateSpinRewards(next);
                      }}
                    />
                  </AdminField>
                </div>
              </AdminSurface>
            ))}
          </div>
        </AdminSection>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 6: AUTOMATIONS                                                    */}
      {/* ===================================================================== */}
      {activeTab === "automations" ? (
        <AdminSection
          title="Trigger-based automation rules"
          description="Set up automatic actions that run when leads, referrals, or rewards are generated."
          actions={
            <Button size="sm" onClick={() => triggerSave("Automation rules saved.")}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          }
        >
          <div className="space-y-4">
            {automations.map((rule, index) => (
              <AdminSurface key={rule.id} className="p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <AdminField label="Rule name">
                    <AdminInput
                      value={rule.name}
                      onChange={(event) => {
                        const next = [...automations];
                        next[index].name = event.target.value;
                        updateAutomations(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Trigger event">
                    <AdminSelect
                      value={rule.trigger}
                      onChange={(event) => {
                        const next = [...automations];
                        next[index].trigger = event.target.value as AutomationRule["trigger"];
                        updateAutomations(next);
                      }}
                    >
                      <option value="new_lead">New consultation lead</option>
                      <option value="new_referral">New referral added</option>
                      <option value="spin_won">Reward spin completed</option>
                    </AdminSelect>
                  </AdminField>
                  <AdminField label="Action">
                    <AdminSelect
                      value={rule.action}
                      onChange={(event) => {
                        const next = [...automations];
                        next[index].action = event.target.value as AutomationRule["action"];
                        updateAutomations(next);
                      }}
                    >
                      <option value="add_points">Grant bonus points</option>
                      <option value="assign_group">Assign segment</option>
                    </AdminSelect>
                  </AdminField>
                  <AdminField label="Action value">
                    <AdminInput
                      value={rule.actionValue}
                      onChange={(event) => {
                        const next = [...automations];
                        next[index].actionValue = event.target.value;
                        updateAutomations(next);
                      }}
                    />
                  </AdminField>
                </div>
              </AdminSurface>
            ))}
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() =>
                updateAutomations([
                  ...automations,
                  {
                    id: `auto_${Date.now()}`,
                    name: "Welcome bonus points",
                    trigger: "new_referral",
                    action: "add_points",
                    actionValue: "50",
                    active: true,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add automation rule
            </button>
          </div>
        </AdminSection>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 7: INTEGRATIONS                                                   */}
      {/* ===================================================================== */}
      {activeTab === "integrations" ? (
        <AdminSection title="External services & webhooks" description="Configure webhook destinations for events.">
          <div className="grid gap-6 md:grid-cols-2">
            <AdminSurface className="p-4 space-y-4">
              <div>
                <p className="admin-title-sm">Zapier & Make integration</p>
                <p className="admin-page-description mt-1">Post new leads to an external webhook URL.</p>
              </div>
              <AdminField label="Target webhook URL">
                <AdminInput placeholder="https://hooks.zapier.com/hooks/catch/..." />
              </AdminField>
              <Button size="sm" onClick={() => triggerSave("Integration saved.")}>
                Save webhook
              </Button>
            </AdminSurface>

            <AdminSurface className="p-4 space-y-4">
              <div>
                <p className="admin-title-sm">WhatsApp Business notifications</p>
                <p className="admin-page-description mt-1">Direct alerts to staff WhatsApp numbers.</p>
              </div>
              <AdminField label="Staff WhatsApp number">
                <AdminInput placeholder="2348160486023" />
              </AdminField>
              <Button size="sm" onClick={() => triggerSave("Integration saved.")}>
                Save settings
              </Button>
            </AdminSurface>
          </div>
        </AdminSection>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 8: NOTIFICATIONS                                                  */}
      {/* ===================================================================== */}
      {activeTab === "notifications" ? (
        <div className="grid gap-6">
          <AdminSection
            title="Notification alerts"
            description="Manage staff delivery targets and client autoreplies."
            actions={
              <Button size="sm" onClick={saveNotifications}>
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Staff alert phone number" icon={PhoneIcon}>
                <AdminInput
                  value={notifPhone}
                  onChange={(event) => setNotifPhone(event.target.value)}
                  placeholder="2348160486023"
                />
              </AdminField>
              <AdminField label="Alerts enabled">
                <AdminSelect
                  value={notifEnabled ? "yes" : "no"}
                  onChange={(event) => setNotifEnabled(event.target.value === "yes")}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </AdminSelect>
              </AdminField>
            </div>
            <div className="mt-4">
              <AdminField label="Client automatic reply">
                <AdminTextarea value={autoReply} onChange={(event) => setAutoReply(event.target.value)} />
              </AdminField>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* TAB 9: ADMIN ACCESS & RBAC                                            */}
      {/* ===================================================================== */}
      {activeTab === "accounts" ? (
        <div className="grid gap-6">
          <AdminSection title="Active Staff Identity" description="Database-backed profile verified via Supabase Auth and Row-Level Security.">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Full Name", value: profile?.full_name || user?.name || "-" },
                { label: "Email Address", value: profile?.email || user?.email || "-" },
                { label: "Assigned Role", value: profile?.role?.replace(/_/g, " ") || user?.role?.replace(/_/g, " ") || "-" },
                { label: "Department", value: profile?.department || user?.department || "-" },
                { label: "Phone", value: profile?.phone || "Not set" },
                { label: "Status", value: profile?.is_active ? "Active" : "Inactive" },
              ].map((item) => (
                <AdminSurface key={item.label} className="p-4">
                  <p className="admin-kicker">{item.label}</p>
                  <p className="admin-title-sm mt-2 capitalize">{item.value}</p>
                </AdminSurface>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="Role-Based Access Control (RBAC)" description="Security controls are enforced directly by PostgreSQL database Row-Level Security (RLS).">
            <AdminSurface className="p-5">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Enterprise Access Control Active</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      User roles and operational permissions are managed through the database <code className="font-mono text-amber-500">public.staff_profiles</code> and <code className="font-mono text-amber-500">public.roles_permissions</code> tables.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-4 text-xs text-[var(--text-secondary)] space-y-2">
                  <p>
                    <strong>Security Policy:</strong> Passwords and staff authentication are cryptographically handled by Supabase Auth (`auth.users`).
                  </p>
                  <p>
                    Staff invitations, role promotions, and privilege elevation can only be executed by administrators with direct database or managerial access. Client-side role spoofing is strictly prevented by Supabase RLS.
                  </p>
                </div>
              </div>
            </AdminSurface>
          </AdminSection>
        </div>
      ) : null}
    </AdminPage>
  );
}
