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
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminReferrals } from "./pages/admin/Referrals";
import { AdminClients } from "./pages/admin/Clients";
import { AdminReports } from "./pages/admin/Reports";
import { AdminSettings } from "./pages/admin/Settings";
import { ServicesCatalogPage } from "./pages/admin/ServicesCatalog";
import { ServiceRequestsPage } from "./pages/admin/ServiceRequests";

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
          <Route path="/admin" element={<ProtectedRoute><AdminPortalLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="services-catalog" element={<ProtectedRoute requiredModule="operations"><ServicesCatalogPage /></ProtectedRoute>} />
            <Route path="service-requests" element={<ProtectedRoute requiredModule="operations"><ServiceRequestsPage /></ProtectedRoute>} />
            <Route path="referrals" element={<ProtectedRoute><AdminReferrals /></ProtectedRoute>} />
            <Route path="clients" element={<ProtectedRoute requiredModule="crm"><AdminClients /></ProtectedRoute>} />
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
