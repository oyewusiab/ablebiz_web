import { useMemo, useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Clock, 
  Copy, 
  Gift, 
  History, 
  Users, 
  Link as LinkIcon, 
  Trash2, 
  PlusCircle,
  MessageSquareShare,
  Search,
  Zap,
  ChevronDown
} from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { 
  getReferralClients, 
  getReferralConversions, 
  getEnrichedConversions, 
  getEnrichedRedemptions,
  updateRedemptionStatus,
  manualRecordConversion,
  deleteReferralClient,
  awardPoints,
  findClientByCode,
  getUnifiedClients
} from "../../referrals/core";
import { useAuth } from "../../auth/AuthContext";
import { buildWhatsAppLink } from "../../content/site";

export function AdminReferrals() {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"referrers" | "conversions" | "redemptions" | "manual">("referrers");
  const [search, setSearch] = useState("");
  
  // Manual Link Form State
  const [refCode, setRefCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [manualMsg, setManualMsg] = useState("");
  const [searchInClients, setSearchInClients] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Data
  const [clientsData, setClientsData] = useState<any[]>([]);
  
  useEffect(() => {
    setClientsData(getUnifiedClients());
  }, []);

  const refreshData = () => {
    setClientsData(getUnifiedClients());
    // In a real app we'd use useQuery, for storage we just trigger re-renders
  };

  const referralClients = useMemo(() => getReferralClients(), []);
  const conversions = useMemo(() => getReferralConversions(), []);
  const enrichedRedemptions = useMemo(() => getEnrichedRedemptions(), []);

  const leaderboard = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of conversions) {
      const code = c.referrerCode.toLowerCase();
      counts.set(code, (counts.get(code) || 0) + c.points);
    }
    
    return referralClients
      .map((c) => ({
        ...c,
        points: counts.get(c.referralCode.toLowerCase()) || 0,
      }))
      .filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.referralCode.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.points - a.points);
  }, [referralClients, conversions, search]);

  const clientSuggestions = useMemo(() => {
    if (!searchInClients.trim()) return [];
    return clientsData.filter(c => 
      c.name.toLowerCase().includes(searchInClients.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(searchInClients.toLowerCase())
    ).slice(0, 5);
  }, [searchInClients, clientsData]);

  const selectSuggestion = (c: any) => {
    setNewName(c.name);
    setNewEmail(c.email || "");
    setNewPhone(c.phone || "");
    setSearchInClients("");
    setShowSuggestions(false);
  };

  const handleManualLink = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      manualRecordConversion(refCode, newName, newEmail, newPhone);
      setManualMsg("Successfully linked conversion!");
      setRefCode(""); setNewName(""); setNewEmail(""); setNewPhone("");
      refreshData();
    } catch (err: any) {
      setManualMsg(err.message || "Failed to link");
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    const link = buildWhatsAppLink(`Hello ${name}, this is ABLEBIZ support regarding your referral profile...`);
    window.open(link, "_blank");
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Referral Ecosystem</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 italic">Intervene, reward, and track your viral registration loop.</p>
        </div>
        
        <div className="flex overflow-hidden bg-slate-200/50 p-1.5 rounded-2xl ring-1 ring-slate-200">
          {[
            { id: "referrers", label: "Referrers", icon: Users },
            { id: "conversions", label: "Conversions", icon: History },
            { id: "redemptions", label: "Rewards", icon: Gift },
            { id: "manual", label: "Manual Link", icon: Zap },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${
                activeTab === t.id ? "bg-white text-emerald-600 shadow-xl" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "referrers" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex bg-white rounded-3xl p-8 items-center justify-between shadow-2xl shadow-emerald-500/5 ring-1 ring-slate-100">
             <div className="space-y-1">
                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Referrers</div>
                <div className="text-4xl font-black text-slate-900">{referralClients.length}</div>
             </div>
             <div className="h-12 w-px bg-slate-100" />
             <div className="space-y-1">
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total Conversions</div>
                <div className="text-4xl font-black text-slate-900">{conversions.length}</div>
             </div>
             <div className="h-12 w-px bg-slate-100" />
             <div className="space-y-1">
                <div className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Success Rate</div>
                <div className="text-4xl font-black text-slate-900">{(conversions.length / (referralClients.length || 1)).toFixed(1)}</div>
             </div>
          </div>

          <div className="relative max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full pl-10 pr-4 bg-white rounded-2xl text-sm ring-1 ring-slate-200 shadow-sm focus:ring-2 focus:ring-emerald-500 transition-colors"
              placeholder="Filter by name or code..."
            />
          </div>

          <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50">
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap italic">
                  <thead className="bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-400">Referrer</th>
                      <th className="px-6 py-4 font-bold text-slate-400">Unique Code</th>
                      <th className="px-6 py-4 font-bold text-slate-400 text-center">Referrals</th>
                      <th className="px-6 py-4 font-bold text-slate-400 text-right">Perform</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 italic font-medium">
                    {leaderboard.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-6 py-5">
                          <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{c.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{c.email} • {c.phone}</div>
                        </td>
                        <td className="px-6 py-5">
                          <code className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-black text-slate-600 ring-1 ring-slate-200">
                            {c.referralCode}
                          </code>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="inline-flex items-center gap-1.5 font-black text-slate-900 bg-white ring-1 ring-slate-100 rounded-full px-4 py-1.5 shadow-sm">
                            {c.points} <Users className="h-4 w-4 text-emerald-500" />
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => openWhatsApp(c.phone, c.name)}
                            className="bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                          >
                            <MessageSquareShare className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] animate-in fade-in slide-in-from-right-4 duration-500">
          <Card className="border-none shadow-2xl shadow-emerald-500/10 ring-1 ring-emerald-500/20 rounded-3xl overflow-hidden">
            <CardBody className="p-10 space-y-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-emerald-600">
                  <Zap className="h-6 w-6" />
                  <h3 className="text-2xl font-black">Intelligent Linkage</h3>
                </div>
                <p className="text-slate-500 text-sm font-medium italic">Manually associate a lead with a referrer. Search your client list to pull data instantly.</p>
              </div>

              {manualMsg && (
                <div className="p-4 rounded-2xl bg-blue-50 text-xs font-black text-blue-700 ring-1 ring-blue-100 flex items-center gap-3">
                   <LinkIcon className="h-4 w-4" /> {manualMsg}
                </div>
              )}

              <form onSubmit={handleManualLink} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Referrer Alphanumeric Code*
                    <input 
                      required value={refCode} onChange={(e) => setRefCode(e.target.value)}
                      className="h-12 bg-slate-50 rounded-2xl px-4 text-sm font-bold ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="e.g. REF-ABC1234"
                    />
                  </label>
                  
                  <div className="relative">
                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Search Existing Client Name
                      <div className="relative">
                        <input 
                          value={searchInClients}
                          onFocus={() => setShowSuggestions(true)}
                          onChange={(e) => setSearchInClients(e.target.value)}
                          className="h-12 w-full bg-slate-100 rounded-2xl px-4 pl-10 text-sm font-bold text-slate-900 border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          placeholder="Type to suggest..."
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                    </label>
                    
                    {showSuggestions && clientSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden">
                         {clientSuggestions.map((c) => (
                           <button
                             key={c.id}
                             type="button"
                             onClick={() => selectSuggestion(c)}
                             className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between"
                           >
                              <span>{c.name} <span className="text-[10px] opacity-40 font-medium italic ml-1">{c.sourceLabel}</span></span>
                              <ChevronDown className="h-3 w-3 -rotate-90 text-slate-400" />
                           </button>
                         ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl space-y-4 ring-1 ring-slate-200/50">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Client Details</div>
                  <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Full Name
                    <input 
                      required value={newName} onChange={(e) => setNewName(e.target.value)}
                      className="h-12 bg-white rounded-2xl px-4 text-sm font-bold ring-1 ring-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Email address
                      <input 
                        required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                        className="h-12 bg-white rounded-2xl px-4 text-sm font-bold ring-1 ring-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </label>
                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Phone Number
                      <input 
                        required value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                        className="h-12 bg-white rounded-2xl px-4 text-sm font-bold ring-1 ring-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                </div>

                <Button type="submit" className="w-full h-14 rounded-2xl shadow-xl shadow-emerald-500/20 text-sm">
                   Finalize Link & Award Points
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card className="bg-slate-900 text-white border-none shadow-2xl rounded-3xl h-fit sticky top-8">
            <CardBody className="p-10 space-y-6">
               <h3 className="text-xl font-bold italic tracking-tight">Referral Intervention Notes</h3>
               <div className="space-y-4">
                  <p className="text-sm text-slate-400 leading-relaxed font-medium italic">
                    Use the manual override when a conversion happens outside the digital tracking route. By searching the existing "Clients" database, you can quickly link records without manual data entry.
                  </p>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 italic">
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Key Tip</div>
                    <p className="text-xs text-slate-300 font-medium">Linking a record manually will instantly update the Referrer's score and potentially unlock a new reward tier for them.</p>
                  </div>
               </div>
            </CardBody>
          </Card>
        </div>
      )}

      {(activeTab === "conversions" || activeTab === "redemptions") && (
        <div className="animate-in fade-in duration-500 py-20 text-center space-y-4">
            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
               <Activity className="h-10 w-10 animate-pulse" />
            </div>
            <div className="text-sm font-bold text-slate-500 italic">Advanced logs are syncing with the unified Clients database.</div>
        </div>
      )}
    </div>
  );
}

function Activity({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" 
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}
