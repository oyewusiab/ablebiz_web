import { useMemo, useState, useEffect } from "react";
import { 
  Users, 
  MessageSquare, 
  Gamepad2, 
  Search, 
  Filter, 
  Mail, 
  Phone,
  ArrowRight,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  History,
  ExternalLink
} from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { 
  getUnifiedClients, 
  updateLeadStatus, 
  deleteLead, 
  createOrUpdateClient,
  LeadStatus,
  deleteReferralClient
} from "../../referrals/core";
import { useAuth } from "../../auth/AuthContext";
import { buildWhatsAppLink } from "../../content/site";

export function AdminClients() {
  const { user: authUser } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "referral" | "consultation" | "spin">("all");
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    referralCode: ""
  });

  useEffect(() => {
    setClients(getUnifiedClients());
  }, []);

  const filteredClients = useMemo(() => {
    return clients
      .filter(c => {
        const matchesSearch = 
          (c.name || "").toLowerCase().includes(search.toLowerCase()) || 
          (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
          (c.phone || "").toLowerCase().includes(search.toLowerCase());
        const matchesSource = sourceFilter === "all" || c.source === sourceFilter;
        return matchesSearch && matchesSource;
      });
  }, [clients, search, sourceFilter]);

  const handleStatusChange = (id: string, source: string, newStatus: LeadStatus) => {
    if (source === "consultation") {
      updateLeadStatus(id, newStatus);
      setClients(getUnifiedClients());
    }
  };

  const handleDelete = (id: string, source: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    
    if (source === "consultation") {
      deleteLead(id);
    } else if (source === "referral") {
      deleteReferralClient(id);
    }
    setClients(getUnifiedClients());
  };

  const handleOpenModal = (client: any = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        referralCode: client.referralCode || ""
      });
    } else {
      setEditingClient(null);
      setFormData({ name: "", email: "", phone: "", referralCode: "" });
    }
    setIsModalOpen(true);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    createOrUpdateClient({
      id: editingClient?.id,
      ...formData
    });
    setIsModalOpen(false);
    setClients(getUnifiedClients());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-50 text-emerald-700 ring-emerald-100";
      case "in-progress": return "bg-blue-50 text-blue-700 ring-blue-100";
      case "reversed": return "bg-red-50 text-red-700 ring-red-100";
      default: return "bg-amber-50 text-amber-700 ring-amber-100";
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Business Clients</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 italic">Centralized control for every interaction and lead.</p>
        </div>
        
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2 shadow-lg shadow-emerald-500/20">
          <Plus className="h-4 w-4" /> Add New Client
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative max-w-sm w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full pl-10 pr-4 bg-white rounded-2xl text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all"
            placeholder="Search by name, email, or phone..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 mr-1" />
          <div className="flex bg-slate-200/50 p-1 rounded-xl ring-1 ring-slate-200">
            {[
              { id: "all", label: "All" },
              { id: "referral", label: "Referrers" },
              { id: "consultation", label: "Consultation" },
              { id: "spin", label: "Game Users" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSourceFilter(f.id as any)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  sourceFilter === f.id ? "bg-white text-emerald-600 shadow-md" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-300">Client Info</th>
                  <th className="px-6 py-4 font-bold text-slate-300">Origin</th>
                  <th className="px-6 py-4 font-bold text-slate-300">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-300">Date</th>
                  <th className="px-6 py-4 font-bold text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 italic">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium italic">
                      No matching business records found.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 flex items-center justify-center rounded-full text-white font-black text-xs ${
                             c.source === 'referral' ? 'bg-emerald-500' : 
                             c.source === 'consultation' ? 'bg-blue-500' : 'bg-purple-500'
                          }`}>
                            {c.name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 tracking-tight">{c.name}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                              <Mail className="h-2.5 w-2.5" /> {c.email || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-bold mb-1">
                          {c.source === "referral" && <History className="h-3 w-3 text-emerald-500" />}
                          {c.source === "consultation" && <MessageSquare className="h-3 w-3 text-blue-500" />}
                          {c.source === "spin" && <Gamepad2 className="h-3 w-3 text-purple-500" />}
                          <span className="text-xs">{c.sourceLabel}</span>
                        </div>
                        {c.service && (
                          <div className="text-[10px] font-medium text-slate-400 italic">
                            Interest: {c.service}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {c.source === "consultation" ? (
                          <select
                            value={c.status || "pending"}
                            onChange={(e) => handleStatusChange(c.id, c.source, e.target.value as LeadStatus)}
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ring-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer ${getStatusColor(c.status || "pending")}`}
                          >
                            <option value="pending">PENDING</option>
                            <option value="in-progress">IN PROGRESS</option>
                            <option value="completed">COMPLETED</option>
                            <option value="reversed">REVERSED</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ${getStatusColor(c.status || "completed")}`}>
                            {c.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {c.status || "COMPLETED"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-medium text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <a 
                            href={c.phone ? buildWhatsAppLink(`Hello ${c.name}, I am following up from ABLEBIZ regarding your ${c.sourceLabel}...`) : "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            title="Message on WhatsApp"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          {c.source === "referral" && (
                             <button
                               onClick={() => handleOpenModal(c)}
                               className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                               title="Edit Referrer"
                             >
                                <Edit2 className="h-4 w-4" />
                             </button>
                          )}
                          {(authUser?.role === "superadmin") && (
                             <button
                               onClick={() => handleDelete(c.id, c.source)}
                               className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                               title="Delete User"
                             >
                                <Trash2 className="h-4 w-4" />
                             </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Manual Input Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <Card className="w-full max-w-lg overflow-hidden shadow-2xl border-none ring-1 ring-white/10">
            <CardBody className="p-0">
              <div className="bg-slate-900 p-8 text-white relative">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-6 w-6 text-emerald-400" />
                  <h3 className="text-2xl font-black">{editingClient ? "Edit Client" : "Add New Client"}</h3>
                </div>
                <p className="text-slate-400 text-sm italic">Manually input or update business contact details.</p>
              </div>
              
              <form onSubmit={handleSaveClient} className="p-8 space-y-6">
                 <div className="grid gap-4">
                    <label className="grid gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                      Full Client Name*
                      <input 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="h-12 w-full bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        placeholder="e.g. Samuel Adekunle"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        Email Address*
                        <input 
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="h-12 w-full bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          placeholder="client@email.com"
                        />
                      </label>
                      <label className="grid gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        WhatsApp/Phone*
                        <input 
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="h-12 w-full bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          placeholder="081..."
                        />
                      </label>
                    </div>
                    {(!editingClient || formData.referralCode) && (
                      <label className="grid gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        Custom Referral Code (Optional)
                        <input 
                          value={formData.referralCode}
                          onChange={(e) => setFormData({...formData, referralCode: e.target.value.toUpperCase()})}
                          className="h-12 w-full bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          placeholder="Leave blank for auto-generate"
                        />
                      </label>
                    )}
                 </div>

                 <div className="flex gap-4 pt-4">
                    <Button type="submit" className="flex-1 h-12 shadow-lg shadow-emerald-500/20">
                      {editingClient ? "Save Changes" : "Create Record"}
                    </Button>
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-6 rounded-2xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                    >
                      Cancel
                    </button>
                 </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
