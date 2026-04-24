import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Edit2,
  Gamepad2,
  History,
  Mail,
  MessageSquare,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  createOrUpdateClient,
  deleteLead,
  deleteReferralClient,
  generateUniqueCode,
  getUnifiedClients,
  LeadStatus,
  updateLeadStatus,
  updateUnifiedClientGroup,
  updateUnifiedClientRecord,
  USER_GROUPS,
  UserGroup,
} from "../../referrals/core";
import { useAuth } from "../../auth/AuthContext";
import { useStorageData } from "../../utils/useStorageData";
import {
  AdminBadge,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminPage,
  AdminSection,
  AdminSelect,
  AdminSurface,
  AdminTabs,
  AdminTextarea,
} from "../../components/admin/AdminPrimitives";
import { Button } from "../../components/ui/Button";

type UnifiedSource = "referral" | "consultation" | "spin";

type ClientForm = {
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  group: UserGroup;
  serviceNeeded: string;
  message: string;
  status: LeadStatus;
};

const defaultForm: ClientForm = {
  name: "",
  email: "",
  phone: "",
  referralCode: "",
  group: "prospect",
  serviceNeeded: "",
  message: "",
  status: "pending",
};

function openJourneyPrint(client: any) {
  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) return;

  const details = [
    ["Full name", client.name || "-"],
    ["Email", client.email || "-"],
    ["Phone", client.phone || "-"],
    ["Source", client.sourceLabel || client.source || "-"],
    ["Category", client.group || "-"],
    ["Status", client.status || "-"],
    ["Created", new Date(client.createdAt).toLocaleString()],
    ["Referral code", client.referralCode || client.registeredWithCode || "-"],
    ["Service", client.serviceNeeded || client.service || "-"],
  ]
    .map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`)
    .join("");

  printWindow.document.write(`
    <html>
      <head>
        <title>Client Journey - ${client.name || "Client"}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          h2 { margin: 24px 0 12px; font-size: 18px; }
          p { margin: 0 0 8px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #dbe4dd; padding: 10px; text-align: left; vertical-align: top; }
          th { width: 180px; background: #f8fafc; }
          .panel { border: 1px solid #dbe4dd; border-radius: 12px; padding: 16px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <h1>Client Journey</h1>
        <p>ABLEBIZ admin record generated on ${new Date().toLocaleString()}</p>
        <table>${details}</table>
        <div class="panel">
          <h2>Captured message</h2>
          <p>${client.message || client.serviceNeeded || "No message captured."}</p>
        </div>
        <div class="panel">
          <h2>Operational note</h2>
          <p>This record originated from ${client.sourceLabel || client.source}. Use this printout for follow-up, review, or offline record keeping.</p>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function AdminClients() {
  const { user: authUser } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | UnifiedSource>("all");
  const [groupFilter, setGroupFilter] = useState<"all" | UserGroup>("all");
  const [clients, refreshClients] = useStorageData(getUnifiedClients);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [journeyClient, setJourneyClient] = useState<any>(null);
  const [formData, setFormData] = useState<ClientForm>(defaultForm);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        (client.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (client.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (client.phone || "").toLowerCase().includes(search.toLowerCase());
      const matchesSource = sourceFilter === "all" || client.source === sourceFilter;
      const matchesGroup = groupFilter === "all" || client.group === groupFilter;
      return matchesSearch && matchesSource && matchesGroup;
    });
  }, [clients, groupFilter, search, sourceFilter]);

  const handleGroupChange = (id: string, source: UnifiedSource, group: UserGroup) => {
    updateUnifiedClientGroup(id, source, group);
    refreshClients();
  };

  const handleStatusChange = (id: string, source: UnifiedSource, status: LeadStatus) => {
    if (source === "consultation") {
      updateLeadStatus(id, status);
      refreshClients();
    }
  };

  const handleDelete = (id: string, source: UnifiedSource) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    if (source === "consultation") deleteLead(id);
    if (source === "referral") deleteReferralClient(id);
    refreshClients();
  };

  const openModal = (client: any = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        referralCode: client.referralCode || "",
        group: client.group || "prospect",
        serviceNeeded: client.serviceNeeded || client.service || "",
        message: client.message || "",
        status: client.status || "pending",
      });
    } else {
      setEditingClient(null);
      setFormData(defaultForm);
    }
    setIsModalOpen(true);
  };

  const handleSaveClient = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingClient) {
      updateUnifiedClientRecord({
        id: editingClient.id,
        source: editingClient.source,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        referralCode: formData.referralCode,
        group: formData.group,
        serviceNeeded: formData.serviceNeeded,
        message: formData.message,
        status: formData.status,
      });
    } else {
      createOrUpdateClient({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        referralCode: formData.referralCode,
        group: formData.group,
      });
    }
    setIsModalOpen(false);
    refreshClients();
  };

  const statusTone = (status: string) => {
    switch (status) {
      case "completed":
        return "success" as const;
      case "in-progress":
        return "info" as const;
      case "reversed":
        return "danger" as const;
      default:
        return "warning" as const;
    }
  };

  return (
    <AdminPage
      eyebrow="CRM"
      title="Clients"
      description="Manage leads, referrals, and lifecycle stages without leaving the admin workspace."
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={refreshClients}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => openModal()}>
            <UserPlus className="h-3.5 w-3.5" />
            New client
          </Button>
        </>
      }
    >
      <AdminSection title="Filters" description="Use source and lifecycle filters to narrow the list.">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="w-full max-w-md">
            <AdminField label="Search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <AdminInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                  placeholder="Search by name, email, or phone"
                />
              </div>
            </AdminField>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <AdminTabs
              value={sourceFilter}
              onChange={setSourceFilter}
              items={[
                { value: "all", label: "All" },
                { value: "referral", label: "Referrals" },
                { value: "consultation", label: "Leads" },
                { value: "spin", label: "Game" },
              ]}
            />

            <AdminTabs
              value={groupFilter}
              onChange={setGroupFilter}
              items={[
                { value: "all", label: "All tiers" },
                ...USER_GROUPS.map((group) => ({ value: group.id, label: group.label })),
              ]}
            />
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Client records"
        description="Current unified list of referrals, leads, and game participants."
        actions={<AdminBadge>{filteredClients.length} records</AdminBadge>}
      >
        {filteredClients.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title="No matching clients"
            description="Try broadening the filters or clearing the search to see more records."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name / contact</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={`${client.source}-${client.id}`}>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="admin-title-sm">{client.name}</p>
                          {client.group === "prospect" &&
                          Date.now() - new Date(client.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000 ? (
                            <AdminBadge tone="danger">Churn risk</AdminBadge>
                          ) : null}
                        </div>
                        <p className="admin-meta">{client.email || "-"}</p>
                        <p className="admin-meta">{client.phone || "-"}</p>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="admin-icon-chip">
                          {client.source === "referral" ? <History className="h-4 w-4" /> : null}
                          {client.source === "consultation" ? <MessageSquare className="h-4 w-4" /> : null}
                          {client.source === "spin" ? <Gamepad2 className="h-4 w-4" /> : null}
                        </div>
                        <div className="space-y-1">
                          <p className="admin-title-sm">{client.sourceLabel}</p>
                          {client.referralCode ? (
                            <p className="admin-meta">Code: {client.referralCode}</p>
                          ) : client.serviceNeeded || client.service ? (
                            <p className="admin-meta">Focus: {client.serviceNeeded || client.service}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <AdminSelect
                        value={client.group || "prospect"}
                        onChange={(event) =>
                          handleGroupChange(client.id, client.source as UnifiedSource, event.target.value as UserGroup)
                        }
                      >
                        {USER_GROUPS.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.label}
                          </option>
                        ))}
                      </AdminSelect>
                    </td>
                    <td>
                      {client.source === "consultation" ? (
                        <AdminSelect
                          value={client.status || "pending"}
                          onChange={(event) =>
                            handleStatusChange(
                              client.id,
                              client.source as UnifiedSource,
                              event.target.value as LeadStatus
                            )
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">Follow-up</option>
                          <option value="completed">Converted</option>
                          <option value="reversed">Lost</option>
                        </AdminSelect>
                      ) : (
                        <AdminBadge tone={statusTone(client.status || "completed")}>
                          {client.status === "completed" ? (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          ) : (
                            <Clock className="mr-1 h-3.5 w-3.5" />
                          )}
                          {client.status || "ready"}
                        </AdminBadge>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setJourneyClient(client)}
                          className="admin-button-secondary"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Journey
                        </button>
                        <button
                          type="button"
                          onClick={() => openModal(client)}
                          className="admin-button-secondary"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                        {authUser?.role === "superadmin" && client.source !== "spin" ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(client.id, client.source as UnifiedSource)}
                            className="admin-button-secondary text-[var(--admin-danger-fg)]"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl">
            <AdminSurface className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
                <div>
                  <h2 className="admin-section-title">{editingClient ? "Edit client record" : "Add new client"}</h2>
                  <p className="admin-section-description">
                    {editingClient
                      ? `Update ${editingClient.sourceLabel} data without changing the original source.`
                      : "Create a new referral-program client record."}
                  </p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="admin-button-secondary">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="space-y-5 p-6">
                {editingClient ? (
                  <div className="flex flex-wrap gap-2">
                    <AdminBadge tone="info">{editingClient.sourceLabel}</AdminBadge>
                    <AdminBadge>{editingClient.group || "prospect"}</AdminBadge>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField label="Full name">
                    <AdminInput
                      required
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      placeholder="Client name"
                    />
                  </AdminField>
                  <AdminField label="Phone number">
                    <AdminInput
                      required
                      value={formData.phone}
                      onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                      placeholder="Phone number"
                    />
                  </AdminField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField label="Email address">
                    <AdminInput
                      required
                      type="email"
                      value={formData.email}
                      onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                      placeholder="name@example.com"
                    />
                  </AdminField>
                  <AdminField label="Client category">
                    <AdminSelect
                      value={formData.group}
                      onChange={(event) => setFormData({ ...formData, group: event.target.value as UserGroup })}
                    >
                      {USER_GROUPS.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.label}
                        </option>
                      ))}
                    </AdminSelect>
                  </AdminField>
                </div>

                {!editingClient || editingClient.source === "referral" ? (
                  <AdminField label="Referral code" hint="Referral records use the ABZ-REF-XXXXXX pattern.">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <AdminInput
                        value={formData.referralCode}
                        onChange={(event) =>
                          setFormData({ ...formData, referralCode: event.target.value.toUpperCase() })
                        }
                        placeholder="ABZ-REF-XXXXXX"
                      />
                      <button
                        type="button"
                        className="admin-button-secondary"
                        onClick={() => setFormData({ ...formData, referralCode: generateUniqueCode() })}
                      >
                        Generate code
                      </button>
                    </div>
                  </AdminField>
                ) : null}

                {editingClient?.source === "consultation" ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <AdminField label="Requested service">
                        <AdminInput
                          value={formData.serviceNeeded}
                          onChange={(event) =>
                            setFormData({ ...formData, serviceNeeded: event.target.value })
                          }
                          placeholder="Requested service"
                        />
                      </AdminField>
                      <AdminField label="Lead status">
                        <AdminSelect
                          value={formData.status}
                          onChange={(event) =>
                            setFormData({ ...formData, status: event.target.value as LeadStatus })
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">Follow-up</option>
                          <option value="completed">Converted</option>
                          <option value="reversed">Lost</option>
                        </AdminSelect>
                      </AdminField>
                    </div>
                    <AdminField label="Message">
                      <AdminTextarea
                        value={formData.message}
                        onChange={(event) => setFormData({ ...formData, message: event.target.value })}
                        placeholder="Consultation notes or captured message"
                      />
                    </AdminField>
                  </>
                ) : null}

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="admin-button-secondary">
                    Cancel
                  </button>
                  <Button type="submit">{editingClient ? "Save changes" : "Add client"}</Button>
                </div>
              </form>
            </AdminSurface>
          </div>
        </div>
      ) : null}

      {journeyClient ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-6xl">
            <AdminSurface className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
                <div>
                  <h2 className="admin-section-title">{journeyClient.name}</h2>
                  <p className="admin-section-description">
                    Comprehensive client record, acquisition path, and printable follow-up summary.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openJourneyPrint(journeyClient)}
                    className="admin-button-secondary"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button type="button" onClick={() => setJourneyClient(null)} className="admin-button-secondary">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-0 xl:grid-cols-[320px_1fr]">
                <div className="border-r border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-6">
                  <p className="admin-eyebrow">Journey map</p>
                  <div className="mt-5 space-y-5">
                    <div className="space-y-1">
                      <p className="admin-title-sm">Lead acquired</p>
                      <p className="admin-meta">Via {journeyClient.sourceLabel}</p>
                      <p className="admin-meta">{new Date(journeyClient.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="admin-title-sm">Lifecycle state</p>
                      <p className="admin-meta">Category: {journeyClient.group || "prospect"}</p>
                      <p className="admin-meta">Status: {journeyClient.status || "ready"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="admin-title-sm">Source details</p>
                      <p className="admin-meta">Type: {journeyClient.source}</p>
                      <p className="admin-meta">
                        Referral code: {journeyClient.referralCode || journeyClient.registeredWithCode || "-"}
                      </p>
                      <p className="admin-meta">
                        Service: {journeyClient.serviceNeeded || journeyClient.service || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <AdminBadge tone="success">{journeyClient.sourceLabel}</AdminBadge>
                    <AdminBadge>{journeyClient.group || "prospect"}</AdminBadge>
                    <AdminBadge tone={statusTone(journeyClient.status || "completed")}>
                      {journeyClient.status || "ready"}
                    </AdminBadge>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <AdminSurface className="p-4">
                      <p className="admin-title-sm">Client details</p>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-[var(--text-secondary)]" />
                          <div>
                            <p className="admin-kicker">Email</p>
                            <p className="admin-meta">{journeyClient.email || "-"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-[var(--text-secondary)]" />
                          <div>
                            <p className="admin-kicker">Phone</p>
                            <p className="admin-meta">{journeyClient.phone || "-"}</p>
                          </div>
                        </div>
                        <div>
                          <p className="admin-kicker">Created</p>
                          <p className="admin-meta">{new Date(journeyClient.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </AdminSurface>

                    <AdminSurface className="p-4">
                      <p className="admin-title-sm">Commercial context</p>
                      <div className="mt-4 space-y-3">
                        <div>
                          <p className="admin-kicker">Requested service</p>
                          <p className="admin-meta">{journeyClient.serviceNeeded || journeyClient.service || "-"}</p>
                        </div>
                        <div>
                          <p className="admin-kicker">Referral / acquisition code</p>
                          <p className="admin-meta">
                            {journeyClient.referralCode || journeyClient.registeredWithCode || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="admin-kicker">Source label</p>
                          <p className="admin-meta">{journeyClient.sourceLabel}</p>
                        </div>
                      </div>
                    </AdminSurface>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <AdminSurface className="bg-[var(--admin-panel-muted)] p-4">
                      <p className="admin-title-sm">Captured message</p>
                      <p className="admin-page-description mt-2 max-w-none">
                        {journeyClient.message
                          ? journeyClient.message
                          : journeyClient.source === "consultation"
                            ? `I am interested in ${
                                journeyClient.serviceNeeded || journeyClient.service || "consultation"
                              }. Please contact me.`
                            : `Registered through ${journeyClient.sourceLabel}.`}
                      </p>
                    </AdminSurface>

                    <AdminSurface className="bg-[var(--color-primary-50)] p-4">
                      <p className="admin-title-sm">Follow-up guidance</p>
                      <p className="admin-page-description mt-2 max-w-none">
                        Use this record to confirm contact details, continue the onboarding conversation, and document the next action before closing the lead.
                      </p>
                    </AdminSurface>
                  </div>
                </div>
              </div>
            </AdminSurface>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}
