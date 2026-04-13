import { Award, BadgeCheck } from "lucide-react";
import { site } from "../../content/site";
import { Card, CardBody } from "../ui/Card";

export function AuthorBox({
  author,
}: {
  author: { name: string; title: string };
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
              About the author
            </div>
            <div className="mt-1 text-base font-bold text-slate-900">{author.name}</div>
            <div className="text-sm text-slate-700">{author.title}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[color:var(--ablebiz-accent)] ring-1 ring-emerald-200">
              <BadgeCheck className="h-4 w-4" />
              Trusted CAC Agent
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[color:var(--ablebiz-accent)] ring-1 ring-emerald-200">
              <Award className="h-4 w-4" />
              {site.awardBadge}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
