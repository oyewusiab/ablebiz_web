import type { BlogPost } from "../content/blogPosts";

export function estimateReadingTimeMinutes(markdown: string) {
  const words = markdown
    .replace(/[#>*_`\-\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;

  // ~200 wpm typical reading speed
  return Math.max(1, Math.round(words / 200));
}

export function formatDateLong(dateISO: string) {
  const date = new Date(dateISO);
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function postReadingTime(post: BlogPost) {
  return estimateReadingTimeMinutes(
    [post.introMd, post.bodyMd, post.conclusionMd].join("\n\n")
  );
}
