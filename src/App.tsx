import { Route, Routes, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { GamificationProvider } from "./gamification/GamificationProvider";
import { HomePage } from "./pages/Home";
import { AboutPage } from "./pages/About";
import { ServicesPage } from "./pages/Services";
import { TestimonialsPage } from "./pages/Testimonials";
import { ContactPage } from "./pages/Contact";
import { BlogIndexPage } from "./pages/BlogIndex";
import { BlogPostPage } from "./pages/BlogPost";
import { NotFoundPage } from "./pages/NotFound";
import { ReferralsPage } from "./pages/Referrals";
import { OfficeOpeningPromoPage } from "./pages/OfficeOpeningPromo";

import { useReferralUrl } from "./referrals/useReferralUrl";
import { Analytics } from "@vercel/analytics/react";

import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./auth/ThemeContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AdminPortalLayout } from "./components/AdminPortalLayout";
import { AdminLoginPage } from "./pages/admin/Login";
import { AdminResetPasswordPage } from "./pages/admin/ResetPassword";
import { AdminChangePasswordPage } from "./pages/admin/ChangePassword";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminReferrals } from "./pages/admin/Referrals";
import { AdminClients } from "./pages/admin/Clients";
import { AdminReports } from "./pages/admin/Reports";
import { AdminSettings } from "./pages/admin/Settings";
import { ServicesCatalogPage } from "./pages/admin/ServicesCatalog";
import { ServiceRequestsPage } from "./pages/admin/ServiceRequests";
import { CacOperationsPage } from "./pages/admin/CacOperations";
import { TasksPage } from "./pages/admin/Tasks";
import { WorkflowsPage } from "./pages/admin/Workflows";
import { SlaSettingsPage } from "./pages/admin/SlaSettings";
import { DocumentsPage } from "./pages/admin/Documents";
import { BusinessesPage } from "./pages/admin/Businesses";
import { LeadsPipelinePage } from "./pages/admin/Leads";
import { FollowUpsPage } from "./pages/admin/FollowUps";
import { QuotationsPage } from "./pages/admin/Quotations";
import { InvoicesPage } from "./pages/admin/Invoices";
import { PaymentsPage } from "./pages/admin/Payments";
import { ExpensesPage } from "./pages/admin/Expenses";
import { VendorsPage } from "./pages/admin/Vendors";
import { AuditLogsPage } from "./pages/admin/AuditLogs";
import { AiSecretaryPage } from "./pages/admin/AiSecretary";
import { NotificationsPage } from "./pages/admin/Notifications";
import { ClientCommunicationsPage } from "./pages/admin/Communications";
import { StaffRbacPage } from "./pages/admin/Team";
import { HrWorkspacePage } from "./pages/admin/HrWorkspace";
import { Campaigns as AdminCampaigns } from "./pages/admin/Campaigns";
import { ServiceProfitabilityPage } from "./pages/admin/ServiceProfitability";
import { CashFlowForecastPage } from "./pages/admin/CashFlowForecast";
import { ComplianceCalendarPage } from "./pages/admin/ComplianceCalendar";
import { AppointmentsPage } from "./pages/admin/Appointments";
import { ServiceQualityPage } from "./pages/admin/ServiceQuality";
import { StaffPerformancePage } from "./pages/admin/StaffPerformance";
import { KnowledgeBasePage } from "./pages/admin/KnowledgeBase";
import { ApprovalsPage } from "./pages/admin/Approvals";
import { ExecutiveDashboardPage } from "./pages/admin/ExecutiveDashboard";
import { BackupRecoveryPage } from "./pages/admin/BackupRecovery";
import { MarketingAttributionPage } from "./pages/admin/MarketingAttribution";
import { ReceiptProfitabilityPage } from "./pages/admin/ReceiptProfitability";
import { ExpenseAllocationReportPage } from "./pages/admin/ExpenseAllocationReport";
import { BookConsultationPage } from "./pages/BookConsultation";
import { ClientFeedbackPage } from "./pages/ClientFeedback";
import { BusinessProfileProvider } from "./lib/businessProfileContext";

