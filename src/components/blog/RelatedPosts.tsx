import { Link } from "react-router-dom";
import type { BlogPost } from "../../content/blogPosts";
import { Card, CardBody } from "../ui/Card";

export function RelatedPosts({
  posts,
}: {
  posts: Array<Pick<BlogPost, "slug" | "title" | "excerpt" | "featuredImage">>;
}) {
  if (!posts.length) return null;

  return (
    <section className="space-y-4">
      <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
        Related posts
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {posts.map((p) => (
          <Card key={p.slug} className="overflow-hidden">
            <Link to={`/blog/${p.slug}`} className="no-underline">
              <div className="aspect-[16/9] bg-emerald-100">
                <img
                  src={p.featuredImage}
                  alt={p.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <CardBody>
                <div className="text-base font-extrabold text-[color:var(--ablebiz-primary)]">
                  {p.title}
                </div>
                <p className="mt-1 text-sm text-slate-700">{p.excerpt}</p>
              </CardBody>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
