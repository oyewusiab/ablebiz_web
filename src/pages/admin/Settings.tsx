import { useState } from "react";
import {
  Activity,
  Bell,
  Briefcase,
  Download,
  Globe,
  Key,
  Lock,
  MessageSquare,
  Phone as PhoneIcon,
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
import { useSiteConfig } from "../../referrals/siteConfig";
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
  | "general"
  | "services"
  | "pricing"
  | "referral"
  | "gamification"
  | "automations"
  | "integrations"
  | "notifications"
  | "accounts";

export function AdminSettings() {
  const { user, users, addUser, updateUser, removeUser, updateUserPassword } = useAuth();
  const {
    site,
    updateSite,
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

  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin" as "admin" | "superadmin",
  });
  const [userMessage, setUserMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [notifPhone, setNotifPhone] = useState(() => localStorage.getItem("ablebiz_notif_phone") || "");
  const [notifEnabled, setNotifEnabled] = useState(
    () => localStorage.getItem("ablebiz_notif_enabled") !== "false"
  );
  const [autoReply, setAutoReply] = useState(
    () =>
      localStorage.getItem("ablebiz_notif_autoreply") ||
      "Thank you for reaching out to ABLEBIZ. We'll get back to you within 2 hours."
  );

  const isSuper = user?.role === "superadmin";

  const triggerSave = (message = "Settings saved.") => {
    setSaveStatus(message);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const saveNotifications = () => {
    localStorage.setItem("ablebiz_notif_phone", notifPhone);
    localStorage.setItem("ablebiz_notif_enabled", String(notifEnabled));
    localStorage.setItem("ablebiz_notif_autoreply", autoReply);
    triggerSave("Notification settings saved.");
  };

  const handlePasswordChange = () => {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: "Passwords do not match." });
      return;
    }
    const result = updateUserPassword(user.id, newPassword);
    setPasswordMsg({ type: result.ok ? "ok" : "err", text: result.message });
    if (result.ok) {
      setNewPassword("");
      setConfirmPassword("");
    }
    setTimeout(() => setPasswordMsg(null), 3000);
  };

  const handleCreateUser = () => {
    const result = addUser(newUser);
    setUserMessage({ type: result.ok ? "ok" : "err", text: result.message });
    if (result.ok) {
      setNewUser({ name: "", email: "", password: "", role: "admin" });
    }
    setTimeout(() => setUserMessage(null), 3000);
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

  if (!isSuper) {
    return (
      <AdminPage
        eyebrow="Restricted"
        title="Settings"
        description="These controls are available only to the superadmin role."
      >
        <AdminEmptyState
          icon={ShieldCheck}
          title="Superadmin access required"
          description="Your current account can view the portal, but only the superadmin can change system-wide settings."
        />
      </AdminPage>
    );
  }

  const tabs = [
    { value: "general" as const, label: "General", icon: Globe },
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
      description="Manage core configuration, referral rules, integrations, and admin-level preferences."
      actions={<AdminTabs value={activeTab} onChange={setActiveTab} items={tabs} />}
    >
      {saveStatus ? <AdminBadge tone="success">{saveStatus}</AdminBadge> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Admin users" value={users.length} icon={UserCog} tone="info" />
        <AdminStatCard
          label="Active users"
          value={users.filter((item) => item.active).length}
          icon={ShieldCheck}
          tone="success"
        />
        <AdminStatCard label="Services configured" value={services.length} icon={Briefcase} tone="default" />
        <AdminStatCard label="Automation rules" value={automations.length} icon={Activity} tone="warning" />
      </div>

      {activeTab === "general" ? (
        <div className="grid gap-6">
          <AdminSection
            title="Brand and business details"
            description="Control visible business details used across the experience."
            actions={
              <Button size="sm" onClick={() => triggerSave()}>
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Business name" icon={Globe}>
                <AdminInput
                  value={site.name}
                  onChange={(event) => updateSite({ ...site, name: event.target.value })}
                />
              </AdminField>
              <AdminField label="Badge text" icon={Star}>
                <AdminInput
                  value={site.awardBadge}
                  onChange={(event) => updateSite({ ...site, awardBadge: event.target.value })}
                />
              </AdminField>
            </div>
            <div className="mt-4">
              <AdminField label="Business tagline">
                <AdminTextarea
                  value={site.tagline}
                  onChange={(event) => updateSite({ ...site, tagline: event.target.value })}
                />
              </AdminField>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <AdminField label="Phone number" icon={PhoneIcon}>
                <AdminInput
                  value={site.phone}
                  onChange={(event) => updateSite({ ...site, phone: event.target.value })}
                />
              </AdminField>
              <AdminField label="Email address" icon={MessageSquare}>
                <AdminInput
                  value={site.email}
                  onChange={(event) => updateSite({ ...site, email: event.target.value })}
                />
              </AdminField>
              <AdminField label="Office location" icon={Settings2}>
                <AdminInput
                  value={site.location}
                  onChange={(event) => updateSite({ ...site, location: event.target.value })}
                />
              </AdminField>
            </div>
          </AdminSection>

          <div className="grid gap-6 lg:grid-cols-2">
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

            <AdminSection title="Reset system defaults" description="Return the configuration to its original coded defaults.">
              <div className="space-y-4">
                <p className="admin-page-description max-w-none">
                  This resets all custom settings. Export a backup first if you may need to restore the current state later.
                </p>
                <button
                  type="button"
                  className="admin-button-secondary text-[var(--admin-danger-fg)]"
                  onClick={() => {
                    if (confirm("Reset all settings back to default values?")) {
                      resetAll();
                      setTimeout(() => window.location.reload(), 300);
                    }
                  }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset all settings
                </button>
              </div>
            </AdminSection>
          </div>
        </div>
      ) : null}

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
                    short: "",
                    description: "",
                    icon: "briefcase",
                    bullets: [],
                  },
                ])
              }
            >
              Add service
            </button>
          </div>
        </AdminSection>
      ) : null}

      {activeTab === "pricing" ? (
        <AdminSection
          title="Pricing configuration"
          description="Adjust pricing labels used by the business."
          actions={
            <Button size="sm" onClick={() => triggerSave("Pricing saved.")}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            {pricing.map((item, index) => (
              <AdminSurface key={item.id} className="p-4">
                <div className="space-y-4">
                  <AdminField label="Name">
                    <AdminInput
                      value={item.name}
                      onChange={(event) => {
                        const next = [...pricing];
                        next[index].name = event.target.value;
                        updatePricing(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Amount">
                    <AdminInput
                      value={item.price}
                      onChange={(event) => {
                        const next = [...pricing];
                        next[index].price = event.target.value;
                        updatePricing(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Description">
                    <AdminInput
                      value={item.description}
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

      {activeTab === "referral" ? (
        <AdminSection
          title="Referral tiers"
          description="Define points and reward thresholds for referral performance."
          actions={
            <Button size="sm" onClick={() => triggerSave("Referral settings saved.")}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          }
        >
          <div className="space-y-4">
            {referralTiers.map((tier, index) => (
              <AdminSurface key={`${tier.title}-${index}`} className="p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <AdminField label="Tier name">
                    <AdminInput
                      value={tier.title}
                      onChange={(event) => {
                        const next = [...referralTiers];
                        next[index].title = event.target.value;
                        updateReferralTiers(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Minimum points">
                    <AdminInput
                      value={String(tier.referralsRequired)}
                      onChange={(event) => {
                        const next = [...referralTiers];
                        next[index].referralsRequired = Number(event.target.value || 0);
                        updateReferralTiers(next);
                      }}
                    />
                  </AdminField>
                  <AdminField label="Reward text">
                    <AdminInput
                      value={tier.note}
                      onChange={(event) => {
                        const next = [...referralTiers];
                        next[index].note = event.target.value;
                        updateReferralTiers(next);
                      }}
                    />
                  </AdminField>
                </div>
              </AdminSurface>
            ))}
          </div>
        </AdminSection>
      ) : null}

      {activeTab === "gamification" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminSection title="Spin rewards" description="Control prize labels and quantities for Spin & Win.">
            <div className="space-y-4">
              {spinRewards.map((reward, index) => (
                <AdminSurface key={reward.type} className="p-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <AdminField label="Reward">
                      <AdminInput
                        value={reward.title}
                        onChange={(event) => {
                          const next = [...spinRewards];
                          next[index].title = event.target.value;
                          updateSpinRewards(next);
                        }}
                      />
                    </AdminField>
                    <AdminField label="Short description">
                      <AdminInput
                        value={reward.short}
                        onChange={(event) => {
                          const next = [...spinRewards];
                          next[index].short = event.target.value;
                          updateSpinRewards(next);
                        }}
                      />
                    </AdminField>
                    <AdminField label="Weight">
                      <AdminInput
                        value={String(reward.weight)}
                        onChange={(event) => {
                          const next = [...spinRewards];
                          next[index].weight = Number(event.target.value || 0);
                          updateSpinRewards(next);
                        }}
                      />
                    </AdminField>
                  </div>
                </AdminSurface>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="Flash campaign" description="Set the short-term multiplier campaign used in the portal.">
            <div className="space-y-4">
              <AdminField label="Campaign name">
                <AdminInput
                  value={flashCampaign.name}
                  onChange={(event) => updateFlashCampaign({ ...flashCampaign, name: event.target.value })}
                />
              </AdminField>
              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="Multiplier">
                  <AdminInput
                    value={String(flashCampaign.multiplier)}
                    onChange={(event) =>
                      updateFlashCampaign({ ...flashCampaign, multiplier: Number(event.target.value || 1) })
                    }
                  />
                </AdminField>
                <AdminField label="Status">
                  <AdminSelect
                    value={flashCampaign.active ? "active" : "inactive"}
                    onChange={(event) =>
                      updateFlashCampaign({ ...flashCampaign, active: event.target.value === "active" })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </AdminSelect>
                </AdminField>
              </div>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "automations" ? (
        <AdminSection
          title="Automation rules"
          description="Configure trigger and action pairs for common admin workflows."
          actions={
            <Button
              size="sm"
              onClick={() =>
                updateAutomations([
                  ...automations,
                  {
                    id: `auto_${Date.now()}`,
                    name: "New rule",
                    trigger: "new_lead",
                    action: "assign_group",
                    actionValue: "prospect",
                    active: true,
                  },
                ])
              }
            >
              Add rule
            </Button>
          }
        >
          <div className="space-y-4">
            {automations.map((rule, index) => (
              <AdminSurface key={rule.id} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <AdminField label="Rule name" hint="Internal label only.">
                      <AdminInput
                        value={rule.name}
                        onChange={(event) => {
                          const next = [...automations];
                          next[index].name = event.target.value;
                          updateAutomations(next);
                        }}
                      />
                    </AdminField>
                    <AdminBadge tone={rule.active ? "success" : "default"}>
                      {rule.active ? "Active" : "Inactive"}
                    </AdminBadge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <AdminField label="Trigger">
                      <AdminSelect
                        value={rule.trigger}
                        onChange={(event) => {
                          const next = [...automations];
                          next[index].trigger = event.target.value as any;
                          updateAutomations(next);
                        }}
                      >
                        <option value="new_lead">New lead</option>
                        <option value="new_referral">New referral</option>
                        <option value="spin_won">Spin won</option>
                      </AdminSelect>
                    </AdminField>
                    <AdminField label="Action">
                      <AdminSelect
                        value={rule.action}
                        onChange={(event) => {
                          const next = [...automations];
                          next[index].action = event.target.value as any;
                          updateAutomations(next);
                        }}
                      >
                        <option value="assign_group">Assign group</option>
                        <option value="add_points">Add points</option>
                      </AdminSelect>
                    </AdminField>
                    <AdminField label="Value">
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
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="admin-button-secondary"
                      onClick={() => {
                        const next = [...automations];
                        next[index].active = !next[index].active;
                        updateAutomations(next);
                      }}
                    >
                      {rule.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="admin-button-secondary text-[var(--admin-danger-fg)]"
                      onClick={() => updateAutomations(automations.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </AdminSurface>
            ))}
          </div>
        </AdminSection>
      ) : null}

      {activeTab === "integrations" ? (
        <AdminSection title="Integrations" description="Connection points for messaging and email delivery.">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminSurface className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="admin-section-title text-base">WhatsApp API</h3>
                  <AdminBadge tone="success">Connected</AdminBadge>
                </div>
                <AdminField label="WhatsApp business token" icon={Key}>
                  <AdminInput value="wa_sk_test_123456789" onChange={() => {}} />
                </AdminField>
              </div>
            </AdminSurface>
            <AdminSurface className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="admin-section-title text-base">Email gateway</h3>
                  <AdminBadge tone="success">Connected</AdminBadge>
                </div>
                <AdminField label="SMTP / SendGrid API key" icon={Key}>
                  <AdminInput value="sg_api_test_abcdef" onChange={() => {}} />
                </AdminField>
              </div>
            </AdminSurface>
          </div>
        </AdminSection>
      ) : null}

      {activeTab === "notifications" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminSection
            title="Lead notifications"
            description="Send WhatsApp alerts when new consultation leads arrive."
            actions={
              <Button size="sm" onClick={saveNotifications}>
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            }
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-4">
                <div>
                  <p className="admin-title-sm">Notifications enabled</p>
                  <p className="admin-meta">Receive an alert for each new lead capture.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifEnabled((value) => !value)}
                  className={`relative h-8 w-14 rounded-full transition-colors ${
                    notifEnabled ? "bg-[var(--color-primary-500)]" : "bg-[var(--admin-border-strong)]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                      notifEnabled ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
              <AdminField label="WhatsApp number" icon={PhoneIcon}>
                <AdminInput value={notifPhone} onChange={(event) => setNotifPhone(event.target.value)} />
              </AdminField>
              <AdminField label="Auto-reply message">
                <AdminTextarea value={autoReply} onChange={(event) => setAutoReply(event.target.value)} />
              </AdminField>
            </div>
          </AdminSection>

          <AdminSection title="Preview" description="This is the message staff and clients will work with.">
            <div className="space-y-4">
              <AdminSurface className="bg-[var(--admin-panel-muted)] p-4">
                <p className="admin-kicker">Outgoing auto-reply</p>
                <p className="admin-page-description mt-2 whitespace-pre-wrap max-w-none">{autoReply}</p>
              </AdminSurface>
              <AdminBadge tone="info">Delivery target: {notifPhone || "not set"}</AdminBadge>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "accounts" ? (
        <div className="grid gap-6">
          <AdminSection title="Current admin account" description="Your current profile and permission level.">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Full name", value: user?.name || "-" },
                { label: "Email", value: user?.email || "-" },
                { label: "Role", value: user?.role || "-" },
              ].map((item) => (
                <AdminSurface key={item.label} className="p-4">
                  <p className="admin-kicker">{item.label}</p>
                  <p className="admin-title-sm mt-2">{item.value}</p>
                </AdminSurface>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="Change password" description="Basic local password management for the portal.">
            <div className="space-y-4">
              {passwordMsg ? (
                <AdminBadge tone={passwordMsg.type === "ok" ? "success" : "danger"}>{passwordMsg.text}</AdminBadge>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="New password" icon={Lock}>
                  <AdminInput
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                </AdminField>
                <AdminField label="Confirm password" icon={Lock}>
                  <AdminInput
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                  />
                </AdminField>
              </div>
              <Button onClick={handlePasswordChange}>Update password</Button>
            </div>
          </AdminSection>

          <AdminSection title="User management" description="Create, remove, and manage admin access rights.">
            <div className="space-y-6">
              {userMessage ? (
                <AdminBadge tone={userMessage.type === "ok" ? "success" : "danger"}>{userMessage.text}</AdminBadge>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <AdminSurface className="p-4">
                  <p className="admin-kicker">Total users</p>
                  <p className="admin-title-sm mt-2">{users.length}</p>
                </AdminSurface>
                <AdminSurface className="p-4">
                  <p className="admin-kicker">Super admins</p>
                  <p className="admin-title-sm mt-2">{users.filter((item) => item.role === "superadmin").length}</p>
                </AdminSurface>
                <AdminSurface className="p-4">
                  <p className="admin-kicker">Disabled accounts</p>
                  <p className="admin-title-sm mt-2">{users.filter((item) => !item.active).length}</p>
                </AdminSurface>
              </div>

              <AdminSurface className="p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <AdminField label="Full name">
                    <AdminInput
                      value={newUser.name}
                      onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Email">
                    <AdminInput
                      value={newUser.email}
                      onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Temporary password">
                    <AdminInput
                      value={newUser.password}
                      onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Role">
                    <AdminSelect
                      value={newUser.role}
                      onChange={(event) =>
                        setNewUser({ ...newUser, role: event.target.value as "admin" | "superadmin" })
                      }
                    >
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </AdminSelect>
                  </AdminField>
                </div>
                <div className="mt-4">
                  <Button onClick={handleCreateUser}>Add user</Button>
                </div>
              </AdminSurface>

              <div className="space-y-4">
                {users.map((managedUser) => (
                  <AdminSurface key={managedUser.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="grid flex-1 gap-4 md:grid-cols-3">
                          <AdminField label="Name">
                            <AdminInput
                              value={managedUser.name}
                              onChange={(event) =>
                                updateUser(managedUser.id, { name: event.target.value })
                              }
                            />
                          </AdminField>
                          <AdminField label="Email">
                            <AdminInput
                              value={managedUser.email}
                              onChange={(event) =>
                                updateUser(managedUser.id, { email: event.target.value })
                              }
                            />
                          </AdminField>
                          <AdminField label="Role">
                            <AdminSelect
                              value={managedUser.role}
                              onChange={(event) =>
                                updateUser(managedUser.id, {
                                  role: event.target.value as "admin" | "superadmin",
                                })
                              }
                            >
                              <option value="admin">Admin</option>
                              <option value="superadmin">Superadmin</option>
                            </AdminSelect>
                          </AdminField>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AdminBadge tone={managedUser.active ? "success" : "warning"}>
                            {managedUser.active ? "Active" : "Disabled"}
                          </AdminBadge>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            onClick={() =>
                              updateUser(managedUser.id, { active: !managedUser.active })
                            }
                          >
                            {managedUser.active ? "Disable" : "Enable"}
                          </button>
                          {managedUser.id !== user?.id ? (
                            <button
                              type="button"
                              className="admin-button-secondary text-[var(--admin-danger-fg)]"
                              onClick={() => {
                                const result = removeUser(managedUser.id);
                                setUserMessage({ type: result.ok ? "ok" : "err", text: result.message });
                                setTimeout(() => setUserMessage(null), 3000);
                              }}
                            >
                              Remove
                            </button>
                          ) : (
                            <AdminBadge>You</AdminBadge>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="admin-kicker mb-3">Access rights</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          {Object.entries(managedUser.permissions).map(([permission, enabled]) => (
                            <label
                              key={permission}
                              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-3"
                            >
                              <span className="admin-meta capitalize">{permission}</span>
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) =>
                                  updateUser(managedUser.id, {
                                    permissions: { [permission]: event.target.checked } as any,
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </AdminSurface>
                ))}
              </div>
            </div>
          </AdminSection>
        </div>
      ) : null}
    </AdminPage>
  );
}
