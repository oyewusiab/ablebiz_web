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

import { useReferralUrl } from "./referrals/useReferralUrl";
import { Analytics } from "@vercel/analytics/react";

import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./auth/ThemeContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AdminPortalLayout } from "./components/AdminPortalLayout";
import { AdminLoginPage } from "./pages/admin/Login";
import { AdminResetPasswordPage } from "./pages/admin/ResetPassword";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminReferrals } from "./pages/admin/Referrals";
import { AdminClients } from "./pages/admin/Clients";
import { AdminReports } from "./pages/admin/Reports";
import { AdminSettings } from "./pages/admin/Settings";
import { ServicesCatalogPage } from "./pages/admin/ServicesCatalog";
import { ServiceRequestsPage } from "./pages/admin/ServiceRequests";
import { CacOperationsPage } from "./pages/admin/CacOperations";
import { TasksPage } from "./pages/admin/Tasks";
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

export default function App() {
  useReferralUrl();

  return (
    <AuthProvider>
      <ThemeProvider>
        <GamificationProvider>
          <Analytics />
          <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/pricing" element={<Navigate to="/services" replace />} />
            <Route path="/testimonials" element={<TestimonialsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/refer-and-earn" element={<ReferralsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Admin Portal Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminPortalLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="leads" element={<ProtectedRoute requiredModule="crm"><LeadsPipelinePage /></ProtectedRoute>} />
            <Route path="clients" element={<ProtectedRoute requiredModule="crm"><AdminClients /></ProtectedRoute>} />
            <Route path="businesses" element={<ProtectedRoute requiredModule="crm"><BusinessesPage /></ProtectedRoute>} />
            <Route path="follow-ups" element={<ProtectedRoute requiredModule="crm"><FollowUpsPage /></ProtectedRoute>} />
            <Route path="services-catalog" element={<ProtectedRoute requiredModule="operations"><ServicesCatalogPage /></ProtectedRoute>} />
            <Route path="service-requests" element={<ProtectedRoute requiredModule="operations"><ServiceRequestsPage /></ProtectedRoute>} />
            <Route path="cac-operations" element={<ProtectedRoute requiredModule="operations"><CacOperationsPage /></ProtectedRoute>} />
            <Route path="tasks" element={<ProtectedRoute requiredModule="operations"><TasksPage /></ProtectedRoute>} />
            <Route path="documents" element={<ProtectedRoute requiredModule="operations"><DocumentsPage /></ProtectedRoute>} />
            {/* Finance Routes */}
            <Route path="quotations" element={<ProtectedRoute requiredModule="finance"><QuotationsPage /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute requiredModule="finance"><InvoicesPage /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute requiredModule="finance"><PaymentsPage /></ProtectedRoute>} />
            <Route path="expenses" element={<ProtectedRoute requiredModule="finance"><ExpensesPage /></ProtectedRoute>} />
            <Route path="vendors" element={<ProtectedRoute requiredModule="finance"><VendorsPage /></ProtectedRoute>} />
            <Route path="audit-logs" element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><AuditLogsPage /></ProtectedRoute>} />
            <Route path="audit" element={<Navigate to="/admin/audit-logs" replace />} />
            <Route path="ai-secretary" element={<ProtectedRoute><AiSecretaryPage /></ProtectedRoute>} />
            <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            {/* Communications */}
            <Route path="communications" element={<ProtectedRoute requiredModule="crm"><ClientCommunicationsPage /></ProtectedRoute>} />
            {/* Team / Staff & RBAC */}
            <Route path="team" element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffRbacPage /></ProtectedRoute>} />
            {/* Referrals & Reports */}
            <Route path="referrals" element={<ProtectedRoute><AdminReferrals /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute requiredModule="reports"><AdminReports /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
          </Route>

          {/* Legacy Redirects */}
          <Route path="/admin-porter/*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </GamificationProvider>
    </ThemeProvider>
  </AuthProvider>
  );
}
