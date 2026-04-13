import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Seo } from "../components/Seo";
import { PageHero } from "../components/PageHero";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { BlogPostCard } from "../components/blog/BlogPostCard";
import { CategoryPill } from "../components/blog/CategoryPill";
import { blogCategories, blogPosts } from "../content/blogPosts";

export function BlogIndexPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const featured = useMemo(
    () => blogPosts.find((p) => p.featured) ?? blogPosts[0],
    []
  );

  const popular = useMemo(() => blogPosts.filter((p) => p.popular).slice(0, 4), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blogPosts.filter((p) => {
      const inCategory =
        category === "All" ? true : p.categories.includes(category as any);

      const inQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q);

      return inCategory && inQuery;
    });
  }, [query, category]);

  return (
    <>
      <Seo
        title="Blog / Resources"
        description="Business registration guides, CAC updates, startup tips, compliance and NGO registration resources for Nigerians — built to educate and help you take action with ABLEBIZ." 
        path="/blog"
      />

      <PageHero
        title="Blog / Resources"
        subtitle="Practical guides that educate, rank on Google, and help you take action — built for Nigerian founders."
        badge="Guides • CAC Updates • Compliance"
      />

      <section>
        <Container className="py-10">
          <div className="grid gap-4">
            <Card>
              <CardBody>
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                  <label className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-11 w-full rounded-xl bg-white pl-9 pr-3 text-sm ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="Search articles..."
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <CategoryPill
                      label="All"
                      active={category === "All"}
                      onClick={() => setCategory("All")}
                    />
                    {blogCategories.map((c) => (
                      <CategoryPill
                        key={c}
                        label={c}
                        active={category === c}
                        onClick={() => setCategory(c)}
                      />
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            {featured ? (
              <div>
                <div className="mb-3 text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                  Featured Post
                </div>
                <BlogPostCard post={featured} />
              </div>
            ) : null}

            <div>
              <div className="mb-3 text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                Recent Posts
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <BlogPostCard key={p.slug} post={p} />
                ))}
              </div>

              {!filtered.length ? (
                <div className="mt-6 text-sm text-slate-600">
                  No posts match your search. Try a different keyword or category.
                </div>
              ) : null}
            </div>

            <div>
              <div className="mb-3 text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                Popular Posts
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {popular.map((p) => (
                  <BlogPostCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
