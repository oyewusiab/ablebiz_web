import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Gift, Menu, Phone, X } from "lucide-react";
import { site } from "../content/site";
import { cn } from "../utils/cn";
import { Button } from "./ui/Button";
import { useGamification } from "../gamification/GamificationProvider";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/pricing", label: "Pricing" },
  { to: "/testimonials", label: "Testimonials" },
  { to: "/blog", label: "Blog" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const { openSpin } = useGamification();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);


  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100 bg-[rgba(204,255,204,0.75)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-emerald-100">
            <span className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
              A
            </span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-wide text-[color:var(--ablebiz-primary)]">
              ABLEBIZ
            </div>
            <div className="text-xs font-medium text-[color:var(--ablebiz-accent)]">
              Business Services
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-semibold text-[color:var(--ablebiz-accent)] no-underline hover:text-[color:var(--ablebiz-primary)]",
                  isActive && "text-[color:var(--ablebiz-primary)]"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={`tel:${site.phone}`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[color:var(--ablebiz-primary)] no-underline ring-1 ring-emerald-100 hover:bg-emerald-50"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
          <Button type="button" onClick={() => openSpin("get_started")}>
            <Gift className="h-4 w-4" /> Get Started
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-emerald-100 md:hidden"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-emerald-100 bg-[rgba(204,255,204,0.9)] md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ablebiz-accent)] no-underline hover:bg-emerald-50",
                      isActive &&
                        "bg-white text-[color:var(--ablebiz-primary)] ring-1 ring-emerald-100"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <a
                  href={`tel:${site.phone}`}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[color:var(--ablebiz-primary)] no-underline ring-1 ring-emerald-100"
                >
                  Call
                </a>
                <button
                  type="button"
                  onClick={() => openSpin("get_started")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ablebiz-cta)] px-3 py-2 text-sm font-semibold text-[color:var(--ablebiz-primary)] no-underline"
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
