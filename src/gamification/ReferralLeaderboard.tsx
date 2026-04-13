import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { referralRules } from "../content/gamification";
import { Card, CardBody } from "../components/ui/Card";
import { getMonthlyLeaderboard } from "./storage";
import { rpcGetMonthlyLeaderboard } from "../lib/supabaseApi";
import { supabaseEnabled } from "../lib/supabaseClient";

export function ReferralLeaderboard() {
  const [loading, setLoading] = useState(false);
  const [remoteRows, setRemoteRows] = useState<
    { rank: number; display_name: string; referral_code: string; points: number; referrals: number }[]
  >([]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let mounted = true;
    setLoading(true);
    rpcGetMonthlyLeaderboard(5)
      .then((rows) => {
        if (!mounted) return;
        setRemoteRows(rows);
      })
      .catch(() => {
        if (!mounted) return;
        setRemoteRows([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const rowsLocal = getMonthlyLeaderboard();
  const rows = supabaseEnabled
    ? remoteRows.map((r) => ({
        id: r.referral_code,
        name: r.display_name,
        points: r.points,
        referrals: r.referrals,
      }))
    : rowsLocal.map((r) => ({
        id: r.user.id,
        name: r.user.name,
        points: r.points,
        referrals: r.referrals,
      }));

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
              <Trophy className="h-4 w-4" /> Referral Leaderboard (Monthly)
            </div>
            <p className="mt-1 text-xs text-slate-700">
              1 referral = {referralRules.pointsPerReferral} points. Share your link after you win.
            </p>
          </div>
          <div className="text-[10px] font-semibold text-slate-500">Resets monthly</div>
        </div>

        <div className="mt-4 grid gap-2">
          {loading ? (
            <div className="rounded-xl bg-white/70 px-3 py-3 text-xs text-slate-700 ring-1 ring-emerald-100">
              Loading leaderboard…
            </div>
          ) : rows.length ? (
            rows.map((r, idx) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm ring-1 ring-emerald-100"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">
                    #{idx + 1} {r.name}
                  </div>
                  <div className="text-xs text-slate-600">
                    {r.referrals} referrals • {r.points} points
                  </div>
                </div>
                <div className="text-xs font-semibold text-[color:var(--ablebiz-accent)]">
                  {r.points}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-white/70 px-3 py-3 text-xs text-slate-700 ring-1 ring-emerald-100">
              No referrals yet this month. Be the first — share your link after you spin.
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs text-slate-700 ring-1 ring-emerald-100">
          <div className="font-extrabold text-[color:var(--ablebiz-primary)]">Referral rewards</div>
          <ul className="mt-2 grid gap-1">
            {referralRules.rewards.map((r) => (
              <li key={r.referrals}>
                <span className="font-semibold">{r.referrals} referrals</span> → {r.title}
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
