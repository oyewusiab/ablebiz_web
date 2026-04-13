import { Link } from "react-router-dom";
import { Calendar, Clock } from "lucide-react";
import type { BlogPost } from "../../content/blogPosts";
import { formatDateLong, postReadingTime } from "../../utils/blog";
import { Card, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";

export function BlogPostCard({ post }: { post: BlogPost }) {
  const minutes = postReadingTime(post);

  return (
    <Card className="overflow-hidden">
      <Link to={`/blog/${post.slug}`} className="no-underline">
        <div className="aspect-[16/9] w-full bg-emerald-100">
          <img
            src={post.featuredImage}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {post.categories.slice(0, 2).map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
          </div>
          <div className="mt-3 text-lg font-extrabold leading-snug text-[color:var(--ablebiz-primary)]">
            {post.title}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {post.excerpt}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDateLong(post.dateISO)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {minutes} min read
            </span>
          </div>
        </CardBody>
      </Link>
    </Card>
  );
}
