import { Route, Routes } from "react-router-dom";
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

export default function App() {
  return (
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </GamificationProvider>
  );
}
