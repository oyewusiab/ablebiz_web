import {
  BadgeCheck,
  Briefcase,
  Building2,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Service } from "../content/services";

export function ServiceIcon({
  icon,
  className,
}: {
  icon: Service["icon"];
  className?: string;
}) {
  const Icon =
    icon === "file"
      ? FileText
      : icon === "users"
        ? Users
        : icon === "shield"
          ? ShieldCheck
          : icon === "briefcase"
            ? Briefcase
            : icon === "building"
              ? Building2
              : BadgeCheck;

  return <Icon className={className} />;
}
