import { Calendar, Clock } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Seo } from "../components/Seo";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";
import { ButtonLink } from "../components/ui/Button";
import { buildWhatsAppLink } from "../content/site";
import { blogPosts } from "../content/blogPosts";
import { formatDateLong, postReadingTime } from "../utils/blog";
import { ShareButtons } from "../components/blog/ShareButtons";
import { AuthorBox } from "../components/blog/AuthorBox";
import { RelatedPosts } from "../components/blog/RelatedPosts";
import { CommentSection } from "../components/blog/CommentSection";
import { BusinessRegistrationStepsInfographic } from "../components/infographics/BusinessRegistrationSteps";
import { BusinessNameVsCompanyInfographic } from "../components/infographics/BusinessNameVsCompany";
import { CtaSection } from "../components/CtaSection";
import { VideoEmbed } from "../components/VideoEmbed";

export function BlogPostPage() {
  const { slug } = useParams();
  const post = blogPosts.find((p) => p.slug === slug);

  const related = useMemo(() => {
    if (!post) return [];
    const set = new Set(post.categories);
    return blogPosts
      .filter((p) => p.slug !== post.slug)
      .filter((p) => p.categories.some((c) => set.has(c)))
      .slice(0, 2);
  }, [post]);

  if (!post) {
    return (
      <Container className="py-20">
        <Card>
          <CardBody>
            <div className="text-lg font-extrabold text-[color:var(--ablebiz-primary)]">
              Post not found
            </div>
            <p className="mt-2 text-sm text-slate-700">
              The post you’re looking for doesn’t exist.
            </p>
            <div className="mt-4">
              <Link
                to="/blog"
                className="text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
              >
                Back to Blog
              </Link>
            </div>
          </CardBody>
        </Card>
      </Container>
    );
  }

  const minutes = postReadingTime(post);
  const whatsapp = buildWhatsAppLink(
    `Hello ABLEBIZ, I read your article “${post.title}” and I need help with registration. Please guide me.`
  );

  return (
    <>
      <Seo title={post.title} description={post.excerpt} path={`/blog/${post.slug}`} />

      <section>
        <Container className="py-10">
          <div className="mb-6">
            <Link
              to="/blog"
              className="text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
            >
              ← Back to Blog
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
            <article className="space-y-6">
              <div>
                <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[color:var(--ablebiz-primary)] sm:text-4xl">
                  {post.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDateLong(post.dateISO)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {minutes} min read
                  </span>
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="aspect-[16/9] bg-emerald-100">
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              </Card>

              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.introMd}</ReactMarkdown>
              </div>

              {post.infographic === "business-registration-steps" ? (
                <BusinessRegistrationStepsInfographic />
              ) : post.infographic === "business-name-vs-company" ? (
                <BusinessNameVsCompanyInfographic />
              ) : null}

              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.bodyMd}</ReactMarkdown>
              </div>

              {post.videoUrl ? (
                <div className="space-y-2">
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    Video
                  </div>
                  <VideoEmbed url={post.videoUrl} title={post.title} />
                </div>
              ) : null}

              <Card>
                <CardBody>
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    Need help registering your business?
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Chat with ABLEBIZ on WhatsApp and we’ll guide you end-to-end.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ButtonLink to={whatsapp} external>
                      Chat on WhatsApp
                    </ButtonLink>
                    <ButtonLink to="/contact" variant="secondary">
                      Contact Form
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>

              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.conclusionMd}</ReactMarkdown>
              </div>

              <AuthorBox author={post.author} />

              <RelatedPosts posts={related} />

              <CommentSection slug={post.slug} />

              <CtaSection />
            </article>

            <aside className="space-y-4">
              <Card>
                <CardBody>
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    Share this post
                  </div>
                  <div className="mt-3">
                    <ShareButtons title={post.title} />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <div className="text-sm font-extrabold text-[color:var(--ablebiz-primary)]">
                    Quick CTA
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Want a guided checklist for your registration type?
                  </p>
                  <div className="mt-4">
                    <ButtonLink to={whatsapp} external>
                      Chat on WhatsApp
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
