import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Gift, Menu, Phone, X } from "lucide-react";
import { useSiteConfig } from "../referrals/siteConfig";
import { useGamification } from "../gamification/GamificationProvider";
import { Button } from "./ui/Button";
import { cn } from "../utils/cn";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/testimonials", label: "Testimonials" },
  { to: "/contact", label: "Contacts" },
  { to: "/blog", label: "Blog" },
  { to: "/refer-and-earn", label: "Refer & Earn" },
];

export function Header() {
  const { openSpin } = useGamification();
  const { site } = useSiteConfig();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);


  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md transition-colors shadow-xs">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8 xl:px-12 2xl:max-w-[1440px]">
        <Link to="/" className="flex items-center gap-2 no-underline group shrink-0">
          <img
            src="/images/ablebiz-logo.png"
            alt="ABLEBIZ"
            className="h-12 md:h-14 lg:h-15 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
          />
        </Link>

        <nav className="hidden items-center gap-1.5 lg:gap-2.5 md:flex">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-semibold text-slate-700 no-underline transition-all hover:bg-slate-100 hover:text-[color:var(--ablebiz-primary)]",
                  isActive &&
                    "bg-blue-50/90 text-[color:var(--ablebiz-primary)] font-bold ring-1 ring-blue-200/70 shadow-xs"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex shrink-0">
          <a
            href={`tel:${site.phone}`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[color:var(--ablebiz-primary)] no-underline ring-1 ring-slate-200 hover:bg-slate-50 transition shadow-xs"
          >
            <Phone className="h-4 w-4 text-[color:var(--ablebiz-cta)]" />
            Call
          </a>
          <Button
            type="button"
            onClick={() => openSpin("get_started")}
            className="h-11 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0 shadow-md hover:shadow-lg transition-all text-sm"
          >
            <Gift className="h-4 w-4 text-slate-950" /> Get Started
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 text-slate-700 transition hover:bg-slate-50 md:hidden"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white/98 backdrop-blur-md shadow-lg md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="flex flex-col gap-2">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-100 transition",
                      isActive &&
                        "bg-blue-50 text-[color:var(--ablebiz-primary)] font-bold ring-1 ring-blue-200"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                <a
                  href={`tel:${site.phone}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-[color:var(--ablebiz-primary)] no-underline ring-1 ring-slate-200 hover:bg-slate-100"
                >
                  <Phone className="h-4 w-4 text-[color:var(--ablebiz-cta)]" />
                  Call
                </a>
                <button
                  type="button"
                  onClick={() => openSpin("get_started")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-2.5 text-sm font-bold text-slate-950 no-underline shadow-sm"
                >
                  <Gift className="h-4 w-4" /> Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
