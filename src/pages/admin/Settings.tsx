import { useState } from "react";
import { 
  ShieldCheck, 
  Settings as SettingsIcon, 
  Bell, 
  Lock, 
  Globe, 
  Briefcase, 
  Tag, 
  HelpCircle,
  Plus,
  Trash2,
  ChevronRight,
  Save,
  RefreshCcw,
  Zap,
  List,
  X,
  CheckCircle2
} from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../auth/AuthContext";
import { useSiteConfig } from "../../referrals/siteConfig";

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

  const [activeTab, setActiveTab] = useState<"general" | "services" | "pricing" | "referral" | "gamification">("general");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const isSuper = user?.role === "superadmin";

  const triggerSave = (msg = "Settings saved successfully!") => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
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

  return (
    <div className="space-y-10 pb-20 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ultimate Settings</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 italic">Global command for every word, price, and service on Ablebiz.</p>
        </div>
        
        <div className="flex flex-wrap bg-slate-200/50 p-1.5 rounded-2xl ring-1 ring-slate-200">
          {[
            { id: "general", label: "General", icon: Globe },
            { id: "services", label: "Services", icon: Briefcase },
            { id: "pricing", label: "Pricing", icon: Tag },
            { id: "referral", label: "Referrals", icon: Zap },
            { id: "gamification", label: "Spin Wheel", icon: RefreshCcw },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${
                activeTab === t.id ? "bg-white text-emerald-600 shadow-xl" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <t.icon className="h-4 w-4" />
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
                 onClick={() => { if(confirm("Reset entire website back to code defaults?")) resetAll(); }}
                 className="px-6 py-2.5 rounded-xl bg-white/5 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
               >
                 Factory Reset
               </button>
            </CardBody>
          </Card>
        </div>
      )}

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
                       <button 
                        onClick={() => {
                          const news = services.filter((_, i) => i !== idx);
                          updateServices(news);
                        }}
                        className="text-red-400 hover:text-red-500 p-2"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Short Hook Line
                          <input 
                            value={s.short}
                            onChange={(e) => {
                              const news = [...services]; news[idx].short = e.target.value; updateServices(news);
                            }}
                            className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100 italic"
                          />
                       </label>
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Estimated Timeline
                          <input 
                            value={s.timeline}
                            onChange={(e) => {
                              const news = [...services]; news[idx].timeline = e.target.value; updateServices(news);
                            }}
                            className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100"
                          />
                       </label>
                    </div>

                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Full Service Description
                       <textarea 
                         value={s.description}
                         onChange={(e) => {
                           const news = [...services]; news[idx].description = e.target.value; updateServices(news);
                         }}
                         className="min-h-20 w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium"
                       />
                    </label>

                    <div className="space-y-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <List className="h-3 w-3" /> Bullet Features
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                           {(s.bullets || []).map((b, bIdx) => (
                             <div key={bIdx} className="flex gap-2">
                                <input 
                                  value={b}
                                  onChange={(e) => {
                                    const news = [...services];
                                    news[idx].bullets![bIdx] = e.target.value;
                                    updateServices(news);
                                  }}
                                  className="h-10 flex-1 bg-white rounded-xl px-3 text-xs font-bold ring-1 ring-slate-100 shadow-sm"
                                />
                                <button 
                                  onClick={() => {
                                    const news = [...services];
                                    news[idx].bullets = news[idx].bullets?.filter((_, i) => i !== bIdx);
                                    updateServices(news);
                                  }}
                                  className="text-slate-300 hover:text-red-400"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                             </div>
                           ))}
                           <button 
                             onClick={() => {
                               const news = [...services];
                               news[idx].bullets = [...(news[idx].bullets || []), "New feature..."];
                               updateServices(news);
                             }}
                             className="h-10 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-all text-[10px] font-black"
                           >
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
                                <button 
                                  onClick={() => {
                                    const news = [...services];
                                    news[idx].faqs = news[idx].faqs?.filter((_, i) => i !== fIdx);
                                    updateServices(news);
                                  }}
                                  className="absolute top-2 right-2 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                                <input 
                                  value={f.q}
                                  onChange={(e) => {
                                    const news = [...services];
                                    news[idx].faqs![fIdx].q = e.target.value;
                                    updateServices(news);
                                  }}
                                  className="w-full bg-transparent font-bold text-slate-900 border-none outline-none focus:text-blue-600 italic text-xs mb-2"
                                />
                                <textarea 
                                  value={f.a}
                                  onChange={(e) => {
                                    const news = [...services];
                                    news[idx].faqs![fIdx].a = e.target.value;
                                    updateServices(news);
                                  }}
                                  className="w-full bg-transparent text-[11px] font-medium text-slate-500 border-none outline-none focus:text-slate-700 min-h-12"
                                />
                             </div>
                           ))}
                           <button 
                             onClick={() => {
                               const news = [...services];
                               news[idx].faqs = [...(news[idx].faqs || []), { q: "New Question?", a: "Answer here..." }];
                               updateServices(news);
                             }}
                             className="p-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all text-xs font-bold"
                           >
                             <Plus className="h-4 w-4" /> ADD SERVICE FAQ
                           </button>
                        </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
              
              <button 
                onClick={() => {
                  const newS = {
                    id: `custom-${services.length + 1}`,
                    title: "New Service",
                    short: "Short benefit hook...",
                    description: "Full explanation...",
                    icon: "file" as any,
                    bullets: ["Feature 1"],
                    faqs: [{q: "Question?", a: "Answer."}]
                  };
                  updateServices([...services, newS]);
                }}
                className="p-8 rounded-3xl border-4 border-dashed border-slate-100 text-slate-300 hover:border-emerald-200 hover:text-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center space-y-4"
              >
                <Plus className="h-12 w-12" />
                <span className="text-sm font-black uppercase tracking-widest">Add Brand New Service</span>
              </button>
           </div>
        </div>
      )}

      {activeTab === "pricing" && (
         <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold italic tracking-tight">Financial Tiers</h3>
              <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2">
                 <Save className="h-4 w-4" /> Save Prices
              </Button>
            </div>
            
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
               {pricing.map((p, pIdx) => (
                 <Card key={p.id} className="border-none shadow-xl ring-1 ring-slate-200/50 rounded-3xl overflow-hidden group">
                    <CardBody className="p-8 flex flex-col h-full">
                       <div className="flex items-center justify-between mb-6">
                         <input 
                           value={p.name}
                           onChange={(e) => {
                             const newP = [...pricing]; newP[pIdx].name = e.target.value; updatePricing(newP);
                           }}
                           className="font-black text-slate-900 border-none outline-none focus:text-emerald-600 group-hover:scale-105 transition-all w-2/3"
                         />
                         <button onClick={() => { const newP = pricing.filter((_, i) => i !== pIdx); updatePricing(newP); }} className="text-slate-300 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                         </button>
                       </div>

                       <div className="flex items-baseline gap-1 mb-6">
                          <span className="text-sm font-bold text-slate-400">₦</span>
                          <input 
                            value={p.price}
                            onChange={(e) => {
                              const newP = [...pricing]; newP[pIdx].price = e.target.value; updatePricing(newP);
                            }}
                            className="text-4xl font-black text-slate-900 border-none outline-none w-full"
                          />
                       </div>

                       <div className="flex-1 space-y-4">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Included Features</div>
                          {(p.features || []).map((f, fIdx) => (
                            <div key={fIdx} className="flex gap-2">
                               <input 
                                 value={f}
                                 onChange={(e) => {
                                   const newP = [...pricing]; newP[pIdx].features[fIdx] = e.target.value; updatePricing(newP);
                                 }}
                                 className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-100 italic"
                               />
                               <button onClick={() => { 
                                 const newP = [...pricing]; newP[pIdx].features = newP[pIdx].features.filter((_, i) => i !== fIdx); updatePricing(newP);
                               }} className="text-slate-200 hover:text-red-300">
                                  <X className="h-3 w-3" />
                               </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newP = [...pricing]; newP[pIdx].features = [...newP[pIdx].features, "New feature..."]; updatePricing(newP);
                            }}
                            className="w-full h-10 border-2 border-dashed border-slate-100 rounded-xl text-slate-300 hover:text-emerald-500 hover:border-emerald-200 transition-all font-black text-[10px] uppercase"
                          >
                             + ADD FEATURE
                          </button>
                       </div>
                    </CardBody>
                 </Card>
               ))}
            </div>
         </div>
      )}

      {activeTab === "referral" && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold italic tracking-tight">Referral Rewards Engine</h3>
              <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2">
                 <Save className="h-4 w-4" /> Save Rewards
              </Button>
           </div>
           
           <div className="grid gap-8">
              {referralTiers.map((t, idx) => (
                <Card key={idx} className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50">
                  <CardBody className="p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-4">
                          <span className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs">{idx + 1}</span>
                          <input 
                            value={t.title}
                            onChange={(e) => {
                              const newT = [...referralTiers];
                              newT[idx].title = e.target.value;
                              updateReferralTiers(newT);
                            }}
                            className="text-lg font-black text-slate-900 border-none outline-none focus:text-amber-600 bg-transparent transition-colors"
                          />
                       </div>
                       <button 
                        onClick={() => {
                          const newT = referralTiers.filter((_, i) => i !== idx);
                          updateReferralTiers(newT);
                        }}
                        className="text-red-400 hover:text-red-500 p-2"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Referrals Required
                          <input 
                            type="number"
                            value={t.referralsRequired}
                            onChange={(e) => {
                              const newT = [...referralTiers]; newT[idx].referralsRequired = parseInt(e.target.value) || 0; updateReferralTiers(newT);
                            }}
                            className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100"
                          />
                       </label>
                    </div>

                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Reward Description / Note
                       <textarea 
                         value={t.note}
                         onChange={(e) => {
                           const newT = [...referralTiers]; newT[idx].note = e.target.value; updateReferralTiers(newT);
                         }}
                         className="min-h-20 w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium"
                       />
                    </label>
                  </CardBody>
                </Card>
              ))}
              
              <button 
                onClick={() => {
                  const newT = {
                    referralsRequired: (referralTiers[referralTiers.length - 1]?.referralsRequired || 0) + 5,
                    title: "New Reward",
                    note: "Details about the reward..."
                  };
                  updateReferralTiers([...referralTiers, newT]);
                }}
                className="p-8 rounded-3xl border-4 border-dashed border-slate-100 text-slate-300 hover:border-amber-200 hover:text-amber-500 hover:bg-amber-50 transition-all flex flex-col items-center justify-center space-y-4"
              >
                <Plus className="h-12 w-12" />
                <span className="text-sm font-black uppercase tracking-widest">Add New Reward Tier</span>
              </button>
           </div>
        </div>
      )}

      {activeTab === "gamification" && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold italic tracking-tight">Spin Wheel Configuration</h3>
              <Button onClick={() => triggerSave()} className="h-10 px-6 gap-2">
                 <Save className="h-4 w-4" /> Save Prizes
              </Button>
           </div>
           
           <div className="grid gap-8">
              {spinRewards.map((r, idx) => (
                <Card key={idx} className="border-none shadow-xl ring-1 ring-slate-100">
                  <CardBody className="p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-4">
                          <span className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">{idx + 1}</span>
                          <input 
                            value={r.title}
                            onChange={(e) => {
                              const newR = [...spinRewards]; newR[idx].title = e.target.value; updateSpinRewards(newR);
                            }}
                            className="text-lg font-black text-slate-900 border-none outline-none focus:text-blue-600 bg-transparent transition-colors"
                          />
                       </div>
                       <button 
                        onClick={() => {
                          const newR = spinRewards.filter((_, i) => i !== idx); updateSpinRewards(newR);
                        }}
                        className="text-red-400 hover:text-red-500 p-2"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Logic Type (Internal ID)
                          <input 
                            value={r.type}
                            onChange={(e) => {
                              const newR = [...spinRewards]; newR[idx].type = e.target.value as any; updateSpinRewards(newR);
                            }}
                            className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100"
                          />
                       </label>
                       <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Probability Weight (0-100)
                          <input 
                            type="number"
                            value={r.weight}
                            onChange={(e) => {
                              const newR = [...spinRewards]; newR[idx].weight = parseInt(e.target.value) || 0; updateSpinRewards(newR);
                            }}
                            className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold ring-1 ring-slate-100"
                          />
                       </label>
                    </div>

                    <label className="grid gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Public Short Description
                       <textarea 
                         value={r.short}
                         onChange={(e) => {
                           const newR = [...spinRewards]; newR[idx].short = e.target.value; updateSpinRewards(newR);
                         }}
                         className="min-h-20 w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium"
                       />
                    </label>
                  </CardBody>
                </Card>
              ))}
              
              <button 
                onClick={() => {
                  const newR = {
                    type: `custom_${Date.now()}` as any,
                    title: "New Prize",
                    short: "Details about the prize...",
                    weight: 10
                  };
                  updateSpinRewards([...spinRewards, newR]);
                }}
                className="p-8 rounded-3xl border-4 border-dashed border-slate-100 text-slate-300 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center justify-center space-y-4"
              >
                <Plus className="h-12 w-12" />
                <span className="text-sm font-black uppercase tracking-widest">Add New Wheel Prize</span>
              </button>
           </div>
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

