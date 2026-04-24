import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Gift,
  History,
  Link as LinkIcon,
  MessageSquareShare,
  PlusCircle,
  Search,
  Users,
  Zap,
} from "lucide-react";
import {
  getEnrichedConversions,
  getEnrichedRedemptions,
  getReferralClients,
  getReferralConversions,
  getUnifiedClients,
  manualRecordConversion,
  generateUniqueCode,
  updateRedemptionStatus,
} from "../../referrals/core";
import { useAuth } from "../../auth/AuthContext";
import { buildWhatsAppLink } from "../../content/site";
import { useStorageData } from "../../utils/useStorageData";
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
} from "../../components/admin/AdminPrimitives";
import { Button } from "../../components/ui/Button";

type ReferralTab = "referrers" | "conversions" | "redemptions" | "manual";

export function AdminReferrals() {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ReferralTab>("referrers");
  const [search, setSearch] = useState("");
  const [refCode, setRefCode] = useState("");
  const [selectedReferrerId, setSelectedReferrerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [manualMsg, setManualMsg] = useState("");
  const [searchInClients, setSearchInClients] = useState("");

  const [referralClients, refreshClients] = useStorageData(getReferralClients);
  const [conversions, refreshConversions] = useStorageData(getReferralConversions);
  const [enrichedRedemptions, refreshRedemptions] = useStorageData(getEnrichedRedemptions);
  const [allClients, refreshAllClients] = useStorageData(getUnifiedClients);

  const refreshData = () => {
    refreshClients();
    refreshConversions();
    refreshRedemptions();
    refreshAllClients();
  };

  const leaderboard = useMemo(() => {
    const pointsMap = new Map<string, number>();
    for (const conversion of conversions) {
      const code = conversion.referrerCode.toLowerCase();
      pointsMap.set(code, (pointsMap.get(code) || 0) + conversion.points);
    }

    return referralClients
      .map((client) => ({
        ...client,
        points: pointsMap.get(client.referralCode.toLowerCase()) || 0,
      }))
      .filter(
        (client) =>
          client.name.toLowerCase().includes(search.toLowerCase()) ||
          client.referralCode.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.points - a.points);
  }, [conversions, referralClients, search]);

  const clientSuggestions = useMemo(() => {
    if (!searchInClients.trim()) return [];
    return allClients
      .filter(
        (client) =>
          client.name.toLowerCase().includes(searchInClients.toLowerCase()) ||
          (client.email || "").toLowerCase().includes(searchInClients.toLowerCase())
      )
      .slice(0, 5);
  }, [allClients, searchInClients]);

  const handleManualLink = (event: React.FormEvent) => {
    event.preventDefault();

    try {
      manualRecordConversion(refCode, newName, newEmail, newPhone);
      setManualMsg("Conversion linked successfully.");
      setRefCode("");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setSearchInClients("");
      refreshData();
    } catch (error: any) {
      setManualMsg(error.message || "Failed to link conversion.");
    }
  };

  const generateReferrerCode = () => {
    const selectedReferrer = referralClients.find((client) => client.id === selectedReferrerId);
    if (selectedReferrer?.referralCode) {
      setRefCode(selectedReferrer.referralCode);
      setManualMsg(`Using ${selectedReferrer.name}'s referral code.`);
      return;
    }

    setRefCode(generateUniqueCode());
    setManualMsg("A code was generated, but please select a valid referrer before linking.");
  };

  const openWhatsApp = (name: string) => {
    const link = buildWhatsAppLink(
      `Hello ${name}, this is ABLEBIZ support regarding your referral profile.`
    );
    window.open(link, "_blank");
  };

  return (
    <AdminPage
      eyebrow="Referral program"
      title="Referrals"
      description="Track partners, conversions, rewards, and manual reconciliation for missed attribution."
      actions={
        <AdminTabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: "referrers", label: "Referrers", icon: Users },
            { value: "conversions", label: "Conversions", icon: History },
            { value: "redemptions", label: "Rewards", icon: Gift },
            { value: "manual", label: "Manual link", icon: Zap },
          ]}
        />
      }
    >
      {activeTab === "referrers" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <AdminStatCard
              label="Active referrers"
              value={referralClients.length}
              icon={Users}
              tone="success"
            />
            <AdminStatCard
              label="Total conversions"
              value={conversions.length}
              icon={Zap}
              tone="info"
            />
            <AdminStatCard
              label="Average referrals per user"
              value={(conversions.length / (referralClients.length || 1)).toFixed(1)}
              icon={LinkIcon}
              tone="warning"
            />
          </div>

          <AdminSection title="Leaderboard" description="Rank referrers by total points earned.">
            <div className="mb-5 max-w-sm">
              <AdminField label="Search referrers">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <AdminInput
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-10"
                    placeholder="Search by name or referral code"
                  />
                </div>
              </AdminField>
            </div>

            {leaderboard.length === 0 ? (
              <AdminEmptyState
                icon={Users}
                title="No referrers found"
                description="Try another search term or come back after the referral program has more activity."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Referrer</th>
                      <th>Referral code</th>
                      <th>Points</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((client) => (
                      <tr key={client.id}>
                        <td>
                          <div className="space-y-1">
                            <p className="admin-title-sm">{client.name}</p>
                            <p className="admin-meta">{client.email}</p>
                          </div>
                        </td>
                        <td>
                          <AdminBadge>{client.referralCode}</AdminBadge>
                        </td>
                        <td>
                          <AdminBadge tone="success">{client.points} points</AdminBadge>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => openWhatsApp(client.name)}
                            className="admin-button-secondary"
                          >
                            <MessageSquareShare className="h-4 w-4" />
                            Contact
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "manual" ? (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <AdminSection title="Manual conversion link" description="Use this when a client joined without the correct referral code.">
            <form onSubmit={handleManualLink} className="space-y-6">
              {manualMsg ? (
                <AdminSurface className="bg-[var(--color-info-100)]/40 p-4">
                  <div className="flex items-center gap-3 text-[var(--color-info-600)]">
                    <LinkIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">{manualMsg}</span>
                  </div>
                </AdminSurface>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="Referrer">
                  <AdminSelect
                    value={selectedReferrerId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedReferrerId(value);
                      const selectedReferrer = referralClients.find((client) => client.id === value);
                      if (selectedReferrer?.referralCode) {
                        setRefCode(selectedReferrer.referralCode);
                      }
                    }}
                  >
                    <option value="">Select a referrer</option>
                    {referralClients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name} - {client.referralCode}</option>
                    ))}
                  </AdminSelect>
                </AdminField>

                <AdminField label="Referral code" hint="Generated from the selected referrer.">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <AdminInput readOnly required value={refCode} placeholder="Generate referral code" />
                    <button type="button" className="admin-button-secondary" onClick={generateReferrerCode}>
                      Generate
                    </button>
                  </div>
                </AdminField>
              </div>

              <div className="grid gap-4 md:grid-cols-1">
                <AdminField label="Find existing client" hint="Select a suggestion to prefill the details.">
                  <div className="space-y-3">
                    <AdminInput
                      value={searchInClients}
                      onChange={(event) => setSearchInClients(event.target.value)}
                      placeholder="Search by name or email"
                    />
                    {clientSuggestions.length > 0 ? (
                      <AdminSurface className="overflow-hidden">
                        {clientSuggestions.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setNewName(client.name);
                              setNewEmail(client.email || "");
                              setNewPhone(client.phone || "");
                              setSearchInClients("");
                            }}
                            className="flex w-full items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--admin-panel-muted)]"
                          >
                            <div>
                              <p className="admin-title-sm">{client.name}</p>
                              <p className="admin-meta">{client.email || client.sourceLabel}</p>
                            </div>
                            <AdminBadge>{client.sourceLabel}</AdminBadge>
                          </button>
                        ))}
                      </AdminSurface>
                    ) : null}
                  </div>
                </AdminField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="Client name">
                  <AdminInput
                    required
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Full name"
                  />
                </AdminField>
                <AdminField label="Email address">
                  <AdminInput
                    required
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </AdminField>
              </div>

              <AdminField label="Phone number">
                <AdminInput
                  required
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  placeholder="Phone number"
                />
              </AdminField>

              <Button type="submit">Link conversion</Button>
            </form>
          </AdminSection>

          <AdminSection title="How it works" description="Manual linking protects attribution quality when the automated path is missed.">
            <div className="space-y-4">
              <p className="admin-page-description max-w-none">
                Search for an existing client first to reduce duplicate records. Once linked, reward calculations and tier movement update immediately.
              </p>
              <AdminBadge tone="success">Instant reward recalculation</AdminBadge>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "conversions" ? (
        <AdminSection
          title="Conversion history"
          description="Every successful referral conversion recorded in the system."
          actions={<AdminBadge>{getEnrichedConversions().length} records</AdminBadge>}
        >
          {getEnrichedConversions().length === 0 ? (
            <AdminEmptyState
              icon={History}
              title="No conversions recorded"
              description="Successful referral conversions will appear here once people begin completing the flow."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Referrer</th>
                    <th>New client</th>
                    <th>Points earned</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {getEnrichedConversions().map((conversion) => (
                    <tr key={conversion.id}>
                      <td>
                        <div className="space-y-1">
                          <p className="admin-title-sm">{conversion.referrer?.name || conversion.referrerCode}</p>
                          <p className="admin-meta">{conversion.referrerCode}</p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <p className="admin-title-sm">{conversion.converted?.name || "Linked client"}</p>
                          <p className="admin-meta">{conversion.converted?.email || "-"}</p>
                        </div>
                      </td>
                      <td>
                        <AdminBadge tone="info">
                          <PlusCircle className="mr-1 h-3.5 w-3.5" />
                          {conversion.points} points
                        </AdminBadge>
                      </td>
                      <td className="admin-meta">
                        {new Date(conversion.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSection>
      ) : null}

      {activeTab === "redemptions" ? (
        <AdminSection
          title="Reward redemptions"
          description="Fulfill pending rewards and confirm completed ones."
          actions={
            <AdminBadge tone="warning">
              {enrichedRedemptions.filter((item) => item.status === "pending").length} pending
            </AdminBadge>
          }
        >
          {enrichedRedemptions.length === 0 ? (
            <AdminEmptyState
              icon={Gift}
              title="No redemptions yet"
              description="Reward requests will show up here once referrers begin redeeming points."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Referrer</th>
                    <th>Reward</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedRedemptions.map((redemption) => (
                    <tr key={redemption.id}>
                      <td>
                        <div className="space-y-1">
                          <p className="admin-title-sm">{redemption.client?.name || "Unknown"}</p>
                          <p className="admin-meta">{redemption.clientCode}</p>
                        </div>
                      </td>
                      <td>
                        <AdminBadge tone="warning">{redemption.rewardTitle}</AdminBadge>
                      </td>
                      <td>
                        <AdminBadge tone={redemption.status === "fulfilled" ? "success" : "info"}>
                          {redemption.status}
                        </AdminBadge>
                      </td>
                      <td className="text-right">
                        {redemption.status === "pending" ? (
                          authUser?.role === "superadmin" ? (
                            <button
                              type="button"
                              onClick={() => {
                                updateRedemptionStatus(redemption.id, "fulfilled");
                                refreshData();
                              }}
                              className="admin-button-primary"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Mark fulfilled
                            </button>
                          ) : (
                            <span className="admin-meta">Superadmin access required</span>
                          )
                        ) : (
                          <AdminBadge tone="success">Reward sent</AdminBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}
