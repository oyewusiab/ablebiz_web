import { useEffect, useState } from "react";
import {
  FolderOpen,
  Search,
  Filter,
  Upload,
  FileText,
  FileCheck2,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface DocumentRecord {
  id: string;
  title: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  category: string;
  client_id?: string | null;
  business_id?: string | null;
  service_request_id?: string | null;
  cac_application_id?: string | null;
  is_verified: boolean;
  expiry_date?: string | null;
  created_at: string;
  client?: { full_name: string };
  business?: { name: string };
}

export function DocumentsPage() {
  const { profile, hasPermission } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("other");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const canUpload = hasPermission("operations", "create");

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [docsRes, clientsRes] = await Promise.all([
        supabase
          .from("documents")
          .select("*, client:clients(full_name), business:businesses(name)")
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("id, full_name").eq("is_active", true),
      ]);

      if (docsRes.data) setDocuments(docsRes.data as any[]);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (err) {
      console.error("[Documents] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownload = async (filePath: string, title: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.storage
        .from("ablebiz_documents")
        .createSignedUrl(filePath, 60); // 60 seconds authenticated URL

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      alert("Could not access document: " + err?.message);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !fileToUpload || !docTitle.trim() || !canUpload) return;
    setIsUploading(true);
    setUploadError("");

    // Validate size (20MB)
    if (fileToUpload.size > 20971520) {
      setUploadError("File size exceeds 20MB limit.");
      setIsUploading(false);
      return;
    }

    try {
      const fileExt = fileToUpload.name.split(".").pop();
      const storagePath = `${selectedClientId || "general"}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // 1. Upload to Supabase Private Bucket
      const { error: storageErr } = await supabase.storage
        .from("ablebiz_documents")
        .upload(storagePath, fileToUpload, {
          cacheControl: "3600",
          upsert: false,
        });

      if (storageErr) throw storageErr;

      // 2. Insert metadata record in PostgreSQL
      const { data: docData, error: dbErr } = await supabase
        .from("documents")
        .insert({
          title: docTitle.trim(),
          file_path: storagePath,
          file_size: fileToUpload.size,
          mime_type: fileToUpload.type,
          category: docCategory,
          client_id: selectedClientId || null,
          uploaded_by: profile?.id,
          is_verified: false,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // 3. Log event to Activity Timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "document",
        entity_id: docData.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "document_uploaded",
        event_title: `Document uploaded: ${docData.title}`,
      });

      setIsUploadOpen(false);
      setFileToUpload(null);
      setDocTitle("");
      setSelectedClientId("");
      await fetchData();
    } catch (err: any) {
      setUploadError(err?.message || "Document upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = catFilter === "all" || d.category === catFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Document Vault</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Private Storage
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Encrypted file repository for client identification, CAC certificates, status reports, and compliance specimens.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canUpload && (
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#043F2E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#06553F] shadow-xs transition"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents by title, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
          />
        </div>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
        >
          <option value="all">All Document Categories</option>
          <option value="client_id_card">Client ID Card</option>
          <option value="cac_certificate">CAC Certificate</option>
          <option value="status_report">CAC Status Report</option>
          <option value="scuml_certificate">SCUML Certificate</option>
          <option value="tax_clearance">Tax Clearance / TIN</option>
          <option value="payment_receipt">Payment Receipt</option>
          <option value="other">Other Documents</option>
        </select>
      </div>

      {/* Documents Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading document vault...</div>
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-700">No documents in vault</p>
          <p className="text-[11px] text-slate-400 mt-1">Uploaded certificates and verification files will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Document Title</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Client / Entity</th>
                <th className="px-4 py-3.5">Size</th>
                <th className="px-4 py-3.5">Uploaded</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span>{doc.title}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {doc.category.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {doc.client?.full_name || doc.business?.name || "Unassigned"}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                    {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : "-"}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleDownload(doc.file_path, doc.title)}
                      className="rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 text-xs font-bold hover:bg-emerald-100 transition"
                    >
                      Download Signed
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Upload to Secure Document Vault</h2>
            <p className="text-xs text-slate-500 mt-1">Files are stored in private bucket <code className="font-mono text-emerald-700">ablebiz_documents</code>.</p>

            {uploadError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Document Title *</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Adebayo CAC Registration Certificate"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Document Category *</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                >
                  <option value="client_id_card">Client ID Card (NIN / Passport)</option>
                  <option value="cac_certificate">CAC Certificate</option>
                  <option value="status_report">CAC Status Report</option>
                  <option value="scuml_certificate">SCUML Certificate</option>
                  <option value="tax_clearance">Tax Clearance / TIN</option>
                  <option value="payment_receipt">Payment Receipt</option>
                  <option value="other">Other Statutory Document</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Link to Client</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="">-- General Repository --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Select File (PDF or Image, max 20MB) *</label>
                <input
                  type="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                  className="mt-1 w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-[#043F2E] px-4 py-2 text-xs font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Save to Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
