import { useMemo } from "react";
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  Calendar,
  AlertCircle,
  Users
} from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { getBusinessHealthReport, USER_GROUPS } from "../../referrals/core";

export function AdminReports() {
  const stats = useMemo(() => getBusinessHealthReport(), []);

  // Use actual funnel data from stats
  const funnel = [
    { label: "Discovery (Total Traffic/Spins)", value: stats.funnel.discovery, color: "bg-blue-500", icon: Activity },
    { label: "Engagement (Leads + Game Plays)", value: stats.funnel.engagement, color: "bg-purple-500", icon: Target },
    { label: "Lead Generation", value: stats.totalLeads, color: "bg-emerald-500", icon: CheckCircle2 },
    { label: "Advocacy (Referrers)", value: stats.totalReferrers, color: "bg-amber-500", icon: Users },
  ];

  const milestones = [
    { title: "Expand physical office to Abuja", status: "In Progress", date: "Q3 2026", icon: TrendingUp },
    { title: "Integrate Automated CAC Monitoring", status: "Planned", date: "Q4 2026", icon: Calendar },
    { title: "Launch International Business Support", status: "Research", date: "2027", icon: Activity },
  ];

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Reports & Insights</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Long-term business performance and strategic milestones.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 transition-all">
          <BarChart3 className="h-4 w-4" /> Export Full Report
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
          <CardBody className="p-8">
            <div className="flex items-center gap-2 mb-8">
              <Target className="h-5 w-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-slate-900">Conversion Pipeline</h3>
            </div>

            <div className="space-y-8">
              {funnel.map((step, i) => (
                <div key={step.label} className="relative">
                  <div className="flex justify-between items-end mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <step.icon className={`h-3.5 w-3.5 ${step.color.replace('bg-', 'text-')}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{step.label}</span>
                    </div>
                    <span className="text-lg font-black text-slate-900">{step.value}</span>
                  </div>
                  <div className="h-4 rounded-full bg-slate-50 overflow-hidden ring-1 ring-slate-100 italic">
                    <div 
                      className={`h-full ${step.color} rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,0,0,0.1)]`}
                      style={{ width: `${Math.min(100, (step.value / (funnel[0].value || 1)) * 100)}%` }}
                    />
                  </div>
                  {i < funnel.length - 1 && (
                     <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 h-4 w-0.5 bg-slate-100" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-2xl bg-slate-900 p-6 flex items-start gap-4 text-white shadow-xl">
              <div className="p-2 bg-white/10 rounded-lg shadow-sm">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white italic">Strategic Insight</div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed font-medium">
                  The current <span className="text-emerald-400 font-black">{( (stats.totalLeads / (stats.funnel.discovery || 1)) * 100 ).toFixed(1)}% discovery-to-lead</span> conversion suggests strong initial attraction. Focus on the engagement layer to pull more visitors into the lead funnel.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-8">
           <Card className="border-none shadow-sm ring-1 ring-slate-200/50">
            <CardBody className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-bold text-slate-900">Vertical Demand</h3>
              </div>
              
              <div className="grid gap-3">
                 {Object.entries(stats.leadsByService).length === 0 ? (
                    <div className="text-slate-400 text-xs font-medium italic py-4">Waiting for more demand data...</div>
                 ) : (
                    Object.entries(stats.leadsByService).map(([name, count]: any) => (
                      <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 italic transition-all hover:scale-[1.02] hover:shadow-sm">
                        <span className="text-xs font-bold text-slate-700">{name}</span>
                        <span className="text-xs font-black text-blue-600 bg-white px-2 py-0.5 rounded-lg shadow-sm">{count}</span>
                      </div>
                    ))
                 )}
              </div>
            </CardBody>
          </Card>

           <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <TrendingUp className="h-32 w-32" />
            </div>
            <CardBody className="p-8 relative">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="h-5 w-5 text-emerald-400" />
                <h3 className="text-lg font-bold">Business Roadmap</h3>
              </div>
              
              <div className="space-y-6">
                {milestones.map((m) => (
                  <div key={m.title} className="flex gap-4 group">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 group-hover:bg-emerald-500/20 transition-all">
                      <m.icon className="h-5 w-5 text-slate-400 group-hover:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold group-hover:text-emerald-400 transition-all">{m.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{m.date}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-700" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">{m.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

           <Card className="border-none shadow-sm ring-1 ring-slate-200/50">
            <CardBody className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <Users className="h-5 w-5 text-purple-500" />
                <h3 className="text-lg font-bold text-slate-900">Unified Group Breakdown</h3>
              </div>
              
              <div className="space-y-4">
                 {USER_GROUPS.map((g) => {
                    const count = (stats.groupBreakdown as any)[g.id] || 0;
                    const total = stats.funnel.discovery || 1;
                    return (
                       <div key={g.id} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                             <span className="text-slate-500 uppercase tracking-widest">{g.label}</span>
                             <span className="text-slate-900">{count} ({( (count/total)*100 ).toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden ring-1 ring-slate-100 italic">
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
      
      <div className="rounded-3xl bg-amber-50 p-8 flex items-start gap-4 ring-1 ring-amber-100">
        <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-500 flex-shrink-0">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Financial Integration Required</h4>
          <p className="mt-1 text-sm text-amber-800 font-medium leading-relaxed opacity-80">
            As requested, financial data is currently disconnected. To enable full ROI analysis, we will later link your external system to pull "Revenue per Converted Lead" and "Customer Acquisition Cost" (CAC) metrics.
          </p>
        </div>
      </div>
    </div>
  );
}
