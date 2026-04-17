import { useState } from "react";
import { 
  ShieldCheck, 
  Bell, 
  Lock, 
  Globe, 
  Briefcase, 
  Tag, 
  HelpCircle,
  Plus,
  Trash2,
  Save,
  RefreshCcw,
  Zap,
  List,
  X,
  CheckCircle2,
  Download,
  AlertTriangle,
  UserCog,
  MessageSquare,
  Phone as PhoneIcon,
  Database,
  Eye,
  EyeOff,
  Key
} from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../auth/AuthContext";
import { useSiteConfig } from "../../referrals/siteConfig";
import { getReferralClients, getLeads, getReferralConversions, getEnrichedRedemptions } from "../../referrals/core";

type TabId = "general" | "services" | "pricing" | "referral" | "gamification" | "notifications" | "accounts";

export function AdminSettings() {
  const { user } = useAuth();
  const { 
    site, updateSite, 
    services, updateServices, 
    pricing, updatePricing,
    referralTiers, updateReferralTiers,
    spinRewards, updateSpinRewards,
    resetAll 
  } = useSiteConfig();

  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Notification settings (stored locally)
  const [notifPhone, setNotifPhone] = useState(() => localStorage.getItem("ablebiz_notif_phone") || "");
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem("ablebiz_notif_enabled") !== "false");
  const [autoReply, setAutoReply] = useState(() => localStorage.getItem("ablebiz_notif_autoreply") || "Thank you for reaching out to ABLEBIZ! We'll get back to you within 2 hours.");

  const isSuper = user?.role === "superadmin";

  const triggerSave = (msg = "Settings saved successfully!") => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const saveNotifications = () => {
    localStorage.setItem("ablebiz_notif_phone", notifPhone);
    localStorage.setItem("ablebiz_notif_enabled", String(notifEnabled));
    localStorage.setItem("ablebiz_notif_autoreply", autoReply);
    triggerSave("Notification settings saved!");
  };

  const handlePasswordChange = () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: "err", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: "Passwords do not match." });
      return;
    }
    // In a real app this would call an API; here we just show success
    setPasswordMsg({ type: "ok", text: "Password updated successfully." });
    setNewPassword(""); setConfirmPassword("");
    setTimeout(() => setPasswordMsg(null), 4000);
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
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `ablebiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerSave("Full backup exported!");
  };

  const clearDataCategory = (key: string, label: string) => {
    if (!confirm(`Are you sure you want to delete all ${label}? This cannot be undone.`)) return;
    localStorage.removeItem(key);
    triggerSave(`${label} cleared.`);
    setTimeout(() => window.location.reload(), 1000);
  };

  if (!isSuper) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="h-20 w-20 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center shadow-inner">
           <ShieldCheck className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-sm font-medium text-slate-500 max-w-sm">
            Only Superadmins can modify global website configurations and business parameters.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "general",       label: "General",       icon: Globe },
    { id: "services",      label: "Services",       icon: Briefcase },
    { id: "pricing",       label: "Pricing",        icon: Tag },
    { id: "referral",      label: "Referrals",      icon: Zap },
    { id: "gamification",  label: "Spin Wheel",     icon: RefreshCcw },
    { id: "notifications", label: "Notifications",  icon: Bell },
    { id: "accounts",      label: "Admin Accounts", icon: UserCog },
  ];

  return (
    <div className="space-y-10 pb-20 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ultimate Settings</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 italic">Global command for every word, price, and service on Ablebiz.</p>
        </div>
        
        <div className="flex flex-wrap bg-slate-200/50 p-1.5 rounded-2xl ring-1 ring-slate-200 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all ${
                activeTab === t.id ? "bg-white text-emerald-600 shadow-xl" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {saveStatus && (
        <div className="fixed top-8 right-8 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl text-white text-sm font-bold shadow-2xl ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              {saveStatus}
           </div>
        </div>
      )}

      {/* ── General ── */}
      {activeTab === "general" && (
        <div className="grid gap-8 animate-in fade-in duration-500">
          <Card className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50 bg-emerald-600 text-white overflow-hidden relative">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="h-32 w-32" />
             </div>
             <CardBody className="p-10 relative">
                <div className="flex items-center gap-4">
                   <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black">
                      {user?.name?.[0] || "A"}
                   </div>
                   <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Session Authenticated</div>
                      <h3 className="text-2xl font-black">{user?.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-xs font-bold px-2 py-0.5 bg-white/10 rounded-lg">{user?.role}</span>
                         <span className="h-1 w-1 rounded-full bg-white/30" />
                         <span className="text-xs font-medium opacity-70">{user?.email}</span>
                      </div>
                   </div>
                </div>
             </CardBody>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50">
            <CardBody className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                   <h3 className="text-xl font-bold italic tracking-tight">Core Branding</h3>
                   <p className="text-xs font-medium text-slate-400">Basic site identity and contact info.</p>
                </div>
                <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2">
                   <Save className="h-4 w-4" /> Save General
                </Button>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <InputGroup label="Website Name" value={site.name} onChange={(v) => updateSite({...site, name: v})} />
                <InputGroup label="Award/Achievement Badge" value={site.awardBadge} onChange={(v) => updateSite({...site, awardBadge: v})} />
              </div>
              <label className="grid gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                Site Tagline/Description
                <textarea 
                  value={site.tagline}
                  onChange={(e) => updateSite({...site, tagline: e.target.value})}
                  className="min-h-24 w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </label>

              <div className="grid gap-8 md:grid-cols-3">
                <InputGroup label="Public Phone" value={site.phone} onChange={(v) => updateSite({...site, phone: v})} />
                <InputGroup label="Public Email" value={site.email} onChange={(v) => updateSite({...site, email: v})} />
                <InputGroup label="Physical Office" value={site.location} onChange={(v) => updateSite({...site, location: v})} />
              </div>
            </CardBody>
          </Card>

          {/* Data Management */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200/50">
            <CardBody className="p-10 space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  <h3 className="text-xl font-bold italic tracking-tight">Data Management</h3>
                </div>
                <p className="text-xs font-medium text-slate-400">Export or selectively clear data categories stored on this device.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={exportAllData}
                  className="flex items-center gap-4 p-5 rounded-2xl bg-blue-50 ring-1 ring-blue-100 hover:bg-blue-100 transition-all text-left group"
                >
                  <div className="p-3 bg-blue-500 rounded-xl text-white group-hover:scale-110 transition-transform">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-sm">Export Full Backup</div>
                    <div className="text-[10px] font-medium text-slate-500 mt-0.5">Clients, leads, conversions, rewards → JSON</div>
                  </div>
                </button>

                {[
                  { key: "ablebiz_ref_clients",     label: "Referral Clients",  color: "emerald" },
                  { key: "ablebiz_leads",            label: "Consultation Leads", color: "purple" },
                  { key: "ablebiz_ref_conversions",  label: "Conversions",        color: "amber" },
                  { key: "ablebiz_ref_redemptions",  label: "Redemptions",        color: "rose" },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => clearDataCategory(cat.key, cat.label)}
                    className={`flex items-center gap-4 p-5 rounded-2xl bg-${cat.color}-50 ring-1 ring-${cat.color}-100 hover:bg-${cat.color}-100 transition-all text-left group`}
                  >
                    <div className={`p-3 bg-${cat.color}-500 rounded-xl text-white group-hover:scale-110 transition-transform`}>
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-black text-slate-900 text-sm">Clear {cat.label}</div>
                      <div className="text-[10px] font-medium text-slate-500 mt-0.5">Permanently removes this data category</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 ring-1 ring-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-800">Clearing data is permanent and local. Export a backup first if unsure.</p>
              </div>
            </CardBody>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-slate-900 text-white">
            <CardBody className="p-10 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
                     <RefreshCcw className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Hard Reset</h3>
                    <p className="text-sm text-slate-400 font-medium">Clear all custom settings and return to factory defaults.</p>
                  </div>
               </div>
               <button 
                 onClick={() => { if(confirm("Reset entire website back to code defaults?")) { resetAll(); setTimeout(() => window.location.reload(), 500); } }}
                 className="px-6 py-2.5 rounded-xl bg-white/5 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
               >
                 Factory Reset
               </button>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ── Services ── */}
      {activeTab === "services" && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold italic tracking-tight">Service Catalogue</h3>
              <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2">
                 <Save className="h-4 w-4" /> Save Catalogue
              </Button>
           </div>
           <div className="grid gap-8">
              {services.map((s, idx) => (
                <Card key={s.id} className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50">
                  <CardBody className="p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-4">
                          <span className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs">{idx + 1}</span>
                          <input 
                            value={s.title}
                            onChange={(e) => {
                              const news = [...services];
                              news[idx].title = e.target.value;
                              updateServices(news);
                            }}
                            className="text-lg font-black text-slate-900 border-none outline-none focus:text-emerald-600 bg-transparent transition-colors"
                          />
                       </div>
                       <button onClick={() => { const news = services.filter((_, i) => i !== idx); updateServices(news); }} className="text-red-400 hover:text-red-500 p-2">
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Short Hook Line
                          <input value={s.short} onChange={(e) => { const news = [...services]; news[idx].short = e.target.value; updateServices(news); }} className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100 italic" />
                       </label>
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Estimated Timeline
                          <input value={s.timeline} onChange={(e) => { const news = [...services]; news[idx].timeline = e.target.value; updateServices(news); }} className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100" />
                       </label>
                    </div>

                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Full Service Description
                       <textarea value={s.description} onChange={(e) => { const news = [...services]; news[idx].description = e.target.value; updateServices(news); }} className="min-h-20 w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium" />
                    </label>

                    <div className="space-y-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <List className="h-3 w-3" /> Bullet Features
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                           {(s.bullets || []).map((b, bIdx) => (
                             <div key={bIdx} className="flex gap-2">
                                <input value={b} onChange={(e) => { const news = [...services]; news[idx].bullets![bIdx] = e.target.value; updateServices(news); }} className="h-10 flex-1 bg-white rounded-xl px-3 text-xs font-bold ring-1 ring-slate-100 shadow-sm" />
                                <button onClick={() => { const news = [...services]; news[idx].bullets = news[idx].bullets?.filter((_, i) => i !== bIdx); updateServices(news); }} className="text-slate-300 hover:text-red-400"><X className="h-4 w-4" /></button>
                             </div>
                           ))}
                           <button onClick={() => { const news = [...services]; news[idx].bullets = [...(news[idx].bullets || []), "New feature..."]; updateServices(news); }} className="h-10 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-all text-[10px] font-black">
                             <Plus className="h-4 w-4" /> ADD FEATURE
                           </button>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <HelpCircle className="h-3 w-3" /> FAQs
                        </div>
                        <div className="grid gap-6">
                           {(s.faqs || []).map((f, fIdx) => (
                             <div key={fIdx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                <button onClick={() => { const news = [...services]; news[idx].faqs = news[idx].faqs?.filter((_, i) => i !== fIdx); updateServices(news); }} className="absolute top-2 right-2 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-3 w-3" /></button>
                                <input value={f.q} onChange={(e) => { const news = [...services]; news[idx].faqs![fIdx].q = e.target.value; updateServices(news); }} className="w-full bg-transparent font-bold text-slate-900 border-none outline-none focus:text-blue-600 italic text-xs mb-2" />
                                <textarea value={f.a} onChange={(e) => { const news = [...services]; news[idx].faqs![fIdx].a = e.target.value; updateServices(news); }} className="w-full bg-transparent text-[11px] font-medium text-slate-500 border-none outline-none focus:text-slate-700 min-h-12" />
                             </div>
                           ))}
                           <button onClick={() => { const news = [...services]; news[idx].faqs = [...(news[idx].faqs || []), { q: "New Question?", a: "Answer here..." }]; updateServices(news); }} className="p-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all text-xs font-bold">
                             <Plus className="h-4 w-4" /> ADD SERVICE FAQ
                           </button>
                        </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
              <button onClick={() => { const newS = { id: `custom-${services.length + 1}`, title: "New Service", short: "Short benefit hook...", description: "Full explanation...", icon: "file" as any, bullets: ["Feature 1"], faqs: [{q: "Question?", a: "Answer."}] }; updateServices([...services, newS]); }} className="p-8 rounded-3xl border-4 border-dashed border-slate-100 text-slate-300 hover:border-emerald-200 hover:text-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center space-y-4">
                <Plus className="h-12 w-12" />
                <span className="text-sm font-black uppercase tracking-widest">Add Brand New Service</span>
              </button>
           </div>
        </div>
      )}

      {/* ── Pricing ── */}
      {activeTab === "pricing" && (
         <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold italic tracking-tight">Financial Tiers</h3>
              <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2"><Save className="h-4 w-4" /> Save Prices</Button>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
               {pricing.map((p, pIdx) => (
                 <Card key={p.id} className="border-none shadow-xl ring-1 ring-slate-200/50 rounded-3xl overflow-hidden group">
                    <CardBody className="p-8 flex flex-col h-full">
                       <div className="flex items-center justify-between mb-6">
                         <input value={p.name} onChange={(e) => { const newP = [...pricing]; newP[pIdx].name = e.target.value; updatePricing(newP); }} className="font-black text-slate-900 border-none outline-none focus:text-emerald-600 group-hover:scale-105 transition-all w-2/3" />
                         <button onClick={() => { const newP = pricing.filter((_, i) => i !== pIdx); updatePricing(newP); }} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                       </div>
                       <div className="flex items-baseline gap-1 mb-6">
                          <span className="text-sm font-bold text-slate-400">₦</span>
                          <input value={p.price} onChange={(e) => { const newP = [...pricing]; newP[pIdx].price = e.target.value; updatePricing(newP); }} className="text-4xl font-black text-slate-900 border-none outline-none w-full" />
                       </div>
                       <div className="flex-1 space-y-4">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Included Features</div>
                          {(p.features || []).map((f, fIdx) => (
                            <div key={fIdx} className="flex gap-2">
                               <input value={f} onChange={(e) => { const newP = [...pricing]; newP[pIdx].features[fIdx] = e.target.value; updatePricing(newP); }} className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-100 italic" />
                               <button onClick={() => { const newP = [...pricing]; newP[pIdx].features = newP[pIdx].features.filter((_, i) => i !== fIdx); updatePricing(newP); }} className="text-slate-200 hover:text-red-300"><X className="h-3 w-3" /></button>
                            </div>
                          ))}
                          <button onClick={() => { const newP = [...pricing]; newP[pIdx].features = [...newP[pIdx].features, "New feature..."]; updatePricing(newP); }} className="w-full h-10 border-2 border-dashed border-slate-100 rounded-xl text-slate-300 hover:text-emerald-500 hover:border-emerald-200 transition-all font-black text-[10px] uppercase">+ ADD FEATURE</button>
                       </div>
                    </CardBody>
                 </Card>
               ))}
            </div>
         </div>
      )}

      {/* ── Referral Tiers ── */}
      {activeTab === "referral" && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold italic tracking-tight">Referral Rewards Engine</h3>
              <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2"><Save className="h-4 w-4" /> Save Rewards</Button>
           </div>
           <div className="grid gap-8">
              {referralTiers.map((t, idx) => (
                <Card key={idx} className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50">
                  <CardBody className="p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-4">
                          <span className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs">{idx + 1}</span>
                          <input value={t.title} onChange={(e) => { const newT = [...referralTiers]; newT[idx].title = e.target.value; updateReferralTiers(newT); }} className="text-lg font-black text-slate-900 border-none outline-none focus:text-amber-600 bg-transparent transition-colors" />
                       </div>
                       <button onClick={() => { const newT = referralTiers.filter((_, i) => i !== idx); updateReferralTiers(newT); }} className="text-red-400 hover:text-red-500 p-2"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Referrals Required
                          <input type="number" value={t.referralsRequired} onChange={(e) => { const newT = [...referralTiers]; newT[idx].referralsRequired = parseInt(e.target.value) || 0; updateReferralTiers(newT); }} className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100" />
                       </label>
                    </div>
                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Reward Description / Note
                       <textarea value={t.note} onChange={(e) => { const newT = [...referralTiers]; newT[idx].note = e.target.value; updateReferralTiers(newT); }} className="min-h-20 w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium" />
                    </label>
                  </CardBody>
                </Card>
              ))}
              <button onClick={() => { const newT = { referralsRequired: (referralTiers[referralTiers.length - 1]?.referralsRequired || 0) + 5, title: "New Reward", note: "Details about the reward..." }; updateReferralTiers([...referralTiers, newT]); }} className="p-8 rounded-3xl border-4 border-dashed border-slate-100 text-slate-300 hover:border-amber-200 hover:text-amber-500 hover:bg-amber-50 transition-all flex flex-col items-center justify-center space-y-4">
                <Plus className="h-12 w-12" />
                <span className="text-sm font-black uppercase tracking-widest">Add New Reward Tier</span>
              </button>
           </div>
        </div>
      )}

      {/* ── Spin Wheel ── */}
      {activeTab === "gamification" && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold italic tracking-tight">Spin Wheel Configuration</h3>
              <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2"><Save className="h-4 w-4" /> Save Prizes</Button>
           </div>
           <div className="grid gap-8">
              {spinRewards.map((r, idx) => (
                <Card key={idx} className="border-none shadow-xl ring-1 ring-slate-100">
                  <CardBody className="p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-4">
                          <span className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">{idx + 1}</span>
                          <input value={r.title} onChange={(e) => { const newR = [...spinRewards]; newR[idx].title = e.target.value; updateSpinRewards(newR); }} className="text-lg font-black text-slate-900 border-none outline-none focus:text-blue-600 bg-transparent transition-colors" />
                       </div>
                       <button onClick={() => { const newR = spinRewards.filter((_, i) => i !== idx); updateSpinRewards(newR); }} className="text-red-400 hover:text-red-500 p-2"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Logic Type (Internal ID)
                          <input value={r.type} onChange={(e) => { const newR = [...spinRewards]; newR[idx].type = e.target.value as any; updateSpinRewards(newR); }} className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100" />
                       </label>
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Probability Weight (0-100)
                          <input type="number" value={r.weight} onChange={(e) => { const newR = [...spinRewards]; newR[idx].weight = parseInt(e.target.value) || 0; updateSpinRewards(newR); }} className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100" />
                       </label>
                    </div>
                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Public Short Description
                       <textarea value={r.short} onChange={(e) => { const newR = [...spinRewards]; newR[idx].short = e.target.value; updateSpinRewards(newR); }} className="min-h-20 w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium" />
                    </label>
                  </CardBody>
                </Card>
              ))}
              <button onClick={() => { const newR = { type: `custom_${Date.now()}` as any, title: "New Prize", short: "Details about the prize...", weight: 10 }; updateSpinRewards([...spinRewards, newR]); }} className="p-8 rounded-3xl border-4 border-dashed border-slate-100 text-slate-300 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center justify-center space-y-4">
                <Plus className="h-12 w-12" />
                <span className="text-sm font-black uppercase tracking-widest">Add New Wheel Prize</span>
              </button>
           </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {activeTab === "notifications" && (
        <div className="grid gap-8 animate-in fade-in duration-500">
          <Card className="border-none shadow-xl ring-1 ring-slate-200/50">
            <CardBody className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-500" />
                    <h3 className="text-xl font-bold italic tracking-tight">Notification Configuration</h3>
                  </div>
                  <p className="text-xs font-medium text-slate-400">Configure how the system alerts you about new leads and conversions.</p>
                </div>
                <Button onClick={saveNotifications} className="h-10 px-6 gap-2">
                  <Save className="h-4 w-4" /> Save Notifications
                </Button>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                <div>
                  <div className="font-black text-slate-900 text-sm">Enable Consultation Notifications</div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5">Receive WhatsApp alerts when a new consultation form is submitted</div>
                </div>
                <button
                  onClick={() => setNotifEnabled(!notifEnabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${notifEnabled ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform ${notifEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Notification phone */}
              <label className="grid gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <PhoneIcon className="h-3.5 w-3.5" /> WhatsApp Alert Number
                </div>
                <input
                  value={notifPhone}
                  onChange={(e) => setNotifPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="h-12 w-full bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <span className="text-xs font-medium text-slate-400">This number receives WhatsApp alerts for each new consultation request.</span>
              </label>

              {/* Auto-reply template */}
              <label className="grid gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" /> Auto-Reply Message Template
                </div>
                <textarea
                  value={autoReply}
                  onChange={(e) => setAutoReply(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                />
                <span className="text-xs font-medium text-slate-400">Message sent to new clients automatically after form submission (WhatsApp).</span>
              </label>
            </CardBody>
          </Card>

          {/* Preview */}
          <Card className="border-none shadow-sm ring-1 ring-emerald-200/50 bg-emerald-50/40">
            <CardBody className="p-8 space-y-4">
              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Preview</div>
              <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-emerald-100 max-w-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Auto-Reply Preview</div>
                <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{autoReply || "No message configured."}</p>
              </div>
              <p className="text-xs font-medium text-slate-500 italic">
                Notifications will be sent to: <span className="font-black text-emerald-700">{notifPhone || "No number set"}</span>
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ── Admin Accounts ── */}
      {activeTab === "accounts" && (
        <div className="grid gap-8 animate-in fade-in duration-500">
          {/* Current session */}
          <Card className="border-none shadow-xl ring-1 ring-slate-200/50">
            <CardBody className="p-10 space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-purple-500" />
                  <h3 className="text-xl font-bold italic tracking-tight">Admin Account Management</h3>
                </div>
                <p className="text-xs font-medium text-slate-400">Manage admin credentials and access levels.</p>
              </div>

              {/* Account info */}
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Display Name", value: user?.name || "—" },
                  { label: "Email Address", value: user?.email || "—" },
                  { label: "Access Level",  value: user?.role || "—" },
                ].map((f) => (
                  <div key={f.label} className="p-5 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.label}</div>
                    <div className="font-black text-slate-900 text-sm">{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Password change */}
              <div className="pt-4 border-t border-slate-100 space-y-6">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-amber-500" />
                  <h4 className="font-black text-slate-900 text-sm">Change Password</h4>
                </div>

                {passwordMsg && (
                  <div className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-black ring-1 ${
                    passwordMsg.type === "ok"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      : "bg-red-50 text-red-700 ring-red-100"
                  }`}>
                    {passwordMsg.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {passwordMsg.text}
                  </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="grid gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    New Password
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="h-12 w-full bg-slate-50 rounded-2xl px-4 pr-12 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <label className="grid gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    Confirm New Password
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="h-12 w-full bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </label>
                </div>
                <Button onClick={handlePasswordChange} className="h-11 px-8 gap-2">
                  <Lock className="h-4 w-4" /> Update Password
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Security notice */}
          <Card className="border-none shadow-sm ring-1 ring-amber-200/50 bg-amber-50/40">
            <CardBody className="p-8 flex items-start gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-500 flex-shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-amber-900 text-sm">Multi-Admin Support Coming Soon</h4>
                <p className="mt-1 text-xs font-medium text-amber-800 leading-relaxed opacity-80">
                  Creating additional admin accounts requires backend integration. Currently only the Superadmin account is supported. Contact the development team to provision additional admin users via the server configuration.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function InputGroup({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <label className="grid gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
      {label}
      <input 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
      />
    </label>
  );
}
