import { useMemo } from "react";
import { 
  Users, 
  TrendingUp, 
  Gift, 
  Target, 
  Activity, 
  MessageSquare, 
  Gamepad2,
  CheckCircle2,
  Clock,
  ArrowUpRight
} from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { getBusinessHealthReport, getUnifiedClients, USER_GROUPS } from "../../referrals/core";

export function AdminDashboard() {
  const stats = useMemo(() => getBusinessHealthReport(), []);
  const recentClients = useMemo(() => getUnifiedClients().slice(0, 6), []);

  const metricCards = [
    { label: "Total Interactors", value: stats.totalLeads + stats.totalSpins + stats.totalReferrers, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Clients", value: (stats.groupBreakdown as any).client + (stats.groupBreakdown as any).returning_client + (stats.groupBreakdown as any).vip, icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Revenue Prospects", value: (stats.groupBreakdown as any).prospect, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Pending Rewards", value: stats.pendingRedemptions, icon: Gift, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Business Command</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 italic">Real-time pulse of your registration flywheel.</p>
        </div>
        <div className="flex gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 ring-1 ring-emerald-500/20">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Live System Active
            </span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((m) => (
          <Card key={m.label} className="border-none shadow-xl shadow-slate-200/40 ring-1 ring-slate-100/50 group hover:scale-[1.02] transition-all">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${m.bg} ${m.color}`}>
                  <m.icon className="h-6 w-6" />
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] group-hover:text-emerald-400 transition-colors">ABLEBIZ</div>
              </div>
              <div className="text-2xl font-black text-slate-900">{m.value}</div>
              <div className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wider">{m.label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
           <Card className="border-none shadow-2xl shadow-slate-200/50 ring-1 ring-slate-100 overflow-hidden group">
              <CardBody className="p-8">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                       <Activity className="h-5 w-5 text-emerald-500" />
                       <h3 className="text-xl font-black text-slate-900 tracking-tight">System Activity Feed</h3>
                    </div>
                    <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors">View All Logs</button>
                 </div>

                 <div className="space-y-6">
                    {recentClients.map((c) => (
                      <div key={c.id} className="flex gap-4 group/item">
                         <div className="relative">
                            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-black text-xs ${
                               c.source === 'referral' ? 'bg-emerald-500' : 
                               c.source === 'consultation' ? 'bg-blue-500' : 'bg-purple-500'
                            }`}>
                               {c.source === 'referral' ? 'R' : c.source === 'consultation' ? 'L' : 'G'}
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                               {c.status === 'completed' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Clock className="h-3 w-3 text-amber-500" />}
                            </div>
                         </div>
                         <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                   <div className="text-sm font-bold text-slate-900 group-hover/item:text-emerald-600 transition-colors">{c.name}</div>
                                   <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                      USER_GROUPS.find(g => g.id === (c as any).group)?.color || "bg-slate-100 text-slate-500"
                                   }`}>
                                      {(c as any).group || 'visitor'}
                                   </span>
                                </div>
                               <div className="text-[10px] font-medium text-slate-400 italic">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <div className="text-xs text-slate-500 font-medium italic">
                               {c.source === 'referral' && "Joined the referral program to become a partner."}
                               {c.source === 'consultation' && `Requested a consultation for ${c.serviceNeeded}.`}
                               {c.source === 'spin' && `Successfully won a prize in the Spin & Win game.`}
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </CardBody>
           </Card>

           <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-slate-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Target className="h-32 w-32" />
              </div>
              <CardBody className="p-8 relative">
                 <h3 className="text-lg font-bold mb-6">Service Demand Heatmap</h3>
                 <div className="space-y-4">
                    {Object.entries(stats.leadsByService).map(([name, count]: any) => (
                      <div key={name} className="space-y-1">
                         <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>{name}</span>
                            <span>{count} leads</span>
                         </div>
                         <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(100, (count / (stats.totalLeads || 1)) * 100)}%` }}
                             />
                         </div>
                      </div>
                    ))}
                 </div>
              </CardBody>
           </Card>
        </div>

        <div className="space-y-8">
           <Card className="border-none shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/20 bg-emerald-50/30">
              <CardBody className="p-8 space-y-4">
                 <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <TrendingUp className="h-6 w-6" />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Growth Suggestion</h3>
                    <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed italic">
                       Service demand for <span className="text-emerald-600 font-bold">"CAC Registration"</span> has spiked 20% this week. Consider featuring it on the hero section for better conversion.
                    </p>
                 </div>
                 <button className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mt-2 group">
                    Quick Update Link <ArrowUpRight className="h-3 w-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                 </button>
              </CardBody>
           </Card>

           <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-white">
              <CardBody className="p-8 text-center space-y-4">
                 <div className="h-16 w-16 mx-auto bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center">
                    <Gamepad2 className="h-8 w-8" />
                 </div>
                 <div>
                    <div className="text-2xl font-black text-slate-900">{stats.totalSpins}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Game Spins</div>
                 </div>
                 <div className="pt-2">
                    <div className="text-xs font-medium text-slate-500 italic">User engagement is high. The gamification loop is successfully driving data acquisition.</div>
                 </div>
              </CardBody>
           </Card>

           <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white">
              <CardBody className="p-8 space-y-6">
                 <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Group Distribution</h3>
                 <div className="space-y-4">
                    {USER_GROUPS.map((g) => {
                       const count = (stats.groupBreakdown as any)[g.id] || 0;
                       const total = stats.totalLeads + stats.totalSpins + stats.totalReferrers || 1;
                       return (
                          <div key={g.id} className="space-y-1.5">
                             <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-500 uppercase tracking-widest">{g.label}</span>
                                <span className="text-slate-900">{count}</span>
                             </div>
                             <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                <div 
                                   className={`h-full rounded-full ${g.color.split(' ')[0]}`}
                                   style={{ width: `${(count / total) * 100}%` }}
                                />
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </CardBody>
           </Card>
        </div>
      </div>
    </div>
  );
}
