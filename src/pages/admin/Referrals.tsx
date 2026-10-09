import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Gift,
  History,
  Link as LinkIcon,
  Loader2,
  MessageSquareShare,
  PlusCircle,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  rpcAdminGetReferralReport,
  rpcAdminLinkReferral,
  rpcAdminGetRewards,
  rpcAdminFulfillReward,
  type AdminReferrerItem,
  type AdminConversionItem,
  type AdminRewardRecord,
} from "../../lib/supabaseApi";
import { buildWhatsAppLink } from "../../content/site";
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
  const [loading, setLoading] = useState(true);

  // Authoritative Supabase data
  const [referrers, setReferrers] = useState<AdminReferrerItem[]>([]);
  const [conversions, setConversions] = useState<AdminConversionItem[]>([]);
  const [rewards, setRewards] = useState<AdminRewardRecord[]>([]);
  const [existingLeads, setExistingLeads] = useState<any[]>([]);

  // Filters & Form States
  const [search, setSearch] = useState("");
  const [rewardTypeFilter, setRewardTypeFilter] = useState<"all" | "spin" | "referral">("all");
  const [refCode, setRefCode] = useState("");
  const [selectedReferrerCode, setSelectedReferrerCode] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [searchInLeads, setSearchInLeads] = useState("");
  const [manualMsg, setManualMsg] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState<string | null>(null);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const [report, rewardsData, leadsRes] = await Promise.all([
        rpcAdminGetReferralReport(),
        rpcAdminGetRewards(),
        supabase.from("leads").select("id, name, email, phone, source, referral_code, referred_by").order("created_at", { ascending: false }).limit(200),
      ]);

      setReferrers(report.referrers);
      setConversions(report.conversions);
      setRewards(rewardsData);
      if (leadsRes?.data) {
        setExistingLeads(leadsRes.data);
      }
    } catch (err) {
      console.error("[AdminReferrals] Error loading referral data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, []);

  const leaderboard = useMemo(() => {
    return referrers
      .filter(
        (client) =>
          client.name.toLowerCase().includes(search.toLowerCase()) ||
          client.referral_code.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.total_points - a.total_points || b.total_referrals - a.total_referrals);
  }, [referrers, search]);

  const leadSuggestions = useMemo(() => {
    if (!searchInLeads.trim()) return [];
    const term = searchInLeads.toLowerCase();
    return existingLeads
      .filter(
        (lead) =>
          lead.name?.toLowerCase().includes(term) ||
          (lead.email || "").toLowerCase().includes(term) ||
          (lead.phone || "").includes(term)
      )
      .slice(0, 6);
  }, [existingLeads, searchInLeads]);

  const handleManualLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!refCode.trim() || !selectedLeadId) {
      setManualMsg("Please select a referrer code and a lead to link.");
      return;
    }

    setIsLinking(true);
    setManualMsg("");

    try {
      const res = await rpcAdminLinkReferral(selectedLeadId, refCode.trim(), 50);
      if (res.success) {
        setManualMsg("Referral successfully linked in Supabase.");
        setRefCode("");
        setSelectedReferrerCode("");
        setSelectedLeadId("");
        setSearchInLeads("");
        await fetchReferralData();
      } else {
        setManualMsg(res.message || "Failed to link referral.");
      }
    } catch (error: any) {
      setManualMsg(error.message || "Failed to link conversion.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleFulfillReward = async (rewardId: string) => {
    setIsFulfilling(rewardId);
    try {
      const res = await rpcAdminFulfillReward(
        rewardId,
        `Fulfilled by ${authUser?.email || "staff"}`
      );
      if (res.success) {
        await fetchReferralData();
      }
    } catch (err) {
      console.error("[AdminReferrals] Failed to fulfill reward:", err);
    } finally {
      setIsFulfilling(null);
    }
  };

  const openWhatsApp = (name: string, phone?: string | null) => {
    const text = `Hello ${name}, this is ABLEBIZ Business Services regarding your referral partner profile.`;
    const link = buildWhatsAppLink(text);
    window.open(link, "_blank");
  };

  const totalConversions = conversions.length;
  const activeReferrersCount = referrers.length;
  const avgPerUser = activeReferrersCount > 0 ? (totalConversions / activeReferrersCount).toFixed(1) : "0";

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
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-2 text-xs text-slate-500">Loading referral ecosystem from Supabase...</p>
        </div>
      ) : (
        <>
          {activeTab === "referrers" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <AdminStatCard
                  label="Active referrers"
                  value={activeReferrersCount}
                  icon={Users}
                  tone="success"
                />
                <AdminStatCard
                  label="Total conversions"
                  value={totalConversions}
                  icon={Zap}
                  tone="info"
                />
                <AdminStatCard
                  label="Average referrals per partner"
                  value={avgPerUser}
                  icon={LinkIcon}
                  tone="warning"
                />
              </div>

              <AdminSection title="Leaderboard" description="Rank referrers by total points earned and completed referrals.">
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
                    description="Partners who join or share referral codes will appear here automatically."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Referrer</th>
                          <th>Referral code</th>
                          <th>Referrals</th>
                          <th>Points</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((partner) => (
                          <tr key={partner.referral_code}>
                            <td>
                              <div className="space-y-1">
                                <p className="admin-title-sm">{partner.name}</p>
                                <p className="admin-meta">{partner.email || partner.phone || "No contact info"}</p>
                              </div>
                            </td>
                            <td>
                              <AdminBadge tone="info">{partner.referral_code}</AdminBadge>
                            </td>
                            <td>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {partner.total_referrals} {partner.total_referrals === 1 ? "referral" : "referrals"}
                              </span>
                            </td>
                            <td>
                              <AdminBadge tone="success">{partner.total_points} points</AdminBadge>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={() => openWhatsApp(partner.name, partner.phone)}
                                className="admin-button-secondary inline-flex items-center gap-1.5"
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
              <AdminSection title="Manual conversion link" description="Link an existing prospect or lead to a partner's referral code.">
                <form onSubmit={handleManualLink} className="space-y-6">
                  {manualMsg ? (
                    <AdminSurface className="bg-blue-50/70 p-4 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800">
                      <div className="flex items-center gap-3 text-blue-700 dark:text-blue-300">
                        <LinkIcon className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">{manualMsg}</span>
                      </div>
                    </AdminSurface>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminField label="Select Referrer Partner">
                      <AdminSelect
                        value={selectedReferrerCode}
                        onChange={(event) => {
                          const code = event.target.value;
                          setSelectedReferrerCode(code);
                          setRefCode(code);
                        }}
                      >
                        <option value="">Choose an active referrer</option>
                        {referrers.map((r) => (
                          <option key={r.referral_code} value={r.referral_code}>
                            {r.name} ({r.referral_code})
                          </option>
                        ))}
                      </AdminSelect>
                    </AdminField>

                    <AdminField label="Referral Code" hint="Selected or manually entered.">
                      <AdminInput
                        required
                        value={refCode}
                        onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                        placeholder="e.g. ABZ-749201"
                      />
                    </AdminField>
                  </div>

                  <div className="grid gap-4 md:grid-cols-1">
                    <AdminField label="Find Existing Lead / Prospect" hint="Search inbound leads to attribute to this referrer.">
                      <div className="space-y-3">
                        <AdminInput
                          value={searchInLeads}
                          onChange={(event) => setSearchInLeads(event.target.value)}
                          placeholder="Search by lead name, phone, or email..."
                        />
                        {leadSuggestions.length > 0 ? (
                          <AdminSurface className="overflow-hidden border border-slate-200 dark:border-slate-700">
                            {leadSuggestions.map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  setSearchInLeads(`${lead.name} (${lead.phone})`);
                                }}
                                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${
                                  selectedLeadId === lead.id ? "bg-blue-50 dark:bg-blue-950/40" : ""
                                }`}
                              >
                                <div>
                                  <p className="admin-title-sm">{lead.name}</p>
                                  <p className="admin-meta">{lead.phone} • {lead.email || "No email"}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {lead.referred_by && (
                                    <AdminBadge tone="warning">Currently: {lead.referred_by}</AdminBadge>
                                  )}
                                  <AdminBadge>{lead.source || "inbound"}</AdminBadge>
                                </div>
                              </button>
                            ))}
                          </AdminSurface>
                        ) : null}
                      </div>
                    </AdminField>
                  </div>

                  {selectedLeadId ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950 flex items-center justify-between">
                      <span>Ready to link lead ID: <code className="font-mono">{selectedLeadId}</code></span>
                      <button
                        type="button"
                        onClick={() => { setSelectedLeadId(""); setSearchInLeads(""); }}
                        className="text-xs font-semibold text-emerald-700 underline"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}

                  <Button type="submit" disabled={isLinking || !selectedLeadId || !refCode.trim()}>
                    {isLinking ? "Linking in Supabase..." : "Link Conversion (50 pts)"}
                  </Button>
                </form>
              </AdminSection>

              <AdminSection title="How it works" description="Manual linking protects partner attribution when a referee omits the link.">
                <div className="space-y-4">
                  <p className="admin-page-description max-w-none">
                    Select the referrer partner and search for the lead. Upon linking, the lead record is updated with the referrer code, and a verified referral event is authored in Supabase.
                  </p>
                  <AdminBadge tone="success">Supabase-Authoritative Linking</AdminBadge>
                </div>
              </AdminSection>
            </div>
          ) : null}

          {activeTab === "conversions" ? (
            <AdminSection
              title="Conversion history"
              description="Authoritative referral conversions recorded in Supabase."
              actions={<AdminBadge>{conversions.length} records</AdminBadge>}
            >
              {conversions.length === 0 ? (
                <AdminEmptyState
                  icon={History}
                  title="No conversions recorded"
                  description="Referrals submitted with active partner codes will appear here in real-time."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Referrer Code</th>
                        <th>Referred Lead</th>
                        <th>Source</th>
                        <th>Points</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((conversion) => (
                        <tr key={conversion.id}>
                          <td>
                            <AdminBadge tone="info">{conversion.referrer_code}</AdminBadge>
                          </td>
                          <td>
                            <div className="space-y-1">
                              <p className="admin-title-sm">{conversion.referee_name}</p>
                              <p className="admin-meta">{conversion.referee_email || "-"}</p>
                            </div>
                          </td>
                          <td>
                            <AdminBadge tone={conversion.is_manual_link ? "warning" : "default"}>
                              {conversion.is_manual_link ? "Manual link" : (conversion.referee_source || "Website Inbound")}
                            </AdminBadge>
                          </td>
                          <td>
                            <AdminBadge tone="info">
                              <PlusCircle className="mr-1 h-3.5 w-3.5" />
                              {conversion.points} points
                            </AdminBadge>
                          </td>
                          <td className="admin-meta">
                            {new Date(conversion.created_at).toLocaleDateString()}
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
              description="Audit and fulfill client and partner reward redemptions."
              actions={
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setRewardTypeFilter("all")}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        rewardTypeFilter === "all"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setRewardTypeFilter("spin")}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        rewardTypeFilter === "spin"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Spin & Earn
                    </button>
                    <button
                      type="button"
                      onClick={() => setRewardTypeFilter("referral")}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        rewardTypeFilter === "referral"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Referral Tiers
                    </button>
                  </div>
                  <AdminBadge tone="warning">
                    {rewards.filter((item) => item.status === "pending").length} pending
                  </AdminBadge>
                </div>
              }
            >
              {rewards.filter((r) =>
                rewardTypeFilter === "all"
                  ? true
                  : rewardTypeFilter === "spin"
                  ? r.reward_type?.includes("spin")
                  : !r.reward_type?.includes("spin")
              ).length === 0 ? (
                <AdminEmptyState
                  icon={Gift}
                  title="No rewards currently on record"
                  description="Unlocked partner rewards and prize redemptions will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Type</th>
                        <th>Reward</th>
                        <th>Code</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rewards
                        .filter((r) =>
                          rewardTypeFilter === "all"
                            ? true
                            : rewardTypeFilter === "spin"
                            ? r.reward_type?.includes("spin")
                            : !r.reward_type?.includes("spin")
                        )
                        .map((reward) => (
                        <tr key={reward.id}>
                          <td>
                            <div className="space-y-1">
                              <p className="admin-title-sm">{reward.name}</p>
                              <p className="admin-meta">{reward.phone || reward.email || "-"}</p>
                            </div>
                          </td>
                          <td>
                            <AdminBadge tone={reward.reward_type?.includes("spin") ? "info" : "default"}>
                              {reward.reward_type?.includes("spin") ? "Spin & Earn" : "Referral Reward"}
                            </AdminBadge>
                          </td>
                          <td>
                            <AdminBadge tone="warning">{reward.reward_title}</AdminBadge>
                          </td>
                          <td>
                            <code className="text-xs font-mono text-slate-600 dark:text-slate-300">
                              {reward.reward_code || "-"}
                            </code>
                          </td>
                          <td>
                            <AdminBadge tone={reward.status === "fulfilled" ? "success" : "warning"}>
                              {reward.status}
                            </AdminBadge>
                          </td>
                          <td className="text-right">
                            {reward.status === "pending" ? (
                              <button
                                type="button"
                                disabled={isFulfilling === reward.id}
                                onClick={() => handleFulfillReward(reward.id)}
                                className="admin-button-primary inline-flex items-center gap-1.5"
                              >
                                {isFulfilling === reward.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                Mark Fulfilled
                              </button>
                            ) : (
                              <div className="text-xs text-slate-400">
                                {reward.fulfillment_note || "Fulfilled"}
                              </div>
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
        </>
      )}
    </AdminPage>
  );
}
