import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { WhatsAppFloatingButton } from "./WhatsAppFloatingButton";
import { WhatsAppHelpWidget } from "./WhatsAppHelpWidget";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <div className="min-h-dvh">
      <ScrollToTop />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppHelpWidget />
      <WhatsAppFloatingButton />
    </div>
  );
}
