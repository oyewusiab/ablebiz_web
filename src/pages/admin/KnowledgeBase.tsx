import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Tag,
  Eye,
  History,
  Lock,
  RotateCcw,
  Building2,
  FileCheck2,
  ShieldCheck,
  DollarSign,
  MessageSquare,
  Users,
  Briefcase,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Archive,
  Edit3,
  Send,
  X,
  Layers,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { CanonicalStaffRole, getRoleTitle } from "../../auth/roleConfig";
import type {
  KnowledgeArticle,
  KnowledgeArticleInput,
  KnowledgeArticleVersion,
  KnowledgeCategory,
} from "../../types/knowledgeBase";
import {
  fetchKnowledgeArticles,
  fetchKnowledgeCategories,
  fetchArticleWithHistory,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  submitArticleForReview,
  approveAndPublishArticle,
  returnArticleForRevision,
  archiveArticle,
  restoreArticleVersion,
  canRoleAccessArticle,
  canEditArticle,
  canApproveArticle,
} from "../../lib/knowledgeBase/knowledgeService";

export function KnowledgeBasePage() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = (profile?.role as CanonicalStaffRole) || "viewer";
  const userId = profile?.id || "";
  const isManager = canApproveArticle(userRole);

  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState<string>(
    searchParams.get("tab") || "all"
  );
  const [selectedTag, setSelectedTag] = useState<string>("all");

  // Active Reader View
  const [activeArticle, setActiveArticle] = useState<KnowledgeArticle | null>(null);
  const [activeVersions, setActiveVersions] = useState<KnowledgeArticleVersion[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Editor Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formIsSop, setFormIsSop] = useState(false);
  const [formChangeSummary, setFormChangeSummary] = useState("");
  const [formTargetRoles, setFormTargetRoles] = useState<CanonicalStaffRole[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Review decision modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, arts] = await Promise.all([
        fetchKnowledgeCategories(),
        fetchKnowledgeArticles(userRole, userId),
      ]);
      setCategories(cats);
      setArticles(arts);

      // Check if article query param exists
      const articleSlugOrId = searchParams.get("article");
      if (articleSlugOrId) {
        const found = arts.find(
          (a) => a.id === articleSlugOrId || a.slug === articleSlugOrId || a.article_code === articleSlugOrId
        );
        if (found) {
          openReader(found);
        }
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userRole, userId]);

  const openReader = async (article: KnowledgeArticle) => {
    setActiveArticle(article);
    const { versions } = await fetchArticleWithHistory(article.id);
    setActiveVersions(versions);
    setSearchParams({ article: article.slug });
  };

  const closeReader = () => {
    setActiveArticle(null);
    setActiveVersions([]);
    setIsHistoryOpen(false);
    searchParams.delete("article");
    setSearchParams(searchParams);
  };

  const openCreateModal = () => {
    setEditingArticle(null);
    setFormTitle("");
    setFormCategory(categories[0]?.id || "");
    setFormSummary("");
    setFormContent("");
    setFormTags("");
    setFormIsSop(selectedTab === "sops");
    setFormChangeSummary("");
    setFormTargetRoles([]);
    setActionError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (article: KnowledgeArticle) => {
    setEditingArticle(article);
    setFormTitle(article.title);
    setFormCategory(article.category_id || "");
    setFormSummary(article.summary || "");
    setFormContent(article.content);
    setFormTags(article.tags.join(", "));
    setFormIsSop(article.is_sop);
    setFormChangeSummary("");
    setFormTargetRoles(article.target_roles || []);
    setActionError(null);
    setIsEditorOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      setActionError("Title and content are required.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    const tagsArray = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const input: KnowledgeArticleInput = {
      title: formTitle.trim(),
      category_id: formCategory || null,
      summary: formSummary.trim() || null,
      content: formContent.trim(),
      tags: tagsArray,
      target_roles: formTargetRoles,
      is_sop: formIsSop,
      change_summary: formChangeSummary.trim() || undefined,
    };

    if (editingArticle) {
      if (editingArticle.status === "published" && !formChangeSummary.trim()) {
        setActionError("Please summarize the changes made to this published document.");
        setIsSubmitting(false);
        return;
      }
      const res = await updateKnowledgeArticle(editingArticle.id, input, userId, isManager);
      if (!res.ok) {
        setActionError(res.message || "Failed to save changes.");
        setIsSubmitting(false);
        return;
      }
      setActionSuccess("Document updated successfully.");
    } else {
      const res = await createKnowledgeArticle(input, userId);
      if (!res.ok) {
        setActionError(res.message || "Failed to create knowledge article.");
        setIsSubmitting(false);
        return;
      }
      setActionSuccess("New document created in Draft status.");
    }

    setIsSubmitting(false);
    setIsEditorOpen(false);
    await loadData();
    if (editingArticle && activeArticle?.id === editingArticle.id) {
      const updated = await fetchArticleWithHistory(editingArticle.id);
      if (updated.article) setActiveArticle(updated.article);
    }
  };

  const handleSubmitForReview = async (articleId: string) => {
    const res = await submitArticleForReview(articleId);
    if (res.ok) {
      setActionSuccess("Document submitted for management review.");
      await loadData();
      if (activeArticle) {
        setActiveArticle({ ...activeArticle, status: "submitted" });
      }
    }
  };

  const handleApproveAndPublish = async () => {
    if (!activeArticle) return;
    const res = await approveAndPublishArticle(activeArticle.id, userId);
    if (res.ok) {
      setActionSuccess("Document approved and published to the organization.");
      setIsReviewModalOpen(false);
      await loadData();
      setActiveArticle({
        ...activeArticle,
        status: "published",
        published_at: new Date().toISOString(),
      });
    }
  };

  const handleReturnForRevision = async () => {
    if (!activeArticle || !reviewNotes.trim()) {
      setActionError("Please provide revision guidance for the author.");
      return;
    }
    const res = await returnArticleForRevision(activeArticle.id, userId, reviewNotes);
    if (res.ok) {
      setActionSuccess("Document returned to author for revision.");
      setIsReviewModalOpen(false);
      await loadData();
      setActiveArticle({ ...activeArticle, status: "returned_for_revision" });
    }
  };

  const handleArchive = async (articleId: string) => {
    if (!confirm("Are you sure you want to archive this document?")) return;
    const res = await archiveArticle(articleId);
    if (res.ok) {
      setActionSuccess("Document moved to archive.");
      await loadData();
      if (activeArticle) {
        setActiveArticle({ ...activeArticle, status: "archived" });
      }
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!activeArticle) return;
    if (!confirm(`Restore document to version ${versionNumber}? This will create a new approved revision.`)) return;

    const res = await restoreArticleVersion(activeArticle.id, versionNumber, userId);
    if (res.ok) {
      setActionSuccess(`Successfully restored version ${versionNumber}.`);
      await loadData();
      const updated = await fetchArticleWithHistory(activeArticle.id);
      if (updated.article) setActiveArticle(updated.article);
      setActiveVersions(updated.versions);
      setIsHistoryOpen(false);
    }
  };

  // Filtered Articles Computation
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // Tab filter
      if (selectedTab === "sops" && !art.is_sop) return false;
      if (selectedTab === "cac" && art.category?.slug !== "company-registration" && art.category?.slug !== "ngo-incorporated-trustees" && art.category?.slug !== "cac-post-incorporation") return false;
      if (selectedTab === "finance" && art.category?.slug !== "finance-accounting" && art.category?.slug !== "taxation-tin-scuml") return false;
      if (selectedTab === "my_drafts" && art.author_id !== userId) return false;
      if (selectedTab === "review_queue" && art.status !== "submitted") return false;
      if (selectedTab === "archived" && art.status !== "archived") return false;
      if (selectedTab !== "archived" && art.status === "archived") return false;

      // Category filter
      if (selectedCategory !== "all" && art.category?.slug !== selectedCategory) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesTitle = art.title.toLowerCase().includes(term);
        const matchesSummary = art.summary?.toLowerCase().includes(term);
        const matchesCode = art.article_code.toLowerCase().includes(term);
        const matchesTags = art.tags.some((t) => t.toLowerCase().includes(term));
        const matchesContent = art.content.toLowerCase().includes(term);
        if (!matchesTitle && !matchesSummary && !matchesCode && !matchesTags && !matchesContent) {
          return false;
        }
      }

      // Tag filter
      if (selectedTag !== "all" && !art.tags.includes(selectedTag)) return false;

      return true;
    });
  }, [articles, selectedTab, selectedCategory, searchTerm, selectedTag, userId]);

  // Aggregate tags for filtering
  const allTags = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => a.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [articles]);

  const reviewQueueCount = useMemo(() => {
    return articles.filter((a) => a.status === "submitted").length;
  }, [articles]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            ABLEBIZ Central Repository
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Internal Knowledge Base & SOPs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Approved business procedures, CAC registration instructions, finance guidelines, and official staff documentation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Article
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by procedure title, CAC instructions, keywords, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by knowledge category"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>

            {allTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                aria-label="Filter by tag"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="all">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800 scrollbar-none text-sm">
          {[
            { id: "all", label: "All Articles", count: articles.filter((a) => a.status !== "archived").length },
            { id: "sops", label: "Standard Operating Procedures (SOPs)", count: articles.filter((a) => a.is_sop && a.status !== "archived").length },
            { id: "cac", label: "CAC & Company Formation", count: articles.filter((a) => a.category?.slug?.includes("company") || a.category?.slug?.includes("ngo") || a.category?.slug?.includes("cac")).length },
            { id: "finance", label: "Finance & Accounting", count: articles.filter((a) => a.category?.slug?.includes("finance") || a.category?.slug?.includes("tax")).length },
            { id: "my_drafts", label: "My Drafts", count: articles.filter((a) => a.author_id === userId).length },
            ...(isManager ? [{ id: "review_queue", label: "Awaiting Review", count: reviewQueueCount }] : []),
            { id: "archived", label: "Archive", count: articles.filter((a) => a.status === "archived").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedTab(tab.id);
                setSearchParams({ tab: tab.id });
              }}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedTab === tab.id
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  selectedTab === tab.id
                    ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <Clock className="w-5 h-5 text-emerald-600 animate-spin mr-2" />
          <span className="text-sm text-slate-500">Loading approved business documentation...</span>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No knowledge articles found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            No documentation matched your current filters. Clear filters or create a new article.
          </p>
          <div className="mt-4">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Article
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArticles.map((art) => {
            const isAuthor = art.author_id === userId;
            const canEdit = canEditArticle(art, userRole, userId);

            return (
              <div
                key={art.id}
                onClick={() => openReader(art)}
                className="cursor-pointer group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-emerald-500 dark:hover:border-emerald-500/80 transition-all shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {art.article_code}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {art.is_sop && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          SOP
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${
                          art.status === "published"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : art.status === "submitted"
                            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            : art.status === "archived"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {art.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                      {art.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                      {art.summary || art.content.slice(0, 140) + "..."}
                    </p>
                  </div>

                  {/* Tags */}
                  {art.tags && art.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {art.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                      {art.tags.length > 3 && (
                        <span className="text-[11px] text-slate-400">+{art.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Metadata */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>v{art.current_version}.0</span>
                    <span>•</span>
                    <span>{art.author?.full_name || "Staff"}</span>
                  </div>

                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    View Guide
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reader Modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {activeArticle.article_code}
                  </span>
                  {activeArticle.is_sop && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Standard Operating Procedure
                    </span>
                  )}
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                      activeArticle.status === "published"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {activeArticle.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-400">Version {activeArticle.current_version}.0</span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {activeArticle.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <span>Author: {activeArticle.author?.full_name || "Staff Member"}</span>
                  {activeArticle.reviewer && (
                    <>
                      <span>•</span>
                      <span>Reviewer: {activeArticle.reviewer.full_name}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>Updated: {new Date(activeArticle.updated_at).toLocaleDateString()}</span>
                </div>
              </div>

              <button
                onClick={closeReader}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Article Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeArticle.summary && (
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 rounded-xl text-sm text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold block mb-0.5">Summary</span>
                  {activeArticle.summary}
                </div>
              )}

              <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                {activeArticle.content}
              </div>

              {/* Tags Section */}
              {activeArticle.tags && activeArticle.tags.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <div className="flex flex-wrap gap-1.5">
                    {activeArticle.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Version History Drawer (if opened) */}
              {isHistoryOpen && (
                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-600" />
                      Document Revision History
                    </h4>
                    <span className="text-xs text-slate-400">{activeVersions.length} revisions recorded</span>
                  </div>

                  <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {activeVersions.map((v) => (
                      <div key={v.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">v{v.version_number}.0</span>
                            <span className="text-slate-400">({new Date(v.created_at).toLocaleString()})</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px]">
                              {v.review_status}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                            {v.change_summary || "Document revision."}
                          </p>
                        </div>

                        {isManager && v.version_number !== activeArticle.current_version && (
                          <button
                            onClick={() => handleRestoreVersion(v.version_number)}
                            className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Action Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <History className="w-3.5 h-3.5 text-slate-400" />
                {isHistoryOpen ? "Hide Revision History" : "View Version History"}
              </button>

              <div className="flex items-center gap-2">
                {canEditArticle(activeArticle, userRole, userId) && (
                  <button
                    onClick={() => {
                      openEditModal(activeArticle);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Document
                  </button>
                )}

                {activeArticle.status === "draft" && activeArticle.author_id === userId && (
                  <button
                    onClick={() => handleSubmitForReview(activeArticle.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit for Review
                  </button>
                )}

                {isManager && activeArticle.status === "submitted" && (
                  <>
                    <button
                      onClick={() => setIsReviewModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg hover:bg-amber-200 transition-colors"
                    >
                      Return for Revision
                    </button>
                    <button
                      onClick={handleApproveAndPublish}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve & Publish
                    </button>
                  </>
                )}

                {isManager && activeArticle.status === "published" && (
                  <button
                    onClick={() => handleArchive(activeArticle.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal (Create / Edit) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingArticle ? `Edit ${editingArticle.article_code}: ${editingArticle.title}` : "Create New Knowledge Article"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingArticle?.status === "published"
                    ? "Updating a published document will create a new formal revision."
                    : "Draft operational guidelines or SOPs for ABLEBIZ."}
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              {actionError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Operating Procedure for NGO Registration"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Knowledge Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsSop}
                      onChange={(e) => setFormIsSop(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Standard Operating Procedure (SOP)
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Brief Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Short executive summary explaining the purpose and scope..."
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Document Content (Markdown supported) *
                </label>
                <textarea
                  rows={10}
                  required
                  placeholder="Detailed step-by-step instructions, legal requirements, timelines, and guidelines..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CAC, Company Registration, Legal, Checklist"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              {editingArticle?.status === "published" && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <label className="block font-semibold text-amber-900 dark:text-amber-200 text-xs mb-1">
                    Summary of Changes (Required for Revision Audit) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Updated CAC minimum share capital threshold per CAMA 2020 amendment."
                    value={formChangeSummary}
                    onChange={(e) => setFormChangeSummary(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isSubmitting ? "Saving..." : editingArticle ? "Save Revision" : "Create Article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review & Return Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Return Document for Revision
            </h3>
            <p className="text-xs text-slate-500">
              Provide specific feedback or required updates for the author before this document can be approved and published.
            </p>

            <textarea
              rows={4}
              required
              placeholder="e.g. Please clarify the step regarding NIMC NIN verification portal login..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnForRevision}
                className="px-4 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
