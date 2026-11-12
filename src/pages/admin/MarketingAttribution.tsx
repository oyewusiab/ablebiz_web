import { useEffect, useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  Search,
  Filter,
  DollarSign,
  Users,
  Target,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  Layers,
  Award,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { fetchMarketingAttributionData } from '../../lib/marketing/attributionAnalytics';
import type {
  MarketingAttributionSummary,
  CampaignAttributionRow,
  LeadChannelAttributionRow,
  ReferralAttributionRow,
} from '../../types/suitePhases15To19';

export function MarketingAttributionPage() {
  const { profile, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'channels' | 'referrals'>('campaigns');

  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [sourceFilter, setSourceFilter] = useState('all');
  const [roiBasis, setRoiBasis] = useState<'cash' | 'invoiced'>('cash');

  const [summary, setSummary] = useState<MarketingAttributionSummary | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignAttributionRow[]>([]);
  const [channels, setChannels] = useState<LeadChannelAttributionRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralAttributionRow[]>([]);

  const canViewFinancials =
    profile?.role === 'super_admin' ||
    profile?.role === 'admin' ||
    profile?.role === 'accounts_officer' ||
    hasPermission('finance', 'view');

  useEffect(() => {
    loadAttribution();
  }, [dateFilter, sourceFilter]);

  const loadAttribution = async () => {
    setLoading(true);
    try {
      const data = await fetchMarketingAttributionData({
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        source: sourceFilter,
      });

      setSummary(data.summary);
      setCampaigns(data.campaigns);
      setChannels(data.channels);
      setReferrals(data.referrals);
    } catch (err) {
      console.error('[MarketingAttribution] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (days: number) => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDateFilter({ startDate: start, endDate: end });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Marketing Campaign & Lead Attribution Analytics</h1>
              <p className="text-xs text-slate-500">
                Track customer acquisition funnels, campaign spend efficiency, verified cash collections, and commercial ROI
              </p>
            </div>
          </div>
        </div>

        {/* Quick Period Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePeriodChange(30)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handlePeriodChange(90)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            Last 90 Days
          </button>
          <button
            type="button"
            onClick={() => handlePeriodChange(365)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            This Year
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Period:</span>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Channel:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs"
            >
              <option value="all">All Channels</option>
              <option value="website">Website Enquiry</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="referral">Referral Partner</option>
              <option value="social">Organic Social</option>
              <option value="paid">Paid Digital Ads</option>
            </select>
          </div>
        </div>

        {canViewFinancials && (
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 pl-1.5">ROI Basis:</span>
            <button
              type="button"
              onClick={() => setRoiBasis('cash')}
              className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition ${
                roiBasis === 'cash'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verified Cash
            </button>
            <button
              type="button"
              onClick={() => setRoiBasis('invoiced')}
              className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition ${
                roiBasis === 'invoiced'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Invoiced Total
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Leads */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Leads Acquired</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {summary ? summary.total_leads.toLocaleString() : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary ? `${summary.converted_clients} converted (${summary.lead_conversion_rate}%)` : 'Calculating...'}
          </p>
        </div>

        {/* Attributed Collections */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attributed Cash Collections</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {canViewFinancials
              ? summary ? `₦${summary.verified_cash_attributed.toLocaleString()}` : '—'
              : 'Restricted (Finance Only)'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {canViewFinancials && summary
              ? `Invoiced: ₦${summary.invoiced_revenue_attributed.toLocaleString()}`
              : 'Verified bank settlements'}
          </p>
        </div>

        {/* Cost Efficiency */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cost Per Lead (CPL)</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {canViewFinancials
              ? summary?.cost_per_lead ? `₦${summary.cost_per_lead.toLocaleString()}` : 'N/A'
              : 'Restricted'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {canViewFinancials && summary?.cost_per_acquired_client
              ? `CAC: ₦${summary.cost_per_acquired_client.toLocaleString()} / client`
              : 'Based on actual campaign ad spend'}
          </p>
        </div>

        {/* Marketing ROI */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Marketing ROI ({roiBasis === 'cash' ? 'Cash Basis' : 'Invoiced'})
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {canViewFinancials ? (
              roiBasis === 'cash' ? (
                summary?.campaign_roi_cash_percent !== null ? (
                  <span className={summary?.campaign_roi_cash_percent! >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {summary?.campaign_roi_cash_percent}%
                  </span>
                ) : (
                  'Organic / Zero Cost'
                )
              ) : (
                summary?.campaign_roi_invoiced_percent !== null ? (
                  <span className={summary?.campaign_roi_invoiced_percent! >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {summary?.campaign_roi_invoiced_percent}%
                  </span>
                ) : (
                  'Organic / Zero Cost'
                )
              )
            ) : (
              'Restricted'
            )}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {canViewFinancials && summary
              ? `Total spend: ₦${summary.total_campaign_spend.toLocaleString()}`
              : 'Executive return on ad spend'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'campaigns'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Campaign Performance ({campaigns.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('channels')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'channels'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Acquisition Channels ({channels.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('referrals')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'referrals'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Referral Partners ({referrals.length})
        </button>
      </div>

      {/* Tab 1: Campaigns Breakdown */}
      {activeTab === 'campaigns' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Campaign Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Leads</th>
                  <th className="py-2.5 px-3">Converted</th>
                  <th className="py-2.5 px-3">Conversion Rate</th>
                  {canViewFinancials && <th className="py-2.5 px-3">Spend (₦)</th>}
                  {canViewFinancials && <th className="py-2.5 px-3">Cash Collected (₦)</th>}
                  {canViewFinancials && <th className="py-2.5 px-3">Cost / Client</th>}
                  {canViewFinancials && <th className="py-2.5 px-3">ROI (%)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {campaigns.map((c) => (
                  <tr key={c.campaign_id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{c.campaign_name}</td>
                    <td className="py-2.5 px-3 capitalize">{c.campaign_type}</td>
                    <td className="py-2.5 px-3 font-semibold">{c.leads_count}</td>
                    <td className="py-2.5 px-3">{c.converted_clients_count}</td>
                    <td className="py-2.5 px-3">{c.conversion_rate}%</td>
                    {canViewFinancials && (
                      <td className="py-2.5 px-3">₦{c.actual_spend_ngn.toLocaleString()}</td>
                    )}
                    {canViewFinancials && (
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        ₦{c.verified_cash_collected.toLocaleString()}
                      </td>
                    )}
                    {canViewFinancials && (
                      <td className="py-2.5 px-3 text-slate-500">
                        {c.cost_per_acquired_client ? `₦${c.cost_per_acquired_client.toLocaleString()}` : '—'}
                      </td>
                    )}
                    {canViewFinancials && (
                      <td className="py-2.5 px-3 font-bold">
                        {c.roi_cash_percent !== null ? (
                          <span className={c.roi_cash_percent >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {c.roi_cash_percent}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">Organic</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Acquisition Channels */}
      {activeTab === 'channels' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Acquisition Channel</th>
                  <th className="py-2.5 px-3">Channel Type</th>
                  <th className="py-2.5 px-3">Leads Acquired</th>
                  <th className="py-2.5 px-3">Converted Clients</th>
                  <th className="py-2.5 px-3">Conversion Rate</th>
                  {canViewFinancials && <th className="py-2.5 px-3">Invoiced Total (₦)</th>}
                  {canViewFinancials && <th className="py-2.5 px-3">Cash Collected (₦)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {channels.map((ch) => (
                  <tr key={ch.channel_name} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{ch.channel_name}</td>
                    <td className="py-2.5 px-3 capitalize">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        ch.channel_type === 'paid' ? 'bg-purple-50 text-purple-700' : ch.channel_type === 'partnership' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ch.channel_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{ch.leads_count}</td>
                    <td className="py-2.5 px-3">{ch.converted_clients_count}</td>
                    <td className="py-2.5 px-3">{ch.conversion_rate}%</td>
                    {canViewFinancials && (
                      <td className="py-2.5 px-3">₦{ch.invoiced_revenue.toLocaleString()}</td>
                    )}
                    {canViewFinancials && (
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        ₦{ch.verified_cash_collected.toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Referral Partners */}
      {activeTab === 'referrals' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Partner Name</th>
                  <th className="py-2.5 px-3">Referral Code</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Leads</th>
                  <th className="py-2.5 px-3">Converted Clients</th>
                  <th className="py-2.5 px-3">Conversion Rate</th>
                  {canViewFinancials && <th className="py-2.5 px-3">Verified Cash Generated (₦)</th>}
                  {canViewFinancials && <th className="py-2.5 px-3">Verified Rewards (₦)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {referrals.map((r) => (
                  <tr key={r.partner_id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{r.partner_name}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#0A2558]">{r.referral_code}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.partner_phone}</td>
                    <td className="py-2.5 px-3 font-semibold">{r.leads_count}</td>
                    <td className="py-2.5 px-3">{r.converted_clients_count}</td>
                    <td className="py-2.5 px-3">{r.conversion_rate}%</td>
                    {canViewFinancials && (
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        ₦{r.verified_cash_collected.toLocaleString()}
                      </td>
                    )}
                    {canViewFinancials && (
                      <td className="py-2.5 px-3 text-amber-700 font-medium">
                        ₦{r.verified_rewards_payable.toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