export default function App() {
  useReferralUrl();

  return (
    <AuthProvider>
      <BusinessProfileProvider>
        <ThemeProvider>
          <GamificationProvider>
            <Analytics />
            <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/office-opening-promo" element={<OfficeOpeningPromoPage />} />
              <Route path="/pricing" element={<Navigate to="/services" replace />} />
            <Route path="/testimonials" element={<TestimonialsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/refer-and-earn" element={<ReferralsPage />} />
            <Route path="/book-consultation" element={<BookConsultationPage />} />
            <Route path="/consultation" element={<Navigate to="/book-consultation" replace />} />
            <Route path="/feedback" element={<ClientFeedbackPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Admin Portal Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
          <Route path="/admin/change-password" element={<ProtectedRoute><AdminChangePasswordPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPortalLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="workbench" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="leads" element={<ProtectedRoute requiredModule="crm"><LeadsPipelinePage /></ProtectedRoute>} />
            <Route path="clients" element={<ProtectedRoute requiredModule="crm"><AdminClients /></ProtectedRoute>} />
            <Route path="businesses" element={<ProtectedRoute requiredModule="crm"><BusinessesPage /></ProtectedRoute>} />
            <Route path="follow-ups" element={<ProtectedRoute requiredModule="crm"><FollowUpsPage /></ProtectedRoute>} />
            <Route path="services-catalog" element={<ProtectedRoute requiredModule="operations"><ServicesCatalogPage /></ProtectedRoute>} />
            <Route path="service-requests" element={<ProtectedRoute requiredModule="operations"><ServiceRequestsPage /></ProtectedRoute>} />
            <Route path="cac-operations" element={<ProtectedRoute requiredModule="operations"><CacOperationsPage /></ProtectedRoute>} />
            <Route path="cac" element={<Navigate to="/admin/cac-operations" replace />} />
            <Route path="tasks" element={<ProtectedRoute requiredModule="operations"><TasksPage /></ProtectedRoute>} />
            <Route path="sla-settings" element={<ProtectedRoute requiredModule="operations"><SlaSettingsPage /></ProtectedRoute>} />
            <Route path="workflows" element={<ProtectedRoute requiredModule="operations"><WorkflowsPage /></ProtectedRoute>} />
            <Route path="documents" element={<ProtectedRoute requiredModule="operations"><DocumentsPage /></ProtectedRoute>} />
            {/* Phase 12 Knowledge Base & SOP Management */}
            <Route path="knowledge-base" element={<ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>} />
            <Route path="sops" element={<Navigate to="/admin/knowledge-base?tab=sops" replace />} />
            {/* Phase 13 Approval & Decision Management */}
            <Route path="approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
            <Route path="approval-rules" element={<Navigate to="/admin/approvals?tab=rules" replace />} />
            {/* Finance Routes */}
            <Route path="quotations" element={<ProtectedRoute requiredModule="finance"><QuotationsPage /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute requiredModule="finance"><InvoicesPage /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute requiredModule="finance"><PaymentsPage /></ProtectedRoute>} />
            <Route path="expenses" element={<ProtectedRoute requiredModule="finance"><ExpensesPage /></ProtectedRoute>} />
            <Route path="vendors" element={<ProtectedRoute requiredModule="finance"><VendorsPage /></ProtectedRoute>} />
            <Route path="cash-flow-forecast" element={<ProtectedRoute requiredModule="finance"><CashFlowForecastPage /></ProtectedRoute>} />
            <Route path="finance/cash-flow-forecast" element={<ProtectedRoute requiredModule="finance"><CashFlowForecastPage /></ProtectedRoute>} />
            {/* Phase 19 Receipt-Linked Profitability & Expense Allocations */}
            <Route path="finance/receipt-profitability" element={<ProtectedRoute requiredModule="finance"><ReceiptProfitabilityPage /></ProtectedRoute>} />
            <Route path="receipt-profitability" element={<Navigate to="/admin/finance/receipt-profitability" replace />} />
            <Route path="finance/expense-allocations" element={<ProtectedRoute requiredModule="finance"><ExpenseAllocationReportPage /></ProtectedRoute>} />
            <Route path="expense-allocations" element={<Navigate to="/admin/finance/expense-allocations" replace />} />
            {/* Compliance Calendar Route */}
            <Route path="compliance-calendar" element={<ProtectedRoute><ComplianceCalendarPage /></ProtectedRoute>} />
            <Route path="compliance" element={<Navigate to="/admin/compliance-calendar" replace />} />
            {/* Phase 9 Appointments & Consultations */}
            <Route path="appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
            {/* Phase 10 Service Quality & Client Satisfaction */}
            <Route path="service-quality" element={<ProtectedRoute><ServiceQualityPage /></ProtectedRoute>} />
            <Route path="audit-logs" element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><AuditLogsPage /></ProtectedRoute>} />
            <Route path="audit" element={<Navigate to="/admin/audit-logs" replace />} />
            <Route path="ai-secretary" element={<ProtectedRoute><AiSecretaryPage /></ProtectedRoute>} />
            <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            {/* Phase 16 Backup, Recovery & Business Continuity */}
            <Route path="backup-recovery" element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><BackupRecoveryPage /></ProtectedRoute>} />
            <Route path="business-continuity" element={<Navigate to="/admin/backup-recovery" replace />} />
            {/* Communications & Template Management */}
            <Route path="communications" element={<ProtectedRoute><ClientCommunicationsPage /></ProtectedRoute>} />
            <Route path="communication-templates" element={<ProtectedRoute><ClientCommunicationsPage /></ProtectedRoute>} />
            {/* Team / Staff & RBAC & HR Workspace */}
            <Route path="hr" element={<ProtectedRoute requiredModule="hr"><HrWorkspacePage /></ProtectedRoute>} />
            <Route path="hr/:section" element={<ProtectedRoute requiredModule="hr"><HrWorkspacePage /></ProtectedRoute>} />
            <Route path="team" element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffRbacPage /></ProtectedRoute>} />
            <Route path="team/staff-performance" element={<ProtectedRoute requiredRole={["super_admin", "admin", "operations_manager"]}><StaffPerformancePage /></ProtectedRoute>} />
            {/* Referrals & Reports & Campaigns */}
            <Route path="campaigns" element={<ProtectedRoute><AdminCampaigns /></ProtectedRoute>} />
            <Route path="referrals" element={<ProtectedRoute><AdminReferrals /></ProtectedRoute>} />
            {/* Phase 14 Business Intelligence & Executive Dashboard */}
            <Route path="executive-dashboard" element={<ProtectedRoute requiredRole={["super_admin", "admin", "operations_manager"]}><ExecutiveDashboardPage /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute requiredModule="reports"><AdminReports /></ProtectedRoute>} />
            {/* Phase 18 Marketing Campaign & Lead Attribution Analytics */}
            <Route path="reports/marketing-attribution" element={<ProtectedRoute><MarketingAttributionPage /></ProtectedRoute>} />
            <Route path="marketing-attribution" element={<Navigate to="/admin/reports/marketing-attribution" replace />} />
            <Route path="reports/service-profitability" element={<ProtectedRoute requiredModule="reports"><ServiceProfitabilityPage /></ProtectedRoute>} />
            <Route path="service-profitability" element={<ProtectedRoute requiredModule="reports"><ServiceProfitabilityPage /></ProtectedRoute>} />
            {/* Phase 11 Staff Performance & Workload Analytics */}
            <Route path="reports/staff-performance" element={<ProtectedRoute requiredModule="reports"><StaffPerformancePage /></ProtectedRoute>} />
            <Route path="staff-performance" element={<Navigate to="/admin/reports/staff-performance" replace />} />
            <Route path="settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
          </Route>

          {/* Legacy Redirects */}
          <Route path="/admin-porter/*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </GamificationProvider>
    </ThemeProvider>
    </BusinessProfileProvider>
  </AuthProvider>
  );
}
