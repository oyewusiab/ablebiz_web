import { BadgeCheck, Building2, ShieldCheck, Timer } from "lucide-react";
import { site } from "../content/site";

export function TrustBadges() {
  const items = [
    { icon: BadgeCheck, label: "Trusted CAC Agent" },
    { icon: Timer, label: "Fast & Transparent Process" },
    { icon: Building2, label: "Physical Office in Abeokuta" },
    { icon: ShieldCheck, label: site.awardBadge },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => {
        const Icon = i.icon;
        return (
          <div
            key={i.label}
            className="inline-flex items-center gap-2 rounded-full bg-blue-50/80 px-3 py-1 text-xs font-semibold text-[color:var(--ablebiz-primary)] ring-1 ring-blue-200/70"
          >
            <Icon className="h-4 w-4 text-[color:var(--ablebiz-cta)]" />
            <span>{i.label}</span>
          </div>
        );
      })}
    </div>
  );
}
