import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";

type Comment = {
  id: string;
  name: string;
  message: string;
  dateISO: string;
};

function keyFor(slug: string) {
  return `ablebiz:comments:${slug}`;
}

export function CommentSection({ slug }: { slug: string }) {
  const storageKey = useMemo(() => keyFor(slug), [slug]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Comment[];
      if (Array.isArray(parsed)) setComments(parsed);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const save = (next: Comment[]) => {
    setComments(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const m = message.trim();
    if (!n || !m) return;

    const next: Comment[] = [
      {
        id: `${Date.now()}`,
        name: n,
        message: m,
        dateISO: new Date().toISOString(),
      },
      ...comments,
    ];

    save(next);
    setName("");
    setMessage("");
  };

  return (
    <section className="space-y-4">
      <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
        Comments
      </div>

      <Card>
        <CardBody>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Your Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
                  placeholder="e.g., Tolu"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-28 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
                placeholder="Share your thoughts..."
              />
            </label>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold border-0"
              >
                Post comment
              </Button>
            </div>

            <p className="text-xs text-slate-600">
              Comments are stored on your device (MVP demo). For production, we can
              connect a real database.
            </p>
          </form>
        </CardBody>
      </Card>

      {comments.length ? (
        <div className="grid gap-3">
          {comments.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    {c.name}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    {new Date(c.dateISO).toLocaleString("en-NG", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">{c.message}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          No comments yet. Be the first to comment.
        </p>
      )}
    </section>
  );
}
