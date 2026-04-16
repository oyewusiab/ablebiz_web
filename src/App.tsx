import { Route, Routes, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { GamificationProvider } from "./gamification/GamificationProvider";
import { HomePage } from "./pages/Home";
import { AboutPage } from "./pages/About";
import { ServicesPage } from "./pages/Services";
import { PricingPage } from "./pages/Pricing";
import { TestimonialsPage } from "./pages/Testimonials";
import { ContactPage } from "./pages/Contact";
import { BlogIndexPage } from "./pages/BlogIndex";
import { BlogPostPage } from "./pages/BlogPost";
import { NotFoundPage } from "./pages/NotFound";
import { ReferralsPage } from "./pages/Referrals";
import { AdminDashboardPage } from "./pages/AdminDashboard";
import { useReferralUrl } from "./referrals/useReferralUrl";

import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AdminPortalLayout } from "./components/AdminPortalLayout";
import { AdminLoginPage } from "./pages/admin/Login";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminReferrals } from "./pages/admin/Referrals";
import { AdminClients } from "./pages/admin/Clients";
import { AdminReports } from "./pages/admin/Reports";
import { AdminSettings } from "./pages/admin/Settings";

export default function App() {
  useReferralUrl();

  return (
    <AuthProvider>
      <GamificationProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/testimonials" element={<TestimonialsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/refer-and-earn" element={<ReferralsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Admin Porter Routes */}
          <Route path="/admin-porter/login" element={<AdminLoginPage />} />
          <Route path="/admin-porter" element={<ProtectedRoute><AdminPortalLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin-porter/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="referrals" element={<AdminReferrals />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </GamificationProvider>
    </AuthProvider>
  );
}
